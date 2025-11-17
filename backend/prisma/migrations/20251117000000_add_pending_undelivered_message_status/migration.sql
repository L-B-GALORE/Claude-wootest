-- AlterEnum: Add PENDING and UNDELIVERED to message_status enum
-- This migration adds two new status values to support better message state tracking

-- Add PENDING status (first in order, before SENT)
ALTER TYPE "message_status" ADD VALUE 'PENDING';

-- Add UNDELIVERED status (between DELIVERED and FAILED)
ALTER TYPE "message_status" ADD VALUE 'UNDELIVERED';
