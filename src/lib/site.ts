/**
 * The absolute origin this instance is reachable at.
 *
 * Needed wherever a URL has to survive leaving the page: a shared link, and the
 * `metadataBase` that turns the relative Open Graph image path into something
 * X and Slack can fetch.
 *
 * The fallback chain exists because the previous default was a bare
 * `http://localhost:3001`, which is correct in development and silently wrong
 * everywhere else. A deployed instance whose operator had not set
 * NEXT_PUBLIC_SITE_URL produced share links pointing at the reader's own
 * machine, and an unfurl that could never resolve.
 *
 * Order matters. An explicit setting always wins, because a custom domain is
 * something only the operator knows. Failing that, Vercel supplies the stable
 * production domain, and for a preview deployment the per-deployment URL,
 * either of which is a working link. Localhost is the last resort rather than
 * the default.
 */
export function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;

  return 'http://localhost:3001';
}
