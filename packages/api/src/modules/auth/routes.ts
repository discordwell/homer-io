import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { registerSchema, loginSchema, refreshTokenSchema, requestPasswordResetSchema, resetPasswordSchema, verifyEmailSchema } from '@homer-io/shared';
import { register, login, refreshToken, getMe, logout, verifyEmail, resendVerification, requestPasswordReset, resetPassword } from './service.js';
import { authenticate } from '../../plugins/auth.js';
import { z } from 'zod';

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const result = await register(app, body);
    reply.code(201).send(result);
  });

  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await login(app, body);
    reply.send(result);
  });

  app.post('/refresh', async (request, reply) => {
    const body = refreshTokenSchema.parse(request.body);
    const result = await refreshToken(app, body.refreshToken);
    reply.send(result);
  });

  app.post('/verify-email', async (request, reply) => {
    const body = verifyEmailSchema.parse(request.body);
    const result = await verifyEmail(body.token);
    reply.send(result);
  });

  // Tighter rate limit on email-sending endpoints (3/min) to prevent abuse
  await app.register(async (emailScope) => {
    await emailScope.register(rateLimit, { max: 3, timeWindow: '1 minute' });

    emailScope.post('/resend-verification', async (request, reply) => {
      const { email } = z.object({ email: z.string().email() }).parse(request.body);
      const result = await resendVerification(email);
      reply.send(result);
    });

    emailScope.post('/forgot-password', async (request, reply) => {
      const body = requestPasswordResetSchema.parse(request.body);
      await requestPasswordReset(app, body.email);
      reply.send({ success: true });
    });
  });

  app.post('/reset-password', async (request, reply) => {
    const body = resetPasswordSchema.parse(request.body);
    await resetPassword(app, body.token, body.newPassword);
    reply.send({ success: true });
  });

  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const result = await getMe(request.user.id);
    reply.send(result);
  });

  app.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    await logout(request.user.id);
    reply.send({ success: true });
  });
}
