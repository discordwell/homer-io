import { config } from '../config.js';

export async function sendTransactionalEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; error?: string }> {
  if (!config.sendgrid.apiKey) {
    console.log(`[email] No SendGrid API key configured, would send to ${to}: ${subject}`);
    return { success: true };
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.sendgrid.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: config.sendgrid.fromEmail, name: 'HOMER.io' },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`[email] SendGrid error:`, err);
    return { success: false, error: err };
  }

  return { success: true };
}
