import crypto from 'crypto';
import { log } from '../lib/logger.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_TOKEN_BYTES = 32;

/**
 * Génère ou réutilise un token CSRF dans la session.
 * À appeler dans la route GET /api/auth/csrf-token.
 */
export function ensureCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(CSRF_TOKEN_BYTES).toString('hex');
    log('[zerok-billing] CSRF: nouveau token créé pour la session');
  } else {
    log('[zerok-billing] CSRF: token existant réutilisé');
  }
  next();
}

/**
 * Vérifie le header X-CSRF-Token pour les requêtes modifiantes (POST, PUT, PATCH, DELETE).
 * Si la session a un csrfToken, le header doit être présent et identique.
 */
export function validateCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }
  const sessionToken = req.session?.csrfToken;
  const headerToken = req.headers['x-csrf-token'];
  log('[zerok-billing] CSRF validate', { method: req.method, path: req.path, hasSessionToken: !!sessionToken, hasHeaderToken: !!headerToken });
  if (!sessionToken) {
    log('[zerok-billing] CSRF refusé: pas de token en session');
    return res.status(403).json({ error: 'Token CSRF absent (obtenir via GET /api/auth/csrf-token)' });
  }
  if (!headerToken || headerToken !== sessionToken) {
    log('[zerok-billing] CSRF refusé: header manquant ou différent du token session');
    return res.status(403).json({ error: 'Token CSRF invalide ou manquant' });
  }
  next();
}
