'use client';

import type { Agent, AgentId, Consensus, Stance } from '@/lib/types';
import { ProvenanceDot } from './evidence';

/* -------------------------------------------------------------------------
 * Stance — colour always travels with a label
 * ---------------------------------------------------------------------- */

export const STANCE_COLOR: Record<Stance, string> = {
  bullish: 'var(--bullish)',
  cautious: 'var(--cautious)',
  neutral: 'var(--neutral)',
  bearish: 'var(--bearish)',
};

const STANCE_LABEL: Record<Stance, string> = {
  bullish: 'Bullish',
  cautious: 'Cautious',
  neutral: 'Neutral',
  bearish: 'Bearish',
};

export function StanceBadge({ stance }: { stance: Stance }) {
  const c = STANCE_COLOR[stance];
  return (
    <span
      className="shrink-0 rounded-md px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em]"
      style={{
        color: c,
        background: `color-mix(in srgb, ${c} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${c} 32%, transparent)`,
      }}
    >
      {STANCE_LABEL[stance]}
    </span>
  );
}

/* -------------------------------------------------------------------------
 * Agent cards
 * ---------------------------------------------------------------------- */

export function AgentGrid({
  agents,
  onInspect,
}: {
  agents: Agent[];
  onInspect?: (agent: Agent) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {agents.map((a) => (
        <AgentCard key={a.id} agent={a} onInspect={onInspect} />
      ))}
    </div>
  );
}

/** Meter fill carries severity — the confidence level, not the stance. */
function confidenceColor(v: number): string {
  if (v >= 70) return 'var(--bullish)';
  if (v >= 45) return 'var(--cautious)';
  return 'var(--bearish)';
}

function AgentCard({
  agent: a,
  onInspect,
}: {
  agent: Agent;
  onInspect?: (agent: Agent) => void;
}) {
  const c = STANCE_COLOR[a.stance];
  const meter = confidenceColor(a.confidence);

  return (
    <article className="card flex flex-col p-5">
      <div className="flex items-start gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
          style={{
            background: `color-mix(in srgb, ${c} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${c} 28%, transparent)`,
            color: c,
          }}
        >
          <AgentIcon id={a.id} />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-tight">{a.name}</h3>
          <p className="mt-0.5 text-[11px] text-ink-muted">{a.subtitle}</p>
        </div>

        <StanceBadge stance={a.stance} />
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-ink-secondary">
        {a.summary}
      </p>

      <div
        className="my-4 h-px"
        style={{ background: 'var(--border-neutral)' }}
      />

      <ul className="space-y-2">
        {a.bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              className="mt-[6px] inline-block h-1 w-1 shrink-0 rounded-full"
              style={{
                background:
                  b.tone === 'positive'
                    ? 'var(--bullish)'
                    : b.tone === 'negative'
                      ? 'var(--cautious)'
                      : 'var(--neutral)',
              }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 text-[12px] leading-relaxed text-ink-secondary">
              {b.label}
              {b.display && (
                <>
                  {': '}
                  <span className="font-medium text-ink">{b.display}</span>
                </>
              )}
              <ProvenanceDot provenance={b.provenance} />
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Confidence
          </span>
          <span
            className="tabular font-mono text-[12px] font-semibold"
            style={{ color: meter }}
          >
            {a.confidence}%
          </span>
        </div>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--surface-3)' }}
          role="meter"
          aria-valuenow={a.confidence}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${a.name} confidence`}
        >
          <div
            className="bar-grow h-full rounded-full"
            style={{ width: `${a.confidence}%`, background: meter }}
          />
        </div>

        {onInspect && (
          <button
            type="button"
            onClick={() => onInspect(a)}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-[12.5px] font-medium transition-colors"
            style={{
              color: 'var(--accent)',
              border: '1px solid var(--border-strong)',
            }}
          >
            View evidence
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        )}
      </div>
    </article>
  );
}

function AgentIcon({ id }: { id: AgentId }) {
  const p = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (id) {
    case 'smart-money':
      return (
        <svg {...p}>
          <path d="M3 17l6-6 4 4 7-7" />
          <path d="M14 8h6v6" />
        </svg>
      );
    case 'flow-intelligence':
      return (
        <svg {...p}>
          <path d="M3 7h18M3 12h18M3 17h18" />
          <circle cx="8" cy="7" r="1.6" fill="currentColor" />
          <circle cx="15" cy="12" r="1.6" fill="currentColor" />
          <circle cx="10" cy="17" r="1.6" fill="currentColor" />
        </svg>
      );
    case 'holder-concentration':
      return (
        <svg {...p}>
          <path d="M5 20V9M12 20V4M19 20v-7" />
        </svg>
      );
    case 'pattern-memory':
      return (
        <svg {...p}>
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="18" cy="10" r="2.5" />
          <circle cx="9" cy="18" r="2.5" />
          <path d="M8.2 7.3l7.6 2M16.4 12.2L10.7 16" />
        </svg>
      );
  }
}

/* -------------------------------------------------------------------------
 * Consensus
 * ---------------------------------------------------------------------- */

export function ConsensusCard({ consensus: c }: { consensus: Consensus }) {
  const tone =
    c.score >= 67
      ? 'var(--bullish)'
      : c.score >= 45
        ? 'var(--cautious)'
        : 'var(--bearish)';

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--accent)' }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
          </svg>
        </span>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          Consensus signal
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-5">
        <div className="flex items-baseline gap-1">
          <span
            className="text-[52px] font-bold leading-none"
            style={{ color: tone }}
          >
            {c.score}
          </span>
          <span className="text-lg text-ink-muted">/100</span>
        </div>

        <div className="min-w-0">
          <p className="text-[15px] font-semibold" style={{ color: tone }}>
            {c.label}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            {c.leanPositive} of {c.total} agents lean positive
          </p>
        </div>

        <ScoreRing score={c.score} tone={tone} />
      </div>

      <div
        className="mt-5 h-2 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--surface-3)' }}
        role="meter"
        aria-valuenow={c.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Consensus score"
      >
        <div
          className="bar-grow h-full rounded-full"
          style={{ width: `${c.score}%`, background: tone }}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Callout
          label="Strongest signal"
          value={c.strongestSignal}
          color="var(--bullish)"
        />
        <Callout
          label="Biggest contradiction"
          value={c.biggestContradiction}
          color="var(--cautious)"
        />
      </div>
    </section>
  );
}

function Callout({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border-neutral)',
      }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: color }}
          aria-hidden="true"
        />
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          {label}
        </span>
      </div>
      <p className="mt-1 text-[13px]">{value}</p>
    </div>
  );
}

function ScoreRing({ score, tone }: { score: number; tone: string }) {
  const R = 30;
  const C = 2 * Math.PI * R;

  return (
    <div className="relative ml-auto h-[76px] w-[76px] shrink-0">
      <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
        <circle
          cx="38"
          cy="38"
          r={R}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth="5"
        />
        <circle
          cx="38"
          cy="38"
          r={R}
          fill="none"
          stroke={tone}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - score / 100)}
          transform="rotate(-90 38 38)"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-[19px] font-bold leading-none">{score}</span>
        <span className="mt-0.5 font-mono text-[8px] uppercase tracking-wider text-ink-muted">
          Score
        </span>
      </div>
    </div>
  );
}
