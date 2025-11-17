-- CreateEnum
-- Add MessageSource enum to track how messages entered the system
CREATE TYPE "message_source" AS ENUM ('WEBHOOK', 'IMPORT', 'MANUAL', 'API');

-- AlterTable
-- Add source field to track message origin (defaults to WEBHOOK for backward compatibility)
-- Add notificationSent field to track if push notification was sent
ALTER TABLE "messages" ADD COLUMN "source" "message_source" NOT NULL DEFAULT 'WEBHOOK';
ALTER TABLE "messages" ADD COLUMN "notification_sent" BOOLEAN NOT NULL DEFAULT false;
