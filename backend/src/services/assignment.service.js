'use strict';
const pool = require('../config/database');
const applicationModel = require('../models/application.model');
const assignmentModel = require('../models/assignment.model');
const historyModel = require('../models/history.model');
const userModel = require('../models/user.model');

/**
 * Check auto-transition condition for UNDER_REVIEW.
 * FULLBOARD has no reviewer assignments: all active REVIEWER users can review.
 */
const checkUnderReviewTransition = async (applicationId, reviewType, client) => {
  if (reviewType === 'EXEMPTED') return false;

  if (reviewType === 'EXPEDITED') {
    const accepted = await assignmentModel.countByStatus(applicationId, 'ACCEPTED', client);
    return accepted >= 1;
  }

  if (reviewType === 'FULLBOARD') {
    // No assignments are required for FULLBOARD. Once the Chief has selected
    // FULLBOARD and the application is waiting for reviewers, the forum is open.
    return true;
  }

  return false;
};

/**
 * KETUA: Assign a reviewer to an application.
 * Assignments are only valid for EXPEDITED review.
 */
const assign = async (applicationId, reviewerId, chiefId, reviewType) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const app = await applicationModel.findById(applicationId, client);
    if (!app) {
      const err = new Error('Application not found');
      err.statusCode = 404;
      throw err;
    }
    // A replacement reviewer may be assigned while an Expedited round is
    // already in progress, for example when another reviewer rejects the task.
    // Keep prior assignments untouched so the rejection remains auditable.
    if (!['WAITING_REVIEWER', 'UNDER_REVIEW'].includes(app.status)) {
      const err = new Error(`Reviewer assignment is only allowed while waiting for reviewers or under review (current: ${app.status})`);
      err.statusCode = 400;
      throw err;
    }

    const selectedReviewType = reviewType || app.review_type;
    const VALID_REVIEW_TYPES = ['EXEMPTED', 'EXPEDITED', 'FULLBOARD'];
    if (!VALID_REVIEW_TYPES.includes(selectedReviewType)) {
      const err = new Error(`Invalid review_type "${selectedReviewType}". Must be one of: ${VALID_REVIEW_TYPES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }
    if (selectedReviewType !== 'EXPEDITED') {
      const err = new Error('Reviewer assignment is only allowed for EXPEDITED applications');
      err.statusCode = 400;
      throw err;
    }

    const reviewer = await userModel.findByIdWithRoles(reviewerId);
    if (!reviewer || reviewer.is_active !== true) {
      const err = new Error('Reviewer not found or inactive');
      err.statusCode = 404;
      throw err;
    }
    const hasReviewerRole = reviewer.roles.some((r) => r.name === 'REVIEWER');
    if (!hasReviewerRole) {
      const err = new Error('User does not have the REVIEWER role');
      err.statusCode = 400;
      throw err;
    }

    const existing = await assignmentModel.findActiveByApplicationAndReviewer(applicationId, reviewerId, client);
    if (existing) {
      const err = new Error('Reviewer already has an active assignment for this application');
      err.statusCode = 409;
      throw err;
    }

    if (app.review_type !== selectedReviewType) {
      await applicationModel.updateReviewType(applicationId, selectedReviewType, client);
    }

    const assignment = await assignmentModel.create({
      application_id: applicationId,
      reviewer_id: reviewerId,
      assigned_by: chiefId,
    }, client);

    await historyModel.create({
      application_id: applicationId,
      previous_status: app.status,
      new_status: app.status,
      changed_by: chiefId,
      note: `Reviewer assigned: ${reviewer.name}`,
    }, client);

    await client.query('COMMIT');
    return assignment;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * REVIEWER: Accept assignment. FULLBOARD reviewers do not use assignments.
 */
const acceptAssignment = async (assignmentId, reviewerId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const assignment = await assignmentModel.findById(assignmentId, client);
    if (!assignment) {
      const err = new Error('Assignment not found');
      err.statusCode = 404;
      throw err;
    }
    if (assignment.reviewer_id !== reviewerId) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }
    if (assignment.status !== 'PENDING') {
      const err = new Error(`Assignment is not pending (current status: ${assignment.status})`);
      err.statusCode = 400;
      throw err;
    }

    const updated = await assignmentModel.accept(assignmentId, client);
    const app = await applicationModel.findById(assignment.application_id, client);
    if (app && app.review_type === 'EXPEDITED') {
      await client.query(
        `INSERT INTO expedited_reviewer_states (application_id, reviewer_id, state)
         VALUES ($1, $2, 'WAITING')
         ON CONFLICT (application_id, reviewer_id) DO NOTHING`,
        [assignment.application_id, reviewerId]
      );
    }
    if (app && app.status === 'WAITING_REVIEWER') {
      const shouldTransition = await checkUnderReviewTransition(
        assignment.application_id, app.review_type, client
      );
      if (shouldTransition) {
        await applicationModel.updateStatus(assignment.application_id, 'UNDER_REVIEW', client);
        await historyModel.create({
          application_id: assignment.application_id,
          previous_status: 'WAITING_REVIEWER',
          new_status: 'UNDER_REVIEW',
          changed_by: reviewerId,
          note: 'Review process started — reviewer assignment accepted',
        }, client);
      }
    }

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const rejectAssignment = async (assignmentId, reviewerId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const assignment = await assignmentModel.findById(assignmentId, client);
    if (!assignment) {
      const err = new Error('Assignment not found');
      err.statusCode = 404;
      throw err;
    }
    if (assignment.reviewer_id !== reviewerId) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }
    if (assignment.status !== 'PENDING') {
      const err = new Error(`Assignment is not pending (current status: ${assignment.status})`);
      err.statusCode = 400;
      throw err;
    }
    const updated = await assignmentModel.reject(assignmentId, client);
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const list = async (userId, roles) => {
  if (roles.includes('REVIEWER')) return assignmentModel.findByReviewerId(userId);
  const result = await pool.query(
    `SELECT ra.*, u.name AS reviewer_name, a.research_title
     FROM review_assignments ra
     JOIN users u ON u.id = ra.reviewer_id
     JOIN applications a ON a.id = ra.application_id
     ORDER BY ra.assigned_at DESC`
  );
  return result.rows;
};

const listAvailableReviewers = async () => userModel.findReviewers();

module.exports = { assign, acceptAssignment, rejectAssignment, list, listAvailableReviewers };
