import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError, logError } from '../services/errorLogger';

/**
 * Async handler wrapper to catch errors in async route handlers
 * Wraps async functions and forwards errors to the error handler middleware
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Format error message for client response
 * Returns only safe information that doesn't expose internal details
 */
const formatClientError = (statusCode: number, message: string, errorId: string) => {
  // In production, show generic messages for server errors
  const isProduction = process.env.NODE_ENV === 'production';
  const isServerError = statusCode >= 500;

  return {
    error: {
      message: isProduction && isServerError
        ? 'An internal error occurred. Please try again later.'
        : message,
      code: statusCode,
      errorId // Include errorId so users can reference it when reporting issues
    }
  };
};

/**
 * Handle Mongoose validation errors
 */
const handleMongooseValidationError = (err: mongoose.Error.ValidationError) => {
  const messages = Object.values(err.errors).map((e) => e.message);
  return new AppError({
    message: `Validation failed: ${messages.join(', ')}`,
    code: 'VALIDATION_ERROR',
    severity: 'low',
    category: 'validation',
    statusCode: 400,
    isOperational: true,
    metadata: { fields: Object.keys(err.errors) }
  });
};

/**
 * Handle Mongoose CastError (invalid ObjectId, etc.)
 */
const handleMongooseCastError = (err: mongoose.Error.CastError) => {
  return new AppError({
    message: `Invalid ${err.path}: ${err.value}`,
    code: 'CAST_ERROR',
    severity: 'low',
    category: 'validation',
    statusCode: 400,
    isOperational: true,
    metadata: { path: err.path, value: err.value, kind: err.kind }
  });
};

/**
 * Handle MongoDB duplicate key error
 */
const handleDuplicateKeyError = (err: any) => {
  const field = Object.keys(err.keyValue || {})[0];
  return new AppError({
    message: `Duplicate value for field: ${field}`,
    code: 'DUPLICATE_KEY',
    severity: 'low',
    category: 'validation',
    statusCode: 409,
    isOperational: true,
    metadata: { field, value: err.keyValue?.[field] }
  });
};

/**
 * Handle JWT errors
 */
const handleJWTError = (err: Error) => {
  return new AppError({
    message: 'Invalid or expired authentication token',
    code: 'AUTH_TOKEN_ERROR',
    severity: 'medium',
    category: 'authentication',
    statusCode: 401,
    isOperational: true
  });
};

/**
 * Handle multer file upload errors
 */
const handleMulterError = (err: any) => {
  let message = 'File upload error';

  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      message = 'File size exceeds the allowed limit';
      break;
    case 'LIMIT_FILE_COUNT':
      message = 'Too many files uploaded';
      break;
    case 'LIMIT_UNEXPECTED_FILE':
      message = 'Unexpected file field';
      break;
    default:
      message = err.message || 'File upload error';
  }

  return new AppError({
    message,
    code: 'FILE_UPLOAD_ERROR',
    severity: 'low',
    category: 'file_operation',
    statusCode: 400,
    isOperational: true,
    metadata: { multerCode: err.code }
  });
};

/**
 * Global error handler middleware
 */
export const globalErrorHandler = async (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Log the error first
  const errorId = await logError(err, req);

  // Default error properties
  let error: AppError;

  // Transform known error types
  if (err instanceof AppError) {
    error = err;
  } else if (err.name === 'ValidationError' && err instanceof mongoose.Error.ValidationError) {
    error = handleMongooseValidationError(err);
  } else if (err.name === 'CastError' && err instanceof mongoose.Error.CastError) {
    error = handleMongooseCastError(err);
  } else if ((err as any).code === 11000) {
    error = handleDuplicateKeyError(err);
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    error = handleJWTError(err);
  } else if (err.name === 'MulterError') {
    error = handleMulterError(err);
  } else if ((err as any).type === 'entity.parse.failed') {
    error = new AppError({
      message: 'Invalid JSON in request body',
      code: 'PARSE_ERROR',
      severity: 'low',
      category: 'validation',
      statusCode: 400,
      isOperational: true
    });
  } else {
    // Unknown error - wrap it
    error = new AppError({
      message: err.message || 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      severity: 'high',
      category: 'internal',
      statusCode: 500,
      isOperational: false,
      metadata: { originalName: err.name }
    });
  }

  // Format response for client
  const clientResponse = formatClientError(error.statusCode, error.message, errorId);

  // Send response
  res.status(error.statusCode).json(clientResponse);
};

/**
 * Handle 404 errors for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError({
    message: `Cannot ${req.method} ${req.path}`,
    code: 'NOT_FOUND',
    severity: 'low',
    category: 'validation',
    statusCode: 404,
    isOperational: true
  });
  next(error);
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = async (err: Error) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...');
  await logError(err, undefined, { type: 'uncaughtException' });
  process.exit(1);
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = async (reason: Error, promise: Promise<any>) => {
  console.error('UNHANDLED REJECTION! Logging and continuing...');
  await logError(reason, undefined, { type: 'unhandledRejection' });
  // Don't exit for unhandled rejections, just log them
};

/**
 * Setup process-level error handlers
 */
export const setupProcessErrorHandlers = () => {
  process.on('uncaughtException', handleUncaughtException);
  process.on('unhandledRejection', handleUnhandledRejection);
};

export default {
  asyncHandler,
  globalErrorHandler,
  notFoundHandler,
  setupProcessErrorHandlers
};
