import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../app.js';

test('GET /api/auth/csrf-token retourne un token réutilisé sur même session', async () => {
  const agent = request.agent(app);

  const first = await agent.get('/api/auth/csrf-token');
  assert.strictEqual(first.status, 200);
  assert.ok(first.body?.csrfToken);

  const second = await agent.get('/api/auth/csrf-token');
  assert.strictEqual(second.status, 200);
  assert.ok(second.body?.csrfToken);
  assert.strictEqual(second.body.csrfToken, first.body.csrfToken);
});

test('GET /api/auth/me sans session renvoie 401', async () => {
  const res = await request(app).get('/api/auth/me');
  assert.strictEqual(res.status, 401);
  assert.ok(res.body?.error);
});

test('POST /api/auth/logout sans session active renvoie un JSON cohérent', async () => {
  const agent = request.agent(app);
  const csrf = await agent.get('/api/auth/csrf-token');
  const token = csrf.body?.csrfToken;

  const res = await agent.post('/api/auth/logout').set('X-CSRF-Token', token).send({});
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, { ok: true });
});
