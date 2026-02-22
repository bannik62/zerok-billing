import 'dotenv/config';
import { env } from './config/env.js';
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
import { authRouter } from './routes/auth.js';
import { secureRouter } from './routes/secure.js';

const app = express();
const PORT = env.PORT;

log('[zerok-billing] listening on port', PORT);

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
app.use(express.json({ limit: '512kb' }));

const sessionConfig = {
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'zerok.sid',
  cookie: {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
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

// CSRF : vérification du header X-CSRF-Token sur toutes les requêtes modifiantes sous /api
app.use('/api', validateCsrf);

// Route CSRF explicite (évite 404 si le routeur auth ne matche pas)
app.get('/api/auth/csrf-token', ensureCsrfToken, (req, res) => {
  const token = req.session?.csrfToken;
  log('[zerok-billing] GET /api/auth/csrf-token', {
    method: req.method,
    origin: req.headers.origin,
    cookie: req.headers.cookie ? 'présent' : 'absent',
    sessionId: req.sessionID != null ? req.sessionID : 'aucun',
    csrfToken: token ? `${token.slice(0, 8)}…` : 'absent'
  });
  res.json({ csrfToken: token });
});

// Auth : routes publiques (register, login, logout) + /me protégé par requireAuth dans le routeur
app.use('/api/auth', authRouter);

// Routes publiques sous /api (à déclarer avant le middleware /api sécurisé)
app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

// Routes sécurisées : tout ce qui est sous /api/* (sauf /api/auth et /api/health) exige une session valide
app.use('/api', requireAuth, secureRouter);

app.get('/', (_, res) => {
  res.json({ name: 'Zero-Knowledge Billing API', docs: '/api/health' });
});

app.listen(PORT, () => {
  log(`[zerok-billing] Backend listening on port ${PORT} → http://localhost:${PORT}`);
  log('[zerok-billing] Routes: GET /api/auth/csrf-token, /api/auth/me, /api/health, etc.');
});
