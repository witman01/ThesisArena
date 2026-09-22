'use client';

import { useEffect, useState } from 'react';
import type { AssetMeta } from '@/lib/assets';
import { compactUsd, priceLabel } from '@/lib/assets';
import { CoinIcon } from './coin';

/**
 * The two screens between "launch" and the verdict.
 *
 * Both are driven by real engine events — module completion and individual
 * Nansen requests — rather than a timer. What you see happening is what is
 * actually happening.
 */

export const AGENTS = [
  { id: 'smart-money', name: 'Smart Money', task: 'Reading cohort flow across six horizons', calls: 6 },
  { id: 'flow-intelligence', name: 'Capital Flow', task: 'Measuring net token movement', calls: 1 },
  { id: 'holder-concentration', name: 'Holder Concentration', task: 'Examining trader distribution', calls: 1 },
  { id: 'pattern-memory', name: 'Pattern Memory', task: 'Matching historical analogues', calls: 1 },
] as const;

export interface CallEvent {
  endpoint: string;
  credits: number;
  cached: boolean;
  ms: number;
}

/* -------------------------------------------------------------------------
 * Stage 1 — verification
 * ---------------------------------------------------------------------- */

export function Preparing({
  asset,
  statement,
  onBegin,
}: {
  asset: AssetMeta;
  statement: string;
  onBegin: () => void;
}) {
  const [step, setStep] = useState(0);

  // Each node resolves something concrete and hands its result to the next,
  // so the sequence reads as a pipeline rather than a list of ticks.
  const nodes = [
    {
      key: 'thesis',
      title: 'Parsing thesis',
      done: `${statement.trim().split(/\s+/).length} words \u00b7 claim isolated`,
      out: 'ticker',
    },
    {
      key: 'asset',
      title: 'Resolving ticker',
      done: `${asset.symbol} \u2014 ${asset.name}`,
      out: 'contract',
    },
    {
      key: 'contract',
      title: 'Verifying contract',
      done: `${asset.address.slice(0, 8)}\u2026${asset.address.slice(-6)}`,
      out: 'chain',
      mono: true,
    },
    {
      key: 'chain',
      title: 'Confirming chain',
      done: asset.chainLabel,
      out: 'coverage',
    },
    {
      key: 'coverage',
      title: 'Checking Nansen coverage',
      done: asset.isNative
        ? 'Native asset \u2014 token-level flows unavailable'
        : 'Spot contract \u2014 all four modules available',
      warn: asset.isNative,
      out: null,
    },
  ];

  useEffect(() => {
    if (step >= nodes.length) return;
    const t = setTimeout(() => setStep((n) => n + 1), 420);
    return () => clearTimeout(t);
  }, [step, nodes.length]);

  const ready = step >= nodes.length;

  return (
    <div className="mx-auto max-w-[640px] px-5 py-14 sm:py-20">
      <p className="text-center font-mono text-[11px] tracking-[0.2em] text-ink-muted">
        RESOLVING TARGET
      </p>
      <h1 className="mt-4 text-center text-[24px] font-semibold leading-snug tracking-tight sm:text-[28px]">
        Building the investigation
      </h1>

      <div
        className="mt-8 flex items-center gap-4 rounded-xl px-5 py-4"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-strong)' }}
      >
        <CoinIcon
          symbol={asset.symbol}
          size={40}
          chain={asset.chain}
          address={asset.address}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[17px] font-semibold">{asset.symbol}</span>
            <span className="text-[13px] text-ink-muted">{asset.chainLabel}</span>
          </div>
          <p className="tabular mt-0.5 font-mono text-[11.5px] text-ink-muted">
            {asset.priceUsd > 0 ? priceLabel(asset.priceUsd) : 'Unpriced'}
            {asset.marketCapUsd > 0 &&
              ` \u00b7 ${compactUsd(asset.canonicalMarketCap ?? asset.marketCapUsd)} ${
                asset.isNative && !asset.canonicalMarketCap ? 'wrapped supply' : 'mcap'
              }`}
          </p>
        </div>
      </div>

      {/* The pipeline. A rail connects each node to the next and fills as the
          step completes, so the hand-off between stages is visible. */}
      <ol className="relative mt-7">
        {nodes.map((nd, idx) => {
          const done = idx < step;
          const active = idx === step;
          const color = nd.warn ? 'var(--cautious)' : 'var(--accent)';

          return (
            <li key={nd.key} className="relative flex gap-4 pb-5 last:pb-0">
              {idx < nodes.length - 1 && (
                <span
                  className="absolute left-[13px] top-7 w-[2px]"
                  style={{
                    height: 'calc(100% - 12px)',
                    background: done ? color : 'var(--surface-3)',
                    transition: 'background 500ms',
                  }}
                  aria-hidden="true"
                />
              )}

              <span
                className="relative z-10 grid h-[27px] w-[27px] shrink-0 place-items-center rounded-full transition-all duration-300"
                style={{
                  background: done ? color : 'var(--surface-2)',
                  border: `1px solid ${
                    done ? color : active ? 'var(--border-strong)' : 'var(--border-neutral)'
                  }`,
                  boxShadow: active
                    ? `0 0 0 4px color-mix(in srgb, ${color} 18%, transparent)`
                    : undefined,
                }}
              >
                {done ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#04120c"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {nd.warn ? <path d="M12 8v5M12 17h.01" /> : <path d="M20 6L9 17l-5-5" />}
                  </svg>
                ) : active ? (
                  <span
                    className="h-[9px] w-[9px] animate-ping rounded-full"
                    style={{ background: 'var(--accent)' }}
                  />
                ) : (
                  <span
                    className="h-[5px] w-[5px] rounded-full"
                    style={{ background: 'var(--text-muted)' }}
                  />
                )}
              </span>

              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className="text-[13.5px] font-medium transition-colors"
                  style={{
                    color: done || active ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {nd.title}
                  {active && <span className="ml-1.5 text-ink-muted">\u2026</span>}
                </p>

                {done && (
                  <p
                    className={`mt-1 text-[11.5px] ${nd.mono ? 'font-mono' : ''}`}
                    style={{ color: nd.warn ? 'var(--cautious)' : 'var(--text-secondary)' }}
                  >
                    {nd.done}
                    {nd.out && <span className="text-ink-muted"> \u2192 {nd.out}</span>}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div
        className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-neutral)' }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
          Planned cost
        </span>
        <span className="tabular font-mono text-[12.5px]">
          <span style={{ color: 'var(--accent)' }}>
            {asset.isNative ? 8 : 9} requests
          </span>
          <span className="text-ink-muted"> \u00b7 {asset.isNative ? 8 : 9} credits</span>
        </span>
      </div>

      <button
        type="button"
        onClick={onBegin}
        disabled={!ready}
        className="mt-8 w-full rounded-xl py-3.5 text-[14px] font-semibold transition-opacity disabled:opacity-30"
        style={{ background: 'var(--accent)', color: '#04120c' }}
      >
        {ready ? 'Begin investigation' : 'Resolving\u2026'}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Stage 2 — investigating
 * ---------------------------------------------------------------------- */

export interface AgentProgress {
  state: 'waiting' | 'running' | 'done';
  evidencePoints: number;
}

export function Investigating({
  asset,
  progress,
  calls,
  elapsed,
}: {
  asset: AssetMeta;
  progress: Record<string, AgentProgress>;
  calls: CallEvent[];
  elapsed: string;
}) {
  const finished = AGENTS.filter((a) => progress[a.id]?.state === 'done').length;
  const totalCalls = AGENTS.reduce((n, a) => n + a.calls, 0);
  const credits = calls.reduce((n, c) => n + c.credits, 0);
  const pct = Math.min(100, (calls.length / totalCalls) * 100);

  return (
    <div className="mx-auto max-w-[760px] px-5 py-14 sm:py-16">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2.5">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <span
            className="font-mono text-[11px] tracking-[0.18em]"
            style={{ color: 'var(--accent)' }}
          >
            CROSS-EXAMINING THE THESIS
          </span>
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <CoinIcon
            symbol={asset.symbol}
            size={32}
            chain={asset.chain}
            address={asset.address}
          />
          <span className="text-[22px] font-semibold tracking-tight">
            {asset.symbol}
          </span>
          <span className="text-[14px] text-ink-muted">/ {asset.chainLabel}</span>
        </div>
      </div>

      {/* Overall progress, measured in real requests completed. */}
      <div className="mt-8">
        <div
          className="h-1 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--surface-3)' }}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Investigation progress"
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%`, background: 'var(--accent)' }}
          />
        </div>
        <div className="mt-2.5 flex flex-wrap justify-between gap-3 font-mono text-[11px] text-ink-muted">
          <span className="tabular">
            {finished}/{AGENTS.length} modules · {calls.length}/{totalCalls} requests
          </span>
          <span className="tabular">
            {credits} credits · {elapsed}
          </span>
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-2">
          {AGENTS.map((a) => {
            const p = progress[a.id] ?? { state: 'waiting', evidencePoints: 0 };
            const on = p.state === 'running';
            const complete = p.state === 'done';

            return (
              <div
                key={a.id}
                className="flex items-center gap-3.5 rounded-xl px-4 py-3.5 transition-all duration-300"
                style={{
                  background: on ? 'var(--surface-2)' : 'var(--surface-1)',
                  border: `1px solid ${on ? 'var(--border-strong)' : 'var(--border-neutral)'}`,
                  opacity: p.state === 'waiting' ? 0.45 : 1,
                }}
              >
                {complete ? <Tick /> : on ? <Spinner /> : <Pending />}

                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium">{a.name}</p>
                  <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">
                    {complete
                      ? `${p.evidencePoints} evidence points`
                      : on
                        ? `${a.task}…`
                        : 'Queued'}
                  </p>
                </div>

                {complete && (
                  <span
                    className="tabular font-mono text-[15px] font-semibold"
                    style={{ color: 'var(--accent)' }}
                  >
                    {p.evidencePoints}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* The actual requests, as they land. */}
        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-neutral)',
          }}
        >
          <div
            className="border-b px-3.5 py-2.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted"
            style={{ background: 'var(--surface-2)' }}
          >
            Nansen requests
          </div>
          <ul className="max-h-[260px] overflow-y-auto">
            {calls.length === 0 && (
              <li className="px-3.5 py-3 font-mono text-[10.5px] text-ink-muted">
                Waiting…
              </li>
            )}
            {calls
              .slice()
              .reverse()
              .map((c, i) => (
                <li
                  key={calls.length - i}
                  className="flex items-center justify-between gap-2 px-3.5 py-2"
                  style={{ borderTop: i ? '1px solid var(--border-neutral)' : undefined }}
                >
                  <span className="truncate font-mono text-[10px] text-ink-secondary">
                    {c.endpoint}
                  </span>
                  <span
                    className="tabular shrink-0 font-mono text-[9.5px]"
                    style={{
                      color: c.cached ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    {c.cached ? 'cached' : `${c.ms}ms`}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Bits
 * ---------------------------------------------------------------------- */

function Tick({ warn = false }: { warn?: boolean }) {
  return (
    <span
      className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full"
      style={{ background: warn ? 'var(--cautious)' : 'var(--accent)' }}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#04120c"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {warn ? <path d="M12 8v5M12 17h.01" /> : <path d="M20 6L9 17l-5-5" />}
      </svg>
    </span>
  );
}

function Spinner() {
  return (
    <span
      className="h-[18px] w-[18px] shrink-0 animate-spin rounded-full"
      style={{
        border: '2px solid var(--surface-3)',
        borderTopColor: 'var(--accent)',
      }}
      aria-hidden="true"
    />
  );
}

function Pending() {
  return (
    <span
      className="h-[18px] w-[18px] shrink-0 rounded-full"
      style={{ border: '1.5px solid var(--border-neutral)' }}
      aria-hidden="true"
    />
  );
}
