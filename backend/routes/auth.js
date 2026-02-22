import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import argon2 from 'argon2';
import { findUserByEmail, createUser } from '../services/userService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { ensureCsrfToken } from '../middleware/csrf.js';
import { validateRegister, validateLogin } from '../validators/authValidator.js';
import {
  PASSWORD_MIN_LENGTH,
  AUTH_RATE_LIMIT_WINDOW_MS,
  AUTH_RATE_LIMIT_MAX
} from '../config/constants.js';

const authRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
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
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) return next(err);
      res.status(201).json({
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        adresse: user.adresse
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
        adresse: user.adresse
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
  res.json({ valid: true, user: req.user });
});
