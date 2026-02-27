/**
 * Parsing du texte OCR vers champs facture fournisseur.
 * Responsabilité unique : extraction fournisseur, date, montants, TVA, numero facture.
 * Logique pure, pas d'I/O. Confiance 0-100 selon champs trouves.
 */

import { resolveSupplierFromHeader } from './supplierResolver.js';

const TVA_STANDARDS = [0, 5.5, 10, 20];

const DATE_PATTERNS = [
  /\b(\d{4})-(\d{2})-(\d{2})\b/,
  /\b(\d{2})\/(\d{2})\/(\d{4})\b/,
  /\b(\d{2})-(\d{2})-(\d{4})\b/,
  /\b(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4})\b/
];

// Montants : 1234,56 € ou 1 234 € (décimales optionnelles).
// Inspiré des patterns utilisés dans des projets type invoice2data.
const MONTANT_PATTERN = /(\d[\d\s]*(?:[.,]\d{2})?)\s*€?/g;
// Variantes HT / TTC plus riches (total HT, hors taxe, grand total TTC, etc.)
const MONTANT_HT_LABELS = /\b(?:ht|h\.?t\.?|montant\s*ht|total\s*ht|hors\s+taxe?s?)\b[^\d]{0,20}/i;
const MONTANT_TTC_LABELS = /\b(?:ttc|t\.?t\.?c\.?|total\s*ttc|montant\s*ttc|total\s*facture|grand\s*total)\b[^\d]{0,20}/i;
const TVA_LABELS = /\b(?:tva|t\.?v\.?a\.?)\s*[:\s]*(\d+(?:[.,]\d+)?)\s*%?/i;
// Inclut aussi le mot-clé \"invoice\" utilisé sur certains modèles anglophones.
const NUMERO_PATTERN = /\b(?:n°|no|num(?:ero)?\.?|facture|invoice)\s*[:\s]*([A-Z0-9\-.\/]+)\b/i;

function toIsoDate(match, isYmd) {
  if (!match || match.length < 4) return null;
  let y, m, d;
  if (isYmd) {
    [, y, m, d] = match;
  } else {
    [, d, m, y] = match;
  }
  m = String(m).padStart(2, '0');
  d = String(d).padStart(2, '0');
  if (parseInt(m, 10) > 12) return null;
  return `${y}-${m}-${d}`;
}

function parseMontant(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed) return null;
  // Si pas de virgule/point, on considère que c'est un entier en euros.
  const normalized = /[.,]\d{2}$/.test(trimmed)
    ? trimmed
    : `${trimmed},00`;
  const n = normalized.replace(/\s/g, '').replace(',', '.');
  const v = parseFloat(n);
  return Number.isFinite(v) ? v : null;
}

function findLabeledAmount(labelRegex, text) {
  if (!labelRegex) return null;
  const m = labelRegex.exec(text);
  if (!m) return null;
  const after = text.slice(m.index + m[0].length);
  const next = after.match(MONTANT_PATTERN);
  if (!next) return null;
  return parseMontant(next[0]);
}

export function parseInvoiceText(text) {
  const raw = typeof text === 'string' ? text : '';
  const data = {
    fournisseur: '',
    date: '',
    montantHT: null,
    tva: 20,
    montantTTC: null,
    numeroFacture: ''
  };

  let score = 0;
  const maxScore = 6;

  for (let i = 0; i < DATE_PATTERNS.length; i++) {
    const m = raw.match(DATE_PATTERNS[i]);
    if (m) {
      const iso = toIsoDate(m, i === 0);
      if (iso) {
        data.date = iso;
        score += 1;
        break;
      }
    }
  }

  const montants = [...raw.matchAll(MONTANT_PATTERN)].map((mm) => parseMontant(mm[1])).filter(Boolean);

  // D'abord, on tente les montants labellisés (HT / TTC explicites).
  const labeledHt = findLabeledAmount(MONTANT_HT_LABELS, raw);
  const labeledTtc = findLabeledAmount(MONTANT_TTC_LABELS, raw);
  if (labeledHt != null) data.montantHT = labeledHt;
  if (labeledTtc != null) data.montantTTC = labeledTtc;

  // Ensuite, fallback sur la liste de montants trouvés dans le texte.
  if (data.montantHT == null && montants.length > 0) data.montantHT = montants[0];
  if (data.montantTTC == null && montants.length > 1) data.montantTTC = montants[montants.length - 1];
  if (data.montantHT != null) score += 1;
  if (data.montantTTC != null) score += 1;

  const tvaMatch = raw.match(TVA_LABELS);
  if (tvaMatch) {
    const v = parseFloat(tvaMatch[1].replace(',', '.'));
    if (Number.isFinite(v)) {
      data.tva = TVA_STANDARDS.reduce((a, b) =>
        Math.abs(a - v) <= Math.abs(b - v) ? a : b
      );
      score += 0.5;
    }
  }

  const numMatch = raw.match(NUMERO_PATTERN);
  if (numMatch) {
    data.numeroFacture = numMatch[1].trim().slice(0, 100);
    score += 0.5;
  }

  data.fournisseur = resolveSupplierFromHeader(raw);
  if (data.fournisseur) score += 1;

  const confidence = Math.round((score / maxScore) * 100);
  return {
    data: {
      fournisseur: data.fournisseur,
      date: data.date || undefined,
      montantHT: data.montantHT ?? undefined,
      tva: data.tva,
      montantTTC: data.montantTTC ?? undefined,
      numeroFacture: data.numeroFacture
    },
    confidence: Math.min(100, confidence),
    rawText: raw
  };
}
