/**
 * Routes publiques : signature, paiement, justificatifs.
 * Pas de CSRF ni requireAuth.
 */
import { Router } from 'express';
import { env } from '../config/env.js';
import { log } from '../lib/logger.js';
import { confirmSignRequest } from '../services/signRequestService.js';
import { createPaymentToken, validatePaymentToken } from '../services/paymentTokenService.js';
import { getConfiguredProviders } from '../services/providerConfigService.js';
import { createCheckoutSession, getReceiptUrl, getPaymentDetails } from '../plugins/stripe.js';
import { buildReceiptPdf } from '../services/receiptPdfService.js';
import { markInvoicePaid } from '../services/invoicePaymentService.js';
import { getCheckoutData, getReceiptData } from '../services/paymentSessionService.js';
import { renderSignConfirmError, renderSignConfirmOk, buildPaymentSection } from '../views/signConfirm.js';
import { renderPaymentSuccess, renderPaymentCancel, renderPaymentError, buildReceiptLink } from '../views/paymentPages.js';

const siteUrl = env.allowedOrigins?.[0] || env.BACKEND_PUBLIC_URL || '#';
const baseUrl = env.BACKEND_PUBLIC_URL || env.allowedOrigins?.[0] || 'http://localhost:3011';

export const publicRouter = Router();

// —— API : confirmation de signature (lien email) ——
publicRouter.get('/api/sign/confirm', async (req, res) => {
  try {
    const token = req.query.token ?? '';
    const result = await confirmSignRequest(token);
    if (result.status !== 'ok') {
      return res.json({ status: result.status });
    }
    let paymentToken = null;
    let providers = [];
    if (result.documentType === 'facture' && result.invoiceId && result.userId) {
      try {
        const { token: payToken } = await createPaymentToken({ invoiceId: result.invoiceId, userId: result.userId });
        paymentToken = payToken;
        providers = await getConfiguredProviders(result.userId);
      } catch (_) {
        // ignore: payment token optional
      }
    }
    return res.json({ status: 'ok', documentType: result.documentType, paymentToken, providers });
  } catch (e) {
    return res.json({ status: 'expired' });
  }
});

