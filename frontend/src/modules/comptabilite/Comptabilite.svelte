<script>
  import { writable, get } from 'svelte/store';
  import { getAllFactures as getAllFacturesEncrypted, getAllAchats as getAllAchatsEncrypted, verifyPassword } from '$lib/dbEncrypted.js';
  import { buildComptaSnapshot } from '$lib/comptabilite.js';
  import PasswordConfirmModal from '$lib/PasswordConfirmModal.svelte';

  let { user = null } = $props();

  class PeriodeFields {
    constructor() {
      const today = new Date();
      const year = today.getFullYear();
      const from = new Date(year, 0, 1).toISOString().slice(0, 10);
      const to = new Date(year, 11, 31).toISOString().slice(0, 10);
      this.fromStore = writable(from);
      this.toStore = writable(to);
    }

    _sanitizeDate(value) {
      let s = typeof value === 'string' ? value.trim() : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
      return s;
    }

    get from() { return get(this.fromStore); }
    set from(v) { this.fromStore.set(this._sanitizeDate(v)); }

    get to() { return get(this.toStore); }
    set to(v) { this.toStore.set(this._sanitizeDate(v)); }

    toRange() {
      const from = this.from ? new Date(this.from) : null;
      const to = this.to ? new Date(this.to) : null;
      return { from, to };
    }
  }

  const periodeFields = new PeriodeFields();

  let loading = $state(true);
  let error = $state('');
  let snapshot = $state(null);
  let passwordModalOpen = $state(false);
  let pendingAction = $state(null); // 'load' | 'refresh'

  async function ensureKeyAndRun(action) {
    pendingAction = action;
    passwordModalOpen = true;
  }

  async function onPasswordConfirm(pwd) {
    const uid = user?.id ?? null;
    const ok = await verifyPassword(pwd, uid);
    if (!ok) return false;
    passwordModalOpen = false;
    if (pendingAction === 'load' || pendingAction === 'refresh') {
      await loadSnapshot();
    }
    pendingAction = null;
    return true;
  }

  async function loadSnapshot() {
    if (!user) return;
    loading = true;
    error = '';
    try {
      const uid = user.id;
      const [factures, achats] = await Promise.all([
        getAllFacturesEncrypted(uid),
        getAllAchatsEncrypted(uid)
      ]);
      const range = periodeFields.toRange();
      snapshot = buildComptaSnapshot({ factures, achats }, range);
    } catch (e) {
      snapshot = null;
      error = e?.message || 'Erreur lors du calcul de la comptabilité.';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (user) {
      ensureKeyAndRun('load');
    }
  });

  function formatMontant(n) {
    const v = typeof n === 'number' ? n : 0;
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(v);
  }
</script>

