import type {
  Agent,
  AgentBullet,
  IndependentSource,
  TermStructure,
  Thesis,
  Tripwire,
} from '@/lib/types';
import {
  getAgents,
  getConditions,
  getDebate,
  getEvidence,
  getInvestigation,
  type InvestigationRow,
  type InvestigationStatus,
} from './store';
import { getJob, getEvents, type MonitoringJob } from '@/lib/monitor/runner';
import { METRIC } from '@/lib/research/falsify';

/**
 * Rehydrates a stored investigation into the shapes the UI already renders.
 *
 * Nothing is synthesised here. If a field was not measured and stored, it
 * comes back empty and the page shows an empty state.
 */

export interface LoadedInvestigation {
  row: InvestigationRow;
  thesis: Thesis;
  status: InvestigationStatus;
  nansenEvidenceCount: number;
  independent: IndependentSource[];
  job: MonitoringJob | null;
  events: Awaited<ReturnType<typeof getEvents>>;
}

const STATUS_LABEL: Record<InvestigationStatus, string> = {
  SUPPORTED: 'Supported',
  CHALLENGED: 'Challenged',
  MIXED: 'Mixed',
  UNDER_STRESS: 'Under stress',
  INVALIDATED: 'Invalidated',
};

export function statusLabel(s: InvestigationStatus): string {
  return STATUS_LABEL[s] ?? s;
}

export async function loadInvestigation(invId: string): Promise<LoadedInvestigation | null> {
  const row = await getInvestigation(invId);
  if (!row) return null;

  // Independent of each other, so they go out together. Run one after another
  // this is six network round-trips per page view against Postgres.
  const [agentRows, allEvidence, conditionRows, debateRows, job, events] =
    await Promise.all([
      getAgents(invId),
      getEvidence(invId),
      getConditions(invId),
      getDebate(invId),
      getJob(invId),
      getEvents(invId),
    ]);

  const bulletsFor = (agentRowId: string): AgentBullet[] =>
    allEvidence
      .filter((e) => e.agent_report_id === agentRowId && e.source === 'nansen')
      .map((e) => ({
        label: e.label,
        display: e.display,
        tone: e.tone,
        provenance: {
          requestId: e.request_id ?? 'stored',
          endpoint: e.endpoint,
          field: e.field,
          creditsUsed: e.credits_used,
          fetchedAt: e.fetched_at,
          redistribution: e.redistribution as AgentBullet['provenance']['redistribution'],
        },
      }));

  const agents: Agent[] = agentRows.map((a) => ({
    id: a.agent_id as Agent['id'],
    name: a.name,
    subtitle: a.subtitle ?? '',
    stance: a.stance,
    confidence: a.confidence,
    summary: a.summary,
    bullets: bulletsFor(a.id),
  }));

  const tripwires: Tripwire[] = conditionRows.map((c) => ({
    id: c.wire_key,
    claim: c.claim,
    metric: metricOf(c.wire_key, c.endpoint, c.field, c.unit),
    comparator: c.comparator,
    threshold: c.threshold,
    sustain: c.sustain,
    severity: c.severity,
    status: c.status,
    currentValue: c.current_value,
    proximity: c.proximity,
    history: JSON.parse(c.history) as number[],
    provenance: {
      requestId: 'stored',
      endpoint: c.endpoint,
      field: c.field,
      creditsUsed: 1,
      fetchedAt: c.updated_at,
      redistribution: 'attribution',
    },
  }));

  const independent: IndependentSource[] = allEvidence
    .filter((e) => e.source === 'independent')
    .map((e) => ({
      name: e.source_name ?? 'Independent',
      metric: e.label,
      value: e.display,
      agrees: e.agrees === null ? null : e.agrees === 1,
      url: e.source_url ?? '#',
    }));

  const thesis: Thesis = {
    id: row.id,
    statement: row.statement,
    highlight: `$${row.symbol}`,
    asset: { symbol: row.symbol, chain: row.chain },
    horizon: row.horizon,
    state:
      row.status === 'INVALIDATED'
        ? 'broken'
        : row.status === 'UNDER_STRESS'
          ? 'stressed'
          : 'holding',
    elapsed: '—',
    agents,
    consensus: {
      score: row.evidence_score,
      coverage: row.coverage,
      label: statusLabel(row.status),
      leanPositive: row.support_count,
      total: row.support_count + row.challenge_count,
      strongestSignal: row.strongest_signal ?? '—',
      biggestContradiction: row.biggest_contradiction ?? '—',
    },
    tripwires,
    termStructure: (row.term_structure
      ? JSON.parse(row.term_structure)
      : {}) as TermStructure,
    independent,
    debate: debateRows,
  };

  return {
    row,
    thesis,
    status: row.status,
    nansenEvidenceCount: allEvidence.filter((e) => e.source === 'nansen').length,
    independent,
    job,
    events,
  };
}

/**
 * The metric a stored condition actually compares.
 *
 * Rows written before the metric registry existed carry a raw API field name
 * for what is really a derived quantity, so the registry wins wherever it has
 * an entry. That keeps old investigations readable instead of leaving them
 * claiming to compare a field they never compared.
 */
function metricOf(
  wireKey: string,
  endpoint: string,
  field: string,
  unit: Tripwire['metric']['unit'],
): Tripwire['metric'] {
  const known = METRIC[wireKey];
  return known
    ? { endpoint, field: known.field, unit: known.unit, derivedFrom: known.derivedFrom }
    : { endpoint, field, unit };
}
