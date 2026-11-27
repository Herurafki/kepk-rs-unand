// models/researcher-category.model.js

const pool = require('../config/database');

const findAll = async () => {
  const result = await pool.query(`
    SELECT
      id,
      name
    FROM researchers_categories
    ORDER BY name ASC
  `);

  return result.rows;
};

module.exports = {
  findAll,
};