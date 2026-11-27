'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/session-settings.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);
router.get('/idle-session', controller.getIdleSessionSettings);
router.patch('/idle-session', authorize('SUPERADMIN'), controller.updateIdleSessionSettings);
router.get('/letter-numbers', authorize('DIKLIT', 'SEKRETARIAT'), controller.getLetterNumberSettings);
router.put('/letter-numbers', authorize('DIKLIT', 'SEKRETARIAT'), controller.updateLetterNumberSettings);

module.exports = router;
