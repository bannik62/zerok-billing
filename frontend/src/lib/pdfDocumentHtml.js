/**
 * Génère le HTML d'un devis/facture pour export PDF (chaîne passée à html2pdf).
 * Pas de capture DOM : html2pdf rend cette chaîne, donc pas de page blanche.
 */

function esc(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMontant(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 2 }).format(Number(n) || 0);
}

/**
 * @param {object} document - document.entete, document.lignes, document.sousTotal, document.total, etc.
 * @param {object} client - raisonSociale ou nom/prénom, adresse, codePostal, ville, siret
 * @param {object} societe - nom, formeJuridique, siret, rcs, capital, siegeSocial, tvaIntra
 * @param {'devis'|'facture'} docType
 * @returns {string} HTML pour une page A4
 */
export function buildPdfDocumentHtml(document, client, societe, docType) {
  const isFacture = docType === 'facture';
  const entete = document?.entete ?? {};
  const lignes = document?.lignes ?? [];
  const total = Number(document?.total) ?? 0;
  const sousTotal = Number(document?.sousTotal) ?? total;
  const tauxTva = Number(entete?.tvaTaux) || 0;
  const tvaMontant = document?.tvaMontant ?? (tauxTva ? total * (tauxTva / 100) : 0);
  const totalTTC = document?.totalTTC ?? total + tvaMontant;

  const clientName = client
    ? (client.raisonSociale || [client.prenom, client.nom].filter(Boolean).join(' ') || '—')
    : '—';
  const clientAdresse = client && [client.adresse, [client.codePostal, client.ville].filter(Boolean).join(' ')].filter(Boolean).length
    ? [client.adresse, [client.codePostal, client.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    : '';

  let lignesRows = '';
  for (const l of lignes) {
    const qte = Number(l.quantite) || 0;
    const pu = Number(l.prixUnitaire) || 0;
    lignesRows += '<tr><td>' + esc(l.designation || '—') + '</td><td>' + qte + '</td><td>' + formatMontant(pu) + '</td><td>' + formatMontant(qte * pu) + ' €</td></tr>';
  }

  const societeNom = esc(societe?.nom || '');
  const societeInfos = [
    societe?.formeJuridique,
    societe?.siret ? 'SIRET : ' + societe.siret : '',
    societe?.rcs ? 'RCS : ' + societe.rcs : '',
    societe?.capital ? 'Capital : ' + societe.capital : '',
    societe?.siegeSocial || '',
    societe?.tvaIntra ? 'TVA : ' + societe.tvaIntra : ''
  ].filter(Boolean).map((s) => esc(s)).join(' — ');

  const title = isFacture ? 'Facture' : 'Devis';
  const numero = esc(entete.numero || '—');
  const dateEmission = esc(entete.dateEmission || '');
  const dateValidite = esc(entete.dateValidite || '');
  const delaiPaiement = esc(entete.delaiPaiement || '');
  const mentionsFacture = isFacture
    ? '<p class="mentions">En cas de retard de paiement, des pénalités de retard seront appliquées à partir du lendemain de la date d\'échéance, au taux d\'intérêt légal. Une indemnité forfaitaire de 40 € sera due pour frais de recouvrement.</p>'
    : '';

  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><style>',
    'body{font-family:system-ui,sans-serif;font-size:11px;color:#111;padding:16px;margin:0}',
    '.head{display:flex;justify-content:space-between;margin-bottom:24px}.societe{max-width:45%}.societe p{margin:0 0 4px 0}',
    '.doc-title{font-size:16px;font-weight:700;margin-bottom:12px}.entete p{margin:0 0 4px 0}',
    'table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}',
    'th{background:#f0f0f0;font-weight:600}td:nth-child(2),td:nth-child(3),td:nth-child(4){text-align:right}',
    '.totaux{margin-top:16px;text-align:right}.totaux p{margin:4px 0}.total-ttc{font-size:14px;font-weight:700}',
    '.mentions{font-size:9px;color:#666;margin-top:24px;max-width:80%}',
    '</style></head><body>',
    '<div class="head"><div class="societe"><p><strong>' + societeNom + '</strong></p>' + (societeInfos ? '<p>' + societeInfos + '</p>' : '') + '</div>',
    '<div class="entete"><p class="doc-title">' + title + ' n° ' + numero + '</p>' +
      (dateEmission ? '<p>Émission : ' + dateEmission + '</p>' : '') +
      (!isFacture && dateValidite ? '<p>Valide jusqu\'au : ' + dateValidite + '</p>' : '') +
      (isFacture && delaiPaiement ? '<p>Délai de paiement : ' + delaiPaiement + '</p>' : '') +
    '</div></div>',
    '<div class="client"><p><strong>' + clientName + '</strong></p>' + (clientAdresse ? '<p>' + esc(clientAdresse) + '</p>' : '') + (client?.siret ? '<p>SIRET : ' + esc(client.siret) + '</p>' : '') + '</div>',
    '<table><thead><tr><th>Désignation</th><th>Qté</th><th>PU</th><th>Montant</th></tr></thead><tbody>' + (lignesRows || '<tr><td colspan="4">—</td></tr>') + '</tbody></table>',
    '<div class="totaux"><p>Sous-total : ' + formatMontant(sousTotal) + ' €</p><p>Total HT : ' + formatMontant(total) + ' €</p>' +
      (tauxTva > 0 ? '<p>TVA (' + tauxTva + ' %) : ' + formatMontant(tvaMontant) + ' €</p><p class="total-ttc">Total TTC : ' + formatMontant(totalTTC) + ' €</p>' : '') +
    '</div>',
    mentionsFacture,
    '</body></html>'
  ].join('');
}
