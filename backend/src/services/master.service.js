
'use strict';

const masterModel = require('../models/master.model');

const getInstitusi = async () => {
  return masterModel.getInstitusi();
};

const getFakultas = async () => {
  return masterModel.getFakultas();
};

const getProdi = async () => {
  return masterModel.getProdi();
};

module.exports = {
  getInstitusi,
  getFakultas,
  getProdi,
};
