import { NextResponse } from 'next/server';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const runtime = 'nodejs';

/**
 * Token logo proxy.
 *
 * Fetching logos straight from a third-party CDN in the browser fails in ways
 * we cannot control: cross-origin image blocking, TLS resets, and a single
 * upstream that simply does not have every token. The result was a page of
 * monograms where real logos existed.
 *
 * Serving them from our own origin fixes all of that at once — the browser
 * only ever talks to us, we can try several upstreams in order, and a hit is
 * cached on disk so the second request never leaves the machine.
 */

const CACHE_DIR = join(process.cwd(), '.cache', 'icons');

/** Upstreams use their own chain slugs. */
const DEXSCREENER: Record<string, string> = {
  ethereum: 'ethereum',
  solana: 'solana',
  bnb: 'bsc',
  bsc: 'bsc',
  arbitrum: 'arbitrum',
  base: 'base',
  polygon: 'polygon',
  avalanche: 'avalanche',
  optimism: 'optimism',
  linea: 'linea',
  scroll: 'scroll',
  sei: 'sei',
  sonic: 'sonicmainnet',
  mantle: 'mantle',
  hyperevm: 'hyperevm',
  tron: 'tron',
  blast: 'blast',
  zksync: 'zksync',
  ton: 'ton',
  injective: 'injective',
  starknet: 'starknet',
};

/** CoinGecko's asset-platform ids, for its contract lookup. */
const COINGECKO_PLATFORM: Record<string, string> = {
  ethereum: 'ethereum',
  bnb: 'binance-smart-chain',
  bsc: 'binance-smart-chain',
  arbitrum: 'arbitrum-one',
  base: 'base',
  polygon: 'polygon-pos',
  avalanche: 'avalanche',
  optimism: 'optimistic-ethereum',
  solana: 'solana',
  linea: 'linea',
  mantle: 'mantle',
  sei: 'sei-v2',
  blast: 'blast',
  zksync: 'zksync',
  // The non-EVM chains Nansen researches. These have no DexScreener image
  // endpoint, so CoinGecko's contract lookup is the only source that carries
  // them, and without these entries every NEAR, TON and Sui token fell back
  // to a monogram.
  near: 'near-protocol',
  ton: 'the-open-network',
  sui: 'sui',
  tron: 'tron',
  injective: 'injective',
  starknet: 'starknet',
  sonic: 'sonic',
  hyperevm: 'hyperevm',
};

/**
 * A deterministic monogram, served when no upstream carries a logo.
 *
 * Returning 404 was correct HTTP and the wrong product decision: it put a
 * failed request in every console and left the share card, which cannot fall
 * back to a client-side monogram, with no mark at all. The hue is derived from
 * the symbol so the same token always gets the same colour.
 */
