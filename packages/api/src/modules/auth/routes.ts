import { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema, refreshTokenSchema } from '@homer-io/shared';
import { register, login, refreshToken, getMe } from './service.js';
import { authenticate } from '../../plugins/auth.js';

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

  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const result = await getMe(request.user.id);
    reply.send(result);
  });
}
