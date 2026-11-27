'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const env = require('./env');

const schema = process.env.DB_SCHEMA;
if (!process.env.DB_NAME) {
  throw new Error('DB_NAME must be explicitly set before running migrations.');
}
if (!schema || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
  throw new Error('DB_SCHEMA must be explicitly set to a valid schema name (for example: v2).');
}

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: process.env.DB_NAME,
  user: env.db.user,
  password: env.db.password,
  options: `-c search_path=${schema},public`,
});

const migrationFiles = [
  '20261113_payment_module.sql',
];

async function migrate() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT current_database() AS database_name, current_schema() AS schema_name'
    );
    if (rows[0].database_name !== process.env.DB_NAME || rows[0].schema_name !== schema) {
      throw new Error(
        `Migration target mismatch: connected to ${rows[0].database_name}.${rows[0].schema_name}, expected ${process.env.DB_NAME}.${schema}`
      );
    }

    console.log(`Running KEPK migrations on ${rows[0].database_name}.${rows[0].schema_name}`);
    for (const file of migrationFiles) {
      const sqlPath = path.join(__dirname, 'migrations', file);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log(`Applying ${file}...`);
      await client.query(sql);
    }
    console.log('KEPK migrations completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration runner failed:', err.message);
  process.exitCode = 1;
  pool.end().catch(() => {});
});
