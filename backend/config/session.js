/**
 * Configuration des sessions Express.
 * Centralise la config cookie, le store (mémoire ou PostgreSQL) et le secret.
 * Responsabilité unique : tout ce qui concerne express-session.
 */

import session from 'express-session';
import pg from 'pg';
import connectPgSimple from 'connect-pg-simple';
import { env } from './env.js';
import { SESSION_COOKIE_MAX_AGE_MS } from './constants.js';
import { log } from '../lib/logger.js';

/**
 * Retourne le middleware express-session configuré.
 * Store : PostgreSQL si DATABASE_URL défini, sinon MemoryStore.
 */
export function configureSession() {
  const sessionConfig = {
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'zerok.sid',
    cookie: {
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
      path: '/'
    }
  };

  if (env.DATABASE_URL) {
    const PgSession = connectPgSimple(session);
    const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
    sessionConfig.store = new PgSession({ pool, createTableIfMissing: true });
    log('[zerok-billing] Sessions: store PostgreSQL (table session)');
  } else {
    log('[zerok-billing] Sessions: MemoryStore (DATABASE_URL non défini)');
  }

  return session(sessionConfig);
}
