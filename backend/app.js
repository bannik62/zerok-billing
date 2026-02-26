/**
 * Application Express (création et montage des middlewares/routes).
 * Exportée pour les tests (supertest) ; server.js l'importe et appelle app.listen().
 */
import 'dotenv/config';
import { env } from './config/env.js';
import { SESSION_COOKIE_MAX_AGE_MS, JSON_BODY_LIMIT } from './config/constants.js';
import { log } from './lib/logger.js';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import pg from 'pg';
import connectPgSimple from 'connect-pg-simple';
import { requireAuth } from './middleware/requireAuth.js';
import { validateCsrf, ensureCsrfToken } from './middleware/csrf.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { recoveryRouter } from './routes/recovery.js';
import { secureRouter } from './routes/secure.js';
import { confirmSignRequest } from './services/signRequestService.js';
import { createPaymentToken, validatePaymentToken } from './services/paymentTokenService.js';
import { getConfiguredProviders } from './services/paymentConfigService.js';
import { createCheckoutSession, getReceiptUrl, getPaymentDetails } from './plugins/stripe.js';
import { buildReceiptPdf } from './services/receiptPdfService.js';
import { prisma } from './lib/prisma.js';

export const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (env.allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origin not allowed'));
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: JSON_BODY_LIMIT }));

const sessionConfig = {
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'zerok.sid',
  cookie: {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
    path: '/'
  }
};

if (env.DATABASE_URL) {
  const PgSession = connectPgSimple(session);
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  sessionConfig.store = new PgSession({ pool, createTableIfMissing: true });
  log('[zerok-billing] Sessions: store PostgreSQL (table session)');
} else {
  log('[zerok-billing] Sessions: MemoryStore (DATABASE_URL non défini)');
}

app.use(session(sessionConfig));

// Public API : confirmation de signature (lien email). Avant validateCsrf et requireAuth.
app.get('/api/sign/confirm', async (req, res) => {
  try {
    const token = req.query.token ?? '';
    const result = await confirmSignRequest(token);
    const status = result.status;
    if (status !== 'ok') {
      return res.json({ status });
    }
    let paymentToken = null;
    let providers = [];
    if (result.documentType === 'facture' && result.invoiceId && result.userId) {
      try {
        const { token: payToken } = await createPaymentToken({ invoiceId: result.invoiceId, userId: result.userId });
        paymentToken = payToken;
        providers = await getConfiguredProviders(result.userId);
      } catch (_) {
        // ignore: payment token optional
      }
    }
    return res.json({ status, documentType: result.documentType, paymentToken, providers });
  } catch (e) {
    return res.json({ status: 'expired' });
  }
});

