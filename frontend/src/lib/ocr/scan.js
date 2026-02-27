/**
 * Orchestration OCR : fichier (image ou PDF) → texte → parsing.
 * Responsabilité : décider image vs PDF, appeler engine + parser, retourner un seul résultat.
 */

import { recognize } from './engine.js';
import { pdfPageToCanvas } from './pdfToImages.js';
import { parseInvoiceText } from './parser.js';
import { matchAndParseTemplate } from './templateMatcher.js';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
const PDF_TYPE = 'application/pdf';

function isImage(file) {
  return file && IMAGE_TYPES.includes(file.type);
}

function isPdf(file) {
  return file && file.type === PDF_TYPE;
}

function mergeData(templateData, genericData) {
  const t = templateData || {};
  const g = genericData || {};
  return {
    ...g,
    ...t,
    // garde fallback generic si template n'a rien
    date: t.date ?? g.date,
    fournisseur: t.fournisseur ?? g.fournisseur,
    numeroFacture: t.numeroFacture ?? g.numeroFacture,
    montantHT: t.montantHT ?? g.montantHT,
    montantTTC: t.montantTTC ?? g.montantTTC,
    tva: t.tva ?? g.tva
  };
}

/**
 * Lance l'OCR sur un fichier (image ou PDF page 1).
 * @param {File} file
 * @returns {Promise<{ data: Partial<Achat>, confidence: number, rawText?: string }>}
 */
export async function scanFile(file) {
  if (!file || !(file instanceof File)) {
    throw new Error('Fichier invalide');
  }

  let text = '';
  let ocrConfidence = 0;

  if (isPdf(file)) {
    const canvas = await pdfPageToCanvas(file, 1);
    const result = await recognize(canvas);
    text = result.text;
    ocrConfidence = result.confidence;
  } else if (isImage(file)) {
    const result = await recognize(file);
    text = result.text;
    ocrConfidence = result.confidence;
  } else {
    throw new Error('Format non supporté (PDF ou image uniquement)');
  }

  const parsed = parseInvoiceText(text);
  const templateParsed = matchAndParseTemplate(text);
  const finalData = mergeData(templateParsed?.data, parsed.data);

  const semanticConfidence = templateParsed
    ? Math.max(parsed.confidence, templateParsed.confidence)
    : parsed.confidence;

  const combined = Math.round((ocrConfidence * 0.4 + semanticConfidence * 0.6));
  return {
    data: finalData,
    confidence: Math.min(100, combined),
    rawText: parsed.rawText
  };
}
