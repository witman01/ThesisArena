'use client';

import { useState } from 'react';
import {
  COHORTS,
  COHORT_LABELS,
  TIMEFRAMES,
  type Cohort,
  type TermStructure,
  type Timeframe,
} from '@/lib/types';
import { usd } from '@/lib/format';

/**
 * Flow term-structure: net flow per cohort across six horizons.
 *
 * Form is small multiples of diverging bars. The job is polarity (above or
 * below a zero baseline) per cohort, so the colour job is diverging — green
 * inflow, red outflow, baseline as the neutral midpoint. Faceting by cohort
 * avoids seating six categorical series in one frame, which no palette can
 * keep colourblind-safe.
 *
 * Each panel is scaled to its own peak so the *shape* stays legible; the peak
 * is direct-laballed so magnitude is never implied by bar height across panels.
 */

const PANEL_H = 64;
const BAR_MAX = 18;

export function TermStructureCard({ data }: { data: TermStructure }) {
  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b px-5 py-4">
        <div className="min-w-0 flex-1 basis-56">
          <h3 className="text-[14px] font-semibold">Flow term structure</h3>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">
            Shape shows whether positioning is building or unwinding.
          </p>
        </div>
        <Legend />
      </header>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {COHORTS.map((c) => (
          <CohortPanel key={c} cohort={c} series={data[c]} />
        ))}
      </div>
    </section>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-wider text-ink-muted">
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-2.5 rounded-sm"
          style={{ background: 'var(--pos)' }}
          aria-hidden="true"
        />
        Inflow
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-2.5 rounded-sm"
          style={{ background: 'var(--neg)' }}
          aria-hidden="true"
        />
        Outflow
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true">·</span>
        Not reported
      </span>
    </div>
  );
}

function CohortPanel({
  cohort,
  series,
}: {
  cohort: Cohort;
  series: Record<Timeframe, number | null>;
}) {
  const [hover, setHover] = useState<Timeframe | null>(null);

  const present = TIMEFRAMES.filter((t) => series[t] !== null);
  const peak = Math.max(...present.map((t) => Math.abs(series[t] as number)), 1);
  const peakTf = present.find((t) => Math.abs(series[t] as number) === peak);

  const width = TIMEFRAMES.length * (BAR_MAX + 8);
  const mid = PANEL_H / 2;
  const slot = width / TIMEFRAMES.length;
  const hv = hover ? series[hover] : null;

  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate font-mono text-[10px] uppercase tracking-wider text-ink-secondary">
          {COHORT_LABELS[cohort]}
        </span>
        <span
          className="tabular shrink-0 font-mono text-[10px]"
          style={{
            color:
              hv != null
                ? hv >= 0
                  ? 'var(--pos)'
                  : 'var(--neg)'
                : 'var(--text-muted)',
          }}
        >
          {hover && hv != null
            ? `${hover} ${usd(hv)}`
            : peakTf
              ? `peak ${usd(series[peakTf] as number)}`
              : 'no data'}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${width} ${PANEL_H}`}
        className="w-full"
        style={{ height: PANEL_H }}
        role="img"
        aria-label={`${COHORT_LABELS[cohort]} net flow across ${TIMEFRAMES.join(', ')}`}
        onMouseLeave={() => setHover(null)}
      >
        <line
          x1={0}
          y1={mid}
          x2={width}
          y2={mid}
          stroke="var(--surface-3)"
          strokeWidth={1}
        />

        {TIMEFRAMES.map((tf, i) => {
          const v = series[tf];
          const cx = i * slot + slot / 2;

          // Documented gap: fresh-wallet flows exist only on 1d and 7d.
          if (v === null) {
            return (
              <g key={tf}>
                <rect
                  x={i * slot}
                  y={0}
                  width={slot}
                  height={PANEL_H}
                  fill="transparent"
                  onMouseEnter={() => setHover(tf)}
                />
                <circle cx={cx} cy={mid} r={1} fill="var(--text-muted)" opacity={0.5} />
              </g>
            );
          }

          const h = (Math.abs(v) / peak) * (mid - 5);
          const up = v >= 0;
          const on = hover === tf;

          return (
            <g key={tf}>
              <rect
                x={i * slot}
                y={0}
                width={slot}
                height={PANEL_H}
                fill="transparent"
                onMouseEnter={() => setHover(tf)}
              />
              <rect
                x={cx - BAR_MAX / 2}
                y={up ? mid - h : mid}
                width={BAR_MAX}
                height={Math.max(h, 1)}
                rx={3}
                fill={up ? 'var(--pos)' : 'var(--neg)'}
                opacity={hover && !on ? 0.4 : 1}
                style={{ transition: 'opacity 120ms' }}
              />
              {/* Square the end that meets the baseline */}
              <rect
                x={cx - BAR_MAX / 2}
                y={up ? mid - 3 : mid}
                width={BAR_MAX}
                height={3}
                fill={up ? 'var(--pos)' : 'var(--neg)'}
                opacity={hover && !on ? 0.4 : 1}
              />
            </g>
          );
        })}
      </svg>

      {/* Grid columns mirror the SVG's equal slots so each label sits under
          its own bar — justify-between would drift them off by half a slot. */}
      <div
        className="mt-1 grid font-mono text-[8px] text-ink-muted"
        style={{
          gridTemplateColumns: `repeat(${TIMEFRAMES.length}, minmax(0, 1fr))`,
        }}
      >
        {TIMEFRAMES.map((tf) => (
          <span
            key={tf}
            className="text-center"
            style={{ color: hover === tf ? 'var(--text-secondary)' : undefined }}
          >
            {tf}
          </span>
        ))}
      </div>
    </figure>
  );
}
