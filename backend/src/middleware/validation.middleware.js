'use strict';
const { validationError } = require('../utils/response');

/**
 * Returns an Express middleware that validates req.body using the provided validator function.
 * The validator function receives the body and returns an errors object or null.
 */
const validate = (validatorFn) => {
  return (req, res, next) => {
    const errors = validatorFn(req.body);
    if (errors) {
      return validationError(res, errors);
    }
    next();
  };
};

module.exports = { validate };
