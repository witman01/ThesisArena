import { ENDPOINTS } from '@/lib/nansen/endpoints';
import { getUsage } from '@/lib/db/store';
import { all, one, countCast } from '@/lib/db/sql';
import { PageHead } from '@/components/shell';
import { Section } from '@/components/sections';

export const dynamic = 'force-dynamic';

/**
 * Settings.
 *
 * Every value here is read from the running system — the endpoint registry,
 * the request ledger, the monitoring jobs table. Nothing is hand-written
 * config text pretending to be state.
 */

const TIER_LABEL: Record<string, { name: string; rule: string; tone: string }> = {
  cheap: { name: '1 credit', rule: 'Always available', tone: 'var(--accent)' },
  mid: { name: '5 credits', rule: 'Only when the cheap tier is inconclusive', tone: 'var(--cautious)' },
  expensive: { name: '25 credits', rule: 'Explicit opt-in per call', tone: 'var(--bearish)' },
  blocked: { name: 'Blocked', rule: 'Throws. Too costly, or prohibited for display', tone: 'var(--neutral)' },
};

const REDIST_NOTE: Record<string, string> = {
  allowed: 'Redistributable',
  attribution: 'Redistributable with attribution',
  restricted: 'Composite score only — never rendered raw',
  prohibited: 'Never rendered, never called',
};

