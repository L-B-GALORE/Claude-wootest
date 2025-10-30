-- AlterTable
ALTER TABLE "users" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "verification_token" TEXT,
ADD COLUMN "verification_token_expiry" TIMESTAMP(3);

-- CreateIndex (for faster token lookups)
CREATE INDEX "users_verification_token_idx" ON "users"("verification_token");
