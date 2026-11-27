'use strict';
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const userModel = require('../models/user.model');

const BCRYPT_ROUNDS = 12;

const list = async () => userModel.findAll();

const getById = async (id) => {
  const user = await userModel.findByIdWithRoles(id);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  return user;
};

const listReviewers = async () => userModel.findReviewers();
const getReviewerProfile = async (userId) => {
  const profile = await userModel.findReviewerProfile(userId);
  if (!profile) { const err = new Error('Reviewer profile not found'); err.statusCode = 404; throw err; }
  return profile;
};
const updateReviewerProfile = async (userId, data) => {
  await userModel.upsertReviewerProfile(userId, data);
  return getReviewerProfile(userId);
};
const setReviewerActiveStatus = async (id, isActive, actorId) => {
  const roles = await userModel.findRolesByUserId(id);
  if (!roles.some((role) => role.name === 'REVIEWER')) { const err = new Error('Reviewer not found'); err.statusCode = 404; throw err; }
  return setActiveStatus(id, isActive, actorId);
};
const updateReviewerManagement = async (userId, data) => {
  const profile = await userModel.findReviewerProfile(userId);
  if (!profile) { const err = new Error('Reviewer not found'); err.statusCode = 404; throw err; }
  return userModel.updateReviewerManagement(userId, data);
};

const create = async ({ name, email, password, role, specialization, position }, creatorRoles = []) => {
  const permissions = {
    SUPERADMIN: ['SEKRETARIAT', 'KETUA', 'DIKLIT', 'REVIEWER'],
    SEKRETARIAT: ['REVIEWER'],
  };
  const canCreateRole = creatorRoles.some((creatorRole) => permissions[creatorRole]?.includes(role));
  if (!canCreateRole) {
    const err = new Error(`You are not allowed to create ${role} accounts`);
    err.statusCode = 403;
    throw err;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await userModel.findByEmail(normalizedEmail);
  if (existing) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await userModel.create({ name, email: normalizedEmail, hashedPassword }, client);
    if (role) await userModel.assignRoleByName(user.id, role, client);
    if (role === 'REVIEWER') {
      await client.query('INSERT INTO reviewers (user_id, specialization, position) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET specialization = EXCLUDED.specialization, position = EXCLUDED.position, updated_at = NOW()', [user.id, specialization || null, position || null]);
    }
    await client.query('COMMIT');
    return userModel.findByIdWithRoles(user.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const update = async (id, data = {}) => {
  const user = await userModel.findById(id);
  if (!user) { const err = new Error('User not found'); err.statusCode = 404; throw err; }

  const { role, ...profileData } = data;
  const hasRoleChange = Object.prototype.hasOwnProperty.call(data, 'role');
  if (hasRoleChange && (typeof role !== 'string' || !role.trim())) {
    const err = new Error('Role wajib dipilih.'); err.statusCode = 400; throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await userModel.update(id, profileData, client);

    if (hasRoleChange) {
      const roleResult = await client.query(
        "SELECT id FROM roles WHERE name = $1 AND name NOT IN ('SUPERADMIN', 'PENELITI')",
        [role.trim()]
      );
      if (!roleResult.rows[0]) {
        const err = new Error('Role tidak valid atau tidak dapat diubah melalui menu ini.');
        err.statusCode = 400;
        throw err;
      }

      await client.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
      await client.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
        [id, roleResult.rows[0].id]
      );
    }

    await client.query('COMMIT');
    return userModel.findByIdWithRoles(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const setActiveStatus = async (id, isActive, actorId) => {
  if (String(id) === String(actorId) && isActive === false) {
    const err = new Error('Anda tidak dapat menonaktifkan akun sendiri.');
    err.statusCode = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await userModel.findById(id);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const updated = await userModel.setActiveStatus(id, isActive, client);
    if (!isActive) await userModel.revokeUserRefreshTokens(id, client);
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const assignRole = async (userId, roleId) => {
  const user = await userModel.findById(userId);
  if (!user) { const err = new Error('User not found'); err.statusCode = 404; throw err; }
  return userModel.assignRoleById(userId, roleId);
};

const removeRole = async (userId, roleId) => userModel.removeRole(userId, roleId);

const getResearcherProfile = async (userId) => {
  const profile = await userModel.findResearcherByUserId(userId);
  if (!profile) { const err = new Error('Researcher profile not found'); err.statusCode = 404; throw err; }
  return profile;
};

const updateResearcherProfile = async (userId, data) => {
  const existingProfile = await userModel.findResearcherByUserId(userId);
  if (!existingProfile) {
    await userModel.createResearcher(userId, data);
  } else {
    await userModel.updateResearcher(userId, data);
  }

  // Return the updated user shape expected by the frontend auth store:
  // { user: { name, email, roles, researcher: { category, profile } } }.
  return { user: await userModel.findByIdWithRoles(userId) };
};

const updatePassword = async (id, password) => userModel.updatePassword(id, await bcrypt.hash(password, 10));
const getAllRoles = async () => userModel.getAll();

module.exports = {
  list,
  listReviewers,
  getReviewerProfile,
  updateReviewerProfile,
  updateReviewerManagement,
  setReviewerActiveStatus,
  getById,
  create,
  update,
  setActiveStatus,
  assignRole,
  removeRole,
  getResearcherProfile,
  updateResearcherProfile,
  updatePassword,
  getAllRoles,
};
