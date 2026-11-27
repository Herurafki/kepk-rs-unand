'use strict';
const pool = require('../config/database');

const create = async (data, client = pool) => {
  const { application_id, document_type, original_name, stored_name, file_path, mime_type, file_size, uploaded_by } = data;
  const result = await client.query(
    `INSERT INTO documents
       (application_id, document_type, original_name, stored_name, file_path, mime_type, file_size, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [application_id, document_type, original_name, stored_name, file_path, mime_type, file_size, uploaded_by]
  );
  return result.rows[0];
};

const findById = async (id) => {
  const result = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const findByApplicationId = async (applicationId) => {
  const result = await pool.query(
    'SELECT * FROM documents WHERE application_id = $1 ORDER BY created_at ASC',
    [applicationId]
  );
  return result.rows;
};

const remove = async (id) => {
  await pool.query('DELETE FROM documents WHERE id = $1', [id]);
};

module.exports = { create, findById, findByApplicationId, remove };
