/**
 * Hash canonique de l'état local (devis, factures, achats, clients, société) pour la sauvegarde serveur.
 * Permet d'éviter de télécharger le blob quand local et serveur sont identiques.
 * Tri récursif des clés pour que le même contenu produise toujours le même hash.
 */

/**
 * Tri récursif des clés d'un objet (et sous-objets). Les tableaux sont triés par id si les éléments ont id.
 */
function sortKeysDeep(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const hasId = value.length === 0 || (value[0] != null && typeof value[0] === 'object' && 'id' in value[0]);
    const sorted = hasId
      ? [...value].sort((a, b) => String(a?.id ?? '').localeCompare(String(b?.id ?? '')))
      : [...value];
    return sorted.map((v) => sortKeysDeep(v));
  }
  const out = {};
  for (const k of Object.keys(value).sort()) {
    out[k] = sortKeysDeep(value[k]);
  }
  return out;
}

/**
 * Représentation canonique pour le hash : tri des clés à tous les niveaux pour reproductibilité.
 * Doit inclure les mêmes données que buildBundle (backupSync) pour que hash local === hash serveur.
 * @param {Object} bundle - { devis?, factures?, achats?, clients?, societe? }
 * @returns {string} JSON string déterministe
 */
function canonicalBundleString(bundle) {
  const canonical = sortKeysDeep({
    devis: Array.isArray(bundle.devis) ? bundle.devis : [],
    factures: Array.isArray(bundle.factures) ? bundle.factures : [],
    achats: Array.isArray(bundle.achats) ? bundle.achats : [],
    clients: Array.isArray(bundle.clients) ? bundle.clients : [],
    societe: bundle.societe != null && typeof bundle.societe === 'object' ? bundle.societe : null
  });
  return JSON.stringify(canonical);
}

/**
 * Calcule le hash SHA-256 (hex) de l'état du bundle.
 * @param {Object} bundle - { devis?, factures?, achats?, clients?, societe? }
 * @returns {Promise<string>} hash hex
 */
export async function computeStateHash(bundle) {
  const canonical = canonicalBundleString(bundle);
  const enc = new TextEncoder();
  const bytes = await crypto.subtle.digest('SHA-256', enc.encode(canonical));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
