import { error as logError } from '../lib/logger.js';

/**
 * Middleware de gestion d'erreurs global.
 * À monter en dernier. Les routes font next(err) pour transmettre une erreur.
 * Log l'erreur et renvoie un JSON cohérent { error: string }.
 */
export function errorHandler(err, req, res, next) {
  logError(err);

  const status = err.status ?? err.statusCode ?? 500;
  const code = Number(status);
  const message = code === 404 ? 'Ressource non trouvée' : (code >= 500 ? 'Erreur serveur' : (err.message || 'Erreur'));

  if (!res.headersSent) {
    res.status(code).json({ error: message });
  }
}
