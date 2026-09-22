import type {
  IndependentSource,
  Provenance,
  Tripwire,
  TripwireStatus,
} from '@/lib/types';
import { metricValue, sparkPoints } from '@/lib/format';

/* -------------------------------------------------------------------------
 * Provenance
 *
 * Every rendered claim carries a marker bound to the call that produced it.
 * Restricted-class sources are flagged so it is visible that the figure is a
 * derived score rather than a redistributed value.
 * ---------------------------------------------------------------------- */

const CLASS_NOTE: Record<Provenance['redistribution'], string> = {
  allowed: 'Redistributable',
  attribution: 'Redistributable with attribution to Nansen',
  restricted: 'Restricted — feeds a composite score only, never shown raw',
  prohibited: 'Prohibited — internal use only, never rendered',
};

export function ProvenanceDot({ provenance: p }: { provenance: Provenance }) {
  const derived = p.redistribution === 'restricted' || p.redistribution === 'prohibited';

  return (
    <span
      className="ml-1.5 inline-flex translate-y-[-1px] items-center gap-1 align-middle"
      title={`${p.endpoint} · ${p.field}\nrequest ${p.requestId} · ${p.creditsUsed} credit${p.creditsUsed === 1 ? '' : 's'}\n${CLASS_NOTE[p.redistribution]}`}
    >
      <span
        className="inline-block h-[5px] w-[5px] rounded-full"
        style={{
          background: derived ? 'var(--cautious)' : 'var(--accent-dim)',
        }}
        aria-hidden="true"
      />
      {derived && (
        <span
          className="font-mono text-[8px] uppercase tracking-wider"
          style={{ color: 'var(--cautious)' }}
        >
          derived
        </span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------
 * Invalidation — the tripwire board
 * ---------------------------------------------------------------------- */

const STATUS: Record<
  TripwireStatus,
  { label: string; glyph: string; color: string }
> = {
  holding: { label: 'Holding', glyph: '●', color: 'var(--bullish)' },
  stressed: { label: 'Stressed', glyph: '▲', color: 'var(--cautious)' },
  tripped: { label: 'Tripped', glyph: '✕', color: 'var(--bearish)' },
};

const ORDER = { tripped: 0, stressed: 1, holding: 2 } as const;

export function InvalidationPanel({ tripwires }: { tripwires: Tripwire[] }) {
  const sorted = [...tripwires].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || b.proximity - a.proximity,
  );
  const tripped = tripwires.filter((t) => t.status === 'tripped').length;
  const stressed = tripwires.filter((t) => t.status === 'stressed').length;

  return (
    <section className="card overflow-hidden">
      {/* The surrounding Section carries the title; this header only tallies. */}
      <header
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-5 py-3"
        style={{ background: 'var(--surface-2)' }}
      >
        <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          {tripwires.length} conditions monitored
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
          <Tally n={tripwires.length - tripped - stressed} {...STATUS.holding} />
          <Tally n={stressed} {...STATUS.stressed} />
          <Tally n={tripped} {...STATUS.tripped} />
        </div>
      </header>

      <ul className="divide-y">
        {sorted.map((t) => (
          <TripwireRow key={t.id} tripwire={t} />
        ))}
      </ul>
    </section>
  );
}

function Tally({
  n,
  label,
  glyph,
  color,
}: {
  n: number;
  label: string;
  glyph: string;
  color: string;
}) {
  return (
    <span
      className="flex items-center gap-1"
      style={{ color: n > 0 ? color : 'var(--text-muted)' }}
    >
      <span aria-hidden="true">{glyph}</span>
      <span className="tabular">{n}</span>
      <span className="text-ink-muted">{label.toLowerCase()}</span>
    </span>
  );
}

function TripwireRow({ tripwire: t }: { tripwire: Tripwire }) {
  const s = STATUS[t.status];
  const condition = `${t.metric.field} ${t.comparator} ${metricValue(t.threshold, t.metric.unit)}`;

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 basis-64 text-[13px] leading-snug">
          {t.claim}
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className="font-mono text-[9px] font-semibold uppercase tracking-wider"
            style={{
              color:
                t.severity === 'fatal'
                  ? 'var(--bearish)'
                  : t.severity === 'major'
                    ? 'var(--cautious)'
                    : 'var(--text-muted)',
            }}
          >
            {t.severity}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em]"
            style={{
              color: s.color,
              background: `color-mix(in srgb, ${s.color} 13%, transparent)`,
              border: `1px solid color-mix(in srgb, ${s.color} 30%, transparent)`,
            }}
          >
            <span aria-hidden="true">{s.glyph}</span>
            {s.label}
          </span>
        </div>
      </div>

      <p className="mt-1.5 font-mono text-[10px] text-ink-muted">
        breaks if{' '}
        <span className="tabular" style={{ color: s.color }}>
          {condition}
        </span>{' '}
        for {t.sustain}
      </p>

      <div className="mt-3 flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: 'var(--surface-3)' }}
            role="meter"
            aria-valuenow={Math.round(t.proximity * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${t.claim} — distance to threshold`}
          >
            <div
              className="bar-grow h-full rounded-full"
              style={{ width: `${t.proximity * 100}%`, background: s.color }}
            />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-muted">
            <span>
              now{' '}
              <span className="tabular text-ink-secondary">
                {metricValue(t.currentValue, t.metric.unit)}
              </span>
            </span>
            <span>
              threshold{' '}
              <span className="tabular text-ink-secondary">
                {metricValue(t.threshold, t.metric.unit)}
              </span>
            </span>
          </div>
        </div>

        <Spark values={t.history} color={s.color} />
      </div>

      <div className="mt-2 font-mono text-[10px] text-ink-muted">
        {t.metric.endpoint}
        <ProvenanceDot provenance={t.provenance} />
        {/* A derived metric names its inputs, so the condition stays
            checkable against the endpoint rather than looking invented. */}
        {t.metric.derivedFrom && (
          <span className="block mt-1">
            derived from {t.metric.derivedFrom.join(', ')}
          </span>
        )}
      </div>
    </li>
  );
}

function Spark({ values, color }: { values: number[]; color: string }) {
  const w = 76;
  const h = 24;
  const pts = sparkPoints(values, w, h, 2);
  const last = pts.split(' ').at(-1)!.split(',').map(Number);

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0 overflow-visible"
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={2.5}
        fill={color}
        stroke="var(--surface-1)"
        strokeWidth={1.5}
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------
 * Independent corroboration — required for ToS "meaningfully combined"
 * ---------------------------------------------------------------------- */

export function IndependentPanel({ sources }: { sources: IndependentSource[] }) {
  return (
    <section className="card overflow-hidden">
      <header className="border-b px-4 py-3">
        <h2 className="text-[13px] font-semibold">Independent check</h2>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          Sources outside Nansen, for corroboration.
        </p>
      </header>
      <ul className="divide-y">
        {sources.map((s, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] text-ink-secondary">{s.metric}</p>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
                className="font-mono text-[10px] text-ink-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-ink-secondary"
              >
                {s.name}
              </a>
            </div>
            <span className="tabular shrink-0 font-mono text-[12px] font-medium">
              {s.value}
            </span>
            <Agreement agrees={s.agrees} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Agreement({ agrees }: { agrees: boolean | null }) {
  const cfg =
    agrees === null
      ? { c: 'var(--neutral)', g: '·', l: 'Neutral' }
      : agrees
        ? { c: 'var(--bullish)', g: '▲', l: 'Agrees' }
        : { c: 'var(--bearish)', g: '▼', l: 'Differs' };

  return (
    <span
      className="flex w-[54px] shrink-0 items-center gap-1 font-mono text-[9px] uppercase tracking-wider"
      style={{ color: cfg.c }}
    >
      <span aria-hidden="true">{cfg.g}</span>
      {cfg.l}
    </span>
  );
}
