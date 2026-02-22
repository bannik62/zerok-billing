/**
 * Application Express (création et montage des middlewares/routes).
 * Exportée pour les tests (supertest) ; server.js l'importe et appelle app.listen().
 */
import 'dotenv/config';
import { env } from './config/env.js';
import { SESSION_COOKIE_MAX_AGE_MS, JSON_BODY_LIMIT } from './config/constants.js';
import { log } from './lib/logger.js';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import pg from 'pg';
import connectPgSimple from 'connect-pg-simple';
import { requireAuth } from './middleware/requireAuth.js';
import { validateCsrf, ensureCsrfToken } from './middleware/csrf.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { secureRouter } from './routes/secure.js';
import { prisma } from './lib/prisma.js';

export const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (env.allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origin not allowed'));
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: JSON_BODY_LIMIT }));

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

app.use(session(sessionConfig));

app.use('/api', validateCsrf);

app.get('/api/auth/csrf-token', ensureCsrfToken, (req, res) => {
  res.json({ csrfToken: req.session?.csrfToken });
});

app.use('/api/auth', authRouter);

app.get('/api/health', async (_req, res) => {
  const payload = { ok: true };
  if (!env.DATABASE_URL) {
    payload.db = 'none';
    return res.json(payload);
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    payload.db = 'ok';
  } catch (e) {
    log('[zerok-billing] healthcheck DB:', e?.message ?? e);
    payload.db = 'unavailable';
  }
  res.json(payload);
});

app.use('/api', requireAuth, secureRouter);

app.get('/', (_, res) => {
  res.json({ name: 'Zero-Knowledge Billing API', docs: '/api/health' });
});

app.use((_req, _res, next) => {
  next(Object.assign(new Error('Not Found'), { status: 404 }));
});

app.use(errorHandler);
