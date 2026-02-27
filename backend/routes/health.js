/**
 * Routes : healthcheck et racine.
 */
import { Router } from 'express';
import { getDbStatus } from '../services/healthService.js';

export const healthRouter = Router();

healthRouter.get('/api/health', async (_req, res) => {
  const db = await getDbStatus();
  res.json({ ok: true, db });
});

healthRouter.get('/', (_, res) => {
  res.json({ name: 'Zero-Knowledge Billing API', docs: '/api/health' });
});
