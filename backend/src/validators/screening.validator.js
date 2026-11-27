'use strict';

const VALID_SCREENING_TYPES = ['RESEARCH', 'ETHICS'];

const validate = (data = {}, screeningType) => {
  const errors = {};

  if (!VALID_SCREENING_TYPES.includes(screeningType)) {
    errors.screening_type = `Screening type must be one of: ${VALID_SCREENING_TYPES.join(', ')}`;
    return errors;
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.answers = 'Answers must be an object';
  }

  if (Object.keys(errors).length > 0) return errors;
  return null;
};

module.exports = {
  VALID_SCREENING_TYPES,
  validate,
};
