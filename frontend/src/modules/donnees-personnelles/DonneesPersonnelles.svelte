<script>
  import { getSociete, saveSociete } from '$lib/db.js';
  import { createTextField, createUrlField } from '$lib/formField.js';

  /**
   * Module Données personnelles – affichage + modification (IndexedDB).
   * Champs encapsulés (FormField) pour trim + maxLength.
   */
  let { user = null } = $props();
  const uid = $derived(user?.id ?? null);

  let societe = $state({
    logo: '',
    nom: '',
    formeJuridique: '',
    siret: '',
    rcs: '',
    capital: '',
    siegeSocial: '',
    tvaIntra: ''
  });
  let editing = $state(false);
  let saving = $state(false);
  let message = $state({ type: '', text: '' });

  const logoField = createUrlField();
  const nomField = createTextField({ maxLength: 255 });
  const formeJuridiqueField = createTextField({ maxLength: 100 });
  const siretField = createTextField({ maxLength: 20 });
  const rcsField = createTextField({ maxLength: 100 });
  const capitalField = createTextField({ maxLength: 100 });
  const siegeSocialField = createTextField({ maxLength: 255 });
  const tvaIntraField = createTextField({ maxLength: 30 });

  const logoStore = logoField.store;
  const nomStore = nomField.store;
  const formeJuridiqueStore = formeJuridiqueField.store;
  const siretStore = siretField.store;
  const rcsStore = rcsField.store;
  const capitalStore = capitalField.store;
  const siegeSocialStore = siegeSocialField.store;
  const tvaIntraStore = tvaIntraField.store;

  async function load() {
    try {
      societe = await getSociete(uid);
    } catch (e) {
      console.error(e);
      message = { type: 'error', text: 'Impossible de charger les données.' };
    }
  }
  load();

  function openEdit() {
    logoField.value = societe.logo ?? '';
    nomField.value = societe.nom ?? '';
    formeJuridiqueField.value = societe.formeJuridique ?? '';
    siretField.value = societe.siret ?? '';
    rcsField.value = societe.rcs ?? '';
    capitalField.value = societe.capital ?? '';
    siegeSocialField.value = societe.siegeSocial ?? '';
    tvaIntraField.value = societe.tvaIntra ?? '';
    editing = true;
    message = { type: '', text: '' };
  }

  function cancelEdit() {
    editing = false;
  }

  async function saveEdit(e) {
    e.preventDefault();
    saving = true;
    try {
      await saveSociete(
        {
          logo: logoField.value,
          nom: nomField.value,
          formeJuridique: formeJuridiqueField.value,
          siret: siretField.value,
          rcs: rcsField.value,
          capital: capitalField.value,
          siegeSocial: siegeSocialField.value,
          tvaIntra: tvaIntraField.value
        },
        uid
      );
      societe = await getSociete(uid);
      editing = false;
      message = { type: 'success', text: 'Données enregistrées.' };
    } catch (err) {
      message = { type: 'error', text: err?.message || 'Erreur lors de l’enregistrement.' };
    } finally {
      saving = false;
    }
  }
</script>

