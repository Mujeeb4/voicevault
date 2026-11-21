/** Public website origin, set at build time for canonical URLs and metadata. */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

/**
 * Origin of the admin dashboard. In production it is the admin. subdomain of the
 * site (admin.voicevault.life); locally it is the site itself, at /admin.
 * NEXT_PUBLIC_ADMIN_URL overrides it.
 */
export const adminUrl = (() => {
  const configured = process.env.NEXT_PUBLIC_ADMIN_URL;
  if (configured) return configured.replace(/\/+$/, '');
  const site = new URL(siteUrl);
  if (LOCAL_HOSTNAMES.has(site.hostname)) return siteUrl;
  return `${site.protocol}//admin.${site.host}`;
})();

export const siteHost = new URL(siteUrl).host;
export const adminHost = new URL(adminUrl).host;

/** True when the admin dashboard has its own host and is not served on the main site. */
export const adminHasOwnHost = adminHost !== siteHost;

/** Link to an admin page, on the admin host when it has one. */
export function adminHref(path = '/admin'): string {
  return adminHasOwnHost ? `${adminUrl}${path}` : path;
}

/** Link to a page of the main site, from the admin host when it has one. */
export function siteHref(path = '/'): string {
  return adminHasOwnHost ? `${siteUrl}${path}` : path;
}
