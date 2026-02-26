import test, { afterEach } from 'node:test';
import assert from 'node:assert';
import {
  findUserByEmail,
  findUserById,
  createUser,
  updateRecoveryData,
  updatePasswordByEmail,
  getRecoveryDataByEmail
} from '../services/userService.js';
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

test('findUserByEmail appelle prisma.user.findUnique avec email', async () => {
  let captured;
  stubMethod(prisma.user, 'findUnique', async (args) => {
    captured = args;
    return { id: 'u-1' };
  });

  const out = await findUserByEmail('user@example.com');
  assert.deepStrictEqual(out, { id: 'u-1' });
  assert.deepStrictEqual(captured, { where: { email: 'user@example.com' } });
});

test('findUserById sélectionne les champs publics + recovery', async () => {
  let captured;
  stubMethod(prisma.user, 'findUnique', async (args) => {
    captured = args;
    return { id: 'u-1', email: 'user@example.com' };
  });

  await findUserById('u-1');
  assert.strictEqual(captured.where.id, 'u-1');
  assert.strictEqual(captured.select.id, true);
  assert.strictEqual(captured.select.emailVerified, true);
  assert.strictEqual(captured.select.recoverySalt, true);
});

test('createUser appelle prisma.user.create avec data', async () => {
  let captured;
  stubMethod(prisma.user, 'create', async (args) => {
    captured = args;
    return { id: 'u-1' };
  });

  const payload = { email: 'user@example.com', passwordHash: 'hash' };
  const out = await createUser(payload);
  assert.deepStrictEqual(out, { id: 'u-1' });
  assert.deepStrictEqual(captured, { data: payload });
});

test('updateRecoveryData persiste salt + keyCheck', async () => {
  let captured;
  stubMethod(prisma.user, 'update', async (args) => {
    captured = args;
    return { id: 'u-1' };
  });

  await updateRecoveryData('u-1', { salt: 'salt', keyCheck: { payload: 'p', iv: 'i' } });
  assert.strictEqual(captured.where.id, 'u-1');
  assert.deepStrictEqual(captured.data, {
    recoverySalt: 'salt',
    recoveryKeyCheck: { payload: 'p', iv: 'i' }
  });
});

test('updatePasswordByEmail met à jour passwordHash', async () => {
  let captured;
  stubMethod(prisma.user, 'update', async (args) => {
    captured = args;
    return { id: 'u-1' };
  });

  await updatePasswordByEmail('user@example.com', 'new-hash');
  assert.deepStrictEqual(captured, {
    where: { email: 'user@example.com' },
    data: { passwordHash: 'new-hash' }
  });
});

test('getRecoveryDataByEmail retourne null si user introuvable', async () => {
  stubMethod(prisma.user, 'findUnique', async () => null);
  const out = await getRecoveryDataByEmail('missing@example.com');
  assert.strictEqual(out, null);
});
