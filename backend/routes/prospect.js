/**
 * Routes Prospect : chat LLM (SIRENE, Pappers, geo) — authentification requise.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { decryptCredentials, isEncryptionAvailable } from '../lib/credentialsEncryption.js';
import { runProspectChat } from '../services/prospectLLMService.js';
import {
  PROSPECT_CHAT_RATE_LIMIT_WINDOW_MS,
  PROSPECT_CHAT_RATE_LIMIT_MAX
} from '../config/constants.js';

const prospectChatLimiter = rateLimit({
  windowMs: PROSPECT_CHAT_RATE_LIMIT_WINDOW_MS,
  max: PROSPECT_CHAT_RATE_LIMIT_MAX,
  message: { error: 'Trop de requêtes. Limite : 10 par minute.' },
  standardHeaders: true,
  legacyHeaders: false
});

export const prospectRouter = Router();

/**
 * POST /api/prospect/chat
 * Body : { message: string, history?: Array<{ role, content }> }
 * Réponse : { reply: string, history: Array, results: Array<{ siret, nom, adresse, formeJuridique }> }
 */
prospectRouter.post('/prospect/chat', prospectChatLimiter, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { message, history = [] } = req.body ?? {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message requis' });
    }

    const configs = await prisma.providerConfig.findMany({
      where: { userId, provider: { in: ['openai', 'mistral', 'pappers'] } }
    });

    function getKey(provider) {
      const row = configs.find((c) => c.provider === provider);
      if (!row) return null;
      const creds = isEncryptionAvailable() ? decryptCredentials(row.credentials) : row.credentials;
      return creds?.secretKey ?? null;
    }

    const openaiKey = getKey('openai');
    const mistralKey = getKey('mistral');
    const pappersKey = getKey('pappers');
    const provider = openaiKey ? 'openai' : mistralKey ? 'mistral' : null;
    const llmKey = openaiKey ?? mistralKey;

    if (!provider) {
      return res.status(400).json({
        error: 'NO_LLM_KEY',
        message: 'Configurez une clé OpenAI ou Mistral dans Paramètres > Token service.'
      });
    }

    const messages = [...(Array.isArray(history) ? history : []), { role: 'user', content: message.trim() }];
    const result = await runProspectChat({ provider, llmKey, pappersKey, messages });

    return res.json({
      reply: result.reply,
      history: result.messages,
      results: result.results ?? []
    });
  } catch (e) {
    next(e);
  }
});
