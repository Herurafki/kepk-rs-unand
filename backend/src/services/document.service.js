'use strict';
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');
const applicationModel = require('../models/application.model');
const documentModel = require('../models/document.model');

const hasReviewerAccess = async (applicationId, userId) => {
  const result = await pool.query(
    `SELECT 1 FROM review_assignments
     WHERE application_id = $1 AND reviewer_id = $2 AND status = 'ACCEPTED'`,
    [applicationId, userId]
  );
  return result.rows.length > 0;
};

const canReadDocuments = async (applicationId, userId, roles) => {
  if (
    roles.includes('DIKLIT') ||
    roles.includes('SEKRETARIAT') ||
    roles.includes('KETUA') ||
    roles.includes('SUPERADMIN')
  ) return true;

  const app = await applicationModel.findById(applicationId);
  if (!app) return false;

  if (roles.includes('PENELITI') && String(app.researcher_user_id) === String(userId)) {
    return true;
  }

  if (roles.includes('REVIEWER')) {
    if (app.review_type === 'FULLBOARD' && ['UNDER_REVIEW', 'REVIEW_COMPLETED'].includes(app.status)) {
      return true;
    }
    if (await hasReviewerAccess(applicationId, userId)) return true;
    // An ethics application may inherit documents from its parent research
    // application. Allow its assigned reviewer to read those parent files.
    const childAssignment = await pool.query(
      `SELECT 1
       FROM applications child
       JOIN review_assignments assignment ON assignment.application_id = child.id
       WHERE child.parent_application_id = $1
         AND assignment.reviewer_id = $2
         AND assignment.status IN ('ACCEPTED', 'COMPLETED')
       LIMIT 1`,
      [applicationId, userId]
    );
    return childAssignment.rows.length > 0;
  }
  return false;
};

const upload = async (applicationId, file, uploaderId, documentType) => {
  if (!file) {
    const err = new Error('No file uploaded');
    err.statusCode = 400;
    throw err;
  }

  const app = await applicationModel.findById(applicationId);
  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }

  if (String(app.researcher_user_id) !== String(uploaderId)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  if (app.status !== 'DRAFT' && app.status !== 'REVISION_REQUIRED') {
    const err = new Error('Documents can only be uploaded while the application is in DRAFT or REVISION_REQUIRED status');
    err.statusCode = 400;
    throw err;
  }

  const doc = await documentModel.create({
    application_id: applicationId,
    document_type: documentType || 'GENERAL',
    original_name: file.originalname,
    stored_name: path.basename(file.path),
    file_path: file.path,
    mime_type: file.mimetype,
    file_size: file.size,
    uploaded_by: uploaderId,
  });

  return doc;
};

const list = async (applicationId, userId, roles) => {
  const app = await applicationModel.findById(applicationId);
  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }

  if (!(await canReadDocuments(applicationId, userId, roles))) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  return documentModel.findByApplicationId(applicationId);
};

const getById = async (id, userId, roles) => {
  const doc = await documentModel.findById(id);
  if (!doc) {
    const err = new Error('Document not found');
    err.statusCode = 404;
    throw err;
  }

  if (!(await canReadDocuments(doc.application_id, userId, roles))) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  return doc;
};

const remove = async (id, userId) => {
  const doc = await documentModel.findById(id);
  if (!doc) {
    const err = new Error('Document not found');
    err.statusCode = 404;
    throw err;
  }

  const app = await applicationModel.findById(doc.application_id);
  if (!app || String(app.researcher_user_id) !== String(userId)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  if (app.status !== 'DRAFT' && app.status !== 'REVISION_REQUIRED') {
    const err = new Error('Documents can only be deleted while the application is in DRAFT or REVISION_REQUIRED status');
    err.statusCode = 400;
    throw err;
  }

  try {
    if (fs.existsSync(doc.file_path)) fs.unlinkSync(doc.file_path);
  } catch (fsErr) {
    console.error('[document.service] Failed to delete file from disk:', fsErr.message);
  }

  await documentModel.remove(id);
};

const MIME_BY_EXTENSION = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
};

const resolveLegacyDocumentPath = (doc, application) => {
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || 'uploads');
  const applicationRoot = path.join(uploadRoot, 'applications');
  const storedName = path.basename(String(doc.stored_name || ''));
  const applicationId = String(doc.application_id);
  const candidates = [
    doc.file_path ? path.resolve(doc.file_path) : null,
    path.join(applicationRoot, applicationId, storedName),
    path.join(applicationRoot, 'pending', storedName),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    } catch (_) {}
  }

  // Older uploads may have been stored in a temporary/legacy subdirectory.
  // Search only within the application's upload root and match the generated stored filename.
  if (storedName && fs.existsSync(applicationRoot)) {
    const stack = [{ dir: applicationRoot, depth: 0 }];
    while (stack.length) {
      const current = stack.pop();
      if (current.depth > 5) continue;
      let entries = [];
      try { entries = fs.readdirSync(current.dir, { withFileTypes: true }); } catch (_) { continue; }
      for (const entry of entries) {
        const fullPath = path.join(current.dir, entry.name);
        if (entry.isFile() && entry.name === storedName) return fullPath;
        if (entry.isDirectory()) stack.push({ dir: fullPath, depth: current.depth + 1 });
      }
    }
  }
  return null;
};

const download = async (id, userId, roles) => {
  const doc = await documentModel.findById(id);
  if (!doc) {
    const err = new Error('Document not found');
    err.statusCode = 404;
    throw err;
  }

  if (!(await canReadDocuments(doc.application_id, userId, roles))) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  const application = await applicationModel.findById(doc.application_id);
  const filePath = resolveLegacyDocumentPath(doc, application);
  if (!filePath) {
    const err = new Error('File not found on server. The stored document path could not be resolved.');
    err.statusCode = 404;
    throw err;
  }

  const extension = path.extname(doc.original_name || doc.stored_name || filePath).toLowerCase();
  const mimeType = MIME_BY_EXTENSION[extension] || doc.mime_type || 'application/octet-stream';
  return { filePath, originalName: doc.original_name || doc.stored_name || path.basename(filePath), mimeType };
};

module.exports = { upload, list, getById, remove, download };
