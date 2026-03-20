export function formatAddress(addr: { street?: string; city?: string; state?: string; zip?: string } | null): string {
  if (!addr) return 'No address';
  return [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
}
