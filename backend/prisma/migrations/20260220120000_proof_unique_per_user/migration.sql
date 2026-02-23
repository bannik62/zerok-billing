-- Proof: unicité par (user_id, invoice_id) au lieu de invoice_id seul (évite collision inter-utilisateurs)
DROP INDEX IF EXISTS "Proof_invoice_id_key";
CREATE UNIQUE INDEX "Proof_user_id_invoice_id_key" ON "Proof"("user_id", "invoice_id");

-- DocumentProof: unicité par (user_id, document_id) au lieu de document_id seul
DROP INDEX IF EXISTS "DocumentProof_document_id_key";
CREATE UNIQUE INDEX "DocumentProof_user_id_document_id_key" ON "DocumentProof"("user_id", "document_id");
