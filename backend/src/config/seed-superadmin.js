'use strict';

require('dotenv').config();

const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function seedSuperadmin() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'kepk_new',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    await client.connect();

    await client.query('BEGIN');

    // 1. Pastikan role SUPERADMIN tersedia
    const roleResult = await client.query(
      `
      INSERT INTO roles (name)
      VALUES ($1)
      ON CONFLICT (name)
      DO UPDATE SET name = EXCLUDED.name
      RETURNING id
      `,
      ['SUPERADMIN']
    );

    const roleId = roleResult.rows[0].id;

    // 2. Cek apakah user superadmin sudah ada
    const existingUser = await client.query(
      `
      SELECT id
      FROM users
      WHERE email = $1
      `,
      ['superadmin@gmail.com']
    );

    let userId;

    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;

      console.log('Superadmin sudah ada.');
    } else {
      // 3. Hash password
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);

      // 4. Buat user
      const userResult = await client.query(
        `
        INSERT INTO users (
          name,
          email,
          password,
          is_active
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id
        `,
        [
          'Super Administrator',
          'superadmin@gmail.com',
          hashedPassword,
          true
        ]
      );

      userId = userResult.rows[0].id;

      console.log('Superadmin berhasil dibuat.');
      console.log('Email    : superadmin@gmail.com');
      console.log('Password : password123');
    }

    // 5. Hubungkan user dengan role SUPERADMIN
    await client.query(
      `
      INSERT INTO user_roles (user_id, role_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      `,
      [userId, roleId]
    );

    await client.query('COMMIT');

    console.log('Role SUPERADMIN berhasil diberikan.');
  } catch (error) {
    await client.query('ROLLBACK');

    console.error(
      'Gagal membuat superadmin:',
      error.message
    );

    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

seedSuperadmin();