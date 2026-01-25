import { Request } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { ErrorLog, ErrorSeverity, ErrorCategory, IRequestContext, IUserContext } from '../models/ErrorLog';

/**
 * Application Error class for consistent error handling
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly metadata?: Record<string, any>;

  constructor(options: {
    message: string;
    code?: string;
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    statusCode?: number;
    isOperational?: boolean;
    metadata?: Record<string, any>;
  }) {
    super(options.message);
    this.name = 'AppError';
    this.code = options.code || 'INTERNAL_ERROR';
    this.severity = options.severity || 'medium';
    this.category = options.category || 'internal';
    this.statusCode = options.statusCode || 500;
    this.isOperational = options.isOperational ?? true;
    this.metadata = options.metadata;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Create specific error types for common scenarios
 */
export class ValidationError extends AppError {
  constructor(message: string, metadata?: Record<string, any>) {
    super({
      message,
      code: 'VALIDATION_ERROR',
      severity: 'low',
      category: 'validation',
      statusCode: 400,
      isOperational: true,
      metadata
    });
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super({
      message,
      code: 'AUTHENTICATION_ERROR',
      severity: 'medium',
      category: 'authentication',
      statusCode: 401,
      isOperational: true
    });
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super({
      message,
      code: 'AUTHORIZATION_ERROR',
      severity: 'medium',
      category: 'authorization',
      statusCode: 403,
      isOperational: true
    });
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super({
      message: `${resource} not found`,
      code: 'NOT_FOUND',
      severity: 'low',
      category: 'validation',
      statusCode: 404,
      isOperational: true
    });
    this.name = 'NotFoundError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, metadata?: Record<string, any>) {
    super({
      message,
      code: 'DATABASE_ERROR',
      severity: 'high',
      category: 'database',
      statusCode: 500,
      isOperational: false,
      metadata
    });
    this.name = 'DatabaseError';
  }
}

export class FileOperationError extends AppError {
  constructor(message: string, metadata?: Record<string, any>) {
    super({
      message,
      code: 'FILE_OPERATION_ERROR',
      severity: 'high',
      category: 'file_operation',
      statusCode: 500,
      isOperational: true,
      metadata
    });
    this.name = 'FileOperationError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, metadata?: Record<string, any>) {
    super({
      message: `External service error (${service}): ${message}`,
      code: 'EXTERNAL_SERVICE_ERROR',
      severity: 'high',
      category: 'external_service',
      statusCode: 502,
      isOperational: true,
      metadata: { service, ...metadata }
    });
    this.name = 'ExternalServiceError';
  }
}

/**
 * Error Logger Service
 */
class ErrorLoggerService {
  private static instance: ErrorLoggerService;

  private constructor() {}

  public static getInstance(): ErrorLoggerService {
    if (!ErrorLoggerService.instance) {
      ErrorLoggerService.instance = new ErrorLoggerService();
    }
    return ErrorLoggerService.instance;
  }

  /**
   * Generate a fingerprint for grouping similar errors
   */
  private generateFingerprint(error: Error, category: ErrorCategory): string {
    const signature = `${error.name}:${category}:${error.message.substring(0, 100)}`;
    return crypto.createHash('md5').update(signature).digest('hex');
  }

  /**
   * Extract request context for logging
   */
  private extractRequestContext(req: Request): IRequestContext {
    // Sanitize sensitive data from headers
    const sanitizedHeaders: Record<string, any> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

    if (req.headers) {
      Object.keys(req.headers).forEach((key) => {
        if (sensitiveHeaders.includes(key.toLowerCase())) {
          sanitizedHeaders[key] = '[REDACTED]';
        } else {
          sanitizedHeaders[key] = req.headers[key];
        }
      });
    }

    // Sanitize sensitive data from body
    const sanitizedBody = this.sanitizeObject(req.body);

    return {
      method: req.method,
      path: req.path,
      query: req.query,
      params: req.params,
      body: sanitizedBody,
      headers: sanitizedHeaders,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('User-Agent')
    };
  }

