'use strict';
const pool = require('../config/database');
const applicationModel = require('../models/application.model');
const screeningModel = require('../models/screening.model');
const historyModel = require('../models/history.model');
const revisionModel = require('../models/revision.model');
const userModel = require('../models/user.model');
const documentModel = require('../models/document.model');
const applicationAccess = require('./application-access.service');
const screeningValidator = require('../validators/screening.validator');
const recommendationService = require('./screening_recommendation.service');
const { validateForSubmission } = require('../validators/application.validator');

const VALID_APPLICATION_TYPES = ['DATA_AWAL', 'IZIN_PENELITIAN', 'IZIN_ETIK'];
const TYPE_TO_SCREENING = { IZIN_PENELITIAN: 'RESEARCH', IZIN_ETIK: 'ETHICS' };

const getResearcherByUserId = async (userId) => {
  const researcher = await userModel.findResearcherByUserId(userId);
  if (!researcher) {
    const err = new Error('Researcher profile not found');
    err.statusCode = 404;
    throw err;
  }
  return researcher;
};

const VALID_TRANSITIONS = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['ADMIN_REVIEW'],
  ADMIN_REVIEW: ['REVISION_REQUIRED', 'APPROVED', 'REQUIRED_ETHICS', 'REJECTED'],
  REVISION_REQUIRED: ['SUBMITTED', 'SEKRETARIS_REVIEW', 'UNDER_REVIEW', 'WAITING_REVIEWER'],
  ADMIN_APPROVED: ['PERMIT_ISSUED', 'SEKRETARIS_REVIEW'],
  REQUIRED_ETHICS: ['APPROVED'],
  SEKRETARIS_REVIEW: ['REVISION_REQUIRED', 'WAITING_REVIEWER', 'REVIEW_COMPLETED', 'APPROVED', 'REJECTED', 'NOT_ASSESSABLE'],
  WAITING_REVIEWER: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED', 'NOT_ASSESSABLE'],
  UNDER_REVIEW: ['REVIEW_COMPLETED', 'REVISION_REQUIRED'],
  REVIEW_COMPLETED: ['APPROVED', 'REJECTED', 'REVISION_REQUIRED', 'NOT_ASSESSABLE'],
  APPROVED: ['PERMIT_ISSUED'],
  REJECTED: [],
  NOT_ASSESSABLE: [],
  PERMIT_ISSUED: [],
};

const assertValidTransition = (current, next) => {
  if (!(VALID_TRANSITIONS[current] || []).includes(next)) {
    const err = new Error(`Invalid status transition from ${current} to ${next}`);
    err.statusCode = 400;
    throw err;
  }
};

const list = async (userId, roles) => {
  if (roles.includes('PENELITI')) {
    return applicationModel.findAll({ researcher_id: (await getResearcherByUserId(userId)).id });
  }
  if (roles.includes('REVIEWER')  && !roles.includes('SUPERADMIN')) {
    return applicationModel.findForReviewer(userId);
  }
  if (roles.includes('DIKLIT')) {
    return applicationModel.findAll({
      status: ['SUBMITTED', 'ADMIN_REVIEW', 'APPROVED', 'REQUIRED_ETHICS', 'ADMIN_APPROVED', 'PERMIT_ISSUED', 'REJECTED', 'REVISION_REQUIRED'],
      application_type: ['DATA_AWAL', 'IZIN_PENELITIAN'],
      include_researcher_profile: true,
    });
  }
  if (roles.includes('SEKRETARIAT')) {
    return applicationModel.findAll({
      status: ['SEKRETARIS_REVIEW', 'WAITING_REVIEWER', 'UNDER_REVIEW', 'REVIEW_COMPLETED','REVISION_REQUIRED', 'APPROVED', 'REJECTED', 'PERMIT_ISSUED'],
      application_type: 'IZIN_ETIK',
      include_researcher_profile: true,
    });
  }
  if (roles.includes('KETUA')) {
    return applicationModel.findAll({
      status: [ 'WAITING_REVIEWER', 'UNDER_REVIEW', 'REVIEW_COMPLETED', 'APPROVED', 'REJECTED', 'NOT_ASSESSABLE', 'PERMIT_ISSUED'],
      application_type: 'IZIN_ETIK',
    });
  }
  return applicationModel.findAll({});
};

