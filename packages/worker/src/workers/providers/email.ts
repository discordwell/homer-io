// SendGrid REST API via fetch (no SDK)
import { logger } from '../../lib/logger.js';

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  config: { apiKey: string; fromEmail: string },
): Promise<{ success: boolean; providerId?: string; error?: string }> {
  if (!config.apiKey) {
    logger.warn('[email] No SendGrid API key configured — email will not be delivered. Set SENDGRID_API_KEY to enable email.');
    return { success: false, error: 'SendGrid is not configured. Set the SENDGRID_API_KEY environment variable to enable email notifications.' };
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: config.fromEmail },
      subject,
      content: [{ type: 'text/plain', value: body }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return { success: false, error: err };
  }

  // SendGrid returns 202 with no body on success
  const messageId = response.headers.get('x-message-id') || '';
  return { success: true, providerId: messageId };
}