<section class="compta-module" aria-label="Comptabilité">
  <h2 class="compta-title">Comptabilité</h2>
  <p class="compta-desc">
    Vue synthétique de vos revenus (factures) et dépenses (achats) sur une période donnée.
    Tous les calculs sont effectués localement dans votre navigateur.
  </p>

  {#if !user}
    <p class="compta-msg compta-msg-error">Session requise.</p>
  {:else}
    <div class="compta-layout">
      <div class="compta-filters">
        <div class="compta-field">
          <label for="compta-from">Du</label>
          <input
            id="compta-from"
            type="date"
            value={periodeFields.from}
            oninput={(e) => { periodeFields.from = e.currentTarget.value; ensureKeyAndRun('refresh'); }}
          />
        </div>
        <div class="compta-field">
          <label for="compta-to">Au</label>
          <input
            id="compta-to"
            type="date"
            value={periodeFields.to}
            oninput={(e) => { periodeFields.to = e.currentTarget.value; ensureKeyAndRun('refresh'); }}
          />
        </div>
      </div>

      {#if loading}
        <p class="compta-msg">Calcul en cours…</p>
      {:else if error}
        <p class="compta-msg compta-msg-error">{error}</p>
      {:else if !snapshot}
        <p class="compta-msg">Aucune donnée comptable pour la période sélectionnée.</p>
      {:else}
        <section class="compta-cards" aria-label="Chiffres clés">
          <div class="compta-card">
            <h3>Chiffre d’affaires TTC</h3>
            <p class="compta-card-main">{formatMontant(snapshot.caTTC)} €</p>
            <p class="compta-card-sub">CA HT : {formatMontant(snapshot.caHT)} €</p>
          </div>
          <div class="compta-card">
            <h3>Dépenses TTC</h3>
            <p class="compta-card-main">{formatMontant(snapshot.achatsTTC)} €</p>
            <p class="compta-card-sub">Achats HT : {formatMontant(snapshot.achatsHT)} €</p>
          </div>
          <div class="compta-card">
            <h3>Résultat brut</h3>
            <p class="compta-card-main">{formatMontant(snapshot.resultatNet)} €</p>
            <p class="compta-card-sub">CA HT – Achats HT</p>
          </div>
          <div class="compta-card">
            <h3>TVA</h3>
            <p class="compta-card-sub">Collectée : {formatMontant(snapshot.tvaCollectee)} €</p>
            <p class="compta-card-sub">Déductible : {formatMontant(snapshot.tvaDeductible)} €</p>
          </div>
        </section>

        <section class="compta-section" aria-label="Revenus et dépenses par mois">
          <h3 class="compta-section-title">Par mois</h3>
          {#if !snapshot.parMois.length}
            <p class="compta-msg">Aucun mouvement sur la période.</p>
          {:else}
            <table class="compta-table">
              <thead>
                <tr>
                  <th>Mois</th>
                  <th>CA TTC</th>
                  <th>Dépenses TTC</th>
                </tr>
              </thead>
              <tbody>
                {#each snapshot.parMois as row}
                  <tr>
                    <td>{row.yearMonth}</td>
                    <td>{formatMontant(row.caTTC)} €</td>
                    <td>{formatMontant(row.achatsTTC)} €</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </section>

        <section class="compta-section" aria-label="Dépenses par catégorie">
          <h3 class="compta-section-title">Dépenses par catégorie</h3>
          {#if !snapshot.parCategorieAchats.length}
            <p class="compta-msg">Aucune dépense catégorisée sur la période.</p>
          {:else}
            <table class="compta-table">
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>Total TTC</th>
                </tr>
              </thead>
              <tbody>
                {#each snapshot.parCategorieAchats as row}
                  <tr>
                    <td>{row.categorie}</td>
                    <td>{formatMontant(row.totalTTC)} €</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </section>
      {/if}
    </div>
  {/if}
</section>

<PasswordConfirmModal
  open={passwordModalOpen}
  title="Mot de passe requis"
  message="Entrez votre mot de passe pour voir vos données comptables."
  submitLabel="Confirmer"
  onConfirm={onPasswordConfirm}
  onCancel={() => { passwordModalOpen = false; pendingAction = null; }}
/>

<style>
  .compta-module {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .compta-title {
    margin: 0;
    font-size: 1.1rem;
    color: var(--color-primary);
  }
  .compta-desc {
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    color: var(--color-text-muted);
  }
  .compta-layout {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .compta-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: flex-end;
  }
  .compta-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .compta-field label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-text-soft);
  }
  .compta-field input[type="date"] {
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    font-size: 0.9rem;
    background: var(--color-bg-elevated);
    color: var(--color-text);
  }
  .compta-msg {
    margin: 0.25rem 0 0;
    font-size: 0.9rem;
    color: var(--color-text-muted);
  }
  .compta-msg-error {
    color: var(--color-error);
  }
  .compta-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.75rem;
  }
  .compta-card {
    padding: 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
  }
  .compta-card h3 {
    margin: 0 0 0.4rem;
    font-size: 0.9rem;
    color: var(--color-text-soft);
  }
  .compta-card-main {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-text);
  }
  .compta-card-sub {
    margin: 0.2rem 0 0;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
  .compta-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .compta-section-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-text-soft);
  }
  .compta-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  .compta-table th,
  .compta-table td {
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--color-border);
    text-align: left;
  }
</style>

