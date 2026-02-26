/**
 * Plugin Stripe : création d'une session Checkout pour paiement one-shot.
 */
import Stripe from 'stripe';

/**
 * Crée une session Stripe Checkout et retourne l'URL de redirection.
 * @param {{
 *   secretKey: string,
 *   amountCents: number,
 *   currency: string,
 *   invoiceId: string,
 *   successUrl: string,
 *   cancelUrl: string,
 *   description?: string
 * }} opts
 * @returns {Promise<{ redirectUrl: string }>}
 */
export async function createCheckoutSession({
  secretKey,
  amountCents,
  currency,
  invoiceId,
  successUrl,
  cancelUrl,
  description
}) {
  const stripe = new Stripe(secretKey);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: amountCents,
          product_data: {
            name: description || `Facture ${invoiceId}`,
            description: `Paiement facture ${invoiceId}`
          }
        },
        quantity: 1
      }
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { invoiceId }
  });
  return { redirectUrl: session.url };
}
