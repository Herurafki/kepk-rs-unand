'use strict';

const bcrypt = require('bcrypt');
const pool = require('../config/database');
const userModel = require('../models/user.model');
const emailVerificationService = require('./email-verification.service');
const {
  generateAccessToken,
  generateRefreshToken,
} = require('../utils/jwt');

const BCRYPT_ROUNDS = 12;

/**
 * Convert backend role names to the role codes
 * expected by the Penma frontend.
 *
 * Internal backend roles remain unchanged.
 */
const normalizeRole = (role) => {
  const roleMap = {
    PENELITI: 'peneliti',
    DIKLIT: 'diklit',
    SEKRETARIAT: 'sekretariat',
    KETUA: 'ketua',
    REVIEWER: 'reviewer',
    SUPERADMIN: 'admin',
  };

  return roleMap[role] || role.toLowerCase();
};

/**
 * Register a new researcher user.
 */
const changePassword = async ({ userId, currentPassword, newPassword }) => {
  if (typeof currentPassword !== 'string' || !currentPassword) {
    const err = new Error('Password lama wajib diisi.'); err.statusCode = 400; throw err;
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 72) {
    const err = new Error('Password baru harus terdiri dari 8 sampai 72 karakter.'); err.statusCode = 400; throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await userModel.findPasswordById(userId, client);
    if (!user) { const err = new Error('Akun tidak ditemukan.'); err.statusCode = 404; throw err; }
    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) { const err = new Error('Password lama tidak sesuai.'); err.statusCode = 400; throw err; }
    if (await bcrypt.compare(newPassword, user.password)) {
      const err = new Error('Password baru harus berbeda dari password lama.'); err.statusCode = 400; throw err;
    }
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await userModel.updatePassword(userId, hashedPassword, client);
    await userModel.revokeUserRefreshTokens(userId, client);
    await client.query('COMMIT');
    return { message: 'Password berhasil diperbarui. Silakan login kembali.' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const register = async ({
  name,
  email,
  password,
  category_id,
  profile,
}) => {
  const normalizedEmail =
    email.toLowerCase().trim();

  const existing =
    await userModel.findByEmail(normalizedEmail);

  if (existing) {
    const err =
      new Error('Email already registered');

    err.statusCode = 409;

    throw err;
  }

  // Cek kategori
  const category =
    await userModel.findCategoryById(
      category_id
    );

  if (!category) {
    const err =
      new Error('Invalid researcher category');

    err.statusCode = 400;

    throw err;
  }

  const hashedPassword =
    await bcrypt.hash(
      password,
      BCRYPT_ROUNDS
    );

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Serialize registrations for the same NIK to prevent simultaneous duplicates.
    const normalizedNik = profile?.nik ? String(profile.nik).trim() : '';
    if (normalizedNik) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`researcher-nik:${normalizedNik}`]);
      const nikExists = await userModel.existsResearcherNik(normalizedNik, client);
      if (nikExists) {
        const err = new Error('NIK sudah terdaftar. Gunakan NIK lain atau masuk menggunakan akun yang sudah terdaftar.');
        err.statusCode = 409;
        throw err;
      }
    }

    // Create user
    const user =
      await userModel.create(
        {
          name,
          email: normalizedEmail,
          hashedPassword,
          emailVerified: false,
        },
        client
      );

    // Assign researcher role
    await userModel.assignRoleByName(
      user.id,
      'PENELITI',
      client
    );

    // Create researcher profile
    const researcher =
      await userModel.createResearcher(
        user.id,
        {
          category_id,
          ...profile,
        },
        client
      );

    await client.query('COMMIT');

    const verification = await emailVerificationService.sendVerificationEmail(user.id).catch(() => ({ sent: false }));

    return {
      id: String(user.id),
      name: user.name,
      email: user.email,
      is_active: user.is_active,
      roles: ['peneliti'],
      email_verified: false,
      verification_email_sent: verification.sent,
      researcher,
    };

  } catch (err) {
    await client.query('ROLLBACK');

    throw err;

  } finally {
    client.release();
  }
};

/**
 * Login.
 *
 * Internal role names are stored in the JWT because
 * backend authorization uses names such as REVIEWER
 * and KETUA.
 *
 * Frontend receives normalized Penma role codes.
 */
const login = async ({
  email,
  password,
  nik,
}) => {
  
  if (!email && !nik) {
    const err = new Error('Email or NIK is required');
    err.statusCode = 400;
    throw err;
  }

  // Cari user berdasarkan identifier yang tersedia
  let user;
  if (email) {
    const normalizedEmail = String(email).toLowerCase().trim();
    user = await userModel.findByEmail(normalizedEmail);
  } else {
    const normalizedNik = String(nik).trim();
    user = await userModel.findByNik(normalizedNik);
  }

  if (!user) {
    const err =
      new Error('Invalid credentials');

    err.statusCode = 401;

    throw err;
  }

  if (!user.is_active) {
    const err =
      new Error('Account is deactivated');

    err.statusCode = 401;

    throw err;
  }

  const passwordMatch =
    await bcrypt.compare(
      password,
      user.password
    );

  delete user.password;

  if (!passwordMatch) {
    const err =
      new Error('Invalid email or password');

    err.statusCode = 401;

    throw err;
  }

  const roles =
    await userModel.findRolesByUserId(
      user.id
    );

  const internalRoles =
    roles.map((role) => role.name);

  if (internalRoles.includes('PENELITI') && user.email_verified !== true) {
    const err = new Error('Email belum diverifikasi. Silakan buka tautan verifikasi yang dikirim ke email Anda.');
    err.statusCode = 403; err.code = 'EMAIL_NOT_VERIFIED'; throw err;
  }

  // Only successful credential logins update this timestamp; refresh/logout do not.
  await userModel.updateLastLogin(user.id);

  const frontendRoles =
    internalRoles.map(normalizeRole);

  const refreshToken =
    generateRefreshToken();

  const expiresInDays =
    parseInt(
      process.env.JWT_REFRESH_EXPIRES_IN,
      10
    ) || 7;

  const expiresAt =
    new Date(
      Date.now() +
        expiresInDays *
          24 *
          60 *
          60 *
          1000
    );

  const session = await userModel.createRefreshToken(
    user.id,
    refreshToken,
    expiresAt
  );

  const accessToken = generateAccessToken({
    sub: user.id,
    sid: String(session.id),
    name: user.name,
    email: user.email,
    roles: internalRoles,
  });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,

    user: {
      id: String(user.id),
      name: user.name,
      email: user.email,
      is_active: user.is_active,
      roles: frontendRoles,
    },
  };
};

