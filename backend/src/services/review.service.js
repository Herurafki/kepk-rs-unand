'use strict';
const pool = require('../config/database');
const applicationModel = require('../models/application.model');
const assignmentModel = require('../models/assignment.model');
const reviewModel = require('../models/review.model');
const historyModel = require('../models/history.model');
const revisionModel = require('../models/revision.model');
const userModel = require('../models/user.model');
const applicationAccess = require('./application-access.service');

const VALID_RECOMMENDATIONS = ['APPROVE', 'REVISION', 'REJECT'];
const VALID_REVIEW_TYPES = ['EXEMPTED', 'EXPEDITED', 'FULLBOARD'];

const setReviewType = async (applicationId, reviewType, forumDate, chiefUserId) => {
  if (!VALID_REVIEW_TYPES.includes(reviewType)) {
    const err = new Error(`Invalid review_type. Must be one of: ${VALID_REVIEW_TYPES.join(', ')}`);
    err.statusCode = 422;
    throw err;
  }
  if (reviewType === 'FULLBOARD' && !forumDate) {
    const err = new Error('forum_date is required for FULLBOARD'); err.statusCode = 422; throw err;
  }
  if (reviewType !== 'FULLBOARD' && forumDate) {
    const err = new Error('forum_date is only allowed for FULLBOARD'); err.statusCode = 422; throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const app = await applicationModel.findById(applicationId, client);
    if (!app) { const err = new Error('Application not found'); err.statusCode = 404; throw err; }
    await applicationAccess.assertApplicationAccess(app, chiefUserId, ['KETUA']);
    if (app.status !== 'WAITING_REVIEWER') {
      const err = new Error(`Review type can only be set while application is WAITING_REVIEWER (current: ${app.status})`);
      err.statusCode = 400; throw err;
    }
    const roleResult = await client.query(
      `SELECT ur.id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1 AND r.name = 'KETUA'`,
      [chiefUserId]
    );
    if (!roleResult.rows[0]) { const err = new Error('KETUA role assignment not found'); err.statusCode = 403; throw err; }
    if (reviewType === 'FULLBOARD') {
      const existingAssignments = await assignmentModel.countTotal(applicationId, client);
      if (existingAssignments > 0) { const err = new Error('FULLBOARD cannot be selected while reviewer assignments exist'); err.statusCode = 409; throw err; }
    }
    await client.query(
      `UPDATE applications SET review_type = $1, forum_date = $2, forum_closed_at = NULL, updated_at = NOW() WHERE id = $3`,
      [reviewType, reviewType === 'FULLBOARD' ? forumDate : null, applicationId]
    );
    if (reviewType === 'FULLBOARD') await applicationModel.updateStatus(applicationId, 'UNDER_REVIEW', client);
    await historyModel.create({
      application_id: applicationId,
      previous_status: app.status,
      new_status: reviewType === 'FULLBOARD' ? 'UNDER_REVIEW' : app.status,
      changed_by: chiefUserId,
      note: `Review type set to ${reviewType}${forumDate ? `; forum date: ${forumDate}` : ''}`,
    }, client);
    const updated = await applicationModel.findById(applicationId, client);
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK'); throw err;
  } finally { client.release(); }
};

const checkCompletionCondition = async (applicationId, reviewType, client) => {
  if (reviewType !== 'EXPEDITED') return false;
  const assignmentState = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending_count,
       COUNT(*) FILTER (WHERE status = 'REJECTED' AND NOT EXISTS (
         SELECT 1 FROM review_assignments replacement
         WHERE replacement.application_id = rejected.application_id
           AND replacement.assigned_at > rejected.rejected_at
           AND replacement.status IN ('PENDING', 'ACCEPTED', 'COMPLETED')
       ))::int AS unreplaced_rejections
     FROM review_assignments rejected WHERE application_id = $1`,
    [applicationId]
  );
  if (Number(assignmentState.rows[0].pending_count) > 0 ||
      Number(assignmentState.rows[0].unreplaced_rejections) > 0) return false;

  const states = await client.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE state = 'FINAL')::int AS completed,
            COUNT(*) FILTER (WHERE state = 'NEEDS_REVISION')::int AS needs_revision
     FROM expedited_reviewer_states WHERE application_id = $1`,
    [applicationId]
  );
  const row = states.rows[0];
  return Number(row.total) > 0 &&
    Number(row.total) === Number(row.completed) &&
    Number(row.needs_revision) === 0;
};

