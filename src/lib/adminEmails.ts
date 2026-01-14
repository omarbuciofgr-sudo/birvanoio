// Admin email whitelist - only these users can access webscraper features
export const ADMIN_EMAILS = [
  'omar.bucio@yahoo.com',
  'info@brivano.io',
] as const;

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase() as typeof ADMIN_EMAILS[number]);
}
