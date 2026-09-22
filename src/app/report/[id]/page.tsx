import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadInvestigation, statusLabel } from '@/lib/db/load';
import type { Agent, Thesis, Tripwire } from '@/lib/types';
import { CoinIcon } from '@/components/coin';
import { TermStructureCard } from '@/components/term-structure';
import { ProvenanceDot } from '@/components/evidence';
import { IndependentPanel } from '@/components/independent';
import { ReportActions } from '@/components/report-actions';

export const dynamic = 'force-dynamic';

/**
 * The full report.
 *
 * Laid out like an institutional research note rather than a dashboard:
 * narrow measure, numbered sections, findings stated before evidence, and
 * every figure traceable to the request that produced it.
 */

export const metadata = {
  title: 'Investigation report · ThesisArena',
};

export default async function Report({ params }: PageProps<'/report/[id]'>) {
  const { id } = await params;
  const loaded = await loadInvestigation(id);
  if (!loaded) notFound();

  const t: Thesis = loaded.thesis;
  const row = loaded.row;
  const tripped = t.tripwires.filter((w) => w.status === 'tripped');
  const contradictions = t.agents.flatMap((a) =>
    a.bullets.filter((b) => b.tone === 'negative').map((b) => ({ agent: a, bullet: b })),
  );

  return (
    <main className="mx-auto max-w-[900px] px-5 py-10 sm:px-8 sm:py-14">
      <ReportHeader thesis={t} createdAt={row.created_at} />

      <Section n="01" title="Thesis">
        <blockquote
          className="rounded-xl px-5 py-4 text-[16px] leading-relaxed"
          style={{
            background: 'var(--surface-1)',
            borderLeft: '2px solid var(--accent)',
          }}
        >
          “{t.statement}”
        </blockquote>
        <Meta
          rows={[
            ['Asset', `${t.asset.symbol} · ${t.asset.chain}`],
            ['Horizon', t.horizon],
            ['Status', statusLabel(loaded.status)],
            ['Conditions monitored', String(t.tripwires.length)],
          ]}
        />
      </Section>

      <Section n="02" title="Executive summary">
        <p className="text-[14.5px] leading-[1.75] text-ink-secondary">
          The evidence scores <Strong>{t.consensus.score}/100</Strong>,{' '}
          {t.consensus.label.toLowerCase()}, on{' '}
          <Strong>{t.consensus.coverage}% data coverage</Strong>.{' '}
          {t.consensus.leanPositive} of {t.consensus.total} research modules lean
          positive. The strongest support comes from{' '}
          <Strong>{t.consensus.strongestSignal}</Strong>; the sharpest objection
          is <Strong>{t.consensus.biggestContradiction}</Strong>.
        </p>
        <p className="mt-4 text-[14.5px] leading-[1.75] text-ink-secondary">
          {tripped.length === 0 ? (
            <>No invalidation condition has been met. The thesis stands.</>
          ) : (
            <>
              <Strong>
                {tripped.length} of {t.tripwires.length} invalidation conditions
              </Strong>{' '}
              have already been met
              {tripped.some((w) => w.severity === 'fatal') && (
                <>, including one classed <Strong>fatal</Strong></>
              )}
              . On the terms set at the outset, this thesis has not survived.
            </>
          )}
        </p>
        <Callout>
          The evidence score measures the strength and consistency of on-chain
          evidence. It is not a probability, and it is not a price forecast.
        </Callout>
      </Section>

      <Section n="03" title="Agent consensus">
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Module', 'Stance', 'Confidence', 'Weight'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-2.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted ${i ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.agents.map((a, i) => (
                <tr key={a.id} style={{ borderTop: i ? '1px solid var(--border-neutral)' : undefined }}>
                  <td className="px-4 py-3 text-[13.5px]">{a.name}</td>
                  <td className="px-4 py-3 text-right text-[13px] capitalize" style={{ color: stanceColor(a) }}>
                    {a.stance}
                  </td>
                  <td className="tabular px-4 py-3 text-right text-[13px] font-medium">
                    {a.confidence}%
                  </td>
                  <td className="tabular px-4 py-3 text-right text-[13px] text-ink-muted">
                    {WEIGHT_LABEL[a.id] ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {t.agents.map((a, i) => (
        <Section key={a.id} n={String(i + 4).padStart(2, '0')} title={a.name}>
          <p className="text-[14.5px] leading-[1.75] text-ink-secondary">
            {a.summary}
          </p>
          <ul className="mt-5 space-y-px overflow-hidden rounded-xl border">
            {a.bullets.map((b, j) => (
              <li
                key={j}
                className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3"
                style={{
                  background: 'var(--surface-1)',
                  borderTop: j ? '1px solid var(--border-neutral)' : undefined,
                }}
              >
                <span className="text-[13px] text-ink-secondary">
                  {b.label}
                  <ProvenanceDot provenance={b.provenance} />
                </span>
                <span
                  className="tabular text-[14px] font-semibold"
                  style={{ color: toneColor(b.tone) }}
                >
                  {b.display || '—'}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      <Section n="08" title="Contradicting evidence">
        <p className="text-[14px] leading-relaxed text-ink-muted">
          Collected in one place rather than buried under the module that found
          it, so a reader can see the case against without hunting.
        </p>
        {contradictions.length === 0 ? (
          <p className="mt-4 text-[14px] text-ink-secondary">
            No module produced a finding that cuts against the thesis.
          </p>
        ) : (
          <ul className="mt-5 space-y-2">
            {contradictions.map(({ agent, bullet }, i) => (
              <li
                key={i}
                className="rounded-xl px-4 py-3.5"
                style={{
                  background: 'var(--surface-1)',
                  borderLeft: '2px solid var(--cautious)',
                }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="text-[13.5px]">{bullet.label}</span>
                  <span
                    className="tabular text-[14px] font-semibold"
                    style={{ color: 'var(--cautious)' }}
                  >
                    {bullet.display || '—'}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10.5px] text-ink-muted">
                  {agent.name} · {bullet.provenance.endpoint}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section n="09" title="Invalidation conditions">
        <p className="text-[14px] leading-relaxed text-ink-muted">
          Committed to at the outset and evaluated by arithmetic, not judgement.
        </p>
        <ul className="mt-5 space-y-2">
          {t.tripwires.map((w) => (
            <TripwireRow key={w.id} wire={w} />
          ))}
        </ul>
      </Section>

      <Section n="10" title="Raw Nansen evidence">
        <TermStructureCard data={t.termStructure} />
        <div className="mt-5">
          <IndependentPanel sources={t.independent} />
        </div>
      </Section>

      <footer className="mt-14 border-t pt-6">
        <p className="font-mono text-[10.5px] leading-relaxed text-ink-muted">
          Derived signals only. Figures from restricted Nansen endpoints
          contribute to composite scores and are never reproduced as raw values.
          Research tool, not investment advice.
        </p>
      </footer>
    </main>
  );
}

const WEIGHT_LABEL: Record<string, string> = {
  'smart-money': '35%',
  'flow-intelligence': '25%',
  'holder-concentration': '20%',
  'pattern-memory': '20%',
};

function stanceColor(a: Agent): string {
  return a.stance === 'bullish'
    ? 'var(--bullish)'
    : a.stance === 'bearish'
      ? 'var(--bearish)'
      : a.stance === 'cautious'
        ? 'var(--cautious)'
        : 'var(--neutral)';
}

function toneColor(t: 'positive' | 'negative' | 'neutral'): string {
  return t === 'positive'
    ? 'var(--bullish)'
    : t === 'negative'
      ? 'var(--cautious)'
      : 'var(--text-primary)';
}

function ReportHeader({ thesis: t, createdAt }: { thesis: Thesis; createdAt: string }) {
  return (
    <header className="border-b pb-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="font-mono text-[10.5px] tracking-[0.2em] text-ink-muted">
            INVESTIGATION REPORT
          </p>
          <div className="mt-3 flex items-center gap-3">
            <CoinIcon symbol={t.asset.symbol} size={32} />
            <h1 className="text-[26px] font-semibold tracking-tight">
              {t.asset.symbol}
              <span className="ml-2 text-[15px] font-normal text-ink-muted">
                {t.asset.chain}
              </span>
            </h1>
          </div>
          <p className="mt-2 font-mono text-[11px] text-ink-muted">
            Ref {t.id} · {new Date(createdAt).toISOString().slice(0, 10)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ReportActions
            shareUrl={`${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'}/report/${t.id}`}
          />
          <Link
            href={`/thesis/${t.id}`}
            className="rounded-lg px-3.5 py-2 text-[13px] transition-colors hover:text-ink print:hidden"
            style={{
              border: '1px solid var(--border-neutral)',
              color: 'var(--text-secondary)',
            }}
          >
            Back
          </Link>
        </div>
      </div>
    </header>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 scroll-mt-24">
      <div className="mb-5 flex items-baseline gap-3 border-b pb-2.5">
        <span className="font-mono text-[11px] text-ink-muted">{n}</span>
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Meta({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 border-b pb-2">
          <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
            {k}
          </dt>
          <dd className="text-[13.5px] capitalize">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mt-5 rounded-xl px-4 py-3 text-[12.5px] leading-relaxed text-ink-muted"
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border-neutral)',
      }}
    >
      {children}
    </p>
  );
}

function TripwireRow({ wire: w }: { wire: Tripwire }) {
  const color =
    w.status === 'tripped'
      ? 'var(--bearish)'
      : w.status === 'stressed'
        ? 'var(--cautious)'
        : 'var(--bullish)';

  return (
    <li
      className="rounded-xl px-4 py-3.5"
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border-neutral)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 basis-64 text-[13.5px] leading-snug">
          {w.claim}
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <span className="font-mono text-[9.5px] uppercase tracking-wider text-ink-muted">
            {w.severity}
          </span>
          <span
            className="font-mono text-[9.5px] font-semibold uppercase tracking-wider"
            style={{ color }}
          >
            {w.status}
          </span>
        </div>
      </div>
      <p className="mt-1.5 font-mono text-[10.5px] text-ink-muted">
        breaks if <span style={{ color }}>{w.metric.field} {w.comparator} {w.threshold}</span>{' '}
        for {w.sustain} · now {Number(w.currentValue.toPrecision(5))}
      </p>
    </li>
  );
}
