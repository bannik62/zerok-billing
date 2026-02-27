<script>
  import {
    getAllClients,
    getClientById,
    getSociete,
    addFacture,
    updateFacture,
    getNextFactureNumber,
    getAllDevis
  } from '$lib/dbEncrypted.js';
  import { sendProof } from '$lib/proofs.js';
  import { scheduleBackupUpload } from '$lib/backupSync.js';
  import FactureFormStep from './FactureFormStep.svelte';
  import DocumentLayout from '../document-layout/DocumentLayout.svelte';
  import { DEFAULT_LAYOUT_ID, LAYOUTS } from '$lib/documentLayouts.js';
  import NoticeModal from '$lib/NoticeModal.svelte';

  /** Module Facture – client ou devis pré-sélectionné. Step 0: choix, Step 1: formulaire, Step 2: éditeur. */
  let { user = null, client = null, devis: devisFromMenu = null, onSavedAndGoToList = null } = $props();
  const uid = $derived(user?.id ?? null);

  let step = $state(0);
  let clients = $state([]);

  $effect(() => {
    if (devisFromMenu && step === 0) step = 1;
  });
  let devisList = $state([]);
  let selectedDevisId = $state('');
  let currentFacture = $state(null);

  let entete = $state({
    clientId: '',
    numero: '',
    dateEmission: '',
    delaiPaiement: '',
    devise: 'EUR',
    objet: '',
    tvaTaux: 20
  });
  let lignes = $state([{ id: crypto.randomUUID(), designation: '', quantite: 1, unite: 'u', prixUnitaire: 0 }]);
  let reduction = $state({ type: 'percent', value: 0 });

  $effect(() => {
    if (client?.id && !entete.clientId) entete = { ...entete, clientId: client.id };
  });

  $effect(() => {
    if (devisFromMenu && step === 1) {
      const d = devisFromMenu;
      entete = {
        clientId: d.entete?.clientId ?? '',
        numero: '',
        dateEmission: d.entete?.dateEmission || new Date().toISOString().slice(0, 10),
        delaiPaiement: '30 jours',
        devise: d.entete?.devise ?? 'EUR',
        objet: d.entete?.objet ?? '',
        tvaTaux: Number(d.entete?.tvaTaux) ?? 20
      };
      lignes = (d.lignes || []).length
        ? d.lignes.map((l) => ({ ...l, id: l.id || crypto.randomUUID() }))
        : [{ id: crypto.randomUUID(), designation: '', quantite: 1, unite: 'u', prixUnitaire: 0 }];
      reduction = d.reduction ? { ...d.reduction } : { type: 'percent', value: 0 };
    }
  });

  const sousTotal = $derived(
    lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0), 0)
  );
  const reductionMontant = $derived(
    reduction.type === 'percent' ? (sousTotal * (Number(reduction.value) || 0)) / 100 : Number(reduction.value) || 0
  );
  const total = $derived(Math.max(0, sousTotal - reductionMontant));
  const totalHT = $derived(total);
  const tvaMontant = $derived(totalHT * ((Number(entete.tvaTaux) || 0) / 100));
  const totalTTC = $derived(totalHT + tvaMontant);

  async function loadClients() {
    clients = await getAllClients(uid);
  }
  async function loadDevis() {
    devisList = await getAllDevis(uid);
  }
  loadClients();
  $effect(() => {
    if (step === 0) loadDevis();
  });

  let saving = $state(false);
  function valider() {
    const facture = {
      id: crypto.randomUUID(),
      clientId: entete.clientId || null,
      devisId: devisFromMenu?.id || selectedDevisId || null,
      entete: { ...entete },
      lignes: lignes.map((l) => ({
        id: l.id,
        designation: l.designation,
        quantite: Number(l.quantite) || 0,
        unite: l.unite,
        prixUnitaire: Number(l.prixUnitaire) || 0
      })),
      reduction: { ...reduction },
      sousTotal,
      total,
      tvaMontant,
      totalTTC,
      layoutId: DEFAULT_LAYOUT_ID
    };
    currentFacture = facture;
    step = 2;
  }

  function partirDuDevis() {
    const d = devisList.find((x) => x.id === selectedDevisId);
    if (!d) return;
    entete = {
      clientId: d.entete?.clientId ?? '',
      numero: '',
      dateEmission: d.entete?.dateEmission || new Date().toISOString().slice(0, 10),
      delaiPaiement: '30 jours',
      devise: d.entete?.devise ?? 'EUR',
      objet: d.entete?.objet ?? '',
      tvaTaux: Number(d.entete?.tvaTaux) ?? 20
    };
    lignes = (d.lignes || []).length
      ? d.lignes.map((l) => ({ ...l, id: l.id || crypto.randomUUID() }))
      : [{ id: crypto.randomUUID(), designation: '', quantite: 1, unite: 'u', prixUnitaire: 0 }];
    reduction = d.reduction ? { ...d.reduction } : { type: 'percent', value: 0 };
    step = 1;
  }

  let resolvedClient = $state(null);
  let resolvedSociete = $state(null);

  $effect(() => {
    const id = currentFacture?.entete?.clientId;
    if (!id) {
      resolvedClient = null;
      return;
    }
    let cancelled = false;
    getClientById(id, uid).then((c) => { if (!cancelled) resolvedClient = c; });
    return () => { cancelled = true; };
  });
  $effect(() => {
    if (step !== 2) return;
    let cancelled = false;
    getSociete(uid).then((s) => { if (!cancelled) resolvedSociete = s; });
    return () => { cancelled = true; };
  });

  function retour() {
    step = step === 2 ? 1 : 0;
  }
  async function nouvelleFactureFromChoice() {
    step = 1;
    const clientId = client?.id ?? '';
    const nextNum = await getNextFactureNumber(clientId, clients, uid);
    entete = {
      clientId,
      numero: nextNum || '',
      dateEmission: new Date().toISOString().slice(0, 10),
      delaiPaiement: '',
      devise: 'EUR',
      objet: '',
      tvaTaux: 20
    };
    lignes = [{ id: crypto.randomUUID(), designation: '', quantite: 1, unite: 'u', prixUnitaire: 0 }];
    reduction = { type: 'percent', value: 0 };
  }
  async function nouvelleFacture() {
    step = 0;
    currentFacture = null;
    selectedDevisId = '';
    const clientId = client?.id ?? '';
    const nextNum = await getNextFactureNumber(clientId, clients, uid);
    entete = { clientId, numero: nextNum || '', dateEmission: '', delaiPaiement: '', devise: 'EUR', objet: '', tvaTaux: 20 };
    lignes = [{ id: crypto.randomUUID(), designation: '', quantite: 1, unite: 'u', prixUnitaire: 0 }];
    reduction = { type: 'percent', value: 0 };
  }

  let savingBdd = $state(false);
  let redirectNoticeOpen = $state(false);

  const REDIRECT_NOTICE_TITLE = 'Enregistrement';
  const REDIRECT_NOTICE_MESSAGE = 'Après enregistrement, vous serez redirigé vers la liste des documents.';

  async function doSave() {
    if (!currentFacture) return;
    savingBdd = true;
    try {
      const payload = { ...currentFacture, layoutId: currentFacture.layoutId || DEFAULT_LAYOUT_ID };
      if (currentFacture.createdAt) {
        const updated = await updateFacture(payload, uid);
        currentFacture = updated;
        await sendProof(currentFacture, 'facture').catch((err) => console.warn('Preuve non envoyée:', err));
      } else {
        const numero = currentFacture.entete?.numero || (await getNextFactureNumber(currentFacture.clientId || '', clients, uid));
        const factureToSave = { ...payload, entete: { ...payload.entete, numero } };
        const saved = await addFacture(factureToSave, uid);
        currentFacture = saved;
        await sendProof(currentFacture, 'facture').catch((err) => console.warn('Preuve non envoyée:', err));
      }
      scheduleBackupUpload(uid);
    } catch (e) {
      console.error(e);
    } finally {
      savingBdd = false;
    }
  }

  async function enregistrerEnBdd() {
    if (!currentFacture) return;
    if (onSavedAndGoToList) {
      redirectNoticeOpen = true;
      return;
    }
    await doSave();
  }

  async function handleRedirectNoticeOk() {
    redirectNoticeOpen = false;
    await doSave();
    if (onSavedAndGoToList) onSavedAndGoToList();
  }

  /** À l'étape 1, prochain numéro (FAC-{client}-{année}-{NNN}) quand un client est choisi. */
  $effect(() => {
    if (step !== 1) return;
    const clientId = entete.clientId;
    const list = clients;
    getNextFactureNumber(clientId, list, uid)
      .then((num) => {
        const nextNum = num || '';
        if (entete.clientId === clientId && nextNum !== (entete.numero || '')) {
          entete = { ...entete, numero: nextNum };
        }
      })
      .catch(() => {});
  });