// Public: créer une session de paiement (après clic sur icône). Pas de CSRF (page statique /sign/confirm).
app.post('/api/payment/create-session', express.json(), async (req, res) => {
  try {
    const { paymentToken: rawToken, provider } = req.body || {};
    if (!rawToken || !provider) {
      return res.status(400).json({ error: 'paymentToken et provider requis' });
    }
    const payload = await validatePaymentToken(rawToken);
    if (!payload) {
      return res.status(400).json({ error: 'Token de paiement invalide ou expiré' });
    }
    const { invoiceId, userId } = payload;
    const summary = await prisma.invoicePaymentSummary.findUnique({ where: { invoiceId } });
    if (!summary) {
      return res.status(400).json({ error: 'Montant non défini pour cette facture' });
    }
    const config = await prisma.paymentConfig.findUnique({
      where: { userId_provider: { userId, provider } }
    });
    if (!config) {
      return res.status(400).json({ error: 'Ce moyen de paiement n\'est pas configuré' });
    }
    if (provider === 'stripe') {
      const secretKey = config.credentials?.secretKey;
      if (!secretKey) {
        return res.status(400).json({ error: 'Config Stripe invalide' });
      }
      const baseUrl = env.BACKEND_PUBLIC_URL || env.allowedOrigins?.[0] || 'http://localhost:3011';
      const successUrl = `${baseUrl}/paiement/succes?session_id={CHECKOUT_SESSION_ID}&invoice_id=${encodeURIComponent(invoiceId)}&amount_cents=${summary.amountCents}&currency=${encodeURIComponent(summary.currency)}`;
      const cancelUrl = `${baseUrl}/paiement/annule`;
      try {
        const { redirectUrl } = await createCheckoutSession({
          secretKey,
          amountCents: summary.amountCents,
          currency: summary.currency,
          invoiceId,
          successUrl,
          cancelUrl,
          description: `Facture ${invoiceId}`
        });
        log(`[zerok-billing] Session Stripe créée pour facture ${invoiceId} (${summary.amountCents} ${summary.currency})`);
        return res.json({ redirectUrl });
      } catch (stripeErr) {
        log(`[zerok-billing] Erreur Stripe (facture ${invoiceId}): ${stripeErr.message}`);
        return res.status(400).json({ error: stripeErr.message || 'Erreur lors de la création de la session Stripe' });
      }
    }
    return res.status(400).json({ error: 'Provider inconnu' });
  } catch (e) {
    log('[zerok-billing] create-session:', e?.message ?? e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.use('/api', validateCsrf);

app.get('/api/auth/csrf-token', ensureCsrfToken, (req, res) => {
  res.json({ csrfToken: req.session?.csrfToken });
});

app.use('/api/auth', authRouter);
app.use('/api/recovery', recoveryRouter);

app.get('/api/health', async (_req, res) => {
  const payload = { ok: true };
  if (!env.DATABASE_URL) {
    payload.db = 'none';
    return res.json(payload);
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    payload.db = 'ok';
  } catch (e) {
    log('[zerok-billing] healthcheck DB:', e?.message ?? e);
    payload.db = 'unavailable';
  }
  res.json(payload);
});

app.use('/api', requireAuth, secureRouter);

// Route publique : confirmation de signature (lien dans l'email). Page autonome avec icônes paiement si facture.
app.get('/sign/confirm', async (req, res) => {
  const token = req.query.token;
  let result;
  try {
    result = await confirmSignRequest(token);
  } catch (_) {
    result = { status: 'expired' };
  }
  const siteUrl = env.allowedOrigins[0] || env.BACKEND_PUBLIC_URL || '#';

  if (result.status !== 'ok') {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lien invalide</title></head><body style="font-family: sans-serif; max-width: 480px; margin: 3rem auto; padding: 1rem; text-align: center;"><h1>Lien invalide ou expiré</h1><p>Ce lien a déjà été utilisé ou a expiré.</p><p style="margin-top: 2rem;"><a href="${siteUrl}" style="color: #2563eb; text-decoration: underline;">Accéder au site</a></p></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  let paymentToken = null;
  let providers = [];
  if (result.documentType === 'facture' && result.invoiceId && result.userId) {
    try {
      const { token: payToken } = await createPaymentToken({ invoiceId: result.invoiceId, userId: result.userId });
      paymentToken = payToken;
      providers = await getConfiguredProviders(result.userId);
    } catch (_) {}
  }

  const paymentTokenEscaped = paymentToken ? paymentToken.replace(/\\/g, '\\\\').replace(/"/g, '&quot;') : '';

  const paymentSection = paymentToken && providers.length > 0
    ? `
    <section class="pay-section" style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 1rem; font-weight: 600;">Régler cette facture</p>
      <div class="pay-icons" style="display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; align-items: center;">
        ${providers.includes('stripe') ? `
        <button type="button" class="pay-btn" data-provider="stripe" data-payment-token="${paymentTokenEscaped}" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; cursor: pointer; font-size: 0.95rem;">
          <img src="https://stripe.com/img/v3/payments/badges/stripe.svg" alt="Stripe" width="56" height="28" style="vertical-align: middle;">
          <span>Payer avec Stripe</span>
        </button>` : ''}
      </div>
      <p id="pay-msg" style="margin: 0.75rem 0 0; font-size: 0.875rem; color: #6b7280; min-height: 1.25rem;"></p>
    </section>`
    : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document accepté</title></head><body style="font-family: sans-serif; max-width: 480px; margin: 3rem auto; padding: 1rem; text-align: center;">
  <h1>Document accepté</h1>
  <p>Votre signature a bien été enregistrée.</p>
  ${paymentSection}
  <p style="margin-top: 2rem;"><a href="${siteUrl}" style="color: #2563eb; text-decoration: underline;">Accéder au site</a></p>
  <script>
  (function() {
    var buttons = document.querySelectorAll('.pay-btn');
    var msg = document.getElementById('pay-msg');
    buttons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var provider = btn.getAttribute('data-provider');
        var paymentToken = btn.getAttribute('data-payment-token');
        if (!paymentToken || !provider) return;
        msg.textContent = 'Redirection…';
        btn.disabled = true;
        fetch('/api/payment/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentToken: paymentToken, provider: provider })
        }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, status: r.status, data: d }; }); })
          .then(function(x) {
            if (x.data.redirectUrl) { window.location.href = x.data.redirectUrl; return; }
            msg.textContent = x.data.error || 'Erreur';
            btn.disabled = false;
          })
          .catch(function() { msg.textContent = 'Erreur de connexion'; btn.disabled = false; });
      });
    });
  })();
  </script>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

