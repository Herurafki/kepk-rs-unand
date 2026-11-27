'use strict';
const pool = require('../config/database');

/**
 * Verification model — repository layer for Diklat admin verification workflow.
 * Provides enriched queries specific to the administrative review process.
 */

/**
 * List applications for the admin queue.
 * Returns applications in the given status array, joined with researcher info.
 * @param {string[]} statuses - Array of status strings to filter by
 * @returns {Promise<Object[]>}
 */
const findByStatuses = async (statuses, applicationTypes = null) => {
  const result = await pool.query(
    `SELECT
       a.id,
       a.application_number,
       a.application_type,
       a.group_category,
       a.research_title,
       a.research_location,
       a.research_institution,
       a.research_duration,
       a.status,
       a.review_type,
       a.created_at,
       a.updated_at,
       r.id        AS researcher_id,
       u.name      AS researcher_name,
       u.email     AS researcher_email,
       r.institution AS researcher_institution,
       r.faculty     AS researcher_faculty,
       r.phone       AS researcher_phone,
       r.program_study AS researcher_program_study,
       r.nip           AS researcher_nip,
       rc.name         AS researcher_category
     FROM applications a
     JOIN researchers r ON r.id = a.researcher_id
     JOIN users u ON u.id = r.user_id
     LEFT JOIN researchers_categories rc ON rc.id = r.category_id
     WHERE a.status = ANY($1)
       AND ($2::text[] IS NULL OR a.application_type::text = ANY($2))
     ORDER BY a.created_at DESC`,
    [statuses, applicationTypes]
  );
  return result.rows;
};

/**
 * Get a single application with full detail for admin inspection.
 * Includes researcher profile, screening result, and all uploaded documents.
 * @param {string} applicationId
 * @returns {Promise<Object|null>}
 */
const findByIdWithDetails = async (applicationId, viewerUserId = null) => {
  // Fetch application + researcher info
  const appResult = await pool.query(
    `SELECT
       a.*,
       r.id        AS researcher_id,
       u.name      AS researcher_name,
       u.email     AS researcher_email,
       r.institution AS researcher_institution,
       r.faculty     AS researcher_faculty,
       r.phone       AS researcher_phone,
       r.program_study AS researcher_program_study,
       r.address     AS researcher_address,
       r.nip         AS researcher_nip,
       r.nim         AS researcher_nim,
       r.nik         AS researcher_nik,
       r.department  AS researcher_department,
       rc.name         AS researcher_category,
       latest_verifier.verifier_id,
       verifier_user.name  AS verifier_name,
       verifier_user.email AS verifier_email
     FROM applications a
     JOIN researchers r ON r.id = a.researcher_id
     JOIN users u ON u.id = r.user_id
     LEFT JOIN researchers_categories rc ON rc.id = r.category_id
     LEFT JOIN LATERAL (
       SELECT h.changed_by AS verifier_id
       FROM application_status_histories h
       WHERE h.application_id = a.id
         AND h.new_status = 'ADMIN_REVIEW'
       ORDER BY h.created_at DESC, h.id DESC
       LIMIT 1
     ) latest_verifier ON TRUE
     LEFT JOIN users verifier_user ON verifier_user.id = latest_verifier.verifier_id
     WHERE a.id = $1`,
    [applicationId]
  );

  const app = appResult.rows[0];
  if (!app) return null;

  // Attach institutional cover-letter details for DATA_AWAL and IZIN_PENELITIAN.
  // Ethics applications intentionally do not use this correspondence block.
  if (['DATA_AWAL', 'IZIN_PENELITIAN'].includes(app.application_type)) {
    const correspondenceResult = await pool.query(
      'SELECT incoming_letter_number, incoming_letter_subject, signatory_position, recipient_institution, incoming_letter_date FROM application_correspondence WHERE application_id = $1',
      [applicationId]
    );
    app.correspondence = correspondenceResult.rows[0] || null;
  } else {
    app.correspondence = null;
  }

  // Fetch screening result, including the calculated recommendation.
  const screeningResult = await pool.query(
    `SELECT
       id,
       application_id,
       screening_type,
       answers,
       recommendation,
       created_at,
       updated_at
     FROM application_screenings
     WHERE application_id = $1`,
    [applicationId]
  );

  const screening = screeningResult.rows[0] || null;

  app.screening = screening
    ? {
        id: screening.id,
        application_id: screening.application_id,
        screening_type: screening.screening_type,
        answers: screening.answers,
        recommendation: screening.recommendation,
        created_at: screening.created_at,
        updated_at: screening.updated_at,
      }
    : null;

  // Fetch documents for this application
  const docsResult = await pool.query(
    `SELECT
       d.id,
       d.document_type,
       d.original_name,
       d.stored_name,
       d.file_path,
       d.mime_type,
       d.file_size,
       d.created_at,
       u.name AS uploaded_by_name
     FROM documents d
     JOIN users u ON u.id = d.uploaded_by
     WHERE d.application_id = $1
     ORDER BY d.created_at ASC`,
    [applicationId]
  );

  app.documents = docsResult.rows;

  // Include structured reviewer assessments and recommendations in the
  // Secretariat detail response so the UI can render actual review results.
  const reviewModel = require('./review.model');
  app.review_results = await reviewModel.findRecommendationsByApplicationId(applicationId);


  // Server-side permission flag: only the DIKLAT user who opened
  // the ADMIN_REVIEW task may execute verification actions.
  app.can_verify = Boolean(
    app.status === 'ADMIN_REVIEW' &&
    viewerUserId != null &&
    app.verifier_id != null &&
    String(app.verifier_id) === String(viewerUserId)
  );

  return app;
};

/**
 * Get the latest revision request for an application.
 * @param {string} applicationId
 * @returns {Promise<Object|null>}
 */
const findLatestRevision = async (applicationId) => {
  const result = await pool.query(
    `SELECT rev.*, u.name AS requested_by_name
     FROM revisions rev
     JOIN users u ON u.id = rev.requested_by
     WHERE rev.application_id = $1
     ORDER BY rev.revision_number DESC
     LIMIT 1`,
    [applicationId]
  );
  return result.rows[0] || null;
};

/**
 * Get all revisions for an application (ordered by revision number).
 * @param {string} applicationId
 * @returns {Promise<Object[]>}
 */
const findRevisions = async (applicationId) => {
  const result = await pool.query(
    `SELECT rev.*, u.name AS requested_by_name
     FROM revisions rev
     JOIN users u ON u.id = rev.requested_by
     WHERE rev.application_id = $1
     ORDER BY rev.revision_number ASC`,
    [applicationId]
  );
  return result.rows;
};

module.exports = {
  findByStatuses,
  findByIdWithDetails,
  findLatestRevision,
  findRevisions,
};
