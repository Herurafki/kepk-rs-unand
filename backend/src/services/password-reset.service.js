'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const nodemailer = require('nodemailer');

const TOKEN_TTL_MINUTES = 15;
const BCRYPT_ROUNDS = 12;
const GENERIC_MESSAGE = 'Jika email terdaftar, instruksi pemulihan password akan dikirim.';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const createTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    const err = new Error('SMTP belum dikonfigurasi. Atur SMTP_HOST, SMTP_PORT, SMTP_USER, dan SMTP_PASS.');
    err.statusCode = 503;
    throw err;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
};

const requestPasswordReset = async (email) => {
  const transporter = createTransporter();
  const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  if (!frontendUrl) {
    const err = new Error('FRONTEND_URL belum dikonfigurasi untuk tautan reset password.');
    err.statusCode = 503;
    throw err;
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    const err = new Error('Email wajib diisi.');
    err.statusCode = 400;
    throw err;
  }

  const userResult = await pool.query(
    'SELECT id, name, email, is_active FROM users WHERE LOWER(email) = $1 LIMIT 1',
    [normalizedEmail]
  );
  const user = userResult.rows[0];

  // Return the same message for unknown and inactive accounts.
  if (!user || !user.is_active) return { message: GENERIC_MESSAGE };

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [user.id]
    );
    await client.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
  try {
    await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: 'Pemulihan Password KEPK',
    text: `Halo ${user.name},\n\nKami menerima permintaan untuk mengatur ulang password akun KEPK Anda. Buka tautan berikut dalam 15 menit:\n\n${resetUrl}\n\nJika Anda tidak meminta perubahan ini, abaikan email ini.`,
    html: `<p>Halo ${escapeHtml(user.name)},</p><p>Kami menerima permintaan untuk mengatur ulang password akun KEPK Anda.</p><p><a href="${resetUrl}">Atur Ulang Password</a></p><p>Tautan ini berlaku selama 15 menit dan hanya dapat digunakan satu kali.</p><p>Jika Anda tidak meminta perubahan ini, abaikan email ini.</p>`,
    });
  } catch (sendError) {
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1 AND used_at IS NULL', [tokenHash]);
    const err = new Error('Email pemulihan belum dapat dikirim. Periksa konfigurasi SMTP.');
    err.statusCode = 503;
    throw err;
  }

  return { message: GENERIC_MESSAGE };
};

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const resetPassword = async ({ token, password }) => {
  if (!token || typeof token !== 'string') {
    const err = new Error('Token reset tidak valid atau sudah kedaluwarsa.');
    err.statusCode = 400;
    throw err;
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    const err = new Error('Password baru harus terdiri dari 8 sampai 72 karakter.');
    err.statusCode = 400;
    throw err;
  }

  const tokenHash = sha256(token);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash]
    );
    const resetRecord = result.rows[0];
    if (!resetRecord) {
      const err = new Error('Token reset tidak valid atau sudah kedaluwarsa.');
      err.statusCode = 400;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await client.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, resetRecord.user_id]
    );
    await client.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [resetRecord.user_id]
    );
    await client.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [resetRecord.user_id]
    );
    await client.query('COMMIT');
    return { message: 'Password berhasil diubah. Silakan login menggunakan password baru.' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { requestPasswordReset, resetPassword };
