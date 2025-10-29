const { PrismaClient } = require('./database/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function migrate() {
  try {
    console.log('Step 1: Add contact_id column...');
    await prisma.$executeRaw`
      ALTER TABLE voice_calls ADD COLUMN IF NOT EXISTS contact_id UUID;
    `;
    console.log('✓ contact_id column added\n');

    console.log('Step 2: Populate contact_id, channel_id, and direction from existing data...');
    const result = await prisma.$executeRaw`
      UPDATE voice_calls
      SET
        contact_id = c.contact_id::uuid,
        channel_id = c.channel_id::uuid,
        direction = m.direction
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE voice_calls.message_id = m.id;
    `;
    console.log(`✓ Updated ${result} rows\n`);

    console.log('Step 3: Verify data was populated...');
    const check = await prisma.$queryRaw`
      SELECT
        id,
        contact_id,
        channel_id,
        direction,
        provider_call_id
      FROM voice_calls
      LIMIT 3;
    `;
    console.table(check);

    console.log('\nStep 4: Make message_id nullable...');
    await prisma.$executeRaw`
      ALTER TABLE voice_calls ALTER COLUMN message_id DROP NOT NULL;
    `;
    console.log('✓ message_id is now nullable\n');

    console.log('Step 5: Make new columns non-nullable...');
    await prisma.$executeRaw`
      ALTER TABLE voice_calls ALTER COLUMN contact_id SET NOT NULL;
    `;
    console.log('✓ contact_id set to NOT NULL');

    await prisma.$executeRaw`
      ALTER TABLE voice_calls ALTER COLUMN channel_id SET NOT NULL;
    `;
    console.log('✓ channel_id set to NOT NULL');

    await prisma.$executeRaw`
      ALTER TABLE voice_calls ALTER COLUMN direction SET NOT NULL;
    `;
    console.log('✓ direction set to NOT NULL\n');

    console.log('Step 6: Add foreign key constraints...');
    try {
      await prisma.$executeRaw`
        ALTER TABLE voice_calls
        ADD CONSTRAINT voice_calls_contact_id_fkey
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
      `;
      console.log('✓ Added contact_id foreign key');
    } catch (e) {
      console.log('⚠ Contact FK already exists or error:', e.message);
    }

    try {
      await prisma.$executeRaw`
        ALTER TABLE voice_calls
        ADD CONSTRAINT voice_calls_channel_id_fkey
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;
      `;
      console.log('✓ Added channel_id foreign key');
    } catch (e) {
      console.log('⚠ Channel FK already exists or error:', e.message);
    }

    console.log('\nStep 7: Add indexes...');
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS voice_calls_contact_id_idx ON voice_calls(contact_id);
    `;
    console.log('✓ Added contact_id index');

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS voice_calls_channel_id_idx ON voice_calls(channel_id);
    `;
    console.log('✓ Added channel_id index');

    console.log('\n✅ Migration completed successfully!');

    // Show final results
    console.log('\nFinal voice_calls data:');
    const final = await prisma.$queryRaw`
      SELECT
        vc.id,
        c.name as contact_name,
        c.phone_number,
        ch.identifier as channel,
        vc.direction,
        vc.call_status
      FROM voice_calls vc
      JOIN contacts c ON vc.contact_id = c.id
      JOIN channels ch ON vc.channel_id = ch.id
      ORDER BY vc.created_at DESC;
    `;
    console.table(final);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
