/**
 * Routes webhooks (body brut, pas de CSRF).
 * Doit être monté avant express.json() pour recevoir le body raw (vérification signature Stripe).
 */
import express from 'express';
import { Router } from 'express';
import { handleStripeWebhook } from '../handlers/stripeWebhook.js';

export const webhooksRouter = Router();

webhooksRouter.post('/stripe', express.raw({ type: 'application/json' }), (req, res, next) => {
  handleStripeWebhook(req, res).catch(next);
});
