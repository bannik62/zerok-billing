-- AlterTable User: recovery data for password reset (phrase + new password => same key)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "recovery_salt" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "recovery_key_check" JSONB;