// —— API : créer une session de paiement (après clic sur icône) ——
publicRouter.post('/api/payment/create-session', async (req, res) => {
  try {
    const { paymentToken: rawToken, provider } = req.body || {};
    if (!rawToken || !provider) {
      return res.status(400).json({ error: 'paymentToken et provider requis' });
    }
    const payload = await validatePaymentToken(rawToken);
    if (!payload) {
      return res.status(400).json({ error: 'Token de paiement invalide ou expiré' });
    }
    const { invoiceId, userId } = payload;
    const data = await getCheckoutData(invoiceId, userId, provider);
    if (!data.ok) {
      const msg = data.reason === 'no_summary' ? 'Montant non défini pour cette facture' : 'Ce moyen de paiement n\'est pas configuré';
      return res.status(400).json({ error: msg });
    }
    const { summary, config } = data;
    if (provider === 'stripe') {
      const secretKey = config.credentials?.secretKey;
      if (!secretKey) {
        return res.status(400).json({ error: 'Config Stripe invalide' });
      }
      const successUrl = `${baseUrl}/paiement/succes?session_id={CHECKOUT_SESSION_ID}&invoice_id=${encodeURIComponent(invoiceId)}&amount_cents=${summary.amountCents}&currency=${encodeURIComponent(summary.currency)}`;
      const cancelUrl = `${baseUrl}/paiement/annule`;
      try {
        const { redirectUrl } = await createCheckoutSession({
          secretKey,
          amountCents: summary.amountCents,
          currency: summary.currency,
          invoiceId,
          successUrl,
          cancelUrl,
          description: `Facture ${invoiceId}`
        });
        log(`[zerok-billing] Session Stripe créée pour facture ${invoiceId} (${summary.amountCents} ${summary.currency})`);
        return res.json({ redirectUrl });
      } catch (stripeErr) {
        log(`[zerok-billing] Erreur Stripe (facture ${invoiceId}): ${stripeErr.message}`);
        return res.status(400).json({ error: stripeErr.message || 'Erreur lors de la création de la session Stripe' });
      }
    }
    return res.status(400).json({ error: 'Provider inconnu' });
  } catch (e) {
    log('[zerok-billing] create-session:', e?.message ?? e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// —— Page : confirmation de signature (lien dans l'email) ——
publicRouter.get('/sign/confirm', async (req, res) => {
  let result;
  try {
    result = await confirmSignRequest(req.query.token);
  } catch (_) {
    result = { status: 'expired' };
  }
  if (result.status !== 'ok') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderSignConfirmError({ siteUrl }));
  }
  let paymentToken = null;
  let providers = [];
  if (result.documentType === 'facture' && result.invoiceId && result.userId) {
    try {
      const { token: payToken } = await createPaymentToken({ invoiceId: result.invoiceId, userId: result.userId });
      paymentToken = payToken;
      providers = await getConfiguredProviders(result.userId);
    } catch (_) {}
  }
  const paymentSection = buildPaymentSection({ paymentToken, providers });
  const html = renderSignConfirmOk({ paymentSection, siteUrl });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// —— Pages paiement ——
publicRouter.get('/paiement/succes', (req, res) => {
  const invoiceId = req.query.invoice_id || '';
  const sessionId = req.query.session_id || '';
  const amountCents = parseInt(req.query.amount_cents, 10);
  const currency = (req.query.currency || 'eur').toUpperCase();
  const amountFormatted = Number.isFinite(amountCents) ? (amountCents / 100).toFixed(2).replace('.', ',') : '';
  const receiptLink = buildReceiptLink(sessionId, invoiceId);
  const html = renderPaymentSuccess({
    invoiceId: invoiceId || undefined,
    amountFormatted: amountFormatted || undefined,
    currency,
    receiptLink,
    siteUrl
  });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

publicRouter.get('/paiement/annule', (_, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderPaymentCancel({ siteUrl }));
});

publicRouter.get('/paiement/receipt', async (req, res) => {
  const sessionId = (req.query.session_id || '').trim();
  const invoiceId = (req.query.invoice_id || '').trim();
  if (!sessionId || !invoiceId) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(renderPaymentError({
      title: 'Justificatif',
      message: 'Lien invalide. Utilisez le bouton depuis la page « Paiement effectué ».',
      siteUrl
    }));
  }
  const data = await getReceiptData(invoiceId);
  if (!data.ok) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const status = data.reason === 'no_summary' ? 404 : 400;
    const message = data.reason === 'no_summary' ? 'Facture introuvable.' : 'Justificatif indisponible.';
    return res.status(status).send(renderPaymentError({ title: 'Justificatif', message, siteUrl }));
  }
  try {
    const receiptUrl = await getReceiptUrl(data.config.credentials.secretKey, sessionId);
    if (receiptUrl) {
      return res.redirect(302, receiptUrl);
    }
  } catch (e) {
    log('[zerok-billing] receipt:', e?.message ?? e);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(502).send(renderPaymentError({
    title: 'Justificatif',
    message: "Le reçu Stripe n'est pas encore disponible. Réessayez dans quelques instants.",
    siteUrl
  }));
});

publicRouter.get('/paiement/receipt/pdf', async (req, res) => {
  const sessionId = (req.query.session_id || '').trim();
  const invoiceId = (req.query.invoice_id || '').trim();
  if (!sessionId || !invoiceId) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(renderPaymentError({
      title: 'Justificatif PDF',
      message: 'Lien invalide.',
      siteUrl
    }));
  }
  const data = await getReceiptData(invoiceId);
  if (!data.ok) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const status = data.reason === 'no_summary' ? 404 : 400;
    const message = data.reason === 'no_summary' ? 'Facture introuvable.' : 'Justificatif indisponible.';
    return res.status(status).send(renderPaymentError({ title: 'Justificatif PDF', message, siteUrl }));
  }
  try {
    const details = await getPaymentDetails(data.config.credentials.secretKey, sessionId);
    const paidAt = details?.paidAt || new Date();
    const paymentIntentId = details?.paymentIntentId || '';
    await markInvoicePaid(invoiceId, paymentIntentId || undefined);
    const pdfBuffer = await buildReceiptPdf({
      invoiceId,
      amountCents: data.summary.amountCents,
      currency: data.summary.currency,
      paidAt,
      paymentIntentId
    });
    const filename = `justificatif-${invoiceId.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (e) {
    log('[zerok-billing] receipt/pdf:', e?.message ?? e);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(502).send(renderPaymentError({
      title: 'Justificatif PDF',
      message: "Une erreur s'est produite.",
      siteUrl
    }));
  }
});
