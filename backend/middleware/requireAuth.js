import { prisma } from '../lib/prisma.js';

/**
 * Vérifie que la session contient un userId et charge l'utilisateur.
 * Attache req.user (sans passwordHash). Sinon 401.
 */
export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  prisma.user
    .findUnique({
      where: { id: req.session.userId },
      select: { id: true, email: true, nom: true, prenom: true, adresse: true }
    })
    .then((user) => {
      if (!user) {
        return res.status(401).json({ error: 'Session invalide' });
      }
      req.user = user;
      next();
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Erreur serveur' });
    });
}
