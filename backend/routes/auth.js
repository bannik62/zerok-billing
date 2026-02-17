import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import argon2 from 'argon2';
import { findUserByEmail, createUser } from '../services/userService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { ensureCsrfToken } from '../middleware/csrf.js';
import { error as logError } from '../lib/logger.js';

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const EMAIL_MAX_LENGTH = 255;
const NOM_MAX_LENGTH = 100;
const PRENOM_MAX_LENGTH = 100;
const ADRESSE_MAX_LENGTH = 255;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimString(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function validateRegisterBody(body) {
  const email = trimString(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const nom = trimString(body.nom);
  const prenom = trimString(body.prenom);
  const adresse = body.adresse != null ? trimString(body.adresse) : '';
  const errors = [];
  if (!email) errors.push('email requis');
  else if (email.length > EMAIL_MAX_LENGTH) errors.push('email trop long');
  else if (!EMAIL_REGEX.test(email)) errors.push('format email invalide');
  if (!password) errors.push('password requis');
  else if (password.length < PASSWORD_MIN_LENGTH) errors.push(`mot de passe minimum ${PASSWORD_MIN_LENGTH} caractères`);
  else if (password.length > PASSWORD_MAX_LENGTH) errors.push('mot de passe trop long');
  if (!nom) errors.push('nom requis');
  else if (nom.length > NOM_MAX_LENGTH) errors.push('nom trop long');
  if (!prenom) errors.push('prenom requis');
  else if (prenom.length > PRENOM_MAX_LENGTH) errors.push('prenom trop long');
  if (adresse.length > ADRESSE_MAX_LENGTH) errors.push('adresse trop longue');
  return { errors, email, password, nom, prenom, adresse: adresse || null };
}

function validateLoginBody(body) {
  const email = trimString(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const errors = [];
  if (!email) errors.push('email requis');
  else if (email.length > EMAIL_MAX_LENGTH) errors.push('email trop long');
  else if (!EMAIL_REGEX.test(email)) errors.push('format email invalide');
  if (!password) errors.push('password requis');
  else if (password.length > PASSWORD_MAX_LENGTH) errors.push('mot de passe trop long');
  return { errors, email, password };
}

/** Limite les tentatives login/register par IP (10 req / 15 min). */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

export const authRouter = Router();

// Route pour récupérer le token CSRF (à envoyer en header X-CSRF-Token sur POST/PUT/PATCH/DELETE)
authRouter.get('/csrf-token', ensureCsrfToken, (req, res) => {
  res.json({ csrfToken: req.session.csrfToken });
});

// Routes publiques : register, login, logout

authRouter.post('/register', authRateLimiter, async (req, res) => {
  try {
    const { errors, email, password, nom, prenom, adresse } = validateRegisterBody(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('. ') });
    }
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
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: 'Erreur session' });
      res.status(201).json({
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        adresse: user.adresse
      });
    });
  } catch (e) {
    logError(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

authRouter.post('/login', authRateLimiter, async (req, res) => {
  try {
    const { errors, email, password } = validateLoginBody(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('. ') });
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ error: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères` });
    }
    const user = await findUserByEmail(email);
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: 'Erreur session' });
      res.json({
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        adresse: user.adresse
      });
    });
  } catch (e) {
    logError(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Erreur déconnexion' });
    res.clearCookie('zerok.sid');
    res.json({ ok: true });
  });
});

// Route sécurisée : nécessite une session valide (middleware requireAuth)
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ valid: true, user: req.user });
});
