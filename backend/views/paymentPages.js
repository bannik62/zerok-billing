/**
 * Vues HTML pour les pages de paiement (/paiement/*).
 */

import { esc } from './utils.js';

/**
 * Construit le bloc HTML des liens vers le justificatif Stripe et le PDF.
 */
export function buildReceiptLink(sessionId, invoiceId) {
  if (!sessionId || !invoiceId) return '';
  const sessionEnc = encodeURIComponent(sessionId);
  const invoiceEnc = encodeURIComponent(invoiceId);
  return `<p style="margin-top: 1.5rem;"><a href="/paiement/receipt?session_id=${sessionEnc}&invoice_id=${invoiceEnc}" style="display: inline-block; padding: 0.5rem 1rem; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">Justificatif (Stripe)</a> <a href="/paiement/receipt/pdf?session_id=${sessionEnc}&invoice_id=${invoiceEnc}" style="display: inline-block; padding: 0.5rem 1rem; background: #059669; color: #fff; text-decoration: none; border-radius: 6px;">Télécharger le justificatif (PDF)</a></p>`;
}

export function renderPaymentSuccess({ invoiceId, amountFormatted, currency, receiptLink, siteUrl }) {
  const invoiceLine = invoiceId ? `<p><strong>Facture n°</strong> ${esc(invoiceId)}</p>` : '';
  const amountLine = amountFormatted ? `<p><strong>Montant payé</strong> ${esc(amountFormatted)} ${esc(currency)}</p>` : '';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Paiement effectué</title>
</head>
<body style="font-family: sans-serif; max-width: 480px; margin: 3rem auto; padding: 1rem; text-align: center;">
  <h1>Paiement effectué</h1>
  <p>Merci, votre paiement a bien été enregistré.</p>
  ${invoiceLine}
  ${amountLine}
  ${receiptLink}
  <p style="margin-top: 1.5rem; color: #6b7280;">Vous pouvez fermer cette fenêtre.</p>
  <p style="margin-top: 2rem;">
    <a href="${esc(siteUrl)}" style="color: #2563eb; text-decoration: underline;">Accéder au site</a>
  </p>
</body>
</html>`;
}

export function renderPaymentCancel({ siteUrl }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Paiement annulé</title>
</head>
<body style="font-family: sans-serif; max-width: 480px; margin: 3rem auto; padding: 1rem; text-align: center;">
  <h1>Paiement annulé</h1>
  <p>Vous avez annulé le paiement. Vous pouvez réessayer plus tard depuis le lien de la facture.</p>
  <p style="margin-top: 2rem;">
    <a href="${esc(siteUrl)}" style="color: #2563eb; text-decoration: underline;">Accéder au site</a>
  </p>
</body>
</html>`;
}

/**
 * Page d'erreur générique pour les flux paiement.
 */
export function renderPaymentError({ title, message, siteUrl }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
</head>
<body style="font-family: sans-serif; max-width: 480px; margin: 3rem auto; padding: 1rem; text-align: center;">
  <h1>${esc(title)}</h1>
  <p>${esc(message)}</p>
  <p style="margin-top: 2rem;">
    <a href="${esc(siteUrl)}" style="color: #2563eb; text-decoration: underline;">Accéder au site</a>
  </p>
</body>
</html>`;
}
