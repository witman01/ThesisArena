import { NextResponse } from 'next/server';
import { getRecentRequests, getUsage } from '@/lib/db/store';

/** The auditable API-usage ledger. Live network calls only. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    usage: await getUsage(),
    recent: await getRecentRequests(30),
  });
}
