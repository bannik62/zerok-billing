<script>
  import { getAllClients, getClientById, getSociete, addDevis, updateDevis, getNextDevisNumber, getAllLayoutProfiles, getLayoutProfile, addLayoutProfile, updateLayoutProfile, deleteLayoutProfile } from '$lib/dbEncrypted.js';
  import { sendProof } from '$lib/proofs.js';
  import {
    normalisePos,
    DEFAULT_W,
    DEFAULT_H,
    MIN_W,
    MIN_H,
    DRAG_THRESHOLD
  } from './utils.js';
  import DevisFormStep from './DevisFormStep.svelte';
  import EditorSidebar from './EditorSidebar.svelte';
  import SheetA4 from './SheetA4.svelte';
  import SaveProfileModal from './SaveProfileModal.svelte';
  import ManageProfilesModal from './ManageProfilesModal.svelte';

  /**
   * Créer devis – Étape 1 : saisie. Valider → Étape 2 : éditeur.
   */
  let { user = null, client = null } = $props();
  const uid = $derived(user?.id ?? null);

  let step = $state(1);
  let clients = $state([]);
  let currentDevis = $state(null);

  // —— Étape 1 : données formulaire (liées à DevisFormStep)
  let entete = $state({
    clientId: '',
    numero: '',
    dateEmission: '',
    dateValidite: '',
    devise: 'EUR',
    objet: '',
    tvaTaux: 0
  });
  let lignes = $state([
    { id: crypto.randomUUID(), designation: '', quantite: 1, unite: 'u', prixUnitaire: 0 }
  ]);
  let reduction = $state({ type: 'percent', value: 0 });

  $effect(() => {
    if (client && client.id && !entete.clientId) {
      entete = { ...entete, clientId: client.id };
    }
  });

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

  async function loadClients() {
    clients = await getAllClients(uid);
  }
  loadClients();

  /** Au passage en étape 1 pour un nouveau devis, prochain numéro (format client-année-NNN) quand un client est choisi. */
  $effect(() => {
    if (step !== 1 || currentDevis != null) return;
    const clientId = entete.clientId;
    const list = clients;
    getNextDevisNumber(clientId, list, uid)
      .then((num) => {
        const nextNum = num || '';
        if (entete.clientId === clientId && nextNum !== (entete.numero || '')) {
          entete = { ...entete, numero: nextNum };
        }
      })
      .catch(() => {});
  });

  let saving = $state(false);
  function valider() {
    const devis = {
      id: crypto.randomUUID(),
      clientId: entete.clientId || null,
      accepted: false,
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
      blockPositions: {}
    };
    currentDevis = devis;
    blockPositions = {};
    step = 2;
  }

  // —— Étape 2 : éditeur
  let blockPositions = $state({});
  let sheetEl = $state(null);
  let resolvedClient = $state(null);
  let resolvedSociete = $state(null);

  // Profils de mise en page
  let layoutProfiles = $state([]);
  let showSaveProfileModal = $state(false);
  let showManageProfilesModal = $state(false);
  let saveProfileName = $state('');
  let profileSelectValue = $state('');

  $effect(() => {
    const id = currentDevis?.entete?.clientId;
    if (!id) {
      resolvedClient = null;
      return;
    }
    getClientById(id, uid)
      .then((c) => (resolvedClient = c))
      .catch(() => {});
  });

  $effect(() => {
    if (step !== 2) return;
    getSociete()
      .then((s) => (resolvedSociete = s))
      .catch(() => {});
  });

  $effect(() => {
    if (step !== 2) return;
    getAllLayoutProfiles()
      .then((list) => (layoutProfiles = list))
      .catch(() => {});
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
    const left = x - w / 2;
    const top = y - h / 2;
    blockPositions = { ...blockPositions, [type]: { left, top, w, h } };
    if (currentDevis?.createdAt) {
      updateDevis({ ...currentDevis, blockPositions: { ...blockPositions } }, uid)
        .then((d) => (currentDevis = d))
        .catch(() => {});
  } else if (currentDevis) {
      currentDevis = { ...currentDevis, blockPositions: { ...blockPositions } };
    }
  }

  function handleCanvasOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  let draggingBlock = $state(null);
  let dragOffset = $state({ x: 0, y: 0 });
  let resizingBlock = $state(null);
  let selectedBlock = $state(null);
  let pendingDrag = $state(null);

  function handlePlacedBlockMouseDown(e, type) {
    if (e.target.closest('.resize-handle') || e.target.closest('.block-toolbar')) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = normalisePos(blockPositions[type]);
    if (!pos || !sheetEl) return;
    const rect = sheetEl.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / rect.width * 100;
    const mouseY = (e.clientY - rect.top) / rect.height * 100;
    const centerX = pos.left + pos.w / 2;
    const centerY = pos.top + pos.h / 2;
    pendingDrag = { type, startX: mouseX, startY: mouseY, offsetX: mouseX - centerX, offsetY: mouseY - centerY };
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
    const mouseX = (e.clientX - rect.left) / rect.width * 100;
    const mouseY = (e.clientY - rect.top) / rect.height * 100;

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
      let w = mouseX - pos.left;
      let h = mouseY - pos.top;
      w = Math.max(MIN_W, Math.min(100 - pos.left, w));
      h = Math.max(MIN_H, Math.min(100 - pos.top, h));
      blockPositions = { ...blockPositions, [resizingBlock]: { ...pos, w, h } };
      return;
    }

    if (draggingBlock == null) return;
    const pos = normalisePos(blockPositions[draggingBlock]);
    if (!pos) return;
    let centerX = mouseX - dragOffset.x;
    let centerY = mouseY - dragOffset.y;
    const { w, h } = pos;
    let left = centerX - w / 2;
    let top = centerY - h / 2;
    left = Math.max(0, Math.min(100 - w, left));
    top = Math.max(0, Math.min(100 - h, top));
    blockPositions = { ...blockPositions, [draggingBlock]: { ...pos, left, top } };
  }

  function handleCanvasMouseUp() {
    if (draggingBlock == null && pendingDrag != null) {
      selectedBlock = pendingDrag.type;
      pendingDrag = null;
    }
    if ((draggingBlock != null || resizingBlock != null) && currentDevis) {
      if (currentDevis.createdAt) {
        updateDevis({ ...currentDevis, blockPositions: { ...blockPositions } }, uid)
          .then((d) => (currentDevis = d))
          .catch(() => {});
      } else {
        currentDevis = { ...currentDevis, blockPositions: { ...blockPositions } };
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
    const next = { ...pos, [key]: value };
    blockPositions = { ...blockPositions, [type]: next };
    if (currentDevis?.createdAt) {
      updateDevis({ ...currentDevis, blockPositions: { ...blockPositions } }, uid)
        .then((d) => (currentDevis = d))
        .catch(() => {});
  } else if (currentDevis) {
      currentDevis = { ...currentDevis, blockPositions: { ...blockPositions } };
    }
  }

  function retour() {
    step = 1;
  }

  async function nouveauDevis() {
    step = 1;
    currentDevis = null;
    const clientId = client?.id ?? '';
    const nextNum = await getNextDevisNumber(clientId, clients, uid);
    entete = { clientId, numero: nextNum || '', dateEmission: '', dateValidite: '', devise: 'EUR', objet: '', tvaTaux: 0 };
    lignes = [{ id: crypto.randomUUID(), designation: '', quantite: 1, unite: 'u', prixUnitaire: 0 }];
    reduction = { type: 'percent', value: 0 };
  }

  let savingBdd = $state(false);
  let saveMessage = $state('');
  let saveError = $state('');

  async function enregistrerEnBdd() {
    if (!currentDevis) return;
    savingBdd = true;
    saveMessage = '';
    saveError = '';
    try {
      if (currentDevis.createdAt) {
        const updated = await updateDevis({ ...currentDevis, blockPositions: { ...blockPositions } }, uid);
        currentDevis = updated;
        saveMessage = 'Devis enregistré.';
        await sendProof(currentDevis, 'devis').catch((err) => console.warn('Preuve non envoyée:', err));
      } else {
        const saved = await addDevis(
          { ...currentDevis, blockPositions: { ...blockPositions } },
          uid
        );
        currentDevis = saved;
        blockPositions = { ...(saved.blockPositions || {}) };
        saveMessage = 'Devis enregistré.';
        await sendProof(currentDevis, 'devis').catch((err) => console.warn('Preuve non envoyée:', err));
      }
      setTimeout(() => { saveMessage = ''; }, 3000);
    } catch (e) {
      console.error(e);
      saveError = e?.message || 'Erreur lors de l\'enregistrement.';
      setTimeout(() => { saveError = ''; }, 5000);
    } finally {
      savingBdd = false;
    }
  }

  async function applyProfile(profileId) {
    if (!profileId) return;
    const profile = await getLayoutProfile(profileId);
    if (!profile?.blockPositions) return;
    blockPositions = { ...profile.blockPositions };
    if (currentDevis?.createdAt) {
      updateDevis({ ...currentDevis, blockPositions: { ...blockPositions } }, uid)
        .then((d) => (currentDevis = d))
        .catch(() => {});
    } else if (currentDevis) {
      currentDevis = { ...currentDevis, blockPositions: { ...blockPositions } };
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
</script>

{#if step === 1}
  <DevisFormStep
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
      document={currentDevis}
      documentType="devis"
      {resolvedClient}
      {resolvedSociete}
      onDragStart={handleDragStart}
    />
    <div class="editor-main">
      <div class="editor-toolbar">
        <label for="profile-select">Mise en page</label>
        <select
          id="profile-select"
          class="profile-select"
          value={profileSelectValue}
          onchange={(e) => {
            const v = e.currentTarget.value;
            profileSelectValue = v;
            if (v) applyProfile(v);
          }}
        >
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
        document={currentDevis}
        documentType="devis"
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
        <button type="button" class="btn-editor btn-secondary" onclick={nouveauDevis}>Nouveau devis</button>
        <button type="button" class="btn-editor btn-profile" onclick={openSaveProfileModal}>Enregistrer comme profil</button>
        <button type="button" class="btn-editor btn-manage-profiles" onclick={() => (showManageProfilesModal = true)}>Gérer les profils</button>
        <button type="button" class="btn-editor btn-save-bdd" onclick={enregistrerEnBdd} disabled={savingBdd}>{savingBdd ? 'Enregistrement…' : 'Enregistrer en BDD'}</button>
      </div>
      {#if saveMessage}
        <p class="save-feedback save-ok" role="status">{saveMessage}</p>
      {:else if saveError}
        <p class="save-feedback save-err" role="alert">{saveError}</p>
      {/if}
    </div>
  </div>

  <SaveProfileModal
    open={showSaveProfileModal}
    bind:name={saveProfileName}
    onSave={saveCurrentAsProfile}
    onCancel={() => (showSaveProfileModal = false)}
  />

  <ManageProfilesModal
    open={showManageProfilesModal}
    profiles={layoutProfiles}
    onRename={handleRenameProfile}
    onDelete={handleDeleteProfile}
    onClose={() => (showManageProfilesModal = false)}
  />
{/if}

<style>
  .editor-wrap {
    display: flex;
    gap: 1rem;
    min-height: 0;
    flex: 1;
  }
  .editor-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    min-width: 0;
  }
  .editor-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .editor-toolbar label {
    font-size: 0.9rem;
    color: #475569;
  }
  .profile-select {
    padding: 0.35rem 0.6rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.9rem;
    background: #fff;
    min-width: 160px;
  }
  .editor-actions {
    margin-top: 0.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .btn-editor {
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
  }
  .btn-retour {
    border: 1px solid #64748b;
    background: #fff;
    color: #475569;
  }
  .btn-retour:hover {
    background: #f1f5f9;
  }
  .btn-editor.btn-secondary {
    border: 1px solid #e2e8f0;
    background: #fff;
    color: #0f172a;
  }
  .btn-editor.btn-secondary:hover {
    background: #f8fafc;
  }
  .btn-profile {
    border: 1px solid #94a3b8;
    background: #fff;
    color: #475569;
  }
  .btn-profile:hover {
    background: #f1f5f9;
  }
  .btn-manage-profiles {
    border: 1px solid #94a3b8;
    background: #fff;
    color: #475569;
  }
  .btn-manage-profiles:hover {
    background: #f1f5f9;
  }
  .btn-save-bdd {
    border: none;
    background: #0f766e;
    color: white;
  }
  .btn-save-bdd:hover:not(:disabled) {
    background: #0d9488;
  }
  .btn-save-bdd:disabled {
    opacity: 0.7;
    cursor: wait;
  }
  .save-feedback {
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
  }
  .save-ok { color: #0f766e; font-weight: 500; }
  .save-err { color: #b91c1c; }

  @media print {
    :global(.editor-sidebar),
    .editor-toolbar,
    .editor-actions,
    .save-feedback,
    :global(.resize-handle),
    :global(.block-toolbar) {
      display: none !important;
    }
    :global(.placed-block.selected) {
      outline: none !important;
    }
    :global(.placed-block) {
      border: none !important;
      box-shadow: none !important;
      background: #fff !important;
      cursor: default !important;
    }
  }
</style>
