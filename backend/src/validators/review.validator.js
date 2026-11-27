'use strict';

const VALID_RECOMMENDATIONS = ['APPROVE', 'REVISION', 'REJECT'];

const validateReview = (body) => {
  const errors = {};
  const { recommendation, assessment, document_revisions } = body || {};

  if (!recommendation || String(recommendation).trim().length === 0) {
    errors.recommendation = 'Recommendation is required';
  } else if (!VALID_RECOMMENDATIONS.includes(recommendation)) {
    errors.recommendation = `Recommendation must be one of: ${VALID_RECOMMENDATIONS.join(', ')}`;
  }

  if (recommendation === 'REVISION') {
    if (!Array.isArray(document_revisions) || document_revisions.length === 0) errors.document_revisions = 'Pilih minimal satu dokumen untuk direvisi';
    else document_revisions.forEach((item, index) => {
      if (!item || !/^\d+$/.test(String(item.document_id || ''))) errors['document_revisions.' + index + '.document_id'] = 'Dokumen tidak valid';
      if (!String((item && item.note) || '').trim()) errors['document_revisions.' + index + '.note'] = 'Catatan revisi wajib diisi';
    });
  }

  // Assessment remains optional for older clients; if provided, the service
  // performs strict validation for all 26 boolean indicator answers.
  if (assessment !== undefined && (!assessment || typeof assessment !== 'object' || Array.isArray(assessment))) {
    errors.assessment = 'Assessment must be an object';
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

module.exports = { validateReview };
