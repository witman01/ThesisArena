import { getRecentRequests, getUsage } from '@/lib/db/store';
import { PageHead } from '@/components/shell';
import { Section } from '@/components/sections';
import { EmptyState } from '@/components/empty-state';

export const dynamic = 'force-dynamic';

const CALL_TARGET = 1000;

/**
 * API usage, built entirely from the persisted request ledger.
 *
 * Only rows recorded with source='live' are counted. Cache hits and fixture
 * replays are shown separately and explicitly excluded, because counting them
 * toward the buildathon requirement would be dishonest.
 */
export default async function Analytics() {
  const u = await getUsage();
  const recent = await getRecentRequests(30);

  if (u.liveCalls === 0 && u.cacheHits === 0 && u.fixtureReplays === 0) {
    return (
      <>
        <PageHead
          eyebrow="Analytics"
          title="Every call, every credit, accounted for"
          sub="Built from the request ledger. Nothing on this page is estimated or simulated."
        />
        <Section>
          <EmptyState
            title="No API activity recorded"
            body="The ledger fills as investigations run and monitoring checks fire. Only real network calls against the Nansen key are counted."
          />
        </Section>
      </>
    );
  }

  const pct = Math.min(100, (u.liveCalls / CALL_TARGET) * 100);
  const maxCalls = Math.max(...u.byEndpoint.map((e) => e.calls), 1);

  return (
    <main>
      <PageHead
        eyebrow="Analytics"
        title="Every call, every credit, accounted for"
        sub="Built from the persisted request ledger. Cache hits and fixture replays are recorded but never counted as API calls."
      />

      <Section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Live API calls" value={u.liveCalls} accent />
          <Tile label="Successful" value={u.successfulCalls} />
          <Tile
            label="Failed"
            value={u.failedCalls}
            tone={u.failedCalls > 0 ? 'var(--cautious)' : undefined}
          />
          <Tile label="Credits consumed" value={u.creditsConsumed} />
        </div>

        <section className="card mt-6 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 className="text-[16px] font-semibold">
              Progress toward 1,000 live calls
            </h2>
            <span className="font-mono text-[11.5px] text-ink-muted">
              {spanLabel(u.firstCallAt, u.lastCallAt)}
            </span>
          </div>

          <div
            className="mt-5 h-2 w-full overflow-hidden rounded-full"
            style={{ background: 'var(--surface-3)' }}
            role="meter"
            aria-valuenow={u.liveCalls}
            aria-valuemin={0}
            aria-valuemax={CALL_TARGET}
            aria-label="Progress toward 1,000 live API calls"
          >
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${pct}%`,
                background: pct >= 100 ? 'var(--accent)' : 'var(--accent-dim)',
              }}
            />
          </div>
          <div className="mt-2.5 flex flex-wrap justify-between gap-3 font-mono text-[11px]">
            <span className="tabular" style={{ color: 'var(--accent)' }}>
              {u.liveCalls.toLocaleString()} live calls
            </span>
            <span className="tabular text-ink-muted">
              {CALL_TARGET.toLocaleString()} target
            </span>
          </div>

          <p className="mt-4 text-[12px] leading-relaxed text-ink-muted">
            Excluded from this count: {u.cacheHits.toLocaleString()} cache hits
            and {u.fixtureReplays.toLocaleString()} fixture replays. Neither
            reaches the Nansen API, so neither is an API call.
          </p>
        </section>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
          <div className="space-y-6">
            <section className="card overflow-hidden">
              <header className="border-b px-5 py-4">
                <h2 className="text-[15px] font-semibold">Calls by source</h2>
                <p className="mt-0.5 text-[12px] text-ink-muted">
                  Where the legitimate call volume comes from.
                </p>
              </header>
              <ul className="divide-y">
                {u.byContext.map((c) => (
                  <li
                    key={c.context}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <span className="text-[13px] capitalize">{c.context}</span>
                    <span className="tabular font-mono text-[12px] text-ink-muted">
                      {c.calls.toLocaleString()} calls · {c.credits} cr
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card overflow-hidden">
              <header className="border-b px-5 py-4">
                <h2 className="text-[15px] font-semibold">Endpoint usage</h2>
              </header>
              <ul className="space-y-3.5 p-5">
                {u.byEndpoint.map((e) => (
                  <li key={e.endpoint}>
                    <div className="flex items-baseline justify-between gap-3 font-mono text-[11px]">
                      <span className="truncate text-ink-secondary">{e.endpoint}</span>
                      <span className="tabular shrink-0 text-ink-muted">
                        {e.calls.toLocaleString()} · {e.credits} cr
                        {e.failed > 0 && (
                          <span style={{ color: 'var(--cautious)' }}>
                            {' '}
                            · {e.failed} failed
                          </span>
                        )}
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
                      style={{ background: 'var(--surface-3)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(e.calls / maxCalls) * 100}%`,
                          background: 'var(--accent-dim)',
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="card overflow-hidden">
            <header className="border-b px-4 py-3">
              <h2 className="text-[13px] font-semibold">Recent requests</h2>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                Newest first, all sources.
              </p>
            </header>
            <ul className="max-h-[520px] divide-y overflow-y-auto">
              {recent.map((r, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11px] text-ink-secondary">
                      {r.endpoint}
                    </p>
                    <p className="font-mono text-[10px] text-ink-muted">
                      {r.request_id ?? r.context} ·{' '}
                      {new Date(r.at).toLocaleTimeString('en-GB')}
                    </p>
                  </div>
                  <span
                    className="tabular shrink-0 font-mono text-[9.5px] uppercase tracking-wider"
                    style={{ color: sourceTone(r.source, r.ok === 1) }}
                  >
                    {r.source === 'live'
                      ? r.ok
                        ? `${r.credits} cr`
                        : 'failed'
                      : r.source}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </Section>
    </main>
  );
}

function sourceTone(source: string, ok: boolean): string {
  if (source !== 'live') return 'var(--text-muted)';
  return ok ? 'var(--accent)' : 'var(--bearish)';
}

function spanLabel(first: string | null, last: string | null): string {
  if (!first || !last) return '';
  const hours = (new Date(last).getTime() - new Date(first).getTime()) / 3.6e6;
  if (hours < 1) return 'accumulated over under an hour';
  if (hours < 48) return `accumulated over ${Math.round(hours)}h`;
  return `accumulated over ${Math.round(hours / 24)} days`;
}

function Tile({
  label,
  value,
  tone,
  accent = false,
}: {
  label: string;
  value: number;
  tone?: string;
  accent?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </div>
      <div
        className="tabular mt-2.5 text-[30px] font-bold leading-none"
        style={{ color: tone ?? (accent ? 'var(--accent)' : 'var(--text-primary)') }}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}
