/**
 * Formatage des montants (devis, factures).
 */

export function formatMontant(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 2 }).format(Number(n) ?? 0);
}
