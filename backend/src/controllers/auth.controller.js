'use strict';

const authService = require('../services/auth.service');
const {
  success,
  validationError,
} = require('../utils/response');
const {
  validateRegister,
  validateLogin,
} = require('../validators/auth.validator');

const cookieSecure = process.env.COOKIE_SECURE === 'true';
const cookieSameSite =
  process.env.COOKIE_SAMESITE || 'lax';

const accessCookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

const changePassword = async (req, res, next) => {
  try {
    const result = await authService.changePassword({
      userId: req.user.id,
      currentPassword: req.body?.current_password,
      newPassword: req.body?.new_password,
    });
    res.clearCookie('penma_access_token', accessCookieOptions);
    res.clearCookie('penma_refresh_token', refreshCookieOptions);
    return success(res, null, result.message);
  } catch (err) {
    next(err);
  }
};

const register = async (req, res, next) => {
  try {
    const errors =
      validateRegister(req.body);

    if (errors) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        data: errors,
      });
    }

    const result =
      await authService.register(req.body);

    return res.status(201).json({
      success: true,
      data: {
        user: result,
      },
    });

  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => { try { const result = await authService.verifyEmail(req.query?.token); return success(res, result, result.message); } catch (err) { next(err); } };
const resendVerification = async (req, res, next) => { try { const result = await authService.resendVerification(req.body?.email); return success(res, result, result.message); } catch (err) { next(err); } };

const login = async (req, res, next) => {
  try {
    const errors = validateLogin(req.body);

    if (errors) {
      return validationError(res, errors);
    }

    const { email, password, nik } = req.body;

    const result = await authService.login({
      email,
      nik,
      password,
    });

    res.cookie(
      'penma_access_token',
      result.access_token,
      accessCookieOptions
    );

    res.cookie(
      'penma_refresh_token',
      result.refresh_token,
      refreshCookieOptions
    );

    return success(
      res,
      {
        user: result.user,
      },
      'Login successful'
    );
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const refreshToken =
      req.cookies?.penma_refresh_token;

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    res.clearCookie(
      'penma_access_token',
      accessCookieOptions
    );

    res.clearCookie(
      'penma_refresh_token',
      refreshCookieOptions
    );

    return success(
      res,
      null,
      'Logout successful'
    );
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const refreshToken =
      req.cookies?.penma_refresh_token;

    const result =
      await authService.refresh(refreshToken);

    res.cookie(
      'penma_access_token',
      result.access_token,
      accessCookieOptions
    );

    return success(
      res,
      null,
      'Token refreshed'
    );
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    const profile =
      await authService.getProfile(req.user.id);

    return success(
      res,
      {
        user: profile,
      },
      'Profile retrieved'
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  changePassword,
  login,
  logout,
  refresh,
  me,
};