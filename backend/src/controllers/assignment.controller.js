'use strict';
const assignmentService = require('../services/assignment.service');
const assignmentModel = require('../models/assignment.model');
const applicationService = require('../services/application.service');
const userModel = require('../models/user.model');
const { success, error, validationError } = require('../utils/response');

/**
 * List assignments — filtered by caller's role.
 * REVIEWER sees only their own assignments.
 * KETUA / SUPERADMIN see all.
 */
const list = async (req, res, next) => {
  try {
    const assignments = await assignmentService.list(req.user.id, req.user.roles);
    return success(res, assignments, 'Assignments retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * Assign reviewer — application ID comes from URL param (:id).
 * Used by inline route: POST /api/applications/:id/assign-reviewer
 */
const assign = async (req, res, next) => {
  try {
    const { reviewer_id, review_type } = req.body;
    if (!reviewer_id) return validationError(res, { reviewer_id: 'reviewer_id is required' });

    const assignment = await assignmentService.assign(
      req.params.id,
      reviewer_id,
      req.user.id,
      review_type
    );
    return success(res, assignment, 'Reviewer assigned', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Assign reviewer — application ID comes from request body.
 * Used by: POST /api/assignments
 */
const assignFromBody = async (req, res, next) => {
  try {
    const { application_id, reviewer_id, review_type } = req.body;
    const errors = {};
    if (!application_id) errors.application_id = 'application_id is required';
    if (!reviewer_id) errors.reviewer_id = 'reviewer_id is required';
    if (Object.keys(errors).length) return validationError(res, errors);

    const assignment = await assignmentService.assign(
      application_id,
      reviewer_id,
      req.user.id,
      review_type
    );
    return success(res, assignment, 'Reviewer assigned', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Reviewer accepts an assignment.
 * POST /api/review-assignments/:id/accept
 */
const accept = async (req, res, next) => {
  try {
    const assignment = await assignmentService.acceptAssignment(req.params.id, req.user.id);
    return success(res, assignment, 'Assignment accepted');
  } catch (err) {
    next(err);
  }
};

/**
 * Reviewer rejects an assignment.
 * POST /api/review-assignments/:id/reject
 */
const reject = async (req, res, next) => {
  try {
    const assignment = await assignmentService.rejectAssignment(req.params.id, req.user.id);
    return success(res, assignment, 'Assignment rejected');
  } catch (err) {
    next(err);
  }
};

/**
 * List all active REVIEWER users available for assignment.
 * GET /api/assignments/reviewers
 */
const listAvailableReviewers = async (req, res, next) => {
  try {
    const reviewers = await userModel.findReviewers();
    return success(res, reviewers, 'Available reviewers retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * List all assignments for a specific application.
 * GET /api/assignments/application/:application_id
 */
const listByApplication = async (req, res, next) => {
  try {
    await applicationService.getById(req.params.application_id, req.user.id, req.user.roles);
    const assignments = await assignmentModel.findByApplicationId(req.params.application_id);
    return success(res, assignments, 'Assignments retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * Get a single assignment by ID.
 * GET /api/assignments/:id
 */
const getById = async (req, res, next) => {
  try {
    const assignment = await assignmentModel.findById(req.params.id);
    if (!assignment) return error(res, 'Assignment not found', 404);
    if (req.user.roles.includes('REVIEWER') && !req.user.roles.includes('KETUA') && !req.user.roles.includes('SUPERADMIN') && String(assignment.reviewer_id) !== String(req.user.id)) {
      return error(res, 'Forbidden', 403);
    }
    const isOwnReviewerAssignment = req.user.roles.includes('REVIEWER') && String(assignment.reviewer_id) === String(req.user.id);
    if (!isOwnReviewerAssignment) {
      await applicationService.getById(assignment.application_id, req.user.id, req.user.roles);
    }
    return success(res, assignment, 'Assignment retrieved');
  } catch (err) {
    next(err);
  }
};

// Aliases matching spec naming convention
const acceptAssignment = accept;
const rejectAssignment = reject;

module.exports = {
  list,
  assign,
  assignFromBody,
  accept,
  reject,
  acceptAssignment,
  rejectAssignment,
  listAvailableReviewers,
  listByApplication,
  getById,
};
