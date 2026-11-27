'use strict';
const documentService = require('../services/document.service');
const { success } = require('../utils/response');
const { sanitizeFilename } = require('../utils/file');

const upload = async (req, res, next) => {
  try {
    const { id: applicationId } = req.params;
    const { document_type } = req.body;
    const doc = await documentService.upload(applicationId, req.file, req.user.id, document_type);
    return success(res, doc, 'Document uploaded', 201);
  } catch (err) {
    next(err);
  }
};

const list = async (req, res, next) => {
  try {
    const docs = await documentService.list(req.params.id, req.user.id, req.user.roles);
    return success(res, docs, 'Documents retrieved');
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const doc = await documentService.getById(req.params.id, req.user.id, req.user.roles);
    return success(res, doc, 'Document retrieved');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await documentService.remove(req.params.id, req.user.id);
    return success(res, null, 'Document deleted');
  } catch (err) {
    next(err);
  }
};

const download = async (req, res, next) => {
  try {
    const { filePath, originalName, mimeType } = await documentService.download(
      req.params.id, req.user.id, req.user.roles
    );
    res.setHeader('Content-Disposition', `inline; filename="${sanitizeFilename(originalName)}"`);
    res.setHeader('Content-Type', mimeType);
    return res.sendFile(require('path').resolve(filePath));
  } catch (err) {
    next(err);
  }
};

module.exports = { upload, list, getById, remove, download };
