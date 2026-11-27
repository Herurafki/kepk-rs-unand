
'use strict';

const pool = require('../config/database');

const getInstitusi = async () => {
  const result = await pool.query(`
    SELECT id, nama_institusi, jenis
    FROM m_institusi
    ORDER BY id ASC
  `);

  return result.rows;
};

const getFakultas = async () => {
  const result = await pool.query(`
    SELECT id, nama_fakultas
    FROM m_fakultas
    ORDER BY id ASC
  `);

  return result.rows;
};

const getProdi = async () => {
  const result = await pool.query(`
    SELECT id, nama_prodi
    FROM m_prodi
    ORDER BY id ASC
  `);

  return result.rows;
};

module.exports = {
  getInstitusi,
  getFakultas,
  getProdi,
};
