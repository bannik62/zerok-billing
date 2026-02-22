/**
 * Tests d'intégration : routes auth (register, login, /me).
 * Le test complet register → login → /me nécessite DATABASE_URL (sinon il est ignoré).
 * Lancement : npm test
 */
import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../app.js';

const hasDatabase = !!process.env.DATABASE_URL;
const uniqueEmail = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@example.com`;

test('GET /api/health retourne ok', async () => {
  const res = await request(app).get('/api/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body?.ok, true);
});

test('Auth : csrf-token puis register puis login puis /me', { skip: !hasDatabase }, async () => {
  const agent = request.agent(app);
  const email = uniqueEmail();
  const password = 'MotDePasse123';
  const nom = 'Dupont';
  const prenom = 'Jean';

  const csrfRes = await agent.get('/api/auth/csrf-token');
  assert.strictEqual(csrfRes.status, 200, 'csrf-token doit répondre 200');
  const csrfToken = csrfRes.body?.csrfToken;
  assert.ok(csrfToken, 'csrfToken doit être présent');

  const registerRes = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrfToken)
    .send({ email, password, nom, prenom, adresse: null });
  assert.strictEqual(registerRes.status, 201, 'register doit répondre 201');
  assert.strictEqual(registerRes.body?.email, email);
  assert.ok(registerRes.body?.id);

  const csrfRes2 = await agent.get('/api/auth/csrf-token');
  const csrfToken2 = csrfRes2.body?.csrfToken;

  const loginRes = await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken2)
    .send({ email, password });
  assert.strictEqual(loginRes.status, 200, 'login doit répondre 200');
  assert.strictEqual(loginRes.body?.email, email);

  const meRes = await agent.get('/api/auth/me');
  assert.strictEqual(meRes.status, 200);
  assert.strictEqual(meRes.body?.valid, true);
  assert.strictEqual(meRes.body?.user?.email, email);
});

test('Register sans CSRF rejeté (403)', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email: uniqueEmail(),
      password: 'MotDePasse123',
      nom: 'A',
      prenom: 'B'
    });
  assert.strictEqual(res.status, 403);
});

test('Register avec body invalide (400)', async () => {
  const agent = request.agent(app);
  const csrfRes = await agent.get('/api/auth/csrf-token');
  const csrfToken = csrfRes.body?.csrfToken;

  const res = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrfToken)
    .send({ email: 'invalid', password: 'short', nom: '', prenom: '' });
  assert.strictEqual(res.status, 400);
  assert.ok(res.body?.error);
});
