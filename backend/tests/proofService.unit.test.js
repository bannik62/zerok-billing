import test, { afterEach } from 'node:test';
import assert from 'node:assert';
import {
  upsertProof,
  findProofsByUserAndInvoiceIds,
  findAllProofsByUserId,
  deleteProofByUserIdAndInvoiceId
} from '../services/proofService.js';
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
  target[methodName] = (...args) => implementation(...args);
  restorers.push(() => {
    target[methodName] = original;
  });
}

test('upsertProof utilise la clé composite userId_invoiceId', async () => {
  let captured;
  stubMethod(prisma.proof, 'upsert', async (args) => {
    captured = args;
    return { id: 'p-1' };
  });

  const out = await upsertProof({
    invoiceId: 'INV-1',
    userId: 'user-1',
    invoiceHash: 'a'.repeat(64),
    signature: 'sig'
  });

  assert.deepStrictEqual(out, { id: 'p-1' });
  assert.deepStrictEqual(captured.where, {
    userId_invoiceId: { userId: 'user-1', invoiceId: 'INV-1' }
  });
  assert.ok(captured.create.signedAt instanceof Date);
  assert.ok(captured.update.signedAt instanceof Date);
});

test('findProofsByUserAndInvoiceIds filtre par user + ids', async () => {
  let captured;
  stubMethod(prisma.proof, 'findMany', async (args) => {
    captured = args;
    return [];
  });

  await findProofsByUserAndInvoiceIds('user-1', ['INV-1', 'INV-2']);
  assert.deepStrictEqual(captured.where, {
    userId: 'user-1',
    invoiceId: { in: ['INV-1', 'INV-2'] }
  });
  assert.deepStrictEqual(captured.select, { invoiceId: true, invoiceHash: true });
});

test('findAllProofsByUserId ordonne par signedAt desc', async () => {
  let captured;
  stubMethod(prisma.proof, 'findMany', async (args) => {
    captured = args;
    return [];
  });

  await findAllProofsByUserId('user-1');
  assert.deepStrictEqual(captured.where, { userId: 'user-1' });
  assert.deepStrictEqual(captured.orderBy, { signedAt: 'desc' });
});

test('deleteProofByUserIdAndInvoiceId retourne true si au moins un delete', async () => {
  stubMethod(prisma.proof, 'deleteMany', async () => ({ count: 1 }));
  const out = await deleteProofByUserIdAndInvoiceId('user-1', 'INV-1');
  assert.strictEqual(out, true);
});

test('deleteProofByUserIdAndInvoiceId retourne false si rien supprimé', async () => {
  stubMethod(prisma.proof, 'deleteMany', async () => ({ count: 0 }));
  const out = await deleteProofByUserIdAndInvoiceId('user-1', 'INV-1');
  assert.strictEqual(out, false);
});
