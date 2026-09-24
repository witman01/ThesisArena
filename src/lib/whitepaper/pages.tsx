import { ENDPOINTS } from '@/lib/nansen/endpoints';
import { WEIGHTS } from '@/lib/research/falsify';
import { getUsage } from '@/lib/db/store';
import {
  A,
  Callout,
  Code,
  Figure,
  H2,
  IntroPanel,
  Lead,
  LI,
  LiveTag,
  OL,
  OLI,
  P,
  Pre,
  Stats,
  Strong,
  Table,
  UL,
} from '@/components/whitepaper/prose';
import {
  CreditSpread,
  ModuleDiagram,
  StateMachine,
  WeightBar,
} from '@/components/whitepaper/charts';

/**
 * The whitepaper, as data.
 *
 * Each page is a server component body, so a page can read the live system —
 * the endpoint registry, the module weights, the request ledger — instead of
 * quoting numbers that drift out of date the moment they are typed. A document
 * about not fabricating figures should not fabricate its own.
 */

export interface WPPage {
  slug: string;
  title: string;
  summary: string;
  toc: { id: string; label: string }[];
  Body: () => React.ReactNode;
}

export interface WPSection {
  name: string;
  pages: WPPage[];
}

/* =======================================================================
 * Introduction
 * ==================================================================== */

const overview: WPPage = {
  slug: '',
  title: 'Overview',
  summary: 'What ThesisArena is, and the one idea it is built around.',
  toc: [
    { id: 'abstract', label: 'Abstract' },
    { id: 'short', label: 'The short version' },
    { id: 'how', label: 'How it fits together' },
    { id: 'claims', label: 'What this document claims' },
    { id: 'not', label: 'What it is not' },
  ],
  Body: () => (
    <>
      <IntroPanel
        title="Put your thesis on trial"
        sub="A research instrument that states in advance what would prove a crypto thesis wrong, then keeps checking those conditions against live on-chain data until one of them breaks."
      />

      <H2 id="abstract">Abstract</H2>
      <Lead>
        ThesisArena takes a stated crypto thesis, derives the conditions that
        would prove it wrong, and then tests those conditions against live
        on-chain data, continuously, until one of them breaks.
      </Lead>
      <P>
        The design starts from an observation about how on-chain research
        actually fails. It rarely fails because the data was wrong. It fails
        because nobody wrote down, in advance, what would change their mind, so
        every subsequent piece of evidence gets read as confirmation. A tool
        that returns supporting evidence on request is not a research tool. It is
        a mirror.
      </P>
      <P>
        This system inverts the default. Before it reports anything, it converts
        a thesis into <Strong>machine-checkable invalidation conditions</Strong>:
        a field, a comparator, a threshold, a duration. Then it commits to them.
        A condition can only be set <em>before</em> the evidence is weighed,
        never after. Monitoring then re-reads those conditions on a schedule,
        and the thesis has a state that can change without anyone asking it to.
      </P>

      <H2 id="short">The short version</H2>
      <Callout kind="note" title="Put your thesis on trial.">
        <p>
          Every other tool tells you why you&rsquo;re right. ThesisArena finds out
          if you are.
        </p>
      </Callout>
      <OL>
        <OLI>
          You state a thesis in plain language: <em>&ldquo;$TOKEN breaks out
          this week because smart money is accumulating.&rdquo;</em>
        </OLI>
        <OLI>
          The ticker is resolved against Nansen&rsquo;s live index to a concrete
          chain and contract.
        </OLI>
        <OLI>
          Four deterministic research modules interrogate it, and disagree out
          loud when they genuinely disagree.
        </OLI>
        <OLI>
          Six stress conditions are derived from what was actually
          measured, each bound to a specific endpoint and field.
        </OLI>
        <OLI>
          Those conditions are monitored. The verdict moves as real data
          arrives, and you find out when the thesis dies.
        </OLI>
      </OL>

      <H2 id="how">How it fits together</H2>
      <Figure
        label="Investigation pipeline"
        caption="Four modules run independently, combine into one composite, and commit to conditions before any verdict is shown."
      >
        <ModuleDiagram />
      </Figure>

      <H2 id="claims">What this document claims</H2>
      <P>
        This paper describes a system that exists and runs. Where it quotes a
        figure about the system&rsquo;s own behaviour (call counts, credit
        consumption, endpoint costs, module weights), that figure is read out of
        the running instance at the moment you load the page, and is marked{' '}
        <LiveTag />. Where a number is a design constant chosen by judgement
        rather than derived from data, the paper says so explicitly at the point
        it is used.
      </P>

      <H2 id="not">What it is not</H2>
      <UL>
        <LI>
          <Strong>Not a price predictor.</Strong> The output is an Evidence
          Score, which measures the strength and internal consistency of the
          on-chain evidence. It is not a probability and does not translate into
          one.
        </LI>
        <LI>
          <Strong>Not a signal service.</Strong> There is no BUY, no SELL, no
          target. A thesis is the user&rsquo;s; the system only tries to break
          it.
        </LI>
        <LI>
          <Strong>Not a chatbot over an API.</Strong> No model call happens
          anywhere in the research path. The same inputs produce the same read,
          every time.
        </LI>
        <LI>
          <Strong>Not investment advice.</Strong> It is a research instrument.
        </LI>
      </UL>
    </>
  ),
};