/**
 * Logout by revoking the refresh token.
 */
const logout = async (refreshToken) => {
  if (!refreshToken) {
    return;
  }

  await userModel.revokeRefreshToken(
    refreshToken
  );
};

/**
 * Exchange refresh token for a new access token.
 */
const refresh = async (
  refreshToken
) => {
  if (!refreshToken) {
    const err =
      new Error(
        'Refresh token is required'
      );

    err.statusCode = 400;

    throw err;
  }

  const tokenRecord =
    await userModel.findRefreshToken(
      refreshToken
    );

  if (!tokenRecord) {
    const err =
      new Error(
        'Invalid refresh token'
      );

    err.statusCode = 401;

    throw err;
  }

  if (tokenRecord.revoked_at) {
    const err =
      new Error(
        'Refresh token has been revoked'
      );

    err.statusCode = 401;

    throw err;
  }

  if (
    new Date(tokenRecord.expires_at) <
    new Date()
  ) {
    const err =
      new Error(
        'Refresh token has expired'
      );

    err.statusCode = 401;

    throw err;
  }

  const settings = await userModel.getIdleSettings();
  const lastActivity = new Date(tokenRecord.last_activity_at || tokenRecord.created_at || tokenRecord.expires_at);
  const idleLimitMs = settings.idle_timeout_minutes * 60 * 1000;
  if (Date.now() - lastActivity.getTime() >= idleLimitMs) {
    await userModel.revokeRefreshToken(refreshToken);
    const err = new Error('Sesi berakhir karena tidak ada aktivitas. Silakan login kembali.');
    err.statusCode = 401;
    throw err;
  }

  const user =
    await userModel.findById(
      tokenRecord.user_id
    );

  if (!user || !user.is_active) {
    const err =
      new Error(
        'User account is not active'
      );

    err.statusCode = 401;

    throw err;
  }

  const roles =
    await userModel.findRolesByUserId(
      user.id
    );

  const internalRoles =
    roles.map((role) => role.name);

  await userModel.touchSession(tokenRecord.id);
  const accessToken = generateAccessToken({
    sub: user.id,
    sid: String(tokenRecord.id),
    name: user.name,
    email: user.email,
    roles: internalRoles,
  });

  return {
    access_token: accessToken,
  };
};

/**
 * Exchange refresh token for a new access token.
 */
const formatResearcherProfile = (
  researcher
) => {
  if (!researcher) {
    return null;
  }

  const category =
    researcher.category?.name;

  const profile =
    researcher.profile || {};

  switch (category) {
    case 'Mahasiswa':
      return {
        nim: profile.nim,
        nik: profile.nik,
        institution: profile.institution,
        faculty: profile.faculty,
        program_study: profile.program_study,
        phone: profile.phone,
        address: profile.address,
      };

    case 'Dosen':
      return {
        nip: profile.nip,
        nik: profile.nik,
        institution: profile.institution,
        faculty: profile.faculty,
        program_study: profile.program_study,
        phone: profile.phone,
        address: profile.address,
      };

    case 'Staff':
      return {
        nip: profile.nip,
        nik: profile.nik,
        institution: profile.institution,
        department: profile.department,
        phone: profile.phone,
        address: profile.address,
      };

    case 'Umum':
      return {
        nik: profile.nik,
        institution: profile.institution,
        phone: profile.phone,
        address: profile.address,
      };

    default:
      return profile;
  }
};

/**
 * Get current user profile.
 *
 * Roles are normalized for the Penma frontend.
 */
const getProfile = async (userId) => {
  const user =
    await userModel.findByIdWithRoles(
      userId
    );

  if (!user) {
    const err =
      new Error('User not found');

    err.statusCode = 404;

    throw err;
  }

  const roles =
    Array.isArray(user.roles)
      ? user.roles.map((role) => {
          const roleName =
            typeof role === 'object'
              ? role.name
              : role;

          return normalizeRole(roleName);
        })
      : [];

  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    is_active: user.is_active,
    roles,
    researcher: user.researcher
    ? {
      id: String(user.researcher.id),
      category: user.researcher.category,
      profile:
      formatResearcherProfile(
          user.researcher
        ),
    }
  : null,
  };
};

module.exports = {
  register,
  verifyEmail: emailVerificationService.verifyEmail,
  resendVerification: emailVerificationService.resendVerification,
  changePassword,
  login,
  logout,
  refresh,
  getProfile,
};