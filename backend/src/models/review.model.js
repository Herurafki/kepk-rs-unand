'use strict';
const pool = require('../config/database');

const create = async ({ application_id, reviewer_id, recommendation, review_cycle = 1 }, client = pool) => {
  const result = await client.query(
    `INSERT INTO reviews (application_id, reviewer_id, recommendation, review_cycle, reviewed_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING *`,
    [application_id, reviewer_id, recommendation, review_cycle]
  );
  return result.rows[0];
};

const createAssessment = async ({
  review_id,
  indicator_answers,
  indicator_comments = {},
  suggestion_information_accuracy = '',
  suggestion_other_ethics = '',
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO review_assessments (
       review_id, indicator_answers, indicator_comments,
       suggestion_information_accuracy, suggestion_other_ethics
     )
     VALUES ($1, $2::jsonb, $3::jsonb, $4, $5)
     RETURNING *`,
    [
      review_id,
      JSON.stringify(indicator_answers),
      JSON.stringify(indicator_comments),
      suggestion_information_accuracy,
      suggestion_other_ethics,
    ]
  );
  return result.rows[0];
};

const upsertAssessment = async ({
  review_id,
  indicator_answers,
  indicator_comments = {},
  suggestion_information_accuracy = '',
  suggestion_other_ethics = '',
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO review_assessments (
       review_id, indicator_answers, indicator_comments,
       suggestion_information_accuracy, suggestion_other_ethics
     )
     VALUES ($1, $2::jsonb, $3::jsonb, $4, $5)
     ON CONFLICT (review_id) DO UPDATE SET
       indicator_answers = EXCLUDED.indicator_answers,
       indicator_comments = EXCLUDED.indicator_comments,
       suggestion_information_accuracy = EXCLUDED.suggestion_information_accuracy,
       suggestion_other_ethics = EXCLUDED.suggestion_other_ethics,
       updated_at = NOW()
     RETURNING *`,
    [review_id, JSON.stringify(indicator_answers), JSON.stringify(indicator_comments), suggestion_information_accuracy, suggestion_other_ethics]
  );
  return result.rows[0];
};

const findById = async (id, client = pool) => {
  const result = await client.query(
    `SELECT r.*,
            ra.indicator_answers,
            ra.indicator_comments,
            ra.suggestion_information_accuracy,
            ra.suggestion_other_ethics,
            ra.created_at AS assessment_created_at,
            ra.updated_at AS assessment_updated_at
     FROM reviews r
     LEFT JOIN review_assessments ra ON ra.review_id = r.id
     WHERE r.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const findByApplicationId = async (applicationId, client = pool) => {
  const result = await client.query(
    `SELECT r.*, u.name AS reviewer_name
     FROM reviews r
     JOIN users u ON u.id = r.reviewer_id
     WHERE r.application_id = $1
     ORDER BY r.created_at ASC`,
    [applicationId]
  );
  return result.rows;
};

const findByReviewerId = async (reviewerId) => {
  const result = await pool.query(
    `SELECT r.*,
            a.application_number,
            a.application_type,
            a.research_title,
            a.review_type,
            researcher_user.name AS researcher_name,
            ra.indicator_answers,
            ra.indicator_comments,
            ra.suggestion_information_accuracy,
            ra.suggestion_other_ethics,
            cycle.current_review_cycle
     FROM reviews r
     JOIN applications a ON a.id = r.application_id
     JOIN researchers researcher ON researcher.id = a.researcher_id
     JOIN users researcher_user ON researcher_user.id = researcher.user_id
     LEFT JOIN review_assessments ra ON ra.review_id = r.id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int + 1 AS current_review_cycle
       FROM final_decisions fd
       WHERE fd.application_id = r.application_id
         AND fd.decision = 'MAJOR_REVISION'
         AND EXISTS (
           SELECT 1 FROM revisions rv
           WHERE rv.application_id = fd.application_id
             AND rv.submitted_at IS NOT NULL
             AND rv.submitted_at > fd.decision_at
         )
     ) cycle ON TRUE
     WHERE r.reviewer_id = $1
     ORDER BY r.created_at DESC`,
    [reviewerId]
  );
  return result.rows;
};

const findByApplicationAndReviewer = async (applicationId, reviewerId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM reviews WHERE application_id = $1 AND reviewer_id = $2 ORDER BY reviewed_at DESC NULLS LAST, id DESC LIMIT 1',
    [applicationId, reviewerId]
  );
  return result.rows[0] || null;
};

const update = async (id, { recommendation }, client = pool) => {
  const result = await client.query(
    `UPDATE reviews SET recommendation = $1, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [recommendation, id]
  );
  return result.rows[0] || null;
};

/** Count submitted reviews for an application. */
const countSubmitted = async (applicationId, client = pool) => {
  const result = await client.query(
    'SELECT COUNT(*) AS cnt FROM reviews WHERE application_id = $1',
    [applicationId]
  );
  return parseInt(result.rows[0].cnt, 10);
};