const problem: WPPage = {
  slug: 'problem',
  title: 'The confirmation problem',
  summary: 'Why on-chain tooling converges on agreeing with its user.',
  toc: [
    { id: 'mirror', label: 'Tools that agree with you' },
    { id: 'why', label: 'Why it happens structurally' },
    { id: 'cost', label: 'What it costs' },
  ],
  Body: () => (
    <>
      <H2 id="mirror">Tools that agree with you</H2>
      <Lead>
        Ask any on-chain analytics product about a token you already like, and
        it will find you something encouraging. This is not dishonesty. It is
        the predictable result of an interface built around search.
      </Lead>
      <P>
        A dashboard offers dozens of metrics across many timeframes. A user
        arrives with a prior. Somewhere in that space is a chart that agrees:
        a cohort that is accumulating, a window where flows turned positive, a
        holder count that ticked up. The user finds it, because finding it is
        what the interface is for, and leaves more confident than they arrived.
        Nothing in the product was wrong. The process was.
      </P>

      <H2 id="why">Why it happens structurally</H2>
      <UL>
        <LI>
          <Strong>The metric is chosen after the belief.</Strong> Any metric
          selected to answer &ldquo;is my thesis working?&rdquo; has already been
          filtered by whether it tends to say yes.
        </LI>
        <LI>
          <Strong>Timeframes are free parameters.</Strong> With six horizons
          available, a flow figure that is negative on one is usually positive on
          another. Choosing the horizon after seeing the data is choosing the
          answer.
        </LI>
        <LI>
          <Strong>Nothing is written down in advance.</Strong> Without a
          committed invalidation condition, no observation can ever count as
          disconfirming. It becomes noise, or early, or priced in.
        </LI>
        <LI>
          <Strong>There is no state.</Strong> A one-shot score is consumed and
          forgotten. A thesis that quietly stopped being true looks exactly like
          one that was never revisited.
        </LI>
      </UL>

      <H2 id="cost">What it costs</H2>
      <P>
        The cost is not a bad entry. It is the absence of an exit. A position
        held on a thesis that has already been invalidated by the data is the
        most expensive thing in the category, and it is invisible precisely
        because no one defined what invalidation would look like. That is the
        gap this system is built to close.
      </P>
    </>
  ),
};

const principle: WPPage = {
  slug: 'principle',
  title: 'The stress-test principle',
  summary: 'The single rule the architecture is organised around.',
  toc: [
    { id: 'rule', label: 'The rule' },
    { id: 'machine', label: 'Machine-checkable, not rhetorical' },
    { id: 'ordering', label: 'Why ordering matters' },
    { id: 'honest', label: 'The honest failure mode' },
  ],
  Body: () => (
    <>
      <H2 id="rule">The rule</H2>
      <Callout kind="note">
        <p>
          A thesis that cannot be stated with a condition that would refute it
          is not a thesis. It is a preference.
        </p>
      </Callout>
      <P>
        Everything in the system follows from taking that seriously. The product
        does not attempt to determine whether a thesis is correct, which is
        unanswerable on a short horizon. It determines whether the thesis is{' '}
        <em>still standing</em>, which is answerable, repeatedly, from data.
      </P>

      <H2 id="machine">Machine-checkable, not rhetorical</H2>
      <P>
        &ldquo;Watch for weakening momentum&rdquo; is not a stress
        condition; nothing can evaluate it. A condition in this system is a
        typed object bound to a specific endpoint and field:
      </P>
      <Pre>{`{
  claim:      "Smart-trader accumulation is sustained",
  metric:     { endpoint: "tgm/flow-intelligence",
                field:    "smart_trader_net_flow_usd",
                params:   { timeframe: "1d" } },
  comparator: "<",
  threshold:  0,
  sustain:    "6h consecutive",
  severity:   "fatal",
  status:     "holding"
}`}</Pre>
      <P>
        Because the condition names its own endpoint and field, re-checking it
        is a lookup rather than an interpretation. The checker contains{' '}
        <Strong>no model call</Strong>. That is what makes the verdict
        reproducible, and it is the difference between a research system and a
        conversation.
      </P>

      <H2 id="ordering">Why ordering matters</H2>
      <P>
        Conditions are derived from what the modules measured, and are committed
        before the composite score is computed. That ordering is the whole
        safeguard. A condition written after the verdict is known would be
        tuned, consciously or not, to a threshold the evidence already clears,
        which would make the entire exercise decorative.
      </P>
      <Callout kind="warn" title="The constraint this puts on the product">
        <p>
          It means the system will sometimes commit to a condition that is
          promptly met, and report that the user&rsquo;s thesis is invalidated
          minutes after they submitted it. That outcome is not a bug to be
          smoothed over. It is the product working.
        </p>
      </Callout>

      <H2 id="honest">The honest failure mode</H2>
      <P>
        A stress-test-first tool has a failure mode of its own: it can be too
        eager to declare a thesis broken, which is just confirmation bias with
        the sign flipped. Three things guard against it. Conditions carry a{' '}
        <Code>sustain</Code> window, so a single noisy reading does not trip one.
        Severity is graded, so only a <Code>fatal</Code> condition can move a
        thesis to Invalidated. And state is reversible: a condition that
        recovers moves back from <Code>tripped</Code> to <Code>stressed</Code>,
        which has been observed in live operation.
      </P>
    </>
  ),
};

