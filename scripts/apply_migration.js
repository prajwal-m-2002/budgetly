const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const host = 'aws-0-ap-southeast-1.pooler.supabase.com';
  const connectionString = `postgresql://postgres.gkppjknrjciymcoorrjt:Prajwal%401624@${host}:6543/postgres`;
  
  console.log(`Connecting to ${host}...`);
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully!");

    const sqlPath = path.join(__dirname, 'setup_full_database.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Applying database schema...");
    await client.query(sql);
    console.log("MIGRATION APPLIED SUCCESSFULLY!");

    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';");
    console.log("Tables now in public schema:", res.rows.map(r => r.table_name));

    await client.end();
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

applyMigration();
