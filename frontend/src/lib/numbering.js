/**
 * Logique de numérotation devis/factures.
 * Responsabilité unique : slugs client et calcul du prochain numéro (DEV-{slug}-{year}-NNN, FAC-{slug}-{year}-NNN).
 */

/**
 * Slug pour le numéro de devis : basé sur raison sociale ou prénom+nom, unique parmi les clients.
 * @param {Object} client - { raisonSociale?, prenom?, nom? }
 * @param {Object[]} allClients - liste des clients pour garantir unicité du slug
 * @returns {string}
 */
export function getClientDevisSlug(client, allClients = []) {
  const raw =
    (client && (client.raisonSociale || [client.prenom, client.nom].filter(Boolean).join(' '))) || '';
  const slug = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'client';
  const sameSlug = allClients.filter((c) => {
    const s =
      (c.raisonSociale || [c.prenom, c.nom].filter(Boolean).join(' '))
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'client';
    return s === slug;
  });
  const index = sameSlug.findIndex((c) => c.id === client?.id);
  if (index < 0) return slug;
  return sameSlug.length > 1 ? `${slug}${index + 1}` : slug;
}

/**
 * Prochain numéro de devis : DEV-{clientSlug}-{année}-NNN.
 * @param {string} clientId
 * @param {Object[]} clients
 * @param {Object[]} allDevis - devis existants (déjà chargés)
 * @returns {string}
 */
export function computeNextDevisNumber(clientId, clients = [], allDevis = []) {
  if (!clientId || !Array.isArray(clients)) return '';
  const client = clients.find((c) => c.id === clientId);
  if (!client) return '';
  const slug = getClientDevisSlug(client, clients);
  const year = new Date().getFullYear();
  const prefix = `DEV-${slug}-${year}-`;
  const forClient = allDevis.filter((d) => d.clientId === clientId && (d.entete?.numero || '').startsWith(prefix));
  let max = 0;
  for (const d of forClient) {
    const n = parseInt((d.entete?.numero || '').slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return prefix + String(max + 1).padStart(3, '0');
}

/**
 * Prochain numéro de facture : FAC-{clientSlug}-{année}-NNN.
 * @param {string} clientId
 * @param {Object[]} clients
 * @param {Object[]} allFactures - factures existantes (déjà chargées)
 * @returns {string}
 */
export function computeNextFactureNumber(clientId, clients = [], allFactures = []) {
  if (!clientId || !Array.isArray(clients)) return '';
  const client = clients.find((c) => c.id === clientId);
  if (!client) return '';
  const slug = getClientDevisSlug(client, clients);
  const year = new Date().getFullYear();
  const prefix = `FAC-${slug}-${year}-`;
  const forClient = allFactures.filter(
    (f) => f.clientId === clientId && (f.entete?.numero || '').startsWith(prefix)
  );
  let max = 0;
  for (const f of forClient) {
    const n = parseInt((f.entete?.numero || '').slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return prefix + String(max + 1).padStart(3, '0');
}
