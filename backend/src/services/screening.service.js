'use strict';
const applicationModel = require('../models/application.model');
const screeningModel = require('../models/screening.model');
const recommendationService = require('./screening_recommendation.service');
const { validate, VALID_SCREENING_TYPES } = require('../validators/screening.validator');

const TYPE_TO_SCREENING = {
  IZIN_PENELITIAN: 'RESEARCH',
  IZIN_ETIK: 'ETHICS',
};

const assertApplication = async (applicationId) => {
  const app = await applicationModel.findById(applicationId);
  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }
  return app; 
};

const assertResearcherCanEdit = (app, userId) => {
  if (String(app.researcher_user_id) !== String(userId)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  if (!['DRAFT', 'REVISION_REQUIRED'].includes(app.status)) {
    const err = new Error('Screening can only be updated while application is DRAFT or REVISION_REQUIRED');
    err.statusCode = 400;
    throw err;
  }
};

const getByApplicationId = async (applicationId, userId, roles) => {
  const app = await assertApplication(applicationId);

  const privilegedRoles = ['DIKLAT', 'SEKRETARIS_KEPK', 'CHIEF_KEPK', 'REVIEWER', 'SUPERADMIN'];
  if (roles.includes('RESEARCHER') && !roles.some(role => privilegedRoles.includes(role))) {
    if (String(app.researcher_user_id) !== String(userId)) {
      const err = new Error('Application not found');
      err.statusCode = 404;
      throw err;
    }
  }

  return screeningModel.findByApplicationId(applicationId);
};

const save = async (applicationId, data, userId) => {
  const app = await assertApplication(applicationId);
  assertResearcherCanEdit(app, userId);

  const screeningType = TYPE_TO_SCREENING[app.application_type];
  if (!screeningType || !VALID_SCREENING_TYPES.includes(screeningType)) {
    const err = new Error(`Application type ${app.application_type} does not use screening`);
    err.statusCode = 400;
    throw err;
  }

  const answers = data.answers ?? data;
  const errors = validate(answers, screeningType);
  if (errors) {
    const err = new Error('Invalid screening data');
    err.statusCode = 422;
    err.errors = errors;
    throw err;
  }

  const recommendation = recommendationService.recommend(
    screeningType,
    answers
  );

  return screeningModel.upsert(applicationId, screeningType, answers, recommendation);
};

const remove = async (applicationId, userId) => {
  const app = await assertApplication(applicationId);
  assertResearcherCanEdit(app, userId);
  await screeningModel.remove(applicationId);
};

module.exports = {
  getByApplicationId,
  save,
  remove,
  TYPE_TO_SCREENING,
};
