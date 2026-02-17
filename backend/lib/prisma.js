import { PrismaClient } from '@prisma/client';

/** Instance unique partagée (singleton) pour limiter les connexions et permettre un shutdown propre. */
export const prisma = new PrismaClient();
