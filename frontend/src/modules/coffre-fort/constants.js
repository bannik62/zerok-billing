/** Constantes partagées du module Coffre-fort. */

export const DOC_TYPES = [
  { value: 'justificatif', label: 'Justificatif' },
  { value: 'contrat', label: 'Contrat' },
  { value: 'facture', label: 'Facture' },
  { value: 'attestation', label: 'Attestation' },
  { value: 'banque', label: 'Banque' },
  { value: 'fiche-paie', label: 'Fiche de paie' },
  { value: 'rh', label: 'RH' },
  { value: 'autre', label: 'Autre' }
];

export const METADATA_CATEGORIES = [
  { value: '', label: '—' },
  { value: 'repas', label: 'Repas' },
  { value: 'transport', label: 'Transport' },
  { value: 'fourniture', label: 'Fourniture' },
  { value: 'hebergement', label: 'Hébergement' },
  { value: 'autre', label: 'Autre' }
];

export const MAX_FILE_SIZE_MB = 20;
export const ACCEPT_TYPES = '.pdf,.jpg,.jpeg,.png,.doc,.docx';

export const PREVIEW_MIME_PREFIXES = ['image/', 'application/pdf'];

export function getDocTypeLabel(value) {
  return DOC_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function getCategoryLabel(value) {
  if (!value) return '—';
  return METADATA_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