/* =======================================================================
 * The system
 * ==================================================================== */

const architecture: WPPage = {
  slug: 'architecture',
  title: 'How an investigation runs',
  summary: 'The five stages, and what each one is allowed to do.',
  toc: [
    { id: 'stages', label: 'The five stages' },
    { id: 'resolve', label: 'Resolution' },
    { id: 'debate', label: 'Disagreement' },
    { id: 'determinism', label: 'Determinism' },
  ],
  Body: () => (
    <>
      <H2 id="stages">The five stages</H2>
      <Table
        head={['Stage', 'Does', 'Constraint']}
        rows={[
          ['Resolve', 'Extracts the ticker and resolves it to a chain and contract via live search', 'Spot contracts only'],
          ['Investigate', 'Four modules gather evidence independently', 'No model calls'],
          ['Debate', 'Raises a challenge where two modules genuinely disagree', 'Challenger attaches its own evidence'],
          ['Commit', 'Derives six stress conditions from what was measured', 'Before the score is computed'],
          ['Monitor', 'Re-reads those conditions on a schedule', 'Bypasses cache and fixtures'],
        ]}
      />

      <H2 id="resolve">Resolution</H2>
      <P>
        The ticker is pulled out of the sentence and resolved against
        Nansen&rsquo;s live index, which costs nothing:{' '}
        <Code>search/general</Code> is a zero-credit endpoint, so asset search
        can be fully live without a budget consideration.
      </P>
      <Callout kind="warn" title="Perpetual markets are filtered out">
        <p>
          Nansen&rsquo;s index includes perp markets, and those rows carry the
          bare ticker in the address field. Hyperliquid&rsquo;s SOL market
          returns <Code>address: &quot;SOL&quot;</Code>. Passing that to a spot
          endpoint produces <Code>Invalid address format</Code>. Resolution
          therefore requires a real contract address, and the engine re-checks
          before any spot call. This was a live defect before it was a rule.
        </p>
      </Callout>

      <H2 id="debate">Disagreement</H2>
      <P>
        Most multi-agent systems stage a debate whether or not there is anything
        to debate, which produces the appearance of rigour and none of the
        substance. Here a challenge is raised <Strong>only</Strong> when two
        modules reach opposing stances, and the challenger&rsquo;s own evidence
        is attached to the message. The disagreement is inspectable rather than
        rhetorical, and when the modules agree, the interface says so and moves
        on.
      </P>

      <H2 id="determinism">Determinism</H2>
      <P>
        No language model runs in the research path. Modules are arithmetic over
        API responses; conditions are typed objects; the checker is a
        comparator. The same inputs produce the same read, which means a verdict
        can be re-derived and audited after the fact, and means the system
        cannot hallucinate a finding, because nothing in the path is capable of
        inventing one.
      </P>
    </>
  ),
};

