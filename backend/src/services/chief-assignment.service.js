'use strict';
const pool = require('../config/database');
const applicationModel = require('../models/application.model');
const assignmentModel = require('../models/assignment.model');
const historyModel = require('../models/history.model');
const userModel = require('../models/user.model');

const assign = async (applicationId, reviewerId, chiefId, reviewType) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const app = await applicationModel.findById(applicationId, client);
    if (!app) { const err = new Error('Application not found'); err.statusCode = 404; throw err; }
    if (app.application_type !== 'IZIN_ETIK') { const err = new Error('Reviewer assignment is only available for ethics applications'); err.statusCode = 400; throw err; }
    if (!['WAITING_REVIEWER', 'UNDER_REVIEW'].includes(app.status)) { const err = new Error(`Application cannot be assigned in status ${app.status}`); err.statusCode = 400; throw err; }
    if (!['EXPEDITED', 'FULLBOARD', 'FULL_BOARD'].includes(reviewType)) { const err = new Error('Reviewer assignment is only available for EXPEDITED or FULLBOARD'); err.statusCode = 400; throw err; }
    const reviewer = await userModel.findByIdWithRoles(reviewerId);
    if (!reviewer || reviewer.is_active !== true || !reviewer.roles.some(r => r.name === 'REVIEWER')) { const err = new Error('Reviewer not found, inactive, or does not have REVIEWER role'); err.statusCode = 404; throw err; }
    const normalizedType = reviewType === 'FULL_BOARD' ? 'FULLBOARD' : reviewType;
    if (app.review_type !== normalizedType) await applicationModel.updateReviewType(applicationId, normalizedType, client);
    const existing = await assignmentModel.findActiveByApplicationAndReviewer(applicationId, reviewerId, client);
    if (existing) { const err = new Error('Reviewer already has an active assignment for this application'); err.statusCode = 409; throw err; }
    const assignment = await assignmentModel.create({ application_id: applicationId, reviewer_id: reviewerId, assigned_by: chiefId }, client);
    await historyModel.create({ application_id: applicationId, previous_status: app.status, new_status: app.status, changed_by: chiefId, note: `Reviewer assigned: ${reviewer.name}` }, client);
    await client.query('COMMIT');
    return assignment;
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};
module.exports = { assign };
