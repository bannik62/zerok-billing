import test, { afterEach } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import { secureRouter } from '../routes/secure.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

const restorers = [];

afterEach(() => {
  while (restorers.length > 0) {
    const restore = restorers.pop();
    restore();
  }
});

function stubMethod(target, methodName, implementation) {
  const original = target[methodName];
  const calls = [];
  target[methodName] = (...args) => {
    calls.push(args);
    return implementation(...args);
  };
  restorers.push(() => {
    target[methodName] = original;
  });
  return { calls };
}

function createSecureApp(user = { id: 'user-1' }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use('/api', secureRouter);
  app.use(errorHandler);
  return app;
}

const app = createSecureApp();

test('GET /api/proofs renvoie les preuves de l’utilisateur', async () => {
  const signedAt = new Date('2026-01-01T00:00:00.000Z');
  stubMethod(prisma.proof, 'findMany', async () => [
    { invoiceId: 'INV-1', invoiceHash: 'a'.repeat(64), signedAt }
  ]);

  const res = await request(app).get('/api/proofs');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(Array.isArray(res.body?.proofs), true);
  assert.strictEqual(res.body.proofs[0].invoiceId, 'INV-1');
});

test('POST /api/proofs valide enregistre et retourne 201', async () => {
  const upsertMock = stubMethod(prisma.proof, 'upsert', async () => ({ id: 'p-1' }));

  const res = await request(app)
    .post('/api/proofs')
    .send({
      invoiceId: 'INV-2',
      invoiceHash: 'b'.repeat(64),
      signature: 'sig'
    });

  assert.strictEqual(res.status, 201);
  assert.deepStrictEqual(res.body, { ok: true, invoiceId: 'INV-2' });
  assert.strictEqual(upsertMock.calls.length, 1);
});

test('POST /api/proofs invalide retourne 400 sans appel service', async () => {
  const upsertMock = stubMethod(prisma.proof, 'upsert', async () => ({ id: 'p-1' }));

  const res = await request(app)
    .post('/api/proofs')
    .send({
      invoiceId: 'INV-3',
      invoiceHash: 'invalid-hash',
      signature: 'sig'
    });

  assert.strictEqual(res.status, 400);
  assert.ok(res.body?.error);
  assert.strictEqual(upsertMock.calls.length, 0);
});

test('GET /api/proofs retourne 500 si le service échoue', async () => {
  stubMethod(prisma.proof, 'findMany', async () => {
    throw new Error('db down');
  });

  const res = await request(app).get('/api/proofs');
  assert.strictEqual(res.status, 500);
  assert.deepStrictEqual(res.body, { error: 'Erreur serveur' });
});

test('POST /api/documents/proof valide retourne 201', async () => {
  const upsertMock = stubMethod(prisma.documentProof, 'upsert', async () => ({ id: 'd-1' }));

  const res = await request(app)
    .post('/api/documents/proof')
    .send({
      documentId: 'DOC-1',
      fileHash: 'c'.repeat(64),
      filename: 'piece.pdf',
      mimeType: 'application/pdf',
      size: 1234,
      invoiceId: 'INV-1'
    });

  assert.strictEqual(res.status, 201);
  assert.deepStrictEqual(res.body, { ok: true, documentId: 'DOC-1' });
  assert.strictEqual(upsertMock.calls.length, 1);
});

test('POST /api/documents/proofs/cleanup supprime uniquement les orphelines', async () => {
  stubMethod(prisma.documentProof, 'findMany', async () => [
    { documentId: 'DOC-KEEP' },
    { documentId: 'DOC-OLD' }
  ]);
  const deleteManyMock = stubMethod(prisma.documentProof, 'deleteMany', async () => ({ count: 1 }));

  const res = await request(app)
    .post('/api/documents/proofs/cleanup')
    .send({ keepDocumentIds: ['DOC-KEEP'] });

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, { ok: true });
  assert.strictEqual(deleteManyMock.calls.length, 1);
  const arg = deleteManyMock.calls[0][0];
  assert.deepStrictEqual(arg.where, { documentId: 'DOC-OLD', userId: 'user-1' });
});

test('POST /api/documents/proof retourne 500 si service échoue', async () => {
  stubMethod(prisma.documentProof, 'upsert', async () => {
    throw new Error('db down');
  });

  const res = await request(app)
    .post('/api/documents/proof')
    .send({
      documentId: 'DOC-2',
      fileHash: 'd'.repeat(64),
      filename: 'piece.pdf',
      mimeType: 'application/pdf',
      size: 42
    });

  assert.strictEqual(res.status, 500);
  assert.deepStrictEqual(res.body, { error: 'Erreur serveur' });
});