const canReviewerAccess = async (applicationId, reviewerId, client) => {
  const app = await applicationModel.findById(applicationId, client);
  if (!app) return { app: null, allowed: false };
  if (app.review_type === 'FULLBOARD') {
    const reviewer = await userModel.findByIdWithRoles(reviewerId);
    const active = reviewer && reviewer.is_active === true;
    const hasRole = active && reviewer.roles.some((r) => r.name === 'REVIEWER');
    return { app, allowed: hasRole };
  }
  const assignment = await client.query(
    `SELECT 1 FROM review_assignments WHERE application_id = $1 AND reviewer_id = $2 AND status IN ('ACCEPTED', 'COMPLETED')`,
    [applicationId, reviewerId]
  );
  return { app, allowed: assignment.rows.length > 0 };
};

const validateAssessment = (assessment) => {
  if (assessment === undefined || assessment === null) return null; // Legacy clients remain compatible.
  if (!assessment || typeof assessment !== 'object' || Array.isArray(assessment)) {
    const err = new Error('assessment must be an object'); err.statusCode = 422; throw err;
  }
  const answers = assessment.indicator_answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    const err = new Error('assessment.indicator_answers must be an object with keys 1 through 26'); err.statusCode = 422; throw err;
  }
  const errors = {};
  for (let i = 1; i <= 26; i += 1) {
    const key = String(i);
    if (typeof answers[key] !== 'boolean') errors[`indicator_answers.${key}`] = 'Answer must be boolean true (Ya) or false (Tidak)';
  }
  for (const key of Object.keys(answers)) {
    if (!/^(?:[1-9]|1\d|2[0-6])$/.test(key)) errors[`indicator_answers.${key}`] = 'Only indicator keys 1 through 26 are allowed';
  }
  const comments = assessment.indicator_comments === undefined ? {} : assessment.indicator_comments;
  if (!comments || typeof comments !== 'object' || Array.isArray(comments)) {
    errors.indicator_comments = 'indicator_comments must be an object with indicator keys 1 through 26';
  } else {
    for (const key of Object.keys(comments)) {
      if (!/^(?:[1-9]|1[0-9]|2[0-6])$/.test(key)) {
        errors[`indicator_comments.${key}`] = 'Only indicator keys 1 through 26 are allowed';
      } else if (typeof comments[key] !== 'string') {
        errors[`indicator_comments.${key}`] = 'Indicator comment must be a string';
      }
    }
  }
  const suggestionFields = ['suggestion_information_accuracy', 'suggestion_other_ethics'];
  for (const field of suggestionFields) {
    if (assessment[field] !== undefined && typeof assessment[field] !== 'string') {
      errors[field] = 'Suggestion must be a string';
    }
  }
  if (Object.keys(errors).length) {
    const err = new Error('Reviewer assessment validation failed');
    err.statusCode = 422;
    err.details = errors;
    throw err;
  }
  return {
    indicator_answers: answers,
    indicator_comments: Object.fromEntries(Object.entries(comments).map(([key, value]) => [key, value.trim()])),
    suggestion_information_accuracy: (assessment.suggestion_information_accuracy || '').trim(),
    suggestion_other_ethics: (assessment.suggestion_other_ethics || '').trim(),
  };
};

