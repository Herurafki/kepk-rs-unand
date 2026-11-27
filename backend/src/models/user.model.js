'use strict';
const pool = require('../config/database');

/**
 * Find a user by email (includes roles).
 */
const findByEmail = async (email) => {
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.password, u.is_active, u.email_verified, u.created_at, u.updated_at
     FROM users u
     WHERE LOWER(TRIM(u.email)) = LOWER(TRIM($1))
     LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
};

/**
 * Find a researcher account by its NIK.
 * NIK belongs to the researchers profile, not users.id.
 */
const findByNik = async (nik) => {
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.password, u.is_active, u.email_verified, u.created_at, u.updated_at,
            r.nik
     FROM users u
     JOIN researchers r ON r.user_id = u.id
     WHERE TRIM(r.nik) = TRIM($1)
     LIMIT 1`,
    [String(nik)]
  );
  return result.rows[0] || null;
};

/**
 * Check whether a NIK is already used by another researcher profile.
 * Accepts a transaction client so registration checks are atomic.
 */
const existsResearcherNik = async (nik, client = pool) => {
  const result = await client.query(
    `SELECT 1
     FROM researchers
     WHERE TRIM(nik) = TRIM($1)
     LIMIT 1`,
    [String(nik)]
  );
  return result.rowCount > 0;
};

/**
 * Find a user by ID.
 */
const updateLastLogin = async (userId, client = pool) => {
  const result = await client.query(
    'UPDATE users SET last_login_at = NOW() WHERE id = $1 RETURNING last_login_at',
    [userId]
  );
  return result.rows[0]?.last_login_at || null;
};

/**
 * Find a user by ID.
 */
const findById = async (id) => {
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.is_active, u.created_at, u.updated_at
     FROM users u
     WHERE u.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Get all roles for a user.
 */
const findRolesByUserId = async (userId) => {
  const result = await pool.query(
    `SELECT r.name, ur.id AS user_role_id
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1`,
    [userId]
  );
  return result.rows;
};

/**
 * Create a new user (returns the new user row).
 */
const create = async ({ name, email, hashedPassword, emailVerified = true }, client = pool) => {
  const result = await client.query(
    `INSERT INTO users (name, email, password, email_verified)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, is_active, email_verified, created_at, updated_at`,
    [name, email, hashedPassword, emailVerified]
  );
  return result.rows[0];
};

/**
 * Assign a role to a user by role name.
 */
const assignRoleByName = async (userId, roleName, client = pool) => {
  const roleResult = await client.query(
    'SELECT id FROM roles WHERE name = $1',
    [roleName]
  );
  if (!roleResult.rows[0]) throw new Error(`Role ${roleName} not found`);
  const roleId = roleResult.rows[0].id;

  const result = await client.query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING
     RETURNING id, user_id, role_id`,
    [userId, roleId]
  );
  return result.rows[0];
};

/**
 * Create a researcher profile.
 */
const createResearcher = async (userId, profileData = {}, client = pool) => {
  const { institution, faculty, phone, program_study, address, nip, nim, nik, department, category_id } = profileData;
  const result = await client.query(
    `INSERT INTO researchers (user_id, institution, faculty, phone, program_study, address, nip, nim, nik, department, category_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [userId, institution || null, faculty || null, phone || null,
     program_study || null, address || null, nip || null, nim || null, nik || null, department || null, category_id || null]
  );
  return result.rows[0];
};

/**
 * Get researcher profile by user_id.
 */
const findResearcherByUserId = async (userId) => {
  const result = await pool.query(
    'SELECT * FROM researchers WHERE user_id = $1',
    [userId]
  );
  return result.rows[0] || null;
};

/**
 * Update researcher profile.
 */
const updateResearcher = async (userId, profileData = {}) => {
  const allowedFields = [
    'institution', 'faculty', 'phone', 'program_study', 'address',
    'nip', 'nim', 'nik', 'department', 'category_id',
  ];
  const fields = allowedFields.filter((field) =>
    Object.prototype.hasOwnProperty.call(profileData, field)
  );

  if (fields.length === 0) return findResearcherByUserId(userId);

  const values = fields.map((field) => {
    const value = profileData[field];
    return value === '' ? null : value;
  });
  const assignments = fields.map((field, index) => field + ' = $' + (index + 1));
  assignments.push('updated_at = NOW()');
  const sql = 'UPDATE researchers SET ' + assignments.join(', ') +
    ' WHERE user_id = $' + (values.length + 1) + ' RETURNING *';

  const result = await pool.query(sql, [...values, userId]);
  return result.rows[0] || null;
};
/**
 * Store a refresh token.
 */
const createRefreshToken = async (userId, token, expiresAt, client = pool) => {
  const result = await client.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, token, expiresAt]
  );
  return result.rows[0];
};

/**
 * Find a refresh token by its value.
 */
const findRefreshToken = async (token) => {
  const result = await pool.query(
    `SELECT * FROM refresh_tokens WHERE token = $1`,
    [token]
  );
  return result.rows[0] || null;
};

/**
 * Revoke a refresh token.
 */
const revokeRefreshToken = async (token) => {
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = $1`,
    [token]
  );
};


