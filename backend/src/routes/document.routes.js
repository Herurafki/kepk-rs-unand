'use strict';
const express = require('express');
const router = express.Router({ mergeParams: true });
const documentController = require('../controllers/document.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { uploadDocument } = require('../middleware/upload.middleware');

const allRoles = ['PENELITI', 'DIKLIT', 'SEKRETARIAT', 'KETUA', 'REVIEWER', 'SUPERADMIN'];

router.use(authenticate);

// Routes under /api/applications/:id/documents
router.post('/', authorize('PENELITI'), uploadDocument, documentController.upload);
router.get('/', authorize(...allRoles), documentController.list);

module.exports = router;
