import test from 'node:test';
import assert from 'node:assert';
import { ensureCsrfToken, validateCsrf } from '../middleware/csrf.js';

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test('ensureCsrfToken: crée un token si absent', () => {
  const req = { session: {} };
  const res = createRes();
  let nextCalled = false;

  ensureCsrfToken(req, res, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, true);
  assert.ok(typeof req.session.csrfToken === 'string');
  assert.match(req.session.csrfToken, /^[a-f0-9]{64}$/);
});

test('ensureCsrfToken: réutilise le token existant', () => {
  const req = { session: { csrfToken: 'fixed-token' } };
  const res = createRes();
  ensureCsrfToken(req, res, () => {});
  assert.strictEqual(req.session.csrfToken, 'fixed-token');
});

test('validateCsrf: laisse passer les méthodes safe', () => {
  const req = { method: 'GET', session: {}, headers: {}, path: '/any' };
  const res = createRes();
  let nextCalled = false;

  validateCsrf(req, res, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.statusCode, 200);
});

test('validateCsrf: refuse POST sans token session', () => {
  const req = { method: 'POST', session: {}, headers: {}, path: '/api/test' };
  const res = createRes();
  let nextCalled = false;

  validateCsrf(req, res, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 403);
  assert.match(res.body?.error || '', /Token CSRF absent/i);
});

test('validateCsrf: refuse POST avec token différent', () => {
  const req = {
    method: 'POST',
    session: { csrfToken: 'token-a' },
    headers: { 'x-csrf-token': 'token-b' },
    path: '/api/test'
  };
  const res = createRes();
  let nextCalled = false;

  validateCsrf(req, res, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 403);
  assert.match(res.body?.error || '', /Token CSRF invalide/i);
});

test('validateCsrf: accepte POST avec token identique', () => {
  const req = {
    method: 'POST',
    session: { csrfToken: 'same-token' },
    headers: { 'x-csrf-token': 'same-token' },
    path: '/api/test'
  };
  const res = createRes();
  let nextCalled = false;

  validateCsrf(req, res, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.statusCode, 200);
});
