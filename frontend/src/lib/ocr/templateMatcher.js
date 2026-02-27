/**
 * Matcher template OCR: applique des patterns par fournisseur avant parser generique.
 */

import { OCR_TEMPLATES } from './templates/common.js';
import { resolveSupplier } from './supplierResolver.js';

const TVA_STANDARDS = [0, 5.5, 10, 20];

function parseAmount(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const clean = raw.replace(/\s/g, '').replace(',', '.');
  const withDecimals = /[.,]\d{2}$/.test(raw.trim()) ? clean : `${clean}.00`;
  const n = parseFloat(withDecimals);
  return Number.isFinite(n) ? n : null;
}

function normalizeDate(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const s = raw.trim();
  let m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    const y = m[1];
    const mo = m[2].padStart(2, '0');
    const d = m[3].padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    const y = m[3];
    return `${y}-${mo}-${d}`;
  }
  return '';
}

function firstCapture(text, patterns) {
  if (!Array.isArray(patterns)) return '';
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return String(m[1]).trim();
    if (m && m[0]) return String(m[0]).trim();
  }
  return '';
}

function scoreTemplate(text, template) {
  const keys = Array.isArray(template?.keywords) ? template.keywords : [];
  if (!keys.length) return 0;
  let ok = 0;
  for (const k of keys) {
    if (k.test(text)) ok += 1;
  }
  return ok / keys.length;
}

export function parseWithTemplate(text, template) {
  if (!template?.fields) return null;
  const f = template.fields;

  const date = normalizeDate(firstCapture(text, f.date));
  const invoiceNumber = firstCapture(text, f.invoiceNumber).slice(0, 100);
  // Resolution fournisseur deleguee a un module dedie.
  const supplier = resolveSupplier(text, template).slice(0, 255);

  const amountHT = parseAmount(firstCapture(text, f.amountHT));
  const amountTTC = parseAmount(firstCapture(text, f.amountTTC));

  const tvaRaw = firstCapture(text, f.tva);
  let tva = 20;
  if (tvaRaw) {
    const n = parseFloat(String(tvaRaw).replace(',', '.'));
    if (Number.isFinite(n)) {
      tva = TVA_STANDARDS.reduce((a, b) => (Math.abs(a - n) <= Math.abs(b - n) ? a : b));
    }
  }

  const hasAny = Boolean(date || supplier || invoiceNumber || amountHT != null || amountTTC != null);
  if (!hasAny) return null;

  let fieldScore = 0;
  if (date) fieldScore += 1;
  if (supplier) fieldScore += 1;
  if (invoiceNumber) fieldScore += 1;
  if (amountHT != null) fieldScore += 1;
  if (amountTTC != null) fieldScore += 1;

  return {
    templateId: template.id,
    data: {
      date: date || undefined,
      fournisseur: supplier || undefined,
      numeroFacture: invoiceNumber || undefined,
      montantHT: amountHT ?? undefined,
      montantTTC: amountTTC ?? undefined,
      tva
    },
    confidence: Math.round((fieldScore / 5) * 100)
  };
}

export function matchAndParseTemplate(text) {
  const input = typeof text === 'string' ? text : '';
  if (!input) return null;

  let best = null;
  for (const t of OCR_TEMPLATES) {
    const keyScore = scoreTemplate(input, t);
    if (keyScore <= 0) continue;

    const parsed = parseWithTemplate(input, t);
    if (!parsed) continue;

    const confidence = Math.round(parsed.confidence * 0.8 + keyScore * 100 * 0.2);
    const candidate = { ...parsed, confidence };

    if (!best || candidate.confidence > best.confidence) best = candidate;
  }

  return best;
}
