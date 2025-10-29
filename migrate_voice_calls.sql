-- Migration script to add contactId, channelId, and direction to existing voice_calls

-- Step 1: Add new columns as nullable first
ALTER TABLE voice_calls ADD COLUMN IF NOT EXISTS contact_id UUID;
ALTER TABLE voice_calls ADD COLUMN IF NOT EXISTS channel_id UUID;
ALTER TABLE voice_calls ADD COLUMN IF NOT EXISTS direction message_direction;

-- Step 2: Populate the new columns from existing data
UPDATE voice_calls
SET
  contact_id = c.contact_id,
  channel_id = c.channel_id,
  direction = m.direction
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
WHERE voice_calls.message_id = m.id;

-- Step 3: Make message_id nullable
ALTER TABLE voice_calls ALTER COLUMN message_id DROP NOT NULL;

-- Step 4: Make the new columns non-nullable (after they're populated)
ALTER TABLE voice_calls ALTER COLUMN contact_id SET NOT NULL;
ALTER TABLE voice_calls ALTER COLUMN channel_id SET NOT NULL;
ALTER TABLE voice_calls ALTER COLUMN direction SET NOT NULL;

-- Step 5: Add foreign key constraints
ALTER TABLE voice_calls
  ADD CONSTRAINT voice_calls_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;

ALTER TABLE voice_calls
  ADD CONSTRAINT voice_calls_channel_id_fkey
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;

-- Step 6: Add indexes
CREATE INDEX IF NOT EXISTS voice_calls_contact_id_idx ON voice_calls(contact_id);
CREATE INDEX IF NOT EXISTS voice_calls_channel_id_idx ON voice_calls(channel_id);

-- Show results
SELECT
  vc.id,
  vc.contact_id,
  vc.channel_id,
  vc.direction,
  vc.provider_call_id,
  c.name as contact_name,
  c.phone_number as contact_phone
FROM voice_calls vc
JOIN contacts c ON vc.contact_id = c.id
ORDER BY vc.created_at DESC;
