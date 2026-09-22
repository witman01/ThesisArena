/**
 * Domain types for ThesisArena.
 *
 * `CohortFlows` field names mirror the Nansen `tgm/flow-intelligence`
 * response exactly, so fixtures and live responses are interchangeable.
 */

export const TIMEFRAMES = ['5m', '1h', '6h', '12h', '1d', '7d'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const COHORTS = [
  'smart_trader',
  'whale',
  'public_figure',
  'top_pnl',
  'exchange',
  'fresh_wallets',
] as const;
export type Cohort = (typeof COHORTS)[number];

export const COHORT_LABELS: Record<Cohort, string> = {
  smart_trader: 'Smart traders',
  whale: 'Whales',
  public_figure: 'Public figures',
  top_pnl: 'Top PnL',
  exchange: 'Exchanges',
  fresh_wallets: 'Fresh wallets',
};

export type TermStructure = Record<Cohort, Record<Timeframe, number | null>>;

// ---------------------------------------------------------------------------
// Provenance & redistribution
// ---------------------------------------------------------------------------

/**
 * Nansen's redistribution tiers. Anything above `attribution` may only reach
 * the UI as a weighted term inside a composite score — never as a raw value.
 */
export type RedistributionClass =
  | 'allowed'
  | 'attribution'
  | 'restricted'
  | 'prohibited';

/** Binds a rendered claim to the call that produced it. */
export interface Provenance {
  requestId: string;
  endpoint: string;
  field: string;
  creditsUsed: number;
  fetchedAt: string;
  redistribution: RedistributionClass;
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export type Stance = 'bullish' | 'cautious' | 'neutral' | 'bearish';

export type AgentId =
  | 'smart-money'
  | 'flow-intelligence'
  | 'holder-concentration'
  | 'pattern-memory';

export interface AgentBullet {
  /** What was measured, e.g. "Smart-trader net flow, 7d". */
  label: string;
  /** The measurement, formatted, e.g. "-$86.5K". Kept separate from the
   *  label so the drawer can render it as a figure rather than a sentence. */
  display: string;
  tone: 'positive' | 'negative' | 'neutral';
  provenance: Provenance;
}

/** One turn in the debate transcript. */
export interface DebateMessage {
  id: string;
  agentId: AgentId;
  at: string;
  text: string;
  /** Set when this turn challenges another agent's claim. */
  challenges?: AgentId;
  evidence: AgentBullet[];
}

export interface Agent {
  id: AgentId;
  name: string;
  subtitle: string;
  stance: Stance;
  /** 0–100 derived confidence. Never a provider value passed through. */
  confidence: number;
  summary: string;
  bullets: AgentBullet[];
}

// ---------------------------------------------------------------------------
// Tripwires — what would invalidate the thesis
// ---------------------------------------------------------------------------

export type TripwireStatus = 'holding' | 'stressed' | 'tripped';
export type Severity = 'fatal' | 'major' | 'minor';

export interface Tripwire {
  id: string;
  claim: string;
  metric: {
    endpoint: string;
    /**
     * The quantity actually compared. For a derived metric this is the derived
     * name, never a raw API field that does not carry the compared value.
     */
    field: string;
    unit: 'usd' | 'pct' | 'count' | 'ratio';
    /** Raw endpoint fields a derived metric is computed from. */
    derivedFrom?: string[];
  };
  comparator: '<' | '>';
  threshold: number;
  sustain: string;
  severity: Severity;
  status: TripwireStatus;
  currentValue: number;
  /** 0–1 travel from the safe starting point toward the threshold. */
  proximity: number;
  history: number[];
  provenance: Provenance;
}

// ---------------------------------------------------------------------------
// Thesis
// ---------------------------------------------------------------------------

export type ThesisState = 'debating' | 'holding' | 'stressed' | 'broken';

export interface Consensus {
  /** 0–100 weighted composite. */
  score: number;
  /** 0–100. How much data actually backed the verdict, reported separately
   *  from the score so strength and knowledge are never conflated. */
  coverage: number;
  label: string;
  leanPositive: number;
  total: number;
  strongestSignal: string;
  biggestContradiction: string;
}

export interface Thesis {
  id: string;
  statement: string;
  /** The `$TOKEN` fragment to accent inside the headline. */
  highlight: string;
  asset: { symbol: string; chain: string };
  horizon: string;
  state: ThesisState;
  elapsed: string;
  agents: Agent[];
  consensus: Consensus;
  tripwires: Tripwire[];
  termStructure: TermStructure;
  independent: IndependentSource[];
  debate: DebateMessage[];
}

export interface IndependentSource {
  name: string;
  metric: string;
  value: string;
  agrees: boolean | null;
  url: string;
}

export interface RecentThesis {
  id: string;
  symbol: string;
  title: string;
  horizon: string;
  tag: string;
  tone: Stance;
  active?: boolean;
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export interface LedgerEntry {
  id: string;
  endpoint: string;
  credits: number;
  requestId: string;
  at: string;
  cached: boolean;
}

export interface LedgerSummary {
  totalCalls: number;
  totalCredits: number;
  cachedCalls: number;
  creditsRemaining: number;
  byEndpoint: { endpoint: string; calls: number; credits: number }[];
}
