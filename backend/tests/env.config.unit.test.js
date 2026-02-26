import test from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(testsDir, '..');

function runEnvModule(extraEnv = {}) {
  return spawnSync(
    process.execPath,
    [
      '-e',
      "import('./config/env.js').then(({ env }) => process.stdout.write(JSON.stringify(env)));"
    ],
    {
      cwd: backendDir,
      env: {
        ...process.env,
        ...extraEnv
      },
      encoding: 'utf8'
    }
  );
}

test('env: parse PORT/cookieSecure et origines CORS', () => {
  const run = runEnvModule({
    NODE_ENV: 'development',
    PORT: '4123',
    COOKIE_SECURE: 'true',
    FRONTEND_ORIGIN: 'https://a.example, https://b.example',
    SESSION_SECRET: 'test-secret'
  });

  assert.strictEqual(run.status, 0);
  const parsed = JSON.parse(run.stdout);
  assert.strictEqual(parsed.PORT, 4123);
  assert.strictEqual(parsed.cookieSecure, true);
  assert.strictEqual(parsed.allowedOrigins.includes('https://a.example'), true);
  assert.strictEqual(parsed.allowedOrigins.includes('https://b.example'), true);
  assert.strictEqual(parsed.allowedOrigins.includes('http://localhost:5173'), true);
  assert.strictEqual(parsed.allowedOrigins.includes('http://127.0.0.1:5173'), true);
});

test('env: fallback PORT à 3001 si valeur invalide', () => {
  const run = runEnvModule({
    NODE_ENV: 'development',
    PORT: 'not-a-number',
    SESSION_SECRET: 'test-secret'
  });

  assert.strictEqual(run.status, 0);
  const parsed = JSON.parse(run.stdout);
  assert.strictEqual(parsed.PORT, 3001);
});

test('env: en production, SESSION_SECRET vide fait échouer le chargement', () => {
  const run = runEnvModule({
    NODE_ENV: 'production',
    SESSION_SECRET: ''
  });

  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /SESSION_SECRET doit être défini/i);
});
