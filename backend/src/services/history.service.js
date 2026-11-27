'use strict';
const applicationModel = require('../models/application.model');
const historyModel = require('../models/history.model');
const revisionModel = require('../models/revision.model');

const isPrivileged = (roles) => roles.some(r => ['DIKLIT', 'SEKRETARIAT', 'KETUA', 'SUPERADMIN'].includes(r));

const assertResearcherOwnership = (app, userId, roles) => {
  if (roles.includes('PENELITI') && !isPrivileged(roles)) {
    if (String(app.researcher_user_id) !== String(userId)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }
  }
};

const getHistory = async (applicationId, userId, roles) => {
  const app = await applicationModel.findById(applicationId);
  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }

  assertResearcherOwnership(app, userId, roles);
  return historyModel.findByApplicationId(applicationId);
};

const getRevisions = async (applicationId, userId, roles) => {
  const app = await applicationModel.findById(applicationId);
  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }

  assertResearcherOwnership(app, userId, roles);
  return revisionModel.findByApplicationId(applicationId);
};

module.exports = { getHistory, getRevisions };
