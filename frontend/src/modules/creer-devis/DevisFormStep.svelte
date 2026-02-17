<script>
  import { onMount } from 'svelte';
  import { formatMontant } from './utils.js';
  import { createTextField } from '$lib/formField.js';

  let {
    entete = $bindable(),
    lignes = $bindable(),
    reduction = $bindable(),
    clients = [],
    saving = false,
    onValider = () => {}
  } = $props();

  const dateEmissionField = createTextField({ maxLength: 10 });
  const dateValiditeField = createTextField({ maxLength: 10 });
  const deviseField = createTextField({ maxLength: 10 });
  const objetField = createTextField({ maxLength: 500 });

  const dateEmissionStore = dateEmissionField.store;
  const dateValiditeStore = dateValiditeField.store;
  const deviseStore = deviseField.store;
  const objetStore = objetField.store;

  onMount(() => {
    dateEmissionField.value = entete.dateEmission ?? '';
    dateValiditeField.value = entete.dateValidite ?? '';
    deviseField.value = entete.devise ?? '';
    objetField.value = entete.objet ?? '';
  });

  const selectedClientEntete = $derived(clients.find((c) => c.id === entete.clientId));

  const sousTotal = $derived(
    lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0), 0)
  );
  const reductionMontant = $derived(
    reduction.type === 'percent'
      ? (sousTotal * (Number(reduction.value) || 0)) / 100
      : Number(reduction.value) || 0
  );
  const total = $derived(Math.max(0, sousTotal - reductionMontant));
  const totalHT = $derived(total);
  const tvaMontant = $derived(totalHT * ((Number(entete.tvaTaux) || 0) / 100));
  const totalTTC = $derived(totalHT + tvaMontant);

  function addLigne() {
    lignes = [...lignes, { id: crypto.randomUUID(), designation: '', quantite: 1, unite: 'u', prixUnitaire: 0 }];
  }

  function removeLigne(id) {
    if (lignes.length <= 1) return;
    lignes = lignes.filter((l) => l.id !== id);
  }
</script>

