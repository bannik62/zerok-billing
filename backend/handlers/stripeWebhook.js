/**
 * Handler du webhook Stripe : vérification signature + mise à jour paidAt sur InvoicePaymentSummary.
 */
import Stripe from 'stripe';
import { env } from '../config/env.js';
import { log } from '../lib/logger.js';
import { markInvoicePaid } from '../services/invoicePaymentService.js';

/**
 * Traite POST /api/webhooks/stripe (body brut requis pour la signature).
 * @param {import('express').Request} req - req.body est un Buffer (express.raw)
 * @param {import('express').Response} res
 */
export async function handleStripeWebhook(req, res) {
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || typeof webhookSecret !== 'string') {
    log('[zerok-billing] webhook Stripe: STRIPE_WEBHOOK_SECRET non configuré, ignoré');
    return res.status(200).send();
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).send('Missing Stripe-Signature');
  }

  let body = req.body;
  if (!body) {
    return res.status(400).send('Missing body');
  }
  if (Buffer.isBuffer(body)) {
    body = body.toString('utf8');
  }

  let event;
  try {
    event = Stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    log('[zerok-billing] webhook Stripe: signature invalide', err?.message);
    return res.status(400).send(`Webhook signature verification failed: ${err?.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object;
    const invoiceId = session?.metadata?.invoiceId;
    const paymentIntentId = session?.payment_intent ?? null;
    if (invoiceId) {
      try {
        await markInvoicePaid(invoiceId, paymentIntentId);
        log(`[zerok-billing] webhook Stripe: facture ${invoiceId} marquée payée`);
      } catch (e) {
        log('[zerok-billing] webhook Stripe: markInvoicePaid failed', e?.message);
        return res.status(500).send('Failed to update payment status');
      }
    }
  }

  return res.status(200).send();
}