const submit = async (applicationId, reviewerId, { recommendation, comment, assessment, document_revisions = [] }) => {
  if (!VALID_RECOMMENDATIONS.includes(recommendation)) {
    const err = new Error(`Recommendation must be one of: ${VALID_RECOMMENDATIONS.join(', ')}`);
    err.statusCode = 422; throw err;
  }
  const normalizedAssessment = validateAssessment(assessment);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { app, allowed } = await canReviewerAccess(applicationId, reviewerId, client);
    if (!app) { const err = new Error('Application not found'); err.statusCode = 404; throw err; }
    if (!['UNDER_REVIEW', ...(app.review_type === 'EXPEDITED' ? ['REVISION_REQUIRED'] : [])].includes(app.status)) {
      const err = new Error(`Application is not under review (current: ${app.status})`); err.statusCode = 400; throw err;
    }
    if (app.review_type === 'FULLBOARD' && app.forum_closed_at) {
      const err = new Error('FULLBOARD forum is already closed');
      err.statusCode = 400;
      throw err;
    }
    if (!allowed) {
      const err = new Error(app.review_type === 'FULLBOARD'
        ? 'You do not have the REVIEWER role or your account is inactive'
        : 'You do not have an accepted assignment for this application');
      err.statusCode = 403; throw err;
    }
    if (app.review_type === 'EXPEDITED') {
      await client.query(
        `INSERT INTO expedited_reviewer_states (application_id, reviewer_id, state)
         SELECT application_id, reviewer_id, 'WAITING'
         FROM review_assignments
         WHERE application_id = $1 AND status IN ('ACCEPTED', 'COMPLETED')
         ON CONFLICT (application_id, reviewer_id) DO NOTHING`,
        [applicationId]
      );
      const state = await client.query(
        'SELECT state FROM expedited_reviewer_states WHERE application_id = $1 AND reviewer_id = $2 FOR UPDATE',
        [applicationId, reviewerId]
      );
      if (state.rows[0] && state.rows[0].state === 'FINAL') {
        const err = new Error('Reviewer has already submitted a final decision');
        err.statusCode = 409;
        throw err;
      }
      if (state.rows[0] && state.rows[0].state === 'NEEDS_REVISION') {
        const err = new Error('Wait for the researcher to resubmit the requested documents before reviewing again');
        err.statusCode = 409;
        throw err;
      }
      if (recommendation === 'REVISION') {
        if (!Array.isArray(document_revisions) || document_revisions.length === 0) {
          const err = new Error('At least one document revision is required');
          err.statusCode = 422;
          throw err;
        }
        for (const item of document_revisions) {
          if (!item || !/^\d+$/.test(String(item.document_id)) || !String(item.note || '').trim()) {
            const err = new Error('Each revision item requires document_id and note');
            err.statusCode = 422;
            throw err;
          }
          const doc = await client.query(
            `SELECT d.id
             FROM documents d
             JOIN applications a ON a.id = $2
             WHERE d.id = $1
               AND d.application_id IN (a.id, COALESCE(a.parent_application_id, a.id))`,
            [item.document_id, applicationId]
          );
          if (!doc.rows[0]) {
            const err = new Error('Selected document does not belong to this application');
            err.statusCode = 422;
            throw err;
          }
        }
      }
    } else if (recommendation === 'REVISION') {
      const err = new Error('REVISION is only available for EXPEDITED reviews');
      err.statusCode = 422;
      throw err;
    }

    const existingReview = await reviewModel.findByApplicationAndReviewer(applicationId, reviewerId, client);
    if (existingReview && app.review_type !== 'EXPEDITED') {
      // A reviewer may submit a new assessment after a MAJOR_REVISION cycle.
      // The previous review is immutable; a new one is allowed only when the
      // researcher has resubmitted a revision after that review was created.
      const revisionCycle = await client.query(
        `SELECT submitted_at
         FROM revisions
         WHERE application_id = $1 AND submitted_at IS NOT NULL
         ORDER BY submitted_at DESC, id DESC
         LIMIT 1`,
        [applicationId]
      );
      const lastResubmissionAt = revisionCycle.rows[0]?.submitted_at;
      const previousReviewAt = existingReview.reviewed_at || existingReview.created_at;
      if (!lastResubmissionAt || new Date(lastResubmissionAt) <= new Date(previousReviewAt)) {
        const err = new Error('You have already submitted a review for the current revision cycle');
        err.statusCode = 409;
        throw err;
      }
    }

    let reviewCycle = 1;
    if (app.review_type === 'EXPEDITED') {
      const cycleResult = await client.query(
        'SELECT COALESCE(MAX(review_cycle), 0)::int + 1 AS cycle FROM reviews WHERE application_id = $1 AND reviewer_id = $2',
        [applicationId, reviewerId]
      );
      reviewCycle = Number(cycleResult.rows[0]?.cycle || 1);
    } else {
      const cycleResult = await client.query(
        `SELECT COUNT(*)::int + 1 AS cycle
         FROM final_decisions fd
         WHERE fd.application_id = $1
           AND fd.decision = 'MAJOR_REVISION'
           AND EXISTS (
             SELECT 1 FROM revisions rv
             WHERE rv.application_id = fd.application_id
               AND rv.submitted_at IS NOT NULL
               AND rv.submitted_at > fd.decision_at
           )`,
        [applicationId]
      );
      reviewCycle = Number(cycleResult.rows[0]?.cycle || 1);
    }
    const review = await reviewModel.create({
      application_id: applicationId,
      reviewer_id: reviewerId,
      recommendation,
      review_cycle: reviewCycle,
    }, client);
    if (normalizedAssessment) {
      await reviewModel.createAssessment({ review_id: review.id, ...normalizedAssessment }, client);
    }
    if (comment && String(comment).trim().length > 0) {
      await reviewModel.createComment({ review_id: review.id, comment }, client);
    }

    if (app.review_type === 'EXPEDITED') {
      if (recommendation === 'REVISION') {
        const cycle = await client.query(
          'SELECT COALESCE(MAX(cycle_number), 0)::int + 1 AS next_cycle FROM expedited_revision_requests WHERE application_id = $1 AND reviewer_id = $2',
          [applicationId, reviewerId]
        );
        const request = await client.query(
          'INSERT INTO expedited_revision_requests (application_id, reviewer_id, review_id, cycle_number) VALUES ($1, $2, $3, $4) RETURNING id',
          [applicationId, reviewerId, review.id, cycle.rows[0].next_cycle]
        );
        for (const item of document_revisions) {
          await client.query(
            'INSERT INTO expedited_revision_items (request_id, document_id, note) VALUES ($1, $2, $3)',
            [request.rows[0].id, item.document_id, String(item.note).trim()]
          );
        }
        await client.query(
          "UPDATE expedited_reviewer_states SET state = 'NEEDS_REVISION', last_review_id = $3, updated_at = NOW() WHERE application_id = $1 AND reviewer_id = $2",
          [applicationId, reviewerId, review.id]
        );
        if (app.status !== 'REVISION_REQUIRED') {
          await applicationModel.updateStatus(applicationId, 'REVISION_REQUIRED', client);
        }
        await historyModel.create({
          application_id: applicationId, previous_status: app.status, new_status: 'REVISION_REQUIRED',
          changed_by: reviewerId, note: 'Expedited reviewer requested document revisions',
        }, client);
      } else {
        await client.query(
          "UPDATE expedited_reviewer_states SET state = 'FINAL', last_review_id = $3, updated_at = NOW() WHERE application_id = $1 AND reviewer_id = $2",
          [applicationId, reviewerId, review.id]
        );
      }
    }

    const shouldComplete = await checkCompletionCondition(applicationId, app.review_type, client);
    if (shouldComplete) {
      await applicationModel.updateStatus(applicationId, 'REVIEW_COMPLETED', client);
      await historyModel.create({
        application_id: applicationId, previous_status: 'UNDER_REVIEW', new_status: 'REVIEW_COMPLETED',
        changed_by: reviewerId, note: 'Review completion conditions met',
      }, client);
    }
    await client.query('COMMIT');
    return reviewModel.findById(review.id);
  } catch (err) {
    await client.query('ROLLBACK'); throw err;
  } finally { client.release(); }
};

