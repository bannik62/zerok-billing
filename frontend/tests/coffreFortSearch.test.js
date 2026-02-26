import { describe, it, expect } from 'vitest';
import { filterDocuments } from '../src/lib/coffreFortSearch.js';

function getDocTypeLabel(type) {
  if (type === 'contrat') return 'Contrat';
  return type || '';
}

function getCategoryLabel(category) {
  if (category === 'transport') return 'Transport';
  return category || '';
}

describe('filterDocuments', () => {
  const clientsMap = {
    c1: { raisonSociale: 'ACME Corp' }
  };
  const docs = [
    {
      id: '1',
      clientId: 'c1',
      filename: 'facture-train.pdf',
      type: 'contrat',
      metadata: { description: 'Déplacement Paris', amount: 123.45, category: 'transport', tags: ['tgv'] }
    },
    {
      id: '2',
      clientId: 'c1',
      filename: 'note.txt',
      type: 'autre',
      metadata: {}
    }
  ];

  it('retourne tous les documents si requête vide', () => {
    expect(filterDocuments(docs, '', clientsMap, getDocTypeLabel, getCategoryLabel)).toHaveLength(2);
  });

  it('filtre par nom de fichier', () => {
    const out = filterDocuments(docs, 'train', clientsMap, getDocTypeLabel, getCategoryLabel);
    expect(out.map((d) => d.id)).toEqual(['1']);
  });

  it('filtre par client, type, catégorie, tags et montant', () => {
    expect(filterDocuments(docs, 'acme', clientsMap, getDocTypeLabel, getCategoryLabel)).toHaveLength(2);
    expect(filterDocuments(docs, 'contrat', clientsMap, getDocTypeLabel, getCategoryLabel)).toHaveLength(1);
    expect(filterDocuments(docs, 'transport', clientsMap, getDocTypeLabel, getCategoryLabel)).toHaveLength(1);
    expect(filterDocuments(docs, 'tgv', clientsMap, getDocTypeLabel, getCategoryLabel)).toHaveLength(1);
    expect(filterDocuments(docs, '123.45', clientsMap, getDocTypeLabel, getCategoryLabel)).toHaveLength(1);
  });
});
