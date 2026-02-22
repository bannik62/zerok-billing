import { Router } from 'express';
import { upsertProof, findProofsByUserAndInvoiceIds, findAllProofsByUserId } from '../services/proofService.js';
import { upsertDocumentProof, findAllDocumentProofsByUserId, deleteDocumentProof, deleteDocumentProofsNotInList } from '../services/documentProofService.js';
import { error as logError } from '../lib/logger.js';
import {
  validateProofBody,
  validateProofsVerifyBody,
  validateDocumentProofBody,
  validateDocumentIdParam,
  validateCleanupBody
} from '../validators/secureValidator.js';

/**
 * Routeur des routes sécurisées (monté sous /api avec requireAuth dans server.js).
 * Stocke les preuves (hash SHA-256 reçues du client) ; aucun algorithme crypto exécuté ici.
 */
export const secureRouter = Router();

/**
 * POST /api/proofs — Enregistre une preuve d'intégrité (hash + signature) pour un document.
 * Body : { invoiceId: string, invoiceHash: string (SHA-256 hex), signature: string }
 */
secureRouter.post('/proofs', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { value, error } = validateProofBody(req.body);
    if (error) return res.status(400).json({ error });
    const { invoiceId, invoiceHash, signature } = value;

    await upsertProof({ invoiceId, userId, invoiceHash, signature });

    return res.status(201).json({ ok: true, invoiceId });
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

/**
 * POST /api/proofs/verify — Vérifie que les hash envoyés correspondent à ceux enregistrés.
 * Body : { checks: [ { invoiceId: string, invoiceHash: string }, ... ] }
 * Réponse : { results: [ { invoiceId: string, verified: boolean }, ... ] }
 */
secureRouter.post('/proofs/verify', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { value, error } = validateProofsVerifyBody(req.body);
    if (error) return res.status(400).json({ error });
    const { checks } = value;

    const ids = [...new Set(checks.map((c) => c.invoiceId).filter(Boolean))];
    const proofs = await findProofsByUserAndInvoiceIds(userId, ids);
    const hashByInvoiceId = Object.fromEntries(proofs.map((p) => [p.invoiceId, p.invoiceHash]));

    const results = checks.map((c) => {
      const id = c.invoiceId;
      const sentHash = c.invoiceHash;
      const storedHash = hashByInvoiceId[id];
      const verified = !!(id && storedHash && storedHash === sentHash);
      return { invoiceId: id, verified };
    });

    return res.json({ results });
  } catch (e) {
    logError(e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/documents/proofs — Liste les preuves documents (hash) de l'utilisateur pour comparaison local / backend.
 */
secureRouter.get('/documents/proofs', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    const documentProofs = await findAllDocumentProofsByUserId(userId);
    return res.json({ documentProofs });
  } catch (e) {
    logError(e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/documents/proof — Enregistre une preuve pour un document du coffre-fort (hash + métadonnées, pas le contenu).
 * Body : { documentId, fileHash (SHA-256 hex), filename, mimeType, size, invoiceId? }
 */
secureRouter.post('/documents/proof', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { value, error } = validateDocumentProofBody(req.body);
    if (error) return res.status(400).json({ error });

    await upsertDocumentProof({
      ...value,
      userId
    });

    return res.status(201).json({ ok: true, documentId: value.documentId });
  } catch (e) {
    logError(e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/documents/proof/:documentId — Supprime la preuve d'un document (quand le fichier est supprimé du coffre-fort).
 */
secureRouter.delete('/documents/proof/:documentId', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { value: documentId, error } = validateDocumentIdParam(req.params.documentId);
    if (error) return res.status(400).json({ error });

    await deleteDocumentProof(documentId, userId);
    return res.json({ ok: true });
  } catch (e) {
    logError(e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/documents/proofs/cleanup — Supprime les preuves orphelines (document supprimé en local mais preuve restée en BDD).
 * Body : { keepDocumentIds: string[] } — ids des documents encore présents en local.
 */
secureRouter.post('/documents/proofs/cleanup', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { value, error } = validateCleanupBody(req.body);
    if (error) return res.status(400).json({ error });

    await deleteDocumentProofsNotInList(userId, value.keepDocumentIds);
    return res.json({ ok: true });
  } catch (e) {
    logError(e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});
