'use strict';
const pool = require('../config/database');

const reserveApplicationNumber = async (client = pool) => {
  const result = await client.query(`INSERT INTO application_number_counters (year, last_value) VALUES (EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, 1) ON CONFLICT (year) DO UPDATE SET last_value = application_number_counters.last_value + 1, updated_at = NOW() RETURNING year, last_value`);
  const { year, last_value } = result.rows[0]; return `APP-${year}-${String(last_value).padStart(6, '0')}`;
};

const create = async (data, client = pool) => {
  const { researcher_id, application_number, application_type, parent_application_id, group_category, research_title, research_background, research_objectives, research_methodology, research_location, research_institution, research_duration, data_collection_date, data_needed, purpose, person_responsible } = data;
  const result = await client.query(`INSERT INTO applications (researcher_id, application_number, application_type, parent_application_id, group_category, research_title, research_background, research_objectives, research_methodology, research_location, research_institution, research_duration, data_collection_date, data_needed, purpose, person_responsible) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`, [researcher_id, application_number, application_type || 'IZIN_PENELITIAN', parent_application_id || null, group_category, research_title, research_background || null, research_objectives || null, research_methodology || null, research_location || null, research_institution || null, research_duration || null, data_collection_date || null, data_needed || null, purpose || null, person_responsible || null]);
  return result.rows[0];
};

const findById = async (id, client = pool) => {
  const result = await client.query(`SELECT a.*, r.user_id AS researcher_user_id, u.name AS researcher_name, u.email AS researcher_email, rc.name AS researcher_category, r.nim AS researcher_nim, r.nip AS researcher_nip, r.nik AS researcher_nik, r.phone AS researcher_phone, r.address AS researcher_address, r.institution AS researcher_institution, r.faculty AS researcher_faculty, r.program_study AS researcher_program_study, r.department AS researcher_department, p.application_number AS parent_application_number, p.application_type AS parent_application_type,
    CASE WHEN s.id IS NULL THEN NULL ELSE json_build_object(
      'id', s.id,
      'application_id', s.application_id,
      'screening_type', s.screening_type,
      'answers', s.answers,
      'recommendation', s.recommendation,
      'created_at', s.created_at,
      'updated_at', s.updated_at
    ) END AS screening,
    EXISTS (SELECT 1 FROM applications ea WHERE ea.parent_application_id = a.id AND ea.application_type::text = 'IZIN_ETIK') AS has_ethics_application,
    (SELECT fd.decision FROM final_decisions fd WHERE fd.application_id = a.id ORDER BY fd.decision_at DESC LIMIT 1) AS final_decision
    FROM applications a
    JOIN researchers r ON r.id = a.researcher_id
    JOIN users u ON u.id = r.user_id
    LEFT JOIN researchers_categories rc ON rc.id = r.category_id
    LEFT JOIN applications p ON p.id = a.parent_application_id
    LEFT JOIN application_screenings s ON s.application_id = a.id
    WHERE a.id = $1`, [id]);
  return result.rows[0] || null;
};
const findByIdForUpdate = async (id, client = pool) => {
  const result = await client.query(`SELECT a.*, r.user_id AS researcher_user_id, p.application_number AS parent_application_number, p.application_type AS parent_application_type FROM applications a JOIN researchers r ON r.id = a.researcher_id LEFT JOIN applications p ON p.id = a.parent_application_id WHERE a.id = $1 FOR UPDATE OF a`, [id]);
  return result.rows[0] || null;
};
const findEthicsByParentId = async (parentId, client = pool) => {
  const result = await client.query(`SELECT * FROM applications WHERE parent_application_id = $1 AND application_type = 'IZIN_ETIK' ORDER BY created_at DESC LIMIT 1`, [parentId]);
  return result.rows[0] || null;
};
const findByResearcherId = async (researcherId) => (await pool.query('SELECT * FROM applications WHERE researcher_id = $1 ORDER BY created_at DESC', [researcherId])).rows;

