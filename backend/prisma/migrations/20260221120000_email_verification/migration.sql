-- Vérification email : code à 6 chiffres, expiration
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email_verification_code" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email_verification_code_expires_at" TIMESTAMP(3);