const findRefreshTokenById = async (id) => {
  const result = await pool.query('SELECT * FROM refresh_tokens WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const touchSession = async (id) => {
  await pool.query('UPDATE refresh_tokens SET last_activity_at = NOW() WHERE id = $1 AND revoked_at IS NULL', [id]);
};

const getIdleSettings = async () => {
  const result = await pool.query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('idle_timeout_minutes', 'idle_warning_minutes')");
  const values = Object.fromEntries(result.rows.map((row) => [row.setting_key, Number(row.setting_value)]));
  return { idle_timeout_minutes: values.idle_timeout_minutes || 30, idle_warning_minutes: values.idle_warning_minutes || 1 };
};

const updateIdleSettings = async ({ idle_timeout_minutes, idle_warning_minutes }, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries({ idle_timeout_minutes, idle_warning_minutes })) {
      await client.query(`INSERT INTO system_settings (setting_key, setting_value, updated_by, updated_at)
        VALUES ($1, $2::jsonb, $3, NOW())
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [key, JSON.stringify(value), userId]);
    }
    await client.query('COMMIT');
    return getIdleSettings();
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
};

/**
 * List all users (admin).
 */
const findAll = async () => {
  const result = await pool.query(`
    SELECT u.id, u.name, u.email, u.is_active, u.last_login_at,
      COALESCE(jsonb_agg(jsonb_build_object('name', r.name, 'user_role_id', ur.id))
      FILTER (WHERE r.name IS NOT NULL), '[]'::jsonb) AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `);
  return result.rows;
};

/**
 * Find user by ID with roles.
 */
const findByIdWithRoles = async (id) => {
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.is_active, u.created_at, u.updated_at,
            COALESCE(
              json_agg(json_build_object('name', r.name, 'user_role_id', ur.id))
              FILTER (WHERE r.name IS NOT NULL), '[]'
            ) AS roles,
             CASE
              WHEN res.id IS NOT NULL THEN
                jsonb_build_object(
                  'id', res.id,
                  'category', CASE
                    WHEN rc.id IS NOT NULL THEN
                      jsonb_build_object(
                        'id', rc.id,
                        'name', rc.name
                      )
                    ELSE NULL
                  END,
                  'profile', jsonb_build_object(
                    'institution', res.institution,
                    'faculty', res.faculty,
                    'phone', res.phone,
                    'program_study', res.program_study,
                    'address', res.address,
                    'nip', res.nip,
                    'nim', res.nim,
                    'nik', res.nik,
                    'department', res.department
                  )
                )
              ELSE NULL
            END AS researcher
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     LEFT JOIN researchers res ON res.user_id = u.id
     LEFT JOIN researchers_categories rc ON rc.id = res.category_id
     WHERE u.id = $1
     GROUP BY u.id, res.id, rc.id`,
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Update user.
 */
const update = async (id, { name, email, is_active }, client = pool) => {
  const result = await client.query(
    `UPDATE users SET name=COALESCE($1, name), email=COALESCE($2, email),
     is_active=COALESCE($3, is_active), updated_at=NOW()
     WHERE id=$4
     RETURNING id, name, email, is_active, created_at, updated_at`,
    [name || null, email || null, is_active !== undefined ? is_active : null, id]
  );
  return result.rows[0] || null;
};

/**
 * Assign role by role ID.
 */
const assignRoleById = async (userId, roleId) => {
  const result = await pool.query(
    `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING
     RETURNING id, user_id, role_id`,
    [userId, roleId]
  );
  return result.rows[0];
};

/**
 * Remove role.
 */
const removeRole = async (userId, roleId) => {
  await pool.query(
    'DELETE FROM user_roles WHERE user_id=$1 AND role_id=$2',
    [userId, roleId]
  );
};

/**
 * Find available reviewers.
 */
const findReviewers = async () => {
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.is_active,
            rv.specialization, rv.position, rv.organization, rv.phone, rv.address
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     LEFT JOIN reviewers rv ON rv.user_id = u.id
     WHERE r.name = 'REVIEWER' ORDER BY u.name`
  );
  return result.rows;
};

const findReviewerProfile = async (userId) => {
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, rv.specialization, rv.position,
            rv.organization, rv.phone, rv.address
     FROM users u JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id AND r.name = 'REVIEWER'
     LEFT JOIN reviewers rv ON rv.user_id = u.id WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] || null;
};

const upsertReviewerProfile = async (userId, data = {}, client = pool) => {
  const { organization, phone, address } = data;
  const result = await client.query(
    `INSERT INTO reviewers (user_id, organization, phone, address)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET organization=EXCLUDED.organization,
       phone=EXCLUDED.phone, address=EXCLUDED.address, updated_at=NOW() RETURNING *`,
    [userId, organization || null, phone || null, address || null]
  );
  return result.rows[0];
};

const updateReviewerManagement = async (userId, data = {}) => {
  const { name, email, specialization, position } = data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET name=COALESCE($1,name), email=COALESCE($2,email), updated_at=NOW() WHERE id=$3',
      [name || null, email || null, userId]);
    await client.query(
      `INSERT INTO reviewers (user_id, specialization, position) VALUES ($1,$2,$3)
       ON CONFLICT (user_id) DO UPDATE SET specialization=EXCLUDED.specialization,
       position=EXCLUDED.position, updated_at=NOW()`,
      [userId, specialization || null, position || null]);
    await client.query('COMMIT');
    return findReviewerProfile(userId);
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
};

const findCategoryById = async (
  categoryId,
  client = pool
) => {
  const result = await client.query(
    `
    SELECT id, name
    FROM researchers_categories
    WHERE id = $1
    `,
    [categoryId]
  );

  return result.rows[0] || null;
};

const findPasswordById = async (id, client = pool) => {
  const result = await client.query('SELECT id, password FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const updatePassword = async (id, hashedPassword, client = pool) => {
  const result = await client.query(
    `
    UPDATE users
    SET
      password = $1,
      updated_at = NOW()
    WHERE id = $2
    RETURNING id, name, email, is_active, created_at, updated_at
    `,
    [hashedPassword, id]
  );

  return result.rows[0] || null;
};

const setActiveStatus = async (userId, isActive, client = pool) => {
  const result = await client.query(
    `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, name, email, is_active, created_at, updated_at`,
    [isActive, userId]
  );
  return result.rows[0] || null;
};

const revokeUserRefreshTokens = async (userId, client = pool) => {
  await client.query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  );
};

const getAll = async () => {
  const result = await pool.query(`
    SELECT id, name
    FROM roles
    WHERE name NOT IN ('SUPERADMIN', 'PENELITI')
    ORDER BY name ASC
  `);

  return result.rows;
};

module.exports = {
  findByEmail,
  findByNik,
  existsResearcherNik,
  updateLastLogin,
  findById,
  findRolesByUserId,
  findCategoryById,
  create,
  assignRoleByName,
  createResearcher,
  findResearcherByUserId,
  updateResearcher,
  createRefreshToken,
  findRefreshToken,
  findRefreshTokenById,
  touchSession,
  getIdleSettings,
  updateIdleSettings,
  revokeRefreshToken,
  findAll,
  findByIdWithRoles,
  update,
  assignRoleById,
  removeRole,
  findReviewers,
  findReviewerProfile,
  upsertReviewerProfile,
  updateReviewerManagement,
  findPasswordById,
  updatePassword,
  revokeUserRefreshTokens,
  setActiveStatus,
  getAll
};