</script>

{#if step === 0}
  <div class="facture-choice">
    <h2 class="facture-title">Facture</h2>
    <p class="facture-intro">Document de vente (à émettre après accord du devis). Choisissez comment créer la facture.</p>
    <div class="choice-actions">
      <button type="button" class="btn-choice" onclick={nouvelleFactureFromChoice}>
        Nouvelle facture
      </button>
      <div class="from-devis">
        <label for="devis-select">Partir d'un devis</label>
        <select id="devis-select" bind:value={selectedDevisId}>
          <option value="">— Choisir un devis —</option>
          {#each devisList as d (d.id)}
            <option value={d.id}>N° {d.entete?.numero || d.id} – {d.entete?.objet || 'Sans objet'}</option>
          {/each}
        </select>
        <button type="button" class="btn-choice btn-from-devis" onclick={partirDuDevis} disabled={!selectedDevisId}>
          Créer la facture à partir de ce devis
        </button>
      </div>
    </div>
  </div>
{:else if step === 1}
  <FactureFormStep
    bind:entete
    bind:lignes
    bind:reduction
    clients={clients}
    {saving}
    onValider={valider}
  />
{:else}
  <div class="editor-wrap">
    <div class="editor-main">
      <div class="editor-layout-choice">
        <label for="facture-layout">Modèle</label>
        <select id="facture-layout" value={currentFacture?.layoutId || DEFAULT_LAYOUT_ID} onchange={(e) => { currentFacture = { ...currentFacture, layoutId: e.target.value }; }}>
          {#each LAYOUTS as layout}
            <option value={layout.id}>{layout.name}</option>
          {/each}
        </select>
      </div>
      <div class="document-layout-preview">
        <DocumentLayout
          document={currentFacture}
          resolvedClient={resolvedClient}
          resolvedSociete={resolvedSociete}
          documentType="facture"
          layoutId={currentFacture?.layoutId || DEFAULT_LAYOUT_ID}
        />
      </div>
      <div class="editor-actions">
        <button type="button" class="btn-editor btn-retour" onclick={retour}>Retour</button>
        <button type="button" class="btn-editor btn-secondary" onclick={nouvelleFacture}>Nouvelle facture</button>
        <button type="button" class="btn-editor btn-save-bdd" onclick={enregistrerEnBdd} disabled={savingBdd}>{savingBdd ? 'Enregistrement…' : 'Enregistrer en BDD'}</button>
      </div>
    </div>
  </div>

  <NoticeModal
    open={redirectNoticeOpen}
    title={REDIRECT_NOTICE_TITLE}
    message={REDIRECT_NOTICE_MESSAGE}
    okLabel="OK"
    onOk={handleRedirectNoticeOk}
  />
{/if}

<style>
  .facture-choice {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border-left: 4px solid var(--color-primary);
    padding-left: 1rem;
  }
  .facture-title { margin: 0; font-size: 1.25rem; color: var(--color-primary); font-weight: 700; }
  .facture-intro { margin: 0; color: var(--color-text-muted); font-size: 0.95rem; }
  .choice-actions { display: flex; flex-direction: column; gap: 1rem; }
  .btn-choice { padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid var(--color-primary); background: var(--color-bg-muted); color: var(--color-primary); font-weight: 600; cursor: pointer; }
  .btn-choice:hover { background: var(--color-bg-muted); }
  .from-devis { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.75rem; }
  .from-devis label { display: block; font-size: 0.9rem; color: var(--color-text-soft); margin-bottom: 0.25rem; width: 100%; }
  .from-devis select { padding: 0.4rem 0.6rem; border: 1px solid var(--color-border); border-radius: 6px; min-width: 220px; }
  .btn-from-devis:disabled { opacity: 0.6; cursor: not-allowed; }
  .editor-wrap { display: flex; gap: 1rem; min-height: 0; flex: 1; }
  .editor-main { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1rem; min-width: 0; }
  .editor-layout-choice { display: flex; align-items: center; gap: 0.5rem; }
  .editor-layout-choice label { font-size: 0.9rem; color: var(--color-text-muted); }
  .editor-layout-choice select { padding: 0.35rem 0.6rem; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-bg-elevated); }
  .document-layout-preview { width: 100%; max-width: 595px; aspect-ratio: 210 / 297; background: #fff; border: 1px solid var(--color-border); border-radius: 8px; overflow: auto; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); }
  .editor-actions { margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .btn-editor { padding: 0.4rem 0.75rem; border-radius: 6px; font-size: 0.9rem; font-weight: 500; cursor: pointer; }
  .btn-retour { border: 1px solid var(--color-text-muted); background: var(--color-bg-elevated); color: var(--color-text-soft); }
  .btn-retour:hover { background: var(--color-bg-muted); }
  .btn-editor.btn-secondary { border: 1px solid var(--color-border); background: var(--color-bg-elevated); color: var(--color-text); }
  .btn-editor.btn-secondary:hover { background: var(--color-bg-muted); }
  .btn-save-bdd { border: none; background: var(--color-primary); color: white; }
  .btn-save-bdd:hover:not(:disabled) { background: var(--color-primary-hover); }
  .btn-save-bdd:disabled { opacity: 0.7; cursor: wait; }
  @media print {
    .editor-actions { display: none !important; }
  }
</style>
