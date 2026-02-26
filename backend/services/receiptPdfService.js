/**
 * Generation du justificatif de paiement en PDF (facture).
 */
import PDFDocument from 'pdfkit';

/**
 * Genere un buffer PDF pour un recu de paiement.
 */
export function buildReceiptPdf({ invoiceId, amountCents, currency, paidAt, paymentIntentId = '' }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const amountFormatted = Number.isFinite(amountCents)
      ? (amountCents / 100).toFixed(2).replace('.', ',')
      : '-';
    const currencyUpper = (currency || 'EUR').toUpperCase();
    const dateStr = paidAt instanceof Date && !Number.isNaN(paidAt.getTime())
      ? paidAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '-';

    doc.fontSize(18).text('Justificatif de paiement', { continued: false });
    doc.moveDown(1.5);
    doc.fontSize(11);
    doc.text('Facture n° : ' + (invoiceId || '-'), { continued: false });
    doc.text('Montant payé : ' + amountFormatted + ' ' + currencyUpper, { continued: false });
    doc.text('Date du paiement : ' + dateStr, { continued: false });
    if (paymentIntentId) {
      doc.text('Référence paiement : ' + paymentIntentId, { continued: false });
    }
    doc.moveDown(1);
    doc.fontSize(10).fillColor('#6b7280');
    doc.text('Ce document atteste du règlement de la facture indiquée ci-dessus.', { continued: false });
    doc.end();
  });
}
