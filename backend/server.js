import 'dotenv/config';
import { log } from './lib/logger.js';

const DEV_SESSION_SECRET = 'dev-secret-change-in-prod';
if (process.env.NODE_ENV === 'production') {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret === DEV_SESSION_SECRET) {
    // Message critique au démarrage (avant logger)
    process.stderr.write('[zerok-billing] En production, SESSION_SECRET doit être défini et différent du secret de dev.\n');
    process.exit(1);
  }
}

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
const PORT = Number(process.env.PORT) || 3001;

log('[zerok-billing] PORT from env:', process.env.PORT, '→ listening on', PORT);

app.set('trust proxy', 1);

app.use(helmet());

const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
if (!allowedOrigins.includes('http://127.0.0.1:5173')) allowedOrigins.push('http://127.0.0.1:5173');
if (!allowedOrigins.includes('http://localhost:5173')) allowedOrigins.push('http://localhost:5173');

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origin not allowed'));
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '512kb' }));

const sessionConfig = {
  secret: process.env.SESSION_SECRET || DEV_SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'zerok.sid',
  cookie: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  }
};

if (process.env.DATABASE_URL) {
  const PgSession = connectPgSimple(session);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
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
