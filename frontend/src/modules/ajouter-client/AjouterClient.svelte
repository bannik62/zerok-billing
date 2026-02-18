<script>
  import { addClient, getAllClients, updateClient, deleteClient } from '$lib/db.js';
  import { createTextField, createTelField } from '$lib/formField.js';

  /**
   * Module Ajouter client – formulaire, liste, modifier/supprimer, ouvrir Facture/Devis.
   */
  let { user = null, onOpenFacture, onOpenDevis } = $props();
  const uid = $derived(user?.id ?? null);

  let clients = $state([]);
  let message = $state({ type: '', text: '' });
  let loading = $state(false);
  /** Client en cours d’édition (popup) */
  let editingClientId = $state(null);
  let savingEdit = $state(false);

  const raisonSocialeField = createTextField({ maxLength: 255 });
  const nomField = createTextField({ maxLength: 100 });
  const prenomField = createTextField({ maxLength: 100 });
  const emailField = createTextField({ maxLength: 255 });
  const telephoneField = createTelField();
  const adresseField = createTextField({ maxLength: 255 });
  const codePostalField = createTextField({ maxLength: 10 });
  const villeField = createTextField({ maxLength: 100 });
  const siretField = createTextField({ maxLength: 20 });

  const editRaisonSocialeField = createTextField({ maxLength: 255 });
  const editNomField = createTextField({ maxLength: 100 });
  const editPrenomField = createTextField({ maxLength: 100 });
  const editEmailField = createTextField({ maxLength: 255 });
  const editTelephoneField = createTelField();
  const editAdresseField = createTextField({ maxLength: 255 });
  const editCodePostalField = createTextField({ maxLength: 10 });
  const editVilleField = createTextField({ maxLength: 100 });
  const editSiretField = createTextField({ maxLength: 20 });

  const raisonSocialeStore = raisonSocialeField.store;
  const nomStore = nomField.store;
  const prenomStore = prenomField.store;
  const emailStore = emailField.store;
  const telephoneStore = telephoneField.store;
  const adresseStore = adresseField.store;
  const codePostalStore = codePostalField.store;
  const villeStore = villeField.store;
  const siretStore = siretField.store;
  const editRaisonSocialeStore = editRaisonSocialeField.store;
  const editNomStore = editNomField.store;
  const editPrenomStore = editPrenomField.store;
  const editEmailStore = editEmailField.store;
  const editTelephoneStore = editTelephoneField.store;
  const editAdresseStore = editAdresseField.store;
  const editCodePostalStore = editCodePostalField.store;
  const editVilleStore = editVilleField.store;
  const editSiretStore = editSiretField.store;

  async function loadClients() {
    try {
      clients = await getAllClients(uid);
    } catch (e) {
      console.error(e);
      message = { type: 'error', text: 'Impossible de charger les clients.' };
    }
  }

  loadClients();

  async function submit(e) {
    e.preventDefault();
    message = { type: '', text: '' };
    loading = true;
    try {
      await addClient(
        {
          raisonSociale: raisonSocialeField.value,
          nom: nomField.value,
          prenom: prenomField.value,
          email: emailField.value,
          telephone: telephoneField.value,
          adresse: adresseField.value,
          codePostal: codePostalField.value,
          ville: villeField.value,
          siret: siretField.value
        },
        uid
      );
      raisonSocialeField.reset('');
      nomField.reset('');
      prenomField.reset('');
      emailField.reset('');
      telephoneField.reset('');
      adresseField.reset('');
      codePostalField.reset('');
      villeField.reset('');
      siretField.reset('');
      await loadClients();
      message = { type: 'success', text: 'Client enregistré.' };
    } catch (err) {
      message = { type: 'error', text: err?.message || 'Erreur lors de l’enregistrement.' };
    } finally {
      loading = false;
    }
  }

  function openEdit(client) {
    editingClientId = client.id;
    editRaisonSocialeField.value = client.raisonSociale ?? '';
    editNomField.value = client.nom ?? '';
    editPrenomField.value = client.prenom ?? '';
    editEmailField.value = client.email ?? '';
    editTelephoneField.value = client.telephone ?? '';
    editAdresseField.value = client.adresse ?? '';
    editCodePostalField.value = client.codePostal ?? '';
    editVilleField.value = client.ville ?? '';
    editSiretField.value = client.siret ?? '';
  }

  function cancelEdit() {
    editingClientId = null;
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (editingClientId == null) return;
    savingEdit = true;
    try {
      await updateClient({
        id: editingClientId,
        raisonSociale: editRaisonSocialeField.value,
        nom: editNomField.value,
        prenom: editPrenomField.value,
        email: editEmailField.value,
        telephone: editTelephoneField.value,
        adresse: editAdresseField.value,
        codePostal: editCodePostalField.value,
        ville: editVilleField.value,
        siret: editSiretField.value
      });
      await loadClients();
      editingClientId = null;
      message = { type: 'success', text: 'Client modifié.' };
    } catch (err) {
      message = { type: 'error', text: err?.message || 'Erreur lors de la modification.' };
    } finally {
      savingEdit = false;
    }
  }

  async function removeClient(client) {
    if (!confirm('Supprimer ce client ?')) return;
    try {
      await deleteClient(client.id);
      await loadClients();
      message = { type: 'success', text: 'Client supprimé.' };
    } catch (err) {
      message = { type: 'error', text: err?.message || 'Erreur lors de la suppression.' };
    }
  }