function monogram(symbol: string): Fetched {
  const label = (symbol || '?').toUpperCase().slice(0, 4);
  let hue = 0;
  for (let i = 0; i < label.length; i++) hue = (hue * 31 + label.charCodeAt(i)) % 360;

  const size = label.length > 3 ? 8 : label.length > 2 ? 10 : 12;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="hsl(${hue} 58% 34%)"/>` +
    `<stop offset="100%" stop-color="hsl(${(hue + 40) % 360} 52% 20%)"/>` +
    `</linearGradient></defs>` +
    `<circle cx="16" cy="16" r="16" fill="url(#g)"/>` +
    `<circle cx="16" cy="16" r="15" fill="none" stroke="hsl(${hue} 70% 62%)" stroke-opacity="0.5"/>` +
    `<text x="16" y="20.5" text-anchor="middle" fill="hsl(${hue} 85% 82%)" ` +
    `font-family="ui-monospace,monospace" font-size="${size}" font-weight="700">${label}</text>` +
    `</svg>`;

  return { body: new TextEncoder().encode(svg), contentType: 'image/svg+xml' };
}

/** How long a miss is remembered, so a token with no logo is not re-fetched. */
const MISS_TTL_MS = 6 * 60 * 60 * 1000;

interface Fetched {
  body: Uint8Array;
  contentType: string;
}

function cachePath(key: string, ext: string): string {
  return join(CACHE_DIR, `${key}.${ext}`);
}

function readCache(key: string): Fetched | 'miss' | null {
  try {
    if (existsSync(cachePath(key, 'miss'))) {
      const at = Number(readFileSync(cachePath(key, 'miss'), 'utf8'));
      // An expired miss falls through and the upstreams are tried again —
      // logos do get added after a token launches.
      if (Number.isFinite(at) && Date.now() - at < MISS_TTL_MS) return 'miss';
      return null;
    }
    for (const [ext, type] of [
      ['png', 'image/png'],
      ['webp', 'image/webp'],
      ['jpg', 'image/jpeg'],
      ['svg', 'image/svg+xml'],
    ] as const) {
      const p = cachePath(key, ext);
      if (existsSync(p)) return { body: readFileSync(p), contentType: type };
    }
  } catch {
    // A cache that cannot be read is not an error worth failing the request
    // over — fall through to the network.
  }
  return null;
}

function writeCache(key: string, hit: Fetched | null): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    if (!hit) {
      writeFileSync(cachePath(key, 'miss'), String(Date.now()), 'utf8');
      return;
    }
    const ext = hit.contentType.includes('webp')
      ? 'webp'
      : hit.contentType.includes('jpeg')
        ? 'jpg'
        : hit.contentType.includes('svg')
          ? 'svg'
          : 'png';
    writeFileSync(cachePath(key, ext), hit.body);
  } catch {
    // Read-only filesystem: serve the bytes we already have and move on.
  }
}

async function grab(url: string): Promise<Fetched | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4500),
      headers: { 'User-Agent': 'ThesisArena/1.0' },
    });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) return null;

    const body = new Uint8Array(await res.arrayBuffer());
    // Some CDNs answer a miss with a tiny placeholder rather than a 404.
    if (body.byteLength < 128) return null;

    return { body, contentType };
  } catch {
    return null;
  }
}

/** CoinGecko answers with metadata; the logo is a second hop. */
/**
 * Lowercases an EVM address and leaves every other kind alone.
 *
 * EVM hex is case-insensitive, and folding it keeps one cache entry per token
 * whichever casing a caller passes. Nothing else is: a Sui type is
 * `0x2::sui::SUI`, and TON addresses are base64url, so folding those produces
 * an address the upstream has never heard of.
 */
function normaliseAddress(address: string): string {
  return /^0x[0-9a-fA-F]{40}$/.test(address) ? address.toLowerCase() : address;
}

async function viaCoinGecko(chain: string, address: string): Promise<Fetched | null> {
  const platform = COINGECKO_PLATFORM[chain];
  if (!platform) return null;

  try {
    // The default response carries every ticker and the full market history
    // — hundreds of KB that time out before the one field we want arrives.
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${platform}/contract/` +
        `${encodeURIComponent(normaliseAddress(address))}` +
        '?localization=false&tickers=false&market_data=false' +
        '&community_data=false&developer_data=false&sparkline=false',
      { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'ThesisArena/1.0' } },
    );
    if (!res.ok) return null;

    const json = (await res.json()) as { image?: Record<string, string> };
    const url = json.image?.large ?? json.image?.small ?? json.image?.thumb;
    // CoinGecko answers a miss with its own placeholder rather than a 404.
    if (!url || /missing_(large|small|thumb)/.test(url)) return null;

    return grab(url);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chain = (url.searchParams.get('chain') ?? '').toLowerCase().trim();
  const address = (url.searchParams.get('address') ?? '').trim();

  // Raster mode skips WebP. The share card is rendered by Satori, which
  // supports PNG and JPEG only — a WebP logo silently produced a card with no
  // mark on it. Cached separately so the two variants cannot overwrite
  // each other.
  const raster = url.searchParams.get('raster') === '1';

  // Alphanumerics only rejected every non-EVM address we actually research:
  // NEAR names contain dots ("btc.omft.near"), TON addresses are base64url so
  // they carry "-" and "_", and a Sui type is "0x2::sui::SUI". Those all came
  // back 400, which the browser treats as a failed image, so the token showed
  // a monogram even where a real logo existed. Path separators stay out, and
  // ".." is refused outright, because the address is interpolated into
  // upstream URLs.
  const addressOk =
    /^[a-zA-Z0-9._:-]{1,128}$/.test(address) && !address.includes('..');
  if (!chain || !addressOk) {
    return new NextResponse('bad request', { status: 400 });
  }

  // Separators become "-" rather than vanishing, so two different addresses
  // cannot collapse onto one cache entry and serve each other's logo.
  const key =
    `${chain}-${address.toLowerCase()}`.replace(/[^a-z0-9-]/g, '-') +
    (raster ? '-raster' : '');

  const symbol = (url.searchParams.get('symbol') ?? '').trim();

  const cached = readCache(key);
  if (cached === 'miss') return image(monogram(symbol), false);
  if (cached) return image(cached);

  // The direct image hosts run in parallel, then CoinGecko only if both miss.
  //
  // Serially these took seconds per token, and a search dropdown asks for a
  // dozen at once — most rows were still blank when the user had already
  // picked. DexScreener and 1inch are plain image URLs and usually answer in
  // well under a second; CoinGecko needs a metadata hop and rate-limits, so it
  // stays the fallback.
  const ds = DEXSCREENER[chain];
  const direct: Promise<Fetched | null>[] = [];

  if (ds) {
    direct.push(
      grab(
        `https://dd.dexscreener.com/ds-data/tokens/${ds}/` +
          `${encodeURIComponent(normaliseAddress(address))}.png`,
      ),
    );
  }
  if (chain === 'ethereum') {
    // tokens.1inch.io redirects here; going direct avoids a redirect chain
    // that some of these hosts do not terminate cleanly.
    direct.push(grab(`https://tokens-data.1inch.io/images/${address.toLowerCase()}.png`));
  }

  const usable = (h: Fetched | null): h is Fetched =>
    h !== null && !(raster && h.contentType.includes('webp'));

  const settled = await Promise.all(direct);
  const hit = settled.find(usable) ?? (await (async () => {
    const cg = await viaCoinGecko(chain, address);
    return usable(cg) ? cg : null;
  })());

  if (hit) {
    writeCache(key, hit);
    return image(hit);
  }

  writeCache(key, null);
  // Not a failure: the token simply has no published logo.
  return image(monogram(symbol), false);
}

function image(hit: Fetched, long = true): NextResponse {
  return new NextResponse(hit.body as BodyInit, {
    headers: {
      'Content-Type': hit.contentType,
      // Real logos effectively never change. A generated monogram is cached
      // for less, so a token that gains a logo picks it up the same day.
      'Cache-Control': long
        ? 'public, max-age=604800, stale-while-revalidate=86400'
        : 'public, max-age=3600',
    },
  });
}
