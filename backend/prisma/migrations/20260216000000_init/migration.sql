-- CreateEnum (idempotent: ne fait rien si le type existe déjà)
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('USER', 'WITNESS', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable (IF NOT EXISTS pour ne pas casser si tables déjà créées par un ancien db push)
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "adresse" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Proof" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "invoice_hash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (IF NOT EXISTS pour idempotence)
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Proof_invoice_id_key" ON "Proof"("invoice_id");
CREATE INDEX IF NOT EXISTS "Proof_user_id_idx" ON "Proof"("user_id");
CREATE INDEX IF NOT EXISTS "Proof_invoice_id_idx" ON "Proof"("invoice_id");

-- AddForeignKey (idempotent: ne pas échouer si la contrainte existe)
DO $$ BEGIN
  ALTER TABLE "Proof" ADD CONSTRAINT "Proof_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
