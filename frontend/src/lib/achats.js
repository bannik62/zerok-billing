/**
 * Lib métier Achats : modèle, nettoyage, validation, calculs.
 * Aucune dépendance Svelte ici.
 */

/**
 * @typedef {Object} Achat
 * @property {string} id
 * @property {string} date           ISO yyyy-mm-dd
 * @property {string} fournisseur
 * @property {string} categorie
 * @property {string} description
 * @property {number} montantHT
 * @property {number} tva            Pourcentage (ex. 20)
 * @property {number} montantTTC
 * @property {string} modePaiement
 * @property {string} numeroFacture
 * @property {string | null | undefined} documentId
 * @property {string} createdAt
 * @property {string | null | undefined} userId
 */

const MAX_TEXT_LEN = 255;

/** Valeurs par défaut pour un nouvel achat (hors id/createdAt/userId). */
export function defaultAchat() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: '',
    date: today,
    fournisseur: '',
    categorie: '',
    description: '',
    montantHT: 0,
    tva: 20,
    montantTTC: 0,
    modePaiement: '',
    numeroFacture: '',
    documentId: null,
    createdAt: '',
    userId: null
  };
}

function sanitizeText(value) {
  let v = typeof value === 'string' ? value : '';
  v = v.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (v.length > MAX_TEXT_LEN) v = v.slice(0, MAX_TEXT_LEN);
  return v;
}

function sanitizeNumber(value, min = 0) {
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (Number.isNaN(n) || !Number.isFinite(n)) return min;
  return n < min ? min : n;
}

/** Nettoie un objet partiel pour produire un Achat cohérent (sans id/userId/createdAt). */
export function sanitizeAchat(partial) {
  const base = defaultAchat();
  const src = partial || {};
  const out = { ...base };
  out.date = sanitizeText(src.date || base.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.date)) out.date = base.date;
  out.fournisseur = sanitizeText(src.fournisseur);
  out.categorie = sanitizeText(src.categorie);
  out.description = sanitizeText(src.description);
  out.modePaiement = sanitizeText(src.modePaiement);
  out.numeroFacture = sanitizeText(src.numeroFacture);
  out.montantHT = sanitizeNumber(src.montantHT, 0);
  out.tva = sanitizeNumber(src.tva, 0);
  out.montantTTC = sanitizeNumber(src.montantTTC, 0);
  out.documentId = src.documentId ? String(src.documentId) : null;
  return out;
}

/** Recalcule montantTTC à partir de montantHT + tva, si possible. */
export function computeMontants(achat) {
  const a = { ...achat };
  const ht = sanitizeNumber(a.montantHT, 0);
  const tva = sanitizeNumber(a.tva, 0);
  const ttc = ht + ht * (tva / 100);
  a.montantHT = ht;
  a.tva = tva;
  a.montantTTC = Math.round(ttc * 100) / 100;
  return a;
}

/** Validation simple d'un achat pour l'interface. */
export function isAchatValid(achat) {
  if (!achat) return false;
  if (!achat.date || !/^\d{4}-\d{2}-\d{2}$/.test(achat.date)) return false;
  if (!achat.fournisseur) return false;
  if (achat.montantTTC < 0) return false;
  if (achat.montantHT < 0) return false;
  return true;
}

