'use strict';

const VALID_APPLICATION_TYPES = ['DATA_AWAL', 'IZIN_PENELITIAN', 'IZIN_ETIK'];
const VALID_GROUP_CATEGORIES = ['Mahasiswa', 'Dosen', 'Staff', 'Umum'];

const validateCreate = (body) => {
  const errors = {};
  const applicationType = body.application_type;
  const groupCategory = body.group_category;
  const { research_title } = body;

  if (!VALID_APPLICATION_TYPES.includes(applicationType)) {
    errors.application_type = `Application type must be one of: ${VALID_APPLICATION_TYPES.join(', ')}`;
  }

  if (!groupCategory) {
    errors.group_category = 'Group category is required';
  } else if (!VALID_GROUP_CATEGORIES.includes(groupCategory)) {
    errors.group_category = `Group category must be one of: ${VALID_GROUP_CATEGORIES.join(', ')}`;
  }

  if (!research_title || String(research_title).trim().length === 0) {
    errors.research_title = 'Research title is required';
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

const validateUpdate = (body) => {
  const errors = {};
  const groupCategory = body.group_category;

  if (body.group_category !== undefined && !VALID_GROUP_CATEGORIES.includes(groupCategory)) {
    errors.group_category = `Group category must be one of: ${VALID_GROUP_CATEGORIES.join(', ')}`;
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

const validateForSubmission = (application) => {
  const required = [
    'research_title', 'research_background', 'research_objectives',
    'research_methodology', 'research_location', 'research_institution',
    'research_duration', 'data_needed', 'purpose', 'group_category',
  ];
  const errors = {};
  for (const field of required) {
    if (!application[field] || String(application[field]).trim().length === 0) {
      errors[field] = `${field.replace(/_/g, ' ')} is required for submission`;
    }
  }
  return Object.keys(errors).length > 0 ? errors : null;
};

module.exports = {
  VALID_APPLICATION_TYPES,
  VALID_GROUP_CATEGORIES,
  validateCreate,
  validateUpdate,
  validateForSubmission,
};