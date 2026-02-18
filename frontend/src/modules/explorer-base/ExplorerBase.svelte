<script>
  import { openDB } from '$lib/db.js';
  import { getAllDevis, getAllFactures, hasEncryptionKey } from '$lib/dbEncrypted.js';
  import { hashDocument } from '$lib/crypto/index.js';
  import { apiClient } from '$lib/apiClient.js';

  let { user = null } = $props();
  const uid = $derived(user?.id ?? null);

  let storeNames = $state([]);
  let selectedStore = $state(null);
  let rows = $state([]);
  let decryptedDevis = $state([]);
  let decryptedFactures = $state([]);
  let keyLoaded = $state(false);
  let loading = $state(true);
  let error = $state('');
  /** Preuves backend : { invoiceId, invoiceHash, signedAt }[] */
  let backendProofs = $state([]);
  let proofsError = $state('');
  /** Pour chaque invoiceId : 'ok' | 'diff' | null (non vérifié) */
  let integrityStatus = $state({});

  async function loadStores() {
    loading = true;
    error = '';
    try {
      const db = await openDB();
      storeNames = db.tables.map((t) => t.name);
      keyLoaded = hasEncryptionKey();
      if (keyLoaded) {
        try {
          decryptedDevis = await getAllDevis(uid);
          decryptedFactures = await getAllFactures(uid);
        } catch {
          decryptedDevis = [];
          decryptedFactures = [];
        }
      }
    } catch (e) {
      error = e?.message || 'Erreur chargement';
    } finally {
      loading = false;
      await loadProofs();
    }
  }

  async function loadProofs() {
    proofsError = '';
    try {
      const res = await apiClient.get('/api/proofs');
      backendProofs = res.data?.proofs ?? [];
      if (backendProofs.length > 0) await computeIntegrity();
    } catch (e) {
      backendProofs = [];
      const status = e.response?.status;
      if (status === 401) proofsError = 'Non connecté';
      else if (status === 404) proofsError = 'Route introuvable (404). Redémarrez le backend pour charger GET /api/proofs.';
      else proofsError = e?.message || 'Erreur chargement preuves';
    }
  }

  async function computeIntegrity() {
    const status = {};
    const devisById = Object.fromEntries((decryptedDevis || []).map((d) => [d.id, d]));
    const facturesById = Object.fromEntries((decryptedFactures || []).map((f) => [f.id, f]));
    for (const p of backendProofs) {
      const id = p.invoiceId;
      const doc = devisById[id] ?? facturesById[id];
      if (!doc) {
        status[id] = null;
        continue;
      }
      const type = devisById[id] ? 'devis' : 'facture';
      try {
        const localHash = await hashDocument(doc, type);
        status[id] = (localHash || '').toLowerCase() === (p.invoiceHash || '').toLowerCase() ? 'ok' : 'diff';
      } catch {
        status[id] = null;
      }
    }
    integrityStatus = status;
  }


  async function openStore(name) {
    selectedStore = name;
    rows = [];
    try {
      const db = await openDB();
      let raw = await db.table(name).toArray();
      if (uid != null) {
        if (name === 'clients' || name === 'devis' || name === 'factures' || name === 'layoutProfiles') {
          raw = raw.filter((r) => r.userId === uid);
        } else if (name === 'societe') {
          const userSocieteId = `societe-${uid}`;
          raw = raw.filter((r) => r.id === userSocieteId);
        }
      }
      rows = raw.map((r) => {
        if (r && (r.encrypted === true) && (r.payload != null || r.iv != null)) {
          return {
            id: r.id,
            createdAt: r.createdAt,
            encrypted: true,
            payloadLength: r.payload?.byteLength ?? r.payload?.length ?? 0,
            iv: r.iv ? (typeof r.iv === 'string' ? '[base64]' : '[buffer]') : '-'
          };
        }
        return r;
      });
    } catch (e) {
      error = e?.message || 'Erreur lecture';
    }
  }

  function safeJson(obj) {
    try {
      const s = JSON.stringify(obj, null, 2);
      return s.length > 2000 ? s.slice(0, 2000) + '\n… (tronqué)' : s;
    } catch {
      return String(obj);
    }
  }

  loadStores();
</script>

