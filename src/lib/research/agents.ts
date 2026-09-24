import type { NansenClient } from '@/lib/nansen/client';
import { ENDPOINTS } from '@/lib/nansen/endpoints';
import { signedPct } from '@/lib/format';
import type { Provenance } from '@/lib/types';
import { TIMEFRAMES, type Timeframe } from '@/lib/types';
import {
  capByCoverage,
  clamp,
  dayWindow,
  stanceFrom,
  TIMEFRAME_HOURS,
  type AssetRef,
  type Evidence,
  type ResearchResult,
} from './types';

/**
 * The four research modules.
 *
 * Each is deterministic: the same inputs always produce the same read. No
 * model call happens anywhere in this file — that is what makes the output
 * defensible, and what lets the falsification checker be trusted later.
 */

function prov(
  key: keyof typeof ENDPOINTS,
  field: string,
  requestId: string | null = null,
): Provenance {
  const spec = ENDPOINTS[key];
  return {
    requestId: requestId ?? 'live',
    endpoint: spec.path,
    field,
    creditsUsed: spec.credits,
    fetchedAt: new Date().toISOString(),
    redistribution: spec.redistribution,
  };
}

function usd(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// 1. Smart Money — cohort flow term structure
// ---------------------------------------------------------------------------

interface FlowRow {
  smart_trader_net_flow_usd: number | null;
  smart_trader_wallet_count: number | null;
  whale_net_flow_usd: number | null;
  top_pnl_net_flow_usd: number | null;
  public_figure_net_flow_usd: number | null;
  exchange_net_flow_usd: number | null;
  fresh_wallets_net_flow_usd: number | null;
}

export async function smartMoney(
  c: NansenClient,
  asset: AssetRef,
): Promise<ResearchResult & { term: Record<Timeframe, FlowRow | null> }> {
  const term = {} as Record<Timeframe, FlowRow | null>;

  // Six timeframes, 1 credit each — the whole signature signal for 6 credits.
  for (const tf of TIMEFRAMES) {
    const res = await c.call<{ data?: FlowRow[] }>('flowIntelligence', {
      chain: asset.chain,
      token_address: asset.address,
      timeframe: tf,
    });
    term[tf] = res.data?.[0] ?? null;
  }

  const net = (tf: Timeframe) => term[tf]?.smart_trader_net_flow_usd ?? null;
  const week = net('7d') ?? 0;
  const day = net('1d') ?? 0;

  // Flow *rate* per hour at each horizon. If the short end is running slower
  // than the long end, accumulation is decelerating even while still positive.
  const rate = (tf: Timeframe) => {
    const v = net(tf);
    return v === null ? null : v / TIMEFRAME_HOURS[tf];
  };
  const shortRate = rate('6h') ?? rate('1h') ?? 0;
  const longRate = rate('7d') ?? 0;
  const accel = longRate === 0 ? 0 : (shortRate - longRate) / Math.abs(longRate);

  // Do the other tracked cohorts agree with smart money on the day?
  const d = term['1d'];
  const peers = [
    d?.whale_net_flow_usd,
    d?.top_pnl_net_flow_usd,
    d?.public_figure_net_flow_usd,
  ].filter((v): v is number => typeof v === 'number');
  const agree = peers.filter((v) => Math.sign(v) === Math.sign(day || week)).length;
  const agreement = peers.length ? agree / peers.length : 0;

  const direction = Math.sign(week);

  // Magnitude has two parts, because neither alone is honest: how large the
  // flow is in dollars, and how much of all tracked cohort activity it
  // represents. A bare log of dollars saturates — $86K and $86M both pin the
  // scale — so share of activity carries half the weight.
  const cohortAbs = [
    d?.whale_net_flow_usd,
    d?.top_pnl_net_flow_usd,
    d?.public_figure_net_flow_usd,
    d?.fresh_wallets_net_flow_usd,
    day,
  ].reduce<number>((n, v) => n + Math.abs(typeof v === 'number' ? v : 0), 0);
  const share = cohortAbs > 0 ? Math.abs(day) / cohortAbs : 0;
  const size = clamp(Math.log10(Math.abs(week) + 1) / 7, 0, 1); // ~$10M ⇒ 1.0

  const magnitude = clamp(share * 28 + size * 27, 0, 55);
  const raw = clamp(
    magnitude + agreement * 25 + (accel > 0 ? 12 : accel > -0.5 ? 4 : -10),
    0,
    92,
  );

  // Coverage: how many of the six horizons returned a usable reading, and
  // how many peer cohorts were populated.
  const horizonsCovered = TIMEFRAMES.filter((tf) => net(tf) !== null).length;
  const coverage = clamp(
    (horizonsCovered / TIMEFRAMES.length) * 0.7 + (peers.length / 3) * 0.3,
    0,
    1,
  );
  const confidence = capByCoverage(raw, coverage);

  const evidence: Evidence[] = [
    {
      label: 'Smart-trader net flow, 7d',
      display: usd(week),
      value: week,
      tone: week >= 0 ? 'positive' : 'negative',
      provenance: prov('flowIntelligence', 'smart_trader_net_flow_usd'),
    },
    {
      label: 'Cohort agreement, 1d',
      display: `${agree} of ${peers.length} cohorts aligned`,
      value: agreement,
      tone: agreement >= 0.67 ? 'positive' : agreement >= 0.34 ? 'neutral' : 'negative',
      provenance: prov('flowIntelligence', 'whale_net_flow_usd'),
    },
    {
      label: 'Accumulation trend',
      display:
        accel > 0.1 ? 'Accelerating' : accel > -0.5 ? 'Steady' : 'Decelerating',
      value: accel,
      tone: accel > 0.1 ? 'positive' : accel > -0.5 ? 'neutral' : 'negative',
      provenance: prov('flowIntelligence', 'smart_trader_net_flow_usd'),
    },
  ];

  return {
    id: 'smart-money',
    name: 'Smart Money',
    subtitle: 'Accumulation intelligence',
    stance: stanceFrom(confidence, direction),
    confidence,
    summary:
      direction > 0
        ? accel < -0.5
          ? 'High-conviction wallets accumulated over the week, but the short end has rolled over, so the trend is decelerating.'
          : 'High-conviction wallets are steadily adding exposure across every horizon.'
        : 'High-conviction wallets are net sellers over the week.',
    evidence,
    metrics: {
      netFlow7d: week,
      netFlow1d: day,
      acceleration: accel,
      agreement,
      walletCount: d?.smart_trader_wallet_count ?? null,
      freshWallets1d: d?.fresh_wallets_net_flow_usd ?? null,
      // Low-activity tokens report nothing on the day while the week is
      // clearly non-zero, so conditions about retail demand need the longer
      // horizon to fall back on.
      freshWallets7d: term['7d']?.fresh_wallets_net_flow_usd ?? null,
      exchange7d: term['7d']?.exchange_net_flow_usd ?? null,
      exchange1d: d?.exchange_net_flow_usd ?? null,
      horizonsCovered,
    },
    coverage,
    term,
  };
}

// ---------------------------------------------------------------------------
// 2. Capital Flow — where money actually moved
// ---------------------------------------------------------------------------

/**
 * Verified against live responses: the dex/cex split is null for many tokens,
 * and `holders_count` is pinned to the page size (100) rather than being a
 * real holder base. Only the `*_count` token-amount fields and the price/value
 * columns can be relied on, so the module is built on those.
 */
interface FlowsBucket {
  date: string;
  price_usd: number | null;
  value_usd: number | null;
  token_amount: number | null;
  total_inflows_count: number | null;
  total_outflows_count: number | null;
}

export async function capitalFlow(
  c: NansenClient,
  asset: AssetRef,
  window: { from: string; to: string },
): Promise<ResearchResult> {
  let buckets: FlowsBucket[] = [];
  let unsupported = false;
  let reason = '';

  // tgm/flows refuses whole classes of asset — native tokens and stablecoins
  // among them ("The TGM flows endpoint does not support stablecoins"). Those
  // rejections cost nothing, but they must degrade this module rather than
  // fail the entire investigation.
  if (asset.isNative) {
    unsupported = true;
    reason = 'Native asset';
  } else {
    try {
      const res = await c.call<{ data?: FlowsBucket[] }>('flows', {
        chain: asset.chain,
        token_address: asset.address,
        date: window,
        pagination: { page: 1, per_page: 200 },
      });
      buckets = res.data ?? [];
    } catch (e) {
      const msg = (e as Error).message;
      if (/stablecoin/i.test(msg)) reason = 'Stablecoin';
      else if (/does not support|invalid_field_value/i.test(msg)) reason = 'Unsupported asset class';
      else throw e; // a genuine failure should still surface
      unsupported = true;
    }
  }

  const num = (v: number | null | undefined) => (typeof v === 'number' ? v : 0);
  const inTok = buckets.reduce((n, b) => n + num(b.total_inflows_count), 0);
  const outTok = buckets.reduce((n, b) => n + num(b.total_outflows_count), 0);
  const netTok = inTok + outTok; // outflows arrive negative

  const priced = buckets.filter((b) => typeof b.price_usd === 'number');
  const lastPrice = num(priced.at(-1)?.price_usd);
  const firstPrice = num(priced.at(0)?.price_usd);
  const netUsd = netTok * lastPrice;

  // Buckets are newest-first, so "first" is the most recent.
  const priceChange = firstPrice && lastPrice ? (firstPrice - lastPrice) / lastPrice : 0;

  const turnover = inTok + Math.abs(outTok);
  const pressure = turnover > 0 ? netTok / turnover : 0; // -1 .. +1

  const direction = Math.sign(netTok);
  const raw = unsupported
    ? 40
    : clamp(48 + pressure * 120 + clamp(priceChange * 60, -12, 12));

  // 168 hourly buckets is a full week. Fewer means a partial window.
  const coverage = unsupported ? 0.25 : clamp(buckets.length / 168, 0, 1);
  const confidence = capByCoverage(raw, coverage);

  const evidence: Evidence[] = unsupported
    ? [
        {
          label: 'Token-level flows',
          display: `${reason} \u2014 not covered by this endpoint`,
          value: 0,
          tone: 'neutral',
          provenance: prov('flows', 'total_inflows_count'),
        },
      ]
    : [
        {
          label: 'Net token flow, 7d',
          display: usd(netUsd),
          value: netUsd,
          tone: netTok >= 0 ? 'positive' : 'negative',
          provenance: prov('flows', 'total_inflows_count'),
        },
        {
          label: 'Buy pressure',
          display: `${(pressure * 100).toFixed(1)}% of turnover net`,
          value: pressure,
          tone: pressure > 0.02 ? 'positive' : pressure < -0.02 ? 'negative' : 'neutral',
          provenance: prov('flows', 'total_outflows_count'),
        },
        {
          label: 'Price over window',
          display: signedPct(priceChange),
          value: priceChange,
          tone: priceChange >= 0 ? 'positive' : 'negative',
          provenance: prov('flows', 'price_usd'),
        },
      ];

  return {
    id: 'flow-intelligence',
    name: 'Capital Flow',
    subtitle: 'Multi-chain capital movement',
    stance: stanceFrom(confidence, direction),
    confidence,
    summary: unsupported
      ? `Token-level flow is unavailable for this asset (${reason.toLowerCase()}); the read leans on cohort flow instead.`
      : pressure > 0.02
        ? 'Net token flow is positive across the window. More supply is being absorbed than released.'
        : pressure < -0.02
          ? 'Net token flow is negative across the window. Supply is being released faster than absorbed.'
          : 'Inflow and outflow are near balance; the flow read is inconclusive.',
    evidence,
    metrics: { netTok, netUsd, pressure, priceChange, buckets: buckets.length },
    coverage,
  };
}

// ---------------------------------------------------------------------------
// 3. Holder Concentration — derived from attribution-class data only
// ---------------------------------------------------------------------------

interface TraderRow {
  address: string;
  address_label: string | null;
  bought_volume_usd: number;
  sold_volume_usd: number;
  trade_volume_usd: number;
}

export async function holderStructure(
  c: NansenClient,
  asset: AssetRef,
  window: { from: string; to: string },
): Promise<ResearchResult> {
  const res = await c.call<{ data?: TraderRow[] }>('whoBoughtSold', {
    chain: asset.chain,
    token_address: asset.address,
    date: window,
    pagination: { page: 1, per_page: 100 },
  });
  const rows = res.data ?? [];

  const n = (v: number | null | undefined) => (typeof v === 'number' ? v : 0);
  const bought = rows.reduce((t, r) => t + n(r.bought_volume_usd), 0);
  const sold = rows.reduce((t, r) => t + n(r.sold_volume_usd), 0);
  const totalVol = rows.reduce((t, r) => t + n(r.trade_volume_usd), 0);

  // Net USD imbalance across the whole trader set, -1..+1.
  //
  // This replaces a "count of net buyers" ratio, which saturated at 1.0 on
  // every asset: the endpoint returns the top traders by volume and those
  // skew overwhelmingly to accumulators, so the count carried no information
  // and pinned this module's confidence in every investigation.
  const gross = bought + sold;
  const imbalance = gross > 0 ? (bought - sold) / gross : 0;

  // Concentration of activity in the largest three participants.
  const top3 = rows
    .map((r) => n(r.trade_volume_usd))
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((t, v) => t + v, 0);
  const concentration = totalVol > 0 ? top3 / totalVol : 0;

  // Two-sided traders are rotating rather than accumulating; a set that is
  // entirely one-way is thinner evidence than it first appears.
  const twoSided = rows.filter(
    (r) => n(r.bought_volume_usd) > 0 && n(r.sold_volume_usd) > 0,
  ).length;
  const churn = rows.length ? twoSided / rows.length : 0;

  const direction = Math.sign(imbalance) || 1;

  // Spread across the range rather than anchored to a constant: imbalance
  // carries the signal, concentration and churn subtract from it.
  const raw = clamp(
    50 + imbalance * 40 - Math.max(0, concentration - 0.3) * 70 - churn * 18,
  );
  const coverage = clamp(rows.length / 100, 0, 1);
  const confidence = capByCoverage(raw, coverage);

  return {
    id: 'holder-concentration',
    name: 'Holder Concentration',
    subtitle: 'Distribution & dump risk',
    stance: stanceFrom(confidence, direction),
    confidence,
    summary:
      concentration > 0.5
        ? 'Activity is bunched in very few addresses, so single-holder exit risk is elevated.'
        : imbalance > 0.15
          ? 'The active trader set is a net accumulator, and activity is spread rather than bunched.'
          : imbalance < -0.15
            ? 'The active trader set is distributing more than it is absorbing.'
            : 'Buying and selling are close to balanced across the active trader set.',
    evidence: [
      {
        label: 'Net trader imbalance',
        display: `${signedPct(imbalance)} (${usd(bought - sold)})`,
        value: imbalance,
        tone: imbalance > 0.05 ? 'positive' : imbalance < -0.05 ? 'negative' : 'neutral',
        provenance: prov('whoBoughtSold', 'bought_volume_usd'),
      },
      {
        label: 'Top-3 share of volume',
        display: `${(concentration * 100).toFixed(1)}%`,
        value: concentration,
        tone: concentration > 0.5 ? 'negative' : concentration > 0.35 ? 'neutral' : 'positive',
        provenance: prov('whoBoughtSold', 'trade_volume_usd'),
      },
      {
        label: 'Two-way traders',
        display: `${twoSided} of ${rows.length} rotating`,
        value: churn,
        tone: churn > 0.5 ? 'negative' : 'neutral',
        provenance: prov('whoBoughtSold', 'sold_volume_usd'),
      },
    ],
    metrics: {
      imbalance,
      concentration,
      churn,
      activeTraders: rows.length,
      totalVol,
      netUsd: bought - sold,
    },
    coverage,
  };
}

// ---------------------------------------------------------------------------
// 4. Pattern Memory — analogues found in the asset's own price history
// ---------------------------------------------------------------------------

interface Candle {
  interval_start: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume_usd: number;
}

export async function patternMemory(
  c: NansenClient,
  asset: AssetRef,
  lookbackDays = 240,
): Promise<ResearchResult> {
  const res = await c.call<{ data?: Candle[] }>('ohlcv', {
    chain: asset.chain,
    token_address: asset.address,
    timeframe: '1d',
    date: dayWindow(lookbackDays),
  });
  const candles = (res.data ?? []).filter((d) => d.close > 0);

  const W = 7; // shape window
  const F = 7; // forward window
  const closes = candles.map((d) => d.close);

  const ret = (a: number, b: number) => (closes[b] - closes[a]) / closes[a];
  const vol = (i: number) => {
    const win = closes.slice(i - W, i);
    if (win.length < 2) return 0;
    const rs = win.slice(1).map((v, k) => (v - win[k]) / win[k]);
    const m = rs.reduce((x, y) => x + y, 0) / rs.length;
    return Math.sqrt(rs.reduce((x, y) => x + (y - m) ** 2, 0) / rs.length);
  };

  const last = closes.length - 1;
  const current = { r: ret(last - W, last), v: vol(last) };

  // Find past windows whose return/volatility profile resembles today's, then
  // record what actually happened next. Strictly point-in-time: the forward
  // window is never part of the match.
  const analogues: number[] = [];
  for (let i = W; i + F <= last; i++) {
    const r = ret(i - W, i);
    const v = vol(i);
    const close =
      Math.abs(r - current.r) < Math.max(0.05, Math.abs(current.r) * 0.6) &&
      Math.abs(v - current.v) < Math.max(0.01, current.v * 0.7);
    if (close) analogues.push(ret(i, i + F));
  }

  const wins = analogues.filter((r) => r > 0).length;
  const hitRate = analogues.length ? wins / analogues.length : 0;
  const median = analogues.length
    ? analogues.slice().sort((a, b) => a - b)[Math.floor(analogues.length / 2)]
    : 0;

  const direction = analogues.length === 0 ? 0 : hitRate > 0.5 ? 1 : -1;
  const raw = analogues.length
    ? clamp(30 + hitRate * 50 + Math.min(analogues.length, 12) * 1.5)
    : 25;

  // Two inputs: how much history we got, and how many analogues it yielded.
  // Ten analogues is enough for a rate to mean anything; fewer is anecdote.
  const coverage = clamp(
    Math.min(candles.length / lookbackDays, 1) * 0.5 +
      Math.min(analogues.length / 10, 1) * 0.5,
    0,
    1,
  );
  const confidence = capByCoverage(raw, coverage);

  return {
    id: 'pattern-memory',
    name: 'Pattern Memory',
    subtitle: 'Historical analogues',
    stance: stanceFrom(confidence, direction),
    confidence,
    summary: analogues.length
      ? `${wins} of ${analogues.length} comparable setups in this asset's own history continued higher over the following week.`
      : 'No comparable setup found in the available history, so precedent is silent here.',
    evidence: [
      {
        label: 'Analogues found',
        display: `${wins} of ${analogues.length} continued higher`,
        value: hitRate,
        tone: hitRate > 0.55 ? 'positive' : hitRate < 0.45 ? 'negative' : 'neutral',
        provenance: prov('ohlcv', 'close'),
      },
      {
        label: 'Median follow-through',
        display: signedPct(median),
        value: median,
        tone: Number((median * 100).toFixed(1)) >= 0 ? 'positive' : 'negative',
        provenance: prov('ohlcv', 'close'),
      },
    ],
    metrics: {
      hitRate,
      median,
      analogues: analogues.length,
      currentReturn: current.r,
      currentVol: current.v,
      lastClose: closes[last] ?? null,
      // A real invalidation level: the lowest close of the recent base. Unlike
      // a level derived from the current return, this does not trip merely
      // because price is down over the window.
      swingLow: closes.length ? Math.min(...closes.slice(-21)) : null,
      analogueCount: analogues.length,
      recentHigh: closes.length ? Math.max(...closes.slice(-21)) : null,
      candles: candles.length,
    },
    coverage,
  };
}
