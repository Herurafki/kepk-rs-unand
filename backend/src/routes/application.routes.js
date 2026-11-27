'use strict';
const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/application.controller');
const reviewController = require('../controllers/review.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { uploadApplicationDocuments } = require('../middleware/upload.middleware');

router.use(authenticate);

const allRoles = ['PENELITI', 'DIKLIT', 'SEKRETARIAT', 'KETUA', 'REVIEWER', 'SUPERADMIN'];
const reviewResultRoles = ['REVIEWER', 'KETUA', 'DIKLIT', 'SEKRETARIAT', 'SUPERADMIN'];

router.get('/', authorize(...allRoles), applicationController.list);
router.get('/:id', authorize(...allRoles), applicationController.getById);
router.post('/', authorize('PENELITI'), uploadApplicationDocuments, applicationController.create);
router.post('/:id/continue-to-ethics', authorize('PENELITI'), applicationController.createEthics);
router.put('/:id', authorize('PENELITI'), applicationController.update);
router.delete('/:id', authorize('PENELITI'), applicationController.remove);
router.post('/:id/submit', authorize('PENELITI'), applicationController.submit);
router.post('/:id/revise', authorize('PENELITI'), applicationController.revise);

// Reviewer assessment submission and application-level result endpoints.
router.post('/:id/reviews', authorize('REVIEWER'), reviewController.submit);
router.get('/:id/reviews', authorize(...reviewResultRoles), reviewController.getRecommendationsByApplication);
router.get('/:id/review-result', authorize(...reviewResultRoles), reviewController.getReviewResult);

// KETUA review controls.
router.put('/:id/review-type', authorize('KETUA'), reviewController.setReviewType);
router.post('/:id/close-forum', authorize('KETUA'), reviewController.closeForum);

module.exports = router;
