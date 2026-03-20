import { describe, it, expect } from 'vitest';
import { sendSms } from './sms.js';
import { sendEmail } from './email.js';

describe('SMS Provider (Twilio)', () => {
  it('returns failure with clear message when Twilio is not configured', async () => {
    const result = await sendSms('1234567890', 'Hello', {
      accountSid: '',
      authToken: '',
      fromNumber: '',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Twilio is not configured');
    expect(result.error).toContain('TWILIO_ACCOUNT_SID');
    expect(result.error).toContain('TWILIO_AUTH_TOKEN');
  });

  it('returns failure when only accountSid is missing', async () => {
    const result = await sendSms('1234567890', 'Hello', {
      accountSid: '',
      authToken: 'some-token',
      fromNumber: '+1234567890',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Twilio is not configured');
  });

  it('returns failure when only authToken is missing', async () => {
    const result = await sendSms('1234567890', 'Hello', {
      accountSid: 'AC123',
      authToken: '',
      fromNumber: '+1234567890',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Twilio is not configured');
  });
});

describe('Email Provider (SendGrid)', () => {
  it('returns failure with clear message when SendGrid is not configured', async () => {
    const result = await sendEmail('test@example.com', 'Subject', 'Body', {
      apiKey: '',
      fromEmail: 'noreply@homer.io',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('SendGrid is not configured');
    expect(result.error).toContain('SENDGRID_API_KEY');
  });
});
