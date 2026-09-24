/**
 * Asset types and formatting.
 *
 * There is deliberately no hardcoded price table here. Prices move, a static
 * list goes stale silently, and a stale price is worse than no price — an
 * earlier version of this file claimed ARB was $0.47 when it was $0.22.
 * Everything now resolves through `/api/search`, which reads Nansen live at
 * 0 credits.
 */

export interface AssetMeta {
  symbol: string;
  name: string;
  chain: string;
  chainLabel: string;
  address: string;
  priceUsd: number;
  /**
   * Value of THIS contract's supply, as Nansen reports it. For a wrapper this
   * is far below the asset's total market cap — wrapped SOL is ~$1.4B against
   * SOL's ~$66B — so it must never be labelled "market cap".
   */
  marketCapUsd: number;
  /** Whole-asset market cap from an independent source, when resolvable. */
  canonicalMarketCap?: number;
  change24h: number;
  /** Native assets are rejected by tgm/flows — the modules branch on this. */
  isNative?: boolean;
  /** Set when an independent source disagrees with Nansen's price. */
  priceWarning?: string;
  /**
   * Set on the top result when the same ticker resolves to several contracts.
   *
   * Without it a user picks a token, gets an answer, and has no idea a
   * different chain's contract was analysed — which is exactly how a RAVE
   * thesis on Base ended up being compared against RAVE on BNB.
   */
  ambiguityNote?: string;
  /** Other chains carrying this exact symbol, most traded first. */
  alsoOn?: { chain: string; chainLabel: string; address: string }[];
}

/** Pulls the first plausible ticker out of free text, e.g. "$SOL breaks out". */
export function detectSymbol(text: string): string | null {
  const tagged = text.toUpperCase().match(/\$([A-Z][A-Z0-9]{1,9})\b/);
  if (tagged) return tagged[1];

  // Fall back to a bare all-caps word, ignoring common English words that
  // happen to be uppercase in a sentence.
  const STOP = new Set(['I', 'A', 'THE', 'AND', 'OR', 'IT', 'IS', 'IN', 'TO', 'ATH']);
  const bare = text
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ''))
    .find((w) => w.length >= 2 && w.length <= 6 && w === w.toUpperCase() && /[A-Z]/.test(w) && !STOP.has(w));

  return bare ?? null;
}

export function compactUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return 'n/a';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

/**
 * Prices span ~12 orders of magnitude on-chain, so a fixed decimal count
 * renders memecoins as "$0.0000". Below a cent we switch to significant
 * digits instead.
 */
export function priceLabel(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return 'n/a';
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;

  const decimals = Math.min(18, Math.abs(Math.floor(Math.log10(n))) + 2);
  return `$${n.toFixed(decimals).replace(/0+$/, '')}`;
}
