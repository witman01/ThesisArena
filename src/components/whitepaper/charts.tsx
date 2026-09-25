/**
 * Charts for the whitepaper.
 *
 * All server-rendered — plain HTML and SVG, no charting library and no client
 * JavaScript. Every value is direct-labelled, so the mark carries the shape and
 * the label carries the number; nothing depends on reading a bar against a grid.
 */

import type { InvestigationStatus } from '@/lib/db/store';
import { SENTIMENT } from '@/lib/research/observe';

const TONE: Record<string, string> = {
  cheap: 'var(--accent)',
  mid: 'var(--cautious)',
  expensive: '#c08a3e',
  blocked: 'var(--bearish)',
};

/* -------------------------------------------------------------------------
 * Credit cost spread — log scale, because the range is 500×
 * ---------------------------------------------------------------------- */

export function CreditSpread({
  rows,
}: {
  rows: { path: string; credits: number; tier: string }[];
}) {
  const max = Math.max(...rows.map((r) => r.credits));
  // Logarithmic: on a linear axis the 1-credit workhorses — the endpoints that
  // do nearly all the work — would be invisible next to a 750-credit call.
  const width = (c: number) =>
    c === 0 ? 1.5 : Math.max(2, (Math.log10(c + 1) / Math.log10(max + 1)) * 100);

  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.path} className="flex items-center gap-2 sm:gap-3">
          {/* The label column gives up most of its width on a phone so the
              bars keep enough room to be worth drawing. */}
          <span className="w-[104px] shrink-0 truncate font-mono text-[10px] text-ink-secondary sm:w-[190px] sm:text-[11px]">
            {r.path}
          </span>
          <div className="relative h-[13px] min-w-0 flex-1">
            <div
              className="absolute inset-y-0 left-0 rounded-[3px]"
              style={{ width: `${width(r.credits)}%`, background: TONE[r.tier] }}
            />
          </div>
          <span
            className="tabular w-[46px] shrink-0 text-right font-mono text-[10px] font-semibold sm:w-[58px] sm:text-[11px]"
            style={{ color: TONE[r.tier] }}
          >
            {r.credits === 0 ? 'free' : `${r.credits} cr`}
          </span>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-3.5">
        {(
          [
            ['cheap', 'Always available'],
            ['mid', 'On escalation'],
            ['expensive', 'Opt-in'],
            ['blocked', 'Refused'],
          ] as const
        ).map(([tier, label]) => (
          <span key={tier} className="flex items-center gap-1.5 font-mono text-[10px] text-ink-muted">
            <span
              className="inline-block h-[8px] w-[8px] rounded-[2px]"
              style={{ background: TONE[tier] }}
              aria-hidden="true"
            />
            {label}
          </span>
        ))}
        <span className="ml-auto font-mono text-[9.5px] text-ink-muted">
          bar length is logarithmic
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Module weights — a single stacked bar
 * ---------------------------------------------------------------------- */

const WEIGHT_TONE = ['var(--accent)', 'var(--cautious)', '#7aa2ff', '#c08a3e'];

