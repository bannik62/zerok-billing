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
    select: { id: true, email: true, nom: true, prenom: true, adresse: true }
  });
}

export async function createUser(data) {
  return prisma.user.create({ data });
}