const findForReviewer = async (reviewerId) => (await pool.query(
  `SELECT a.*, r.user_id AS researcher_user_id, u.name AS researcher_name, u.email AS researcher_email, p.application_number AS parent_application_number
   FROM applications a
   JOIN researchers r ON r.id = a.researcher_id
   JOIN users u ON u.id = r.user_id
   LEFT JOIN applications p ON p.id = a.parent_application_id
   WHERE a.status IN ('WAITING_REVIEWER', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'REVIEW_COMPLETED')
     AND a.review_type::text IS DISTINCT FROM 'EXEMPTED'
     AND (
       (
         a.status IN ('UNDER_REVIEW', 'REVISION_REQUIRED', 'REVIEW_COMPLETED')
         AND a.review_type = 'FULLBOARD'
       )
       OR EXISTS (
         SELECT 1
         FROM review_assignments ra
         WHERE ra.application_id = a.id
           AND ra.reviewer_id = $1
           AND ra.status IN ('PENDING', 'ACCEPTED', 'COMPLETED')
       )
     )
     AND (
       a.review_type::text IS DISTINCT FROM 'EXPEDITED'
       OR NOT EXISTS (
         SELECT 1
         FROM expedited_reviewer_states ers
         WHERE ers.application_id = a.id
           AND ers.reviewer_id = $1
           AND ers.state IN ('NEEDS_REVISION', 'FINAL')
       )
     )
   ORDER BY a.created_at DESC`,
  [reviewerId]
)).rows;

const findAll = async (filters = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.researcher_id) {
    conditions.push(`a.researcher_id = $${idx++}`);
    params.push(filters.researcher_id);
  }

  if (filters.status) {
    conditions.push(
      Array.isArray(filters.status)
        ? `a.status = ANY($${idx++})`
        : `a.status = $${idx++}`
    );
    params.push(filters.status);
  }

  if (filters.application_type) {
    conditions.push(
      Array.isArray(filters.application_type)
        ? `a.application_type::text = ANY($${idx++})`
        : `a.application_type::text = $${idx++}`
    );
    params.push(filters.application_type);
  }

  if (filters.not_status) {
    conditions.push(`a.status != $${idx++}`);
    params.push(filters.not_status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const researcherProfileSelect = filters.include_researcher_profile
    ? `, rc.name AS researcher_category, r.nim AS researcher_nim, r.nip AS researcher_nip,
         r.nik AS researcher_nik, r.address AS researcher_address,
         r.institution AS researcher_institution, r.faculty AS researcher_faculty,
         r.program_study AS researcher_program_study, r.department AS researcher_department`
    : '';
  const researcherCategoryJoin = filters.include_researcher_profile
    ? 'LEFT JOIN researchers_categories rc ON rc.id = r.category_id'
    : '';

  const result = await pool.query(
    `SELECT a.*, r.user_id AS researcher_user_id, u.name AS researcher_name,
            u.email AS researcher_email, r.phone AS researcher_phone,
            p.application_number AS parent_application_number
            ${researcherProfileSelect},
            EXISTS (SELECT 1 FROM applications ea WHERE ea.parent_application_id = a.id AND ea.application_type::text = 'IZIN_ETIK') AS has_ethics_application
     FROM applications a
     JOIN researchers r ON r.id = a.researcher_id
     JOIN users u ON u.id = r.user_id
     ${researcherCategoryJoin}
     LEFT JOIN applications p ON p.id = a.parent_application_id
     ${where}
     ORDER BY a.created_at DESC`,
    params
  );

  return result.rows;
};

const update = async (id, data, client = pool) => {
  const fields = ['group_category','research_title','research_background','research_objectives','research_methodology','research_location','research_institution','research_duration','data_collection_date','data_needed','purpose','person_responsible'];
  const setClauses = []; const params = []; let idx = 1;
  for (const field of fields) if (data[field] !== undefined) { setClauses.push(`${field} = $${idx++}`); params.push(data[field]); }
  if (!setClauses.length) return findById(id, client);
  setClauses.push('updated_at = NOW()'); params.push(id);
  const result = await client.query(`UPDATE applications SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`, params); return result.rows[0] || null;
};
const updateStatus = async (id, status, client = pool) => (await client.query(`UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [status, id])).rows[0] || null;
const setRequiresEthics = async (id, value, client = pool) => (await client.query(`UPDATE applications SET requires_ethics = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [value, id])).rows[0] || null;
const updateReviewType = async (id, reviewType, client = pool) => (await client.query(`UPDATE applications SET review_type = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [reviewType, id])).rows[0] || null;
const remove = async (id, client = pool) => { await client.query('DELETE FROM applications WHERE id = $1', [id]); };
module.exports = { reserveApplicationNumber, create, findById, findByIdForUpdate, findEthicsByParentId, findByResearcherId, findForReviewer, findAll, update, updateStatus, setRequiresEthics, updateReviewType, remove };