/** List active reviewer accounts and their assignment/submission state for an application. */
const findReviewerParticipationByApplicationId = async (applicationId, reviewType, client = pool) => {
  const result = await client.query(
    `SELECT u.id AS reviewer_id,
            u.name AS reviewer_name,
            u.email AS reviewer_email,
            ra.status AS assignment_status,
            ra.assigned_at,
            ra.accepted_at,
            ers.state AS reviewer_state,
            rv.id AS review_id,
            rv.recommendation,
            rv.review_cycle,
            rv.reviewed_at,
            CASE
              WHEN $2 = 'EXPEDITED' AND ers.state = 'NEEDS_REVISION' THEN 'REVISION_REQUIRED'
              WHEN $2 = 'EXPEDITED' AND ers.state = 'FINAL' THEN 'SUBMITTED'
              WHEN $2 = 'EXPEDITED' AND ers.state = 'IN_REVIEW' THEN 'AWAITING_REVIEW'
              WHEN rv.id IS NOT NULL THEN 'SUBMITTED'
              WHEN $2 = 'FULLBOARD' THEN 'AWAITING_REVIEW'
              WHEN ra.status = 'ACCEPTED' THEN 'AWAITING_REVIEW'
              WHEN ra.status = 'PENDING' THEN 'ASSIGNMENT_PENDING'
              WHEN ra.status = 'REJECTED' THEN 'ASSIGNMENT_REJECTED'
              WHEN ra.status = 'COMPLETED' THEN 'AWAITING_REVIEW'
              ELSE 'NOT_ASSIGNED'
            END AS participation_status
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id AND r.name = 'REVIEWER'
     LEFT JOIN LATERAL (
       SELECT a.status, a.assigned_at, a.accepted_at
       FROM review_assignments a
       WHERE a.application_id = $1 AND a.reviewer_id = u.id
       ORDER BY CASE a.status WHEN 'ACCEPTED' THEN 1 WHEN 'PENDING' THEN 2 WHEN 'COMPLETED' THEN 3 ELSE 4 END
       LIMIT 1
     ) ra ON TRUE
     LEFT JOIN expedited_reviewer_states ers
       ON ers.application_id = $1 AND ers.reviewer_id = u.id
     LEFT JOIN LATERAL (
       SELECT r.id, r.recommendation, r.review_cycle, r.reviewed_at
       FROM reviews r
       WHERE r.application_id = $1 AND r.reviewer_id = u.id
         AND r.review_cycle >= (
           SELECT COUNT(*)::int + 1
           FROM final_decisions fd
           WHERE fd.application_id = $1
             AND fd.decision = 'MAJOR_REVISION'
             AND EXISTS (
               SELECT 1 FROM revisions rv
               WHERE rv.application_id = fd.application_id
                 AND rv.submitted_at IS NOT NULL
                 AND rv.submitted_at > fd.decision_at
             )
         )
       ORDER BY r.review_cycle DESC NULLS LAST, r.reviewed_at DESC NULLS LAST, r.id DESC
       LIMIT 1
     ) rv ON TRUE
     WHERE u.is_active = TRUE
       AND ($2 = 'FULLBOARD' OR ra.status IS NOT NULL OR rv.id IS NOT NULL)
       AND NOT EXISTS (
         SELECT 1
         FROM review_assignments rejected
         WHERE rejected.application_id = $1
           AND rejected.reviewer_id = u.id
           AND rejected.status = 'REJECTED'
           AND EXISTS (
             SELECT 1
             FROM review_assignments replacement
             WHERE replacement.application_id = rejected.application_id
               AND replacement.assigned_at > rejected.rejected_at
           )
       )
     ORDER BY
       CASE
         WHEN rv.id IS NOT NULL THEN 1
         WHEN ra.status = 'ACCEPTED' OR $2 = 'FULLBOARD' THEN 2
         WHEN ra.status = 'PENDING' THEN 3
         WHEN ra.status = 'REJECTED' THEN 4
         ELSE 5
       END,
       u.name ASC`,
    [applicationId, reviewType]
  );
  return result.rows;
};

/** List recommendations, comments, and structured assessment for an application. */
const findRecommendationsByApplicationId = async (applicationId, client = pool) => {
  const result = await client.query(
    `SELECT r.id,
            r.application_id,
            r.reviewer_id,
            u.name AS reviewer_name,
            r.recommendation,
            r.review_cycle,
            r.reviewed_at,
            r.created_at,
            r.updated_at,
            (SELECT COUNT(*)::int + 1
             FROM final_decisions fd
             WHERE fd.application_id = r.application_id
               AND fd.decision = 'MAJOR_REVISION'
               AND EXISTS (
                 SELECT 1 FROM revisions rv
                 WHERE rv.application_id = fd.application_id
                   AND rv.submitted_at IS NOT NULL
                   AND rv.submitted_at > fd.decision_at
               )) AS current_review_cycle,
            ra.indicator_answers,
            ra.indicator_comments,
            ra.suggestion_information_accuracy,
            ra.suggestion_other_ethics,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', rc.id,
                  'comment', rc.comment,
                  'created_at', rc.created_at
                ) ORDER BY rc.created_at ASC
              ) FILTER (WHERE rc.id IS NOT NULL),
              '[]'::json
            ) AS comments
     FROM reviews r
     JOIN users u ON u.id = r.reviewer_id
     LEFT JOIN review_assessments ra ON ra.review_id = r.id
     LEFT JOIN review_comments rc ON rc.review_id = r.id
     WHERE r.application_id = $1
     GROUP BY r.id, u.id, u.name, ra.id
     ORDER BY r.created_at ASC`,
    [applicationId]
  );
  return result.rows;
};

