import pino, { type Logger } from 'pino';
import { config } from '../config.js';

/**
 * Shared Pino logger for module-level (non-Fastify-instance) use.
 *
 * Fastify's `app.log` is only available inside request handlers and plugins.
 * Service modules, queue handlers, and other code that runs outside the
 * request lifecycle should import `logger` from here so that structured
 * logging, level filtering, and secret redaction apply consistently.
 *
 * The Fastify app reuses this same instance (see server.ts) so there is a
 * single logger tree.
 *
 * Pino call shape: `logger.error({ err, tenantId }, 'message')`.
 */
export const logger: Logger = pino({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  transport:
    config.nodeEnv !== 'production' && config.nodeEnv !== 'test'
      ? {
          target: 'pino-pretty',
          options: { colorize: true },
        }
      : undefined,
  redact: {
    // Redact common secret-bearing fields anywhere in the object tree.
    // Pino's redact uses fast-redact paths — wildcards must match on a
    // specific segment position.
    paths: [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'apiKey',
      'api_key',
      'authorization',
      'Authorization',
      'cookie',
      'Cookie',
      'secret',
      'webhookSecret',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.apiKey',
      '*.api_key',
      '*.authorization',
      '*.Authorization',
      '*.cookie',
      '*.Cookie',
      '*.secret',
      '*.webhookSecret',
      'req.headers.authorization',
      'req.headers.cookie',
      'request.headers.authorization',
      'request.headers.cookie',
      'headers.authorization',
      'headers.cookie',
    ],
    censor: '[REDACTED]',
  },
});
