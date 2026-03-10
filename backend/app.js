/**
 * Application Express (création et montage des middlewares/routes).
 * Exportée pour les tests (supertest) ; server.js l'importe et appelle app.listen().
 */
import 'dotenv/config';
import { configureSession } from './config/session.js';
import { corsOptions } from './config/cors.js';
import { JSON_BODY_LIMIT } from './config/constants.js';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { requireAuth } from './middleware/requireAuth.js';
import { validateCsrf, ensureCsrfToken } from './middleware/csrf.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { recoveryRouter } from './routes/recovery.js';
import { secureRouter } from './routes/secure.js';
import { publicRouter } from './routes/public.js';
import { healthRouter } from './routes/health.js';
import { webhooksRouter } from './routes/webhooks.js';
import { eventsRouter } from './routes/events.js';

export const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors(corsOptions));
app.use(cookieParser());

app.use('/webhooks', webhooksRouter);

app.use(express.json({ limit: JSON_BODY_LIMIT }));

app.use(configureSession());

app.use(publicRouter);

app.use('/api', validateCsrf);

app.get('/api/auth/csrf-token', ensureCsrfToken, (req, res) => {
  res.json({ csrfToken: req.session?.csrfToken });
});

app.use('/api/auth', authRouter);
app.use('/api/recovery', recoveryRouter);

app.use(healthRouter);

// SSE events (auth requis)
app.use('/api', requireAuth, eventsRouter);

app.use('/api', requireAuth, secureRouter);

app.use((_req, _res, next) => {
  next(Object.assign(new Error('Not Found'), { status: 404 }));
});

app.use(errorHandler);