export function WeightBar({
  weights,
}: {
  weights: { label: string; weight: number; reads: string }[];
}) {
  return (
    <div>
      <div
        className="flex h-[38px] gap-[2px] overflow-hidden rounded-lg"
        role="img"
        aria-label={weights
          .map((w) => `${w.label} ${Math.round(w.weight * 100)}%`)
          .join(', ')}
      >
        {weights.map((w, i) => (
          <div
            key={w.label}
            className="grid place-items-center first:rounded-l-lg last:rounded-r-lg"
            style={{
              width: `${w.weight * 100}%`,
              background: WEIGHT_TONE[i],
            }}
          >
            <span className="tabular font-mono text-[11px] font-bold" style={{ color: '#04120c' }}>
              {Math.round(w.weight * 100)}%
            </span>
          </div>
        ))}
      </div>

      <ul className="mt-4 space-y-2.5">
        {weights.map((w, i) => (
          <li key={w.label} className="flex items-baseline gap-2.5">
            <span
              className="mt-[1px] inline-block h-[9px] w-[9px] shrink-0 rounded-[2px]"
              style={{ background: WEIGHT_TONE[i] }}
              aria-hidden="true"
            />
            <span className="text-[13px] font-medium text-ink">{w.label}</span>
            <span className="font-mono text-[11px] text-ink-muted">{w.reads}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * State machine — how a thesis moves as evidence arrives
 * ---------------------------------------------------------------------- */

/**
 * Labels come from SENTIMENT rather than being written out again here.
 *
 * There were three copies of this map. The whitepaper's diagram is the one a
 * reader checks the product against, so it is the worst possible place for a
 * stale name to survive a rename.
 */
const STATES: { key: InvestigationStatus; tone: string; note: string }[] = [
  {
    key: 'SUPPORTED',
    tone: 'var(--bullish)',
    note: 'Evidence supports the thesis and no decisive contradiction is present',
  },
  {
    key: 'MIXED',
    tone: 'var(--neutral)',
    note: 'Evidence is split across the research modules',
  },
  {
    key: 'UNDER_STRESS',
    tone: '#c08a3e',
    note: 'One or more conditions show stress, but the thesis has not failed',
  },
  {
    key: 'CHALLENGED',
    tone: 'var(--cautious)',
    note: 'The evidence is materially contradicting the thesis',
  },
  {
    key: 'INVALIDATED',
    tone: 'var(--bearish)',
    note: 'A fatal condition has been met',
  },
];

export function StateMachine() {
  return (
    <div className="space-y-px overflow-hidden rounded-xl border" style={{ background: 'var(--border-neutral)' }}>
      {STATES.map((s) => (
        <div key={s.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-surface-1 px-4 py-3.5">
          <span
            className="inline-block h-[9px] w-[9px] shrink-0 rounded-full"
            style={{ background: s.tone }}
            aria-hidden="true"
          />
          <span
            className="w-[118px] shrink-0 text-[13.5px] font-semibold"
            style={{ color: s.tone }}
          >
            {SENTIMENT[s.key]}
          </span>
          <span className="w-[112px] shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
            {s.key}
          </span>
          <span className="min-w-0 flex-1 basis-48 text-[12.5px] text-ink-secondary">
            {s.note}
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * The four modules — what each reads and what it contributes
 * ---------------------------------------------------------------------- */

const MODULES = [
  {
    name: 'Smart Money',
    reads: 'tgm/flow-intelligence',
    calls: '6 calls · 6 credits',
    derives: 'Flow term structure across six horizons and several cohorts',
    tone: 'var(--accent)',
    weight: 35,
  },
  {
    name: 'Capital Flow',
    reads: 'tgm/flows',
    calls: '1 call · 1 credit',
    derives: 'Net token movement and buy pressure as a share of turnover',
    tone: 'var(--cautious)',
    weight: 25,
  },
  {
    name: 'Holder Concentration',
    reads: 'tgm/who-bought-sold',
    calls: '1 call · 1 credit',
    derives: 'Net USD imbalance, top-3 share of volume, rotating traders',
    tone: '#7aa2ff',
    weight: 20,
  },
  {
    name: 'Pattern Memory',
    reads: 'tgm/token-ohlcv',
    calls: '1 call · 1 credit',
    derives: "Analogues in the asset's own history, strictly point-in-time",
    tone: '#c08a3e',
    weight: 20,
  },
];

export function ModuleDiagram() {
  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{
        background:
          'repeating-linear-gradient(0deg, transparent 0 55px, rgba(255,255,255,0.02) 55px 56px),' +
          'repeating-linear-gradient(90deg, transparent 0 55px, rgba(255,255,255,0.02) 55px 56px),' +
          'var(--surface-2)',
      }}
    >
      {(
        [
          ['top-3 left-3', 'border-l border-t'],
          ['top-3 right-3', 'border-r border-t'],
          ['bottom-3 left-3', 'border-b border-l'],
          ['bottom-3 right-3', 'border-b border-r'],
        ] as const
      ).map(([pos, edge]) => (
        <span
          key={pos}
          className={`pointer-events-none absolute ${pos} h-3.5 w-3.5 ${edge}`}
          style={{ borderColor: 'var(--border-strong)' }}
          aria-hidden="true"
        />
      ))}

      <div className="relative px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
            One thesis / four modules
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
            Independent reads / one composite
          </span>
        </div>

        {/* The hub sits at the centre with the four modules around it, joined
            by dashed spokes in each module's own colour. */}
        <div className="relative mt-6 grid gap-x-4 gap-y-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-y-6">
          <Spokes />

          <Sat m={MODULES[0]} badge="A" side="left" />
          <div className="hidden sm:block" aria-hidden="true" />
          <Sat m={MODULES[1]} badge="B" side="right" />

          {/* hub */}
          <div className="sm:col-span-3 sm:justify-self-center">
            <div
              className="relative z-10 mx-auto max-w-[260px] rounded-lg px-6 py-4 text-center"
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--accent)',
                boxShadow: '0 0 0 5px var(--surface-2), 0 0 34px -12px var(--accent)',
              }}
            >
              <span
                className="inline-block rounded px-2 py-[3px] font-mono text-[8px] uppercase tracking-[0.16em]"
                style={{ border: '1px solid var(--border-strong)', color: 'var(--accent)' }}
              >
                Weighted composite
              </span>
              <p className="mt-2 text-[15px] font-bold leading-tight">
                EVIDENCE
                <br />
                SCORE
              </p>
              <div className="mt-2.5 flex h-[5px] gap-[2px] overflow-hidden rounded-full">
                {MODULES.map((m) => (
                  <span
                    key={m.name}
                    style={{ width: `${m.weight}%`, background: m.tone }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>
          </div>

          <Sat m={MODULES[2]} badge="C" side="left" />
          <div className="hidden sm:block" aria-hidden="true" />
          <Sat m={MODULES[3]} badge="D" side="right" />
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="flex flex-wrap gap-2">
            {['no model calls', 'point-in-time', 'provenance-bound'].map((t) => (
              <span
                key={t}
                className="rounded px-2 py-1 font-mono text-[9px] text-ink-muted"
                style={{ border: '1px solid var(--border-neutral)' }}
              >
                {t}
              </span>
            ))}
          </div>
          <p className="font-mono text-[10px]" style={{ color: 'var(--accent)' }}>
            The evidence can be combined. The verdict is committed in advance.
          </p>
        </div>
      </div>
    </div>
  );
}

/** The dashed spokes, drawn behind the nodes on wide layouts only. */
function Spokes() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {[
        ['M26,16 L44,46', MODULES[0].tone],
        ['M74,16 L56,46', MODULES[1].tone],
        ['M26,84 L44,54', MODULES[2].tone],
        ['M74,84 L56,54', MODULES[3].tone],
      ].map(([d, tone]) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={tone}
          strokeWidth="0.45"
          strokeDasharray="2.2 2.2"
          opacity="0.6"
        />
      ))}
    </svg>
  );
}

function Sat({
  m,
  badge,
  side,
}: {
  m: (typeof MODULES)[number];
  badge: string;
  side: 'left' | 'right';
}) {
  return (
    <article
      className="relative z-10 rounded-lg px-3.5 py-3"
      style={{
        background: 'var(--surface-1)',
        border: `1px solid ${m.tone}`,
        boxShadow: `inset 0 0 26px -18px ${m.tone}`,
      }}
    >
      <div className={`flex items-center gap-2.5 ${side === 'right' ? 'sm:flex-row-reverse' : ''}`}>
        <span
          className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full font-mono text-[9.5px] font-bold"
          style={{ border: `1px solid ${m.tone}`, color: m.tone }}
          aria-hidden="true"
        >
          {badge}
        </span>
        <div className={`min-w-0 flex-1 ${side === 'right' ? 'sm:text-right' : ''}`}>
          <h4 className="text-[13px] font-semibold leading-tight">{m.name}</h4>
          <p className="mt-0.5 font-mono text-[9px] text-ink-muted">
            {m.reads} · weight {m.weight}%
          </p>
        </div>
      </div>
    </article>
  );
}
