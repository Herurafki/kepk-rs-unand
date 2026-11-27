'use strict';
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

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

module.exports = pool;