<div class="explorer-module page">
  <h2>Explorer la base (IndexedDB)</h2>
  <p class="hint">
    Base <strong>zerok-billing</strong> dans le navigateur. Devis et factures sont stockés chiffrés (payload + iv). 
    Avec la clé chargée, un aperçu déchiffré est affiché en bas.
  </p>
  {#if error}<p class="error">{error}</p>{/if}
  {#if loading}
    <p>Chargement…</p>
  {:else}
    <div class="explorer-layout">
      <aside class="proofs-panel">
        <h3>Preuves backend (intégrité)</h3>
        <p class="proofs-hint">Hash enregistrés côté serveur pour prouver l'intégrité des documents.</p>
        {#if proofsError}
          <p class="proofs-error">{proofsError}</p>
        {:else if backendProofs.length === 0}
          <p class="proofs-empty">Aucune preuve enregistrée.</p>
        {:else}
          <ul class="proofs-list">
            {#each backendProofs as p}
              <li class="proof-item">
                <span class="proof-id" title={p.invoiceId}>{p.invoiceId.length > 20 ? p.invoiceId.slice(0, 18) + '…' : p.invoiceId}</span>
                <code class="proof-hash" title={p.invoiceHash}>{p.invoiceHash ? p.invoiceHash.slice(0, 12) + '…' : '—'}</code>
                {#if integrityStatus[p.invoiceId] === 'ok'}
                  <span class="proof-status ok" title="Hash local = hash backend">✓ conforme</span>
                {:else if integrityStatus[p.invoiceId] === 'diff'}
                  <span class="proof-status diff" title="Hash local ≠ hash backend">✗ différent</span>
                {:else}
                  <span class="proof-status unknown">—</span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </aside>
      <div class="explorer-main">
    <div class="stores">
      <h3>Stores</h3>
      <ul>
        {#each storeNames as name}
          <li>
            <button type="button" class="store-btn" class:active={selectedStore === name} onclick={() => openStore(name)}>
              {name}
            </button>
          </li>
        {/each}
      </ul>
    </div>
    {#if selectedStore}
      <div class="store-content">
        <h3>Contenu : {selectedStore}</h3>
        <p class="count">{rows.length} enregistrement(s)</p>
        <div class="rows">
          {#each rows as row, i}
            <details class="row">
              <summary>#{i + 1} {row?.id ?? row?.key ?? '—'}</summary>
              <pre>{safeJson(row)}</pre>
            </details>
          {/each}
        </div>
      </div>
    {/if}
    {#if keyLoaded && (decryptedDevis.length > 0 || decryptedFactures.length > 0)}
      <div class="decrypted-preview">
        <h3>Aperçu déchiffré (clé chargée)</h3>
        {#if decryptedDevis.length > 0}
          <h4>Devis</h4>
          <ul>
            {#each decryptedDevis as d}
              <li><strong>{d.entete?.numero ?? d.id}</strong> — client: {d.clientId ?? '—'}, créé: {d.createdAt ?? '—'}</li>
            {/each}
          </ul>
        {/if}
        {#if decryptedFactures.length > 0}
          <h4>Factures</h4>
          <ul>
            {#each decryptedFactures as f}
              <li><strong>{f.entete?.numero ?? f.id}</strong> — client: {f.clientId ?? '—'}, créé: {f.createdAt ?? '—'}</li>
            {/each}
          </ul>
        {/if}
      </div>
    {:else if keyLoaded}
      <p class="hint">Aucun devis ni facture : aperçu déchiffré vide.</p>
    {:else}
      <p class="hint">Déverrouillez avec votre mot de passe pour voir un aperçu déchiffré des devis/factures.</p>
    {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .explorer-module {
    max-width: none;
    width: 100%;
  }
  .explorer-layout {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .proofs-panel {
    flex: 0 0 280px;
    min-width: 240px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    background: #f8fafc;
  }
  .proofs-panel h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: #0f766e;
  }
  .proofs-hint {
    font-size: 0.8rem;
    color: #64748b;
    margin: 0 0 0.75rem 0;
  }
  .proofs-error { color: #b91c1c; font-size: 0.85rem; margin: 0; }
  .proofs-empty { color: #64748b; font-size: 0.9rem; margin: 0; }
  .proofs-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .proof-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.5rem;
    padding: 0.4rem 0;
    border-bottom: 1px solid #e2e8f0;
    font-size: 0.8rem;
  }
  .proof-item:last-child { border-bottom: none; }
  .proof-id {
    flex: 0 0 100%;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .proof-hash {
    font-size: 0.75rem;
    background: #e2e8f0;
    padding: 0.15rem 0.35rem;
    border-radius: 4px;
    color: #475569;
  }
  .proof-status {
    font-size: 0.75rem;
    font-weight: 500;
  }
  .proof-status.ok { color: #15803d; }
  .proof-status.diff { color: #b91c1c; }
  .proof-status.unknown { color: #94a3b8; }
  .explorer-main {
    flex: 1;
    min-width: 280px;
  }
  .hint {
    color: #64748b;
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }
  .error { color: #b91c1c; margin-bottom: 0.5rem; }
  .stores ul { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
  .store-btn {
    padding: 0.4rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #f8fafc;
    cursor: pointer;
  }
  .store-btn.active { background: #0f766e; color: white; border-color: #0f766e; }
  .store-content { margin-top: 1rem; }
  .count { font-size: 0.9rem; color: #64748b; }
  .rows { margin-top: 0.5rem; }
  .row { margin-bottom: 0.5rem; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.5rem; }
  .row summary { cursor: pointer; }
  .row pre { font-size: 0.8rem; overflow: auto; max-height: 200px; margin: 0.5rem 0 0 0; }
  .decrypted-preview { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; }
  .decrypted-preview h4 { margin: 0.5rem 0 0.25rem 0; font-size: 1rem; }
  .decrypted-preview ul { margin: 0; padding-left: 1.25rem; }
</style>
