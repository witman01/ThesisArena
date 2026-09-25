import { NextResponse } from 'next/server';
import { NansenClient } from '@/lib/nansen/client';
import { isResearchable } from '@/lib/nansen/endpoints';
import { type AssetMeta } from '@/lib/assets';
import { recordRequests } from '@/lib/db/store';

/**
 * Live asset search across everything Nansen indexes.
 *
 * `search/general` costs 0 credits, so this runs on every keystroke without
 * touching the budget. Server-side so the API key never reaches the browser.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SearchToken {
  name: string;
  symbol: string;
  chain: string;
  address: string;
  price: number | null;
  volume_24h: number | null;
  market_cap: number | null;
  rank: number | null;
}

/** Native assets are rejected by tgm/flows, so the modules must know. */
const NATIVE: Record<string, string> = {
  ethereum: 'ETH',
  solana: 'SOL',
  bnb: 'BNB',
  avalanche: 'AVAX',
  polygon: 'MATIC',
  tron: 'TRX',
  near: 'NEAR',
  sui: 'SUI',
  ton: 'TON',
};

const CHAIN_LABEL: Record<string, string> = {
  ethereum: 'Ethereum',
  solana: 'Solana',
  bnb: 'BNB Chain',
  arbitrum: 'Arbitrum',
  base: 'Base',
  polygon: 'Polygon',
  avalanche: 'Avalanche',
  optimism: 'Optimism',
  tron: 'Tron',
  hyperevm: 'HyperEVM',
  linea: 'Linea',
  mantle: 'Mantle',
  scroll: 'Scroll',
  sei: 'Sei',
  sonic: 'Sonic',
  near: 'NEAR',
  sui: 'Sui',
  ton: 'TON',
  starknet: 'Starknet',
  monad: 'Monad',
  berachain: 'Berachain',
  arc: 'Arc',
};

function label(chain: string): string {
  return CHAIN_LABEL[chain] ?? chain.charAt(0).toUpperCase() + chain.slice(1);
}

/**
 * Is this a spot contract we can actually research?
 *
 * Nansen's search mixes perp markets into token results, and those carry the
 * bare ticker as their "address" — Hyperliquid SOL comes back as
 * `address: "SOL"`. The spot endpoints reject it with
 * `invalid_field_value: Invalid address format`, so those rows must never
 * reach the investigation.
 */
/**
 * Venues that list exposure to an asset without a spot contract behind it.
 *
 * Nansen indexes these alongside real chains and ranks them well, so a search
 * for APE returned the Robinhood listing above Ethereum. The spot endpoints
 * cannot read them, and a thesis about a token is not a thesis about its
 * tokenised wrapper on a brokerage.
 */
const DERIVATIVE_VENUES = new Set(['hyperliquid', 'robinhood']);

export function isSpotContract(address: string, symbol: string): boolean {
  const a = address.trim();
  if (!a) return false;

  // A bare ticker masquerading as an address.
  if (a.toUpperCase() === symbol.toUpperCase()) return false;

  if (/^0x[a-fA-F0-9]{40}$/.test(a)) return true; // EVM
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return true; // Tron
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return true; // Solana base58
  if (/^[a-z0-9._-]+\.(near|ton|eth)$/i.test(a)) return true; // named accounts

  // Anything else short enough to be a symbol is not an address.
  return a.length >= 20;
}

/**
 * Notes when a ticker resolves to more than one contract.
 *
 * The same symbol legitimately exists on several chains, and the ordering
 * above picks the most-traded contract of the largest asset. That is a good
 * default, not a certainty, so the choice is stated rather than assumed.
 */
function flagAmbiguity(assets: AssetMeta[]): void {
  const top = assets[0];
  if (!top) return;

  const siblings = assets.filter(
    (a, i) => i > 0 && a.symbol.toUpperCase() === top.symbol.toUpperCase(),
  );
  if (siblings.length === 0) return;

  top.alsoOn = siblings.slice(0, 5).map((a) => ({
    chain: a.chain,
    chainLabel: a.chainLabel,
    address: a.address,
  }));
  top.ambiguityNote =
    `${top.symbol} exists on ${siblings.length + 1} chains. ` +
    `Showing the ${top.chainLabel} contract, which carries the most volume.`;
}

