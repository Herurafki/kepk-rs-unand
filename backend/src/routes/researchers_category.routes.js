// routes/researcher-category.route.js

const express = require('express');

const controller =
  require('../controllers/researchers_category.controller');

const router = express.Router();

router.get(
  '/',
  controller.getAll
);

module.exports = router;