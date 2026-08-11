// Global error handling middleware and async wrapper
// Provides a centralized error handler that formats error responses consistently.
// Exports an asyncHandler wrapper to eliminate repetitive try/catch blocks.

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  console.error(`[Error] ${req.method} ${req.path} (${statusCode}):`, err.message, err.type || err.detail || err.code || '');
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    code: err?.code,
    detail: err?.detail || err.type,
  });
};

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
