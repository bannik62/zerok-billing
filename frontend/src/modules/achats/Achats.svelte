<script>
  import { writable, get } from 'svelte/store';
  import {
    addAchat as addAchatEncrypted,
    getAllAchats as getAllAchatsEncrypted,
    updateAchat as updateAchatEncrypted,
    deleteAchat as deleteAchatEncrypted
  } from '$lib/dbEncrypted.js';
  import { scheduleBackupUpload } from '$lib/backupSync.js';
  import { defaultAchat, sanitizeAchat, computeMontants, isAchatValid } from '$lib/achats.js';
  import { hashAchat } from '$lib/crypto/index.js';
  import { getProofs, verifyProofs, sendAchatProof, deleteProof } from '$lib/proofs.js';
  import ProofsPanel from '$lib/ProofsPanel.svelte';
  import AchatOcrZone from './AchatOcrZone.svelte';

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
  const dateStore = fields.dateStore;
  const fournisseurStore = fields.fournisseurStore;
  const categorieStore = fields.categorieStore;
  const descriptionStore = fields.descriptionStore;
  const montantHTStore = fields.montantHTStore;
  const tvaStore = fields.tvaStore;
  const modePaiementStore = fields.modePaiementStore;
  const numeroFactureStore = fields.numeroFactureStore;
  let achats = $state([]);
  let loading = $state(true);
  let error = $state('');
  let saving = $state(false);
  let deletingId = $state(null);
  let editingId = $state(null);
  let ocrMessage = $state('');
  let ocrDetails = $state(null); // { confidence, date, fournisseur, montantHT, tva, numeroFacture }
  let backendProofs = $state([]);
  let proofsError = $state('');
  let verifiedMap = $state({});
  let proofsLoading = $state(false);

  function dedupeAchats(list) {
    const map = new Map();
    const withoutId = [];
    let idx = 0;
    for (const item of Array.isArray(list) ? list : []) {
      const key = String(item?.id ?? '').trim();
      if (!key) {
        withoutId.push({ ...item, __uiKey: `achat-noid-${idx++}` });
        continue;
      }
      map.set(key, { ...item, id: key, __uiKey: `achat-${key}` });
    }
    return [...map.values(), ...withoutId];
  }

  const achatById = $derived(Object.fromEntries((achats || []).map((a) => [a.id, a])));
  const proofItems = $derived.by(() => {
    const achatIds = new Set((achats || []).map((a) => a.id));
    // Dédoublonne par invoiceId pour éviter each_key_duplicate dans ProofsPanel.
    const byId = new Map();
    for (const p of backendProofs || []) {
      if (!achatIds.has(p.invoiceId)) continue;
      byId.set(p.invoiceId, p);
    }
    return [...byId.values()].map((p) => {
      const a = achatById[p.invoiceId];
      const numero = a?.numeroFacture || a?.id || p.invoiceId;
      return {
        id: p.invoiceId,
        hash: p.invoiceHash || '',
        label: `Achat ${numero}`,
        isOrphan: false,
        documentType: 'achat'
      };
    });
  });

  async function loadProofsAndVerify(achatsList) {
    proofsError = '';
    proofsLoading = true;
    try {
      let proofs = await getProofs();
      const proofIds = new Set((proofs || []).map((p) => String(p?.invoiceId ?? '').trim()));
      // Envoyer les preuves manquantes pour les achats existants (rattrapage)
      const toSend = (achatsList || []).filter(
        (a) => a?.id && !proofIds.has(String(a.id).trim())
      );
      if (toSend.length > 0) {
        await Promise.allSettled(toSend.map((a) => sendAchatProof(a).catch(() => {})));
        proofs = await getProofs();
      }
      backendProofs = proofs;
      const rawChecks = await Promise.all(
        (achatsList || []).map(async (a) => ({
          invoiceId: String(a?.id ?? '').trim(),
          invoiceHash: await hashAchat(a)
        }))
      );
      const checks = rawChecks.filter(
        (c) => c.invoiceId.length > 0 && typeof c.invoiceHash === 'string' && c.invoiceHash.length === 64
      );
      if (checks.length === 0) {
        verifiedMap = {};
        return;
      }
      const results = await verifyProofs(checks);
      verifiedMap = Object.fromEntries(results.map((r) => [String(r.invoiceId), !!r.verified]));
    } catch (e) {
      backendProofs = [];
      verifiedMap = {};
      const status = e?.response?.status;
      if (status === 401) proofsError = 'Non connecté';
      else if (status === 404) proofsError = 'Route /api/proofs introuvable';
      else proofsError = e?.message || 'Erreur chargement preuves achats';
    } finally {
      proofsLoading = false;
    }
  }

  async function loadAchats() {
    if (!user) return;
    loading = true;
    error = '';
    try {
      const uid = user.id;
      achats = dedupeAchats(await getAllAchatsEncrypted(uid));
      await loadProofsAndVerify(achats);
    } catch (e) {
      error = e?.message || 'Erreur lors du chargement des achats.';
      achats = [];
      backendProofs = [];
      verifiedMap = {};
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (user) loadAchats();
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
      let saved = null;
      if (editingId) {
        saved = await updateAchatEncrypted({ ...achat, id: editingId }, uid);
      } else {
        saved = await addAchatEncrypted(achat, uid);
      }
      if (saved) await sendAchatProof(saved).catch(() => {});
      fields.reset();
      editingId = null;
      achats = dedupeAchats(await getAllAchatsEncrypted(uid));
      await loadProofsAndVerify(achats);
      scheduleBackupUpload(uid);
    } catch (e) {
      error = e?.message || 'Erreur lors de l’enregistrement.';
    } finally {
      saving = false;
    }
  }

  async function saveAchat() {
    await reallySave();
  }

  function editAchat(achat) {
    if (!achat) return;
    editingId = achat.id;
    fields.dateStore.set(achat.date);
    fields.fournisseurStore.set(achat.fournisseur || '');
    fields.categorieStore.set(achat.categorie || '');
    fields.descriptionStore.set(achat.description || '');
    fields.montantHTStore.set(String(achat.montantHT ?? 0));
    fields.tvaStore.set(String(achat.tva ?? 20));
    fields.modePaiementStore.set(achat.modePaiement || '');
    fields.numeroFactureStore.set(achat.numeroFacture || '');
  }

  async function reallyDelete(id) {
    if (!user || !id) return;
    const uid = user.id;
    deletingId = id;
    error = '';
    try {
      await deleteAchatEncrypted(id, uid);
      await deleteProof(id).catch(() => {});
      achats = dedupeAchats(await getAllAchatsEncrypted(uid));
      await loadProofsAndVerify(achats);
      scheduleBackupUpload(uid);
    } catch (e) {
      error = e?.message || 'Erreur lors de la suppression.';
    } finally {
      deletingId = null;
    }
  }

  function handleDelete(achat) {
    const id = achat?.id ?? '';
    if (!id) {
      error = 'Impossible de supprimer : identifiant manquant.';
      return;
    }
    if (!confirm('Supprimer cet achat ?')) return;
    reallyDelete(id);
  }

  function applyOcrResult(result) {
    ocrMessage = '';
    ocrDetails = null;
    if (!result?.data) {
      ocrMessage = 'OCR terminé : aucun résultat exploitable.';
      return;
    }
    const d = result.data;
    const confidence = typeof result.confidence === 'number' ? result.confidence : 0;

    const hasDate = !!d.date;
    const hasFournisseur = !!d.fournisseur;
    const hasMontant = d.montantHT != null || d.montantTTC != null;
    const hasNumero = !!d.numeroFacture;
    let appliedMontantHT = null;

    if (d.date) fields.dateStore.set(d.date);
    if (d.fournisseur != null) fields.fournisseurStore.set(d.fournisseur);
    if (d.montantHT != null) {
      fields.montantHTStore.set(String(d.montantHT));
      appliedMontantHT = d.montantHT;
    }
    if (d.tva != null) fields.tvaStore.set(String(d.tva));
    if (d.montantTTC != null && d.montantHT == null) {
      const htFromTtc = d.montantTTC / (1 + (d.tva ?? 20) / 100);
      fields.montantHTStore.set(String(htFromTtc));
      appliedMontantHT = htFromTtc;
    }
    if (d.numeroFacture != null) fields.numeroFactureStore.set(d.numeroFacture);

    const hasAny = hasDate || hasFournisseur || hasMontant || hasNumero;
    if (!hasAny) {
      ocrMessage = `OCR terminé (${confidence} %) : aucun champ fiable détecté.`;
    } else if (confidence < 80) {
      ocrMessage = `OCR terminé (${confidence} %) : champs pré-remplis mais à vérifier.`;
    } else {
      ocrMessage = `OCR terminé (${confidence} %) : champs pré-remplis.`;
    }
    ocrDetails = {
      confidence,
      date: hasDate ? d.date : '',
      fournisseur: hasFournisseur ? d.fournisseur : '',
      montantHT: hasMontant ? appliedMontantHT : null,
      tva: d.tva ?? null,
      numeroFacture: hasNumero ? d.numeroFacture : ''
    };
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
      <AchatOcrZone
        onResult={applyOcrResult}
        onError={(msg) => { error = msg; ocrMessage = ''; ocrDetails = null; }}
      />
      {#if ocrMessage}
        <p
          class="achats-msg {ocrDetails && ocrDetails.confidence < 80 ? 'achats-msg-warning' : ''}"
          role="status"
        >
          {ocrMessage}
          {#if ocrDetails}
            <span class="achats-msg-small">
              [Date: {ocrDetails.date || '—'}
              · Fournisseur: {ocrDetails.fournisseur || '—'}
              · Montant HT: {ocrDetails.montantHT != null ? Number(ocrDetails.montantHT).toFixed(2) + ' €' : '—'}
              · TVA: {ocrDetails.tva != null ? ocrDetails.tva + ' %' : '—'}
              · N°: {ocrDetails.numeroFacture || '—'}]
            </span>
          {/if}
        </p>
      {/if}
      <form class="achats-form" onsubmit={(e) => { e.preventDefault(); saveAchat(); }}>
        <div class="achats-form-row">
          <div class="achats-field">
            <label for="achat-date">Date *</label>
            <input
              id="achat-date"
              type="date"
              bind:value={$dateStore}
            />
          </div>
          <div class="achats-field">
            <label for="achat-fournisseur">Fournisseur *</label>
            <input
              id="achat-fournisseur"
              type="text"
              bind:value={$fournisseurStore}
            />
          </div>
          <div class="achats-field">
            <label for="achat-categorie">Catégorie</label>
            <input
              id="achat-categorie"
              type="text"
              bind:value={$categorieStore}
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
              bind:value={$montantHTStore}
            />
          </div>
          <div class="achats-field">
            <label for="achat-tva">TVA (%)</label>
            <select
              id="achat-tva"
              bind:value={$tvaStore}
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
              bind:value={$modePaiementStore}
              placeholder="CB, virement, chèque…"
            />
          </div>
          <div class="achats-field">
            <label for="achat-numero">N° facture fournisseur</label>
            <input
              id="achat-numero"
              type="text"
              bind:value={$numeroFactureStore}
            />
          </div>
        </div>

        <div class="achats-field">
          <label for="achat-description">Description</label>
          <input
            id="achat-description"
            type="text"
            bind:value={$descriptionStore}
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
              {#each achats.slice().sort((a, b) => (a.date < b.date ? 1 : -1)) as achat, i (achat.__uiKey ?? `${String(achat?.id ?? '').trim() || 'achat'}-${i}`)}
                <tr>
                  <td>{achat.date}</td>
                  <td>{achat.fournisseur}</td>
                  <td>{achat.categorie}</td>
                  <td>{(achat.montantTTC ?? 0).toFixed(2)} €</td>
                  <td>{achat.modePaiement}</td>
                  <td class="achats-actions-cell">
                    <button type="button" class="achats-link" onclick={() => editAchat(achat)}>Modifier</button>
                    <button
                      type="button"
                      class="achats-link-danger"
                      disabled={deletingId === achat?.id}
                      onclick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(achat); }}
                    >
                      {deletingId === achat?.id ? '…' : 'Supprimer'}
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </section>
      <ProofsPanel
        title="Preuves (intégrité achats)"
        hint="Hash des achats enregistrés côté serveur. Comparaison avec le hash local."
        error={proofsError}
        items={proofItems}
        verifiedMap={verifiedMap}
        verifiedLoading={proofsLoading}
        ariaLabel="Preuves achats — comparaison hash local / backend"
      />
    </div>
  {/if}
</section>

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
    border: 2px solid var(--color-frame-docs);
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
  .achats-link-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .achats-msg {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
  .achats-msg-error {
    color: var(--color-error);
  }
  .achats-msg-warning {
    color: var(--color-warning, #b45309);
  }
  .achats-msg-small {
    margin-left: 0.5rem;
    font-size: 0.8rem;
    opacity: 0.85;
  }
</style>

