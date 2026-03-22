/**
 * Static blocklist of known disposable/temporary email domains.
 * Used to prevent demo abuse — follows the same pattern as GENERIC_DOMAINS in domain.ts.
 */

const DISPOSABLE_DOMAINS = new Set([
  // Major disposable services
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'yopmail.com',
  'yopmail.fr',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  '10minutemail.com',
  '10minutemail.net',
  'throwaway.email',
  'throwaway.com',
  'trashmail.com',
  'trashmail.net',
  'trashmail.me',
  'mailnesia.com',
  'maildrop.cc',
  'dispostable.com',
  'sharklasers.com',
  'grr.la',
  'guerrillamail.info',
  'spam4.me',
  'getairmail.com',
  'mailexpire.com',
  'tempail.com',
  'tempr.email',
  'discard.email',
  'discardmail.com',
  'discardmail.de',
  'mailcatch.com',
  'fakeinbox.com',
  'fakemail.net',
  'mytemp.email',
  'mohmal.com',
  'burnermail.io',
  'mailnull.com',
  'spamgourmet.com',
  'harakirimail.com',
  'mailsac.com',
  'mintemail.com',
  'getnada.com',
  'nada.email',
  'emailondeck.com',
  'tempinbox.com',
  'crazymailing.com',
  'mailforspam.com',
  'safetymail.info',
  'filzmail.com',
  'inboxkitten.com',
  'mailhazard.com',
  'mailhazard.us',
  'tempmailaddress.com',
  'emailfake.com',
  'generator.email',
  'guerrillamail.biz',
  'anonymousemail.me',
  'anonbox.net',
  'mytrashmail.com',
  'jetable.org',
  'spamfree24.org',
  'trashymail.com',
  'trashymail.net',
  'tempmailo.com',
  'tmpmail.net',
  'tmpmail.org',
  'tempomail.fr',
  'mailtemp.info',
  'mailtemp.net',
  'tempsky.com',
  'tmail.ws',
  'mailpoof.com',
  'pookmail.com',
  'leeching.net',
  'nomail.xl.cx',
  'spamcero.com',
  'ezehe.com',
  'drdrb.net',
  'yolanda.dev',
]);

/**
 * Check if an email address uses a known disposable email domain.
 * Also catches subdomains (e.g. sub.mailinator.com).
 * @param email - Full email address (already lowercased by schema transform)
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  // Exact match
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  // Subdomain match: check if domain ends with .blockedDomain
  for (const blocked of DISPOSABLE_DOMAINS) {
    if (domain.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

export { DISPOSABLE_DOMAINS };