const modules: WPPage = {
  slug: 'modules',
  title: 'The four research modules',
  summary: 'What each module reads, what it derives, and where it degrades.',
  toc: [
    { id: 'set', label: 'The module set' },
    { id: 'smart', label: 'Smart Money' },
    { id: 'flow', label: 'Capital Flow' },
    { id: 'holder', label: 'Holder Concentration' },
    { id: 'pattern', label: 'Pattern Memory' },
    { id: 'degrade', label: 'Graceful degradation' },
  ],
  Body: () => (
    <>
      <H2 id="set">The module set</H2>
      <Table
        head={['Module', 'Reads', 'Derives']}
        rows={[
          [
            'Smart Money',
            <Code key="a">tgm/flow-intelligence</Code>,
            'A flow term structure across six horizons and several wallet cohorts',
          ],
          ['Capital Flow', <Code key="b">tgm/flows</Code>, 'Net token movement, buy pressure as a share of turnover'],
          [
            'Holder Concentration',
            <Code key="c">tgm/who-bought-sold</Code>,
            'Net USD imbalance, top-3 share of volume, rotating-trader share',
          ],
          ['Pattern Memory', <Code key="d">tgm/token-ohlcv</Code>, "Analogues in the asset's own history, strictly point-in-time"],
        ]}
      />

      <H2 id="smart">Smart Money</H2>
      <P>
        Six calls at one credit each buy the signature signal: the same cohort
        netflows at 5m, 1h, 6h, 12h, 1d and 7d. The point is not any single
        figure but the <Strong>term structure</Strong>. If the short end is
        running slower than the long end, accumulation is decelerating even
        while it remains positive, and that is invisible in a single-timeframe
        read.
      </P>
      <P>
        Magnitude is deliberately split in two. A bare logarithm of dollars
        saturates, since $86K and $86M both pin the scale, so half the weight is
        the flow&rsquo;s <em>share of all tracked cohort activity</em>, which
        does not saturate. This was a real defect. An $86K flow once scored 100% confidence.
      </P>

      <H2 id="flow">Capital Flow</H2>
      <P>
        Net token movement and buy pressure as a proportion of turnover. The
        endpoint refuses whole asset classes, native tokens and stablecoins
        among them, so the module catches the rejection and degrades to a
        cohort-level read rather than failing the investigation, and says on the
        page which class it hit.
      </P>

      <H2 id="holder">Holder Concentration</H2>
      <P>
        Measured as <Strong>net USD imbalance across the whole trader set</Strong>,
        bounded to −1…+1, alongside top-3 share of volume and the proportion of
        traders active in both directions.
      </P>
      <Callout kind="stop" title="A bug worth documenting">
        <p>
          This module originally reported a count of net buyers as a ratio. It
          returned &ldquo;100 of 100&rdquo; on virtually every asset, because
          the endpoint returns the <em>top traders by volume</em> and those skew
          overwhelmingly to accumulators. The number was real, the inference was
          garbage, and it looked plausible enough to survive review. It was
          rebuilt on net USD imbalance, which cannot saturate that way.
        </p>
      </Callout>

      <H2 id="pattern">Pattern Memory</H2>
      <P>
        Past windows in the asset&rsquo;s own history with a similar return and
        volatility profile, and what happened next. Strictly point-in-time: only
        data available at the analogue date is used, so no forward information
        leaks into the comparison.
      </P>

      <H2 id="degrade">Graceful degradation</H2>
      <P>
        Confidence is capped by coverage. A module that received three candles
        cannot report 80% conviction, regardless of how clean those three
        candles look. Coverage is reported alongside the score rather than
        folded into it. See <A href="/whitepaper/scoring">Scoring</A>.
      </P>
    </>
  ),
};

const scoring: WPPage = {
  slug: 'scoring',
  title: 'Evidence Score and Data Coverage',
  summary: 'Two separate questions that most dashboards quietly merge.',
  toc: [
    { id: 'two', label: 'Two numbers, not one' },
    { id: 'weights', label: 'Module weights' },
    { id: 'independent', label: 'Independent corroboration' },
    { id: 'notprob', label: 'Not a probability' },
  ],
  Body: () => (
    <>
      <H2 id="two">Two numbers, not one</H2>
      <Lead>
        The <Strong>Evidence Score</Strong> says how strong and internally
        consistent the evidence is. <Strong>Data Coverage</Strong> says how much
        data actually backed the read. Merging them is the most common quiet
        dishonesty in the category.
      </Lead>
      <P>
        A thin read that happens to be unanimous and a deep read that is
        unanimous are not the same finding, but a single blended number renders
        them identically. Reporting both means a reader can see that an 80 built
        on 30% coverage is a different object from an 80 built on 95%.
      </P>

      <H2 id="weights">Module weights</H2>
      <Figure
        label="Composite weighting"
        caption="Read from the running system's WEIGHTS constant."
      >
        <WeightBar
          weights={[
            { label: 'Smart Money', weight: WEIGHTS['smart-money'], reads: 'tgm/flow-intelligence' },
            { label: 'Capital Flow', weight: WEIGHTS['flow-intelligence'], reads: 'tgm/flows' },
            { label: 'Holder Concentration', weight: WEIGHTS['holder-concentration'], reads: 'tgm/who-bought-sold' },
            { label: 'Pattern Memory', weight: WEIGHTS['pattern-memory'], reads: 'tgm/token-ohlcv' },
          ]}
        />
      </Figure>
      <Callout kind="warn" title="These weights are judgement">
        <p>
          They are not calibrated. Nothing has been backtested to justify
          35/25/20/20 over any other reasonable split. They reflect a view that
          cohort flow is the most informative single signal available at one
          credit. That is a view, not a result.
        </p>
      </Callout>

      <H2 id="independent">Independent corroboration</H2>
      <P>
        Every composite is combined with a substantial independent source,{' '}
        <A href="https://defillama.com">DeFiLlama</A>, read separately for
        chain TVL and stablecoin supply. It is displayed in its own panel,
        visually distinct, and explicitly labelled <em>not Nansen data</em>.
        Corroboration nudges the composite; it does not dominate it.
      </P>
      <P>
        This is simultaneously an analytical choice and a licensing requirement.
        See <A href="/whitepaper/compliance">Compliance</A>.
      </P>

      <H2 id="notprob">Not a probability</H2>
      <Callout kind="stop">
        <p>
          An Evidence Score of 72 does not mean a 72% chance of anything. It is
          an index of evidential strength and agreement, on a scale defined by
          this system and comparable only within it. It is never rendered as a
          probability, a confidence interval, or a recommendation, and the
          scoring code has no path that would produce one.
        </p>
      </Callout>
    </>
  ),
};

