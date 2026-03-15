import { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { config } from '../../config.js';
import { handleWebhookEvent } from './service.js';

export async function billingWebhookPlugin(app: FastifyInstance) {
  if (!config.stripe.secretKey || !config.stripe.webhookSecret) {
    app.log.warn('[billing] Stripe keys not configured — webhook endpoint disabled');
    return;
  }

  const stripe = new Stripe(config.stripe.secretKey);

  // Register raw body content type parser for signature verification
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    },
  );

  app.post('/stripe/webhook', async (request, reply) => {
    const sig = request.headers['stripe-signature'];

    if (!sig) {
      return reply.code(400).send({ message: 'Missing stripe-signature header' });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        request.body as Buffer,
        sig,
        config.stripe.webhookSecret,
      );
    } catch (err) {
      app.log.error({ err }, '[billing] Webhook signature verification failed');
      return reply.code(400).send({ message: 'Webhook signature verification failed' });
    }

    try {
      await handleWebhookEvent(event);
      app.log.info(`[billing] Processed webhook event: ${event.type} (${event.id})`);
    } catch (err) {
      app.log.error({ err, eventType: event.type }, '[billing] Error processing webhook event');
      // Return 200 to avoid Stripe retries for processing errors we've logged
      return reply.code(200).send({ received: true, error: 'Processing error logged' });
    }

    return { received: true };
  });
}
