/**
 * Modèles de mise en page (layouts) prédéfinis pour devis et factures.
 */

/** @type {{ id: string, name: string }[]} */
export const LAYOUTS = [
  { id: 'classique', name: 'Classique' },
  { id: 'avec-logo', name: 'Avec logo' },
  { id: 'moderne', name: 'Moderne' },
  { id: 'minimal', name: 'Minimal' }
];

export const DEFAULT_LAYOUT_ID = 'classique';

/** @param {string} [layoutId] @returns {string} */
export function normalizeLayoutId(layoutId) {
  const id = (layoutId || '').trim();
  if (!id) return DEFAULT_LAYOUT_ID;
  return LAYOUTS.some((l) => l.id === id) ? id : DEFAULT_LAYOUT_ID;
}