const conditions: WPPage = {
  slug: 'conditions',
  title: 'Stress conditions',
  summary: 'How a sentence becomes six things that can be checked.',
  toc: [
    { id: 'anatomy', label: 'Anatomy of a condition' },
    { id: 'derivation', label: 'How they are derived' },
    { id: 'severity', label: 'Severity' },
    { id: 'anchoring', label: 'Anchoring' },
  ],
  Body: () => (
    <>
      <H2 id="anatomy">Anatomy of a condition</H2>
      <P>
        Six conditions are committed per investigation. Each names the endpoint
        and field it reads, a comparator, a threshold, a sustain window and a
        severity: everything needed to evaluate it later without
        interpretation.
      </P>
      <Table
        head={['Field', 'Purpose']}
        rows={[
          [<Code key="1">metric</Code>, 'Endpoint, field and params: makes the condition re-readable'],
          [<Code key="2">comparator</Code>, 'Less than, greater than, or crosses'],
          [<Code key="3">threshold</Code>, 'The value that constitutes refutation'],
          [<Code key="4">sustain</Code>, 'How long it must hold, so noise does not trip it'],
          [<Code key="5">severity</Code>, 'fatal, major or minor'],
          [<Code key="6">status</Code>, 'holding, stressed or tripped'],
        ]}
      />

      <H2 id="derivation">How they are derived</H2>
      <P>
        Conditions come from what the modules actually measured on this asset,
        not from a template. If Smart Money measured a positive 7-day
        smart-trader netflow, the condition binds to that field and sets the
        threshold relative to the observed value. An asset where a module
        degraded produces fewer conditions bound to that module, rather than a
        placeholder condition that would always hold.
      </P>

      <H2 id="severity">Severity</H2>
      <UL>
        <LI>
          <Strong>Fatal.</Strong> If met, the thesis is invalidated. These bind to
          the mechanism the user actually claimed.
        </LI>
        <LI>
          <Strong>Major.</Strong> Meaningful pressure. Enough to move the thesis to
          Under pressure, not enough to end it.
        </LI>
        <LI>
          <Strong>Minor.</Strong> A supporting observation that has stopped
          supporting.
        </LI>
      </UL>

      <H2 id="anchoring">Anchoring</H2>
      <Callout kind="warn" title="Tautological thresholds">
        <p>
          An early version anchored a price condition to the current return,
          which made it trivially true at the moment of writing and therefore
          worthless. Price conditions now anchor to a 21-day swing low : a level
          that existed before the thesis did, and that the thesis can genuinely
          fail against.
        </p>
      </Callout>
    </>
  ),
};

const monitoring: WPPage = {
  slug: 'monitoring',
  title: 'Monitoring and state',
  summary: 'What happens after the investigation closes.',
  toc: [
    { id: 'loop', label: 'The monitoring loop' },
    { id: 'states', label: 'States' },
    { id: 'precedence', label: 'Precedence' },
    { id: 'observed', label: 'Observed in operation' },
  ],
  Body: () => (
    <>
      <H2 id="loop">The monitoring loop</H2>
      <P>
        A monitored thesis re-reads <Strong>only the metrics its conditions are
        bound to</Strong>. Nothing new is invented to monitor, and no module is
        re-run wholesale. A core check costs 2 credits; every sixth cycle runs a
        deeper check at 5.
      </P>
      <Callout kind="note" title="Monitoring never reads from cache">
        <p>
          The monitor sets <Code>cacheTtlMs: 0</Code> and bypasses the fixture
          layer entirely. A cached answer would defeat the entire purpose, because the
          question being asked is specifically &ldquo;has this changed since
          last time?&rdquo;
        </p>
      </Callout>
      <P>
        If the key runs out of credits, the job auto-pauses and records why,
        rather than silently reporting that all conditions still hold. A monitor
        that cannot read is distinguishable from a monitor that read and found
        nothing.
      </P>

      <H2 id="states">States</H2>
      <Figure label="Thesis states" caption="The state is derived, not stored. It is recomputed from the conditions and module stances on every read.">
        <StateMachine />
      </Figure>

      <H2 id="precedence">Precedence</H2>
      <P>
        Order matters, and getting it wrong produces a genuinely misleading
        interface. A fatal trip outranks everything. But zero module support
        outranks a merely stressed condition. If no module supports the claim,
        the thesis is Challenged, not Under pressure.
      </P>
      <Pre>{`if (fatalTripped) return 'INVALIDATED';

// No module supports the claim: the modules themselves contradict it,
// and that outranks "a condition is under pressure".
if (support === 0 && challenge > 0) return 'CHALLENGED';

if (anyTripped || anyStressed) return 'UNDER_STRESS';`}</Pre>
      <P>
        Before this ordering existed, a thesis with zero support and four
        challenges rendered as Under pressure, which reads as &ldquo;intact but losing force&rdquo;
        when the correct reading was &ldquo;the evidence contradicts this.&rdquo;
      </P>

      <H2 id="observed">Observed in operation</H2>
      <P>
        The central promise is that a verdict changes on its own. It does. Two
        monitored theses moved from Under pressure to Invalidated on live data after
        their investigations had closed, and a third recovered from{' '}
        <Code>tripped</Code> back to <Code>stressed</Code>, confirming the state
        machine is not a one-way ratchet toward bad news.
      </P>
    </>
  ),
};

