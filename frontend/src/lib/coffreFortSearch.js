/**
 * Filtrage des documents du coffre-fort par recherche texte.
 * Responsabilité unique : filtrer une liste de documents selon une requête (filename, client, type, metadata).
 */

/**
 * @param {Object[]} documents - liste des documents (avec clientId, filename, type, metadata)
 * @param {string} searchQuery - chaîne de recherche (sera trim + toLowerCase en interne)
 * @param {Record<string, Object>} clientsMap - map clientId -> client (pour raisonSociale, nom, prenom)
 * @param {function(string): string} getDocTypeLabel - (value) => label
 * @param {function(string): string} getCategoryLabel - (value) => label
 * @returns {Object[]} sous-ensemble des documents qui matchent
 */
export function filterDocuments(documents, searchQuery, clientsMap, getDocTypeLabel, getCategoryLabel) {
  const q = (searchQuery || '').trim().toLowerCase();
  if (!q) return documents;
  const clientName = (client) => {
    if (!client) return '';
    return (client.raisonSociale || [client.prenom, client.nom].filter(Boolean).join(' ') || '').toLowerCase();
  };
  return documents.filter((doc) => {
    const filename = (doc.filename || '').toLowerCase();
    const client = clientsMap[doc.clientId];
    const name = clientName(client);
    const typeLabel = getDocTypeLabel(doc.type).toLowerCase();
    const desc = (doc.metadata?.description || '').toLowerCase();
    const amountStr = doc.metadata?.amount != null ? String(doc.metadata.amount) : '';
    const category = getCategoryLabel(doc.metadata?.category).toLowerCase();
    const tags = Array.isArray(doc.metadata?.tags) ? doc.metadata.tags.join(' ').toLowerCase() : '';
    return [filename, name, typeLabel, desc, amountStr, category, tags].some((s) => s.includes(q));
  });
}
