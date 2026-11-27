'use strict';

const pool = require('../config/database');
const applicationModel = require('../models/application.model');
const historyModel = require('../models/history.model');
const revisionModel = require('../models/revision.model');
const verificationModel = require('../models/verification.model');
const { assertValidTransition } = require('./application.service');

const assertVerifier = async (applicationId, diklatUserId, client) => {
  const result = await client.query(
    `SELECT changed_by
     FROM application_status_histories
     WHERE application_id=$1 AND new_status='ADMIN_REVIEW'
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [applicationId]
  );

  const verifierId = result.rows[0]?.changed_by;
  if (verifierId == null || String(verifierId) !== String(diklatUserId)) {
    const err = new Error('This application is being verified by another DIKLIT user');
    err.statusCode = 403;
    throw err;
  }
};

const open = async (applicationId, diklatUserId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const app = await applicationModel.findById(applicationId, client);
    if (!app) { const err = new Error('Application not found'); err.statusCode = 404; throw err; }
    assertValidTransition(app.status, 'ADMIN_REVIEW');
    const updated = await applicationModel.updateStatus(applicationId, 'ADMIN_REVIEW', client);
    await historyModel.create({ application_id: applicationId, previous_status: app.status, new_status: 'ADMIN_REVIEW', changed_by: diklatUserId, note: 'Application opened for administrative review' }, client);
    await client.query('COMMIT');
    return updated;
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
};

const requestRevision = async (applicationId, note, diklatUserId) => {
  if (!note || !String(note).trim()) { const err = new Error('Revision note is required'); err.statusCode = 422; throw err; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const app = await applicationModel.findById(applicationId, client);
    if (!app) { const err = new Error('Application not found'); err.statusCode = 404; throw err; }
    assertValidTransition(app.status, 'REVISION_REQUIRED');
    await assertVerifier(applicationId, diklatUserId, client);
    await revisionModel.create({ application_id: applicationId, requested_by: diklatUserId, note }, client);
    const updated = await applicationModel.updateStatus(applicationId, 'REVISION_REQUIRED', client);
    await historyModel.create({ application_id: applicationId, previous_status: app.status, new_status: 'REVISION_REQUIRED', changed_by: diklatUserId, note }, client);
    await client.query('COMMIT');
    return updated;
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
};

const reject = async (applicationId, note, diklatUserId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const app = await applicationModel.findById(applicationId, client);
    if (!app) { const err = new Error('Application not found'); err.statusCode = 404; throw err; }
    assertValidTransition(app.status, 'REJECTED');
    await assertVerifier(applicationId, diklatUserId, client);
    const updated = await applicationModel.updateStatus(applicationId, 'REJECTED', client);
    await historyModel.create({ application_id: applicationId, previous_status: app.status, new_status: 'REJECTED', changed_by: diklatUserId, note: note || 'Application rejected by administration' }, client);
    await client.query('COMMIT');
    return updated;
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
};

const approveWithoutEthics = async (applicationId, diklatUserId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const app = await applicationModel.findById(applicationId, client);
    if (!app) { const err = new Error('Application not found'); err.statusCode = 404; throw err; }
    assertValidTransition(app.status, 'APPROVED');
    await assertVerifier(applicationId, diklatUserId, client);
    const updated = await applicationModel.updateStatus(applicationId, 'APPROVED', client);
    await historyModel.create({ application_id: applicationId, previous_status: app.status, new_status: 'APPROVED', changed_by: diklatUserId, note: 'Administrative verification approved (no ethics review path)' }, client);
    await client.query('COMMIT');
    return updated;
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
};

const approveWithEthics = async (applicationId, diklatUserId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const app = await applicationModel.findById(applicationId, client);
    if (!app) { const err = new Error('Application not found'); err.statusCode = 404; throw err; }
    if (app.application_type !== 'IZIN_PENELITIAN') { const err = new Error('Only IZIN_PENELITIAN can be continued to ethics'); err.statusCode = 400; throw err; }
    assertValidTransition(app.status, 'REQUIRED_ETHICS');
    await assertVerifier(applicationId, diklatUserId, client);
    await applicationModel.setRequiresEthics(applicationId, true, client);
    const updated = await applicationModel.updateStatus(applicationId, 'REQUIRED_ETHICS', client);
    await historyModel.create({ application_id: applicationId, previous_status: app.status, new_status: 'REQUIRED_ETHICS', changed_by: diklatUserId, note: 'Research application approved by DIKLIT; ethics review is required' }, client);
    await client.query('COMMIT');
    return updated;
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
};

/**
 * Sekretaris forwards an application into the reviewer queue.
 *
 * ADMIN_APPROVED -> SEKRETARIS_REVIEW -> WAITING_REVIEWER
 * SEKRETARIS_REVIEW -> WAITING_REVIEWER
 *
 * The second path is important after a researcher submits a revision
 * requested by Sekretaris. The application is already SEKRETARIS_REVIEW,
 * so it must NOT attempt SEKRETARIS_REVIEW -> SEKRETARIS_REVIEW.
 */
const sekretarisForward = async (applicationId, sekretarisUserId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const app = await applicationModel.findById(applicationId, client);
    if (!app) {
      const err = new Error('Application not found');
      err.statusCode = 404;
      throw err;
    }

    if (app.application_type !== 'IZIN_ETIK') {
      const err = new Error('Only IZIN_ETIK applications can be forwarded by Sekretaris');
      err.statusCode = 400;
      throw err;
    }

    if (app.status === 'ADMIN_APPROVED') {
      assertValidTransition('ADMIN_APPROVED', 'SEKRETARIS_REVIEW');
      await applicationModel.updateStatus(applicationId, 'SEKRETARIS_REVIEW', client);
      await historyModel.create({
        application_id: applicationId,
        previous_status: 'ADMIN_APPROVED',
        new_status: 'SEKRETARIS_REVIEW',
        changed_by: sekretarisUserId,
        note: 'Forwarded to Sekretaris KEPK review',
      }, client);
    } else if (app.status !== 'SEKRETARIS_REVIEW') {
      const err = new Error(`Invalid status for Sekretaris forwarding: ${app.status}`);
      err.statusCode = 400;
      throw err;
    }

    // For a resubmitted minor revision, forwarding means the verification passed;
    // do not send it through a new reviewer round.
    const lastDecision = await client.query(
      `SELECT decision
       FROM final_decisions
       WHERE application_id = $1
       ORDER BY decision_at DESC, id DESC
       LIMIT 1`,
      [applicationId]
    );
    const lastRevision = await client.query(
      `SELECT submitted_at
       FROM revisions
       WHERE application_id = $1
       ORDER BY revision_number DESC
       LIMIT 1`,
      [applicationId]
    );
    if (lastDecision.rows[0]?.decision === 'APPROVED_MINOR' && lastRevision.rows[0]?.submitted_at) {
      // Sekretaris verifies the minor revision, then returns it to Ketua for the final decision.
      assertValidTransition('SEKRETARIS_REVIEW', 'REVIEW_COMPLETED');
      const updated = await applicationModel.updateStatus(applicationId, 'REVIEW_COMPLETED', client);
      await historyModel.create({
        application_id: applicationId,
        previous_status: 'SEKRETARIS_REVIEW',
        new_status: 'REVIEW_COMPLETED',
        changed_by: sekretarisUserId,
        note: 'Minor revision verified by Sekretaris KEPK; returned to Chief KEPK for final decision',
      }, client);
      await client.query('COMMIT');
      return updated;
    }

    assertValidTransition('SEKRETARIS_REVIEW', 'WAITING_REVIEWER');
    const updated = await applicationModel.updateStatus(applicationId, 'WAITING_REVIEWER', client);
    await historyModel.create({
      application_id: applicationId,
      previous_status: 'SEKRETARIS_REVIEW',
      new_status: 'WAITING_REVIEWER',
      changed_by: sekretarisUserId,
      note: 'Forwarded to reviewer assignment queue',
    }, client);

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const sekretarisRevision = async (applicationId, note, sekretarisUserId) => {
  if (!note || !String(note).trim()) { const err = new Error('Revision note is required'); err.statusCode = 422; throw err; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const app = await applicationModel.findById(applicationId, client);
    if (!app) { const err = new Error('Application not found'); err.statusCode = 404; throw err; }
    if (!['ADMIN_APPROVED', 'SEKRETARIS_REVIEW'].includes(app.status)) { const err = new Error(`Invalid status for sekretaris revision: ${app.status}`); err.statusCode = 400; throw err; }
    const updated = await applicationModel.updateStatus(applicationId, 'REVISION_REQUIRED', client);
    await revisionModel.create({ application_id: applicationId, requested_by: sekretarisUserId, note }, client);
    await historyModel.create({ application_id: applicationId, previous_status: app.status, new_status: 'REVISION_REQUIRED', changed_by: sekretarisUserId, note }, client);
    await client.query('COMMIT');
    return updated;
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
};

const sekretarisReject = async (applicationId, note, sekretarisUserId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const app = await applicationModel.findById(applicationId, client);
    if (!app) { const err = new Error('Application not found'); err.statusCode = 404; throw err; }
    if (!['ADMIN_APPROVED', 'SEKRETARIS_REVIEW'].includes(app.status)) { const err = new Error(`Invalid status for sekretaris rejection: ${app.status}`); err.statusCode = 400; throw err; }
    const updated = await applicationModel.updateStatus(applicationId, 'REJECTED', client);
    await historyModel.create({ application_id: applicationId, previous_status: app.status, new_status: 'REJECTED', changed_by: sekretarisUserId, note: note || 'Application rejected by Sekretaris KEPK' }, client);
    await client.query('COMMIT');
    return updated;
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
};

const getAdminQueue = async (statuses) => verificationModel.findByStatuses(statuses);
const getAdminDetail = async (applicationId, viewerUserId, allowedTypes = null) => {
  const app = await verificationModel.findByIdWithDetails(applicationId, viewerUserId);
  if (!app) return null;
  if (allowedTypes && !allowedTypes.includes(app.application_type)) {
    const err = new Error('Application is outside this role workflow');
    err.statusCode = 403;
    throw err;
  }
  return app;
};

module.exports = { open, requestRevision, reject, approveWithoutEthics, approveWithEthics, sekretarisForward, sekretarisRevision, sekretarisReject, getAdminQueue, getAdminDetail };