/**
 * Aggregate reviewer recommendations and participation for one application.
 * FULLBOARD participation is based on submitted reviews, while the eligible
 * reviewer pool is the current set of active users with the REVIEWER role.
 * EXPEDITED participation is compared with accepted reviewer assignments.
 */
const getResultByApplicationId = async (applicationId, reviewType, client = pool) => {
  const votingResult = reviewType === 'EXPEDITED'
    ? await client.query(
      `WITH latest_reviews AS (
         SELECT DISTINCT ON (reviewer_id)
                reviewer_id, recommendation
         FROM reviews
         WHERE application_id = $1
         ORDER BY reviewer_id, reviewed_at DESC NULLS LAST, id DESC
       )
       SELECT COUNT(*)::int AS participating_reviewers,
              COUNT(*) FILTER (WHERE recommendation = 'APPROVE')::int AS approve_votes,
              0::int AS revision_votes,
              COUNT(*) FILTER (WHERE recommendation = 'REJECT')::int AS reject_votes
       FROM latest_reviews`,
      [applicationId]
    )
    : await client.query(
      `SELECT COUNT(DISTINCT reviewer_id)::int AS participating_reviewers,
              COUNT(DISTINCT reviewer_id) FILTER (WHERE recommendation = 'APPROVE')::int AS approve_votes,
              COUNT(DISTINCT reviewer_id) FILTER (WHERE recommendation = 'REVISION')::int AS revision_votes,
              COUNT(DISTINCT reviewer_id) FILTER (WHERE recommendation = 'REJECT')::int AS reject_votes
       FROM reviews
       WHERE application_id = $1
         AND (
           (SELECT fd.decision FROM final_decisions fd WHERE fd.application_id = $1 ORDER BY fd.decision_at DESC, fd.id DESC LIMIT 1) <> 'MAJOR_REVISION'
           OR reviewed_at >= COALESCE(
             (SELECT MAX(rv.submitted_at) FROM revisions rv WHERE rv.application_id = $1 AND rv.submitted_at IS NOT NULL),
             '-infinity'::timestamp
           )
         )`,
      [applicationId]
    );

  let totalReviewers = 0;
  if (reviewType === 'FULLBOARD') {
    const reviewerPool = await client.query(
      `SELECT COUNT(DISTINCT u.id)::int AS cnt
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE u.is_active = TRUE
         AND r.name = 'REVIEWER'`
    );
    totalReviewers = reviewerPool.rows[0].cnt;
  } else if (reviewType === 'EXPEDITED') {
    const assignmentPool = await client.query(
      `SELECT COUNT(DISTINCT reviewer_id)::int AS cnt
       FROM review_assignments
       WHERE application_id = $1
         AND status IN ('ACCEPTED', 'COMPLETED')`,
      [applicationId]
    );
    totalReviewers = assignmentPool.rows[0].cnt;
  }

  const voting = votingResult.rows[0];
  const participatingReviewers = voting.participating_reviewers;

  return {
    total_reviewers: totalReviewers,
    participating_reviewers: participatingReviewers,
    not_participating: Math.max(totalReviewers - participatingReviewers, 0),
    approve_votes: voting.approve_votes,
    revision_votes: voting.revision_votes,
    reject_votes: voting.reject_votes,
  };
};

// ─── review_comments ────────────────────────────────────────────────
const createComment = async ({ review_id, comment }, client = pool) => {
  const result = await client.query(
    'INSERT INTO review_comments (review_id, comment) VALUES ($1, $2) RETURNING *',
    [review_id, comment]
  );
  return result.rows[0];
};

const findCommentsByReviewId = async (reviewId) => {
  const result = await pool.query(
    'SELECT * FROM review_comments WHERE review_id = $1 ORDER BY created_at ASC',
    [reviewId]
  );
  return result.rows;
};

module.exports = {
  create,
  createAssessment,
  upsertAssessment,
  findById,
  findByApplicationId,
  findByReviewerId,
  findByApplicationAndReviewer,
  update,
  countSubmitted,
  findRecommendationsByApplicationId,
  findReviewerParticipationByApplicationId,
  getResultByApplicationId,
  createComment,
  findCommentsByReviewId,
};
