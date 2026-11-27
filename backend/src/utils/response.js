'use strict';

const success = (res, data = null, message = 'Request successful', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

const error = (res, message = 'Request failed', statusCode = 500, data = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    data
  });
};

const validationError = (res, errors) => {
  return res.status(422).json({
    success: false,
    message: 'Validation failed',
    errors
  });
};

module.exports = { success, error, validationError };
