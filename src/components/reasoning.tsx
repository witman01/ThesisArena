import type { Agent, IndependentSource, Tripwire } from '@/lib/types';
import type { InvestigationStatus } from '@/lib/db/store';
import { explainVerdict, type Reason } from '@/lib/research/explain';
import { WEIGHTS } from '@/lib/research/falsify';

/**
 * Why the verdict came out this way.
 *
 * Each reason carries the measurement it rests on and the endpoint that
 * produced it, so the panel can be checked line by line rather than believed.
 */

const TONE: Record<Reason['tone'], string> = {
  positive: 'var(--bullish)',
  negative: 'var(--bearish)',
  neutral: 'var(--neutral)',
};

const KIND_LABEL: Record<Reason['kind'], string> = {
  driver: 'What drove it',
  contradiction: 'What argued against',
  condition: 'What moved',
  market: 'Market conditions',
  coverage: 'What it could not see',
};

export function WhyPanel({
  agents,
  tripwires,
  independent,
  status,
  coverage,
}: {
  agents: Agent[];
  tripwires: Tripwire[];
  independent: IndependentSource[];
  status: InvestigationStatus;
  coverage: number;
}) {
  const reasons = explainVerdict(agents, tripwires, independent, status, coverage);
  if (reasons.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <header className="border-b px-5 py-4">
        <h3 className="text-[15px] font-semibold">Why this verdict</h3>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          Every line is a stored measurement, with the endpoint it came from.
        </p>
      </header>

      <ol className="divide-y">
        {reasons.map((r, i) => (
          <li key={`${r.kind}-${i}`} className="flex gap-3.5 px-5 py-4">
            <span
              className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full"
              style={{ background: TONE[r.tone] }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-[13.5px] font-semibold">
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">
                    {KIND_LABEL[r.kind]}
                  </span>
                  <span className="mt-0.5 block">{r.headline}</span>
                </p>
                {r.figure && (
                  <span
                    className="tabular shrink-0 font-mono text-[13px] font-bold"
                    style={{ color: TONE[r.tone] }}
                  >
                    {r.figure}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-secondary">
                {r.detail}
              </p>
              <p className="mt-1.5 font-mono text-[9.5px] text-ink-muted">{r.source}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Coverage, broken down by module.
 *
 * A single percentage says how much was known but not what was missing, and
 * those are different questions. A thesis resting on two modules because the
 * other two had no data for this asset should say so on the face of it.
 */
export function CoverageBreakdown({
  agents,
  coverage,
}: {
  agents: Agent[];
  coverage: number;
}) {
  // A module that reported a degraded measurement says so in the figure
  // itself, which is the only honest signal available at render time.
  const rows = agents.map((a) => {
    const degraded = a.bullets.filter((b) =>
      /not covered|unsupported|unavailable|not available/i.test(b.display),
    );
    const measured = a.bullets.length - degraded.length;
    return {
      name: a.name,
      weight: (WEIGHTS[a.id as keyof typeof WEIGHTS] ?? 0) * 100,
      measured,
      total: a.bullets.length,
      confidence: a.confidence,
      note: degraded[0]?.display ?? null,
    };
  });

  const full = rows.filter((r) => r.note === null).length;

  return (
    <div className="card overflow-hidden">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-5 py-4">
        <div>
          <h3 className="text-[15px] font-semibold">Data coverage</h3>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            {full} of {rows.length} modules measured everything they read.
          </p>
        </div>
        <span
          className="tabular font-mono text-[20px] font-bold"
          style={{ color: coverage >= 70 ? 'var(--accent)' : 'var(--cautious)' }}
        >
          {coverage}%
        </span>
      </header>

      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.name} className="px-5 py-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[13px] font-medium">{r.name}</span>
              <span className="font-mono text-[11px] text-ink-muted">
                {r.measured}/{r.total} measured · weight {Math.round(r.weight)}% ·{' '}
                <span style={{ color: r.note ? 'var(--cautious)' : 'var(--accent)' }}>
                  {r.confidence}% confidence
                </span>
              </span>
            </div>

            <div
              className="mt-2 h-[5px] w-full overflow-hidden rounded-full"
              style={{ background: 'var(--surface-3)' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${r.total > 0 ? (r.measured / r.total) * 100 : 0}%`,
                  background: r.note ? 'var(--cautious)' : 'var(--accent)',
                }}
              />
            </div>

            {r.note && (
              <p className="mt-1.5 text-[11.5px]" style={{ color: 'var(--cautious)' }}>
                {r.note}
              </p>
            )}
          </li>
        ))}
      </ul>

      <p className="border-t px-5 py-3 text-[11.5px] leading-relaxed text-ink-muted">
        Confidence is capped by coverage. A module that received three candles
        cannot report eighty percent conviction, however clean those candles
        look.
      </p>
    </div>
  );
}
