/**
 * Variables d'environnement centralisées.
 * Seul ce fichier lit process.env ; le reste du backend utilise env.
 * À charger après dotenv (ex. import 'dotenv/config' en tête de server.js).
 */

const DEV_SESSION_SECRET = 'dev-secret-change-in-prod';

function getEnv(key, defaultValue = undefined) {
  const v = process.env[key];
  return v !== undefined && v !== '' ? v : defaultValue;
}

const NODE_ENV = getEnv('NODE_ENV');
const isProduction = NODE_ENV === 'production';

if (isProduction) {
  const secret = getEnv('SESSION_SECRET');
  if (!secret || secret === DEV_SESSION_SECRET) {
    process.stderr.write(
      '[zerok-billing] En production, SESSION_SECRET doit être défini et différent du secret de dev.\n'
    );
    process.exit(1);
  }
}

const PORT = Number(getEnv('PORT')) || 3001;

const rawOrigins = getEnv('FRONTEND_ORIGIN', 'http://localhost:5173');
const allowedOrigins = rawOrigins
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
if (!allowedOrigins.includes('http://127.0.0.1:5173')) allowedOrigins.push('http://127.0.0.1:5173');
if (!allowedOrigins.includes('http://localhost:5173')) allowedOrigins.push('http://localhost:5173');

const cookieSecure = getEnv('COOKIE_SECURE') === 'true';

const DATABASE_URL = getEnv('DATABASE_URL') || null;

const SESSION_SECRET = getEnv('SESSION_SECRET') || DEV_SESSION_SECRET;

export const env = Object.freeze({
  NODE_ENV,
  isProduction,
  PORT,
  SESSION_SECRET,
  allowedOrigins,
  cookieSecure,
  DATABASE_URL
});
