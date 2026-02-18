<script>
  import {
    getAllClients,
    getClientById,
    getSociete,
    addFacture,
    updateFacture,
    getNextFactureNumber,
    getAllDevis,
    getAllLayoutProfiles,
    getLayoutProfile,
    addLayoutProfile,
    updateLayoutProfile,
    deleteLayoutProfile
  } from '$lib/dbEncrypted.js';
  import { sendProof } from '$lib/proofs.js';
  import {
    normalisePos,
    DEFAULT_W,
    DEFAULT_H,
    MIN_W,
    MIN_H,
    DRAG_THRESHOLD
  } from '../creer-devis/utils.js';
  import FactureFormStep from './FactureFormStep.svelte';
  import EditorSidebar from '../creer-devis/EditorSidebar.svelte';
  import SheetA4 from '../creer-devis/SheetA4.svelte';
  import SaveProfileModal from '../creer-devis/SaveProfileModal.svelte';
  import ManageProfilesModal from '../creer-devis/ManageProfilesModal.svelte';

  /** Module Facture – client ou devis pré-sélectionné. Step 0: choix, Step 1: formulaire, Step 2: éditeur. */
  let { user = null, client = null, devis: devisFromMenu = null } = $props();
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
      blockPositions: devisFromMenu?.blockPositions ? { ...devisFromMenu.blockPositions } : {}
    };
    currentFacture = facture;
    blockPositions = { ...(facture.blockPositions || {}) };
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

  let blockPositions = $state({});
  let sheetEl = $state(null);
  let resolvedClient = $state(null);
  let resolvedSociete = $state(null);
  let layoutProfiles = $state([]);
  let showSaveProfileModal = $state(false);
  let showManageProfilesModal = $state(false);
  let saveProfileName = $state('');
  let profileSelectValue = $state('');
  let draggingBlock = $state(null);
  let dragOffset = $state({ x: 0, y: 0 });
  let resizingBlock = $state(null);
  let selectedBlock = $state(null);
  let pendingDrag = $state(null);

  $effect(() => {
    const id = currentFacture?.entete?.clientId;
    if (!id) {
      resolvedClient = null;
      return;
    }
    getClientById(id, uid).then((c) => (resolvedClient = c));
  });
  $effect(() => {
    if (step !== 2) return;
    getSociete().then((s) => (resolvedSociete = s));
  });
  $effect(() => {
    if (step !== 2) return;
    getAllLayoutProfiles().then((list) => (layoutProfiles = list));
  });

  function handleDragStart(e, type) {
    e.dataTransfer.setData('application/block-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  }
  function handleCanvasDrop(e) {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/block-type');
    if (!type) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const existing = blockPositions[type];
    const w = existing?.w ?? DEFAULT_W;
    const h = existing?.h ?? DEFAULT_H;
    blockPositions = { ...blockPositions, [type]: { left: x - w / 2, top: y - h / 2, w, h } };
    if (currentFacture?.createdAt) {
      updateFacture({ ...currentFacture, blockPositions: { ...blockPositions } }, uid).then((f) => (currentFacture = f));
    } else if (currentFacture) {
      currentFacture = { ...currentFacture, blockPositions: { ...blockPositions } };
    }
  }
  function handleCanvasOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  function handlePlacedBlockMouseDown(e, type) {
    if (e.target.closest('.resize-handle') || e.target.closest('.block-toolbar')) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = normalisePos(blockPositions[type]);
    if (!pos || !sheetEl) return;
    const rect = sheetEl.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;
    pendingDrag = { type, startX: mouseX, startY: mouseY, offsetX: mouseX - (pos.left + pos.w / 2), offsetY: mouseY - (pos.top + pos.h / 2) };
  }
  function handleResizeMouseDown(e, type) {
    e.preventDefault();
    e.stopPropagation();
    resizingBlock = type;
  }
  function handleCanvasMouseMove(e) {
    const canvas = sheetEl || e.currentTarget;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;
    if (pendingDrag && !draggingBlock) {
      const dist = Math.hypot(mouseX - pendingDrag.startX, mouseY - pendingDrag.startY);
      if (dist > DRAG_THRESHOLD) {
        draggingBlock = pendingDrag.type;
        dragOffset = { x: pendingDrag.offsetX, y: pendingDrag.offsetY };
        pendingDrag = null;
      }
    }
    if (resizingBlock != null) {
      const pos = normalisePos(blockPositions[resizingBlock]);
      if (!pos) return;
      let w = Math.max(MIN_W, Math.min(100 - pos.left, mouseX - pos.left));
      let h = Math.max(MIN_H, Math.min(100 - pos.top, mouseY - pos.top));
      blockPositions = { ...blockPositions, [resizingBlock]: { ...pos, w, h } };
      return;
    }
    if (draggingBlock == null) return;
    const pos = normalisePos(blockPositions[draggingBlock]);
    if (!pos) return;
    let left = mouseX - dragOffset.x - pos.w / 2;
    let top = mouseY - dragOffset.y - pos.h / 2;
    left = Math.max(0, Math.min(100 - pos.w, left));
    top = Math.max(0, Math.min(100 - pos.h, top));
    blockPositions = { ...blockPositions, [draggingBlock]: { ...pos, left, top } };
  }
  function handleCanvasMouseUp() {
    if (draggingBlock == null && pendingDrag != null) {
      selectedBlock = pendingDrag.type;
      pendingDrag = null;
    }
    if ((draggingBlock != null || resizingBlock != null) && currentFacture) {
      if (currentFacture.createdAt) {
        updateFacture({ ...currentFacture, blockPositions: { ...blockPositions } }, uid).then((f) => (currentFacture = f));
      } else {
        currentFacture = { ...currentFacture, blockPositions: { ...blockPositions } };
      }
    }
    draggingBlock = null;
    resizingBlock = null;
    pendingDrag = null;
  }
  function handleCanvasMouseDown(e) {
    if (e.target === sheetEl) selectedBlock = null;
  }
  function updateBlockStyle(type, key, value) {
    const pos = normalisePos(blockPositions[type]);
    if (!pos) return;
    blockPositions = { ...blockPositions, [type]: { ...pos, [key]: value } };
    if (currentFacture?.createdAt) {
      updateFacture({ ...currentFacture, blockPositions: { ...blockPositions } }, uid).then((f) => (currentFacture = f));
    } else if (currentFacture) {
      currentFacture = { ...currentFacture, blockPositions: { ...blockPositions } };
    }
  }

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
  async function enregistrerEnBdd() {
    if (!currentFacture) return;
    savingBdd = true;
    try {
      if (currentFacture.createdAt) {
        const updated = await updateFacture({ ...currentFacture, blockPositions: { ...blockPositions } }, uid);
        currentFacture = updated;
        await sendProof(currentFacture, 'facture').catch((err) => console.warn('Preuve non envoyée:', err));
      } else {
        const numero = currentFacture.entete?.numero || (await getNextFactureNumber(currentFacture.clientId || '', clients, uid));
        const factureToSave = {
          ...currentFacture,
          entete: { ...currentFacture.entete, numero },
          blockPositions: { ...blockPositions }
        };
        const saved = await addFacture(factureToSave, uid);
        currentFacture = saved;
        blockPositions = { ...(saved.blockPositions || {}) };
        await sendProof(currentFacture, 'facture').catch((err) => console.warn('Preuve non envoyée:', err));
      }
    } catch (e) {
      console.error(e);
    } finally {
      savingBdd = false;
    }
  }

  async function applyProfile(profileId) {
    if (!profileId) return;
    const profile = await getLayoutProfile(profileId);
    if (!profile?.blockPositions) return;
    blockPositions = { ...profile.blockPositions };
    if (currentFacture?.createdAt) {
      updateFacture({ ...currentFacture, blockPositions: { ...blockPositions } }, uid).then((f) => (currentFacture = f));
    } else if (currentFacture) {
      currentFacture = { ...currentFacture, blockPositions: { ...blockPositions } };
    }
    profileSelectValue = '';
  }
  function openSaveProfileModal() {
    saveProfileName = '';
    showSaveProfileModal = true;
  }
  async function saveCurrentAsProfile() {
    const name = saveProfileName?.trim();
    if (!name) return;
    try {
      await addLayoutProfile({ name, blockPositions: { ...blockPositions } });
      layoutProfiles = await getAllLayoutProfiles();
      showSaveProfileModal = false;
      saveProfileName = '';
    } catch (e) {
      console.error(e);
    }
  }
  async function handleRenameProfile(id, newName) {
    try {
      await updateLayoutProfile(id, { name: newName?.trim() || 'Sans nom' });
      layoutProfiles = await getAllLayoutProfiles();
    } catch (e) {
      console.error(e);
    }
  }
  async function handleDeleteProfile(id) {
    try {
      await deleteLayoutProfile(id);
      layoutProfiles = await getAllLayoutProfiles();
    } catch (e) {
      console.error(e);
    }
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
    <EditorSidebar
      document={currentFacture}
      documentType="facture"
      {resolvedClient}
      {resolvedSociete}
      onDragStart={handleDragStart}
    />
    <div class="editor-main">
      <div class="editor-toolbar">
        <label for="profile-select">Mise en page</label>
        <select id="profile-select" class="profile-select" value={profileSelectValue} onchange={(e) => { const v = e.currentTarget.value; profileSelectValue = v; if (v) applyProfile(v); }}>
          <option value="">Vide</option>
          {#each layoutProfiles as profile (profile.id)}
            <option value={profile.id}>{profile.name}</option>
          {/each}
        </select>
      </div>
      <SheetA4
        bind:sheetEl={sheetEl}
        {blockPositions}
        {selectedBlock}
        document={currentFacture}
        documentType="facture"
        {resolvedClient}
        {resolvedSociete}
        onDrop={handleCanvasDrop}
        onOver={handleCanvasOver}
        onCanvasMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onPlacedBlockMouseDown={handlePlacedBlockMouseDown}
        onResizeMouseDown={handleResizeMouseDown}
        onUpdateBlockStyle={updateBlockStyle}
        onCloseToolbar={() => (selectedBlock = null)}
      />
      <div class="editor-actions">
        <button type="button" class="btn-editor btn-retour" onclick={retour}>Retour</button>
        <button type="button" class="btn-editor btn-secondary" onclick={nouvelleFacture}>Nouvelle facture</button>
        <button type="button" class="btn-editor btn-profile" onclick={openSaveProfileModal}>Enregistrer comme profil</button>
        <button type="button" class="btn-editor btn-manage-profiles" onclick={() => (showManageProfilesModal = true)}>Gérer les profils</button>
        <button type="button" class="btn-editor btn-save-bdd" onclick={enregistrerEnBdd} disabled={savingBdd}>{savingBdd ? 'Enregistrement…' : 'Enregistrer en BDD'}</button>
      </div>
    </div>
  </div>

  <SaveProfileModal open={showSaveProfileModal} bind:name={saveProfileName} onSave={saveCurrentAsProfile} onCancel={() => (showSaveProfileModal = false)} />
  <ManageProfilesModal open={showManageProfilesModal} profiles={layoutProfiles} onRename={handleRenameProfile} onDelete={handleDeleteProfile} onClose={() => (showManageProfilesModal = false)} />
{/if}

<style>
  .facture-choice {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border-left: 4px solid #0369a1;
    padding-left: 1rem;
  }
  .facture-title { margin: 0; font-size: 1.25rem; color: #0369a1; font-weight: 700; }
  .facture-intro { margin: 0; color: #64748b; font-size: 0.95rem; }
  .choice-actions { display: flex; flex-direction: column; gap: 1rem; }
  .btn-choice { padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #0369a1; background: #f0f9ff; color: #0369a1; font-weight: 600; cursor: pointer; }
  .btn-choice:hover { background: #e0f2fe; }
  .from-devis { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.75rem; }
  .from-devis label { display: block; font-size: 0.9rem; color: #475569; margin-bottom: 0.25rem; width: 100%; }
  .from-devis select { padding: 0.4rem 0.6rem; border: 1px solid #e2e8f0; border-radius: 6px; min-width: 220px; }
  .btn-from-devis:disabled { opacity: 0.6; cursor: not-allowed; }
  .editor-wrap { display: flex; gap: 1rem; min-height: 0; flex: 1; }
  .editor-main { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1rem; min-width: 0; }
  .editor-toolbar { display: flex; align-items: center; gap: 0.5rem; }
  .editor-toolbar label { font-size: 0.9rem; color: #475569; }
  .profile-select { padding: 0.35rem 0.6rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.9rem; background: #fff; min-width: 160px; }
  .editor-actions { margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .btn-editor { padding: 0.4rem 0.75rem; border-radius: 6px; font-size: 0.9rem; font-weight: 500; cursor: pointer; }
  .btn-retour { border: 1px solid #64748b; background: #fff; color: #475569; }
  .btn-retour:hover { background: #f1f5f9; }
  .btn-editor.btn-secondary { border: 1px solid #e2e8f0; background: #fff; color: #0f172a; }
  .btn-editor.btn-secondary:hover { background: #f8fafc; }
  .btn-profile, .btn-manage-profiles { border: 1px solid #94a3b8; background: #fff; color: #475569; }
  .btn-profile:hover, .btn-manage-profiles:hover { background: #f1f5f9; }
  .btn-save-bdd { border: none; background: #0369a1; color: white; }
  .btn-save-bdd:hover:not(:disabled) { background: #0284c7; }
  .btn-save-bdd:disabled { opacity: 0.7; cursor: wait; }
  @media print {
    :global(.editor-sidebar), .editor-toolbar, .editor-actions, :global(.resize-handle), :global(.block-toolbar) { display: none !important; }
    :global(.placed-block.selected) { outline: none !important; }
    :global(.placed-block) { border: none !important; box-shadow: none !important; background: #fff !important; cursor: default !important; }
  }
</style>
