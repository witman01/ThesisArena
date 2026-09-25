/**
 * True on a platform whose filesystem cannot be written to.
 *
 * Two features here keep state on local disk: the SQLite database and the
 * Nansen fixture cache. Both are right for development and both are
 * impossible on a serverless host, where the bundle is read-only and anything
 * written would vanish with the invocation.
 *
 * Keyed on the platform markers rather than NODE_ENV, because a production
 * build running on an ordinary server has a perfectly good filesystem and
 * should keep using it.
 */
export function isServerless(): boolean {
  return Boolean(
    process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME,
  );
}
