'use strict';
const screeningService = require('../services/screening.service');
const { success, validationError } = require('../utils/response');

const get = async (req, res, next) => {
  try {
    const screening = await screeningService.getByApplicationId(
      req.params.id,
      req.user.id,
      req.user.roles
    );
    return success(res, screening, 'Application screening retrieved');
  } catch (err) {
    next(err);
  }
};

const save = async (req, res, next) => {
  try {
    const screening = await screeningService.save(
      req.params.id,
      req.body,
      req.user.id
    );
    return success(res, screening, 'Application screening saved');
  } catch (err) {
    if (err.statusCode === 422 && err.errors) {
      return validationError(res, err.errors);
    }
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await screeningService.remove(req.params.id, req.user.id);
    return success(res, null, 'Application screening deleted');
  } catch (err) {
    next(err);
  }
};

module.exports = { get, save, remove };
