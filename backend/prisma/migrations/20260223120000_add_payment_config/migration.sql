-- CreateTable
CREATE TABLE "payment_config" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_config_user_id_provider_key" ON "payment_config"("user_id", "provider");

-- CreateIndex
CREATE INDEX "payment_config_user_id_idx" ON "payment_config"("user_id");

-- AddForeignKey
ALTER TABLE "payment_config" ADD CONSTRAINT "payment_config_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