const siteUrlForPayment = env.allowedOrigins?.[0] || env.BACKEND_PUBLIC_URL || '#';
// TODO: implémenter webhook Stripe (/api/webhooks/stripe) pour persister le statut de paiement
// et mettre à jour la facture (champ 'paid' ou 'paymentStatus') dans la base.
function esc(s) {
  if (s == null || s === '') return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
app.get('/paiement/succes', (req, res) => {
  const invoiceId = req.query.invoice_id || '';
  const sessionId = req.query.session_id || '';
  const amountCents = parseInt(req.query.amount_cents, 10);
  const currency = (req.query.currency || 'eur').toUpperCase();
  const amountFormatted = Number.isFinite(amountCents) ? (amountCents / 100).toFixed(2).replace('.', ',') : '—';
  const invoiceLine = invoiceId ? `<p><strong>Facture n°</strong> ${esc(invoiceId)}</p>` : '';
  const amountLine = Number.isFinite(amountCents) ? `<p><strong>Montant payé</strong> ${esc(amountFormatted)} ${esc(currency)}</p>` : '';
  const receiptLink = sessionId && invoiceId
    ? `<p style="margin-top: 1.5rem;"><a href="/paiement/receipt?session_id=${encodeURIComponent(sessionId)}&invoice_id=${encodeURIComponent(invoiceId)}" style="display: inline-block; padding: 0.5rem 1rem; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">Justificatif (Stripe)</a> <a href="/paiement/receipt/pdf?session_id=${encodeURIComponent(sessionId)}&invoice_id=${encodeURIComponent(invoiceId)}" style="display: inline-block; padding: 0.5rem 1rem; background: #059669; color: #fff; text-decoration: none; border-radius: 6px;">Télécharger le justificatif (PDF)</a></p>`
    : '';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Paiement effectué</title></head><body style="font-family: sans-serif; max-width: 480px; margin: 3rem auto; padding: 1rem; text-align: center;"><h1>Paiement effectué</h1><p>Merci, votre paiement a bien été enregistré.</p>${invoiceLine}${amountLine}${receiptLink}<p style="margin-top: 1.5rem; color: #6b7280;">Vous pouvez fermer cette fenêtre.</p><p style="margin-top: 2rem;"><a href="${siteUrlForPayment}" style="color: #2563eb; text-decoration: underline;">Accéder au site</a></p></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

app.get('/paiement/receipt', async (req, res) => {
  const sessionId = (req.query.session_id || '').trim();
  const invoiceId = (req.query.invoice_id || '').trim();
  if (!sessionId || !invoiceId) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Justificatif</title></head><body style="font-family: sans-serif; max-width: 480px; margin: 3rem auto; padding: 1rem; text-align: center;"><h1>Paramètres manquants</h1><p>Lien invalide. Utilisez le bouton depuis la page « Paiement effectué ».</p><p><a href="${siteUrlForPayment}">Accéder au site</a></p></body></html>`);
  }
  try {
    const summary = await prisma.invoicePaymentSummary.findUnique({ where: { invoiceId } });
    if (!summary) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Justificatif</title></head><body style="font-family: sans-serif; max-width: 480px; margin: 3rem auto; padding: 1rem; text-align: center;"><h1>Facture introuvable</h1><p><a href="${siteUrlForPayment}">Accéder au site</a></p></body></html>`);
    }
    const config = await prisma.paymentConfig.findUnique({
      where: { userId_provider: { userId: summary.userId, provider: 'stripe' } }
    });
    if (!config || !config.credentials?.secretKey) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(400).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Justificatif</title></head><body style="font-family: sans-serif; max-width: 480px; margin: 3rem auto; padding: 1rem; text-align: center;"><h1>Justificatif indisponible</h1><p><a href="${siteUrlForPayment}">Accéder au site</a></p></body></html>`);
    }
    const receiptUrl = await getReceiptUrl(config.credentials.secretKey, sessionId);
    if (receiptUrl) {
      return res.redirect(302, receiptUrl);
    }
  } catch (e) {
    log('[zerok-billing] receipt:', e?.message ?? e);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(502).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Justificatif</title></head><body style="font-family: sans-serif; max-width: 480px; margin: 3rem auto; padding: 1rem; text-align: center;"><h1>Justificatif indisponible</h1><p>Le reçu Stripe n’est pas encore disponible. Réessayez dans quelques instants.</p><p><a href="${siteUrlForPayment}">Accéder au site</a></p></body></html>`);
});

