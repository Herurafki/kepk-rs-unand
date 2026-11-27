'use strict';
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);

// DIKLIT routes
router.get('/applications', authorize('DIKLIT', 'SUPERADMIN'), adminController.list);
router.get('/applications/:id', authorize('DIKLIT', 'SUPERADMIN'), adminController.getById);
router.post('/applications/:id/open', authorize('DIKLIT'), adminController.open);
router.post('/applications/:id/revision', authorize('DIKLIT'), adminController.revision);
router.post('/applications/:id/reject', authorize('DIKLIT', 'SEKRETARIAT'), adminController.reject);
router.post('/applications/:id/approve-without-ethics', authorize('DIKLIT'), adminController.approveWithoutEthics);
router.post('/applications/:id/approve-with-ethics', authorize('DIKLIT'), adminController.approveWithEthics);

module.exports = router;