/* =======================================================================
 * Nansen integration
 * ==================================================================== */

const integration: WPPage = {
  slug: 'integration',
  title: 'Integration architecture',
  summary: 'One client, one registry, one ledger.',
  toc: [
    { id: 'chokepoint', label: 'A single chokepoint' },
    { id: 'ledger', label: 'The ledger' },
    { id: 'fixtures', label: 'Record and replay' },
    { id: 'billing', label: 'Credit accounting' },
  ],
  Body: () => (
    <>
      <H2 id="chokepoint">A single chokepoint</H2>
      <P>
        Every request goes through one client. Cost lookup, budget enforcement,
        rate limiting and ledger recording all live there, so none of them can
        be bypassed by adding a call somewhere new. There is no second path to
        the API, deliberately, including no MCP path, because a parallel route
        would break the counting guarantee the whole submission rests on.
      </P>

      <H2 id="ledger">The ledger</H2>
      <P>
        Every request appends a row: endpoint, credits, Nansen request id,
        remaining balance, status, latency, and, critically, its{' '}
        <Code>source</Code>.
      </P>
      <Pre>{`source TEXT NOT NULL CHECK (source IN ('live','cache','fixture'))`}</Pre>
      <P>
        That constraint is enforced by the database rather than left to
        convention. Only <Code>live</Code> rows are real network calls against
        the API key, and only those are ever counted. See{' '}
        <A href="/whitepaper/verification">Verification</A>.
      </P>

      <H2 id="fixtures">Record and replay</H2>
      <P>
        A response is recorded once and replayed at zero credits thereafter.
        This is how the application was developed against a trial key without
        burning the budget on iteration.
      </P>
      <Callout kind="note" title="Fixture identity ignores dates">
        <p>
          The cache key canonicalises ISO date strings out of the request body.
          Without that, a rolling 7-day window makes every request unique and
          the entire fixture set expires nightly. Which it did, until the hash was
          changed.
        </p>
      </Callout>

      <H2 id="billing">Credit accounting</H2>
      <P>
        The client trusts <Code>x-nansen-credits-used</Code> from the response
        header rather than assuming the endpoint&rsquo;s list price. A rejected
        request bills zero, and an early version that charged itself for its own
        422s reported a credit burn that never happened.
      </P>
      <Pre>{`const usedHeader = res.headers.get('x-nansen-credits-used');
const parsed = usedHeader === null ? NaN : Number(usedHeader);
const used = Number.isFinite(parsed)
  ? parsed
  : res.ok ? spec.credits : 0;`}</Pre>
    </>
  ),
};