export default async function Settings() {
  const usage = await getUsage();

  const jobs = await all<{ state: string; n: number; lo: number; hi: number }>(
    `SELECT state,
            ${countCast('COUNT(*)')} AS n,
            MIN(interval_minutes)    AS lo,
            MAX(interval_minutes)    AS hi
     FROM monitoring_jobs GROUP BY state`,
  );

  const active = jobs.find((j) => j.state === 'ACTIVE');
  const paused = jobs.find((j) => j.state === 'PAUSED');

  const checks =
    (
      await one<{ n: number }>(
        `SELECT ${countCast('COUNT(*)')} AS n FROM monitoring_events WHERE kind='check'`,
      )
    )?.n ?? 0;

  const keyConfigured = Boolean(process.env.NANSEN_API_KEY);

  // Group the live registry by escalation tier.
  const byTier = Object.values(ENDPOINTS).reduce<Record<string, typeof ENDPOINTS[keyof typeof ENDPOINTS][]>>(
    (acc, spec) => {
      (acc[spec.tier] ??= []).push(spec);
      return acc;
    },
    {},
  );

  return (
    <main>
      <PageHead
        eyebrow="Settings"
        title="Budget, tiers and guardrails"
        sub="Read from the running system: the endpoint registry, the request ledger and the monitoring jobs table."
      />

      <Section eyebrow="Connection" title="API credentials">
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted">
                Nansen API key
              </div>
              <p className="mt-2 flex items-center gap-2 text-[14px]">
                <span
                  className="inline-block h-[7px] w-[7px] rounded-full"
                  style={{ background: keyConfigured ? 'var(--accent)' : 'var(--cautious)' }}
                  aria-hidden="true"
                />
                {keyConfigured
                  ? 'Configured. Held server-side in .env.local, never sent to the browser'
                  : 'Not configured — add NANSEN_API_KEY to .env.local'}
              </p>
            </div>

            {usage.creditsRemaining !== null && (
              <div className="text-right">
                <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted">
                  Credits remaining
                </div>
                <div
                  className="tabular mt-1.5 text-[26px] font-bold leading-none"
                  style={{
                    color: usage.creditsRemaining < 500 ? 'var(--cautious)' : 'var(--accent)',
                  }}
                >
                  {usage.creditsRemaining.toLocaleString()}
                </div>
              </div>
            )}
          </div>

          <p className="mt-4 border-t pt-4 text-[12px] leading-relaxed text-ink-muted">
            Read from the <code className="font-mono">X-Nansen-Credits-Remaining</code> header
            on the most recent live response, not estimated locally.
          </p>
        </div>
      </Section>

      <Section eyebrow="Credit governor" title="Spend controls">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            label="Active monitors"
            value={String(active?.n ?? 0)}
            note={paused?.n ? `${paused.n} paused` : 'none paused'}
          />
          <Tile
            label="Check interval"
            value={active ? (active.lo === active.hi ? `${active.lo} min` : `${active.lo}–${active.hi} min`) : '—'}
            note="per monitored thesis"
          />
          <Tile label="Checks run" value={checks.toLocaleString()} note="recorded in the event log" />
          <Tile
            label="Credits consumed"
            value={usage.creditsConsumed.toLocaleString()}
            note={`across ${usage.liveCalls.toLocaleString()} live calls`}
          />
        </div>

        <div className="card mt-6 overflow-hidden">
          <header className="border-b px-5 py-4">
            <h3 className="text-[15px] font-semibold">Endpoint tiers</h3>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              The registry the client enforces. Escalation is explicit: a costlier
              tier is never reached by accident.
            </p>
          </header>

          <ul className="divide-y">
            {(['cheap', 'mid', 'expensive', 'blocked'] as const).map((tier) => {
              const specs = byTier[tier] ?? [];
              if (specs.length === 0) return null;
              const meta = TIER_LABEL[tier];

              return (
                <li key={tier} className="flex flex-wrap items-start gap-x-5 gap-y-2 px-5 py-4">
                  <span
                    className="w-[92px] shrink-0 font-mono text-[11px] font-bold"
                    style={{ color: meta.tone }}
                  >
                    {meta.name}
                  </span>
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="text-[13px]">{meta.rule}</p>
                    <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 font-mono text-[10.5px] text-ink-muted">
                      {specs.map((s) => (
                        <span key={s.path} title={REDIST_NOTE[s.redistribution]}>
                          {s.path}
                          {(s.redistribution === 'restricted' ||
                            s.redistribution === 'prohibited') && (
                            <span style={{ color: 'var(--cautious)' }}>*</span>
                          )}
                        </span>
                      ))}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="border-t px-5 py-3 font-mono text-[10px] text-ink-muted">
            <span style={{ color: 'var(--cautious)' }}>*</span> restricted or
            prohibited for redistribution, contributes to a composite score only
          </p>
        </div>
      </Section>

      <Section
        eyebrow="Compliance"
        title="Redistribution guardrails"
        sub="Nansen's terms permit derived analysis but prohibit republishing its proprietary signals. These are code paths, not policy statements."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Guard
            title="Prohibited endpoints throw"
            body={`${Object.values(ENDPOINTS).filter((e) => e.tier === 'blocked').length} endpoints are blocked in the registry. The client raises rather than calling them, so avoidance is not left to convention.`}
          />
          <Guard
            title="Restricted data enters as a score"
            body={`${Object.values(ENDPOINTS).filter((e) => e.redistribution === 'restricted').length} endpoint(s) are restricted. Their values contribute weighted terms to a composite and are tagged "derived" wherever they surface.`}
          />
          <Guard
            title="Independent source required"
            body="Every composite is combined with DeFiLlama, shown in its own panel and explicitly labelled as not Nansen data."
          />
          <Guard
            title="Attribution displayed"
            body="“Powered by Nansen API” appears in the footer and on every shareable result card."
          />
        </div>
      </Section>
    </main>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card p-5">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </div>
      <div className="tabular mt-2 text-[24px] font-bold leading-none">{value}</div>
      <p className="mt-2 text-[11px] text-ink-muted">{note}</p>
    </div>
  );
}

function Guard({ title, body }: { title: string; body: string }) {
  return (
    <div className="card h-full p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[14.5px] font-semibold">{title}</h3>
        <span
          className="mt-0.5 flex shrink-0 items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--accent)' }}
        >
          <span aria-hidden="true">●</span>
          Enforced
        </span>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-secondary">{body}</p>
    </div>
  );
}
