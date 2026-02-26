import { describe, it, expect } from 'vitest';
import {
  clientDisplayName,
  getProofLabel
} from '../src/lib/liste-documents/listeDocumentsHelpers.js';

describe('listeDocumentsHelpers', () => {
  it('clientDisplayName retourne raisonSociale puis prenom/nom', () => {
    expect(clientDisplayName({ raisonSociale: 'ACME' })).toBe('ACME');
    expect(clientDisplayName({ prenom: 'Jean', nom: 'Dupont' })).toBe('Jean Dupont');
    expect(clientDisplayName(null)).toBe('—');
  });

  it('getProofLabel résout un devis', () => {
    const devisList = [{ id: 'd1', entete: { numero: 'DEV-001', clientId: 'c1' } }];
    const facturesList = [];
    const clientsMap = { c1: { raisonSociale: 'Client A' } };

    expect(getProofLabel('d1', devisList, facturesList, clientsMap)).toBe('Devis DEV-001 — Client A');
  });

  it('getProofLabel résout une facture et fallback sur invoiceId court', () => {
    const devisList = [];
    const facturesList = [{ id: 'f1', entete: { numero: 'FAC-001', clientId: 'c1' } }];
    const clientsMap = { c1: { prenom: 'Jane', nom: 'Doe' } };

    expect(getProofLabel('f1', devisList, facturesList, clientsMap)).toBe('Facture FAC-001 — Jane Doe');
    expect(getProofLabel('unknown', devisList, facturesList, clientsMap)).toBe('unknown');
  });
});