const getRecommendationsByApplication = async (applicationId, userId, roles = []) => {
  const app = await applicationModel.findById(applicationId);
  if (!app) { const err = new Error('Application not found'); err.statusCode = 404; throw err; }
  await applicationAccess.assertApplicationAccess(app, userId, roles);
  const [reviews, reviewerParticipation] = await Promise.all([
    reviewModel.findRecommendationsByApplicationId(applicationId),
    app.review_type === 'EXEMPTED'
      ? Promise.resolve([])
      : reviewModel.findReviewerParticipationByApplicationId(applicationId, app.review_type),
  ]);
  const currentCycle = Number(reviews[0]?.current_review_cycle || 1);
  let currentCycleReviews = reviews.filter((review) =>
    Number(review.review_cycle || 1) >= currentCycle
  );
  if (app.review_type === 'EXPEDITED') {
    const latestByReviewer = new Map();
    for (const review of reviews) {
      const reviewerKey = String(review.reviewer_id);
      const previous = latestByReviewer.get(reviewerKey);
      if (!previous || new Date(review.reviewed_at || review.created_at) >
          new Date(previous.reviewed_at || previous.created_at) ||
          (new Date(review.reviewed_at || review.created_at).getTime() ===
           new Date(previous.reviewed_at || previous.created_at).getTime() &&
           Number(review.id) > Number(previous.id))) {
        latestByReviewer.set(reviewerKey, review);
      }
    }
    currentCycleReviews = Array.from(latestByReviewer.values());
  }
  const submittedReviewerIds = new Set(currentCycleReviews.map((review) => String(review.reviewer_id)));
  const expectedReviewers = reviewerParticipation.filter((reviewer) =>
    app.review_type === 'FULLBOARD' ||
    ['ACCEPTED', 'COMPLETED'].includes(reviewer.assignment_status)
  );
  const pendingDecisionCount = expectedReviewers.filter((reviewer) =>
    !submittedReviewerIds.has(String(reviewer.reviewer_id))
  ).length;
  const expeditedRevisionRequests = app.review_type === 'EXPEDITED'
    ? (await pool.query(
      `SELECT req.id, req.reviewer_id, reviewer.name AS reviewer_name,
              req.review_id, req.cycle_number, req.status, req.created_at, req.submitted_at,
              COALESCE(json_agg(json_build_object(
                'id', item.id, 'document_id', item.document_id,
                'document_name', doc.original_name, 'document_type', doc.document_type,
                'note', item.note, 'revised_document_id', item.revised_document_id,
                'revised_at', item.revised_at
              ) ORDER BY item.id) FILTER (WHERE item.id IS NOT NULL), '[]'::json) AS items
       FROM expedited_revision_requests req
       JOIN users reviewer ON reviewer.id = req.reviewer_id
       LEFT JOIN expedited_revision_items item ON item.request_id = req.id
       LEFT JOIN documents doc ON doc.id = item.document_id
       WHERE req.application_id = $1
       GROUP BY req.id, reviewer.name
       ORDER BY req.created_at ASC`,
      [applicationId]
    )).rows : [];
  const expeditedReviewerStates = app.review_type === 'EXPEDITED'
    ? (await pool.query(
      `SELECT s.reviewer_id, u.name AS reviewer_name, s.state,
              s.last_review_id, s.updated_at
       FROM expedited_reviewer_states s
       JOIN users u ON u.id = s.reviewer_id
       WHERE s.application_id = $1
       ORDER BY u.name ASC`,
      [applicationId]
    )).rows : [];
  return {
    application_id: Number(applicationId),
    review_type: app.review_type,
    status: app.status,
    reviews,
    current_cycle_reviews: currentCycleReviews,
    expedited_revision_requests: expeditedRevisionRequests,
    expedited_reviewer_states: expeditedReviewerStates,
    reviewer_participation: reviewerParticipation,
    reviewer_summary: {
      total_reviewers: reviewerParticipation.length,
      submitted: currentCycleReviews.length,
      pending_decisions: pendingDecisionCount,
      not_assigned: reviewerParticipation.filter((reviewer) => reviewer.participation_status === 'NOT_ASSIGNED').length,
    },
  };
};

