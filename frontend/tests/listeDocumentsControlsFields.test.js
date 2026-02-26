import { describe, it, expect } from 'vitest';
import {
  ListeDocumentsControlsFields,
  LISTE_DOCS_SEARCH_MAX_LENGTH
} from '../src/lib/liste-documents/ListeDocumentsControlsFields.js';

describe('ListeDocumentsControlsFields', () => {
  it('normalise la recherche (caractères de contrôle + longueur max)', () => {
    const fields = new ListeDocumentsControlsFields();
    const long = `abc\u0000${'x'.repeat(LISTE_DOCS_SEARCH_MAX_LENGTH + 10)}`;
    fields.searchQuery = long;

    expect(fields.searchQuery.includes('\u0000')).toBe(false);
    expect(fields.searchQuery.length).toBe(LISTE_DOCS_SEARCH_MAX_LENGTH);
  });

  it('normalise les IDs et ignore les invalides', () => {
    const fields = new ListeDocumentsControlsFields();
    fields.selectedDevisIds = new Set(['  id-1  ', '', null, 'id-2']);
    expect([...fields.selectedDevisIds]).toEqual(['id-1', 'id-2']);
  });

  it('toggleDevisSelection ajoute puis retire un id', () => {
    const fields = new ListeDocumentsControlsFields();
    fields.toggleDevisSelection('doc-1');
    expect(fields.selectedDevisIds.has('doc-1')).toBe(true);

    fields.toggleDevisSelection('doc-1');
    expect(fields.selectedDevisIds.has('doc-1')).toBe(false);
  });

  it('clearSelections vide les deux sélections', () => {
    const fields = new ListeDocumentsControlsFields();
    fields.selectAllDevis(['a']);
    fields.selectAllFactures(['b']);
    fields.clearSelections();
    expect(fields.selectedDevisIds.size).toBe(0);
    expect(fields.selectedFactureIds.size).toBe(0);
  });
});
