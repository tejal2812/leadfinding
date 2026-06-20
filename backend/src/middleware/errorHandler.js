const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, path: req.path, method: req.method });

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message, details: err.errors });
  }
  if (err.code === '23505') { // Postgres unique violation
    return res.status(409).json({ error: 'Resource already exists' });
  }
  if (err.code === '23503') { // Postgres foreign key violation
    return res.status(400).json({ error: 'Referenced resource not found' });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
};

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { errorHandler, asyncHandler };