  /**
   * Sanitize object by removing sensitive fields
   */
  private sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'credential', 'authorization'];
    const sanitized: Record<string, any> = {};

    Object.keys(obj).forEach((key) => {
      if (sensitiveFields.some((f) => key.toLowerCase().includes(f))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitized[key] = this.sanitizeObject(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    });

    return sanitized;
  }

  /**
   * Extract user context from request
   */
  private extractUserContext(req: Request): IUserContext {
    const user = (req as any).user;
    return {
      userId: user?.id || user?._id,
      role: user?.role,
      institutionId: (req as any).institutionId || req.params?.institutionId,
      submissionId: req.params?.submissionId
    };
  }

  /**
   * Determine error category from error instance
   */
  private determineCategory(error: Error): ErrorCategory {
    if (error instanceof AppError) {
      return error.category;
    }

    // MongoDB/Mongoose errors
    if (error.name === 'MongoError' || error.name === 'MongoServerError' || error.name === 'MongooseError') {
      return 'database';
    }
    if (error.name === 'ValidationError' && (error as any).errors) {
      return 'validation';
    }
    if (error.name === 'CastError') {
      return 'validation';
    }

    // JWT errors
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return 'authentication';
    }

    // File system errors
    if ((error as any).code === 'ENOENT' || (error as any).code === 'EACCES') {
      return 'file_operation';
    }

    // Network errors
    if ((error as any).code === 'ECONNREFUSED' || (error as any).code === 'ETIMEDOUT') {
      return 'external_service';
    }

    return 'unknown';
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
    if (error instanceof AppError) {
      return error.severity;
    }

    switch (category) {
      case 'database':
        return 'high';
      case 'authentication':
      case 'authorization':
        return 'medium';
      case 'validation':
        return 'low';
      case 'file_operation':
        return 'high';
      case 'external_service':
        return 'high';
      case 'internal':
        return 'critical';
      default:
        return 'medium';
    }
  }

  /**
   * Log error to database and console
   */
  public async logError(
    error: Error,
    req?: Request,
    additionalMetadata?: Record<string, any>
  ): Promise<string> {
    const errorId = uuidv4();
    const category = this.determineCategory(error);
    const severity = this.determineSeverity(error, category);
    const fingerprint = this.generateFingerprint(error, category);

    // Log to console for immediate visibility
    console.error('='.repeat(80));
    console.error(`[ERROR] ${new Date().toISOString()}`);
    console.error(`Error ID: ${errorId}`);
    console.error(`Category: ${category} | Severity: ${severity}`);
    console.error(`Message: ${error.message}`);
    if (error.stack) {
      console.error(`Stack:\n${error.stack}`);
    }
    if (req) {
      console.error(`Request: ${req.method} ${req.path}`);
      console.error(`User ID: ${(req as any).user?.id || 'anonymous'}`);
    }
    console.error('='.repeat(80));

    try {
      // Check for existing error with same fingerprint
      const existingError = await ErrorLog.findOne({ fingerprint, isResolved: false });

      if (existingError) {
        // Update existing error occurrence
        existingError.occurrenceCount += 1;
        existingError.lastOccurrence = new Date();
        if (additionalMetadata) {
          existingError.metadata = { ...existingError.metadata, ...additionalMetadata };
        }
        await existingError.save();
        return existingError.errorId;
      }

      // Create new error log
      const errorLog = new ErrorLog({
        errorId,
        timestamp: new Date(),
        message: error.message,
        stack: error.stack,
        code: (error as AppError).code || error.name,
        name: error.name,
        severity,
        category,
        request: req ? this.extractRequestContext(req) : undefined,
        user: req ? this.extractUserContext(req) : undefined,
        metadata: {
          ...(error instanceof AppError ? error.metadata : {}),
          ...additionalMetadata
        },
        fingerprint,
        firstOccurrence: new Date(),
        lastOccurrence: new Date()
      });

      await errorLog.save();
      return errorId;
    } catch (logError) {
      // If we can't log to database, at least log to console
      console.error('Failed to log error to database:', logError);
      console.error('Original error:', error);
      return errorId;
    }
  }

  /**
   * Log a warning (non-error issue)
   */
  public async logWarning(
    message: string,
    req?: Request,
    metadata?: Record<string, any>
  ): Promise<void> {
    console.warn(`[WARNING] ${new Date().toISOString()} - ${message}`);

    try {
      const warningError = new AppError({
        message,
        severity: 'low',
        category: 'internal',
        statusCode: 200,
        isOperational: true,
        metadata
      });
      warningError.name = 'Warning';

      await this.logError(warningError, req, { isWarning: true, ...metadata });
    } catch (err) {
      console.error('Failed to log warning:', err);
    }
  }

  /**
   * Get recent errors for admin dashboard
   */
  public async getRecentErrors(options: {
    limit?: number;
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    resolved?: boolean;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<any[]> {
    const query: any = {};

    if (options.severity) query.severity = options.severity;
    if (options.category) query.category = options.category;
    if (options.resolved !== undefined) query.isResolved = options.resolved;

    if (options.startDate || options.endDate) {
      query.timestamp = {};
      if (options.startDate) query.timestamp.$gte = options.startDate;
      if (options.endDate) query.timestamp.$lte = options.endDate;
    }

    return ErrorLog.find(query)
      .sort({ timestamp: -1 })
      .limit(options.limit || 50)
      .lean();
  }

  /**
   * Get error statistics
   */
  public async getErrorStats(days: number = 7): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await ErrorLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: {
            category: '$category',
            severity: '$severity'
          },
          count: { $sum: '$occurrenceCount' },
          uniqueErrors: { $sum: 1 }
        }
      }
    ]);

    const byCategory = await ErrorLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$occurrenceCount' }
        }
      }
    ]);

    const bySeverity = await ErrorLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: '$severity',
          total: { $sum: '$occurrenceCount' }
        }
      }
    ]);

    return {
      detailed: stats,
      byCategory: byCategory.reduce((acc, item) => {
        acc[item._id] = item.total;
        return acc;
      }, {}),
      bySeverity: bySeverity.reduce((acc, item) => {
        acc[item._id] = item.total;
        return acc;
      }, {})
    };
  }

  /**
   * Mark error as resolved
   */
  public async resolveError(
    errorId: string,
    resolvedBy: string,
    resolution: string
  ): Promise<boolean> {
    const result = await ErrorLog.findOneAndUpdate(
      { errorId },
      {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy,
        resolution
      },
      { new: true }
    );
    return !!result;
  }
}

// Export singleton instance
export const errorLogger = ErrorLoggerService.getInstance();

// Export utility function for easy logging
export const logError = (
  error: Error,
  req?: Request,
  metadata?: Record<string, any>
): Promise<string> => errorLogger.logError(error, req, metadata);
