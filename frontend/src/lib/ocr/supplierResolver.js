/**
 * Resolution fournisseur OCR.
 * Responsabilite unique: extraire un nom fournisseur probable a partir du texte OCR.
 * Aucun acces UI/stockage.
 */

const BLOCKLIST = [
  /facture|invoice|avoir|devis/i,
  /date|echeance|periode|emission/i,
  /total|montant|ttc|ht|tva|vat|tax/i,
  /reference|ref|numero|n[°o]/i,
  /client|adresse|telephone|mail|iban|bic/i,
  /net a payer|a regler|paiement/i
];

const LEGAL_HINTS = /\b(sas|sarl|sa|eurl|sasu|ltd|llc|inc|gmbh|bv|ovh|edf|amazon)\b/i;
const DATE_LIKE = /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b|\b\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}\b/;
const AMOUNT_LIKE = /\b\d[\d\s]*(?:[.,]\d{2})?\s*€?\b/;

function cleanLine(line) {
  return String(line || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBlocked(line) {
  return BLOCKLIST.some((r) => r.test(line));
}

function scoreSupplierLine(line) {
  if (!line) return -999;
  if (line.length < 3 || line.length > 90) return -999;
  if (!/[a-zA-Z]/.test(line)) return -999;

  let score = 0;
  if (!isBlocked(line)) score += 2;
  if (LEGAL_HINTS.test(line)) score += 2;
  if (line.split(' ').length >= 2) score += 1;
  if (DATE_LIKE.test(line)) score -= 2;
  if (AMOUNT_LIKE.test(line)) score -= 2;
  if ((line.match(/\d/g) || []).length > 6) score -= 2;
  if (/^[A-Z0-9&.\- ]+$/.test(line)) score += 1;
  return score;
}

function captureWithPatterns(text, patterns) {
  if (!Array.isArray(patterns)) return '';
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const raw = m[1] || m[0] || '';
    const cleaned = cleanLine(raw).slice(0, 255);
    if (!cleaned || isBlocked(cleaned)) continue;
    return cleaned;
  }
  return '';
}

export function resolveSupplierFromTemplate(text, template) {
  const patterns = template?.fields?.supplier;
  return captureWithPatterns(text, patterns);
}

export function resolveSupplierFromHeader(text, maxLines = 10) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean)
    .slice(0, maxLines);

  let best = '';
  let bestScore = -999;
  for (const line of lines) {
    const score = scoreSupplierLine(line);
    if (score > bestScore) {
      bestScore = score;
      best = line;
    }
  }
  return bestScore > 0 ? best : '';
}

export function resolveSupplier(text, template = null) {
  const fromTemplate = resolveSupplierFromTemplate(text, template);
  if (fromTemplate) return fromTemplate;
  return resolveSupplierFromHeader(text);
}

