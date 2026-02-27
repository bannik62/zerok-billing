<script>
  import { writable, get } from 'svelte/store';
  import {
    addAchat as addAchatEncrypted,
    getAllAchats as getAllAchatsEncrypted,
    updateAchat as updateAchatEncrypted,
    deleteAchat as deleteAchatEncrypted,
    verifyPassword
  } from '$lib/dbEncrypted.js';
  import { defaultAchat, sanitizeAchat, computeMontants, isAchatValid } from '$lib/achats.js';
  import PasswordConfirmModal from '$lib/PasswordConfirmModal.svelte';

  let { user = null } = $props();

  class AchatFields {
    constructor() {
      this.dateStore = writable(defaultAchat().date);
      this.fournisseurStore = writable('');
      this.categorieStore = writable('');
      this.descriptionStore = writable('');
      this.montantHTStore = writable('0');
      this.tvaStore = writable('20');
      this.modePaiementStore = writable('');
      this.numeroFactureStore = writable('');
    }

    _sanitizeText(value, maxLength = 255) {
      let s = typeof value === 'string' ? value : '';
      s = s.replace(/[\u0000-\u001f\u007f]/g, '').trim();
      if (s.length > maxLength) s = s.slice(0, maxLength);
      return s;
    }

    _sanitizeNumber(value, min = 0) {
      const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
      if (!Number.isFinite(n) || Number.isNaN(n)) return min;
      return n < min ? min : n;
    }

    get date() { return get(this.dateStore); }
    set date(v) {
      let s = this._sanitizeText(v, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) s = defaultAchat().date;
      this.dateStore.set(s);
    }

    get fournisseur() { return get(this.fournisseurStore); }
    set fournisseur(v) { this.fournisseurStore.set(this._sanitizeText(v)); }

    get categorie() { return get(this.categorieStore); }
    set categorie(v) { this.categorieStore.set(this._sanitizeText(v, 100)); }

    get description() { return get(this.descriptionStore); }
    set description(v) { this.descriptionStore.set(this._sanitizeText(v)); }

    get montantHT() { return this._sanitizeNumber(get(this.montantHTStore), 0); }
    set montantHT(v) { this.montantHTStore.set(String(this._sanitizeNumber(v, 0))); }

    get tva() {
      // Ramène toujours à l'un des taux standards 0 / 5.5 / 10 / 20 pour rester cohérent avec devis/factures.
      const allowed = [0, 5.5, 10, 20];
      const raw = this._sanitizeNumber(get(this.tvaStore), 0);
      // Si la valeur n'est pas dans la liste, on laisse 0.
      return allowed.includes(raw) ? raw : 0;
    }
    set tva(v) {
      const allowed = [0, 5.5, 10, 20];
      const n = this._sanitizeNumber(v, 0);
      const value = allowed.includes(n) ? n : 0;
      this.tvaStore.set(String(value));
    }

    get modePaiement() { return get(this.modePaiementStore); }
    set modePaiement(v) { this.modePaiementStore.set(this._sanitizeText(v, 50)); }

    get numeroFacture() { return get(this.numeroFactureStore); }
    set numeroFacture(v) { this.numeroFactureStore.set(this._sanitizeText(v, 100)); }

    reset() {
      const base = defaultAchat();
      this.dateStore.set(base.date);
      this.fournisseurStore.set('');
      this.categorieStore.set('');
      this.descriptionStore.set('');
      this.montantHTStore.set('0');
      this.tvaStore.set('20');
      this.modePaiementStore.set('');
      this.numeroFactureStore.set('');
    }

    toAchat() {
      const partial = {
        date: this.date,
        fournisseur: this.fournisseur,
        categorie: this.categorie,
        description: this.description,
        montantHT: this.montantHT,
        tva: this.tva,
        modePaiement: this.modePaiement,
        numeroFacture: this.numeroFacture
      };
      let achat = sanitizeAchat(partial);
      achat = computeMontants(achat);
      return achat;
    }
  }

  const fields = new AchatFields();
  let achats = $state([]);
  let loading = $state(true);
  let error = $state('');
  let saving = $state(false);
  let editingId = $state(null);
  let passwordModalOpen = $state(false);
  let pendingAction = $state(null); // 'load' | 'save' | 'delete'
  let pendingId = $state(null);

  async function ensureKeyAndRun(action, id = null) {
    pendingAction = action;
    pendingId = id;
    passwordModalOpen = true;
  }

  async function onPasswordConfirm(pwd) {
    const uid = user?.id ?? null;
    const ok = await verifyPassword(pwd, uid);
    if (!ok) return false;
    passwordModalOpen = false;
    if (pendingAction === 'load') {
      await loadAchats();
    } else if (pendingAction === 'save') {
      await reallySave();
    } else if (pendingAction === 'delete' && pendingId) {
      await reallyDelete(pendingId);
    }
    pendingAction = null;
    pendingId = null;
    return true;
  }

  async function loadAchats() {
    if (!user) return;
    loading = true;
    error = '';
    try {
      const uid = user.id;
      achats = await getAllAchatsEncrypted(uid);
    } catch (e) {
      error = e?.message || 'Erreur lors du chargement des achats.';
      achats = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (user) {
      ensureKeyAndRun('load');
    }
  });

  async function reallySave() {
    if (!user) return;
    const uid = user.id;
    const achat = fields.toAchat();
    if (!isAchatValid(achat)) {
      error = 'Vérifiez les champs obligatoires (date, fournisseur, montants).';
      return;
    }
    saving = true;
    error = '';
    try {
      if (editingId) {
        await updateAchatEncrypted({ ...achat, id: editingId }, uid);
      } else {
        await addAchatEncrypted(achat, uid);
      }
      fields.reset();
      editingId = null;
      achats = await getAllAchatsEncrypted(uid);
    } catch (e) {
      error = e?.message || 'Erreur lors de l’enregistrement.';
    } finally {
      saving = false;
    }
  }

  async function saveAchat() {
    await ensureKeyAndRun('save');
  }

  function editAchat(achat) {
    if (!achat) return;
    editingId = achat.id;
    fields.date = achat.date;
    fields.fournisseur = achat.fournisseur || '';
    fields.categorie = achat.categorie || '';
    fields.description = achat.description || '';
    fields.montantHT = achat.montantHT ?? 0;
    fields.tva = achat.tva ?? 20;
    fields.modePaiement = achat.modePaiement || '';
    fields.numeroFacture = achat.numeroFacture || '';
  }

  async function reallyDelete(id) {
    if (!user) return;
    const uid = user.id;
    try {
      await deleteAchatEncrypted(id, uid);
      achats = await getAllAchatsEncrypted(uid);
    } catch (e) {
      error = e?.message || 'Erreur lors de la suppression.';
    }
  }

  async function deleteAchat(id) {
    if (!id) return;
    if (!confirm('Supprimer cet achat ?')) return;
    await ensureKeyAndRun('delete', id);
  }
