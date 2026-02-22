/**
 * Helpers pour la liste documents (devis / factures).
 * Fonctions pures, réutilisables.
 */

export function clientDisplayName(client) {
  if (!client) return '—';
  return client.raisonSociale || [client.prenom, client.nom].filter(Boolean).join(' ') || '—';
}

/**
 * Libellé lisible pour une preuve (invoiceId) : "Devis n° — Client" ou "Facture n° — Client".
 * @param {string} invoiceId
 * @param {Array} devisList
 * @param {Array} facturesList
 * @param {Record<string, object>} clientsMap
 */
export function getProofLabel(invoiceId, devisList, facturesList, clientsMap) {
  if (!invoiceId) return '—';
  const devis = (devisList || []).find((d) => d.id === invoiceId);
  if (devis) {
    const numero = devis.entete?.numero || devis.id;
    const client = clientsMap?.[devis.entete?.clientId];
    return `Devis ${numero} — ${clientDisplayName(client)}`;
  }
  const facture = (facturesList || []).find((f) => f.id === invoiceId);
  if (facture) {
    const numero = facture.entete?.numero || facture.id;
    const client = clientsMap?.[facture.entete?.clientId];
    return `Facture ${numero} — ${clientDisplayName(client)}`;
  }
  return invoiceId.length > 24 ? invoiceId.slice(0, 22) + '…' : invoiceId;
}
