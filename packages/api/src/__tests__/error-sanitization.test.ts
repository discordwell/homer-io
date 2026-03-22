import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { HttpError } from '../lib/errors.js';

describe('Error response sanitization', () => {
  // Simulate the error handler logic from server.ts
  function classifyError(error: unknown): { statusCode: number; error: string; message: string } {
    if (error instanceof ZodError) {
      return {
        statusCode: 400,
        error: 'Validation Error',
        message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
      };
    }
    if (error instanceof HttpError) {
      return {
        statusCode: error.statusCode,
        error: error.constructor.name,
        message: error.message,
      };
    }
    const err = error as any;
    if ('statusCode' in err && typeof err.statusCode === 'number' && err.statusCode < 500) {
      return {
        statusCode: err.statusCode,
        error: err.name === 'FastifyError' ? 'Bad Request' : (err.name || 'Error'),
        message: err.message,
      };
    }
    return {
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An internal error occurred. Please try again later.',
    };
  }

  it('ZodError returns 400 with field info but no schema internals', () => {
    const zodErr = new ZodError([
      { code: 'invalid_string', validation: 'email', message: 'Invalid email', path: ['email'], fatal: false },
    ]);
    const result = classifyError(zodErr);
    expect(result.statusCode).toBe(400);
    expect(result.error).toBe('Validation Error');
    expect(result.message).toBe('email: Invalid email');
    expect(result.message).not.toContain('invalid_string');
    expect(result.message).not.toContain('code');
  });

  it('HttpError preserves status code and message', () => {
    const result = classifyError(new HttpError(409, 'Email already registered'));
    expect(result.statusCode).toBe(409);
    expect(result.message).toBe('Email already registered');
  });

  it('Fastify 4xx error strips FastifyError name', () => {
    const fstErr = Object.assign(new Error('Body cannot be empty'), {
      statusCode: 400,
      name: 'FastifyError',
      code: 'FST_ERR_CTP_EMPTY_JSON_BODY',
    });
    const result = classifyError(fstErr);
    expect(result.statusCode).toBe(400);
    expect(result.error).toBe('Bad Request');
    expect(result.message).not.toContain('FST_ERR');
  });

  it('Unknown error returns generic 500 with no internals', () => {
    const result = classifyError(new Error('SELECT * FROM users WHERE id = $1'));
    expect(result.statusCode).toBe(500);
    expect(result.error).toBe('Internal Server Error');
    expect(result.message).toBe('An internal error occurred. Please try again later.');
    expect(result.message).not.toContain('SELECT');
  });

  it('DB constraint violation returns generic 500', () => {
    const result = classifyError(new Error('insert violates unique constraint "users_email_key"'));
    expect(result.statusCode).toBe(500);
    expect(result.message).not.toContain('violates');
    expect(result.message).not.toContain('users_email_key');
  });

  it('@fastify/sensible errors pass through cleanly', () => {
    const sensibleErr = Object.assign(new Error('Not Found'), {
      statusCode: 404,
      name: 'NotFoundError',
    });
    const result = classifyError(sensibleErr);
    expect(result.statusCode).toBe(404);
    expect(result.error).toBe('NotFoundError');
    expect(result.message).toBe('Not Found');
  });
});
