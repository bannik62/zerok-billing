<script>
  import { openDB } from '$lib/db.js';
  import { getAllDevis, getAllFactures, hasEncryptionKey } from '$lib/dbEncrypted.js';
  import { hashDocument } from '$lib/crypto/index.js';
  import { apiClient } from '$lib/apiClient.js';
  import ProofsPanel from '$lib/ProofsPanel.svelte';

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

  const devisIds = $derived(new Set((decryptedDevis || []).map((d) => d.id)));
  const factureIds = $derived(new Set((decryptedFactures || []).map((f) => f.id)));
  const devisById = $derived(Object.fromEntries((decryptedDevis || []).map((d) => [d.id, d])));
  const facturesById = $derived(Object.fromEntries((decryptedFactures || []).map((f) => [f.id, f])));

  /** Items pour ProofsPanel : id, hash, label, isOrphan, documentType. Sections Devis / Factures comme Liste documents. */
  const proofItems = $derived(
    backendProofs.map((p) => {
      const isDevis = devisIds.has(p.invoiceId);
      const isFacture = factureIds.has(p.invoiceId);
      const documentType = isDevis ? 'devis' : isFacture ? 'facture' : 'orphan';
      const doc = devisById[p.invoiceId] ?? facturesById[p.invoiceId];
      const numero = doc?.entete?.numero ?? doc?.id ?? p.invoiceId;
      const label = documentType === 'devis' ? `Devis ${numero}` : documentType === 'facture' ? `Facture ${numero}` : (p.invoiceId.length > 24 ? p.invoiceId.slice(0, 22) + '…' : p.invoiceId);
      return {
        id: p.invoiceId,
        hash: p.invoiceHash || '',
        label,
        isOrphan: !isDevis && !isFacture,
        documentType
      };
    })
  );

  /** ProofsPanel attend verifiedMap[id] === true | false. On mappe integrityStatus. */
  const verifiedMap = $derived(
    Object.fromEntries(
      backendProofs.map((p) => [
        p.invoiceId,
        integrityStatus[p.invoiceId] === 'ok' ? true : integrityStatus[p.invoiceId] === 'diff' ? false : undefined
      ])
    )
  );

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
        } else if (name === 'documents') {
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
      <ProofsPanel
        title="Preuves (intégrité)"
        hint="Hash enregistrés côté serveur. Comparaison avec le hash local (IndexedDB)."
        error={proofsError}
        items={proofItems}
        verifiedMap={verifiedMap}
        verifiedLoading={false}
        ariaLabel="Preuves — comparaison hash local / backend"
      />
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
  .explorer-main {
    flex: 1;
    min-width: 280px;
  }
  .hint {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }
  .error { color: var(--color-error); margin-bottom: 0.5rem; }
  .stores ul { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
  .store-btn {
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 6px;
    background: var(--color-bg-muted);
    cursor: pointer;
  }
  .store-btn.active { background: var(--color-primary); color: white; border-color: var(--color-primary); }
  .store-content { margin-top: 1rem; }
  .count { font-size: 0.9rem; color: var(--color-text-muted); }
  .rows { margin-top: 0.5rem; }
  .row { margin-bottom: 0.5rem; border: 1px solid var(--color-border); border-radius: 6px; padding: 0.5rem; }
  .row summary { cursor: pointer; }
  .row pre { font-size: 0.8rem; overflow: auto; max-height: 200px; margin: 0.5rem 0 0 0; }
  .decrypted-preview { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--color-border); }
  .decrypted-preview h4 { margin: 0.5rem 0 0.25rem 0; font-size: 1rem; }
  .decrypted-preview ul { margin: 0; padding-left: 1.25rem; }
</style>
