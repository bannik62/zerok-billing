/**
 * Service : marquage payé et statut de paiement des factures (InvoicePaymentSummary).
 */
import { prisma } from '../lib/prisma.js';

/**
 * Marque une facture comme payée (appelé par le webhook Stripe).
 * @param {string} invoiceId
 * @param {string} [stripePaymentIntentId]
 */
export async function markInvoicePaid(invoiceId, stripePaymentIntentId = null) {
  await prisma.invoicePaymentSummary.updateMany({
    where: { invoiceId },
    data: {
      paidAt: new Date(),
      ...(stripePaymentIntentId ? { stripePaymentIntentId } : {})
    }
  });
}

/**
 * Retourne pour chaque invoiceId (parmi ceux de l'utilisateur) si la facture est payée et la date.
 * @param {string} userId
 * @param {string[]} invoiceIds
 * @returns {Promise<Record<string, { paid: boolean, paidAt?: string }>>}
 */
export async function getPaymentStatusByInvoiceIds(userId, invoiceIds) {
  if (!userId || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return {};
  }
  const ids = [...new Set(invoiceIds)].filter(Boolean);
  const rows = await prisma.invoicePaymentSummary.findMany({
    where: { userId, invoiceId: { in: ids } },
    select: { invoiceId: true, paidAt: true }
  });
  const result = {};
  for (const id of ids) {
    result[id] = { paid: false };
  }
  for (const row of rows) {
    result[row.invoiceId] = {
      paid: row.paidAt != null,
      ...(row.paidAt ? { paidAt: row.paidAt.toISOString() } : {})
    };
  }
  return result;
}
