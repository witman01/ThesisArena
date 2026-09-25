import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENDPOINTS, type EndpointKey, type EndpointSpec } from './endpoints';

/**
 * Nansen API client.
 *
 * Server-only — the key must never reach the browser. Every call goes through
 * `call()` so that cost, budget, the ledger and rate limiting are impossible
 * to bypass.
 *
 * All Nansen endpoints are POST with a JSON body against
 * https://api.nansen.ai/api/v1/..., authenticated with an `apikey` header.
 */

const BASE = 'https://api.nansen.ai/api/v1';

export interface LedgerRecord {
  endpoint: string;
  credits: number;
  requestId: string | null;
  remaining: number | null;
  status: number;
  at: string;
  /**
   * Only 'live' is a real network call against the API key. Cache hits and
   * fixture replays are recorded for transparency but must never be counted
   * toward the buildathon's call requirement.
   */
  source: 'live' | 'cache' | 'fixture';
  ok: boolean;
  error?: string;
  /** @deprecated kept for existing UI; equals source !== 'live'. */
  cached: boolean;
  ms: number;
}

export class CreditBudgetExceeded extends Error {}
export class BlockedEndpoint extends Error {}

export interface ClientOptions {
  apiKey?: string;
  /** Hard ceiling for this client's lifetime. Trial keys start at 100. */
  budget?: number;
  /** Highest tier the governor may spend on without an explicit override. */
  maxTier?: EndpointSpec['tier'];
  /** Cache window; repeat calls with an identical body cost nothing. */
  cacheTtlMs?: number;
  /**
   * Record/replay directory. When set, an identical request is served from
   * disk at zero credits; a miss calls the API once and records the response.
   * This is how the app is developed without burning the credit balance.
   */
  fixtureDir?: string;
  /** 'replay' never calls the network — it throws on a fixture miss. */
  fixtureMode?: 'record' | 'replay' | 'off';
  /** Fires after every request, cached or live. Drives the live call log. */
  onCall?: (entry: LedgerRecord) => void;
}

export class NansenClient {
  private key: string;
  private budget: number;
  private maxTier: EndpointSpec['tier'];
  private cacheTtlMs: number;

  private fixtureDir?: string;
  private fixtureMode: 'record' | 'replay' | 'off';
  private onCall?: (entry: LedgerRecord) => void;

  private spent = 0;
  private remaining: number | null = null;
  private cache = new Map<string, { at: number; body: unknown }>();

  readonly ledger: LedgerRecord[] = [];

  private static TIER_RANK = {
    cheap: 0,
    mid: 1,
    expensive: 2,
    blocked: 99,
  } as const;

  constructor(opts: ClientOptions = {}) {
    this.onCall = opts.onCall;
    this.fixtureDir = opts.fixtureDir;
    this.fixtureMode = opts.fixtureMode ?? (opts.fixtureDir ? 'record' : 'off');

    const key = opts.apiKey ?? process.env.NANSEN_API_KEY;
    // Pure replay needs no credentials at all.
    if (!key && this.fixtureMode !== 'replay') {
      throw new Error(
        'NANSEN_API_KEY is not set. Add it to .env.local (never commit it).',
      );
    }
    this.key = key ?? '';
    this.budget = opts.budget ?? 60;
    this.maxTier = opts.maxTier ?? 'cheap';
    this.cacheTtlMs = opts.cacheTtlMs ?? 10 * 60_000;

    // A fixture directory is a cache, so failing to create one is not a reason
    // to fail the work. On a read-only filesystem this threw and took the
    // whole investigation with it; now fixtures switch themselves off and the
    // run continues live, which is what the caller wanted anyway.
    //
    // Replay is the exception. It has no network fallback, so a caller asking
    // for it and getting a live run instead would silently spend credits it
    // was explicitly avoiding.
    if (this.fixtureDir) {
      try {
        if (!existsSync(this.fixtureDir)) mkdirSync(this.fixtureDir, { recursive: true });
      } catch (e) {
        if (this.fixtureMode === 'replay') throw e;
        console.warn(
          `[nansen] fixture directory "${this.fixtureDir}" is not writable, ` +
            `so fixtures are disabled and this run reads live: ${(e as Error).message}`,
        );
        this.fixtureDir = undefined;
        this.fixtureMode = 'off';
      }
    }
  }

