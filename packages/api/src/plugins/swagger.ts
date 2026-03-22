import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { FastifyInstance } from 'fastify';

export async function registerSwagger(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'HOMER.io API',
        version: '1.0.0',
        description: 'AI-powered last-mile delivery platform serving 8 industry verticals (cannabis, florist, pharmacy, restaurant, grocery, furniture, courier). Features route optimization, real-time fleet tracking, proof of delivery, industry-specific compliance, and 9 POS/integration connectors.',
      },
      servers: [{ url: '/api' }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/api/docs',
  });
}
