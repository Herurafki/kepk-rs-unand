'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const controller = require('../controllers/application-monitoring.controller');

router.use(authenticate, authorize('SUPERADMIN'));
router.get('/', controller.list);
router.get('/summary', controller.summary);
router.get('/:id/history', controller.history);

module.exports = router;
