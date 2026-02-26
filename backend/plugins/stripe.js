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
 * @throws {Error} Si la clé Stripe est invalide ou la session échoue
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
  if (!secretKey || typeof secretKey !== 'string' || !secretKey.startsWith('sk_')) {
    throw new Error('Clé secrète Stripe invalide');
  }
  if (amountCents < 0 || !Number.isInteger(amountCents)) {
    throw new Error('Montant invalide (doit être un entier positif en centimes)');
  }
  if (!currency || currency.length !== 3) {
    throw new Error('Code devise invalide (ISO 3 lettres requis)');
  }

  try {
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
  } catch (err) {
    // Erreurs Stripe spécifiques : clé invalide, limite dépassée, etc.
    if (err.type === 'StripeAuthenticationError') {
      throw new Error('Clé Stripe invalide ou expirée');
    }
    if (err.type === 'StripeInvalidRequestError') {
      throw new Error(`Requête Stripe invalide : ${err.message}`);
    }
    throw new Error(`Erreur Stripe : ${err.message || 'Création session échouée'}`);
  }
}