  /**
   * Fixture identity ignores date values.
   *
   * Request windows roll forward every day, so hashing them would expire every
   * fixture overnight and force a re-record (and a re-spend). What identifies
   * a fixture is the endpoint and its non-temporal parameters.
   */
  private fixturePath(spec: EndpointSpec, body: Record<string, unknown>): string {
    const canonical = JSON.stringify(body, (_k, v) =>
      typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? '<date>' : v,
    );
    const hash = createHash('sha1').update(canonical).digest('hex').slice(0, 10);
    const name = spec.path.replace(/\//g, '_');
    return join(this.fixtureDir!, `${name}.${hash}.json`);
  }

  get creditsSpent(): number {
    return this.spent;
  }

  /** Live balance, read from response headers. Null until the first call. */
  get creditsRemaining(): number | null {
    return this.remaining;
  }

  /** Real network calls only — what the buildathon requirement counts. */
  get liveCalls(): number {
    return this.ledger.filter((e) => e.source === 'live').length;
  }

  async call<T = unknown>(
    key: EndpointKey,
    body: Record<string, unknown>,
    opts: { allowTier?: EndpointSpec['tier'] } = {},
  ): Promise<T> {
    const spec: EndpointSpec = ENDPOINTS[key];

    if (spec.tier === 'blocked') {
      throw new BlockedEndpoint(
        `${spec.path} is blocked (${spec.credits} credits, ${spec.redistribution}).`,
      );
    }

    const ceiling = opts.allowTier ?? this.maxTier;
    if (NansenClient.TIER_RANK[spec.tier] > NansenClient.TIER_RANK[ceiling]) {
      throw new CreditBudgetExceeded(
        `${spec.path} is tier "${spec.tier}" but this run allows "${ceiling}". ` +
          `Pass allowTier to escalate deliberately.`,
      );
    }

    const cacheKey = `${spec.path}:${JSON.stringify(body)}`;
    const hit = this.cache.get(cacheKey);
    if (hit && Date.now() - hit.at < this.cacheTtlMs) {
      this.record({
        endpoint: spec.path,
        credits: 0,
        requestId: null,
        remaining: this.remaining,
        status: 200,
        at: new Date().toISOString(),
        source: 'cache',
        ok: true,
        cached: true,
        ms: 0,
      });
      return hit.body as T;
    }

    // Fixture replay — free, and identical across runs.
    if (this.fixtureDir && this.fixtureMode !== 'off') {
      const file = this.fixturePath(spec, body);
      if (existsSync(file)) {
        const saved = JSON.parse(readFileSync(file, 'utf8')) as { body: unknown };
        this.record({
          endpoint: spec.path,
          credits: 0,
          requestId: null,
          remaining: this.remaining,
          status: 200,
          at: new Date().toISOString(),
          source: 'fixture',
          ok: true,
          cached: true,
          ms: 0,
        });
        this.cache.set(cacheKey, { at: Date.now(), body: saved.body });
        return saved.body as T;
      }
      if (this.fixtureMode === 'replay') {
        throw new Error(
          `No fixture for ${spec.path} (${file}). Re-run in record mode to capture it.`,
        );
      }
    }

    if (this.spent + spec.credits > this.budget) {
      throw new CreditBudgetExceeded(
        `${spec.path} needs ${spec.credits} credits; ${this.spent}/${this.budget} already spent.`,
      );
    }

    const started = Date.now();
    const res = await this.fetchWithRetry(spec, body);
    const ms = Date.now() - started;

    // Trust the header: a rejected request (422/400) is billed 0, so falling
    // back to the quoted cost would over-count and starve the budget.
    const usedHeader = res.headers.get('x-nansen-credits-used');
    const parsed = usedHeader === null ? NaN : Number(usedHeader);
    const used = Number.isFinite(parsed) ? parsed : res.ok ? spec.credits : 0;

    const remainingHeader = res.headers.get('x-nansen-credits-remaining');
    this.remaining = remainingHeader === null ? this.remaining : Number(remainingHeader);
    this.spent += used;

    const json = await res.json();
    const errBody = res.ok ? null : (json as { code?: string; message?: string });

    this.record({
      endpoint: spec.path,
      credits: used,
      requestId: res.headers.get('x-request-id'),
      remaining: this.remaining,
      status: res.status,
      at: new Date().toISOString(),
      source: 'live',
      ok: res.ok,
      error: errBody ? `${errBody.code ?? ''} ${errBody.message ?? ''}`.trim() : undefined,
      cached: false,
      ms,
    });

    if (!res.ok) {
      throw new Error(
        `Nansen ${spec.path} failed ${res.status} ${errBody?.code ?? ''}: ${errBody?.message ?? 'unknown error'}`,
      );
    }

    if (this.fixtureDir && this.fixtureMode === 'record') {
      // The response is already in hand; a cache write that fails must not
      // discard it.
      try {
        writeFileSync(
          this.fixturePath(spec, body),
          JSON.stringify({ endpoint: spec.path, request: body, body: json }, null, 2),
        );
      } catch (e) {
        console.warn(`[nansen] could not record fixture: ${(e as Error).message}`);
        this.fixtureDir = undefined;
        this.fixtureMode = 'off';
      }
    }

    this.cache.set(cacheKey, { at: Date.now(), body: json });
    return json as T;
  }

  private record(entry: LedgerRecord): void {
    this.ledger.push(entry);
    this.onCall?.(entry);
  }

  /** Retries 429 and 5xx, honouring Retry-After. */
  private async fetchWithRetry(
    spec: EndpointSpec,
    body: Record<string, unknown>,
    attempt = 0,
  ): Promise<Response> {
    const res = await fetch(`${BASE}/${spec.path}`, {
      method: 'POST',
      headers: {
        apikey: this.key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < 3) {
      const after = Number(res.headers.get('retry-after'));
      const waitMs = Number.isFinite(after) && after > 0 ? after * 1000 : 2 ** attempt * 600;
      await new Promise((r) => setTimeout(r, waitMs));
      return this.fetchWithRetry(spec, body, attempt + 1);
    }

    return res;
  }
}
