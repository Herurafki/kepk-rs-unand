'use strict';
const path = require('path');
const letterService = require('../services/letter.service');
const { success, validationError } = require('../utils/response');
const { sanitizeFilename } = require('../utils/file');

const list = async (req, res, next) => {
  try { return success(res, await letterService.list(), 'Letters retrieved'); }
  catch (err) { next(err); }
};

const get = async (req, res, next) => {
  try { return success(res, await letterService.get(req.params.id, req.user.id, req.user.roles), 'Letter retrieved'); }
  catch (err) { next(err); }
};

const generate = async (req, res, next) => {
  try {
    const { letter_type, manual_number } = req.body;
    if (!letter_type) return validationError(res, { letter_type: 'letter_type is required' });
    const letter = await letterService.generate(req.params.id, req.user.id, req.user.roles, letter_type, manual_number);
    return success(res, letter, 'Letter generated successfully', 201);
  } catch (err) { next(err); }
};

const uploadSigned = async (req, res, next) => {
  try { return success(res, await letterService.uploadSigned(req.params.id, req.file, req.user.id), 'Signed letter uploaded and permit issued', 200); }
  catch (err) { next(err); }
};

const issue = uploadSigned;

const download = async (req, res, next) => {
  try {
    const { filePath, originalName, mimeType } = await letterService.download(req.params.id, req.user.id, req.user.roles);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(originalName)}"`);
    res.setHeader('Content-Type', mimeType);
    return res.sendFile(path.resolve(filePath));
  } catch (err) { next(err); }
};

module.exports = { list, get, generate, uploadSigned, issue, download };
