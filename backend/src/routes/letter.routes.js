'use strict';
const express = require('express');
const router = express.Router();
const letterController = require('../controllers/letter.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);
const allRoles = ['PENELITI', 'DIKLIT', 'SEKRETARIAT', 'KETUA', 'SUPERADMIN'];

router.get('/', authorize('DIKLIT', 'SEKRETARIAT', 'KETUA', 'SUPERADMIN'), letterController.list);
router.get('/:id/download', authorize(...allRoles), letterController.download);

module.exports = router;
