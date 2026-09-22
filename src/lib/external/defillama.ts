import type { IndependentSource } from '@/lib/types';
import { signedPct } from '@/lib/format';

/**
 * DeFiLlama — the independent corroboration source.
 *
 * This is not decoration: Nansen's redistribution terms require any composite
 * built on restricted signals to be "meaningfully combined" with a substantial
 * independent source. Free, no key, no rate limit worth worrying about.
 */

const CHAIN_SLUG: Record<string, string> = {
  solana: 'Solana',
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
  base: 'Base',
  bnb: 'BSC',
  polygon: 'Polygon',
  avalanche: 'Avalanche',
  tron: 'Tron',
};

interface ChartPoint {
  date: number;
  tvl: number;
}

/** 7-day TVL change for a chain, plus a link a reader can verify. */
export async function chainTvlTrend(chain: string): Promise<IndependentSource | null> {
  const slug = CHAIN_SLUG[chain.toLowerCase()];
  if (!slug) return null;

  try {
    const res = await fetch(`https://api.llama.fi/v2/historicalChainTvl/${slug}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const series = (await res.json()) as ChartPoint[];
    if (!Array.isArray(series) || series.length < 8) return null;

    const last = series.at(-1)!.tvl;
    const weekAgo = series.at(-8)!.tvl;
    if (!weekAgo) return null;

    const pct = (last - weekAgo) / weekAgo;

    return {
      name: 'DeFiLlama',
      metric: `${slug} chain TVL, 7d`,
      value: signedPct(pct),
      agrees: pct >= 0,
      url: `https://defillama.com/chain/${slug}`,
    };
  } catch {
    // An independent source being down must never fail the run.
    return null;
  }
}

/** Stablecoin supply on a chain — a risk-appetite read independent of Nansen. */
export async function stablecoinTrend(chain: string): Promise<IndependentSource | null> {
  const slug = CHAIN_SLUG[chain.toLowerCase()];
  if (!slug) return null;

  try {
    const res = await fetch(
      `https://stablecoins.llama.fi/stablecoincharts/${slug}?stablecoin=1`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;

    const series = (await res.json()) as {
      date: string;
      totalCirculatingUSD?: { peggedUSD?: number };
    }[];
    if (!Array.isArray(series) || series.length < 8) return null;

    const at = (i: number) => series.at(i)?.totalCirculatingUSD?.peggedUSD ?? 0;
    const last = at(-1);
    const weekAgo = at(-8);
    if (!weekAgo) return null;

    const pct = (last - weekAgo) / weekAgo;

    return {
      name: 'DeFiLlama',
      metric: `Stablecoin supply on ${slug}, 7d`,
      value: signedPct(pct),
      agrees: pct >= 0,
      url: `https://defillama.com/stablecoins/${slug}`,
    };
  } catch {
    return null;
  }
}

export async function independentSources(chain: string): Promise<IndependentSource[]> {
  const results = await Promise.all([chainTvlTrend(chain), stablecoinTrend(chain)]);
  return results.filter((r): r is IndependentSource => r !== null);
}
