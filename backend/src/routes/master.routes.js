
'use strict';

const express = require('express');
const masterController = require('../controllers/master.controller');

const router = express.Router();

router.get('/institusi', masterController.getInstitusi);
router.get('/fakultas', masterController.getFakultas);
router.get('/prodi', masterController.getProdi);

module.exports = router;
