'use strict';
const express = require('express');
const router = express.Router({ mergeParams: true });
const screeningController = require('../controllers/screening.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);

const allRoles = ['RESEARCHER', 'DIKLAT', 'SEKRETARIS_KEPK', 'CHIEF_KEPK', 'REVIEWER', 'SUPERADMIN'];

// GET /api/applications/:id/screening
router.get('/', authorize(...allRoles), screeningController.get);

// Save/update screening while the researcher is completing the application.
// Upsert is intentional because one application has exactly one screening.
router.post('/', authorize('RESEARCHER'), screeningController.save);
router.put('/', authorize('RESEARCHER'), screeningController.save);

// Delete screening. Only allowed while the application is editable.
router.delete('/', authorize('RESEARCHER'), screeningController.remove);

module.exports = router;
