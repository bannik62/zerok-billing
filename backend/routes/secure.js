import { Router } from 'express';
import { upsertProof, findProofsByUserAndInvoiceIds, findAllProofsByUserId } from '../services/proofService.js';
import { error as logError } from '../lib/logger.js';

/**
 * Routeur des routes sécurisées (monté sous /api avec requireAuth dans server.js).
 * Stocke les preuves (hash SHA-256 reçues du client) ; aucun algorithme crypto exécuté ici.
 */
export const secureRouter = Router();

const INVOICE_ID_MAX = 100;
const HASH_HEX_LENGTH = 64;
const HASH_HEX_REGEX = new RegExp(`^[a-f0-9]{${HASH_HEX_LENGTH}}$`, 'i');
const SIGNATURE_MAX = 512;

/**
 * POST /api/proofs — Enregistre une preuve d'intégrité (hash + signature) pour un document.
 * Body : { invoiceId: string, invoiceHash: string (SHA-256 hex), signature: string }
 */
secureRouter.post('/proofs', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { invoiceId, invoiceHash, signature } = req.body;
    const err = [];
    if (typeof invoiceId !== 'string' || !invoiceId.trim()) err.push('invoiceId requis');
    else if (invoiceId.length > INVOICE_ID_MAX) err.push('invoiceId trop long');
    if (typeof invoiceHash !== 'string' || !invoiceHash.trim()) err.push('invoiceHash requis');
    else if (!HASH_HEX_REGEX.test(invoiceHash.trim())) {
      err.push('invoiceHash doit être un SHA-256 en hex (64 caractères)');
    }
    if (typeof signature !== 'string' || !signature.trim()) err.push('signature requise');
    else if (signature.length > SIGNATURE_MAX) err.push('signature trop longue');

    if (err.length > 0) return res.status(400).json({ error: err.join('. ') });

    const id = (invoiceId || '').trim();
    const hash = (invoiceHash || '').trim().toLowerCase();
    const sig = (signature || '').trim();

    await upsertProof({ invoiceId: id, userId, invoiceHash: hash, signature: sig });

    return res.status(201).json({ ok: true, invoiceId: id });
  } catch (e) {
    logError(e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/proofs — Liste des preuves (hash) enregistrées pour l'utilisateur (pour vérification intégrité).
 */
secureRouter.get('/proofs', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const proofs = await findAllProofsByUserId(userId);
    return res.json({ proofs });
  } catch (e) {
    logError(e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

const VERIFY_BATCH_MAX = 200;

/**
 * POST /api/proofs/verify — Vérifie que les hash envoyés correspondent à ceux enregistrés.
 * Body : { checks: [ { invoiceId: string, invoiceHash: string }, ... ] }
 * Réponse : { results: [ { invoiceId: string, verified: boolean }, ... ] }
 */
secureRouter.post('/proofs/verify', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { checks } = req.body;
    if (!Array.isArray(checks) || checks.length === 0) {
      return res.status(400).json({ error: 'checks requis (tableau non vide)' });
    }
    if (checks.length > VERIFY_BATCH_MAX) {
      return res.status(400).json({ error: `Maximum ${VERIFY_BATCH_MAX} vérifications par requête` });
    }

    const ids = [...new Set(checks.map((c) => c?.invoiceId).filter(Boolean))];
    const proofs = await findProofsByUserAndInvoiceIds(userId, ids);
    const hashByInvoiceId = Object.fromEntries(proofs.map((p) => [p.invoiceId, p.invoiceHash]));

    const results = checks.map((c) => {
      const id = typeof c.invoiceId === 'string' ? c.invoiceId.trim() : '';
      const sentHash = typeof c.invoiceHash === 'string' ? c.invoiceHash.trim().toLowerCase() : '';
      const storedHash = hashByInvoiceId[id];
      const verified = !!(
        id &&
        HASH_HEX_REGEX.test(sentHash) &&
        storedHash &&
        storedHash === sentHash
      );
      return { invoiceId: id || c.invoiceId, verified };
    });

    return res.json({ results });
  } catch (e) {
    logError(e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});