const costStrategy: WPPage = {
  slug: 'cost-strategy',
  title: 'Cost-aware data strategy',
  summary: 'The economics of the Nansen API, and how the pipeline is shaped around them.',
  toc: [
    { id: 'premise', label: 'The premise' },
    { id: 'spread', label: 'Cost across the surface' },
    { id: 'tiers', label: 'Tiered request strategy' },
    { id: 'ledger', label: 'The request ledger' },
    { id: 'live', label: 'Live consumption' },
  ],
  Body: async () => {
    const u = await getUsage();
    const rows = Object.values(ENDPOINTS)
      .map((e) => ({ path: e.path, credits: e.credits, tier: e.tier as string }))
      .sort((a, b) => a.credits - b.credits);

    const perLive = u.liveCalls > 0 ? u.creditsConsumed / u.liveCalls : 0;

    return (
      <>
        <H2 id="premise">The premise</H2>
        <Lead>
          ThesisArena is designed around the economics of the Nansen API. Credit
          costs vary significantly across endpoints, so the investigation
          pipeline is deliberately structured to spend credits where they
          provide the most research value.
        </Lead>
        <P>
          This is part of the product architecture rather than an implementation
          detail. The goal is to maximise evidential value per API credit, and
          that objective shapes which endpoints exist in the research path at
          all.
        </P>

        <H2 id="spread">Cost across the surface</H2>
        <Figure
          label="Credit cost by endpoint"
          caption="Read from the endpoint registry the client enforces at runtime."
        >
          <CreditSpread rows={rows} />
        </Figure>
        <P>
          The spread exceeds 500×. A naive implementation reaches for the
          richest-sounding endpoint and discovers it has spent 750 credits on a
          single call. The registry makes cost a property of the endpoint that
          the client consults before every request, rather than something a
          developer is expected to remember.
        </P>

        <H2 id="tiers">Tiered request strategy</H2>
        <UL>
          <LI>
            <Strong>Low-cost endpoints</Strong> run as the default
            investigation layer.
          </LI>
          <LI>
            <Strong>Mid-cost endpoints</Strong> are invoked when the initial
            evidence is inconclusive.
          </LI>
          <LI>
            <Strong>High-cost endpoints</Strong> require explicit conditions
            before they are used.
          </LI>
          <LI>
            <Strong>Blocked or non-redistributable endpoints</Strong> are
            excluded from the public research path entirely.
          </LI>
        </UL>
        <Table
          head={['Tier', 'Cost', 'When it runs']}
          rows={[
            ['Low', '0 to 1 credits', 'Always'],
            ['Mid', '5 credits', 'Only when the cheap tier is inconclusive'],
            ['High', '25 credits', 'Explicit opt-in per call'],
            ['Blocked', 'never spent', 'Throws; never reached'],
          ]}
          align={['left', 'right', 'left']}
        />
        <P>
          The blocked tier matters more than it looks. Endpoints that are
          ruinously expensive or prohibited for display do not merely go
          uncalled by convention. The client raises rather than calling them, so
          avoidance is structural rather than a matter of discipline.
        </P>

        <H2 id="ledger">The request ledger</H2>
        <P>
          Every live Nansen request is recorded with its endpoint, request id,
          credit usage, status, latency and remaining balance. Rejected requests
          are billed as zero credits, and cache or fixture replays do not count
          as live network calls.
        </P>
        <Callout kind="note" title="Why the distinction is enforced in the schema">
          <p>
            A <Code>CHECK</Code> constraint restricts the source column to{' '}
            <Code>live</Code>, <Code>cache</Code> or <Code>fixture</Code>.
            Counting a replay as an API call would be the easiest possible way
            to inflate the numbers, so the database refuses it rather than
            leaving it to convention.
          </p>
        </Callout>

        <H2 id="live">Live consumption</H2>
        <P>
          Measured from the ledger on this instance, right now: <LiveTag />
        </P>
        <Stats
          items={[
            {
              label: 'Live calls',
              value: u.liveCalls.toLocaleString(),
              note: 'real network requests only',
            },
            {
              label: 'Credits consumed',
              value: u.creditsConsumed.toLocaleString(),
              note: `${perLive.toFixed(2)} per call`,
            },
            {
              label: 'Credits remaining',
              value: u.creditsRemaining?.toLocaleString() ?? 'n/a',
              note: 'from the response header',
            },
            {
              label: 'Zero-cost replays',
              value: (u.cacheHits + u.fixtureReplays).toLocaleString(),
              note: 'never counted as calls',
            },
          ]}
        />
        <P>
          An average below the headline rate is the tiering working. The
          workhorse endpoints are the cheap ones, and the expensive tier is
          reached only on purpose.
        </P>
      </>
    );
  },
};

const compliance: WPPage = {
  slug: 'compliance',
  title: 'Redistribution and compliance',
  summary: "Nansen's terms, enforced as code paths rather than policy text.",
  toc: [
    { id: 'terms', label: 'What the terms require' },
    { id: 'classes', label: 'Redistribution classes' },
    { id: 'enforce', label: 'How it is enforced' },
    { id: 'attribution', label: 'Attribution' },
  ],
  Body: () => {
    const all = Object.values(ENDPOINTS);
    const blocked = all.filter((e) => e.tier === 'blocked');
    const restricted = all.filter((e) => e.redistribution === 'restricted');

    return (
      <>
        <H2 id="terms">What the terms require</H2>
        <P>
          Nansen permits derived analysis but prohibits republishing its
          proprietary signals. Meeting that is not a matter of avoiding a few
          endpoints; it constrains what may be rendered, and it requires the
          output to be meaningfully combined with a substantial independent
          source.
        </P>
        <Callout kind="warn" title="This reshaped the product">
          <p>
            An earlier design let a user click each researcher and inspect the
            raw Nansen evidence behind it. That is precisely what the terms
            prohibit. The resolution, restricted data entering only as a weighted term inside
            a composite, turned out to be the better product, and
            it is also what Nansen&rsquo;s own documentation gives as a
            compliant example.
          </p>
        </Callout>

        <H2 id="classes">Redistribution classes</H2>
        <Table
          head={['Class', 'Meaning', 'May be rendered raw']}
          rows={[
            ['allowed', 'Freely redistributable', 'Yes'],
            ['attribution', 'Redistributable with attribution', 'Yes, attributed'],
            ['restricted', 'Composite input only', 'No'],
            ['prohibited', 'Never called, never rendered', 'No'],
          ]}
        />

        <H2 id="enforce">How it is enforced</H2>
        <UL>
          <LI>
            <Strong>{blocked.length} endpoints are blocked</Strong> in the
            registry. The client raises rather than calling them.
          </LI>
          <LI>
            <Strong>{restricted.length} endpoint{restricted.length === 1 ? '' : 's'} are restricted.</Strong>{' '}
            Values contribute weighted terms to a composite and are tagged{' '}
            <em>derived</em> wherever they surface.
          </LI>
          <LI>
            <Strong>A render guard,</Strong>{' '}
            <Code>assertDisplayable()</Code>, throws if raw values from a
            restricted or prohibited class reach the render layer. It is covered
            by a test, which is the compliance proof.
          </LI>
          <LI>
            <Strong>An independent source is required,</Strong> not optional.
            Every composite is combined with DeFiLlama, shown in its own panel
            and labelled <em>not Nansen data</em>.
          </LI>
        </UL>

        <H2 id="attribution">Attribution</H2>
        <P>
          <Strong>Powered by Nansen API</Strong> appears in the footer and on
          every shareable result card, so attribution travels with the output
          rather than living only on the site.
        </P>
      </>
    );
  },
};

