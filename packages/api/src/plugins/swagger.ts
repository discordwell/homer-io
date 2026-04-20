import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

// `any` on the app parameter — swagger registration doesn't depend on the
// logger's concrete type, and the default FastifyInstance generic fails to
// unify with the Pino Logger instance we inject via `loggerInstance`.
// Typed properly downstream since we only invoke app.register(...).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function registerSwagger(app: any) {
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
