'use strict';
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const dbName = process.env.DB_NAME;
const schemaName = process.env.DB_SCHEMA;
const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

if (!dbName || !identifierPattern.test(dbName)) {
  throw new Error('Set DB_NAME explicitly to a valid database name before running db:setup.');
}
if (!schemaName || !identifierPattern.test(schemaName)) {
  throw new Error('Set DB_SCHEMA explicitly to a valid schema name (for example: v2) before running db:setup.');
}

const connectionConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
};

async function setupDatabase() {
  const adminClient = new Client({ ...connectionConfig, database: 'postgres' });

  try {
    await adminClient.connect();
    const exists = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );

    if (exists.rows.length === 0) {
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created.`);
    } else {
      console.log(`Database "${dbName}" already exists; no database reset will be performed.`);
    }
  } finally {
    await adminClient.end();
  }

  const appClient = new Client({
    ...connectionConfig,
    database: dbName,
    options: `-c search_path=${schemaName},public`,
  });

  try {
    await appClient.connect();
    await appClient.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await appClient.query(`SET search_path TO "${schemaName}", public`);

    const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await appClient.query(schemaSQL);
    console.log(`Canonical schema applied to ${dbName}.${schemaName}.`);

    const seedSQL = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    await appClient.query(seedSQL);
    console.log('Role seed data ensured.');

    console.log('Database setup complete. For an existing database, run npm run migrate after reviewing DB_NAME and DB_SCHEMA.');
  } finally {
    await appClient.end();
  }
}

setupDatabase().catch((err) => {
  console.error('Database setup failed:', err.message);
  process.exit(1);
});
