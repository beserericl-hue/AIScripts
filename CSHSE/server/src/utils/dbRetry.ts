import mongoose from 'mongoose';

/**
 * Database Retry Utility
 *
 * Provides retry logic with exponential backoff for MongoDB operations
 * to handle transient errors like quota limits, network issues, etc.
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 5,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2
};

/**
 * Check if an error is retryable
 * MongoDB errors that indicate transient issues
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;

  // MongoDB error codes that are retryable
  const retryableCodes = [
    89,    // NetworkTimeout
    91,    // ShutdownInProgress
    189,   // PrimarySteppedDown
    11600, // InterruptedAtShutdown
    11602, // InterruptedDueToReplStateChange
    13435, // NotPrimaryNoSecondaryOk
    13436, // NotPrimaryOrSecondary
    10107, // NotWritablePrimary
    // Quota-related
    11000, // DuplicateKey (sometimes transient in race conditions)
  ];

  // Check for specific error codes
  if (error.code && retryableCodes.includes(error.code)) {
    return true;
  }

  // Check error message patterns
  const errorMessage = error.message?.toLowerCase() || '';
  const retryablePatterns = [
    'max_write_operations_per_minute',
    'quota exceeded',
    'rate limit',
    'too many requests',
    'connection reset',
    'econnreset',
    'etimedout',
    'network error',
    'socket hang up',
    'topology was destroyed',
    'buffermaxentriessizebytes',
    'server selection timeout'
  ];

  return retryablePatterns.some(pattern => errorMessage.includes(pattern));
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a database operation with retry logic
 *
 * @param operation - Async function to execute
 * @param options - Retry configuration
 * @returns Result of the operation
 * @throws Last error if all retries exhausted
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Check if we should retry
      if (attempt > opts.maxRetries || !isRetryableError(error)) {
        console.error(`[DbRetry] Operation failed after ${attempt} attempts:`, {
          error: error.message,
          code: error.code,
          retryable: isRetryableError(error)
        });
        throw error;
      }

      // Log retry attempt
      console.warn(`[DbRetry] Attempt ${attempt} failed, retrying in ${delay}ms...`, {
        error: error.message?.substring(0, 100),
        code: error.code,
        nextAttempt: attempt + 1,
        maxRetries: opts.maxRetries + 1
      });

      // Wait before retry
      await sleep(delay);

      // Exponential backoff with jitter
      const jitter = Math.random() * 0.3; // 0-30% jitter
      delay = Math.min(delay * opts.backoffMultiplier * (1 + jitter), opts.maxDelayMs);
    }
  }

  // Should not reach here, but just in case
  throw lastError || new Error('Retry operation failed');
}

/**
 * Save a Mongoose document with retry logic
 */
export async function saveWithRetry<T extends mongoose.Document>(
  doc: T,
  options: RetryOptions = {}
): Promise<T> {
  return withRetry(() => doc.save() as Promise<T>, options);
}

/**
 * Execute multiple saves with retry logic, batching if needed
 * Useful when saving many documents to avoid quota issues
 */
export async function batchSaveWithRetry<T extends mongoose.Document>(
  documents: T[],
  options: RetryOptions & { batchSize?: number; delayBetweenBatches?: number } = {}
): Promise<T[]> {
  const { batchSize = 10, delayBetweenBatches = 100, ...retryOpts } = options;
  const results: T[] = [];

  // Process in batches
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);

    // Save batch with retry
    const batchResults = await withRetry(
      () => Promise.all(batch.map(doc => doc.save() as Promise<T>)),
      retryOpts
    );

    results.push(...batchResults);

    // Delay between batches to avoid rate limiting
    if (i + batchSize < documents.length) {
      await sleep(delayBetweenBatches);
    }
  }

  return results;
}

/**
 * Decorator-style wrapper for controller methods
 * Wraps the entire handler with retry logic for any DB operations within
 */
export function withDbRetry(options: RetryOptions = {}) {
  return function <T extends (...args: any[]) => Promise<any>>(fn: T): T {
    return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      return withRetry(() => fn(...args), options);
    }) as T;
  };
}

export { isRetryableError, sleep };
