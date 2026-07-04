// Global error handling middleware and async wrapper
// Provides a centralized error handler that formats error responses consistently.
// Exports an asyncHandler wrapper to eliminate repetitive try/catch blocks.

export const errorHandler = (err, req, res, next) => {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err?.code,
    detail: err?.detail,
  });
};

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
