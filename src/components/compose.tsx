'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { compactUsd, detectSymbol, priceLabel, type AssetMeta } from '@/lib/assets';
import { signedPct } from '@/lib/format';
import { CoinIcon } from './coin';

const EXAMPLES = [
  'Smart Money is accumulating $SOL while retail is dumping.',
  '$JUP breaks out this week because accumulation has been building.',
  'The $HYPE rally is retail-driven and fades within 72 hours.',
  '$PEPE is being distributed into strength by early holders.',
  '$ARB recovery is driven by real users, not incentive farming.',
  '$WIF has topped. Late buyers are the only source of demand.',
  '$USDC supply growth signals a rotation back into risk.',
  '$BONK is accumulating quietly before a move.',
];

/** Quick picks for an empty search box, so discovery does not require typing. */
const POPULAR = ['SOL', 'ETH', 'BTC', 'USDC', 'JUP', 'HYPE', 'ARB', 'PEPE', 'WIF', 'BNB', 'LINK', 'DOGE'];

/**
 * Thesis entry.
 *
 * The statement stays free text — the whole point is that a user writes what
 * they believe — but the asset is resolved to a concrete contract, because
 * every downstream call needs a chain and an address.
 */
export function Compose({
  onLaunch,
}: {
  onLaunch: (statement: string, asset: AssetMeta) => void;
}) {
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<AssetMeta | null>(null);
  /** The statement the user last dismissed a detection for. */
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const [results, setResults] = useState<AssetMeta[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);

  // Live search across everything Nansen indexes. The endpoint costs 0
  // credits, so this can run on every keystroke — debounced only to be kind
  // to the network, not to the budget.
  useEffect(() => {
    const q = query.trim();
    const ctrl = new AbortController();

    // Every state write happens inside the debounce callback, never
    // synchronously in the effect body.
    const t = setTimeout(async () => {
      if (!q) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const j = (await r.json()) as { assets?: AssetMeta[]; error?: string };
        // An upstream failure is not the same as "no such token", and showing
        // "No tokens matched" for one sends the user looking for a typo that
        // is not there.
        setSearchError(!r.ok || Boolean(j.error));
        setResults(j.assets ?? []);
      } catch {
        // Abort leaves the previous results alone.
      } finally {
        setSearching(false);
      }
    }, 220);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const [detected, setDetected] = useState<AssetMeta | null>(null);

  // The ticker is read out of the sentence, then resolved against live Nansen
  // data. There is no local price table — a stale one is worse than none.
  const symbol = useMemo(() => detectSymbol(text), [text]);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (!symbol) {
        setDetected(null);
        return;
      }
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(symbol)}`, {
          signal: ctrl.signal,
        });
        const j = (await r.json()) as { assets?: AssetMeta[] };
        const hit = j.assets?.find(
          (a) => a.symbol.toUpperCase() === symbol.toUpperCase(),
        );
        setDetected(hit ?? null);
      } catch {
        // Leave the previous detection in place on abort or network failure.
      }
    }, 300);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [symbol]);

  const asset = picked ?? (dismissedFor === text ? null : detected);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const ready = text.trim().length > 12 && asset !== null;

  function pick(a: AssetMeta) {
    setPicked(a);
    setDismissedFor(null);
    setQuery('');
    setOpen(false);
  }

  function clearAsset() {
    setPicked(null);
    setDismissedFor(text);
    setOpen(true);
  }

  return (
    <div className="w-full">
      {/* Statement */}
      <label
        htmlFor="statement"
        className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted"
      >
        Your thesis
      </label>
      <div
        className="mt-2.5 rounded-xl transition-colors"
        style={{
          background: 'var(--surface-1)',
          border: `1px solid ${text ? 'var(--border-strong)' : 'var(--border-neutral)'}`,
        }}
      >
        <textarea
          id="statement"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && ready) {
              onLaunch(text.trim(), asset!);
            }
          }}
          rows={3}
          spellCheck={false}
          placeholder="I think $SOL is about to break out because…"
          className="w-full resize-none bg-transparent px-4 py-3.5 text-[15px] leading-relaxed outline-none placeholder:text-ink-muted"
        />
      </div>

      <p className="mt-4 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted">
        Or start from one of these
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <li key={ex}>
            <button
              type="button"
              onClick={() => {
                setText(ex);
                setPicked(null);
                setDismissedFor(null);
              }}
              className="rounded-lg px-2.5 py-1.5 text-left text-[12px] text-ink-muted transition-colors hover:text-ink-secondary"
              style={{ border: '1px solid var(--border-neutral)' }}
            >
              {ex.length > 46 ? `${ex.slice(0, 44)}…` : ex}
            </button>
          </li>
        ))}
      </ul>

      {/* Asset */}
      <div className="mt-8" ref={boxRef}>
        <label
          htmlFor="asset"
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted"
        >
          Asset
        </label>

        {asset ? (
          <AssetCard asset={asset} onChange={clearAsset} />
        ) : (
          <div className="relative mt-2.5">
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </span>
            <input
              id="asset"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                setCursor(0);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setCursor((c) => Math.min(c + 1, results.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setCursor((c) => Math.max(c - 1, 0));
                } else if (e.key === 'Enter' && results[cursor]) {
                  e.preventDefault();
                  pick(results[cursor]);
                }
              }}
              placeholder="Search any token Nansen indexes…"
              autoComplete="off"
              className="w-full rounded-xl py-3 pl-10 pr-4 text-[14px] outline-none placeholder:text-ink-muted"
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border-neutral)',
              }}
            />

            {open && !query.trim() && (
              <div
                className="absolute z-20 mt-2 w-full rounded-xl p-3"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-neutral)',
                }}
              >
                <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted">
                  Popular
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR.map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => {
                        setQuery(sym);
                        setCursor(0);
                      }}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] transition-colors hover:text-ink"
                      style={{
                        border: '1px solid var(--border-neutral)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <CoinIcon symbol={sym} size={14} />
                      {sym}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {open && query.trim() && results.length === 0 && (
              <div
                className="absolute z-20 mt-2 w-full rounded-xl px-4 py-3 text-[12.5px] text-ink-muted"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-neutral)',
                }}
              >
                {searching
                  ? 'Searching Nansen…'
                  : searchError
                    ? 'Search is temporarily unavailable. Try again in a moment.'
                    : 'No tokens matched.'}
              </div>
            )}

            {open && results.length > 0 && (
              <ul
                className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-strong)',
                  boxShadow: '0 24px 60px -20px rgba(0,0,0,0.9)',
                }}
              >
                {results.map((a, i) => (
                  <li key={`${a.chain}-${a.symbol}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => pick(a)}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors"
                      style={{
                        background: i === cursor ? 'var(--surface-3)' : 'transparent',
                      }}
                    >
                      <CoinIcon symbol={a.symbol} size={26} chain={a.chain} address={a.address} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-medium">
                          {a.symbol}
                        </span>
                        <span className="block text-[11px] text-ink-muted">
                          {a.name} · {a.chainLabel}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="tabular block font-mono text-[12px]">
                          {a.priceUsd > 0 ? priceLabel(a.priceUsd) : '—'}
                        </span>
                        <span className="tabular block font-mono text-[10px] text-ink-muted">
                          {a.marketCapUsd > 0 ? compactUsd(a.marketCapUsd) : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!ready}
          onClick={() => ready && onLaunch(text.trim(), asset!)}
          className="rounded-xl px-5 py-3 text-[14px] font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
          style={{ background: 'var(--accent)', color: '#04120c' }}
        >
          Launch investigation
        </button>
        <span className="font-mono text-[11px] text-ink-muted">
          {ready ? '⌘↵ to launch' : 'Write a thesis and pick an asset'}
        </span>
      </div>
    </div>
  );
}

