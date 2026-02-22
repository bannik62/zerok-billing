/**
 * Utilitaires et constantes pour le module Éditeur (drag-and-drop devis/facture).
 */

export const BLOCK_TYPES = ['logo', 'societe', 'entete', 'lignes', 'sousTotal', 'reduction', 'total'];

export const BLOCK_LABELS = {
  logo: 'Logo',
  societe: 'Ma société',
  entete: 'Entête client',
  lignes: 'Lignes',
  sousTotal: 'Sous-total',
  reduction: 'Réduction',
  total: 'Total'
};

export function getBlockLabel(type) {
  const label = BLOCK_LABELS[type];
  return label != null ? label : type;
}

export const DEFAULT_W = 40;
export const DEFAULT_H = 15;
export const MIN_W = 15;
export const MIN_H = 8;
export const DRAG_THRESHOLD = 5;

export const FONT_SIZES = [9, 10, 11, 12, 14, 16, 18, 20];

export const FONT_FAMILIES = [
  { label: 'Par défaut', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Times', value: 'Times New Roman, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier', value: 'Courier New, monospace' }
];

export function formatMontant(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 2 }).format(n);
}

export function normalisePos(pos, defaultW = DEFAULT_W, defaultH = DEFAULT_H) {
  if (!pos) return null;
  const w = pos.w != null ? pos.w : defaultW;
  const h = pos.h != null ? pos.h : defaultH;
  let out;
  if (pos.left != null && pos.top != null) out = { left: pos.left, top: pos.top, w, h };
  else if (pos.x != null && pos.y != null) out = { left: pos.x - w / 2, top: pos.y - h / 2, w, h };
  else return null;
  if (pos.fontSize != null) out.fontSize = pos.fontSize;
  if (pos.fontFamily != null) out.fontFamily = pos.fontFamily;
  if (pos.color != null) out.color = pos.color;
  if (pos.textAlign != null) out.textAlign = pos.textAlign;
  if (pos.fontWeight != null) out.fontWeight = pos.fontWeight;
  return out;
}

export function buildBlockStyle(p) {
  if (!p) return '';
  return [
    p.fontSize != null ? `font-size: ${p.fontSize}px` : '',
    p.fontFamily ? `font-family: ${p.fontFamily}` : '',
    p.color ? `color: ${p.color}` : '',
    p.textAlign ? `text-align: ${p.textAlign}` : '',
    p.fontWeight === 'bold' ? 'font-weight: bold' : ''
  ]
    .filter(Boolean)
    .join('; ');
}
