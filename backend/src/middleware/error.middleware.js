'use strict';

/**
 * Centralized error handling middleware.
 */
const errorHandler = (err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Log server errors
  if (statusCode >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${err.message}`);
    if (!isProd) console.error(err.stack);
  }

  const response = {
    success: false,
    message,
    data: null,
  };

  if (err.errors) {
    response.errors = err.errors;
    delete response.data;
  }

  if (!isProd && statusCode >= 500 && err.stack) {
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
};

module.exports = { errorHandler };
