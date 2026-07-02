const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const hasSslOption = process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('sslmode=require') || process.env.DATABASE_URL.includes('ssl=true'));
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.NODE_ENV === 'production' || hasSslOption) ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // 10s connection timeout for remote db connections
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

const db = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),

  // Transaction helper
  async transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

// Run migration if called directly
if (require.main === module) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  pool.query(schema)
    .then(() => { console.log('✅ Database migrated successfully'); process.exit(0); })
    .catch(err => { console.error('❌ Migration failed:', err.message); process.exit(1); });
}

module.exports = db;
