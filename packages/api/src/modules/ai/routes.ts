import { FastifyInstance } from 'fastify';
import { aiChatRequestSchema } from '@homer-io/shared';
import { authenticate } from '../../plugins/auth.js';
import { handleAiChat } from './service.js';

export async function aiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.post('/chat', async (request) => {
    const { message, history } = aiChatRequestSchema.parse(request.body);
    const reply = await handleAiChat(request.user.tenantId, message, history);
    return { reply };
  });
}
