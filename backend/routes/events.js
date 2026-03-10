import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

/**
 * Routeur des événements serveur → client (SSE).
 * Utilisé pour notifier les clients connectés (ex. mise à jour du backup multiposte).
 */
export const eventsRouter = Router();

/**
 * Connexions SSE par utilisateur.
 * Map userId -> Set<res>
 */
const clientsByUserId = new Map();

eventsRouter.get('/events', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    // Headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Flush headers
    res.flushHeaders?.();

    // Enregistrer le client
    let set = clientsByUserId.get(userId);
    if (!set) {
      set = new Set();
      clientsByUserId.set(userId, set);
    }
    set.add(res);

    // Optionnel : envoyer un event initial
    res.write('event: connected\n');
    res.write('data: {}\n\n');

    req.on('close', () => {
      const current = clientsByUserId.get(userId);
      if (current) {
        current.delete(res);
        if (current.size === 0) {
          clientsByUserId.delete(userId);
        }
      }
      res.end();
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Notifie tous les clients connectés qu'un backup a été mis à jour pour cet utilisateur.
 * Utilisé par PUT /api/backup.
 * @param {string} userId
 */
export function notifyBackupUpdated(userId) {
  const set = clientsByUserId.get(userId);
  if (!set || set.size === 0) return;
  for (const res of set) {
    try {
      res.write('event: backupUpdated\n');
      res.write('data: {}\n\n');
    } catch {
      // En cas d'erreur d'écriture, on laisse la connexion se fermer côté client.
    }
  }
}