</script>

<section class="achats-module" aria-label="Achats / factures fournisseurs">
  <h2 class="achats-title">Achats</h2>
  <p class="achats-desc">
    Saisissez vos achats et factures fournisseurs. Les données sont chiffrées avec la même clé que vos devis et factures.
  </p>

  {#if !user}
    <p class="achats-msg achats-msg-error">Session requise.</p>
  {:else}
    <div class="achats-layout">
      <form class="achats-form" onsubmit={(e) => { e.preventDefault(); saveAchat(); }}>
        <div class="achats-form-row">
          <div class="achats-field">
            <label for="achat-date">Date *</label>
            <input
              id="achat-date"
              type="date"
              value={fields.date}
              oninput={(e) => (fields.date = e.currentTarget.value)}
            />
          </div>
          <div class="achats-field">
            <label for="achat-fournisseur">Fournisseur *</label>
            <input
              id="achat-fournisseur"
              type="text"
              value={fields.fournisseur}
              oninput={(e) => (fields.fournisseur = e.currentTarget.value)}
            />
          </div>
          <div class="achats-field">
            <label for="achat-categorie">Catégorie</label>
            <input
              id="achat-categorie"
              type="text"
              value={fields.categorie}
              oninput={(e) => (fields.categorie = e.currentTarget.value)}
              placeholder="repas, transport, logiciel…"
            />
          </div>
        </div>

        <div class="achats-form-row">
          <div class="achats-field">
            <label for="achat-ht">Montant HT</label>
            <input
              id="achat-ht"
              type="number"
              step="0.01"
              min="0"
              value={fields.montantHT}
              oninput={(e) => (fields.montantHT = e.currentTarget.value)}
            />
          </div>
          <div class="achats-field">
            <label for="achat-tva">TVA (%)</label>
            <select
              id="achat-tva"
              value={fields.tva}
              onchange={(e) => (fields.tva = e.currentTarget.value)}
            >
              <option value="0">0 % (TVA non applicable ou exonéré)</option>
              <option value="5.5">5,5 % (taux réduit)</option>
              <option value="10">10 % (taux intermédiaire)</option>
              <option value="20">20 % (taux normal)</option>
            </select>
          </div>
        </div>

        <div class="achats-form-row">
          <div class="achats-field">
            <label for="achat-mode">Mode de paiement</label>
            <input
              id="achat-mode"
              type="text"
              value={fields.modePaiement}
              oninput={(e) => (fields.modePaiement = e.currentTarget.value)}
              placeholder="CB, virement, chèque…"
            />
          </div>
          <div class="achats-field">
            <label for="achat-numero">N° facture fournisseur</label>
            <input
              id="achat-numero"
              type="text"
              value={fields.numeroFacture}
              oninput={(e) => (fields.numeroFacture = e.currentTarget.value)}
            />
          </div>
        </div>

        <div class="achats-field">
          <label for="achat-description">Description</label>
          <input
            id="achat-description"
            type="text"
            value={fields.description}
            oninput={(e) => (fields.description = e.currentTarget.value)}
            placeholder="Détails de l’achat"
          />
        </div>

        <div class="achats-actions">
          <button type="submit" class="achats-btn" disabled={saving}>
            {saving ? 'Enregistrement…' : (editingId ? 'Mettre à jour' : 'Ajouter')}
          </button>
          {#if editingId}
            <button
              type="button"
              class="achats-btn-secondary"
              onclick={() => { editingId = null; fields.reset(); }}
            >
              Annuler la modification
            </button>
          {/if}
        </div>

        {#if error}
          <p class="achats-msg achats-msg-error">{error}</p>
        {/if}
      </form>

      <section class="achats-list" aria-label="Liste des achats">
        <h3 class="achats-list-title">Historique des achats ({achats.length})</h3>
        {#if loading}
          <p class="achats-msg">Chargement…</p>
        {:else if !achats.length}
          <p class="achats-msg">Aucun achat saisi pour l’instant.</p>
        {:else}
          <table class="achats-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Fournisseur</th>
                <th>Catégorie</th>
                <th>Montant TTC</th>
                <th>Mode paiement</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each achats.slice().sort((a, b) => (a.date < b.date ? 1 : -1)) as achat (achat.id)}
                <tr>
                  <td>{achat.date}</td>
                  <td>{achat.fournisseur}</td>
                  <td>{achat.categorie}</td>
                  <td>{(achat.montantTTC ?? 0).toFixed(2)} €</td>
                  <td>{achat.modePaiement}</td>
                  <td class="achats-actions-cell">
                    <button type="button" class="achats-link" onclick={() => editAchat(achat)}>Modifier</button>
                    <button type="button" class="achats-link-danger" onclick={() => deleteAchat(achat.id)}>Supprimer</button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </section>
    </div>
  {/if}
</section>

<PasswordConfirmModal
  open={passwordModalOpen}
  title="Mot de passe requis"
  message="Entrez votre mot de passe pour continuer."
  submitLabel="Confirmer"
  onConfirm={onPasswordConfirm}
  onCancel={() => { passwordModalOpen = false; pendingAction = null; pendingId = null; }}
/>

<style>
  .achats-module {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .achats-title {
    margin: 0;
    font-size: 1.1rem;
    color: var(--color-primary);
  }
  .achats-desc {
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    color: var(--color-text-muted);
  }
  .achats-layout {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .achats-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 8px;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
  }
  .achats-form-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .achats-field {
    flex: 1 1 0;
    min-width: 160px;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .achats-field label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-text-soft);
  }
  .achats-field input {
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    font-size: 0.9rem;
    background: var(--color-bg-muted);
    color: var(--color-text);
  }
  .achats-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .achats-btn {
    padding: 0.45rem 0.9rem;
    border-radius: 6px;
    border: 1px solid var(--color-primary);
    background: var(--color-primary);
    color: #fff;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .achats-btn[disabled] {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .achats-btn-secondary {
    padding: 0.45rem 0.9rem;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-muted);
    color: var(--color-text);
    font-size: 0.9rem;
    cursor: pointer;
  }
  .achats-list-title {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-soft);
  }
  .achats-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  .achats-table th,
  .achats-table td {
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid var(--color-border);
    text-align: left;
  }
  .achats-actions-cell {
    white-space: nowrap;
  }
  .achats-link,
  .achats-link-danger {
    background: none;
    border: none;
    padding: 0;
    margin-right: 0.5rem;
    color: var(--color-primary);
    cursor: pointer;
    font-size: 0.85rem;
    text-decoration: underline;
  }
  .achats-link-danger {
    color: var(--color-error);
  }
  .achats-msg {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
  .achats-msg-error {
    color: var(--color-error);
  }
</style>

