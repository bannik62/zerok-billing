import { Router } from 'express';
import { upsertProof, findProofsByUserAndInvoiceIds, findAllProofsByUserId, deleteProofByUserIdAndInvoiceId } from '../services/proofService.js';
import { upsertDocumentProof, findAllDocumentProofsByUserId, deleteDocumentProof, deleteDocumentProofsNotInList } from '../services/documentProofService.js';
import {
  validateProofBody,
  validateProofsVerifyBody,
  validateDocumentProofBody,
  validateDocumentIdParam,
  validateInvoiceIdParam,
  validateCleanupBody,
  validateSendForSignatureBody
} from '../validators/secureValidator.js';
import { sendMail } from '../services/emailService.js';
import { createSignRequest, getSignedInvoiceIds } from '../services/signRequestService.js';
import { env } from '../config/env.js';

/**
 * Routeur des routes sécurisées (monté sous /api avec requireAuth dans server.js).
 * Stocke les preuves (hash SHA-256 reçues du client) ; aucun algorithme crypto exécuté ici.
 */
export const secureRouter = Router();

/**
 * POST /api/proofs — Enregistre une preuve d'intégrité (hash + signature) pour un document.
 * Body : { invoiceId: string, invoiceHash: string (SHA-256 hex), signature: string }
 */
secureRouter.post('/proofs', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { value, error } = validateProofBody(req.body);
    if (error) return res.status(400).json({ error });
    const { invoiceId, invoiceHash, signature } = value;

    await upsertProof({ invoiceId, userId, invoiceHash, signature });

    return res.status(201).json({ ok: true, invoiceId });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/proofs — Liste des preuves (hash) enregistrées pour l'utilisateur (pour vérification intégrité).
 */
secureRouter.get('/proofs', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const proofs = await findAllProofsByUserId(userId);
    return res.json({ proofs });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/proofs/verify — Vérifie que les hash envoyés correspondent à ceux enregistrés.
 * Body : { checks: [ { invoiceId: string, invoiceHash: string }, ... ] }
 * Réponse : { results: [ { invoiceId: string, verified: boolean }, ... ] }
 */
secureRouter.post('/proofs/verify', async (req, res, next) => {
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
    next(e);
  }
});

/**
 * DELETE /api/proofs/:invoiceId — Supprime la preuve d'un devis/facture (double suppression ou filet orphelins).
 */
secureRouter.delete('/proofs/:invoiceId', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { value: invoiceId, error } = validateInvoiceIdParam(req.params.invoiceId);
    if (error) return res.status(400).json({ error });

    const deleted = await deleteProofByUserIdAndInvoiceId(userId, invoiceId);
    return res.json({ ok: true, deleted });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/documents/proofs — Liste les preuves documents (hash) de l'utilisateur pour comparaison local / backend.
 */
secureRouter.get('/documents/proofs', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    const documentProofs = await findAllDocumentProofsByUserId(userId);
    return res.json({ documentProofs });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/documents/proof — Enregistre une preuve pour un document du coffre-fort (hash + métadonnées, pas le contenu).
 * Body : { documentId, fileHash (SHA-256 hex), filename, mimeType, size, invoiceId? }
 */
secureRouter.post('/documents/proof', async (req, res, next) => {
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
    next(e);
  }
});

/**
 * DELETE /api/documents/proof/:documentId — Supprime la preuve d'un document (quand le fichier est supprimé du coffre-fort).
 */
secureRouter.delete('/documents/proof/:documentId', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { value: documentId, error } = validateDocumentIdParam(req.params.documentId);
    if (error) return res.status(400).json({ error });

    await deleteDocumentProof(documentId, userId);
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/documents/proofs/cleanup — Supprime les preuves orphelines (document supprimé en local mais preuve restée en BDD).
 * Body : { keepDocumentIds: string[] } — ids des documents encore présents en local.
 */
secureRouter.post('/documents/proofs/cleanup', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { value, error } = validateCleanupBody(req.body);
    if (error) return res.status(400).json({ error });

    await deleteDocumentProofsNotInList(userId, value.keepDocumentIds);
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/documents/send-for-signature — Envoie un email au client avec le document à signer (notification ; PDF en pièce jointe possible plus tard).
 * Body : { to: string (email), documentType: 'devis' | 'facture', numero?: string }
 */
secureRouter.post('/documents/send-for-signature', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { value, error } = validateSendForSignatureBody(req.body);
    if (error) return res.status(400).json({ error });

    const { to, invoiceId, documentType, numero } = value;
    const { token } = await createSignRequest({ invoiceId, documentType, userId });
    const signUrl = `${env.BACKEND_PUBLIC_URL}/sign/confirm?token=${encodeURIComponent(token)}`;

    const docLabel = documentType === 'devis' ? 'Devis' : 'Facture';
    const numeroLabel = (numero && numero.trim()) ? ` n° ${numero.trim()}` : '';
    const subject = `${docLabel}${numeroLabel} à signer`;
    const text = `Vous avez reçu ${docLabel.toLowerCase()}${numeroLabel} pour signature.\n\nPour accepter et signer le document, ouvrez ce lien : ${signUrl}\n\nMerci de prendre connaissance du document et de contacter l'expéditeur pour toute question.`;
    const html = `<p>Vous avez reçu <strong>${docLabel.toLowerCase()}${numeroLabel}</strong> pour signature.</p><p style="margin: 1.5em 0;"><a href="${signUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Signer / Accepter le document</a></p><p>Merci de prendre connaissance du document et de contacter l'expéditeur pour toute question.</p>`;

    await sendMail({ to, subject, text, html });
    return res.status(200).json({ ok: true, sentTo: to });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/signatures — Liste des invoiceId signés pour l'utilisateur (pour sync colonne Accepté).
 */
secureRouter.get('/signatures', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    const signedInvoiceIds = await getSignedInvoiceIds(userId);
    return res.json({ signedInvoiceIds });
  } catch (e) {
    next(e);
  }
});

secureRouter.use((_req, _res, next) => {
  next(Object.assign(new Error('Not Found'), { status: 404 }));
});
