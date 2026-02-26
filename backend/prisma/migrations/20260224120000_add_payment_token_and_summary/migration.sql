-- CreateTable
CREATE TABLE "payment_token" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payment_summary" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payment_summary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_token_token_key" ON "payment_token"("token");

-- CreateIndex
CREATE INDEX "payment_token_token_idx" ON "payment_token"("token");

-- CreateIndex
CREATE INDEX "payment_token_user_id_idx" ON "payment_token"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_payment_summary_invoice_id_key" ON "invoice_payment_summary"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_payment_summary_user_id_idx" ON "invoice_payment_summary"("user_id");
