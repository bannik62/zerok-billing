import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { requireAuth } from '../middleware/requireAuth.js';
import { prisma } from '../lib/prisma.js';

afterEach(() => {
  mock.restoreAll();
});

function runRequireAuth(req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        resolve({ req, res: this, nextCalled: false, nextArg: undefined });
        return this;
      }
    };

    requireAuth(req, res, (err) => {
      resolve({ req, res, nextCalled: true, nextArg: err });
    });
  });
}

test('requireAuth: refuse si session absente', async () => {
  const out = await runRequireAuth({});
  assert.strictEqual(out.nextCalled, false);
  assert.strictEqual(out.res.statusCode, 401);
  assert.deepStrictEqual(out.res.body, { error: 'Non authentifié' });
});

test('requireAuth: refuse si utilisateur introuvable', async () => {
  mock.method(prisma.user, 'findUnique', async () => null);

  const out = await runRequireAuth({ session: { userId: 'u-1' } });
  assert.strictEqual(out.nextCalled, false);
  assert.strictEqual(out.res.statusCode, 401);
  assert.deepStrictEqual(out.res.body, { error: 'Session invalide' });
});

test('requireAuth: attache req.user puis appelle next si session valide', async () => {
  const user = { id: 'u-1', email: 'user@example.com', nom: 'Dupont', prenom: 'Jean', adresse: null };
  mock.method(prisma.user, 'findUnique', async () => user);

  const req = { session: { userId: 'u-1' } };
  const out = await runRequireAuth(req);
  assert.strictEqual(out.nextCalled, true);
  assert.strictEqual(out.nextArg, undefined);
  assert.deepStrictEqual(req.user, user);
});

test('requireAuth: propage l’erreur vers next en cas d’exception service', async () => {
  const failure = new Error('db unavailable');
  mock.method(prisma.user, 'findUnique', async () => {
    throw failure;
  });

  const out = await runRequireAuth({ session: { userId: 'u-1' } });
  assert.strictEqual(out.nextCalled, true);
  assert.strictEqual(out.nextArg, failure);
});
