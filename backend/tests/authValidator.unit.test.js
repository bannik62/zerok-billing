import test from 'node:test';
import assert from 'node:assert';
import { validateRegister, validateLogin } from '../validators/authValidator.js';

test('validateRegister: normalize les champs valides', () => {
  const input = {
    email: '  user@example.com  ',
    password: 'MotDePasse123',
    nom: '  Dupont  ',
    prenom: '  Jean  ',
    adresse: '   '
  };

  const { value, error } = validateRegister(input);
  assert.strictEqual(error, null);
  assert.ok(value);
  assert.strictEqual(value.email, 'user@example.com');
  assert.strictEqual(value.nom, 'Dupont');
  assert.strictEqual(value.prenom, 'Jean');
  assert.strictEqual(value.adresse, null);
});

test('validateRegister: rejette plusieurs erreurs de payload', () => {
  const input = {
    email: 'email-invalide',
    password: 'short',
    nom: '',
    prenom: ''
  };

  const { value, error } = validateRegister(input);
  assert.strictEqual(value, null);
  assert.ok(typeof error === 'string' && error.length > 0);
  assert.match(error, /format email invalide/i);
  assert.match(error, /mot de passe minimum/i);
  assert.match(error, /nom requis/i);
  assert.match(error, /prenom requis/i);
});

test('validateLogin: conserve les champs attendus et ignore les inconnus', () => {
  const input = {
    email: ' user@example.com ',
    password: 'MotDePasse123',
    injected: 'x'
  };

  const { value, error } = validateLogin(input);
  assert.strictEqual(error, null);
  assert.ok(value);
  assert.strictEqual(value.email, 'user@example.com');
  assert.strictEqual(value.password, 'MotDePasse123');
  assert.strictEqual(Object.hasOwn(value, 'injected'), false);
});

test('validateLogin: rejette un mot de passe trop long', () => {
  const tooLongPassword = 'x'.repeat(129);
  const { value, error } = validateLogin({
    email: 'user@example.com',
    password: tooLongPassword
  });

  assert.strictEqual(value, null);
  assert.ok(error);
  assert.match(error, /mot de passe trop long/i);
});
