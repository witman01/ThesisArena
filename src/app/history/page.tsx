import Link from 'next/link';
import { listInvestigations } from '@/lib/db/store';
import { SENTIMENT } from '@/lib/research/observe';
import { PageHead } from '@/components/shell';
import { Section } from '@/components/sections';
import { CoinIcon } from '@/components/coin';
import { EmptyState } from '@/components/empty-state';

export const dynamic = 'force-dynamic';

const TONE: Record<string, string> = {
  SUPPORTED: 'var(--accent)',
  CHALLENGED: 'var(--bearish)',
  MIXED: 'var(--neutral)',
  UNDER_STRESS: 'var(--cautious)',
  INVALIDATED: 'var(--bearish)',
};

export default async function History() {
  const rows = await listInvestigations();

  const invalidated = rows.filter((r) => r.status === 'INVALIDATED').length;
  const stressed = rows.filter((r) => r.status === 'UNDER_STRESS').length;

  return (
    <main>
      <PageHead
        eyebrow="History"
        title="Every investigation, and how it stands"
        sub="A thesis is only honest if its outcome is recorded whether or not it flattered you. Nothing here is edited after the fact."
      />

      <Section>
        {rows.length === 0 ? (
          <EmptyState
            title="No investigations yet"
            body="Once you put a thesis on trial it is stored here permanently, with its evidence, its stress conditions and every status change."
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Investigations" value={rows.length} />
              <Stat label="Under stress" value={stressed} tone="var(--cautious)" />
              <Stat label="Invalidated" value={invalidated} tone="var(--bearish)" />
            </div>

            <ul className="mt-8 divide-y overflow-hidden rounded-[14px] border">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/thesis/${r.id}`}
                    className="grid grid-cols-1 gap-3 px-5 py-4 transition-colors hover:bg-surface-2 lg:grid-cols-[52px_minmax(0,1fr)_130px_100px_120px_130px] lg:items-center lg:gap-4"
                  >
                    <span
                      className="grid h-9 w-9 place-items-center rounded-lg"
                      style={{ background: 'var(--surface-3)' }}
                    >
                      <CoinIcon symbol={r.symbol} size={22} chain={r.chain} address={r.address} />
                    </span>

                    <p className="min-w-0 text-[14px] leading-snug">{r.statement}</p>

                    <span className="font-mono text-[11px] text-ink-muted">
                      {new Date(r.created_at).toLocaleDateString('en-GB')}
                    </span>

                    <span className="flex items-baseline gap-1">
                      <span className="tabular text-[15px] font-semibold">
                        {r.evidence_score}
                      </span>
                      <span className="text-[11px] text-ink-muted">/100</span>
                    </span>

                    <span className="tabular font-mono text-[11px] text-ink-secondary">
                      {r.live_calls} calls · {r.credits_spent} cr
                    </span>

                    <span
                      className="font-mono text-[10px] font-semibold uppercase tracking-wider lg:text-right"
                      style={{ color: TONE[r.status] }}
                    >
                      {SENTIMENT[r.status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="card p-5">
      <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </div>
      <div
        className="tabular mt-2.5 text-[30px] font-bold leading-none"
        style={{ color: tone ?? 'var(--text-primary)' }}
      >
        {value}
      </div>
    </div>
  );
}
