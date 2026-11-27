'use strict';
const applicationService = require('../services/application.service');
const { success, validationError } = require('../utils/response');
const { validateCreate, validateUpdate } = require('../validators/application.validator');

const list = async (req, res, next) => {
  try {
    const apps = await applicationService.list(req.user.id, req.user.roles);
    return success(res, apps, 'Applications retrieved');
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const app = await applicationService.getById(req.params.id, req.user.id, req.user.roles);
    return success(res, app, 'Application retrieved');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const errors = validateCreate(req.body);
    if (errors) return validationError(res, errors);

    const body = { ...req.body };

    const app = await applicationService.create(body, req.files || [], req.applicationUploadDir, req.user.id);
    return success(res, app, 'Application created', 201);
  } catch (err) {
    if (err.statusCode === 422 && err.errors) return validationError(res, err.errors);
    next(err);
  }
};

const createEthics = async (req, res, next) => {
  try {
    const app = await applicationService.createEthicsApplication(req.params.id, req.user.id);
    return success(res, app, 'Ethics application created from research application', 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const errors = validateUpdate(req.body);
    if (errors) return validationError(res, errors);

    const app = await applicationService.update(req.params.id, req.body, req.user.id);
    return success(res, app, 'Application updated');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await applicationService.remove(req.params.id, req.user.id);
    return success(res, null, 'Application deleted');
  } catch (err) {
    next(err);
  }
};

const submit = async (req, res, next) => {
  try {
    const app = await applicationService.submit(req.params.id, req.user.id);
    return success(res, app, 'Application submitted');
  } catch (err) {
    if (err.statusCode === 422 && err.errors) return validationError(res, err.errors);
    next(err);
  }
};

const revise = async (req, res, next) => {
  try {
    const app = await applicationService.revise(req.params.id, req.body, req.user.id);
    return success(res, app, 'Application resubmitted after revision');
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, createEthics, update, remove, submit, revise };