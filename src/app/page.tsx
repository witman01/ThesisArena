import Link from 'next/link';
import { listInvestigations, countInvestigations, getUsage } from '@/lib/db/store';
import { SENTIMENT } from '@/lib/research/observe';
import { Hero } from '@/components/hero';
import { HowItWorks, Section } from '@/components/sections';
import { EmptyState } from '@/components/empty-state';
import { CoinIcon } from '@/components/coin';

export const dynamic = 'force-dynamic';

const TONE: Record<string, string> = {
  SUPPORTED: 'var(--accent)',
  CHALLENGED: 'var(--bearish)',
  MIXED: 'var(--neutral)',
  UNDER_STRESS: 'var(--cautious)',
  INVALIDATED: 'var(--bearish)',
};

/**
 * The landing page.
 *
 * It shows the positioning and whatever real investigations exist. It does not
 * display a sample verdict, a sample debate or sample usage — an empty product
 * says so.
 */
export default async function Home() {
  // Concurrent: three independent reads, and on Postgres each is a round trip.
  const [recent, total, usage] = await Promise.all([
    listInvestigations(6),
    countInvestigations(),
    getUsage(),
  ]);

  return (
    <main>
      <Hero
        rotation={recent.slice(0, 5).map((r) => ({
          id: r.id,
          statement: r.statement,
          symbol: r.symbol,
          chain: r.chain,
          address: r.address,
          score: r.evidence_score,
          status: r.status,
        }))}
        investigationCount={total}
        liveCalls={usage.liveCalls}
      />

      <Section
        eyebrow="Investigations"
        title="What the arena has been arguing about"
        action={recent.length > 0 ? { label: 'View all', href: '/history' } : undefined}
      >
        {recent.length === 0 ? (
          <EmptyState
            title="Nothing on trial yet"
            body="Put a thesis on trial and it appears here, with its evidence, its stress conditions, and every status change recorded permanently."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recent.map((r) => (
              <Link
                key={r.id}
                href={`/thesis/${r.id}`}
                className="group flex flex-col rounded-[14px] p-5 transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-neutral)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2.5">
                    <span
                      className="grid h-9 w-9 place-items-center rounded-lg"
                      style={{ background: 'var(--surface-3)' }}
                    >
                      <CoinIcon
                        symbol={r.symbol}
                        size={22}
                        chain={r.chain}
                        address={r.address}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-semibold">
                        {r.symbol}
                      </span>
                      <span className="block font-mono text-[10px] capitalize text-ink-muted">
                        {r.chain}
                      </span>
                    </span>
                  </span>
                  <span
                    className="rounded-md px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em]"
                    style={{
                      color: TONE[r.status],
                      background: `color-mix(in srgb, ${TONE[r.status]} 13%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${TONE[r.status]} 30%, transparent)`,
                    }}
                  >
                    {SENTIMENT[r.status]}
                  </span>
                </div>

                <p className="mt-4 text-[14px] font-medium leading-snug">
                  {r.statement}
                </p>

                {/* Score and coverage as a pair of meters, so a card carries
                    the shape of the result rather than only its headline. */}
                <div className="mt-5 space-y-2.5">
                  <Bar
                    label="Evidence"
                    value={r.evidence_score}
                    display={`${r.evidence_score}/100`}
                    color={TONE[r.status]}
                  />
                  <Bar
                    label="Coverage"
                    value={r.coverage}
                    display={`${r.coverage}%`}
                    color="var(--accent-dim)"
                  />
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-5">
                  <span className="tabular font-mono text-[10px] text-ink-muted">
                    {r.support_count} support · {r.challenge_count} challenge
                  </span>
                  <span className="tabular font-mono text-[10px] text-ink-muted">
                    {r.live_calls} calls · {r.credits_spent} cr
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <HowItWorks />
    </main>
  );
}

function Bar({
  label,
  value,
  display,
  color,
}: {
  label: string;
  value: number;
  display: string;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.13em] text-ink-muted">
          {label}
        </span>
        <span className="tabular font-mono text-[10.5px]" style={{ color }}>
          {display}
        </span>
      </div>
      <div
        className="mt-1 h-1 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--surface-3)' }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
        />
      </div>
    </div>
  );
}
