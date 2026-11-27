'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const env = require('./env');

const schema = /^[A-Za-z_][A-Za-z0-9_]*$/.test(env.db.schema) ? env.db.schema : 'public';
const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  options: `-c search_path=${schema},public`,
});

async function migrateRoleNames() {
  if (!process.env.DB_NAME) {
    throw new Error('DB_NAME must be explicitly set before running the role migration.');
  }

  const sqlPath = path.join(__dirname, 'migrations', '20261023_rename_role_identifiers.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = await pool.connect();

  try {
    const { rows } = await client.query('SELECT current_database() AS database_name');
    if (rows[0].database_name !== env.db.name) {
      throw new Error('Connected database does not match configured DB_NAME; migration aborted.');
    }

    console.log(`Applying role-name migration to database "${rows[0].database_name}" using schema "${schema}"...`);
    await client.query(sql);
    console.log('Role-name migration completed.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrateRoleNames().catch((err) => {
  console.error('Role-name migration failed:', err.message);
  process.exitCode = 1;
  pool.end().catch(() => {});
});
