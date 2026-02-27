-- CreateTable
CREATE TABLE "user_backup" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "state_hash" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_backup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_backup_user_id_key" ON "user_backup"("user_id");

-- AddForeignKey
ALTER TABLE "user_backup" ADD CONSTRAINT "user_backup_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
