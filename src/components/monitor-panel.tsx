'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { MonitoringJob } from '@/lib/monitor/runner';

/**
 * Monitoring controls and history.
 *
 * Each check is a real Nansen read against the conditions committed to at
 * investigation time — nothing new is invented to monitor.
 */

export interface MonitorEvent {
  id: string;
  kind: string;
  from_status: string | null;
  to_status: string | null;
  wire_key: string | null;
  detail: string;
  credits: number;
  live_calls: number;
  at: string;
}

const STATE_COLOR: Record<string, string> = {
  ACTIVE: 'var(--accent)',
  PAUSED: 'var(--cautious)',
  STOPPED: 'var(--text-muted)',
};

export function MonitorPanel({
  investigationId,
  job,
  events,
}: {
  investigationId: string;
  job: MonitoringJob | null;
  events: MonitorEvent[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function act(action: string) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch('/api/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ investigationId, action }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Request failed');
      if (body.result?.error) setError(body.result.error);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const active = job?.state === 'ACTIVE';

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold">Monitoring</h2>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            Re-checks the stress conditions against live Nansen data.
          </p>
        </div>

        {job && (
          <span
            className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: STATE_COLOR[job.state] }}
          >
            {active && (
              <span
                className="live-dot h-[6px] w-[6px] rounded-full"
                style={{ background: 'var(--accent)' }}
                aria-hidden="true"
              />
            )}
            {job.state}
          </span>
        )}
      </header>

      {job ? (
        <>
          <dl className="grid grid-cols-2 gap-px sm:grid-cols-4" style={{ background: 'var(--border-neutral)' }}>
            <Cell label="Checks run" value={String(job.checks_run)} />
            <Cell label="Interval" value={`${job.interval_minutes} min`} />
            <Cell
              label="Last checked"
              value={job.last_checked_at ? <Time iso={job.last_checked_at} /> : 'n/a'}
            />
            <Cell
              label="Next check"
              value={active && job.next_check_at ? <Time iso={job.next_check_at} future /> : 'n/a'}
            />
          </dl>

          <div className="flex flex-wrap gap-2 px-5 py-4">
            <Btn onClick={() => act('check')} busy={busy === 'check'} primary>
              Check now
            </Btn>
            {active ? (
              <Btn onClick={() => act('pause')} busy={busy === 'pause'}>
                Pause
              </Btn>
            ) : (
              <Btn onClick={() => act('resume')} busy={busy === 'resume'}>
                Resume
              </Btn>
            )}
            <Btn onClick={() => act('stop')} busy={busy === 'stop'}>
              Stop
            </Btn>
          </div>
        </>
      ) : (
        <div className="px-5 py-5">
          <p className="max-w-[60ch] text-[13px] leading-relaxed text-ink-secondary">
            Monitoring re-reads only the metrics these conditions are bound to, roughly
            2 credits per check, 5 on the deeper cycle. Every check is a
            real request; cached and replayed responses are never counted.
          </p>
          <div className="mt-4">
            <Btn onClick={() => act('start')} busy={busy === 'start'} primary>
              Monitor this thesis
            </Btn>
          </div>
        </div>
      )}

      {error && (
        <p className="border-t px-5 py-3 text-[12px]" style={{ color: 'var(--bearish)' }}>
          {error}
        </p>
      )}

      {events.length > 0 && (
        <div className="border-t">
          <p className="px-5 pt-4 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted">
            Event history
          </p>
          <ul className="max-h-[320px] divide-y overflow-y-auto">
            {events.map((e) => (
              <li key={e.id} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span
                    className="font-mono text-[9.5px] uppercase tracking-wider"
                    style={{ color: kindColor(e.kind) }}
                  >
                    {e.kind.replace('_', ' ')}
                  </span>
                  <span
                    className="tabular font-mono text-[10px] text-ink-muted"
                    suppressHydrationWarning
                  >
                    {rel(e.at)}
                    {e.live_calls > 0 && ` · ${e.live_calls} calls · ${e.credits} cr`}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-secondary">
                  {e.detail}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function kindColor(kind: string): string {
  if (kind === 'transition') return 'var(--cautious)';
  if (kind === 'condition_change') return 'var(--cautious)';
  if (kind === 'error') return 'var(--bearish)';
  return 'var(--accent)';
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-surface-1 px-4 py-3">
      <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </dt>
      <dd className="tabular mt-1 text-[14px] font-medium">{value}</dd>
    </div>
  );
}

function Btn({
  children,
  onClick,
  busy,
  primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded-lg px-3.5 py-2 text-[13px] font-medium transition-opacity disabled:opacity-50"
      style={
        primary
          ? { background: 'var(--accent)', color: '#04120c' }
          : { border: '1px solid var(--border-neutral)', color: 'var(--text-secondary)' }
      }
    >
      {busy ? 'Working…' : children}
    </button>
  );
}

/**
 * A relative timestamp.
 *
 * The server renders this against its clock and the browser hydrates a few
 * seconds later against its own, so the text legitimately differs — "in 7m"
 * becomes "in 6m". That is what suppressHydrationWarning is for: React keeps
 * the client's value, which is the accurate one.
 */
function Time({ iso, future = false }: { iso: string; future?: boolean }) {
  return <span suppressHydrationWarning>{rel(iso, future)}</span>;
}

function rel(iso: string, future = false): string {
  const diff = future
    ? new Date(iso).getTime() - Date.now()
    : Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins <= 0) return future ? 'due now' : 'just now';
  if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return future ? `in ${hrs}h` : `${hrs}h ago`;
  return future ? `in ${Math.round(hrs / 24)}d` : `${Math.round(hrs / 24)}d ago`;
}
