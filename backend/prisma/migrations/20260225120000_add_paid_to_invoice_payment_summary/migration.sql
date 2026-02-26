-- AlterTable
ALTER TABLE "invoice_payment_summary" ADD COLUMN "paid_at" TIMESTAMP(3),
ADD COLUMN "stripe_payment_intent_id" TEXT;
