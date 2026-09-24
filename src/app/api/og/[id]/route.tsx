import { ImageResponse } from 'next/og';
import { loadInvestigation } from '@/lib/db/load';
import { SENTIMENT, verdictLabel } from '@/lib/research/observe';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The shareable result image.
 *
 * Rendered server-side so one artwork serves both the download button and the
 * link preview on X. Every figure comes from the stored investigation.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TONE: Record<string, string> = {
  SUPPORTED: '#00e08a',
  CHALLENGED: '#ff5f5f',
  MIXED: '#7d8d88',
  UNDER_STRESS: '#3fcbc4',
  INVALIDATED: '#ff5f5f',
};

/**
 * The ThesisArena mark, inlined from the file the site itself uses.
 *
 * Read once per process. Sharing a card with a redrawn approximation of your
 * own logo is worse than sharing no logo, because it looks like a forgery of
 * the brand rather than an omission.
 */
let brandCache: string | null = null;

function brandMark(): string {
  if (brandCache) return brandCache;
  const file = join(process.cwd(), 'public', 'logo.png');
  brandCache = `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  return brandCache;
}

/**
 * Fetches a token logo and returns it as a data URI, or null if there is none.
 *
 * A missing logo must never fail the card: the share image matters more than
 * the mark on it.
 */
async function inlineIcon(
  origin: string,
  chain: string | null,
  address: string | null,
  symbol: string,
): Promise<string | null> {
  if (!chain || !address) return null;
  try {
    const res = await fetch(
      `${origin}/api/icon?chain=${encodeURIComponent(chain.toLowerCase())}` +
        `&address=${encodeURIComponent(address)}&raster=1` +
        `&symbol=${encodeURIComponent(symbol)}`,
      // Generous, because the first share of a token fetches its logo from
      // an upstream for the first time. Four seconds silently dropped the mark
      // from exactly the card most likely to be posted. The card is rendered
      // once and then cached by the platform, so waiting is cheap.
      { signal: AbortSignal.timeout(9000) },
    );
    if (!res.ok) return null;

    const type = res.headers.get('content-type') ?? 'image/png';
    // raster=1 should have prevented this, but a card without a logo beats a
    // card that fails to render.
    if (type.includes('webp')) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const loaded = await loadInvestigation(id);
  if (!loaded) return new Response('Not found', { status: 404 });

  const { thesis, status, row } = loaded;
  const tone = TONE[status] ?? '#7d8d88';
  const tripped = thesis.tripwires.filter((t) => t.status === 'tripped').length;
  const challenges = thesis.consensus.total - thesis.consensus.leanPositive;

  // The logo is inlined as a data URI rather than linked.
  //
  // ImageResponse renders in an isolated context and its own fetch of a
  // relative or self-referential URL does not resolve, which is why the
  // downloaded card had no logo while the page beside it did. Reading the
  // bytes here and embedding them sidesteps the fetch entirely.
  const iconUrl = await inlineIcon(
    new URL(req.url).origin,
    row.chain,
    row.address,
    row.symbol,
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(150deg, #0b1412 0%, #050908 62%)',
          padding: 56,
          fontFamily: 'sans-serif',
          color: '#fff',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -180,
            right: -140,
            width: 520,
            height: 520,
            borderRadius: 520,
            background: `${tone}1f`,
            display: 'flex',
          }}
        />

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* The real mark, read off disk and inlined. An earlier version
                drew an approximation here on the claim that Satori could not
                load the file; it can, given a data URI, which is how the token
                logo a few lines down already works. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brandMark()}
              alt=""
              width={36}
              height={36}
              style={{ width: 36, height: 36, marginRight: 14 }}
            />
            <div style={{ fontSize: 26, fontWeight: 700, display: 'flex' }}>
              <span>Thesis</span>
              <span style={{ color: '#00e08a' }}>Arena</span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 2,
              color: tone,
              border: `1px solid ${tone}66`,
              background: `${tone}1a`,
              padding: '10px 18px',
              borderRadius: 10,
            }}
          >
            {SENTIMENT[status].toUpperCase()}
          </div>
        </div>

        {/* asset + claim. The logo is fetched through our own proxy with an
            absolute URL: ImageResponse renders in isolation and cannot resolve
            a relative path, which is why the card downloaded without one. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 46 }}>
          {iconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={iconUrl}
              alt=""
              width={30}
              height={30}
              style={{ width: 30, height: 30, borderRadius: 15 }}
            />
          )}
          <div style={{ display: 'flex', fontSize: 22, color: '#8fa09a' }}>
            {row.symbol} · {row.chain}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 14,
            fontSize: 44,
            fontWeight: 700,
            lineHeight: 1.22,
            maxWidth: 1000,
          }}
        >
          “{thesis.statement.slice(0, 120)}”
        </div>

        {/* numbers */}
        <div style={{ display: 'flex', marginTop: 'auto', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', marginRight: 62 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 92, fontWeight: 800, color: tone, lineHeight: 1 }}>
                {thesis.consensus.score}
              </span>
              <span style={{ fontSize: 30, color: '#8fa09a', marginLeft: 6 }}>/100</span>
            </div>
            <span style={{ fontSize: 17, color: '#6b7b76', letterSpacing: 3, marginTop: 12 }}>
              EVIDENCE SCORE
            </span>
          </div>

          <Stat label="DATA COVERAGE" value={`${thesis.consensus.coverage}%`} />
          <Stat
            label="SUPPORT / CHALLENGE"
            value={`${thesis.consensus.leanPositive} / ${challenges}`}
          />
          <Stat
            label="INVALIDATION PROGRESS"
            value={`${tripped} of ${thesis.tripwires.length}`}
            color={tripped > 0 ? tone : undefined}
          />
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 30,
            paddingTop: 22,
            borderTop: '1px solid #ffffff14',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* The verdict, and immediately beside it what the verdict is
              about. Red on a low number reads as "bearish on this token" at a
              glance, whatever the labels say, and this card travels without
              the page that would explain it. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 20, color: tone, fontWeight: 600 }}>
              {verdictLabel(status)}
            </span>
            <span style={{ fontSize: 15, color: '#6b7b76' }}>
              Scores the claim, not the token. Not a price call.
            </span>
          </div>
          <span style={{ fontSize: 17, color: '#6b7b76', letterSpacing: 2 }}>
            POWERED BY <span style={{ color: '#00e08a' }}>NANSEN API</span>
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginRight: 54 }}>
      <span style={{ fontSize: 34, fontWeight: 700, color: color ?? '#fff' }}>
        {value}
      </span>
      <span style={{ fontSize: 15, color: '#6b7b76', letterSpacing: 2.5, marginTop: 10 }}>
        {label}
      </span>
    </div>
  );
}
