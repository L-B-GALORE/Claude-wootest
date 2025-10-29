// Run SQL migration script
const { PrismaClient } = require('./database/node_modules/@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('Reading migration SQL file...');
    const sqlFile = fs.readFileSync(path.join(__dirname, 'migrate_voice_calls.sql'), 'utf8');

    // Split by semicolon and filter out empty statements and comments
    const statements = sqlFile
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        if (s.length === 0) return false;
        // Remove comment-only lines but keep statements
        const cleaned = s.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim();
        return cleaned.length > 0;
      })
      .map(s => {
        // Remove inline comments
        return s.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim();
      });

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    // Save the final SELECT for later
    const finalSelect = statements[statements.length - 1];
    const migrateStatements = finalSelect.match(/^SELECT/i) ? statements.slice(0, -1) : statements;

    for (let i = 0; i < migrateStatements.length; i++) {
      const stmt = migrateStatements[i];
      console.log(`Executing statement ${i + 1}/${migrateStatements.length}...`);
      console.log(stmt.substring(0, 80) + (stmt.length > 80 ? '...' : ''));

      try {
        await prisma.$executeRawUnsafe(stmt);
        console.log('✓ Success\n');
      } catch (error) {
        console.error(`❌ Error: ${error.message}\n`);
        // For critical errors, stop execution
        if (error.message.includes('does not exist') || error.message.includes('Null constraint')) {
          throw error;
        }
      }
    }

    // Now run the SELECT to show results
    console.log('Checking migrated data...');
    const results = await prisma.$queryRaw`
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
      ORDER BY vc.created_at DESC
    `;

    console.log('\nMigrated voice calls:');
    console.table(results);
    console.log('\n✓ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
