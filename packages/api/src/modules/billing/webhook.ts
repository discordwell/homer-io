import { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { config } from '../../config.js';
import { handleWebhookEvent } from './service.js';
import { cacheSetNX, cacheDelete } from '../../lib/cache.js';

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

    // Deduplicate — Stripe can retry events, and concurrent retries can race.
    // Use an atomic SET NX to claim the event BEFORE processing. Two concurrent
    // deliveries of the same event.id will race on the SETNX; exactly one wins
    // and processes, the rest short-circuit. 48h TTL covers Stripe's retry window.
    const dedupKey = `stripe:event:${event.id}`;
    const claimed = await cacheSetNX(dedupKey, '1', 172800);
    if (!claimed) {
      app.log.info(`[billing] Duplicate event skipped: ${event.type} (${event.id})`);
      return { received: true };
    }

    try {
      await handleWebhookEvent(event);
      app.log.info(`[billing] Processed webhook event: ${event.type} (${event.id})`);
    } catch (err) {
      app.log.error({ err, eventType: event.type }, '[billing] Error processing webhook event');
      // Release the dedup claim so Stripe's retry can actually reprocess.
      // Without this, a transient failure would be poisoned for 48h.
      await cacheDelete(dedupKey);
      // Return 5xx so Stripe retries — processing failed, not a duplicate.
      return reply.code(500).send({ received: false, error: 'Processing error' });
    }

    return { received: true };
  });
}
