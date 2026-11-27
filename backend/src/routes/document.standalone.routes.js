'use strict';
const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const allRoles = ['PENELITI', 'DIKLIT', 'SEKRETARIAT', 'KETUA', 'REVIEWER', 'SUPERADMIN'];

router.use(authenticate);

// GET /api/documents/:id
router.get('/:id', authorize(...allRoles), documentController.getById);

// DELETE /api/documents/:id
router.delete('/:id', authorize('PENELITI'), documentController.remove);

// GET /api/documents/:id/download
router.get('/:id/download', authorize(...allRoles), documentController.download);

module.exports = router;