/*
 * There was a CoinGecko price and market-cap cross-check here. It resolved a
 * CoinGecko id by slugifying the Nansen token name, which is a guess, and on a
 * wrong guess it matched a different asset entirely and then overrode Nansen's
 * figures with that asset's. $JUP showed Nansen's real $0.30 price beside a
 * $364.3K market cap belonging to an unrelated token, under a warning telling
 * the user the two disagreed.
 *
 * Every figure on the asset card now comes from Nansen, for the contract that
 * was actually selected. One source for one contract cannot contradict itself.
 * DeFiLlama remains the independent corroboration, in its own labelled panel,
 * where it is compared rather than substituted.
 */

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 1) return NextResponse.json({ assets: [] });

  try {
    const client = new NansenClient({ budget: 5, maxTier: 'cheap' });
    // Search is free and the user is waiting on it, so a transient upstream
    // failure gets one immediate retry rather than surfacing as an empty box.
    let res: { tokens?: SearchToken[] };
    try {
      res = await client.call<{ tokens?: SearchToken[] }>('search', {
        search_query: q,
        result_type: 'token',
        limit: 40,
      });
    } catch {
      res = await client.call<{ tokens?: SearchToken[] }>('search', {
        search_query: q,
        result_type: 'token',
        limit: 40,
      });
    }

    // Relevance before rank: typing "pepe" should surface PEPE, not kPEPE,
    // even when the derivative carries a better Nansen rank.
    const needle = q.toLowerCase();
    const relevance = (t: SearchToken) => {
      const sym = t.symbol.toLowerCase();
      if (sym === needle) return 0;
      if (sym.startsWith(needle)) return 1;
      if (t.name.toLowerCase() === needle) return 2;
      if (t.name.toLowerCase().startsWith(needle)) return 3;
      return 4;
    };

    // Order: relevance, then the largest asset, then where it actually trades.
    //
    // Neither market cap nor volume works alone, because two different traps
    // sit here. Market cap is reported for the *asset*, so every chain a token
    // is bridged to returns the same figure — MKR is $133.94M on Ethereum and
    // $133.99M on Polygon — and sorting by it chose between contracts on 0.04%
    // of noise, putting bridged MAKER (PoS) with $284 of daily volume above
    // canonical Ethereum MKR. Volume alone is no better: a Solana token also
    // called PEPE trades $13.5M a day against Ethereum PEPE's $5.6M while
    // carrying $902K of market cap against $1.73B — higher volume, different
    // asset.
    //
    // So market cap decides *which asset*, and volume decides *which chain*.
    const candidates = (res.tokens ?? []).filter(
      (t) =>
        t.address &&
        t.symbol &&
        isSpotContract(t.address, t.symbol) &&
        !DERIVATIVE_VENUES.has(t.chain.toLowerCase()) &&
        // Offering a token the research endpoints cannot read guarantees a
        // failed investigation. BTC on native Bitcoin was the common case.
        isResearchable(t.chain),
    );

    // The largest market cap carrying a given symbol identifies the real
    // asset; everything within 15% of it is the same asset on another chain.
    const peak = new Map<string, number>();
    for (const t of candidates) {
      const k = t.symbol.toLowerCase();
      peak.set(k, Math.max(peak.get(k) ?? 0, t.market_cap ?? 0));
    }
    const isCanonicalAsset = (t: SearchToken) =>
      (t.market_cap ?? 0) >= (peak.get(t.symbol.toLowerCase()) ?? 0) * 0.85 ? 0 : 1;

    const assets: AssetMeta[] = candidates
      .sort(
        (a, b) =>
          relevance(a) - relevance(b) ||
          isCanonicalAsset(a) - isCanonicalAsset(b) ||
          (b.volume_24h ?? 0) - (a.volume_24h ?? 0) ||
          (a.rank ?? 1e9) - (b.rank ?? 1e9),
      )
      .slice(0, 12)
      .map((t) => ({
        symbol: t.symbol,
        name: t.name,
        chain: t.chain,
        chainLabel: label(t.chain),
        address: t.address,
        priceUsd: t.price ?? 0,
        marketCapUsd: t.market_cap ?? 0,
        change24h: 0, // search does not carry a 24h delta
        isNative: NATIVE[t.chain] === t.symbol.toUpperCase(),
      }));

    // Search calls are real requests against the key and belong in the ledger,
    // even though search/general is billed at 0 credits.
    await recordRequests(client.ledger, { context: 'search' });

    flagAmbiguity(assets);
    return NextResponse.json({ assets });
  } catch (e) {
    return NextResponse.json(
      { assets: [], error: (e as Error).message },
      { status: 502 },
    );
  }
}
