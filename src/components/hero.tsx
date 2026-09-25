'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CoinIcon } from './coin';

/**
 * The hero.
 *
 * When real investigations exist it cycles through them. When none do, it
 * states the positioning and says the arena is empty. It never displays a
 * sample thesis or a sample score dressed as live activity.
 */

export interface HeroItem {
  id: string;
  statement: string;
  symbol: string;
  chain: string;
  /**
   * Carried so the mark can be resolved.
   *
   * Without it the pill passed a bare ticker, which only resolves for the
   * handful of symbols with a canonical contract built in. Every other token
   * fell back to a monogram, which was invisible while the newest
   * investigation happened to be a major and obvious the moment it was not.
   */
  address: string;
  score: number;
  status: string;
}

const HOLD_MS = 2600;
const OUT_MS = 260;

/**
 * The rotating headings.
 *
 * These are the product's own claims about what it does — copy, not data. They
 * always rotate, including for a first-time visitor with nothing on file, so
 * the hero explains the idea rather than depending on prior activity.
 */
const HEADINGS: { lead: string; accent: string }[] = [
  { lead: 'Every other tool tells you why you’re right.', accent: 'ThesisArena finds out if you are.' },
  { lead: 'State what you believe.', accent: 'We commit to what would prove you wrong.' },
  { lead: 'A thesis is only worth', accent: 'as much as its exit condition.' },
  { lead: 'We pick the conditions that break it', accent: 'before we look at the evidence.' },
  { lead: 'Confirmation is easy.', accent: 'Stress-testing is the work.' },
  { lead: 'Four modules. Live on-chain data.', accent: 'One question: what would make this wrong?' },
  { lead: 'Your thesis gets a fair trial', accent: 'and a hostile cross-examination.' },
  { lead: 'Conviction is cheap.', accent: 'Evidence has a price, and we show it.' },
  { lead: 'Not a price prediction.', accent: 'A test you agreed to in advance.' },
  { lead: 'Find out you were wrong from the data', accent: 'rather than from your PnL.' },
];

const STATUS_TONE: Record<string, string> = {
  SUPPORTED: 'var(--accent)',
  CHALLENGED: 'var(--bearish)',
  MIXED: 'var(--neutral)',
  UNDER_STRESS: 'var(--cautious)',
  INVALIDATED: 'var(--bearish)',
};

export function Hero({
  rotation = [],
  investigationCount = 0,
  liveCalls = 0,
}: {
  rotation?: HeroItem[];
  investigationCount?: number;
  liveCalls?: number;
}) {
  const [i, setI] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const paused = useRef(false);

  const count = HEADINGS.length;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let out: ReturnType<typeof setTimeout>;
    const cycle = setInterval(() => {
      if (paused.current) return;
      setLeaving(true);
      out = setTimeout(() => {
        setI((n) => (n + 1) % count);
        setLeaving(false);
      }, OUT_MS);
    }, HOLD_MS);

    return () => {
      clearInterval(cycle);
      clearTimeout(out);
    };
  }, [count]);

  const heading = HEADINGS[i % HEADINGS.length];
  const latest = rotation[0];

  return (
    <section
      className="relative isolate overflow-hidden border-b"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      <HeroBackdrop />

      <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_440px] lg:py-24">
        <div className="min-w-0">
          <div className="mt-1 min-h-[168px] sm:min-h-[206px] lg:min-h-[226px]">
            <div key={i} className={leaving ? 'line-out' : 'line-in'}>
              <h1 className="text-balance text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[46px] lg:text-[54px]">
                {heading.lead}
              </h1>
              <p
                className="mt-2 text-balance text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[46px] lg:text-[54px]"
                style={{ color: 'var(--accent)' }}
              >
                {heading.accent}
              </p>
            </div>
          </div>

          <p className="mt-6 max-w-[58ch] text-[15px] leading-relaxed text-ink-secondary">
            State what you believe about a token. Four deterministic modules
            interrogate it against live on-chain data, then commit to the exact
            conditions that would prove it wrong, and keep checking them.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/new" className="cta group relative inline-flex">
              <span className="cta-halo" aria-hidden="true" />
              <span className="cta-face">
                Put a thesis on trial
                <span className="cta-arrow" aria-hidden="true">
                  →
                </span>
              </span>
            </Link>

            {latest && (
              <Link
                href={`/thesis/${latest.id}`}
                className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px] transition-colors hover:text-ink"
                style={{ border: '1px solid var(--border-neutral)', color: 'var(--text-secondary)' }}
              >
                <CoinIcon
                  symbol={latest.symbol}
                  size={16}
                  chain={latest.chain}
                  address={latest.address}
                />
                Latest: {latest.symbol}
                <span className="tabular font-semibold" style={{ color: STATUS_TONE[latest.status] }}>
                  {latest.score}/100
                </span>
              </Link>
            )}

            {investigationCount > 0 && (
              <span className="font-mono text-[11.5px] text-ink-muted">
                <span className="tabular font-semibold text-ink">{investigationCount}</span>{' '}
                investigation{investigationCount === 1 ? '' : 's'} ·{' '}
                <span className="tabular font-semibold text-ink">{liveCalls}</span> live calls
              </span>
            )}
          </div>

          {count > 1 && (
            <div className="mt-8 flex items-center gap-2" aria-hidden="true">
              {Array.from({ length: count }).map((_, n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setLeaving(false);
                    setI(n);
                  }}
                  aria-label={`Show statement ${n + 1}`}
                  className="grid shrink-0 place-items-center py-3"
                  style={{ width: n === i ? 38 : 26 }}
                >
                  {/* The visible bar stays small; the button around it is a
                      real target. A 10x4 pixel control is not tappable. */}
                  <span
                    className="block h-1 rounded-full transition-all duration-300"
                    style={{
                      width: n === i ? 28 : 10,
                      background: n === i ? 'var(--accent)' : 'var(--surface-3)',
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="hidden lg:block">
          <ArenaOrb />
        </div>
      </div>
    </section>
  );
}

function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <div className="grid-texture absolute inset-0 opacity-[0.55]" />
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, transparent 40%, var(--bg) 100%)',
        }}
      />
      <div
        className="float-slow absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(0,224,138,0.16), transparent 68%)',
        }}
      />
      <div
        className="float-slower absolute -right-32 top-10 h-[620px] w-[620px] rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(0,168,102,0.20), transparent 66%)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--border-strong), transparent)',
        }}
      />
    </div>
  );
}

