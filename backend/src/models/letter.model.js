'use strict';
const pool = require('../config/database');

const generateLetterNumber = async (client = pool) => {
  const year = new Date().getFullYear();
  const result = await client.query(
    `SELECT COUNT(*) AS cnt FROM letters WHERE EXTRACT(YEAR FROM created_at) = $1`,
    [year]
  );
  const seq = parseInt(result.rows[0].cnt, 10) + 1;
  return `KEPK-LTR-${year}-${String(seq).padStart(6, '0')}`;
};

const create = async ({ application_id, letter_number, registration_number, letter_type, file_path, generated_file_path, issued_by_user_role_id, letter_status = 'GENERATED' }, client = pool) => {
  const letterNumber = letter_number || await generateLetterNumber(client);
  const result = await client.query(
    `INSERT INTO letters (application_id, letter_number, registration_number, letter_type, file_path, generated_file_path, issued_by_user_role_id, letter_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [application_id, letterNumber, registration_number || null, letter_type, file_path || null, generated_file_path || null, issued_by_user_role_id, letter_status]
  );
  return result.rows[0];
};

const updateGeneratedFile = async (id, filePath, client = pool) => {
  const result = await client.query(
    `UPDATE letters SET generated_file_path = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [filePath, id]
  );
  return result.rows[0] || null;
};

const updateSignedFile = async (id, filePath, client = pool) => {
  const result = await client.query(
    `UPDATE letters SET file_path = $1, letter_status = 'SIGNED_UPLOADED', updated_at = NOW() WHERE id = $2 RETURNING *`,
    [filePath, id]
  );
  return result.rows[0] || null;
};

const findByApplicationId = async (applicationId, client = pool) => {
  const result = await client.query('SELECT * FROM letters WHERE application_id = $1', [applicationId]);
  return result.rows[0] || null;
};

const findById = async (id) => {
  const result = await pool.query('SELECT * FROM letters WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const findAll = async () => {
  const result = await pool.query(`
    SELECT l.*, a.application_number, a.application_type, a.status AS application_status,
           u.name AS researcher_name, u.email AS researcher_email
    FROM letters l
    JOIN applications a ON a.id = l.application_id
    JOIN researchers r ON r.id = a.researcher_id
    JOIN users u ON u.id = r.user_id
    ORDER BY l.created_at DESC
  `);
  return result.rows;
};

module.exports = { create, updateGeneratedFile, updateSignedFile, findByApplicationId, findById, findAll };
