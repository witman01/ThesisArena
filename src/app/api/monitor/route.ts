import { NextResponse } from 'next/server';
import {
  dueJobs,
  getEvents,
  getJob,
  runCheck,
  setJobState,
  startJob,
} from '@/lib/monitor/runner';
import { getConditions, getInvestigation } from '@/lib/db/store';

/**
 * Monitoring control and execution.
 *
 * POST  { investigationId, action } — start | pause | resume | stop | check
 * GET   ?investigationId=…          — job state, conditions and event history
 * GET   ?run=due                    — runs every due job; this is the endpoint
 *                                     an external scheduler calls.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: Request) {
  const url = new URL(req.url);

  if (url.searchParams.get('run') === 'due') {
    const jobs = await dueJobs();
    const results = [];
    for (const job of jobs) results.push(await runCheck(job));
    return NextResponse.json({ ran: results.length, results });
  }

  const investigationId = url.searchParams.get('investigationId');
  if (!investigationId) {
    return NextResponse.json({ error: 'investigationId required' }, { status: 400 });
  }

  const inv = await getInvestigation(investigationId);
  if (!inv) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return NextResponse.json({
    job: await getJob(investigationId),
    status: inv.status,
    conditions: await getConditions(investigationId),
    events: getEvents(investigationId),
  });
}

export async function POST(req: Request) {
  const { investigationId, action, intervalMinutes } = (await req.json()) as {
    investigationId?: string;
    action?: string;
    intervalMinutes?: number;
  };

  if (!investigationId || !action) {
    return NextResponse.json({ error: 'investigationId and action required' }, { status: 400 });
  }
  if (!await getInvestigation(investigationId)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  switch (action) {
    case 'start':
      return NextResponse.json({
        job: await startJob(investigationId, intervalMinutes ?? 15),
      });

    case 'pause':
    case 'stop': {
      const job = await getJob(investigationId);
      if (!job) return NextResponse.json({ error: 'no job' }, { status: 404 });
      await setJobState(job.id, action === 'pause' ? 'PAUSED' : 'STOPPED');
      return NextResponse.json({ job: await getJob(investigationId) });
    }

    case 'resume': {
      const job = await getJob(investigationId);
      if (!job) return NextResponse.json({ error: 'no job' }, { status: 404 });
      await setJobState(job.id, 'ACTIVE');
      return NextResponse.json({ job: await getJob(investigationId) });
    }

    case 'check': {
      const job = await getJob(investigationId);
      if (!job) return NextResponse.json({ error: 'no job' }, { status: 404 });
      const result = await runCheck(job);
      return NextResponse.json({ result, job: await getJob(investigationId) });
    }

    default:
      return NextResponse.json({ error: `unknown action "${action}"` }, { status: 400 });
  }
}