const getById = async (id, userId, roles) => {
  const app = await applicationModel.findById(id);
  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }

  await applicationAccess.assertApplicationAccess(app, userId, roles);

  if (app.review_type === 'EXPEDITED') {
    const revisionRequests = await pool.query(
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
      [id]
    );
    app.expedited_revision_requests = revisionRequests.rows;
    const progressResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE ra.status = 'PENDING')::int AS pending_count,
         COUNT(*) FILTER (WHERE ra.status IN ('ACCEPTED', 'COMPLETED'))::int AS assigned_count,
         COUNT(*) FILTER (
           WHERE ra.status IN ('ACCEPTED', 'COMPLETED')
             AND ers.state IN ('FINAL', 'NEEDS_REVISION')
         )::int AS decided_count,
         COUNT(*) FILTER (
           WHERE ra.status IN ('ACCEPTED', 'COMPLETED')
             AND ers.state = 'NEEDS_REVISION'
         )::int AS revision_count,
         COUNT(*) FILTER (
           WHERE ra.status = 'REJECTED'
             AND NOT EXISTS (
               SELECT 1 FROM review_assignments replacement
               WHERE replacement.application_id = ra.application_id
                 AND replacement.assigned_at > ra.rejected_at
                 AND replacement.status IN ('PENDING', 'ACCEPTED', 'COMPLETED')
             )
         )::int AS unreplaced_rejections
       FROM review_assignments ra
       LEFT JOIN expedited_reviewer_states ers
         ON ers.application_id = ra.application_id
        AND ers.reviewer_id = ra.reviewer_id
       WHERE ra.application_id = $1`,
      [id]
    );
    const progress = progressResult.rows[0];
    app.expedited_revision_ready = Number(progress.revision_count) > 0 &&
      Number(progress.pending_count) === 0 &&
      Number(progress.unreplaced_rejections) === 0 &&
      Number(progress.assigned_count) === Number(progress.decided_count);
  } else {
    app.expedited_revision_requests = [];
    app.expedited_revision_ready = false;
  }

  const correspondenceResult = await pool.query('SELECT * FROM application_correspondence WHERE application_id = $1', [app.id]);
  app.correspondence = correspondenceResult.rows[0] || null;

  const ownDocuments = await documentModel.findByApplicationId(app.id);
  if (app.application_type === 'IZIN_ETIK' && app.parent_application_id) {
    const parentDocuments = await documentModel.findByApplicationId(app.parent_application_id);
    app.documents = [
      ...parentDocuments.map((doc) => ({ ...doc, source: 'PARENT_APPLICATION', inherited: true })),
      ...ownDocuments.map((doc) => ({ ...doc, source: 'ETHICS_APPLICATION', inherited: false })),
    ];
    app.inherited_documents = parentDocuments;
    app.additional_documents = ownDocuments;
  } else {
    app.documents = ownDocuments;
    app.inherited_documents = [];
    app.additional_documents = ownDocuments;
  }

  // For the researcher-facing document list, show the latest replacement file
  // in place of its original document. The original remains referenced by the
  // revision request so the reviewer/chief can still inspect the revision history.
  if (app.review_type === 'EXPEDITED' && app.expedited_revision_requests?.length) {
    const latestReplacementByOriginal = new Map();
    for (const request of app.expedited_revision_requests) {
      for (const item of request.items || []) {
        if (!item.revised_document_id) continue;
        const key = String(item.document_id);
        const existing = latestReplacementByOriginal.get(key);
        if (!existing || new Date(item.revised_at || request.submitted_at || request.created_at).getTime() >= existing.timestamp) {
          latestReplacementByOriginal.set(key, {
            documentId: String(item.revised_document_id),
            timestamp: new Date(item.revised_at || request.submitted_at || request.created_at).getTime(),
          });
        }
      }
    }

    if (latestReplacementByOriginal.size) {
      const replacementIds = [...new Set([...latestReplacementByOriginal.values()].map(item => item.documentId))];
      const replacementResult = await pool.query(
        'SELECT * FROM documents WHERE id = ANY($1::bigint[])',
        [replacementIds]
      );
      const replacementById = new Map(replacementResult.rows.map(doc => [String(doc.id), doc]));
      const replacementEntries = [...latestReplacementByOriginal.entries()];

      app.documents = app.documents.map((original) => {
        const replacement = latestReplacementByOriginal.get(String(original.id));
        const replacementDocument = replacement && replacementById.get(replacement.documentId);
        return replacementDocument
          ? {
              ...replacementDocument,
              document_type: replacementDocument.document_type || original.document_type,
              replaces_document_id: original.id,
              is_replacement: true,
              source: original.source,
              inherited: original.inherited,
            }
          : original;
      });

      app.inherited_documents = app.inherited_documents.map((original) => {
        const replacement = latestReplacementByOriginal.get(String(original.id));
        const replacementDocument = replacement && replacementById.get(replacement.documentId);
        return replacementDocument
          ? { ...replacementDocument, document_type: replacementDocument.document_type || original.document_type, replaces_document_id: original.id, is_replacement: true }
          : original;
      });

      app.additional_documents = app.additional_documents.map((original) => {
        const replacement = latestReplacementByOriginal.get(String(original.id));
        const replacementDocument = replacement && replacementById.get(replacement.documentId);
        return replacementDocument
          ? { ...replacementDocument, document_type: replacementDocument.document_type || original.document_type, replaces_document_id: original.id, is_replacement: true }
          : original;
      });
    }
  }
  return app;
};

const create = async (data, files, uploadDir, userId) => {
  const applicationType = data.application_type || 'IZIN_PENELITIAN';
  if (!VALID_APPLICATION_TYPES.includes(applicationType)) {
    const err = new Error(`Application type must be one of: ${VALID_APPLICATION_TYPES.join(', ')}`);
    err.statusCode = 422;
    throw err;
  }

  const researcher = await getResearcherByUserId(userId);
  const applicationNumber = await applicationModel.reserveApplicationNumber();
  const client = await pool.connect();
  const movedFiles = [];

  try {
    await client.query('BEGIN');

    if (applicationType === 'IZIN_ETIK') {
      const rawParentApplicationId = String(data.parent_application_id || '').trim();
      const hasParent = rawParentApplicationId && rawParentApplicationId !== 'undefined' && rawParentApplicationId !== 'null';

      if (hasParent) {
        if (!/^\d+$/.test(rawParentApplicationId)) {
          const err = new Error('A valid parent_application_id is required for IZIN_ETIK continuation');
          err.statusCode = 422;
          throw err;
        }

        const parent = await applicationModel.findByIdForUpdate(rawParentApplicationId, client);
        if (!parent || String(parent.researcher_user_id) !== String(userId)) {
          const err = new Error('Parent research application not found');
          err.statusCode = 404;
          throw err;
        }
        if (parent.application_type !== 'IZIN_PENELITIAN' || !['REQUIRED_ETHICS', 'ADMIN_APPROVED'].includes(parent.status) || !parent.requires_ethics) {
          const err = new Error('This research application has not been approved for ethics continuation');
          err.statusCode = 400;
          throw err;
        }
        const existing = await applicationModel.findEthicsByParentId(parent.id, client);
        if (existing) {
          await client.query('ROLLBACK');
          return existing;
        }

        data.parent_application_id = parent.id;
      } else {
        data.parent_application_id = null;
      }
    }

    const app = await applicationModel.create({ ...data, application_number: applicationNumber, application_type: applicationType, researcher_id: researcher.id }, client);
    if (applicationType === 'DATA_AWAL' || applicationType === 'IZIN_PENELITIAN') {
      let correspondence = data.correspondence;
      if (typeof correspondence === 'string') {
        try { correspondence = JSON.parse(correspondence); } catch (_) { const err = new Error('correspondence must be valid JSON'); err.statusCode = 422; throw err; }
      }
      const requiredFields = ['incoming_letter_number', 'incoming_letter_subject', 'signatory_position'];
      const missing = requiredFields.filter((field) => !correspondence || !String(correspondence[field] || '').trim());
      if (missing.length) { const err = new Error('Institutional cover letter number, subject, and signatory position are required'); err.statusCode = 422; err.errors = Object.fromEntries(missing.map((field) => [field, 'This field is required'])); throw err; }
      await client.query('INSERT INTO application_correspondence (application_id, incoming_letter_number, incoming_letter_subject, signatory_position, recipient_institution, incoming_letter_date) VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()))',
        [app.id, String(correspondence.incoming_letter_number).trim(), String(correspondence.incoming_letter_subject).trim(), String(correspondence.signatory_position).trim(), researcher.institution || data.research_institution || null, app.created_at || null]);
    }

    if (applicationType !== 'DATA_AWAL') {
      let answers = data.screening;
      if (typeof answers === 'string') {
        try { answers = JSON.parse(answers); } catch (_) {
          const err = new Error('screening must be valid JSON');
          err.statusCode = 422;
          throw err;
        }
      }
      const screeningType = TYPE_TO_SCREENING[applicationType];
      const screeningAnswers = answers && answers.answers ? answers.answers : answers;
      const screeningErrors = screeningValidator.validate(screeningAnswers, screeningType);
      if (screeningErrors) {
        const err = new Error('Invalid screening data');
        err.statusCode = 422;
        err.errors = { screening: screeningErrors };
        throw err;
      }
      const recommendation = recommendationService.recommend(screeningType, screeningAnswers);
      await screeningModel.upsert(app.id, screeningType, screeningAnswers, recommendation, client);
    }

    const documentTypes = data.document_types ? (typeof data.document_types === 'string' ? JSON.parse(data.document_types) : data.document_types) : [];
    if (!Array.isArray(documentTypes) && files.length > 0) {
      const err = new Error('document_types must be an array when documents are uploaded');
      err.statusCode = 422;
      throw err;
    }
    if (applicationType !== 'DATA_AWAL' && applicationType !== 'IZIN_ETIK' && files.length === 0) {
      const err = new Error('At least one document is required');
      err.statusCode = 422;
      throw err;
    }
    if (files.length > 0 && documentTypes.length !== files.length) {
      const err = new Error('document_types count must match uploaded documents count');
      err.statusCode = 422;
      throw err;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const finalDir = require('path').join(process.env.UPLOAD_DIR || 'uploads', 'applications', String(app.id));
      require('fs').mkdirSync(finalDir, { recursive: true });
      const finalPath = require('path').join(finalDir, require('path').basename(file.path));
      require('fs').renameSync(file.path, finalPath);
      movedFiles.push(finalPath);
      await documentModel.create({
        application_id: app.id,
        document_type: documentTypes[i] || 'GENERAL',
        original_name: file.originalname,
        stored_name: require('path').basename(finalPath),
        file_path: finalPath,
        mime_type: file.mimetype,
        file_size: file.size,
        uploaded_by: userId,
      }, client);
    }

    const initialStatus = applicationType === 'IZIN_ETIK' ? 'SEKRETARIS_REVIEW' : 'SUBMITTED';
    await applicationModel.updateStatus(app.id, initialStatus, client);
    await historyModel.create({
      application_id: app.id,
      previous_status: 'DRAFT',
      new_status: initialStatus,
      changed_by: userId,
      note: applicationType === 'IZIN_ETIK' ? 'Ethics application submitted by researcher to Sekretaris KEPK' : 'Application submitted by researcher',
    }, client);

    await client.query('COMMIT');
    return applicationModel.findById(app.id);
  } catch (err) {
    await client.query('ROLLBACK');
    for (const filePath of movedFiles) {
      try { require('fs').unlinkSync(filePath); } catch (_) {}
    }
    if (uploadDir) {
      try { require('fs').rmSync(uploadDir, { recursive: true, force: true }); } catch (_) {}
    }
    throw err;
  } finally {
    client.release();
  }
};

const createEthicsApplication = async (parentId, userId) => {
  const parent = await applicationModel.findById(parentId);
  if (!parent) {
    const err = new Error('Research application not found');
    err.statusCode = 404;
    throw err;
  }
  if (String(parent.researcher_user_id) !== String(userId)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  if (parent.application_type !== 'IZIN_PENELITIAN' || !['REQUIRED_ETHICS', 'ADMIN_APPROVED'].includes(parent.status) || !parent.requires_ethics) {
    const err = new Error('Application is not eligible for ethics continuation');
    err.statusCode = 400;
    throw err;
  }
  return { id: parent.id, application_id: parent.id, parent_application_id: parent.id, application_type: 'IZIN_ETIK', can_continue: true };
};

const update = async (id, data, userId) => {
  const app = await applicationModel.findById(id);
  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }
  if (String(app.researcher_user_id) !== String(userId)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  if (app.status !== 'DRAFT') {
    const err = new Error('Only DRAFT applications can be updated');
    err.statusCode = 400;
    throw err;
  }
  return applicationModel.update(id, data);
};

const remove = async (id, userId) => {
  const app = await applicationModel.findById(id);
  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }
  if (String(app.researcher_user_id) !== String(userId)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  if (app.status !== 'DRAFT') {
    const err = new Error('Only DRAFT applications can be deleted');
    err.statusCode = 400;
    throw err;
  }
  await applicationModel.remove(id);
};

const submit = async (id, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const app = await applicationModel.findById(id, client);
    if (!app) {
      const err = new Error('Application not found');
      err.statusCode = 404;
      throw err;
    }
    if (String(app.researcher_user_id) !== String(userId)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }
    assertValidTransition(app.status, 'SUBMITTED');
    const fieldErrors = validateForSubmission(app);
    if (fieldErrors) {
      const err = new Error('Application is missing required fields for submission');
      err.statusCode = 422;
      err.errors = fieldErrors;
      throw err;
    }
    const docCheck = await client.query('SELECT COUNT(*) AS cnt FROM documents WHERE application_id=$1', [id]);
    if (parseInt(docCheck.rows[0].cnt, 10) === 0) {
      const err = new Error('At least one document must be uploaded before submission');
      err.statusCode = 422;
      throw err;
    }
    const screening = await screeningModel.findByApplicationId(id, client);
    if (app.application_type !== 'DATA_AWAL' && !screening) {
      const err = new Error('Application screening must be completed before submission');
      err.statusCode = 422;
      throw err;
    }
    const updated = await applicationModel.updateStatus(id, 'SUBMITTED', client);
    await historyModel.create({ application_id: id, previous_status: app.status, new_status: 'SUBMITTED', changed_by: userId, note: 'Application submitted by researcher' }, client);
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const revise = async (id, data, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const app = await applicationModel.findById(id, client);
    if (!app) {
      const err = new Error('Application not found');
      err.statusCode = 404;
      throw err;
    }
    if (String(app.researcher_user_id) !== String(userId)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }
    if (app.status !== 'REVISION_REQUIRED') {
      const err = new Error(`Cannot revise application in status ${app.status}. Application must be in REVISION_REQUIRED status.`);
      err.statusCode = 400;
      throw err;
    }

    if (app.review_type === 'EXPEDITED') {
      const reviewerProgress = await client.query(
        `SELECT
           COUNT(*) FILTER (WHERE ra.status = 'PENDING')::int AS pending_count,
           COUNT(*) FILTER (WHERE ra.status IN ('ACCEPTED', 'COMPLETED'))::int AS assigned_count,
           COUNT(*) FILTER (
             WHERE ra.status IN ('ACCEPTED', 'COMPLETED')
               AND ers.state IN ('FINAL', 'NEEDS_REVISION')
           )::int AS decided_count,
           COUNT(*) FILTER (
             WHERE ra.status IN ('ACCEPTED', 'COMPLETED')
               AND ers.state = 'NEEDS_REVISION'
           )::int AS revision_count,
           COUNT(*) FILTER (
             WHERE ra.status = 'REJECTED'
               AND NOT EXISTS (
                 SELECT 1 FROM review_assignments replacement
                 WHERE replacement.application_id = ra.application_id
                   AND replacement.assigned_at > ra.rejected_at
                   AND replacement.status IN ('PENDING', 'ACCEPTED', 'COMPLETED')
               )
           )::int AS unreplaced_rejections
         FROM review_assignments ra
         LEFT JOIN expedited_reviewer_states ers
           ON ers.application_id = ra.application_id
          AND ers.reviewer_id = ra.reviewer_id
         WHERE ra.application_id = $1`,
        [id]
      );
      const progress = reviewerProgress.rows[0];
      if (Number(progress.revision_count) < 1 ||
          Number(progress.pending_count) > 0 ||
          Number(progress.unreplaced_rejections) > 0 ||
          Number(progress.assigned_count) !== Number(progress.decided_count)) {
        const err = new Error('Wait until every assigned reviewer has accepted or been replaced and submitted a decision before resubmitting revised documents');
        err.statusCode = 409;
        throw err;
      }

      const openRequests = await client.query(
        "SELECT id FROM expedited_revision_requests WHERE application_id = $1 AND status = 'OPEN'",
        [id]
      );
      if (openRequests.rows.length > 0) {
        let revisedDocuments = data && data.revised_documents ? data.revised_documents : [];
        if (typeof revisedDocuments === 'string') {
          try { revisedDocuments = JSON.parse(revisedDocuments); } catch (_) {
            const err = new Error('revised_documents must be valid JSON'); err.statusCode = 422; throw err;
          }
        }
        if (!Array.isArray(revisedDocuments)) {
          const err = new Error('revised_documents must be an array'); err.statusCode = 422; throw err;
        }
        const requiredItems = await client.query(
          `SELECT item.id, item.document_id
           FROM expedited_revision_items item
           JOIN expedited_revision_requests req ON req.id = item.request_id
           WHERE req.application_id = $1 AND req.status = 'OPEN'`,
          [id]
        );
        const submittedIds = new Set(revisedDocuments.map((item) => String(item && item.item_id)));
        if (revisedDocuments.length !== requiredItems.rows.length || submittedIds.size !== revisedDocuments.length) {
          const err = new Error('Submit exactly one replacement document for each requested revision item');
          err.statusCode = 422; throw err;
        }
        for (const item of revisedDocuments) {
          if (!item || !/^\d+$/.test(String(item.item_id || '')) || !/^\d+$/.test(String(item.document_id || ''))) {
            const err = new Error('Each replacement must contain valid item_id and document_id values');
            err.statusCode = 422; throw err;
          }
        }
        for (const required of requiredItems.rows) {
          if (!submittedIds.has(String(required.id))) {
            const err = new Error('All requested document revisions must be uploaded before resubmission');
            err.statusCode = 422; throw err;
          }
        }
        for (const item of revisedDocuments) {
          const updatedItem = await client.query(
            `UPDATE expedited_revision_items item
             SET revised_document_id = replacement.id, revised_at = NOW()
             FROM expedited_revision_requests req,
                  documents replacement,
                  documents original
             WHERE item.id = $2
               AND req.id = item.request_id
               AND req.application_id = $3
               AND req.status = 'OPEN'
               AND original.id = item.document_id
               AND replacement.id = $1
               AND replacement.application_id = $3
               AND replacement.document_type = original.document_type
             RETURNING item.id`,
            [item.document_id, item.item_id, id]
          );
          if (!updatedItem.rows[0]) {
            const err = new Error('Replacement document must belong to this application, match the requested document type, and reference an open revision item');
            err.statusCode = 422; throw err;
          }
        }
        await client.query(
          "UPDATE expedited_revision_requests SET status = 'SUBMITTED', submitted_at = NOW() WHERE application_id = $1 AND status = 'OPEN'",
          [id]
        );
        await client.query(
          "UPDATE expedited_reviewer_states SET state = 'IN_REVIEW', updated_at = NOW() WHERE application_id = $1 AND state = 'NEEDS_REVISION'",
          [id]
        );
        await applicationModel.updateStatus(id, 'UNDER_REVIEW', client);
        await historyModel.create({
          application_id: id, previous_status: app.status, new_status: 'UNDER_REVIEW',
          changed_by: userId, note: 'Researcher resubmitted documents requested by Expedited reviewers',
        }, client);
        await client.query('COMMIT');
        return applicationModel.findById(id);
      }
    }

    const openRevision = await revisionModel.findOpenRequester(id, client);
    const latestDecisionResult = await client.query(
      `SELECT decision
       FROM final_decisions
       WHERE application_id = $1
       ORDER BY decision_at DESC, id DESC
       LIMIT 1`,
      [id]
    );
    const latestDecision = latestDecisionResult.rows[0]?.decision;
    const requestedBySecretary = openRevision?.requested_by_roles?.includes('SEKRETARIAT');
    let nextStatus = requestedBySecretary ? 'SEKRETARIS_REVIEW' : 'SUBMITTED';
    let clearReviewType = false;

    if (latestDecision === 'APPROVED_MINOR') {
      // Minor revisions are verified by Sekretaris, with no new reviewer round.
      nextStatus = 'SEKRETARIS_REVIEW';
    } else if (latestDecision === 'MAJOR_REVISION') {
      // Major revisions must be reviewed again. Keep the existing Expedited
      // assignment set; other types return to the Chief to configure a new round.
      if (app.review_type === 'EXPEDITED') {
        nextStatus = 'UNDER_REVIEW';
      } else {
        nextStatus = 'WAITING_REVIEWER';
        clearReviewType = true;
      }
    }
    assertValidTransition(app.status, nextStatus);

    if (data && Object.keys(data).length > 0) {
      await applicationModel.update(id, data, client);
    }
    if (clearReviewType) {
      await client.query(
        `UPDATE applications
         SET review_type = NULL, forum_date = NULL, forum_closed_at = NULL, updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
    }
    await applicationModel.updateStatus(id, nextStatus, client);
    await revisionModel.markSubmitted(id, client);
    const resubmissionNote = latestDecision === 'APPROVED_MINOR'
      ? 'Minor revision resubmitted; returned for Sekretaris verification without reviewer reassignment'
      : latestDecision === 'MAJOR_REVISION'
        ? (nextStatus === 'UNDER_REVIEW'
          ? 'Major revision resubmitted; returned to assigned reviewers for a new assessment cycle'
          : 'Major revision resubmitted; returned to Chief KEPK to configure the next review round')
        : requestedBySecretary
          ? 'Application resubmitted after Secretary revision; returned to Sekretaris KEPK'
          : 'Application resubmitted after revision';
    await historyModel.create({
      application_id: id,
      previous_status: app.status,
      new_status: nextStatus,
      changed_by: userId,
      note: resubmissionNote,
    }, client);

    await client.query('COMMIT');
    return applicationModel.findById(id, client);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { list, getById, create, createEthicsApplication, update, remove, submit, revise, assertValidTransition, VALID_TRANSITIONS };
