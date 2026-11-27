'use strict';

const { error } = require('../utils/response');

const authenticateTransmedik = (req, res, next) => {
  const configuredKey = process.env.TRANSMEDIK_INTEGRATION_API_KEY;
  const suppliedKey = req.get('x-api-key');
  if (!configuredKey || !suppliedKey || suppliedKey !== configuredKey) {
    return error(res, 'Integration authentication failed', 401);
  }
  next();
};

module.exports = { authenticateTransmedik };
