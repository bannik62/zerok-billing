-- Add usedAt to payment_token for one-time use (replay prevention)
ALTER TABLE "payment_token" ADD COLUMN IF NOT EXISTS "used_at" TIMESTAMP(3);
