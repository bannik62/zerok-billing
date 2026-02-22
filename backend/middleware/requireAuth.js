import { findUserById } from '../services/userService.js';

/**
 * Vérifie que la session contient un userId et charge l'utilisateur.
 * Attache req.user (sans passwordHash). Sinon 401.
 */
export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  findUserById(req.session.userId)
    .then((user) => {
      if (!user) {
        return res.status(401).json({ error: 'Session invalide' });
      }
      req.user = user;
      next();
    })
    .catch(next);
}
