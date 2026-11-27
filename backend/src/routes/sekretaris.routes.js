'use strict';
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);

router.get('/applications', authorize('SEKRETARIAT', 'SUPERADMIN'), adminController.sekretarisList);
router.get('/applications/:id', authorize('SEKRETARIAT', 'SUPERADMIN'), adminController.sekretarisDetail);
router.post('/applications/:id/forward', authorize('SEKRETARIAT'), adminController.sekretarisForward);
router.post('/applications/:id/revision', authorize('SEKRETARIAT'), adminController.sekretarisRevision);
router.post('/applications/:id/reject',authorize('SEKRETARIAT'),adminController.sekretarisReject);

module.exports = router;