function AssetCard({
  asset: a,
  onChange,
}: {
  asset: AssetMeta;
  onChange: () => void;
}) {
  return (
    <div
      className="mt-2.5 rounded-xl p-4"
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border-strong)',
      }}
    >
      <div className="flex items-start gap-3.5">
        <CoinIcon symbol={a.symbol} size={40} chain={a.chain} address={a.address} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[17px] font-semibold">{a.symbol}</span>
            <span className="text-[13px] text-ink-muted">{a.name}</span>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-x-6 gap-y-2">
            <Field
              label="Price"
              value={a.priceUsd > 0 ? priceLabel(a.priceUsd) : 'Unpriced'}
            />
            {/* A native wrapper (wSOL, WETH) reports the WRAPPED supply, not
                the asset's market cap — wSOL is ~$1.4B against SOL's ~$66B.
                Label it for what it is rather than overstating. */}
            <Field
              label={a.isNative ? 'Wrapped supply' : 'Market cap'}
              value={
                a.canonicalMarketCap
                  ? compactUsd(a.canonicalMarketCap)
                  : a.marketCapUsd > 0
                    ? compactUsd(a.marketCapUsd)
                    : '—'
              }
            />
            {a.change24h !== 0 && (
              <Field
                label="24h"
                value={signedPct(a.change24h / 100)}
                tone={a.change24h >= 0 ? 'var(--bullish)' : 'var(--bearish)'}
              />
            )}
          </div>

          {a.priceWarning && (
            <p
              className="mt-2 text-[11px]"
              style={{ color: 'var(--cautious)' }}
              title="Nansen's price for this contract differs from the canonical asset"
            >
              ⚠ Price differs from reference — {a.priceWarning}
            </p>
          )}

          {/* Which contract was chosen, when the ticker names more than one.
              A thesis about a token on one chain is not a thesis about a
              different contract that happens to share its ticker. */}
          {a.ambiguityNote && (
            <div
              className="mt-2.5 rounded-lg px-2.5 py-2"
              style={{ background: 'var(--surface-2)' }}
            >
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--cautious)' }}>
                {a.ambiguityNote}
              </p>
              {a.alsoOn && a.alsoOn.length > 0 && (
                <p className="mt-1 font-mono text-[10px] text-ink-muted">
                  also on {a.alsoOn.map((o) => o.chainLabel).join(', ')} — press
                  Change to analyse one of those instead
                </p>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center gap-1.5">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span className="text-[12px]" style={{ color: 'var(--accent)' }}>
              {a.chainLabel}
            </span>
            <span className="font-mono text-[10.5px] text-ink-muted">
              {a.address.slice(0, 6)}…{a.address.slice(-4)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onChange}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:text-ink"
          style={{ border: '1px solid var(--border-neutral)' }}
        >
          Change
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </div>
      <div
        className="tabular mt-0.5 text-[14px] font-medium"
        style={{ color: tone }}
      >
        {value}
      </div>
    </div>
  );
}
