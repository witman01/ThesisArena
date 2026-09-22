import type { Provenance, Stance } from '@/lib/types';

/** A single measured fact, bound to the call that produced it. */
export interface Evidence {
  label: string;
  /** Formatted for display. Raw values only from attribution-class or below. */
  display: string;
  value: number;
  tone: 'positive' | 'negative' | 'neutral';
  provenance: Provenance;
}

export interface ResearchResult {
  id: string;
  name: string;
  subtitle: string;
  stance: Stance;
  /** 0–100 derived confidence. Never a provider value passed through. */
  confidence: number;
  summary: string;
  evidence: Evidence[];
  /** Raw measurements other modules and the falsifier may read. */
  metrics: Record<string, number | null>;
  /**
   * 0–1. How much data actually backed this read — rows returned, fields
   * populated, horizons covered. Reported separately from confidence so
   * "how strong is the case" is never confused with "how much do we know".
   */
  coverage: number;
}

/**
 * Confidence can never exceed what the evidence supports.
 *
 * A module that received three candles has no business reporting 80%
 * conviction, however clean the signal looked.
 */
export function capByCoverage(confidence: number, coverage: number): number {
  const ceiling = 35 + coverage * 57; // full coverage ⇒ 92 ceiling
  return Math.round(Math.min(confidence, ceiling));
}

export interface AssetRef {
  symbol: string;
  chain: string;
  address: string;
  /** Native assets (SOL, ETH) are rejected by tgm/flows. */
  isNative?: boolean;
}

/** Hours represented by each Nansen timeframe, for rate normalisation. */
export const TIMEFRAME_HOURS: Record<string, number> = {
  '5m': 5 / 60,
  '1h': 1,
  '6h': 6,
  '12h': 12,
  '1d': 24,
  '7d': 168,
};

export function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * A date window floored to whole days.
 *
 * Request bodies must be stable to be cacheable: a raw `new Date()` makes
 * every call unique, which defeats both the fixture replay and Nansen's own
 * caching, and quietly multiplies credit spend.
 */
export function dayWindow(days: number): { from: string; to: string } {
  const floor = (d: Date) => {
    const c = new Date(d);
    c.setUTCHours(0, 0, 0, 0);
    return c.toISOString();
  };
  const now = new Date();
  return {
    from: floor(new Date(now.getTime() - days * 864e5)),
    to: floor(now),
  };
}

export function stanceFrom(confidence: number, direction: number): Stance {
  if (direction === 0) return 'neutral';
  if (confidence >= 70) return direction > 0 ? 'bullish' : 'bearish';
  if (confidence >= 45) return 'cautious';
  return 'neutral';
}
