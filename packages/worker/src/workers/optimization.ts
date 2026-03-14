import { Job } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../lib/db.js';
import { config } from '../lib/config.js';
import { orders, routes } from '../lib/schema.js';

interface OptimizationJobData {
  tenantId: string;
  routeId: string;
}

export async function processOptimization(job: Job<OptimizationJobData>) {
  const { tenantId, routeId } = job.data;
  console.log(`[optimization] Processing route ${routeId} for tenant ${tenantId}`);

  // Get route
  const [route] = await db
    .select()
    .from(routes)
    .where(and(eq(routes.id, routeId), eq(routes.tenantId, tenantId)))
    .limit(1);

  if (!route) {
    throw new Error(`Route ${routeId} not found`);
  }

  // Get orders on this route
  const routeOrders = await db
    .select()
    .from(orders)
    .where(and(eq(orders.routeId, routeId), eq(orders.tenantId, tenantId)))
    .orderBy(orders.stopSequence);

  if (routeOrders.length === 0) {
    console.log(`[optimization] No orders on route ${routeId}, skipping`);
    return { optimized: false, routeId, message: 'No orders to optimize' };
  }

  // Build stop addresses for the prompt
  const stops = routeOrders.map((order, idx) => {
    const addr = order.deliveryAddress as Record<string, string> | null;
    const addressStr = addr
      ? [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ')
      : `Stop ${idx + 1}`;
    return `${idx}: ${addressStr}`;
  });

  const prompt =
    `I have a delivery route with the following stops (index: address):\n${stops.join('\n')}\n\n` +
    `Please determine the optimal order to visit these stops to minimize total travel distance. ` +
    `Return ONLY a JSON array of the stop indices in optimal order, e.g. [2, 0, 1, 3]. No other text.`;

  if (!config.anthropic.apiKey) {
    console.log(`[optimization] No Anthropic API key, skipping AI optimization`);
    return { optimized: false, routeId, message: 'No API key configured' };
  }

  try {
    const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'You are a route optimization assistant. Return only valid JSON arrays of indices.',
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const jsonMatch = responseText.match(/\[[\d,\s]+\]/);
    if (!jsonMatch) {
      console.warn(`[optimization] Could not parse AI response for route ${routeId}`);
      return { optimized: false, routeId, message: 'Could not parse optimization result' };
    }

    const orderedIndices: number[] = JSON.parse(jsonMatch[0]);

    // Validate indices
    const uniqueIndices = new Set(orderedIndices);
    if (
      orderedIndices.length !== routeOrders.length ||
      uniqueIndices.size !== orderedIndices.length ||
      !orderedIndices.every((i) => i >= 0 && i < routeOrders.length)
    ) {
      console.warn(`[optimization] Invalid indices from AI for route ${routeId}`);
      return { optimized: false, routeId, message: 'Invalid optimization result from AI' };
    }

    // Update stopSequence on orders
    for (let newSeq = 0; newSeq < orderedIndices.length; newSeq++) {
      const originalIdx = orderedIndices[newSeq];
      const order = routeOrders[originalIdx];
      await db
        .update(orders)
        .set({ stopSequence: newSeq + 1, updatedAt: new Date() })
        .where(and(eq(orders.id, order.id), eq(orders.tenantId, tenantId)));
    }

    // Update route optimization notes
    await db
      .update(routes)
      .set({
        optimizationNotes: `Worker-optimized on ${new Date().toISOString()}. Order: ${orderedIndices.join(' -> ')}`,
        updatedAt: new Date(),
      })
      .where(and(eq(routes.id, routeId), eq(routes.tenantId, tenantId)));

    console.log(`[optimization] Route ${routeId} optimized successfully`);
    return { optimized: true, routeId, order: orderedIndices };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[optimization] Failed for route ${routeId}: ${msg}`);
    throw error;
  }
}