/* =======================================================================
 * Appendix
 * ==================================================================== */

const verification: WPPage = {
  slug: 'verification',
  title: 'Verification',
  summary: 'How to check the claims in this document.',
  toc: [
    { id: 'counting', label: 'What counts as a call' },
    { id: 'now', label: 'Current ledger' },
    { id: 'export', label: 'Exporting the evidence' },
    { id: 'tests', label: 'Tests' },
  ],
  Body: async () => {
    const u = await getUsage();
    return (
      <>
        <H2 id="counting">What counts as a call</H2>
        <Lead>
          Only a real network request against the Nansen key counts. Cache hits
          and fixture replays are recorded, displayed, and excluded.
        </Lead>
        <P>
          This is the kind of claim that is easy to make and rarely enforced, so
          it is enforced in the schema rather than in a function someone could
          forget to call. Call volume comes from investigations users run and
          from monitoring checks re-reading conditions committed to in advance
          across a portfolio of distinct theses, not from a loop around a cheap
          endpoint.
        </P>

        <H2 id="now">Current ledger</H2>
        <P>
          Read from this instance at page load: <LiveTag />
        </P>
        <Stats
          items={[
            { label: 'Live calls', value: u.liveCalls.toLocaleString(), note: 'counted' },
            { label: 'Successful', value: u.successfulCalls.toLocaleString(), note: 'HTTP 200' },
            { label: 'Failed', value: u.failedCalls.toLocaleString(), note: 'billed 0 credits' },
            {
              label: 'Excluded',
              value: (u.cacheHits + u.fixtureReplays).toLocaleString(),
              note: 'cache hits and replays',
            },
          ]}
        />
        <P>
          The full request ledger, with per-endpoint and per-source breakdowns,
          is at <A href="/analytics">Analytics</A>.
        </P>

        <H2 id="export">Exporting the evidence</H2>
        <Pre>{`npx tsx scripts/export-ledger.ts

export/nansen-requests.csv   every live call with its Nansen request id
export/usage-summary.json    totals, per-endpoint and per-context breakdown`}</Pre>
        <P>
          Each row carries the request id Nansen returned, so the ledger is
          checkable against Nansen&rsquo;s own records rather than being taken
          on trust.
        </P>

        <H2 id="tests">Tests</H2>
        <P>
          The suite asserts the claims this product makes about itself. Several
          tests encode defects that reached the interface and were fixed: the
          score clamp that made every broken thesis score exactly 35, the status
          precedence that mislabelled contradicted theses, the perp-address
          filter, and the negative-zero formatter. A regression there is a
          regression in the product&rsquo;s honesty, not just its output.
        </P>
      </>
    );
  },
};

/* =======================================================================
 * Registry
 * ==================================================================== */

export const SECTIONS: WPSection[] = [
  { name: 'Introduction', pages: [overview, problem, principle] },
  {
    name: 'The system',
    pages: [architecture, modules, scoring, conditions, monitoring, costStrategy],
  },
  { name: 'Nansen', pages: [integration, compliance] },
  { name: 'Appendix', pages: [verification] },
];

export const PAGES: WPPage[] = SECTIONS.flatMap((s) => s.pages);

export function findPage(slug: string): WPPage | undefined {
  return PAGES.find((p) => p.slug === slug);
}

/** Previous and next in reading order, for the footer pager. */
export function neighbours(slug: string) {
  const i = PAGES.findIndex((p) => p.slug === slug);
  return { prev: i > 0 ? PAGES[i - 1] : null, next: i >= 0 && i < PAGES.length - 1 ? PAGES[i + 1] : null };
}

export function href(page: WPPage): string {
  return page.slug ? `/whitepaper/${page.slug}` : '/whitepaper';
}