const getReviewResult = async (applicationId, userId, roles = []) => {
  const app = await applicationModel.findById(applicationId);
  if (!app) { const err = new Error('Application not found'); err.statusCode = 404; throw err; }
  await applicationAccess.assertApplicationAccess(app, userId, roles);
  const forumClosedAt = app.forum_closed_at || null;
  const voting = await reviewModel.getResultByApplicationId(applicationId, app.review_type);
  return {
    application_id: Number(applicationId), review_type: app.review_type, status: app.status,
    forum_date: app.forum_date || null, forum_closed_at: forumClosedAt, voting,
  };
};

const closeForum = async (applicationId, chiefUserId, note) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const app = await applicationModel.findById(applicationId, client);
    if (!app) { const err = new Error('Application not found'); err.statusCode = 404; throw err; }
    await applicationAccess.assertApplicationAccess(app, chiefUserId, ['KETUA']);
    if (app.review_type !== 'FULLBOARD') { const err = new Error('Only FULLBOARD applications can close a forum'); err.statusCode = 400; throw err; }
    if (app.status !== 'UNDER_REVIEW') {
      const err = new Error(`Forum can only be closed while application is UNDER_REVIEW (current: ${app.status})`); err.statusCode = 400; throw err;
    }
    const roleResult = await client.query(
      `SELECT ur.id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1 AND r.name = 'KETUA'`,
      [chiefUserId]
    );
    if (!roleResult.rows[0]) { const err = new Error('KETUA role assignment not found'); err.statusCode = 403; throw err; }
    const result = await client.query(
      `SELECT COUNT(*)::int AS participating_reviewers,
              COUNT(*) FILTER (WHERE recommendation = 'APPROVE')::int AS approve_votes,
              COUNT(*) FILTER (WHERE recommendation = 'REVISION')::int AS revision_votes,
              COUNT(*) FILTER (WHERE recommendation = 'REJECT')::int AS reject_votes
       FROM reviews WHERE application_id = $1`,
      [applicationId]
    );
    const voting = result.rows[0];
    await client.query('UPDATE applications SET forum_closed_at = NOW(), updated_at = NOW() WHERE id = $1', [applicationId]);
    await applicationModel.updateStatus(applicationId, 'REVIEW_COMPLETED', client);
    await historyModel.create({
      application_id: applicationId, previous_status: 'UNDER_REVIEW', new_status: 'REVIEW_COMPLETED',
      changed_by: chiefUserId,
      note: note || `FULLBOARD forum closed: ${voting.participating_reviewers} participating reviewers; APPROVE=${voting.approve_votes}, REVISION=${voting.revision_votes}, REJECT=${voting.reject_votes}`,
    }, client);
    await client.query('COMMIT');
    return { application_id: Number(applicationId), forum_date: app.forum_date, forum_closed_at: new Date().toISOString(), voting };
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
};

