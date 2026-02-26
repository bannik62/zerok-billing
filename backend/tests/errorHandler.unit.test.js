import test from 'node:test';
import assert from 'node:assert';
import { errorHandler } from '../middleware/errorHandler.js';

function createRes(headersSent = false) {
  return {
    headersSent,
    statusCode: null,
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

test('errorHandler: mappe 404 vers message standard', () => {
  const res = createRes(false);
  errorHandler({ status: 404, message: 'nope' }, {}, res, () => {});
  assert.strictEqual(res.statusCode, 404);
  assert.deepStrictEqual(res.body, { error: 'Ressource non trouvée' });
});

test('errorHandler: conserve le message pour erreurs 4xx', () => {
  const res = createRes(false);
  errorHandler({ status: 400, message: 'Payload invalide' }, {}, res, () => {});
  assert.strictEqual(res.statusCode, 400);
  assert.deepStrictEqual(res.body, { error: 'Payload invalide' });
});

test('errorHandler: masque les détails en 5xx', () => {
  const res = createRes(false);
  errorHandler({ status: 500, message: 'Stacktrace interne' }, {}, res, () => {});
  assert.strictEqual(res.statusCode, 500);
  assert.deepStrictEqual(res.body, { error: 'Erreur serveur' });
});

test('errorHandler: ne répond pas si headers déjà envoyés', () => {
  const res = createRes(true);
  errorHandler({ status: 400, message: 'x' }, {}, res, () => {});
  assert.strictEqual(res.statusCode, null);
  assert.strictEqual(res.body, null);
});
