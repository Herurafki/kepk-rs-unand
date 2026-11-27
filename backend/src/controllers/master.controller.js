
'use strict';

const masterService = require('../services/master.service');

const getInstitusi = async (req, res, next) => {
  try {
    const data = await masterService.getInstitusi();

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

const getFakultas = async (req, res, next) => {
  try {
    const data = await masterService.getFakultas();

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

const getProdi = async (req, res, next) => {
  try {
    const data = await masterService.getProdi();

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInstitusi,
  getFakultas,
  getProdi,
};