/*
 * Decorative only. The orbiting marks make no claim about live data.
 *
 * Every symbol here resolves to a real logo, either a curated local file or a
 * canonical contract the icon proxy can look up. Adding one that resolves to
 * neither would put a lettered monogram in the hero, which looks like a
 * missing asset rather than a design choice.
 */
const RINGS = [
  {
    r: 232,
    dur: 52,
    size: 36,
    coins: ['BTC', 'ETH', 'SOL', 'USDT', 'BNB', 'LINK', 'GOOGL'],
  },
  {
    r: 180,
    dur: 42,
    size: 33,
    coins: ['USDC', 'ARB', 'WBTC', 'HYPE', 'UNI', 'PEPE'],
    rev: true,
  },
  { r: 130, dur: 32, size: 30, coins: ['ZEC', 'LTC', 'ARC', 'AAVE', 'DOGE'] },
  { r: 82, dur: 22, size: 26, coins: ['JUP', 'SHIB', 'MKR'], rev: true },
];

const ORBIT = RINGS.flatMap((ring) =>
  ring.coins.map((symbol, i) => ({
    symbol,
    r: ring.r,
    a0: (360 / ring.coins.length) * i,
    dur: ring.dur,
    size: ring.size,
    rev: ring.rev,
  })),
);

/**
 * Decorative orbit. A fixed set of majors — the investigated token is
 * deliberately never placed here, so the art makes no claim about the data.
 */
function ArenaOrb() {
  const active = 'BTC';
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[440px]">
      <svg
        viewBox="0 0 440 440"
        fill="none"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <radialGradient id="ta-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00e08a" stopOpacity="0.30" />
            <stop offset="62%" stopColor="#00e08a" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#00e08a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="220" cy="220" r="215" fill="url(#ta-core)" />
        {RINGS.map((ring, n) => (
          <circle
            key={ring.r}
            cx="220"
            cy="220"
            r={ring.r}
            stroke="#00e08a"
            strokeOpacity={0.2 - n * 0.035}
            strokeWidth="1"
            strokeDasharray={n % 2 ? '4 7' : undefined}
          />
        ))}
      </svg>

      <div
        className="absolute inset-0 grid place-items-center"
        style={{ containerType: 'inline-size' }}
      >
        {ORBIT.map((o) => {
          const on = o.symbol === active;
          return (
            <span
              key={`${o.r}-${o.symbol}`}
              className={`orbit absolute grid place-items-center ${o.rev ? 'orbit-rev' : ''}`}
              style={
                {
                  '--r': `${((o.r / 440) * 100).toFixed(2)}cqw`,
                  '--a0': `${o.a0}deg`,
                  '--dur': `${o.dur}s`,
                  width: o.size,
                  height: o.size,
                  filter: on
                    ? 'drop-shadow(0 0 10px rgba(0,224,138,0.9))'
                    : 'drop-shadow(0 4px 10px rgba(0,0,0,0.65))',
                  opacity: on ? 1 : 0.88,
                  transition: 'filter 400ms, opacity 400ms',
                } as React.CSSProperties
              }
            >
              <CoinIcon symbol={o.symbol} size={o.size} />
            </span>
          );
        })}
      </div>

      <div className="absolute inset-0 grid place-items-center">
        <span
          key={active}
          className="float-slow line-in grid place-items-center"
          style={{ filter: 'drop-shadow(0 0 26px rgba(0,224,138,0.55))' }}
        >
          <CoinIcon symbol={active} size={84} />
        </span>
      </div>
    </div>
  );
}
