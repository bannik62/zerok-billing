-- CreateTable DocumentProof (preuves coffre-fort : hash fichier, pas le contenu)
CREATE TABLE IF NOT EXISTS "DocumentProof" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL,
    "invoice_id" TEXT,

    CONSTRAINT "DocumentProof_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentProof_document_id_key" ON "DocumentProof"("document_id");
CREATE INDEX IF NOT EXISTS "DocumentProof_user_id_idx" ON "DocumentProof"("user_id");
CREATE INDEX IF NOT EXISTS "DocumentProof_document_id_idx" ON "DocumentProof"("document_id");
CREATE INDEX IF NOT EXISTS "DocumentProof_invoice_id_idx" ON "DocumentProof"("invoice_id");

DO $$ BEGIN
  ALTER TABLE "DocumentProof" ADD CONSTRAINT "DocumentProof_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