<div class="donnees-module">
  <div class="donnees-header">
    <h2 class="donnees-title">Données personnelles</h2>
    <button type="button" class="btn-modifier" onclick={openEdit}>Modifier</button>
  </div>
  {#if message.text}
    <p class="form-message" class:success={message.type === 'success'} class:error={message.type === 'error'}>{message.text}</p>
  {/if}

  <section class="donnees-section donnees-section-logo">
    <h3 class="section-label">Logo</h3>
    {#if societe.logo}
      <img src={societe.logo} alt="Logo de la société" class="logo-img" />
    {:else}
      <div class="logo-placeholder">Aucun logo</div>
    {/if}
  </section>

  <section class="donnees-section">
    <h3 class="section-label">Nom de société</h3>
    <p class="section-value">{societe.nom || '—'}</p>
  </section>

  <section class="donnees-section section-mentions">
    <h3 class="section-label">Mentions légales</h3>
    <dl class="mentions-list">
      <dt>Forme juridique</dt>
      <dd>{societe.formeJuridique || '—'}</dd>

      <dt>SIRET</dt>
      <dd>{societe.siret || '—'}</dd>

      <dt>RCS</dt>
      <dd>{societe.rcs || '—'}</dd>

      <dt>Capital social</dt>
      <dd>{societe.capital || '—'}</dd>

      <dt>Siège social</dt>
      <dd>{societe.siegeSocial || '—'}</dd>

      <dt>N° TVA intracommunautaire</dt>
      <dd>{societe.tvaIntra || '—'}</dd>
    </dl>
  </section>
</div>

{#if editing}
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-societe-title">
    <div class="modal">
      <h3 id="modal-societe-title" class="modal-title">Modifier les données personnelles</h3>
      <form class="societe-form" onsubmit={saveEdit}>
        <div class="form-row">
          <label for="edit-logo">URL du logo</label>
          <input id="edit-logo" type="url" value={$logoStore} oninput={(e) => logoField.value = e.target.value} placeholder="https://…" />
        </div>
        <div class="form-row">
          <label for="edit-nom">Nom de société</label>
          <input id="edit-nom" type="text" value={$nomStore} oninput={(e) => nomField.value = e.target.value} />
        </div>
        <div class="form-row">
          <label for="edit-forme">Forme juridique</label>
          <input id="edit-forme" type="text" value={$formeJuridiqueStore} oninput={(e) => formeJuridiqueField.value = e.target.value} placeholder="SARL, SAS, auto-entrepreneur…" />
        </div>
        <div class="form-row">
          <label for="edit-siret">SIRET</label>
          <input id="edit-siret" type="text" value={$siretStore} oninput={(e) => siretField.value = e.target.value} placeholder="14 chiffres" />
        </div>
        <div class="form-row">
          <label for="edit-rcs">RCS</label>
          <input id="edit-rcs" type="text" value={$rcsStore} oninput={(e) => rcsField.value = e.target.value} placeholder="Ville + n°" />
        </div>
        <div class="form-row">
          <label for="edit-capital">Capital social</label>
          <input id="edit-capital" type="text" value={$capitalStore} oninput={(e) => capitalField.value = e.target.value} />
        </div>
        <div class="form-row">
          <label for="edit-siege">Siège social</label>
          <input id="edit-siege" type="text" value={$siegeSocialStore} oninput={(e) => siegeSocialField.value = e.target.value} placeholder="Adresse complète" />
        </div>
        <div class="form-row">
          <label for="edit-tva">N° TVA intracommunautaire</label>
          <input id="edit-tva" type="text" value={$tvaIntraStore} oninput={(e) => tvaIntraField.value = e.target.value} placeholder="FR…" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-cancel" onclick={cancelEdit}>Annuler</button>
          <button type="submit" class="btn-submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .donnees-module {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-height: 0;
  }
  .donnees-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .donnees-title {
    margin: 0;
    font-size: 1.25rem;
    color: #0f766e;
    font-weight: 700;
  }
  .btn-modifier {
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    border: 1px solid #0f766e;
    background: #fff;
    color: #0f766e;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-modifier:hover {
    background: #f0fdfa;
  }
  .form-message {
    margin: 0;
    font-size: 0.9rem;
  }
  .form-message.success { color: #0f766e; }
  .form-message.error { color: #b91c1c; }
  .donnees-section {
    padding: 0.75rem 0;
    border-bottom: 1px solid #e2e8f0;
  }
  .donnees-section:last-child {
    border-bottom: none;
  }
  .section-label {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: #475569;
  }
  .section-value {
    margin: 0;
    font-size: 1rem;
    color: #0f172a;
  }
  .mentions-list {
    margin: 0;
    display: grid;
    gap: 0.35rem 1.5rem;
    grid-template-columns: auto 1fr;
    font-size: 0.9rem;
  }
  .mentions-list dt {
    margin: 0;
    color: #64748b;
    font-weight: 500;
  }
  .mentions-list dd {
    margin: 0;
    color: #0f172a;
  }
  .logo-img {
    max-width: 180px;
    max-height: 80px;
    object-fit: contain;
    display: block;
  }
  .logo-placeholder {
    width: 180px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    font-size: 0.85rem;
    color: #94a3b8;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  .modal {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
    max-width: 28rem;
    width: 100%;
    max-height: 90vh;
    overflow: auto;
    padding: 1.25rem;
  }
  .modal-title {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: #0f172a;
  }
  .societe-form .form-row {
    margin-bottom: 0.75rem;
  }
  .societe-form label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #475569;
    margin-bottom: 0.25rem;
  }
  .societe-form input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.95rem;
    box-sizing: border-box;
  }
  .societe-form input:focus {
    outline: none;
    border-color: #0f766e;
    box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.2);
  }
  .modal-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
  }
  .btn-cancel {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    background: #fff;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .btn-cancel:hover {
    background: #f8fafc;
  }
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
  .btn-submit:hover {
    background: #0d9488;
  }
  .btn-submit:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
</style>
