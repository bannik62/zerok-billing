import { writable, get } from 'svelte/store';

export const LISTE_DOCS_SEARCH_MAX_LENGTH = 200;
export const LISTE_DOCS_ID_MAX_LENGTH = 100;

/**
 * Encapsule les champs de contrôle : recherche + sélections (devis/factures).
 * Utilisé par ListeDocuments.svelte.
 */
export class ListeDocumentsControlsFields {
  constructor() {
    this._searchStore = writable('');
    this.selectedDevisIdsStore = writable(new Set());
    this.selectedFactureIdsStore = writable(new Set());
  }

  normalizeSearchQuery(value) {
    let next = typeof value === 'string' ? value : '';
    next = next.replace(/[\u0000-\u001f\u007f]/g, '');
    if (next.length > LISTE_DOCS_SEARCH_MAX_LENGTH) next = next.slice(0, LISTE_DOCS_SEARCH_MAX_LENGTH);
    return next;
  }

  normalizeId(value) {
    if (typeof value !== 'string') return null;
    const id = value.trim();
    if (!id) return null;
    if (id.length > LISTE_DOCS_ID_MAX_LENGTH) return null;
    return id;
  }

  normalizeIdSet(ids) {
    const source = ids instanceof Set ? ids : Array.isArray(ids) ? ids : [];
    const out = new Set();
    for (const raw of source) {
      const id = this.normalizeId(raw);
      if (id) out.add(id);
    }
    return out;
  }

  get searchStore() {
    return this._searchStore;
  }

  get searchQuery() {
    return get(this._searchStore);
  }

  set searchQuery(value) {
    this._searchStore.set(this.normalizeSearchQuery(value));
  }

  get selectedDevisIds() {
    return get(this.selectedDevisIdsStore);
  }

  set selectedDevisIds(ids) {
    this.selectedDevisIdsStore.set(this.normalizeIdSet(ids));
  }

  get selectedFactureIds() {
    return get(this.selectedFactureIdsStore);
  }

  set selectedFactureIds(ids) {
    this.selectedFactureIdsStore.set(this.normalizeIdSet(ids));
  }

  clearSelections() {
    this.selectedDevisIds = new Set();
    this.selectedFactureIds = new Set();
  }

  toggleDevisSelection(id) {
    const normalizedId = this.normalizeId(id);
    if (!normalizedId) return;
    const next = new Set(this.selectedDevisIds);
    if (next.has(normalizedId)) next.delete(normalizedId);
    else next.add(normalizedId);
    this.selectedDevisIds = next;
  }

  toggleFactureSelection(id) {
    const normalizedId = this.normalizeId(id);
    if (!normalizedId) return;
    const next = new Set(this.selectedFactureIds);
    if (next.has(normalizedId)) next.delete(normalizedId);
    else next.add(normalizedId);
    this.selectedFactureIds = next;
  }

  selectAllDevis(ids = []) {
    this.selectedDevisIds = new Set(ids.map((id) => this.normalizeId(id)).filter(Boolean));
  }

  selectAllFactures(ids = []) {
    this.selectedFactureIds = new Set(ids.map((id) => this.normalizeId(id)).filter(Boolean));
  }
}
