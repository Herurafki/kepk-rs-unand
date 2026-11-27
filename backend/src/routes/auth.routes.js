'use strict';
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const passwordResetController = require('../controllers/password-reset.controller');

// POST /api/auth/forgot-password
router.post('/forgot-password', passwordResetController.requestReset);

// POST /api/auth/reset-password
router.post('/reset-password', passwordResetController.reset);

// POST /api/auth/change-password
router.post('/change-password', authenticate, authController.changePassword);

// POST /api/auth/register
router.post('/register', authController.register);

router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/logout
router.post('/logout', authController.logout);

// POST /api/auth/refresh
router.post('/refresh', authController.refresh);

// GET /api/auth/me
router.get('/me', authenticate, authController.me);

module.exports = router;
