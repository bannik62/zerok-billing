import test from 'node:test';
import assert from 'node:assert';
import {
  validateProofBody,
  validateProofsVerifyBody,
  validateDocumentProofBody,
  validateDocumentIdParam,
  validateInvoiceIdParam,
  validateCleanupBody
} from '../validators/secureValidator.js';

const SHA256_HEX = 'a'.repeat(64);

test('validateProofBody: accepte et normalise le hash hex', () => {
  const { value, error } = validateProofBody({
    invoiceId: 'INV-001',
    invoiceHash: 'A'.repeat(64),
    signature: 'sig'
  });

  assert.strictEqual(error, null);
  assert.ok(value);
  assert.strictEqual(value.invoiceId, 'INV-001');
  assert.strictEqual(value.invoiceHash, SHA256_HEX);
  assert.strictEqual(value.signature, 'sig');
});

test('validateProofBody: rejette un hash invalide', () => {
  const { value, error } = validateProofBody({
    invoiceId: 'INV-001',
    invoiceHash: 'xyz',
    signature: 'sig'
  });

  assert.strictEqual(value, null);
  assert.ok(error);
  assert.match(error, /invoiceHash/i);
});

test('validateProofsVerifyBody: rejette un tableau checks vide', () => {
  const { value, error } = validateProofsVerifyBody({ checks: [] });
  assert.strictEqual(value, null);
  assert.ok(error);
  assert.match(error, /checks requis/i);
});

test('validateDocumentProofBody: convertit invoiceId vide en null', () => {
  const { value, error } = validateDocumentProofBody({
    documentId: 'DOC-1',
    fileHash: SHA256_HEX,
    filename: 'piece.pdf',
    mimeType: 'application/pdf',
    size: 42,
    invoiceId: ''
  });

  assert.strictEqual(error, null);
  assert.ok(value);
  assert.strictEqual(value.invoiceId, null);
});

test('validateDocumentIdParam / validateInvoiceIdParam: trim des params', () => {
  const doc = validateDocumentIdParam('  DOC-1  ');
  const inv = validateInvoiceIdParam('  INV-1  ');

  assert.strictEqual(doc.error, null);
  assert.strictEqual(doc.value, 'DOC-1');
  assert.strictEqual(inv.error, null);
  assert.strictEqual(inv.value, 'INV-1');
});

test('validateCleanupBody: accepte keepDocumentIds', () => {
  const { value, error } = validateCleanupBody({ keepDocumentIds: ['doc1', 'doc2'] });
  assert.strictEqual(error, null);
  assert.deepStrictEqual(value.keepDocumentIds, ['doc1', 'doc2']);
});
