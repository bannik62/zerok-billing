<script>
  /**
   * Rendu fixe d'un devis ou d'une facture (layout classique).
   * Responsabilité unique : afficher document + client + societe.
   * Réutilisé pour écran et impression (PrintPreviewModal).
   */
  import { normalizeLayoutId } from '$lib/documentLayouts.js';

  let {
    document = null,
    resolvedClient = null,
    resolvedSociete = null,
    documentType = 'devis',
    layoutId = 'classique'
  } = $props();

  const layout = $derived(normalizeLayoutId(layoutId));
  const isFacture = $derived(documentType === 'facture');
  const entete = $derived(document?.entete ?? {});
  const lignes = $derived(document?.lignes ?? []);
  const total = $derived(Number(document?.total) ?? 0);
  const sousTotal = $derived(Number(document?.sousTotal) ?? total);
  const tauxTva = $derived(Number(entete?.tvaTaux) || 0);
  const tvaMontant = $derived(document?.tvaMontant ?? (tauxTva ? total * (tauxTva / 100) : 0));
  const totalTTC = $derived(document?.totalTTC ?? total + tvaMontant);
  const remiseMontant = $derived(Math.max(0, Number(sousTotal) - Number(total)));
  const hasRemise = $derived(remiseMontant > 0);

  const clientName = $derived(
    resolvedClient
      ? (resolvedClient.raisonSociale || [resolvedClient.prenom, resolvedClient.nom].filter(Boolean).join(' ') || '—')
      : '—'
  );
  const clientAdresse = $derived(
    resolvedClient && [resolvedClient.adresse, [resolvedClient.codePostal, resolvedClient.ville].filter(Boolean).join(' ')].filter(Boolean).length
      ? [resolvedClient.adresse, [resolvedClient.codePostal, resolvedClient.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
      : ''
  );
  const societeNom = $derived(resolvedSociete?.nom || '');

  const title = $derived(isFacture ? 'Facture' : 'Devis');
  const numero = $derived(entete.numero || '—');

  function formatMontant(n) {
    return new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 2 }).format(Number(n) || 0);
  }
</script>

