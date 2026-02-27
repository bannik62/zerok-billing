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
  validateSendForSignatureBody,
  validatePaymentConfigBody
} from '../validators/secureValidator.js';
import { sendMail } from '../services/emailService.js';
import { createSignRequest, getSignedInvoiceIds } from '../services/signRequestService.js';
import { getConfiguredProviders } from '../services/paymentConfigService.js';
import { getPaymentStatusByInvoiceIds } from '../services/invoicePaymentService.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { encryptCredentials, isEncryptionAvailable } from '../lib/credentialsEncryption.js';
import { PDF_ATTACHMENT_MAX_BYTES, VERIFY_BATCH_MAX } from '../config/constants.js';

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
 * GET /api/payment/config — Liste des providers configurés (sans exposer les clés).
 */
secureRouter.get('/payment/config', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    const providers = await getConfiguredProviders(userId);
    return res.json({ providers: providers.map((p) => ({ provider: p, configured: true })) });
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /api/payment/config — Enregistre ou met à jour la config d'un provider (ex. clé secrète Stripe).
 * Body : { provider: 'stripe', secretKey: 'sk_...' }
 */
secureRouter.put('/payment/config', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { value, error } = validatePaymentConfigBody(req.body);
    if (error) return res.status(400).json({ error });

    const { provider, secretKey } = value;
    const credentials = isEncryptionAvailable()
      ? encryptCredentials({ secretKey })
      : { secretKey };
    if (credentials === null) {
      return res.status(500).json({ error: 'CREDENTIALS_ENCRYPTION_KEY invalide (64 caractères hex requis)' });
    }
    await prisma.paymentConfig.upsert({
      where: { userId_provider: { userId, provider } },
      create: { userId, provider, credentials },
      update: { credentials }
    });
    return res.json({ ok: true, provider });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/documents/send-for-signature — Envoie un email au client avec le document à signer (lien + PDF en pièce jointe si fourni).
 * Body : { to, invoiceId, documentType, numero?, amountCents?, currency?, pdfBase64?, pdfFilename? } — amountCents + currency requis si facture.
 */
secureRouter.post('/documents/send-for-signature', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { value, error } = validateSendForSignatureBody(req.body);
    if (error) return res.status(400).json({ error });

    const { to, invoiceId, documentType, numero, amountCents, currency, pdfBase64, pdfFilename } = value;
    const { token } = await createSignRequest({ invoiceId, documentType, userId });
    if (documentType === 'facture' && amountCents != null && currency) {
      await prisma.invoicePaymentSummary.upsert({
        where: { invoiceId },
        create: { invoiceId, userId, amountCents, currency: currency.toLowerCase().trim() },
        update: { amountCents, currency: currency.toLowerCase().trim() }
      });
    }
    const signUrl = `${env.BACKEND_PUBLIC_URL}/sign/confirm?token=${encodeURIComponent(token)}`;

    const docLabel = documentType === 'devis' ? 'Devis' : 'Facture';
    const numeroLabel = (numero && numero.trim()) ? ` n° ${numero.trim()}` : '';
    const subject = `${docLabel}${numeroLabel} à signer`;
    const text = `Vous avez reçu ${docLabel.toLowerCase()}${numeroLabel} pour signature.\n\nPour accepter et signer le document, ouvrez ce lien : ${signUrl}\n\nMerci de prendre connaissance du document et de contacter l'expéditeur pour toute question.`;
    const html = `<p>Vous avez reçu <strong>${docLabel.toLowerCase()}${numeroLabel}</strong> pour signature.</p><p style="margin: 1.5em 0;"><a href="${signUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Signer / Accepter le document</a></p><p>Merci de prendre connaissance du document et de contacter l'expéditeur pour toute question.</p>`;

    let attachments;
    if (pdfBase64 && typeof pdfBase64 === 'string' && pdfBase64.length > 0) {
      let buffer;
      try {
        buffer = Buffer.from(pdfBase64, 'base64');
      } catch {
        return res.status(400).json({ error: 'Pièce jointe PDF invalide (base64)' });
      }
      if (buffer.length > PDF_ATTACHMENT_MAX_BYTES) {
        return res.status(400).json({ error: `PDF trop volumineux (max ${Math.round(PDF_ATTACHMENT_MAX_BYTES / 1024 / 1024)} Mo)` });
      }
      const name = (pdfFilename && pdfFilename.trim()) ? pdfFilename.trim() : `${docLabel}-${numero?.trim() || invoiceId}.pdf`;
      attachments = [{ filename: name.endsWith('.pdf') ? name : `${name}.pdf`, content: buffer }];
    }

    await sendMail({ to, subject, text, html, attachments });
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

/**
 * GET /api/invoices/payment-status — Statut payé par facture (pour colonne Payé).
 * Query : ids=id1,id2,id3 (invoiceIds, max VERIFY_BATCH_MAX).
 * Réponse : { [invoiceId]: { paid: boolean, paidAt?: string } }
 */
secureRouter.get('/invoices/payment-status', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    const raw = (req.query.ids ?? '').trim();
    const ids = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
    if (ids.length > VERIFY_BATCH_MAX) {
      return res.status(400).json({ error: `Maximum ${VERIFY_BATCH_MAX} ids par requête` });
    }
    const status = await getPaymentStatusByInvoiceIds(userId, ids);
    return res.json(status);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/backup — Récupère la sauvegarde (blob chiffré). Query hash= optionnel : si fourni et égal au stateHash stocké, renvoie { unchanged: true } sans blob.
 */
secureRouter.get('/backup', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    const clientHash = (req.query.hash ?? '').trim() || null;
    const backup = await prisma.userBackup.findUnique({ where: { userId } });
    if (!backup) return res.status(404).json({ error: 'Aucune sauvegarde' });
    if (clientHash && backup.stateHash === clientHash) {
      return res.json({ unchanged: true });
    }
    return res.json({ payload: backup.payload, stateHash: backup.stateHash });
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /api/backup — Enregistre ou met à jour la sauvegarde (blob chiffré + hash d'état).
 * Body : { payload: string, stateHash: string }
 */
secureRouter.put('/backup', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    const { payload, stateHash } = req.body ?? {};
    if (typeof payload !== 'string' || typeof stateHash !== 'string' || !stateHash.trim()) {
      return res.status(400).json({ error: 'payload et stateHash (string) requis' });
    }
    await prisma.userBackup.upsert({
      where: { userId },
      create: { userId, payload, stateHash: stateHash.trim() },
      update: { payload, stateHash: stateHash.trim() }
    });
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

secureRouter.use((_req, _res, next) => {
  next(Object.assign(new Error('Not Found'), { status: 404 }));
});