app.get('/paiement/receipt/pdf', async (req, res) => {
  const sessionId = (req.query.session_id || '').trim();
  const invoiceId = (req.query.invoice_id || '').trim();
  if (!sessionId || !invoiceId) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Justificatif PDF</title></head><body style="font-family: sans-serif; max-width: 480px; margin: 3rem auto; padding: 1rem; text-align: center;"><h1>Paramètres manquants</h1><p>Lien invalide.</p><p><a href="${siteUrlForPayment}">Accéder au site</a></p></body></html>`);
  }
  try {
    const summary = await prisma.invoicePaymentSummary.findUnique({ where: { invoiceId } });
    if (!summary) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Justificatif PDF</title></head><body style="font-family: sans-serif; max-width: 480px; margin: 3rem auto; padding: 1rem; text-align: center;"><h1>Facture introuvable</h1><p><a href="${siteUrlForPayment}">Accéder au site</a></p></body></html>`);
    }
    const config = await prisma.paymentConfig.findUnique({
      where: { userId_provider: { userId: summary.userId, provider: 'stripe' } }
    });
    if (!config || !config.credentials?.secretKey) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(400).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Justificatif PDF</title></head><body style="font-family: sans-serif; max-width: 480px; margin: 3rem auto; padding: 1rem; text-align: center;"><h1>Justificatif indisponible</h1><p><a href="${siteUrlForPayment}">Accéder au site</a></p></body></html>`);
    }
    const details = await getPaymentDetails(config.credentials.secretKey, sessionId);
    const paidAt = details?.paidAt || new Date();
    const paymentIntentId = details?.paymentIntentId || '';
    const pdfBuffer = await buildReceiptPdf({
      invoiceId,
      amountCents: summary.amountCents,
      currency: summary.currency,
      paidAt,
      paymentIntentId
    });
    const filename = `justificatif-${invoiceId.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (e) {
    log('[zerok-billing] receipt/pdf:', e?.message ?? e);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(502).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Justificatif PDF</title></head><body style="font-family: sans-serif; max-width: 480px; margin: 3rem auto; padding: 1rem; text-align: center;"><h1>Justificatif indisponible</h1><p>Une erreur s'est produite.</p><p><a href="${siteUrlForPayment}">Accéder au site</a></p></body></html>`);
  }
});

app.get('/paiement/annule', (_, res) => {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Paiement annulé</title></head><body style="font-family: sans-serif; max-width: 480px; margin: 3rem auto; padding: 1rem; text-align: center;"><h1>Paiement annulé</h1><p>Vous avez annulé le paiement. Vous pouvez réessayer plus tard depuis le lien de la facture.</p><p style="margin-top: 2rem;"><a href="${siteUrlForPayment}" style="color: #2563eb; text-decoration: underline;">Accéder au site</a></p></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

app.get('/', (_, res) => {
  res.json({ name: 'Zero-Knowledge Billing API', docs: '/api/health' });
});

app.use((_req, _res, next) => {
  next(Object.assign(new Error('Not Found'), { status: 404 }));
});

app.use(errorHandler);