<div class="devis-module">
  <h2 class="devis-title">Créer devis – Saisie</h2>

  <section class="devis-section">
    <h3 class="section-label">Entête</h3>
    <div class="form-grid">
      <div class="form-row">
        <label for="devis-client">Client</label>
        <select id="devis-client" bind:value={entete.clientId}>
          <option value="">— Choisir —</option>
          {#each clients as c (c.id)}
            <option value={c.id}>{c.raisonSociale || [c.prenom, c.nom].filter(Boolean).join(' ') || c.email}</option>
          {/each}
        </select>
        {#if selectedClientEntete}
          <div class="entete-client-info">
            <span class="entete-client-rs">Raison sociale : {selectedClientEntete.raisonSociale || [selectedClientEntete.prenom, selectedClientEntete.nom].filter(Boolean).join(' ') || '—'}</span>
            {#if selectedClientEntete.adresse || selectedClientEntete.codePostal || selectedClientEntete.ville}
              <span class="entete-client-adresse">Adresse : {[selectedClientEntete.adresse, [selectedClientEntete.codePostal, selectedClientEntete.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>
            {/if}
            {#if selectedClientEntete.siret}<span class="entete-client-siret">SIRET : {selectedClientEntete.siret}</span>{/if}
          </div>
        {/if}
      </div>
      <div class="form-row">
        <label for="devis-numero">N° devis</label>
        <input id="devis-numero" type="text" value={entete.numero} readonly class="input-readonly" aria-readonly="true" />
      </div>
      <div class="form-row">
        <label for="devis-date">Date d'émission</label>
        <input id="devis-date" type="date" value={$dateEmissionStore} oninput={(e) => { dateEmissionField.value = e.target.value; entete = { ...entete, dateEmission: dateEmissionField.value }; }} />
      </div>
      <div class="form-row">
        <label for="devis-validite">Valide jusqu'au</label>
        <input id="devis-validite" type="date" value={$dateValiditeStore} oninput={(e) => { dateValiditeField.value = e.target.value; entete = { ...entete, dateValidite: dateValiditeField.value }; }} />
      </div>
      <div class="form-row">
        <label for="devis-devise">Devise</label>
        <input id="devis-devise" type="text" value={$deviseStore} oninput={(e) => { deviseField.value = e.target.value; entete = { ...entete, devise: deviseField.value }; }} />
      </div>
      <div class="form-row">
        <label for="devis-objet">Objet</label>
        <input id="devis-objet" type="text" value={$objetStore} oninput={(e) => { objetField.value = e.target.value; entete = { ...entete, objet: objetField.value }; }} placeholder="Objet du devis" />
      </div>
      <div class="form-row">
        <label for="devis-tva">Taux TVA (%)</label>
        <select id="devis-tva" value={entete.tvaTaux} onchange={(e) => entete = { ...entete, tvaTaux: Number(e.currentTarget.value) }}>
          <option value={0}>0 — Non assujetti (auto-entrepreneur sous seuil, exonéré)</option>
          <option value={2.1}>2,1 % (presse, médicaments remboursables, redevance TV)</option>
          <option value={5.5}>5,5 % (alimentation, énergie, livres, spectacles)</option>
          <option value={10}>10 % (restauration, transports, travaux, hébergement)</option>
          <option value={20}>20 % (taux normal — conseil, commerce, plupart des services)</option>
        </select>
      </div>
    </div>
  </section>

  <section class="devis-section">
    <h3 class="section-label">Lignes</h3>
    <div class="table-wrap">
      <table class="lignes-table">
        <thead>
          <tr>
            <th>Désignation</th>
            <th>Qté</th>
            <th>Unite</th>
            <th>Prix unit.</th>
            <th>Montant</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each lignes as ligne, i (ligne.id)}
            {@const montant = (Number(ligne.quantite) || 0) * (Number(ligne.prixUnitaire) || 0)}
            <tr>
              <td><input type="text" maxlength="500" value={ligne.designation} oninput={(e) => { const v = e.target.value.trim().slice(0, 500); lignes = lignes.map((l, j) => j === i ? { ...l, designation: v } : l); }} placeholder="Désignation" /></td>
              <td><input type="number" min="0" step="1" bind:value={ligne.quantite} class="input-num" /></td>
              <td><input type="text" maxlength="10" value={ligne.unite} oninput={(e) => { const v = e.target.value.trim().slice(0, 10); lignes = lignes.map((l, j) => j === i ? { ...l, unite: v } : l); }} class="input-unite" /></td>
              <td><input type="number" min="0" step="0.01" bind:value={ligne.prixUnitaire} class="input-num" /></td>
              <td class="montant">{formatMontant(montant)} €</td>
              <td><button type="button" class="btn-remove" onclick={() => removeLigne(ligne.id)} title="Supprimer">×</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <button type="button" class="btn-add-line" onclick={addLigne}>+ Ligne</button>
  </section>

  <section class="devis-section devis-totaux">
    <div class="totaux-row">
      <span>Sous-total HT</span>
      <strong>{formatMontant(sousTotal)} €</strong>
    </div>
    <div class="form-row-inline">
      <label for="devis-reduction-type">Réduction</label>
      <select id="devis-reduction-type" bind:value={reduction.type}>
        <option value="percent">%</option>
        <option value="fixed">Montant fixe</option>
      </select>
      <input id="devis-reduction-value" type="number" min="0" step={reduction.type === 'percent' ? 1 : 0.01} bind:value={reduction.value} class="input-num" aria-label="Valeur réduction" />
    </div>
    <div class="totaux-row">
      <span>Total HT</span>
      <strong>{formatMontant(totalHT)} €</strong>
    </div>
    {#if (Number(entete.tvaTaux) || 0) > 0}
      <div class="totaux-row">
        <span>TVA ({entete.tvaTaux} %)</span>
        <strong>{formatMontant(tvaMontant)} €</strong>
      </div>
      <div class="totaux-row total-row">
        <span>Total TTC</span>
        <strong>{formatMontant(totalTTC)} €</strong>
      </div>
    {:else}
      <div class="totaux-row total-row">
        <span>Total</span>
        <strong>{formatMontant(total)} €</strong>
      </div>
    {/if}
  </section>

  <div class="step-actions">
    <button type="button" class="btn-submit" disabled={saving} onclick={onValider}>
      {saving ? 'Enregistrement…' : "Valider – Passer à l'éditeur"}
    </button>
  </div>
</div>

<style>
  .devis-module {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-height: 0;
  }
  .devis-title {
    margin: 0;
    font-size: 1.25rem;
    color: #0f766e;
    font-weight: 700;
  }
  .devis-section {
    padding: 0.75rem 0;
    border-bottom: 1px solid #e2e8f0;
  }
  .section-label {
    margin: 0 0 0.75rem 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #475569;
  }
  .form-grid {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }
  .form-row label,
  .form-row-inline label {
    display: block;
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 0.25rem;
  }
  .form-row input,
  .form-row select {
    width: 100%;
    padding: 0.4rem 0.6rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.9rem;
    box-sizing: border-box;
  }
  .input-readonly {
    background: #f1f5f9;
    color: #475569;
    cursor: default;
  }
  .entete-client-info {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: #f0fdfa;
    border-radius: 6px;
    border: 1px solid #99f6e4;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.85rem;
    color: #0f766e;
  }
  .entete-client-rs { font-weight: 600; }
  .entete-client-adresse,
  .entete-client-siret { font-size: 0.8rem; color: #475569; }
  .form-row-inline {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.5rem 0;
  }
  .form-row-inline .input-num {
    width: 6rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
  }
  .table-wrap { overflow: auto; }
  .lignes-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  .lignes-table th,
  .lignes-table td {
    padding: 0.35rem 0.5rem;
    border: 1px solid #e2e8f0;
    text-align: left;
  }
  .lignes-table th {
    background: #f8fafc;
    font-weight: 600;
    color: #475569;
  }
  .lignes-table input {
    width: 100%;
    padding: 0.3rem 0.4rem;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    box-sizing: border-box;
  }
  .input-num { width: 5rem; }
  .input-unite { width: 3rem; }
  .montant { white-space: nowrap; }
  .btn-remove {
    padding: 0.2rem 0.5rem;
    border: none;
    background: #fef2f2;
    color: #b91c1c;
    cursor: pointer;
    border-radius: 4px;
  }
  .btn-add-line {
    margin-top: 0.5rem;
    padding: 0.4rem 0.75rem;
    border: 1px dashed #cbd5e1;
    background: #f8fafc;
    color: #64748b;
    font-size: 0.9rem;
    cursor: pointer;
    border-radius: 6px;
  }
  .totaux-row {
    display: flex;
    justify-content: space-between;
    padding: 0.35rem 0;
  }
  .total-row {
    font-size: 1.1rem;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #e2e8f0;
  }
  .step-actions { margin-top: 0.5rem; }
  .btn-submit {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: none;
    background: #0f766e;
    color: white;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-submit:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
</style>
