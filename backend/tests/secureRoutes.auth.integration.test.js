import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../app.js';

test('GET /api/proofs sans session renvoie 401', async () => {
  const res = await request(app).get('/api/proofs');
  assert.strictEqual(res.status, 401);
  assert.ok(res.body?.error);
});

test('GET /api/documents/proofs sans session renvoie 401', async () => {
  const res = await request(app).get('/api/documents/proofs');
  assert.strictEqual(res.status, 401);
  assert.ok(res.body?.error);
});

test('POST /api/proofs sans CSRF renvoie 403', async () => {
  const res = await request(app)
    .post('/api/proofs')
    .send({
      invoiceId: 'INV-001',
      invoiceHash: 'a'.repeat(64),
      signature: 'sig'
    });
  assert.strictEqual(res.status, 403);
  assert.ok(res.body?.error);
});

test('POST /api/proofs avec CSRF mais sans session authentifiée renvoie 401', async () => {
  const agent = request.agent(app);
  const csrf = await agent.get('/api/auth/csrf-token');
  const token = csrf.body?.csrfToken;
  assert.ok(token);

  const res = await agent
    .post('/api/proofs')
    .set('X-CSRF-Token', token)
    .send({
      invoiceId: 'INV-001',
      invoiceHash: 'a'.repeat(64),
      signature: 'sig'
    });

  assert.strictEqual(res.status, 401);
  assert.ok(res.body?.error);
});

test('DELETE /api/proofs/:invoiceId avec CSRF mais sans session authentifiée renvoie 401', async () => {
  const agent = request.agent(app);
  const csrf = await agent.get('/api/auth/csrf-token');
  const token = csrf.body?.csrfToken;
  assert.ok(token);

  const res = await agent
    .delete('/api/proofs/INV-001')
    .set('X-CSRF-Token', token);

  assert.strictEqual(res.status, 401);
  assert.ok(res.body?.error);
});
