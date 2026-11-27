'use strict';
const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);

const allRoles = ['REVIEWER', 'KETUA', 'DIKLIT', 'SEKRETARIAT', 'SUPERADMIN'];

router.get('/', authorize(...allRoles), reviewController.list);
router.get('/:id', authorize(...allRoles), reviewController.getById);
router.put('/:id', authorize('REVIEWER'), reviewController.update);
router.get('/:id/comments', authorize(...allRoles), reviewController.getComments);
router.post('/:id/comments', authorize('REVIEWER'), reviewController.addComment);

module.exports = router;
