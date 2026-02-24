-- CreateTable
CREATE TABLE "sign_request" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "signed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sign_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sign_request_token_key" ON "sign_request"("token");

-- CreateIndex
CREATE INDEX "sign_request_user_id_idx" ON "sign_request"("user_id");

-- CreateIndex
CREATE INDEX "sign_request_token_idx" ON "sign_request"("token");

-- CreateIndex
CREATE INDEX "sign_request_invoice_id_user_id_idx" ON "sign_request"("invoice_id", "user_id");

-- AddForeignKey
ALTER TABLE "sign_request" ADD CONSTRAINT "sign_request_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
