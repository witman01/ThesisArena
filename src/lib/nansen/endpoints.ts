import type { RedistributionClass } from '@/lib/types';

/**
 * Endpoint registry: credit cost and redistribution class for every endpoint
 * we are willing to call.
 *
 * Costs are from Nansen's published pricing and vary by 500× across the
 * surface, so nothing should call the API without going through this table.
 * `redistribution` gates what may reach the UI as a raw value.
 */

export interface EndpointSpec {
  path: string;
  credits: number;
  redistribution: RedistributionClass;
  /** Escalation tier — the governor only spends above `cheap` deliberately. */
  tier: 'cheap' | 'mid' | 'expensive' | 'blocked';
}

export const ENDPOINTS = {
  // --- 0 credits: free, so asset search can be fully live ------------------
  search: {
    path: 'search/general',
    credits: 0,
    redistribution: 'attribution',
    tier: 'cheap',
  },

  // --- 1 credit, attribution-class: the workhorses ------------------------
  tokenScreener: {
    path: 'token-screener',
    credits: 1,
    redistribution: 'attribution',
    tier: 'cheap',
  },
  flowIntelligence: {
    path: 'tgm/flow-intelligence',
    credits: 1,
    redistribution: 'attribution',
    tier: 'cheap',
  },
  flows: {
    path: 'tgm/flows',
    credits: 1,
    redistribution: 'attribution',
    tier: 'cheap',
  },
  whoBoughtSold: {
    path: 'tgm/who-bought-sold',
    credits: 1,
    redistribution: 'attribution',
    tier: 'cheap',
  },
  dexTrades: {
    path: 'tgm/dex-trades',
    credits: 1,
    redistribution: 'attribution',
    tier: 'cheap',
  },
  tokenInfo: {
    path: 'tgm/token-information',
    credits: 1,
    redistribution: 'attribution',
    tier: 'cheap',
  },
  ohlcv: {
    path: 'tgm/token-ohlcv',
    credits: 1,
    redistribution: 'attribution',
    tier: 'cheap',
  },
  addressPnlSummary: {
    path: 'profiler/address/pnl-summary',
    credits: 1,
    redistribution: 'allowed',
    tier: 'cheap',
  },

  // --- 5 credits: only when the cheap tier is inconclusive ----------------
  holders: {
    path: 'tgm/holders',
    credits: 5,
    redistribution: 'restricted',
    tier: 'mid',
  },
  indicators: {
    path: 'tgm/indicators',
    credits: 5,
    redistribution: 'attribution',
    tier: 'mid',
  },
  historicalFlowSummary: {
    path: 'tgm/historical-token-flow-summary',
    credits: 5,
    redistribution: 'attribution',
    tier: 'mid',
  },

  // --- 25 credits: explicit opt-in only -----------------------------------
  historicalTopHolders: {
    path: 'tgm/historical-top-holders',
    credits: 25,
    redistribution: 'restricted',
    tier: 'expensive',
  },

  // --- Never call: cost and/or redistribution make these unusable ---------
  addressLabels: {
    path: 'profiler/address/labels',
    credits: 100,
    redistribution: 'prohibited',
    tier: 'blocked',
  },
  agentExpert: {
    path: 'agent/expert',
    credits: 750,
    redistribution: 'prohibited',
    tier: 'blocked',
  },
  smartMoneyHoldings: {
    path: 'smart-money/holdings',
    credits: 5,
    redistribution: 'prohibited',
    tier: 'blocked',
  },
  pnlLeaderboard: {
    path: 'tgm/pnl-leaderboard',
    credits: 5,
    redistribution: 'prohibited',
    tier: 'blocked',
  },
} as const satisfies Record<string, EndpointSpec>;

export type EndpointKey = keyof typeof ENDPOINTS;

/**
 * Chains the token-god-mode endpoints accept.
 *
 * Taken verbatim from what the API returns when it rejects one, so the list
 * cannot drift from the server's own idea of it.
 *
 * `search/general` indexes more than this. Bitcoin is the clearest case: BTC
 * resolves to a native Bitcoin entry that every research endpoint then refuses
 * with a 422, so an investigation launched on it could only ever fail. A token
 * that cannot be researched is filtered out of search rather than offered and
 * then broken.
 */
export const RESEARCH_CHAINS = new Set([
  'arbitrum', 'arc', 'avalanche', 'base', 'bnb', 'ethereum', 'hyperevm',
  'injective', 'linea', 'mantle', 'mantra', 'monad', 'near', 'optimism',
  'plasma', 'polygon', 'robinhood', 'sei', 'solana', 'sonic', 'starknet',
  'sui', 'ton', 'tron',
]);

/** Whether the four research modules can read this chain at all. */
export function isResearchable(chain: string): boolean {
  return RESEARCH_CHAINS.has(chain.toLowerCase().trim());
}

/**
 * Guard for the render layer. Raw values from anything above `attribution`
 * must not be displayed — they may only feed a composite score.
 */
export function assertDisplayable(spec: EndpointSpec): void {
  if (spec.redistribution === 'restricted' || spec.redistribution === 'prohibited') {
    throw new Error(
      `Refusing to render raw values from ${spec.path}: redistribution class ` +
        `"${spec.redistribution}". Use it as a weighted term in a composite score instead.`,
    );
  }
}
