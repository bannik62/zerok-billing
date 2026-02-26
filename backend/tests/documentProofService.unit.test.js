import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert';
import {
  findAllDocumentProofsByUserId,
  upsertDocumentProof,
  deleteDocumentProof,
  deleteDocumentProofsNotInList
} from '../services/documentProofService.js';
import { prisma } from '../lib/prisma.js';

afterEach(() => {
  mock.restoreAll();
});

test('findAllDocumentProofsByUserId retourne [] si userId absent', async () => {
  const out = await findAllDocumentProofsByUserId(null);
  assert.deepStrictEqual(out, []);
});

test('upsertDocumentProof utilise la clé composite userId_documentId', async () => {
  let captured;
  mock.method(prisma.documentProof, 'upsert', async (args) => {
    captured = args;
    return { id: 'dp-1' };
  });

  const out = await upsertDocumentProof({
    documentId: 'DOC-1',
    userId: 'user-1',
    fileHash: 'a'.repeat(64),
    filename: 'piece.pdf',
    mimeType: 'application/pdf',
    size: 123
  });

  assert.deepStrictEqual(out, { id: 'dp-1' });
  assert.deepStrictEqual(captured.where, {
    userId_documentId: { userId: 'user-1', documentId: 'DOC-1' }
  });
  assert.ok(captured.create.uploadedAt instanceof Date);
  assert.ok(captured.update.uploadedAt instanceof Date);
});

test('deleteDocumentProof ne fait rien si paramètres absents', async () => {
  const deleteManyMock = mock.method(prisma.documentProof, 'deleteMany', async () => ({ count: 1 }));
  await deleteDocumentProof('', 'user-1');
  await deleteDocumentProof('DOC-1', '');
  assert.strictEqual(deleteManyMock.mock.calls.length, 0);
});

test('deleteDocumentProof trim documentId et filtre par userId', async () => {
  const deleteManyMock = mock.method(prisma.documentProof, 'deleteMany', async () => ({ count: 1 }));
  await deleteDocumentProof('  DOC-1  ', 'user-1');
  assert.strictEqual(deleteManyMock.mock.calls.length, 1);
  assert.deepStrictEqual(deleteManyMock.mock.calls[0].arguments[0], {
    where: { documentId: 'DOC-1', userId: 'user-1' }
  });
});

test('deleteDocumentProofsNotInList supprime uniquement les IDs absents de keep', async () => {
  mock.method(prisma.documentProof, 'findMany', async () => [
    { documentId: 'DOC-KEEP' },
    { documentId: 'DOC-OLD-1' },
    { documentId: 'DOC-OLD-2' }
  ]);
  const deleteManyMock = mock.method(prisma.documentProof, 'deleteMany', async () => ({ count: 1 }));

  await deleteDocumentProofsNotInList('user-1', ['DOC-KEEP']);
  assert.strictEqual(deleteManyMock.mock.calls.length, 2);
  assert.deepStrictEqual(deleteManyMock.mock.calls[0].arguments[0], {
    where: { documentId: 'DOC-OLD-1', userId: 'user-1' }
  });
  assert.deepStrictEqual(deleteManyMock.mock.calls[1].arguments[0], {
    where: { documentId: 'DOC-OLD-2', userId: 'user-1' }
  });
});