<div class="document-layout document-layout--{layout}" data-layout-id={layout}>
  {#if layout === 'avec-logo'}
    <!-- Layout : émetteur gauche | logo centre (surplombant) | client droite -->
    <div class="document-layout-head document-layout-head--avec-logo">
      <div class="document-layout-societe">
        <p class="document-layout-societe-nom"><strong>{societeNom}</strong></p>
        {#if resolvedSociete?.formeJuridique}<p>{resolvedSociete.formeJuridique}</p>{/if}
        {#if resolvedSociete?.siret}<p>SIRET : {resolvedSociete.siret}</p>{/if}
        {#if resolvedSociete?.rcs}<p>RCS : {resolvedSociete.rcs}</p>{/if}
        {#if resolvedSociete?.capital}<p>Capital : {resolvedSociete.capital}</p>{/if}
        {#if resolvedSociete?.siegeSocial}<p>{resolvedSociete.siegeSocial}</p>{/if}
        {#if resolvedSociete?.tvaIntra}<p>TVA : {resolvedSociete.tvaIntra}</p>{/if}
      </div>
      <div class="document-layout-logo-wrap">
        {#if resolvedSociete?.logo}
          <img src={resolvedSociete.logo} alt="Logo" class="document-layout-logo" />
        {:else}
          <div class="document-layout-logo-placeholder">Logo</div>
        {/if}
      </div>
      <div class="document-layout-client">
        <p><strong>{clientName}</strong></p>
        {#if clientAdresse}<p>{clientAdresse}</p>{/if}
        {#if resolvedClient?.siret}<p>SIRET : {resolvedClient.siret}</p>{/if}
      </div>
    </div>
    <div class="document-layout-entete document-layout-entete--below-head">
      <p class="document-layout-doc-title">{title} n° {numero}</p>
      {#if entete.dateEmission}<p>Émission : {entete.dateEmission}</p>{/if}
      {#if !isFacture && entete.dateValidite}<p>Valide jusqu'au : {entete.dateValidite}</p>{/if}
      {#if isFacture && entete.delaiPaiement}<p>Délai de paiement : {entete.delaiPaiement}</p>{/if}
    </div>
  {:else if layout === 'moderne'}
    <!-- Moderne : société à gauche (plus grand), client à droite encadré, titre centré sous l'en-tête -->
    <div class="document-layout-head document-layout-head--moderne">
      <div class="document-layout-societe document-layout-societe--moderne">
        {#if resolvedSociete?.logo}
          <img src={resolvedSociete.logo} alt="Logo" class="document-layout-logo document-layout-logo--moderne" />
        {/if}
        <p class="document-layout-societe-nom"><strong>{societeNom}</strong></p>
        {#if resolvedSociete?.formeJuridique}<p>{resolvedSociete.formeJuridique}</p>{/if}
        {#if resolvedSociete?.siret}<p>SIRET : {resolvedSociete.siret}</p>{/if}
        {#if resolvedSociete?.rcs}<p>RCS : {resolvedSociete.rcs}</p>{/if}
        {#if resolvedSociete?.capital}<p>Capital : {resolvedSociete.capital}</p>{/if}
        {#if resolvedSociete?.siegeSocial}<p>{resolvedSociete.siegeSocial}</p>{/if}
        {#if resolvedSociete?.tvaIntra}<p>TVA : {resolvedSociete.tvaIntra}</p>{/if}
      </div>
      <div class="document-layout-client document-layout-client--moderne">
        <p><strong>{clientName}</strong></p>
        {#if clientAdresse}<p>{clientAdresse}</p>{/if}
        {#if resolvedClient?.siret}<p>SIRET : {resolvedClient.siret}</p>{/if}
      </div>
    </div>
    <div class="document-layout-entete document-layout-entete--moderne">
      <p class="document-layout-doc-title">{title} n° {numero}</p>
      {#if entete.dateEmission}<p>Émission : {entete.dateEmission}</p>{/if}
      {#if !isFacture && entete.dateValidite}<p>Valide jusqu'au : {entete.dateValidite}</p>{/if}
      {#if isFacture && entete.delaiPaiement}<p>Délai de paiement : {entete.delaiPaiement}</p>{/if}
    </div>
  {:else if layout === 'minimal'}
    <!-- Minimal : une ligne société gauche / client droite, titre + dates regroupés, épuré -->
    <div class="document-layout-head document-layout-head--minimal">
      <div class="document-layout-societe document-layout-societe--minimal">
        <p class="document-layout-societe-nom"><strong>{societeNom}</strong></p>
        {#if resolvedSociete?.formeJuridique}<p>{resolvedSociete.formeJuridique}</p>{/if}
        {#if resolvedSociete?.siret}<p>SIRET : {resolvedSociete.siret}</p>{/if}
        {#if resolvedSociete?.rcs}<p>RCS : {resolvedSociete.rcs}</p>{/if}
        {#if resolvedSociete?.capital}<p>Capital : {resolvedSociete.capital}</p>{/if}
        {#if resolvedSociete?.siegeSocial}<p>{resolvedSociete.siegeSocial}</p>{/if}
        {#if resolvedSociete?.tvaIntra}<p>TVA : {resolvedSociete.tvaIntra}</p>{/if}
      </div>
      <div class="document-layout-entete document-layout-entete--minimal">
        <p class="document-layout-doc-title">{title} n° {numero}</p>
        {#if entete.dateEmission}<p>Émission : {entete.dateEmission}</p>{/if}
        {#if !isFacture && entete.dateValidite}<p>Valide jusqu'au : {entete.dateValidite}</p>{/if}
        {#if isFacture && entete.delaiPaiement}<p>Délai de paiement : {entete.delaiPaiement}</p>{/if}
      </div>
      <div class="document-layout-client document-layout-client--minimal">
        <p><strong>{clientName}</strong></p>
        {#if clientAdresse}<p>{clientAdresse}</p>{/if}
        {#if resolvedClient?.siret}<p>SIRET : {resolvedClient.siret}</p>{/if}
      </div>
    </div>
  {:else}
    <!-- Layout classique -->
    <div class="document-layout-head">
      <div class="document-layout-societe">
        <p class="document-layout-societe-nom"><strong>{societeNom}</strong></p>
        {#if resolvedSociete?.formeJuridique}<p>{resolvedSociete.formeJuridique}</p>{/if}
        {#if resolvedSociete?.siret}<p>SIRET : {resolvedSociete.siret}</p>{/if}
        {#if resolvedSociete?.rcs}<p>RCS : {resolvedSociete.rcs}</p>{/if}
        {#if resolvedSociete?.capital}<p>Capital : {resolvedSociete.capital}</p>{/if}
        {#if resolvedSociete?.siegeSocial}<p>{resolvedSociete.siegeSocial}</p>{/if}
        {#if resolvedSociete?.tvaIntra}<p>TVA : {resolvedSociete.tvaIntra}</p>{/if}
      </div>
      <div class="document-layout-entete">
        <p class="document-layout-doc-title">{title} n° {numero}</p>
        {#if entete.dateEmission}<p>Émission : {entete.dateEmission}</p>{/if}
        {#if !isFacture && entete.dateValidite}<p>Valide jusqu'au : {entete.dateValidite}</p>{/if}
        {#if isFacture && entete.delaiPaiement}<p>Délai de paiement : {entete.delaiPaiement}</p>{/if}
      </div>
    </div>
    <div class="document-layout-client">
      <p><strong>{clientName}</strong></p>
      {#if clientAdresse}<p>{clientAdresse}</p>{/if}
      {#if resolvedClient?.siret}<p>SIRET : {resolvedClient.siret}</p>{/if}
    </div>
  {/if}

  <table class="document-layout-table">
    <thead>
      <tr>
        <th>Désignation</th>
        <th>Qté</th>
        <th>PU</th>
        <th>Montant</th>
      </tr>
    </thead>
    <tbody>
      {#each lignes as l}
        {@const qte = Number(l.quantite) || 0}
        {@const pu = Number(l.prixUnitaire) || 0}
        {@const montant = qte * pu}
        <tr>
          <td>{l.designation || '—'}</td>
          <td>{qte}</td>
          <td>{formatMontant(pu)}</td>
          <td>{formatMontant(montant)} €</td>
        </tr>
      {:else}
        <tr><td colspan="4">—</td></tr>
      {/each}
    </tbody>
  </table>

  <div class="document-layout-totaux">
    <p>Sous-total : {formatMontant(sousTotal)} €</p>
    {#if hasRemise}
      <p>Remise : -{formatMontant(remiseMontant)} €</p>
    {/if}
    <p>Total HT : {formatMontant(total)} €</p>
    {#if tauxTva > 0}
      <p>TVA ({tauxTva} %) : {formatMontant(tvaMontant)} €</p>
    {/if}
    <p class="document-layout-total-ttc">Total TTC : {formatMontant(totalTTC)} €</p>
  </div>

  {#if isFacture}
    <div class="document-layout-mentions-wrap">
      <p class="document-layout-mentions">
        En cas de retard de paiement, des pénalités de retard seront appliquées à partir du lendemain de la date d'échéance, au taux d'intérêt légal. Une indemnité forfaitaire de 40 € sera due pour frais de recouvrement.
      </p>
    </div>
  {/if}
</div>

<style>
  .document-layout {
    background: #fff;
    color: #000;
    font-family: Arial, sans-serif;
    font-size: 11px;
    padding: 16px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }
  .document-layout-head {
    display: flex;
    justify-content: space-between;
    margin-bottom: 24px;
    flex-shrink: 0;
  }
  .document-layout-head--avec-logo {
    align-items: stretch;
    gap: 16px;
  }
  .document-layout-head--avec-logo .document-layout-societe,
  .document-layout-head--avec-logo .document-layout-client {
    flex: 0 1 28%;
    max-width: 28%;
  }
  .document-layout-logo-wrap {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 90px;
    padding: 0 8px;
  }
  .document-layout-logo {
    max-height: 80px;
    max-width: 140px;
    width: auto;
    height: auto;
    object-fit: contain;
  }
  .document-layout-logo-placeholder {
    width: 100px;
    height: 60px;
    border: 1px dashed #ccc;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #999;
  }
  .document-layout-entete--below-head {
    margin-bottom: 20px;
  }
  /* —— Moderne : société à gauche (plus grand), client encadré à droite, titre centré —— */
  .document-layout-head--moderne {
    align-items: flex-start;
    gap: 24px;
  }
  .document-layout-societe--moderne {
    flex: 0 1 40%;
    max-width: 40%;
  }
  .document-layout-societe--moderne .document-layout-societe-nom {
    font-size: 15px;
  }
  .document-layout-logo--moderne {
    max-height: 48px;
    max-width: 120px;
    margin-bottom: 8px;
  }
  .document-layout-client--moderne {
    flex: 0 1 35%;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: #fafafa;
  }
  .document-layout-entete--moderne {
    text-align: center;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e0e0e0;
  }
  .document-layout--moderne .document-layout-table th,
  .document-layout--moderne .document-layout-table td {
    border-width: 1px;
    border-color: #ccc;
  }
  .document-layout--moderne .document-layout-mentions {
    max-width: 100%;
    font-size: 8px;
  }
  /* —— Minimal : une ligne société | entete | client, épuré —— */
  .document-layout-head--minimal {
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 20px;
  }
  .document-layout-societe--minimal {
    flex: 0 1 30%;
    max-width: 30%;
  }
  .document-layout-societe--minimal .document-layout-societe-nom {
    font-size: 12px;
  }
  .document-layout-societe--minimal p {
    margin: 0 0 2px 0;
  }
  .document-layout-entete--minimal {
    flex: 0 1 40%;
    text-align: center;
  }
  .document-layout-entete--minimal .document-layout-doc-title {
    font-size: 14px;
    margin-bottom: 6px;
  }
  .document-layout-entete--minimal p {
    margin: 0 0 2px 0;
  }
  .document-layout-client--minimal {
    flex: 0 1 28%;
    max-width: 28%;
  }
  .document-layout-client--minimal p {
    margin: 0 0 2px 0;
  }
  .document-layout--minimal .document-layout-table th,
  .document-layout--minimal .document-layout-table td {
    border: none;
    border-bottom: 1px solid #e0e0e0;
    padding: 5px 6px;
  }
  .document-layout--minimal .document-layout-table th {
    background: transparent;
    font-weight: 600;
  }
  .document-layout--minimal .document-layout-mentions {
    max-width: 100%;
    font-size: 8px;
    color: #666;
  }
  .document-layout-societe {
    max-width: 45%;
  }
  .document-layout-societe-nom {
    margin: 0 0 8px 0 !important;
    font-size: 13px;
  }
  .document-layout-societe p {
    margin: 0 0 3px 0;
    line-height: 1.35;
  }
  .document-layout-doc-title {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 12px;
  }
  .document-layout-entete p {
    margin: 0 0 4px 0;
  }
  .document-layout-client {
    flex-shrink: 0;
  }
  .document-layout-client p {
    margin: 0 0 4px 0;
  }
  .document-layout-table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
  }
  .document-layout-table th,
  .document-layout-table td {
    border: 1px solid #333;
    padding: 6px 8px;
    text-align: left;
    color: #000;
  }
  .document-layout-table th {
    background: #e0e0e0;
    font-weight: 600;
  }
  .document-layout-table td:nth-child(2),
  .document-layout-table td:nth-child(3),
  .document-layout-table td:nth-child(4) {
    text-align: right;
  }
  .document-layout-totaux {
    margin-top: 16px;
    text-align: right;
  }
  .document-layout-totaux p {
    margin: 4px 0;
  }
  .document-layout-total-ttc {
    font-size: 14px;
    font-weight: 700;
  }
  /* Bloc mentions toujours en bas de la feuille (pousse vers le bas si contenu court) */
  .document-layout-mentions-wrap {
    margin-top: auto;
    padding-top: 24px;
    flex-shrink: 0;
  }
  .document-layout-mentions {
    font-size: 9px;
    color: #333;
    margin: 0;
    max-width: 85%;
  }
</style>
