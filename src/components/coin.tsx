'use client';

import { useState } from 'react';

/**
 * Token marks.
 *
 * Three layers, in order: a curated local SVG for the majors, then the real
 * logo via our own /api/icon proxy, then a deterministic monogram.
 *
 * The proxy matters. Pointing an <img> straight at a third-party CDN fails
 * unpredictably — cross-origin image blocking, TLS resets, and no single
 * upstream carrying every token — which left real logos rendering as
 * monograms. Same-origin, the browser only talks to us, and the server tries
 * several upstreams and caches the winner.
 */

export const COIN_FILES = new Set([
  'btc', 'eth', 'sol', 'usdc', 'usdt', 'bnb', 'ltc', 'zec',
  'wbtc', 'hype', 'arc', 'googl', 'jup',
]);

/**
 * Canonical contracts for majors, so a caller that has only a ticker can
 * still reach the real logo through the proxy.
 *
 * Two problems shared one cause: the drawn ARB mark was an approximation
 * rather than the brand asset, and the verdict screen rendered a monogram
 * because it passed a symbol with no chain or address for the proxy to use.
 */
const CANONICAL: Record<string, { chain: string; address: string }> = {
  arb: { chain: 'arbitrum', address: '0x912ce59144191c1204e64559fe8253a0e49e6548' },
  link: { chain: 'ethereum', address: '0x514910771af9ca656af840dff83e8264ecf986ca' },
  uni: { chain: 'ethereum', address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984' },
  aave: { chain: 'ethereum', address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9' },
  pepe: { chain: 'ethereum', address: '0x6982508145454ce325ddbe47a25d4ec3d2311933' },
  shib: { chain: 'ethereum', address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce' },
  doge: { chain: 'bnb', address: '0xba2ae424d960c26247dd6c32edc70b295c744c43' },
  wif: { chain: 'solana', address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  bonk: { chain: 'solana', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  crv: { chain: 'ethereum', address: '0xd533a949740bb3306d119cc777fa900ba034cd52' },
  ldo: { chain: 'ethereum', address: '0x5a98fcbea516cf06857215779fd812ca3bef1b32' },
  mkr: { chain: 'ethereum', address: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2' },
  ens: { chain: 'ethereum', address: '0xc18360217d8f7ab5e7c516566761ea12ce7f9d72' },
};

/** Stable hue per symbol, so a fallback still looks designed. */
function hueOf(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) % 360;
  return h;
}

export function CoinIcon({
  symbol,
  size = 20,
  chain,
  address,
  className = '',
}: {
  symbol: string;
  size?: number;
  chain?: string;
  address?: string;
  className?: string;
}) {
  const key = symbol.toLowerCase();
  const local = COIN_FILES.has(key);

  // Prefer the contract the caller gave us; fall back to the canonical one
  // for this ticker, so a symbol-only caller still gets the real mark.
  const ref =
    chain && address
      ? { chain: chain.toLowerCase(), address }
      : (CANONICAL[key] ?? null);

  const remote =
    !local && ref
      ? `/api/icon?chain=${encodeURIComponent(ref.chain)}&address=${encodeURIComponent(ref.address)}` +
        `&symbol=${encodeURIComponent(symbol)}`
      : null;

  const [failed, setFailed] = useState(false);
  const src = local ? `/coins/${key}.svg` : remote;

  const label = symbol.toUpperCase().slice(0, 4);
  const hue = hueOf(symbol.toUpperCase());

  // The monogram is drawn first and the real mark sits on top of it.
  //
  // Rendering one or the other left a search dropdown full of blank circles:
  // a dozen rows each request an icon at once, and while those are in flight
  // the <img> has neither loaded nor errored, so nothing at all was painted.
  // Layering means a row always shows something and simply sharpens when the
  // logo arrives.
  if (src) {
    return (
      <span
        className={className}
        style={{
          position: 'relative',
          display: 'inline-block',
          width: size,
          height: size,
          flexShrink: 0,
        }}
      >
        {local ? null : <Monogram label={label} hue={hue} size={size} />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          style={{
            position: 'absolute',
            // Every curated mark in public/coins draws its own disc, edge to
            // edge in a 32x32 box, so all of them fill the circle. An earlier
            // version sat them on a backing disc and inset them, which put a
            // dark ring around artwork that already had a background: Bitcoin
            // rendered as an orange coin inside a black circle.
            inset: 0,
            width: size,
            height: size,
            // Never distort a mark that is not perfectly square.
            objectFit: 'contain',
            borderRadius: '50%',
            // Hidden rather than unmounted. A parent that re-keys this
            // component resets the failed flag, which put a broken image back
            // over the monogram; opacity does not depend on that state
            // surviving, and the mark underneath is already correct.
            opacity: failed ? 0 : 1,
          }}
          decoding="async"
          onError={(e) => {
            e.currentTarget.style.opacity = '0';
            setFailed(true);
          }}
        />
      </span>
    );
  }

  return <Monogram label={label} hue={hue} size={size} className={className} />;
}

function Monogram({
  label,
  hue,
  size,
  className = '',
}: {
  label: string;
  hue: number;
  size: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label={label}
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={`m-${label}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`hsl(${hue} 58% 34%)`} />
          <stop offset="100%" stopColor={`hsl(${(hue + 40) % 360} 52% 20%)`} />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="16" fill={`url(#m-${label})`} />
      <circle
        cx="16"
        cy="16"
        r="15"
        fill="none"
        stroke={`hsl(${hue} 70% 62%)`}
        strokeOpacity="0.5"
      />
      <text
        x="16"
        y="20.5"
        textAnchor="middle"
        fill={`hsl(${hue} 85% 82%)`}
        fontSize={label.length > 3 ? 8 : label.length > 2 ? 10 : 12}
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}
