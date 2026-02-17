<script>
  import { getBlockLabel, formatMontant, buildBlockStyle } from './utils.js';

  let {
    type,
    pos,
    selected = false,
    document = null,
    documentType = 'devis',
    resolvedClient = null,
    resolvedSociete = null,
    onMouseDown = () => {},
    onResizeMouseDown = () => {}
  } = $props();

  const blockStyle = $derived(buildBlockStyle(pos));
  const isFacture = $derived(documentType === 'facture');
</script>

<div
  class="placed-block"
  class:selected
  role="button"
  tabindex="0"
  aria-label="Bloc {getBlockLabel(type)}, déplacer"
  style="left: {pos.left}%; top: {pos.top}%; width: {pos.w}%; height: {pos.h}%"
  onmousedown={(e) => onMouseDown(e, type)}
>
  <span class="placed-block-label">{getBlockLabel(type)}</span>
  <div
    class="placed-block-body"
    class:has-block-color={pos.color != null}
    class:has-block-font={pos.fontSize != null}
    class:has-block-bold={pos.fontWeight === 'bold'}
    style={blockStyle || undefined}
  >
    {#if type === 'logo'}
      <div class="placed-block-logo-frame">
        {#if resolvedSociete?.logo}
          <img src={resolvedSociete.logo} alt="Logo" class="placed-block-logo-img" />
        {:else}
          <span class="placed-block-logo-placeholder">Aucun logo</span>
        {/if}
      </div>
    {:else if type === 'societe' && resolvedSociete}
      <div class="placed-block-societe">
        <span class="placed-societe-name">{resolvedSociete.nom || '—'}</span>
        {#if resolvedSociete.formeJuridique}<span>{resolvedSociete.formeJuridique}</span>{/if}
        {#if resolvedSociete.siret}<span>SIRET : {resolvedSociete.siret}</span>{/if}
        {#if resolvedSociete.rcs}<span>RCS : {resolvedSociete.rcs}</span>{/if}
        {#if resolvedSociete.capital}<span>Capital : {resolvedSociete.capital}</span>{/if}
        {#if resolvedSociete.siegeSocial}<span>{resolvedSociete.siegeSocial}</span>{/if}
        {#if resolvedSociete.tvaIntra}<span>TVA : {resolvedSociete.tvaIntra}</span>{/if}
      </div>
    {:else if type === 'entete' && document?.entete}
      <div class="placed-block-entete">
        {#if resolvedClient}
          <span class="placed-client-name">{resolvedClient.raisonSociale || [resolvedClient.prenom, resolvedClient.nom].filter(Boolean).join(' ') || '—'}</span>
          {#if resolvedClient.adresse || resolvedClient.codePostal || resolvedClient.ville}
            <span class="placed-client-adresse">
              {[resolvedClient.adresse, [resolvedClient.codePostal, resolvedClient.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
            </span>
          {/if}
          {#if resolvedClient.siret}<span class="placed-client-siret">SIRET : {resolvedClient.siret}</span>{/if}
        {:else if document.entete.clientId}
          <span>Client (chargement…)</span>
        {/if}
        <span>{isFacture ? 'Facture' : 'Devis'} N° {document.entete.numero || '—'}</span>
        {#if document.entete.dateEmission}<span>Émission : {document.entete.dateEmission}</span>{/if}
        {#if isFacture && document.entete.delaiPaiement}<span>Délai de paiement : {document.entete.delaiPaiement}</span>
        {:else if !isFacture && document.entete.dateValidite}<span>Valide jusqu'au : {document.entete.dateValidite}</span>{/if}
        {#if document.entete.devise}<span>{document.entete.devise}</span>{/if}
      </div>
    {:else if type === 'lignes' && document?.lignes?.length}
      <div class="placed-block-lignes">
        <table class="placed-lignes-table">
          <thead>
            <tr><th>Désignation</th><th>Qté</th><th>PU</th><th>Montant</th></tr>
          </thead>
          <tbody>
            {#each document.lignes as l}
              {@const montant = (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0)}
              <tr>
                <td>{l.designation || '—'}</td>
                <td>{l.quantite}</td>
                <td>{formatMontant(l.prixUnitaire)}</td>
                <td>{formatMontant(montant)} €</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else if type === 'sousTotal'}
      <span class="placed-block-content">Sous-total : {formatMontant(document?.sousTotal ?? 0)} €</span>
    {:else if type === 'reduction' && document?.reduction}
      <span class="placed-block-content">Remise : {document.reduction.type === 'percent' ? document.reduction.value + ' %' : document.reduction.value + ' €'}</span>
    {:else if type === 'total'}
      {@const taux = Number(document?.entete?.tvaTaux) || 0}
      {@const mtva = document?.tvaMontant ?? (document?.total ?? 0) * (taux / 100)}
      {@const ttc = document?.totalTTC ?? (document?.total ?? 0) + mtva}
      <div class="placed-block-totaux">
        <span class="placed-block-content">Total HT : {formatMontant(document?.total ?? 0)} €</span>
        {#if taux > 0}
          <span class="placed-block-content">TVA ({taux} %) : {formatMontant(mtva)} €</span>
          <span class="placed-block-content placed-block-total-ttc">Total TTC : {formatMontant(ttc)} €</span>
        {/if}
      </div>
    {/if}
  </div>
  <div
    class="resize-handle"
    role="button"
    aria-label="Redimensionner"
    tabindex="0"
    onmousedown={(e) => onResizeMouseDown(e, type)}
  ></div>
</div>

<style>
  .placed-block {
    position: absolute;
    min-width: 60px;
    min-height: 40px;
    padding: 0.35rem 0.5rem;
    background: #f0fdfa;
    border: 1px solid #0f766e;
    border-radius: 6px;
    cursor: move;
    font-size: 0.75rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .placed-block-body {
    flex: 1;
    overflow: auto;
    min-height: 0;
  }
  .placed-block-body.has-block-color,
  .placed-block-body.has-block-color * {
    color: inherit;
  }
  .placed-block-body.has-block-font * {
    font-size: inherit;
  }
  .placed-block-body.has-block-bold * {
    font-weight: inherit;
  }
  .placed-block-label {
    display: block;
    font-weight: 600;
    color: #0f766e;
    margin-bottom: 0.25rem;
    flex-shrink: 0;
  }
  .placed-block-content {
    display: block;
    font-size: 0.8rem;
    color: #475569;
  }
  .placed-block-totaux {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .placed-block-total-ttc {
    font-weight: 700;
  }
  .placed-block-entete {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.7rem;
    color: #475569;
  }
  .placed-client-name {
    font-weight: 700;
    color: #0f172a;
    font-size: 0.75rem;
  }
  .placed-client-adresse,
  .placed-client-siret {
    font-size: 0.65rem;
    color: #64748b;
  }
  .placed-block-societe {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.65rem;
    color: #475569;
  }
  .placed-block-logo-frame {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-height: 2.5rem;
    padding: 0.25rem;
    box-sizing: border-box;
  }
  .placed-block-logo-img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .placed-block-logo-placeholder {
    font-size: 0.7rem;
    color: #94a3b8;
  }
  .placed-societe-name {
    font-weight: 700;
    color: #0f172a;
    font-size: 0.75rem;
  }
  .placed-block-lignes {
    overflow: auto;
    font-size: 0.65rem;
  }
  .placed-lignes-table {
    width: 100%;
    border-collapse: collapse;
  }
  .placed-lignes-table th,
  .placed-lignes-table td {
    padding: 0.15rem 0.25rem;
    border: 1px solid #e2e8f0;
    text-align: left;
  }
  .placed-lignes-table th {
    background: #ccfbf1;
    font-weight: 600;
    color: #0f766e;
  }
  .resize-handle {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 14px;
    height: 14px;
    background: linear-gradient(135deg, transparent 50%, #0f766e 50%);
    cursor: se-resize;
    flex-shrink: 0;
  }
  .resize-handle:hover {
    background: linear-gradient(135deg, transparent 50%, #0d9488 50%);
  }
  .placed-block.selected {
    outline: 2px solid #0f766e;
    outline-offset: 2px;
  }

  @media print {
    .placed-block { border: none !important; box-shadow: none !important; background: #fff !important; }
    .placed-block-label { display: none !important; }
    .placed-lignes-table th,
    .placed-lignes-table td { border: none !important; }
    .placed-lignes-table th { background: #f8fafc !important; }
    .resize-handle { display: none !important; }
  }
</style>
