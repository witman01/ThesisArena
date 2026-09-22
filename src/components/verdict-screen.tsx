'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AssetMeta } from '@/lib/assets';
import type { Thesis } from '@/lib/types';
import type { InvestigationStatus } from '@/lib/db/store';
import {
  composeObservation,
  SENTIMENT,
  SENTIMENT_NOTE,
  verdictLabel,
  verdictNote,
} from '@/lib/research/observe';
import { ShareCard } from './share-card';
import { CoinIcon } from './coin';

/**
 * The verdict.
 *
 * Deliberately a different visual state from the dashboard — one number, one
 * sentence, and the invalidation conditions. It is called an Evidence Score,
 * never a probability: it measures how consistent the evidence is, not the
 * likelihood of an outcome.
 */
function stressedTone(state: Thesis['state'], score: number): string {
  if (state === 'stressed') return 'var(--cautious)';
  return score >= 55 ? 'var(--bullish)' : 'var(--cautious)';
}

export function VerdictScreen({
  thesis,
  asset,
  investigationId,
  status,
}: {
  thesis: Thesis;
  asset: AssetMeta;
  investigationId?: string;
  status?: InvestigationStatus;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1400);
      setShown(Math.round(thesis.consensus.score * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [thesis.consensus.score]);

  // Three states, not two: "survived" overstates a thesis that is intact only
  // because nothing fatal has tripped yet.
  const survived = thesis.state !== 'broken';
  const stressed = thesis.state === 'stressed';

  const resolved: InvestigationStatus =
    status ??
    (!survived ? 'INVALIDATED' : stressed ? 'UNDER_STRESS' : 'SUPPORTED');

  const headline = SENTIMENT[resolved];
  const observation = composeObservation(thesis.agents, thesis.tripwires, resolved);
  const tone = !survived
    ? 'var(--bearish)'
    : stressedTone(thesis.state, thesis.consensus.score);

  const challenges = thesis.consensus.total - thesis.consensus.leanPositive;
  return (
    <div className="mx-auto max-w-[820px] px-5 py-16 sm:py-20">
      <div className="text-center">
        <p className="font-mono text-[11px] tracking-[0.22em] text-ink-muted">
          INVESTIGATION COMPLETE
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <CoinIcon
            symbol={asset.symbol}
            size={28}
            chain={asset.chain}
            address={asset.address}
          />
          <span className="text-[15px] text-ink-secondary">
            {asset.symbol} / {asset.chainLabel}
          </span>
        </div>

        <div className="mt-6 flex items-end justify-center gap-2">
          <span
            className="tabular text-[86px] font-bold leading-[0.9] tracking-tight sm:text-[108px]"
            style={{ color: tone }}
          >
            {shown}
          </span>
          <span className="pb-3 text-[24px] font-medium text-ink-muted">/100</span>
        </div>

        <p className="mt-2 font-mono text-[10.5px] tracking-[0.18em] text-ink-muted">
          EVIDENCE SCORE
        </p>

        {/* Coverage sits beside the score, never folded into it: how strong
            the case is and how much we actually know are separate facts. */}
        <div className="mt-6 flex items-center justify-center gap-2.5">
          <span className="font-mono text-[10.5px] tracking-[0.14em] text-ink-muted">
            DATA COVERAGE
          </span>
          <div
            className="h-1.5 w-28 overflow-hidden rounded-full"
            style={{ background: 'var(--surface-3)' }}
            role="meter"
            aria-valuenow={thesis.consensus.coverage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Data coverage"
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${thesis.consensus.coverage}%`,
                background:
                  thesis.consensus.coverage >= 70
                    ? 'var(--accent)'
                    : 'var(--cautious)',
              }}
            />
          </div>
          <span
            className="tabular font-mono text-[12px] font-semibold"
            style={{
              color:
                thesis.consensus.coverage >= 70
                  ? 'var(--accent)'
                  : 'var(--cautious)',
            }}
          >
            {thesis.consensus.coverage}%
          </span>
        </div>

        <h1
          className="mt-7 text-[26px] font-semibold tracking-tight sm:text-[32px]"
          style={{ color: tone }}
        >
          {headline}
        </h1>

        <p className="mt-2 text-[13.5px] text-ink-muted">
          {SENTIMENT_NOTE[resolved]} · {thesis.consensus.leanPositive} support ·{' '}
          {challenges} challenge{challenges === 1 ? '' : 's'}
        </p>

        {/* The right/wrong call, framed "so far" — the conditions are
            still being checked. */}
        <div
          className="mx-auto mt-7 inline-flex max-w-[54ch] flex-col items-center rounded-xl px-5 py-4"
          style={{
            background: 'var(--surface-1)',
            border: `1px solid color-mix(in srgb, ${tone} 30%, transparent)`,
          }}
        >
          <span
            className="text-[17px] font-semibold"
            style={{ color: tone }}
          >
            {verdictLabel(resolved)}
          </span>
          <span className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
            {verdictNote(resolved)}
          </span>
        </div>
      </div>

      {/* The finding, written out. This is the result — the label above is
          only its one-word summary. */}
      <div
        className="mx-auto mt-9 max-w-[62ch] rounded-xl px-5 py-4"
        style={{
          background: 'var(--surface-1)',
          borderLeft: `2px solid ${tone}`,
        }}
      >
        <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-muted">
          What we found
        </p>
        <p className="mt-2 text-[14.5px] leading-[1.7] text-ink-secondary">
          {observation}
        </p>
      </div>

      <p className="mx-auto mt-8 max-w-[52ch] text-center text-[12.5px] leading-relaxed text-ink-muted">
        This measures the strength and consistency of the on-chain evidence. It
        is not a probability, and it is not a price forecast.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <Block
          label="Strongest signal"
          value={thesis.consensus.strongestSignal}
          tone="var(--bullish)"
        />
        <Block
          label="Biggest contradiction"
          value={thesis.consensus.biggestContradiction}
          tone="var(--cautious)"
        />
      </div>

      <section className="mt-10">
        <h2 className="font-mono text-[10.5px] tracking-[0.18em] text-ink-muted">
          WHAT COULD INVALIDATE THIS THESIS?
        </h2>
        <ul className="mt-4 space-y-2">
          {thesis.tripwires.slice(0, 4).map((t) => (
            <li
              key={t.id}
              className="flex items-start gap-3 rounded-xl px-4 py-3.5"
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border-neutral)',
              }}
            >
              <span
                className="mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full"
                style={{
                  background:
                    t.status === 'tripped'
                      ? 'var(--bearish)'
                      : t.status === 'stressed'
                        ? 'var(--cautious)'
                        : 'var(--bullish)',
                }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] leading-snug">{t.claim}</p>
                <p className="mt-1 font-mono text-[10.5px] text-ink-muted">
                  {t.metric.field} {t.comparator} {t.threshold} · {t.sustain}
                  {t.metric.derivedFrom && (
                    <span className="block opacity-75">
                      derived from {t.metric.derivedFrom.join(', ')}
                    </span>
                  )}
                </p>
              </div>
              <span
                className="shrink-0 font-mono text-[9.5px] uppercase tracking-wider"
                style={{
                  color:
                    t.status === 'tripped'
                      ? 'var(--bearish)'
                      : t.status === 'stressed'
                        ? 'var(--cautious)'
                        : 'var(--bullish)',
                }}
              >
                {t.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {investigationId && (
        <section className="mt-12">
          <h2 className="mb-4 font-mono text-[10.5px] tracking-[0.18em] text-ink-muted">
            SHARE THE RESULT
          </h2>
          <ShareCard
            thesis={thesis}
            status={resolved}
            chain={asset.chain}
            address={asset.address}
            investigationId={investigationId}
            observation={observation}
            url={`${typeof window !== 'undefined' ? window.location.origin : ''}/thesis/${investigationId}`}
          />
        </section>
      )}

      <div className="mt-12 flex flex-wrap justify-center gap-3">
        <Link
          href={investigationId ? `/thesis/${investigationId}` : '/history'}
          className="rounded-xl px-5 py-3 text-[14px] font-semibold"
          style={{ background: 'var(--accent)', color: '#04120c' }}
        >
          Open investigation
        </Link>
        {investigationId && (
          <Link
            href={`/report/${investigationId}`}
            className="rounded-xl px-5 py-3 text-[14px] transition-colors hover:text-ink"
            style={{
              border: '1px solid var(--border-neutral)',
              color: 'var(--text-secondary)',
            }}
          >
            Full report
          </Link>
        )}
        <Link
          href="/new"
          className="rounded-xl px-5 py-3 text-[14px] transition-colors hover:text-ink"
          style={{
            border: '1px solid var(--border-neutral)',
            color: 'var(--text-secondary)',
          }}
        >
          Test another thesis
        </Link>
      </div>
    </div>
  );
}

function Block({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border-neutral)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-[7px] w-[7px] rounded-full"
          style={{ background: tone }}
          aria-hidden="true"
        />
        <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted">
          {label}
        </span>
      </div>
      <p className="mt-2 text-[16px] font-medium">{value}</p>
    </div>
  );
}
