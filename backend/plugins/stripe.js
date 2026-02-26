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

/**
 * Récupère l'URL du reçu Stripe pour une session Checkout (paiement réussi).
 * @param {string} secretKey - Clé secrète Stripe du Pro
 * @param {string} sessionId - ID de la session Checkout (cs_...)
 * @returns {Promise<string|null>} - URL du reçu ou null si indisponible
 */
export async function getReceiptUrl(secretKey, sessionId) {
  if (!secretKey || typeof secretKey !== 'string' || !secretKey.startsWith('sk_')) {
    throw new Error('Clé secrète Stripe invalide');
  }
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('session_id requis');
  }
  const stripe = new Stripe(secretKey);
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent.charges.data']
  });
  if (!session || session.payment_status !== 'paid') return null;
  const paymentIntent = session.payment_intent;
  if (!paymentIntent || typeof paymentIntent === 'string') return null;
  const charges = paymentIntent.charges?.data;
  if (!charges || charges.length === 0) return null;
  return charges[0].receipt_url || null;
}

/**
 * Récupère les infos de paiement pour une session Checkout (date, statut, id).
 * Utilisé pour le justificatif PDF.
 * @param {string} secretKey - Clé secrète Stripe du Pro
 * @param {string} sessionId - ID de la session Checkout (cs_...)
 * @returns {Promise<{ paidAt: Date, paymentIntentId: string } | null>}
 */
export async function getPaymentDetails(secretKey, sessionId) {
  if (!secretKey || typeof secretKey !== 'string' || !secretKey.startsWith('sk_')) {
    throw new Error('Clé secrète Stripe invalide');
  }
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('session_id requis');
  }
  const stripe = new Stripe(secretKey);
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent.charges.data']
  });
  if (!session || session.payment_status !== 'paid') return null;
  const paymentIntent = session.payment_intent;
  if (!paymentIntent || typeof paymentIntent === 'string') return null;
  const charges = paymentIntent.charges?.data;
  if (!charges || charges.length === 0) return null;
  const charge = charges[0];
  const paidAt = charge.created ? new Date(charge.created * 1000) : new Date();
  return { paidAt, paymentIntentId: paymentIntent.id || '' };
}
