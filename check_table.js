const { PrismaClient } = require('./database/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function checkTable() {
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'voice_calls'
      ORDER BY ordinal_position;
    `;

    console.log('Current voice_calls table structure:');
    console.table(result);

    // Also check how many rows
    const count = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM voice_calls;
    `;
    console.log(`\nTotal rows in voice_calls: ${count[0].count}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTable();
