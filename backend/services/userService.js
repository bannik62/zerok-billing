/**
 * Couche service utilisateurs : accès données (Prisma).
 * Les routes n'importent pas prisma directement.
 */
import { prisma } from '../lib/prisma.js';

export async function findUserByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserById(id) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, nom: true, prenom: true, adresse: true, emailVerified: true }
  });
}

export async function createUser(data) {
  return prisma.user.create({ data });
}

/**
 * Enregistre les données de recovery (sel + keyCheck) pour l'utilisateur connecté.
 * @param {string} userId
 * @param {{ salt: string, keyCheck: { payload: string, iv: string } }} data
 */
export async function updateRecoveryData(userId, { salt, keyCheck }) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      recoverySalt: salt,
      recoveryKeyCheck: keyCheck ?? undefined
    }
  });
}

/**
 * Met à jour le hash du mot de passe pour l'utilisateur (reset par email).
 * @param {string} email
 * @param {string} passwordHash
 */
export async function updatePasswordByEmail(email, passwordHash) {
  return prisma.user.update({
    where: { email },
    data: { passwordHash }
  });
}

/**
 * Récupère uniquement recoverySalt et recoveryKeyCheck pour un email (pour le flow "mot de passe oublié").
 * @param {string} email
 * @returns {Promise<{ recoverySalt: string | null, recoveryKeyCheck: object | null } | null>}
 */
export async function getRecoveryDataByEmail(email) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { recoverySalt: true, recoveryKeyCheck: true }
  });
  return user ?? null;
}

// ——— Vérification email (code à 6 chiffres) ———

/** Génère un code à 6 chiffres et enregistre avec expiration (ex. 15 min). */
export async function setEmailVerificationCode(userId, code, expiresAt) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerificationCode: code,
      emailVerificationCodeExpiresAt: expiresAt
    }
  });
}

/** Supprime le code après utilisation ou expiration. */
export async function clearEmailVerificationCode(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerificationCode: null,
      emailVerificationCodeExpiresAt: null
    }
  });
}

/** Vérifie le code : doit correspondre et ne pas être expiré. Retourne true si ok. */
export async function verifyEmailCode(userId, code) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerificationCode: true, emailVerificationCodeExpiresAt: true }
  });
  if (!user?.emailVerificationCode || user.emailVerificationCode !== String(code).trim()) return false;
  if (!user.emailVerificationCodeExpiresAt || new Date() > user.emailVerificationCodeExpiresAt) return false;
  return true;
}

/** Marque l'email comme vérifié (après code valide). */
export async function setEmailVerified(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true, emailVerificationCode: null, emailVerificationCodeExpiresAt: null }
  });
}
