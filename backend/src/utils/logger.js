/**
 * Logger Utility
 *
 * Purpose: Structured logging for Cloudflare Workers.
 *
 * Log Levels:
 * - error: Errors that need immediate attention
 * - warn: Warnings that should be investigated
 * - info: General informational messages
 * - debug: Detailed debugging information
 *
 * Log Format:
 * {
 *   level: 'error' | 'warn' | 'info' | 'debug',
 *   message: string,
 *   timestamp: ISO 8601 string,
 *   context: {
 *     companyId?: string,
 *     userId?: string,
 *     requestId?: string,
 *     ...other context
 *   }
 * }
 *
 * BEFORE MODIFYING:
 * - Will this change affect log aggregation/parsing?
 * - Do we need to redact sensitive data?
 * - Should this integrate with external logging service?
 *
 * Used by:
 * - All backend services and endpoints
 * - Middleware
 * - Error handlers
 */

class Logger {
  constructor(context = {}) {
    this.context = context;
  }

  /**
   * Add context to logger
   */
  withContext(additionalContext) {
    return new Logger({ ...this.context, ...additionalContext });
  }

  /**
   * Log error
   */
  error(message, error = null, additionalContext = {}) {
    const log = {
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      context: { ...this.context, ...additionalContext },
    };

    if (error) {
      log.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    console.error(JSON.stringify(log));
  }

  /**
   * Log warning
   */
  warn(message, additionalContext = {}) {
    const log = {
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      context: { ...this.context, ...additionalContext },
    };

    console.warn(JSON.stringify(log));
  }

  /**
   * Log info
   */
  info(message, additionalContext = {}) {
    const log = {
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      context: { ...this.context, ...additionalContext },
    };

    console.log(JSON.stringify(log));
  }

  /**
   * Log debug
   */
  debug(message, additionalContext = {}) {
    const log = {
      level: 'debug',
      message,
      timestamp: new Date().toISOString(),
      context: { ...this.context, ...additionalContext },
    };

    console.log(JSON.stringify(log));
  }
}

// Export default logger instance
export const logger = new Logger();

// Export Logger class for creating contextual loggers
export { Logger };
