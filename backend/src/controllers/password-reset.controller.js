'use strict';

const passwordResetService = require('../services/password-reset.service');
const { success } = require('../utils/response');

const requestReset = async (req, res, next) => {
  try {
    const result = await passwordResetService.requestPasswordReset(req.body?.email);
    return success(res, null, result.message);
  } catch (err) {
    next(err);
  }
};

const reset = async (req, res, next) => {
  try {
    const result = await passwordResetService.resetPassword({
      token: req.body?.token,
      password: req.body?.password,
    });
    return success(res, null, result.message);
  } catch (err) {
    next(err);
  }
};

module.exports = { requestReset, reset };
