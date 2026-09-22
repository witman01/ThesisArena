import { NansenClient } from '@/lib/nansen/client';
import { independentSources } from '@/lib/external/defillama';
import type { Agent, TermStructure, Thesis, Timeframe } from '@/lib/types';
import { COHORTS, TIMEFRAMES } from '@/lib/types';
import { capitalFlow, holderStructure, patternMemory, smartMoney } from './agents';
import { buildDebate } from './debate';
import { buildTripwires, compositeScore } from './falsify';
import { dayWindow, type AssetRef, type ResearchResult } from './types';

/**
 * Runs a full investigation.
 *
 * Budgeted: the four modules cost ~9 credits on the 1-credit tier
 * (6 × flow-intelligence + flows + who-bought-sold + ohlcv). Nothing here
 * escalates to a paid tier without an explicit opt-in.
 */

export interface RunOptions {
  budget?: number;
  fixtureDir?: string;
  fixtureMode?: 'record' | 'replay' | 'off';
  /** Emitted as each module finishes — drives the investigation UI. */
  onProgress?: (e: ProgressEvent) => void;
  /** Emitted per Nansen request — drives the live call log. */
  onCall?: (e: { endpoint: string; credits: number; cached: boolean; ms: number }) => void;
}

export interface ProgressEvent {
  agent: string;
  state: 'start' | 'done' | 'error';
  evidencePoints?: number;
  message?: string;
}

export interface RunResult {
  thesis: Thesis;
  creditsSpent: number;
  creditsRemaining: number | null;
  ledger: NansenClient['ledger'];
}

function toAgent(r: ResearchResult): Agent {
  return {
    id: r.id as Agent['id'],
    name: r.name,
    subtitle: r.subtitle,
    stance: r.stance,
    confidence: r.confidence,
    summary: r.summary,
    bullets: r.evidence.map((e) => ({
      label: e.label,
      display: e.display,
      tone: e.tone,
      provenance: e.provenance,
    })),
  };
}

export async function runInvestigation(
  statement: string,
  asset: AssetRef,
  opts: RunOptions = {},
): Promise<RunResult> {
  const client = new NansenClient({
    budget: opts.budget ?? 20,
    maxTier: 'cheap',
    fixtureDir: opts.fixtureDir,
    fixtureMode: opts.fixtureMode,
    onCall: (e) =>
      opts.onCall?.({
        endpoint: e.endpoint,
        credits: e.credits,
        cached: e.cached,
        ms: e.ms,
      }),
  });

  // Defence in depth: search already filters perp rows, but a bad address
  // must fail here with something readable rather than as a raw 422.
  if (!/^0x[a-fA-F0-9]{40}$/.test(asset.address) &&
      !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(asset.address) &&
      !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(asset.address) &&
      !/^[a-z0-9._-]+\.(near|ton|eth)$/i.test(asset.address)) {
    throw new Error(
      `"${asset.address}" is not a spot contract address. ` +
        `${asset.symbol} may be a perpetual market rather than a token — pick the spot listing instead.`,
    );
  }

  const window = dayWindow(7);
  const step = opts.onProgress ?? (() => {});

  step({ agent: 'smart-money', state: 'start' });
  const smart = await smartMoney(client, asset);
  step({ agent: 'smart-money', state: 'done', evidencePoints: smart.evidence.length });

  step({ agent: 'flow-intelligence', state: 'start' });
  const flow = await capitalFlow(client, asset, window);
  step({ agent: 'flow-intelligence', state: 'done', evidencePoints: flow.evidence.length });

  step({ agent: 'holder-concentration', state: 'start' });
  const holder = await holderStructure(client, asset, window);
  step({ agent: 'holder-concentration', state: 'done', evidencePoints: holder.evidence.length });

  step({ agent: 'pattern-memory', state: 'start' });
  const pattern = await patternMemory(client, asset);
  step({ agent: 'pattern-memory', state: 'done', evidencePoints: pattern.evidence.length });

  const results = [smart, flow, holder, pattern];
  const independent = await independentSources(asset.chain);
  const tripwires = buildTripwires({ smart, flow, holder, pattern, statement });
  const { score, label, leanPositive, coverage } = compositeScore(
    results,
    independent,
    tripwires,
  );

  // Reshape the cohort term structure for the chart.
  const termStructure = {} as TermStructure;
  for (const cohort of COHORTS) {
    termStructure[cohort] = {} as Record<Timeframe, number | null>;
    for (const tf of TIMEFRAMES) {
      const row = smart.term[tf] as Record<string, number | null> | null;
      termStructure[cohort][tf] = row?.[`${cohort}_net_flow_usd`] ?? null;
    }
  }

  const trippedFatal = tripwires.some(
    (t) => t.severity === 'fatal' && t.status === 'tripped',
  );
  const anyStressed = tripwires.some((t) => t.status !== 'holding');

  const agentViews = results.map(toAgent);

  const thesis: Thesis = {
    id: `th_${asset.symbol.toLowerCase()}_${Date.now().toString(36)}`,
    statement,
    highlight: `$${asset.symbol}`,
    asset: { symbol: asset.symbol, chain: asset.chain },
    horizon: '7–30 days',
    state: trippedFatal ? 'broken' : anyStressed ? 'stressed' : 'holding',
    elapsed: '00:00',
    agents: agentViews,
    consensus: {
      score,
      coverage,
      label,
      leanPositive,
      total: results.length,
      strongestSignal: [...results].sort((a, b) => b.confidence - a.confidence)[0].name,
      biggestContradiction: [...results].sort((a, b) => a.confidence - b.confidence)[0].name,
    },
    tripwires,
    termStructure,
    independent,
    debate: buildDebate(agentViews),
  };

  return {
    thesis,
    creditsSpent: client.creditsSpent,
    creditsRemaining: client.creditsRemaining,
    ledger: client.ledger,
  };
}
