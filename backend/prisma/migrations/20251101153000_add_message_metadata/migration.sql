-- AlterTable
-- Add metadata field to messages table for storing error details and retry information
ALTER TABLE "messages" ADD COLUMN "metadata" JSONB;
