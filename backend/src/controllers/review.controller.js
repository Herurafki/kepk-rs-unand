'use strict';
const reviewService = require('../services/review.service');
const { success, validationError } = require('../utils/response');
const { validateReview } = require('../validators/review.validator');

const list = async (req, res, next) => {
  try { return success(res, await reviewService.list(req.user.id, req.user.roles), 'Reviews retrieved'); } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try { return success(res, await reviewService.getById(req.params.id, req.user.id, req.user.roles), 'Review retrieved'); } catch (err) { next(err); }
};

const submit = async (req, res, next) => {
  try {
    const errors = validateReview(req.body);
    if (errors) return validationError(res, errors);
    const { recommendation, comment, assessment, document_revisions } = req.body;
    return success(
      res,
      await reviewService.submit(req.params.id, req.user.id, { recommendation, comment, assessment, document_revisions }),
      'Review submitted',
      201
    );
  } catch (err) {
    if (err.statusCode === 422 && err.details) return validationError(res, err.details);
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const errors = validateReview(req.body);
    if (errors) return validationError(res, errors);
    return success(res, await reviewService.update(req.params.id, req.body, req.user.id), 'Review updated');
  } catch (err) { next(err); }
};

const getComments = async (req, res, next) => {
  try { return success(res, await reviewService.getComments(req.params.id, req.user.id, req.user.roles), 'Comments retrieved'); } catch (err) { next(err); }
};

const addComment = async (req, res, next) => {
  try {
    const { comment } = req.body;
    return success(res, await reviewService.addComment(req.params.id, comment, req.user.id), 'Comment added', 201);
  } catch (err) { next(err); }
};

const getRecommendationsByApplication = async (req, res, next) => {
  try {
    return success(
      res,
      await reviewService.getRecommendationsByApplication(req.params.id, req.user.id, req.user.roles),
      'Application recommendations retrieved'
    );
  } catch (err) { next(err); }
};

const getReviewResult = async (req, res, next) => {
  try {
    return success(
      res,
      await reviewService.getReviewResult(req.params.id, req.user.id, req.user.roles),
      'Review result retrieved'
    );
  } catch (err) { next(err); }
};

const setReviewType = async (req, res, next) => {
  try {
    const { review_type, forum_date } = req.body;
    const errors = {};
    if (!review_type) errors.review_type = 'review_type is required';
    if (Object.keys(errors).length) return validationError(res, errors);
    const app = await reviewService.setReviewType(req.params.id, review_type, forum_date, req.user.id);
    return success(res, app, 'Review type set');
  } catch (err) { next(err); }
};

const closeForum = async (req, res, next) => {
  try {
    const result = await reviewService.closeForum(req.params.id, req.user.id, req.body.note);
    return success(res, result, 'FULLBOARD forum closed');
  } catch (err) { next(err); }
};

const decideApprove = async (req, res, next) => {
  try { return success(res, await reviewService.decide(req.params.id, 'APPROVED', req.body.note, req.user.id), 'Application approved'); } catch (err) { next(err); }
};
const decideRevision = async (req, res, next) => {
  try {
    const { note } = req.body;
    if (!note || String(note).trim().length === 0) return validationError(res, { note: 'Revision note is required' });
    return success(res, await reviewService.decide(req.params.id, 'REVISION_REQUIRED', note, req.user.id), 'Revision requested');
  } catch (err) { next(err); }
};
const decideReject = async (req, res, next) => {
  try { return success(res, await reviewService.decide(req.params.id, 'REJECTED', req.body.note, req.user.id), 'Application rejected'); } catch (err) { next(err); }
};
const decideFinal = async (req, res, next) => {
  try {
    const { decision, note } = req.body;
    if (!decision) return validationError(res, { decision: 'decision is required' });
    if (['APPROVED_MINOR', 'MAJOR_REVISION'].includes(decision) && !String(note || '').trim()) {
      return validationError(res, { note: 'Catatan wajib diisi untuk keputusan perbaikan.' });
    }
    return success(res, await reviewService.decide(req.params.id, decision, note, req.user.id), 'Final decision saved');
  } catch (err) { next(err); }
};

module.exports = {
  list,
  getById,
  submit,
  update,
  getComments,
  addComment,
  getRecommendationsByApplication,
  getReviewResult,
  setReviewType,
  closeForum,
  decideApprove,
  decideRevision,
  decideReject,
  decideFinal,
};
