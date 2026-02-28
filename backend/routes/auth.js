import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import argon2 from 'argon2';
import {
  findUserByEmail,
  createUser,
  updateRecoveryData,
  getRecoveryDataByEmail,
  updatePasswordByEmail,
  setEmailVerificationCode,
  verifyEmailCode,
  setEmailVerified
} from '../services/userService.js';
import { sendMail } from '../services/emailService.js';
import { log } from '../lib/logger.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { ensureCsrfToken } from '../middleware/csrf.js';
import {
  validateRegister,
  validateLogin,
  validateRecoveryData,
  validateResetPassword
} from '../validators/authValidator.js';
import {
  PASSWORD_MIN_LENGTH,
  AUTH_RATE_LIMIT_WINDOW_MS,
  AUTH_RATE_LIMIT_MAX,
  RECOVERY_RATE_LIMIT_WINDOW_MS,
  RECOVERY_RATE_LIMIT_MAX
} from '../config/constants.js';

const authRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const recoveryRateLimiter = rateLimit({
  windowMs: RECOVERY_RATE_LIMIT_WINDOW_MS,
  max: RECOVERY_RATE_LIMIT_MAX,
  message: { error: 'Trop de tentatives. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false
});

export const authRouter = Router();

// Route pour récupérer le token CSRF (à envoyer en header X-CSRF-Token sur POST/PUT/PATCH/DELETE)
authRouter.get('/csrf-token', ensureCsrfToken, (req, res) => {
  res.json({ csrfToken: req.session.csrfToken });
});

// Routes publiques : register, login, logout

authRouter.post('/register', authRateLimiter, async (req, res, next) => {
  try {
    const { value, error } = validateRegister(req.body);
    if (error) return res.status(400).json({ error });
    const { email, password, nom, prenom, adresse } = value;
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }
    const passwordHash = await argon2.hash(password);
    const user = await createUser({
      email,
      passwordHash,
      role: 'USER',
      nom,
      prenom,
      adresse
    });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await setEmailVerificationCode(user.id, code, expiresAt);
    try {
      await sendMail({
        to: user.email,
        subject: 'Vérifiez votre email – ZeroK Billing',
        text: `Votre code de vérification est : ${code}\n\nIl expire dans 15 minutes. Ne le partagez avec personne.`,
        html: `<p>Votre code de vérification est : <strong>${code}</strong></p><p>Il expire dans 15 minutes. Ne le partagez avec personne.</p>`
      });
    } catch (mailErr) {
      log('[zerok-billing] Envoi email vérification échoué:', mailErr?.message);
      return res.status(503).json({
        error: "Impossible d'envoyer l'email de vérification. Vérifiez la configuration serveur (GMAIL_USER, GMAIL_APP_PASSWORD) ou réessayez plus tard."
      });
    }
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) return next(err);
      res.status(201).json({
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        adresse: user.adresse,
        emailVerified: false
      });
    });
  } catch (e) {
    next(e);
  }
});

authRouter.post('/login', authRateLimiter, async (req, res, next) => {
  try {
    const { value, error } = validateLogin(req.body);
    if (error) return res.status(400).json({ error });
    const { email, password } = value;
    if (password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ error: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères` });
    }
    const user = await findUserByEmail(email);
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) return next(err);
      res.json({
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        adresse: user.adresse,
        emailVerified: user.emailVerified ?? false
      });
    });
  } catch (e) {
    next(e);
  }
});

authRouter.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('zerok.sid');
    res.json({ ok: true });
  });
});

// Route sécurisée : nécessite une session valide (middleware requireAuth)
authRouter.get('/me', requireAuth, (req, res) => {
  const { recoverySalt, ...user } = req.user;
  res.json({ valid: true, user: { ...user, hasRecoveryData: !!recoverySalt } });
});

// ——— Vérification email (code à 6 chiffres) ———
const resendVerifyLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 3,
  message: { error: 'Trop de demandes. Réessayez dans 2 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

authRouter.post('/verify-email', requireAuth, async (req, res, next) => {
  try {
    const code = req.body?.code?.trim();
    if (!code) return res.status(400).json({ error: 'Code requis' });
    const userId = req.session.userId;
    const ok = await verifyEmailCode(userId, code);
    if (!ok) return res.status(400).json({ error: 'Code invalide ou expiré' });
    await setEmailVerified(userId);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

authRouter.post('/resend-verification', resendVerifyLimiter, requireAuth, async (req, res, next) => {
  try {
    const user = req.user;
    if (user.emailVerified) return res.json({ ok: true });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await setEmailVerificationCode(user.id, code, expiresAt);
    try {
      await sendMail({
        to: user.email,
        subject: 'Vérifiez votre email – ZeroK Billing',
        text: `Votre code de vérification est : ${code}\n\nIl expire dans 15 minutes. Ne le partagez avec personne.`,
        html: `<p>Votre code de vérification est : <strong>${code}</strong></p><p>Il expire dans 15 minutes. Ne le partagez avec personne.</p>`
      });
    } catch (mailErr) {
      log('[zerok-billing] Envoi email vérification échoué:', mailErr?.message);
      return res.status(503).json({
        error: "Impossible d'envoyer l'email de vérification. Réessayez plus tard."
      });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ——— Recovery (phrase de récupération) ———

// Enregistrer salt + keyCheck pour l'utilisateur connecté (après initEncryption avec phrase)
authRouter.post('/recovery-data', requireAuth, async (req, res, next) => {
  try {
    const { value, error } = validateRecoveryData(req.body);
    if (error) return res.status(400).json({ error });
    const userId = req.session.userId;
    await updateRecoveryData(userId, { salt: value.salt, keyCheck: value.keyCheck });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Récupérer salt + keyCheck par email (pour flow "mot de passe oublié", rate limit strict)
authRouter.get('/recovery-data', recoveryRateLimiter, async (req, res, next) => {
  try {
    const email = req.query.email?.trim();
    if (!email) return res.status(400).json({ error: 'email requis' });
    const data = await getRecoveryDataByEmail(email);
    if (!data || data.recoverySalt == null || data.recoveryKeyCheck == null) {
      return res.status(404).json({ error: 'Aucune donnée de récupération pour cet email.' });
    }
    res.json({ salt: data.recoverySalt, keyCheck: data.recoveryKeyCheck });
  } catch (e) {
    next(e);
  }
});

// Réinitialiser le mot de passe (après vérification phrase côté client)
authRouter.post('/reset-password', recoveryRateLimiter, async (req, res, next) => {
  try {
    const { value, error } = validateResetPassword(req.body);
    if (error) return res.status(400).json({ error });
    const { email, newPassword } = value;
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'Aucun compte associé à cet email.' });
    }
    const passwordHash = await argon2.hash(newPassword);
    await updatePasswordByEmail(email, passwordHash);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
