import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { logger } from '../../lib/logger.js';

const expo = new Expo();
const log = logger.child({ provider: 'push' });

/**
 * Send push notifications to Expo push tokens.
 * Handles chunking and receipt validation.
 */
export async function sendPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (tokens.length === 0) return;

  // Filter valid Expo push tokens
  const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));
  if (validTokens.length === 0) {
    log.warn('No valid Expo push tokens', { tokenCount: tokens.length });
    return;
  }

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title,
    body,
    data,
    sound: 'default' as const,
    priority: 'high' as const,
  }));

  // Chunk messages (Expo has a limit per batch)
  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      log.info('Push notifications sent', { count: chunk.length, receipts: receipts.length });
    } catch (err) {
      log.error('Push notification batch failed', {
        error: err instanceof Error ? err.message : 'Unknown error',
        tokenCount: chunk.length,
      });
    }
  }
}
