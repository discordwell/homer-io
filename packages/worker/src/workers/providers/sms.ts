// Twilio REST API via fetch (no SDK)
import { logger } from '../../lib/logger.js';

export async function sendSms(
  to: string,
  body: string,
  config: { accountSid: string; authToken: string; fromNumber: string },
): Promise<{ success: boolean; providerId?: string; error?: string }> {
  if (!config.accountSid || !config.authToken) {
    logger.warn('[sms] No Twilio credentials configured — SMS will not be delivered. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to enable SMS.');
    return { success: false, error: 'Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables to enable SMS notifications.' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: config.fromNumber, Body: body }),
  });

  if (!response.ok) {
    const err = await response.text();
    return { success: false, error: err };
  }

  const data = await response.json();
  return { success: true, providerId: data.sid };
}
