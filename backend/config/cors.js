/**
 * Configuration CORS.
 * Responsabilité unique : politique d'origine pour les requêtes cross-origin.
 * Note : les requêtes same-origin (frontend + API même domaine) n'envoient pas Origin,
 * donc on accepte !origin pour ne pas casser ce cas (ex. billing.zerok.vitalinfo.site).
 */
import { env } from './env.js';

export const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (env.allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origin not allowed'));
  },
  credentials: true
};
