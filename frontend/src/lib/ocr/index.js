/**
 * Point d'entrée OCR : exposition du scan pour l'UI.
 * Les sous-modules (engine, pdfToImages, parser) restent utilisables séparément.
 */

export { scanFile } from './scan.js';
export { parseInvoiceText } from './parser.js';
export { matchAndParseTemplate, parseWithTemplate } from './templateMatcher.js';
export { recognize, terminate } from './engine.js';
export { pdfPageToCanvas, getPdfPageCount } from './pdfToImages.js';
