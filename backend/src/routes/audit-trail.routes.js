'use strict';
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const controller = require('../controllers/audit-trail.controller');

router.use(authenticate, authorize('SUPERADMIN'));
router.get('/', controller.list);

module.exports = router;
