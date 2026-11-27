'use strict';
const crypto = require('crypto');
const path = require('path');

/**
 * Generate a safe stored filename based on a UUID + original extension.
 */
const generateStoredFilename = (originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  return `${crypto.randomUUID()}${ext}`;
};

/**
 * Sanitize a filename for use in a Content-Disposition header.
 * Strips CR, LF, and double-quote characters to prevent header injection.
 */
const sanitizeFilename = (name) => {
  if (!name || typeof name !== 'string') return 'download';
  // Remove CR, LF, and double-quotes (header injection vectors)
  return name.replace(/[\r\n"]/g, '_');
};

module.exports = { generateStoredFilename, sanitizeFilename };