</script>

<div class="clients-module">
  <h2 class="clients-title">Clients</h2>

  <section class="clients-section">
    <h3 class="section-label">Nouveau client</h3>
    <form class="client-form" onsubmit={submit}>
      <div class="form-row">
        <label for="raison-sociale">Raison sociale</label>
        <input id="raison-sociale" type="text" value={$raisonSocialeStore} oninput={(e) => raisonSocialeField.value = e.target.value} placeholder="Société ou particulier" />
      </div>
      <div class="form-row-group">
        <div class="form-row">
          <label for="nom">Nom</label>
          <input id="nom" type="text" value={$nomStore} oninput={(e) => nomField.value = e.target.value} />
        </div>
        <div class="form-row">
          <label for="prenom">Prénom</label>
          <input id="prenom" type="text" value={$prenomStore} oninput={(e) => prenomField.value = e.target.value} />
        </div>
      </div>
      <div class="form-row">
        <label for="email">Email</label>
        <input id="email" type="email" value={$emailStore} oninput={(e) => emailField.value = e.target.value} />
      </div>
      <div class="form-row">
        <label for="telephone">Téléphone</label>
        <input id="telephone" type="tel" value={$telephoneStore} oninput={(e) => telephoneField.value = e.target.value} />
      </div>
      <div class="form-row">
        <label for="adresse">Adresse</label>
        <input id="adresse" type="text" value={$adresseStore} oninput={(e) => adresseField.value = e.target.value} placeholder="Numéro et rue" />
      </div>
      <div class="form-row-group">
        <div class="form-row">
          <label for="code-postal">Code postal</label>
          <input id="code-postal" type="text" value={$codePostalStore} oninput={(e) => codePostalField.value = e.target.value} />
        </div>
        <div class="form-row">
          <label for="ville">Ville</label>
          <input id="ville" type="text" value={$villeStore} oninput={(e) => villeField.value = e.target.value} />
        </div>
      </div>
      <div class="form-row">
        <label for="siret">SIRET</label>
        <input id="siret" type="text" value={$siretStore} oninput={(e) => siretField.value = e.target.value} placeholder="14 chiffres" />
      </div>
      <div class="form-actions">
        <button type="submit" class="btn-submit" disabled={loading}>
          {loading ? 'Enregistrement…' : 'Enregistrer le client'}
        </button>
      </div>
      {#if message.text}
        <p class="form-message" class:success={message.type === 'success'} class:error={message.type === 'error'}>
          {message.text}
        </p>
      {/if}
    </form>
  </section>

  <section class="clients-section clients-list-section">
    <h3 class="section-label">Clients enregistrés</h3>
    {#if clients.length === 0}
      <p class="clients-empty">Aucun client pour l’instant.</p>
    {:else}
      <ul class="clients-list">
        {#each clients as client (client.id)}
          <li class="client-item">
            <div class="client-item-head">
              <span class="client-item-name">{client.raisonSociale || [client.prenom, client.nom].filter(Boolean).join(' ') || '—'}</span>
              {#if client.email}<span class="client-item-email">{client.email}</span>{/if}
            </div>
            <div class="client-item-actions">
              <button type="button" class="btn-item btn-modifier" onclick={() => openEdit(client)}>Modifier</button>
              <button type="button" class="btn-item btn-facture" onclick={() => onOpenFacture?.(client)}>Facture</button>
              <button type="button" class="btn-item btn-devis" onclick={() => onOpenDevis?.(client)}>Devis</button>
              <button type="button" class="btn-item btn-supprimer" onclick={() => removeClient(client)}>Supprimer</button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

{#if editingClientId != null}
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-edit-title">
    <div class="modal">
      <h3 id="modal-edit-title" class="modal-title">Modifier le client</h3>
      <form class="client-form modal-form" onsubmit={saveEdit}>
        <div class="form-row">
          <label for="edit-raison-sociale">Raison sociale</label>
          <input id="edit-raison-sociale" type="text" value={$editRaisonSocialeStore} oninput={(e) => editRaisonSocialeField.value = e.target.value} placeholder="Société ou particulier" />
        </div>
        <div class="form-row-group">
          <div class="form-row">
            <label for="edit-nom">Nom</label>
            <input id="edit-nom" type="text" value={$editNomStore} oninput={(e) => editNomField.value = e.target.value} />
          </div>
          <div class="form-row">
            <label for="edit-prenom">Prénom</label>
            <input id="edit-prenom" type="text" value={$editPrenomStore} oninput={(e) => editPrenomField.value = e.target.value} />
          </div>
        </div>
        <div class="form-row">
          <label for="edit-email">Email</label>
          <input id="edit-email" type="email" value={$editEmailStore} oninput={(e) => editEmailField.value = e.target.value} />
        </div>
        <div class="form-row">
          <label for="edit-telephone">Téléphone</label>
          <input id="edit-telephone" type="tel" value={$editTelephoneStore} oninput={(e) => editTelephoneField.value = e.target.value} />
        </div>
        <div class="form-row">
          <label for="edit-adresse">Adresse</label>
          <input id="edit-adresse" type="text" value={$editAdresseStore} oninput={(e) => editAdresseField.value = e.target.value} placeholder="Numéro et rue" />
        </div>
        <div class="form-row-group">
          <div class="form-row">
            <label for="edit-code-postal">Code postal</label>
            <input id="edit-code-postal" type="text" value={$editCodePostalStore} oninput={(e) => editCodePostalField.value = e.target.value} />
          </div>
          <div class="form-row">
            <label for="edit-ville">Ville</label>
            <input id="edit-ville" type="text" value={$editVilleStore} oninput={(e) => editVilleField.value = e.target.value} />
          </div>
        </div>
        <div class="form-row">
          <label for="edit-siret">SIRET</label>
          <input id="edit-siret" type="text" value={$editSiretStore} oninput={(e) => editSiretField.value = e.target.value} placeholder="14 chiffres" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-cancel" onclick={cancelEdit}>Annuler</button>
          <button type="submit" class="btn-submit" disabled={savingEdit}>{savingEdit ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .clients-module {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-height: 0;
  }
  .clients-title {
    margin: 0;
    font-size: 1.25rem;
    color: #0f766e;
    font-weight: 700;
  }
  .clients-section {
    padding: 0.75rem 0;
  }
  .section-label {
    margin: 0 0 1rem 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #475569;
  }
  .client-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 28rem;
  }
  .form-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .form-row label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #475569;
  }
  .client-form input {
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.95rem;
  }
  .client-form input:focus {
    outline: none;
    border-color: #0f766e;
    box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.2);
  }
  .form-row-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  @media (min-width: 480px) {
    .form-row-group {
      flex-direction: row;
      gap: 1rem;
    }
    .form-row-group .form-row {
      flex: 1;
      min-width: 0;
    }
  }
  .form-actions {
    margin-top: 0.5rem;
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
  .form-message {
    margin: 0.75rem 0 0 0;
    font-size: 0.9rem;
  }
  .form-message.success { color: #0f766e; }
  .form-message.error { color: #b91c1c; }
  .clients-list-section {
    border-top: 1px solid #e2e8f0;
    padding-top: 1rem;
  }
  .clients-empty {
    margin: 0;
    font-size: 0.9rem;
    color: #64748b;
  }
  .clients-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .client-item {
    padding: 0.75rem;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .client-item-head {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .client-item-name {
    font-weight: 600;
    color: #0f172a;
  }
  .client-item-email {
    font-size: 0.85rem;
    color: #64748b;
  }
  .client-item-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .btn-item {
    padding: 0.35rem 0.6rem;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
    background: #fff;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
  }
  .btn-item:hover {
    background: #f1f5f9;
  }
  .btn-modifier { color: #0f766e; border-color: #99f6e4; }
  .btn-modifier:hover { background: #f0fdfa; }
  .btn-facture { color: #0369a1; border-color: #bae6fd; }
  .btn-facture:hover { background: #f0f9ff; }
  .btn-devis { color: #0d9488; border-color: #99f6e4; }
  .btn-devis:hover { background: #f0fdfa; }
  .btn-supprimer { color: #b91c1c; border-color: #fecaca; }
  .btn-supprimer:hover { background: #fef2f2; }

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
  .modal-form .form-row { margin-bottom: 0; }
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
</style>