const update = async (reviewId, payload, reviewerId) => {
  void payload;
  const review = await reviewModel.findById(reviewId);
  if (!review) {
    const err = new Error('Review not found');
    err.statusCode = 404;
    throw err;
  }
  if (String(review.reviewer_id) !== String(reviewerId)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  const err = new Error('Submitted reviews are read-only and cannot be changed');
  err.statusCode = 409;
  throw err;
};

const getById = async (id, userId, roles) => {
  const review = await reviewModel.findById(id);
  if (!review) { const err = new Error('Review not found'); err.statusCode = 404; throw err; }
  const app = await applicationModel.findById(review.application_id);
  await applicationAccess.assertApplicationAccess(app, userId, roles);
  if (roles.includes('REVIEWER') && String(review.reviewer_id) !== String(userId)) {
    const err = new Error('Forbidden'); err.statusCode = 403; throw err;
  }
  return review;
};

const list = async (userId, roles) => {
  if (roles.includes('SUPERADMIN')) {
    const result = await pool.query(
      `SELECT r.*, u.name AS reviewer_name, a.research_title
       FROM reviews r JOIN users u ON u.id = r.reviewer_id
       JOIN applications a ON a.id = r.application_id
       ORDER BY r.created_at DESC`
    );
    return result.rows;
  }
  if (roles.includes('REVIEWER')) return reviewModel.findByReviewerId(userId);
  const allowedTypes = roles.includes('DIKLIT')
    ? ['DATA_AWAL', 'IZIN_PENELITIAN']
    : (roles.includes('SEKRETARIAT') || roles.includes('KETUA')) ? ['IZIN_ETIK'] : [];
  if (!allowedTypes.length) return [];
  const result = await pool.query(
    `SELECT r.*, u.name AS reviewer_name, a.research_title
     FROM reviews r JOIN users u ON u.id = r.reviewer_id
     JOIN applications a ON a.id = r.application_id
     WHERE a.application_type = ANY($1::text[])
     ORDER BY r.created_at DESC`,
    [allowedTypes]
  );
  return result.rows;
};

const getComments = async (reviewId, userId, roles = []) => {
  const review = await reviewModel.findById(reviewId);
  if (!review) { const err = new Error('Review not found'); err.statusCode = 404; throw err; }
  const app = await applicationModel.findById(review.application_id);
  await applicationAccess.assertApplicationAccess(app, userId, roles);
  return reviewModel.findCommentsByReviewId(reviewId);
};

const addComment = async (reviewId, comment, reviewerId) => {
  if (!comment || String(comment).trim().length === 0) { const err = new Error('Comment is required'); err.statusCode = 422; throw err; }
  const review = await reviewModel.findById(reviewId);
  if (!review) { const err = new Error('Review not found'); err.statusCode = 404; throw err; }
  if (String(review.reviewer_id) !== String(reviewerId)) { const err = new Error('Forbidden'); err.statusCode = 403; throw err; }
  const app = await applicationModel.findById(review.application_id);
  await applicationAccess.assertApplicationAccess(app, reviewerId, ['REVIEWER']);
  return reviewModel.createComment({ review_id: reviewId, comment });
};

const decide = async (applicationId, decision, note, chiefUserId) => {
  const decisionToStatus = {
    APPROVED: 'APPROVED',
    APPROVED_MINOR: 'REVISION_REQUIRED',
    MAJOR_REVISION: 'REVISION_REQUIRED',
    REJECTED: 'REJECTED',
    NOT_ASSESSABLE: 'NOT_ASSESSABLE',
    // Legacy values remain accepted for existing frontend clients.
    REVISION_REQUIRED: 'REVISION_REQUIRED',
  };
  if (!Object.prototype.hasOwnProperty.call(decisionToStatus, decision)) {
    const err = new Error('Decision must be one of: APPROVED, APPROVED_MINOR, MAJOR_REVISION, REJECTED, NOT_ASSESSABLE');
    err.statusCode = 422; throw err;
  }
  const nextStatus = decisionToStatus[decision];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const app = await applicationModel.findById(applicationId, client);
    if (!app) { const err = new Error('Application not found'); err.statusCode = 404; throw err; }
    await applicationAccess.assertApplicationAccess(app, chiefUserId, ['KETUA']);
    if (app.review_type === 'EXPEDITED') {
      if (!['APPROVED', 'REJECTED'].includes(decision)) {
        const err = new Error('Expedited final decision must be APPROVED or REJECTED');
        err.statusCode = 422;
        throw err;
      }
      const reviewerCompletion = await client.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE state = 'FINAL')::int AS final_count
         FROM expedited_reviewer_states
         WHERE application_id = $1`,
        [applicationId]
      );
      if (Number(reviewerCompletion.rows[0].total) === 0 ||
          Number(reviewerCompletion.rows[0].total) !== Number(reviewerCompletion.rows[0].final_count)) {
        const err = new Error('Ketua can only decide after all assigned reviewers have submitted a final decision');
        err.statusCode = 409;
        throw err;
      }
    }
    const exemptedStatuses = ['WAITING_REVIEWER', 'SEKRETARIS_REVIEW'];
    const allowedFrom = app.review_type === 'EXEMPTED' ? [...exemptedStatuses, 'REVIEW_COMPLETED'] : ['REVIEW_COMPLETED'];
    if (!allowedFrom.includes(app.status)) {
      const err = new Error(`Cannot make decision from current status: ${app.status}. Allowed from: ${allowedFrom.join(', ')}`); err.statusCode = 400; throw err;
    }
    if (app.status !== 'REVIEW_COMPLETED' && app.review_type !== 'EXEMPTED') {
      const err = new Error('Direct decision before review completion is only allowed for EXEMPTED applications'); err.statusCode = 400; throw err;
    }
    const roleResult = await client.query(
      `SELECT ur.id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1 AND r.name = 'KETUA'`,
      [chiefUserId]
    );
    const userRoleId = roleResult.rows[0] ? roleResult.rows[0].id : null;
    if (!userRoleId) { const err = new Error('KETUA role assignment not found'); err.statusCode = 403; throw err; }
    await client.query(
      'INSERT INTO final_decisions (application_id, decided_by_user_role_id, decision, comments) VALUES ($1, $2, $3, $4)',
      [applicationId, userRoleId, decision, note || null]
    );
    const updated = await applicationModel.updateStatus(applicationId, nextStatus, client);
    await historyModel.create({
      application_id: applicationId, previous_status: app.status, new_status: nextStatus,
      changed_by: chiefUserId, note: note || `Final decision: ${decision}`,
    }, client);
    if (nextStatus === 'REVISION_REQUIRED' && note) {
      await revisionModel.create({ application_id: applicationId, requested_by: chiefUserId, note }, client);
    }

    // Completing an ethics application also completes its linked research application.
    if (decision === 'APPROVED' && app.application_type === 'IZIN_ETIK' && app.parent_application_id) {
      const parent = await applicationModel.findByIdForUpdate(app.parent_application_id, client);
      if (!parent || parent.application_type !== 'IZIN_PENELITIAN') {
        const err = new Error('Linked parent research application was not found');
        err.statusCode = 409;
        throw err;
      }
      if (!['REQUIRED_ETHICS', 'ADMIN_APPROVED'].includes(parent.status)) {
        const err = new Error(`Parent research application cannot be completed from status ${parent.status}`);
        err.statusCode = 409;
        throw err;
      }
      await applicationModel.updateStatus(parent.id, 'APPROVED', client);
      await historyModel.create({
        application_id: parent.id,
        previous_status: parent.status,
        new_status: 'APPROVED',
        changed_by: chiefUserId,
        note: `Ethics application ${applicationId} approved; parent research application completed`,
      }, client);
    }

    await client.query('COMMIT');
    return { ...updated, final_decision: decision };
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
};

module.exports = {
  setReviewType, submit, update, getById, list, getComments, addComment, decide,
  closeForum, getRecommendationsByApplication, getReviewResult,
};
