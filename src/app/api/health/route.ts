import { NextResponse } from 'next/server';
import { isPostgres, resolveDatabaseUrl } from '@/lib/db/pg';
import { siteOrigin } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * What the running instance can actually see.
 *
 * Deployment failures here are configuration failures, and the logs only show
 * the symptom: the process cannot tell you whether a variable is absent, named
 * slightly wrong, or set for a different environment than the one serving the
 * request. Guessing at that from a stack trace wastes a deploy cycle per guess.
 *
 * No value is ever returned, only facts derived from one: whether it is
 * present, whether it parses as a Postgres URL, and whether the host is a
 * pooled endpoint. A reader learns that the configuration is wrong and in
 * which way, and learns nothing that would let them connect to anything.
 */
export function GET() {
  const found = resolveDatabaseUrl();
  const url = found?.url ?? '';
  const key = process.env.NANSEN_API_KEY?.trim() ?? '';

  // Names close enough to be a typo. Reporting them turns "it is not set" into
  // "it is set, under the wrong name", which is a different fix.
  const lookalikes = Object.keys(process.env).filter(
    (k) => /database|neon|postgres/i.test(k) && k !== 'DATABASE_URL',
  );

  return NextResponse.json(
    {
      ok: isPostgres() && key.length > 0,
      backend: isPostgres() ? 'postgres' : 'sqlite (local disk)',
      database: {
        set: url.length > 0,
        // Which variable actually supplied it, so a value provisioned by an
        // integration under its own name is visible rather than looking absent.
        from: found?.from ?? null,
        pooled: url.includes('-pooler.'),
        length: url.length,
      },
      nansenKey: { set: key.length > 0, length: key.length },
      siteOrigin: siteOrigin(),
      platform: {
        vercel: Boolean(process.env.VERCEL),
        // Which environment's variables this request is actually running with,
        // which is the usual culprit when a value was added to only one.
        vercelEnv: process.env.VERCEL_ENV ?? null,
        nodeEnv: process.env.NODE_ENV ?? null,
      },
      otherDatabaseLikeNames: lookalikes,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
