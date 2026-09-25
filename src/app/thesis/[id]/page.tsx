import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadInvestigation } from '@/lib/db/load';
import { siteOrigin } from '@/lib/site';
import { composeObservation, SENTIMENT, SENTIMENT_NOTE } from '@/lib/research/observe';
import { ArenaBoard } from '@/components/arena-section';
import { ConsensusCard } from '@/components/arena';
import { InvalidationPanel } from '@/components/evidence';
import { CoverageBreakdown, WhyPanel } from '@/components/reasoning';
import { TermStructureCard } from '@/components/term-structure';
import { IndependentPanel } from '@/components/independent';
import { MonitorPanel } from '@/components/monitor-panel';
import { Section } from '@/components/sections';
import { CoinIcon } from '@/components/coin';
import { ShareCard } from '@/components/share-card';

export const dynamic = 'force-dynamic';

/** Lets X, Slack and the rest unfurl the result card from the link alone. */
export async function generateMetadata({ params }: PageProps<'/thesis/[id]'>) {
  const { id } = await params;
  const loaded = await loadInvestigation(id);
  if (!loaded) return { title: 'Investigation · ThesisArena' };

  const title = `${SENTIMENT[loaded.status]} · ${loaded.row.symbol} · ${loaded.thesis.consensus.score}/100`;
  const description = `${loaded.row.statement} · evidence score ${loaded.thesis.consensus.score}/100 on ${loaded.thesis.consensus.coverage}% data coverage. Powered by Nansen.`;
  const image = `/api/og/${id}`;

  return {
    title,
    description,
    openGraph: { title, description, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

const STATUS_TONE: Record<string, string> = {
  SUPPORTED: 'var(--accent)',
  CHALLENGED: 'var(--bearish)',
  MIXED: 'var(--neutral)',
  UNDER_STRESS: 'var(--cautious)',
  INVALIDATED: 'var(--bearish)',
};

export default async function InvestigationPage({
  params,
}: PageProps<'/thesis/[id]'>) {
  const { id } = await params;
  const loaded = await loadInvestigation(id);
  if (!loaded) notFound();

  const { row, thesis, status, job, events } = loaded;
  const tone = STATUS_TONE[status] ?? 'var(--neutral)';
  const observation = composeObservation(thesis.agents, thesis.tripwires, status);

  return (
    <main>
      <header className="border-b">
        <div className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <CoinIcon symbol={row.symbol} size={30} chain={row.chain} address={row.address} />
            <span className="text-[15px] text-ink-secondary">
              {row.symbol} · {row.chain}
            </span>
            <span
              className="rounded-md px-2 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em]"
              style={{
                color: tone,
                background: `color-mix(in srgb, ${tone} 13%, transparent)`,
                border: `1px solid color-mix(in srgb, ${tone} 32%, transparent)`,
              }}
            >
              {SENTIMENT[status]}
            </span>
          </div>

          <h1 className="mt-4 max-w-[68ch] text-balance text-[24px] font-semibold leading-snug tracking-tight sm:text-[30px]">
            “{row.statement}”
          </h1>

          <div
            className="mt-5 max-w-[70ch] rounded-xl px-5 py-4"
            style={{ background: 'var(--surface-1)', borderLeft: `2px solid ${tone}` }}
          >
            <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-muted">
              What we found
            </p>
            <p className="mt-2 text-[14.5px] leading-[1.7] text-ink-secondary">
              {observation}
            </p>
            <p className="mt-3 text-[12px] text-ink-muted">{SENTIMENT_NOTE[status]}</p>
          </div>

          <p className="mt-5 font-mono text-[11px] text-ink-muted">
            {row.id} · opened {new Date(row.created_at).toLocaleString('en-GB')} ·{' '}
            {row.live_calls} live Nansen calls · {row.credits_spent} credits
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/report/${row.id}`}
              className="rounded-lg px-3.5 py-2 text-[13px] font-medium"
              style={{ background: 'var(--accent)', color: '#04120c' }}
            >
              Full report
            </Link>
            <Link
              href="/new"
              className="rounded-lg px-3.5 py-2 text-[13px]"
              style={{ border: '1px solid var(--border-neutral)', color: 'var(--text-secondary)' }}
            >
              New investigation
            </Link>
          </div>
        </div>
      </header>

      <Section eyebrow="Verdict" title="Where the evidence lands">
        <ConsensusCard consensus={thesis.consensus} />
      </Section>

      <Section
        eyebrow="Share"
        title="The result, ready to post"
        sub="Every figure on the card comes from this investigation. Nothing is restated or rounded for effect."
      >
        <div className="max-w-[680px]">
          <ShareCard
            thesis={thesis}
            status={status}
            chain={row.chain}
            address={row.address}
            url={`${siteOrigin()}/thesis/${row.id}`}
            investigationId={row.id}
            observation={observation}
          />
        </div>
      </Section>

      <Section
        eyebrow="Stress test"
        title="What would change our mind"
        sub="Committed to at investigation time and re-checked against live data. A fatal condition invalidates the thesis regardless of the score."
      >
        <InvalidationPanel tripwires={thesis.tripwires} />

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
          <WhyPanel
            agents={thesis.agents}
            tripwires={thesis.tripwires}
            independent={thesis.independent}
            status={status}
            coverage={thesis.consensus.coverage}
          />
          <CoverageBreakdown
            agents={thesis.agents}
            coverage={thesis.consensus.coverage}
          />
        </div>
        <div className="mt-6">
          <MonitorPanel investigationId={row.id} job={job} events={events} />
        </div>
      </Section>

      <Section
        eyebrow="Research"
        title="The modules, and where they disagree"
        sub="Four deterministic modules. They are allowed to disagree, and a challenge is raised only when they genuinely do."
      >
        <ArenaBoard agents={thesis.agents} debate={thesis.debate} />
      </Section>

      <Section
        eyebrow="Evidence"
        title="The flows underneath the argument"
        sub="Nansen-derived signal, shown alongside independent corroboration and never merged with it."
      >
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <TermStructureCard data={thesis.termStructure} />
          <IndependentPanel sources={thesis.independent} />
        </div>
      </Section>
    </main>
  );
}
