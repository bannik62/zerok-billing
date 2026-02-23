/**
 * Routes publiques liées à la récupération (wordlist pour phrase de récupération).
 * Pas d'authentification : la wordlist est nécessaire avant connexion pour générer la phrase côté client.
 */
import { Router } from 'express';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORDLIST_PATH = join(__dirname, '..', 'worldlist', '.worldlist.json');

export const recoveryRouter = Router();

/**
 * GET /api/recovery/wordlist
 * Retourne la liste de mots (JSON array) pour génération de la phrase côté client.
 */
recoveryRouter.get('/wordlist', async (_req, res, next) => {
  try {
    const raw = await readFile(WORDLIST_PATH, 'utf8');
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) {
      return res.status(500).json({ error: 'Wordlist invalide' });
    }
    res.json(list);
  } catch (e) {
    next(e);
  }
});
