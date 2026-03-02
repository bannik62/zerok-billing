<script>
  import { getAllClients, getClientById, getSociete, addDevis, updateDevis, getNextDevisNumber } from '$lib/dbEncrypted.js';
  import { sendProof } from '$lib/proofs.js';
  import { scheduleBackupUpload, uploadBackupNow } from '$lib/backupSync.js';
  import DevisFormStep from './DevisFormStep.svelte';
  import DocumentLayout from '../document-layout/DocumentLayout.svelte';
  import { DEFAULT_LAYOUT_ID, LAYOUTS } from '$lib/documentLayouts.js';
  import NoticeModal from '$lib/NoticeModal.svelte';

  /**
   * Créer devis – Étape 1 : saisie. Valider → Étape 2 : éditeur.
   */
  let { user = null, client = null, onSavedAndGoToList = null } = $props();
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
    let cancelled = false;
    getNextDevisNumber(clientId, list, uid)
      .then((num) => {
        if (cancelled) return;
        const nextNum = num || '';
        if (entete.clientId === clientId && nextNum !== (entete.numero || '')) {
          entete = { ...entete, numero: nextNum };
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  });

  let saving = $state(false);
  let formValidationError = $state('');
  function valider() {
    formValidationError = '';
    if (!entete.clientId) {
      formValidationError = 'Choisissez un client.';
      return;
    }
    if (!entete.dateEmission) {
      formValidationError = 'Date d\'émission requise.';
      return;
    }
    if (!entete.dateValidite) {
      formValidationError = 'Date de validité requise.';
      return;
    }
    const objet = (entete.objet || '').trim();
    if (objet.length < 2) {
      formValidationError = 'Objet requis (min. 2 caractères).';
      return;
    }
    const hasLigneAvecDesignation = lignes.some((l) => (l.designation || '').trim().length > 0);
    if (!hasLigneAvecDesignation) {
      formValidationError = 'Au moins une ligne avec désignation requise.';
      return;
    }
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
      layoutId: DEFAULT_LAYOUT_ID
    };
    currentDevis = devis;
    step = 2;
  }

  // —— Étape 2 : aperçu layout fixe
  let resolvedClient = $state(null);
  let resolvedSociete = $state(null);

  $effect(() => {
    const id = currentDevis?.entete?.clientId;
    if (!id) {
      resolvedClient = null;
      return;
    }
    let cancelled = false;
    getClientById(id, uid)
      .then((c) => { if (!cancelled) resolvedClient = c; })
      .catch(() => {});
    return () => { cancelled = true; };
  });

  $effect(() => {
    if (step !== 2) return;
    let cancelled = false;
    getSociete(uid)
      .then((s) => { if (!cancelled) resolvedSociete = s; })
      .catch(() => {});
    return () => { cancelled = true; };
  });

  function retour() {
    step = 1;
  }

  async function nouveauDevis() {
    step = 1;
    currentDevis = null;
    const clientId = client?.id ?? '';
    const nextNum = await getNextDevisNumber(clientId, clients, uid);
    entete = { clientId, numero: nextNum || '', dateEmission: '', dateValidite: '', devise: 'EUR', objet: '', tvaTaux: 0 };
    formValidationError = '';
    lignes = [{ id: crypto.randomUUID(), designation: '', quantite: 1, unite: 'u', prixUnitaire: 0 }];
    reduction = { type: 'percent', value: 0 };
  }

  let savingBdd = $state(false);
  let saveMessage = $state('');
  let saveError = $state('');
  let saveMessageTimer = null;
  let saveErrorTimer = null;
  let redirectNoticeOpen = $state(false);

  $effect(() => {
    return () => {
      if (saveMessageTimer != null) clearTimeout(saveMessageTimer);
      if (saveErrorTimer != null) clearTimeout(saveErrorTimer);
    };
  });

  const REDIRECT_NOTICE_TITLE = 'Enregistrement';
  const REDIRECT_NOTICE_MESSAGE = 'Après enregistrement, vous serez redirigé vers la liste des documents.';

  async function doSave() {
    if (!currentDevis) return;
    savingBdd = true;
    saveMessage = '';
    saveError = '';
    try {
      const payload = { ...currentDevis, layoutId: currentDevis.layoutId || DEFAULT_LAYOUT_ID };
      if (currentDevis.createdAt) {
        const updated = await updateDevis(payload, uid);
        currentDevis = updated;
        saveMessage = 'Devis enregistré.';
        await sendProof(currentDevis, 'devis').catch((err) => console.warn('Preuve non envoyée:', err));
      } else {
        const saved = await addDevis(payload, uid);
        currentDevis = saved;
        saveMessage = 'Devis enregistré.';
        await sendProof(currentDevis, 'devis').catch((err) => console.warn('Preuve non envoyée:', err));
      }
      scheduleBackupUpload(uid);
      await uploadBackupNow(uid);
      if (saveMessageTimer != null) clearTimeout(saveMessageTimer);
      saveMessageTimer = setTimeout(() => { saveMessage = ''; saveMessageTimer = null; }, 3000);
    } catch (e) {
      console.error(e);
      saveError = e?.message || 'Erreur lors de l\'enregistrement.';
      if (saveErrorTimer != null) clearTimeout(saveErrorTimer);
      saveErrorTimer = setTimeout(() => { saveError = ''; saveErrorTimer = null; }, 5000);
    } finally {
      savingBdd = false;
    }
  }

  async function enregistrerEnBdd() {
    if (!currentDevis) return;
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

</script>

{#if step === 1}
  <DevisFormStep
    bind:entete
    bind:lignes
    bind:reduction
    clients={clients}
    {saving}
    validationError={formValidationError}
    onValider={valider}
  />
{:else}
  <div class="editor-wrap">
    <div class="editor-main">
      <div class="editor-layout-choice">
        <label for="devis-layout">Modèle</label>
        <select id="devis-layout" value={currentDevis?.layoutId || DEFAULT_LAYOUT_ID} onchange={(e) => { currentDevis = { ...currentDevis, layoutId: e.target.value }; }}>
          {#each LAYOUTS as layout}
            <option value={layout.id}>{layout.name}</option>
          {/each}
        </select>
      </div>
      <div class="document-layout-preview">
        <DocumentLayout
          document={currentDevis}
          resolvedClient={resolvedClient}
          resolvedSociete={resolvedSociete}
          documentType="devis"
          layoutId={currentDevis?.layoutId || DEFAULT_LAYOUT_ID}
        />
      </div>
      <div class="editor-actions">
        <button type="button" class="btn-editor btn-retour" onclick={retour}>Retour</button>
        <button type="button" class="btn-editor btn-secondary" onclick={nouveauDevis}>Nouveau devis</button>
        <button type="button" class="btn-editor btn-save-bdd" onclick={enregistrerEnBdd} disabled={savingBdd}>{savingBdd ? 'Enregistrement…' : 'Enregistrer en BDD'}</button>
      </div>
      {#if saveMessage}
        <p class="save-feedback save-ok" role="status">{saveMessage}</p>
      {:else if saveError}
        <p class="save-feedback save-err" role="alert">{saveError}</p>
      {/if}
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
  .editor-layout-choice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .editor-layout-choice label { font-size: 0.9rem; color: var(--color-text-muted); }
  .editor-layout-choice select { padding: 0.35rem 0.6rem; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-bg-elevated); }
  .document-layout-preview {
    width: 100%;
    max-width: 595px;
    aspect-ratio: 210 / 297; /* format A4 */
    background: #fff;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow: auto;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
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
    border: 1px solid var(--color-text-muted);
    background: var(--color-bg-elevated);
    color: var(--color-text-soft);
  }
  .btn-retour:hover {
    background: var(--color-bg-muted);
  }
  .btn-editor.btn-secondary {
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
    color: var(--color-text);
  }
  .btn-editor.btn-secondary:hover {
    background: var(--color-bg-muted);
  }
  .btn-save-bdd {
    border: none;
    background: var(--color-primary);
    color: white;
  }
  .btn-save-bdd:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }
  .btn-save-bdd:disabled {
    opacity: 0.7;
    cursor: wait;
  }
  .save-feedback {
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
  }
  .save-ok { color: var(--color-primary); font-weight: 500; }
  .save-err { color: var(--color-error); }

  @media print {
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
      background: var(--color-bg-elevated) !important;
      cursor: default !important;
    }
  }
</style>
