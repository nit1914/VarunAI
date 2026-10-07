"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MapSite } from "./DrainMap";
import type { ExplainedScore } from "../lib/scoring/priority.ts";
import type { RainfallScenario } from "../lib/scoring/rainfallScenarios.ts";

export type DashboardRecord = MapSite & {
  verifiedReduction?: number;
};

export type DemoScenario = {
  id: string;
  title: string;
  description: string;
  blockage: number;
  litter: number;
  rainfallMm: number;
  status: string;
  environmentalDistanceMeters: number | null;
};

export type VerificationCheck = {
  label: string;
  detail: string;
  state: "pass" | "fail" | "waiting";
};

function levelLabel(level: ExplainedScore["level"]) {
  return level === "moderate" ? "Moderate" : `${level[0].toUpperCase()}${level.slice(1)}`;
}

export function PriorityExplanation({
  priority,
  environmental,
  action,
}: {
  priority: ExplainedScore;
  environmental: ExplainedScore;
  action: string;
}) {
  return (
    <section className="explanation-panel" aria-labelledby="priority-explanation-title">
      <div className="explanation-heading">
        <div>
          <span className="kicker">Why this priority?</span>
          <h3 id="priority-explanation-title">Every point has a visible reason.</h3>
        </div>
        <div className={`explanation-score level-${priority.level}`}>
          <span>Cleanup priority</span>
          <strong>{priority.score}<small>/100</small></strong>
          <b>{levelLabel(priority.level)}</b>
        </div>
      </div>
      <div className="factor-grid">
        {environmental.factors.map((factor) => (
          <article key={factor.key} className={factor.rawValue === null ? "factor-unavailable" : ""}>
            <div className="factor-topline">
              <span>{factor.name}</span>
              <b>{factor.rawValue === null ? "Unavailable" : `${Math.round(factor.rawValue)}/100`}</b>
            </div>
            <div className="factor-bar" aria-label={`${factor.name}: ${factor.rawValue === null ? "unavailable" : `${Math.round(factor.rawValue)} out of 100`}`}>
              <span style={{ width: `${factor.rawValue ?? 0}%` }} />
            </div>
            <p>{factor.explanation}</p>
            <small>{factor.contribution === null ? "Not included" : `${Math.round(factor.weight * 100)}% weight · ${factor.contribution.toFixed(1)} points`}</small>
          </article>
        ))}
      </div>
      <div className="environmental-result">
        <div>
          <span>Environmental impact risk</span>
          <strong>{environmental.score}/100 · {levelLabel(environmental.level)}</strong>
        </div>
        <div>
          <span>Evidence coverage</span>
          <strong>{environmental.coverage}% · {environmental.confidence} confidence</strong>
        </div>
        <p><b>Recommended action:</b> {action}</p>
      </div>
      <p className="decision-disclaimer">Environmental decision-support estimate. This helps prioritize inspection using visible blockage, litter evidence, rainfall conditions, and mapped environmental context. It is not a hydrological model or a prediction of pollution volume.</p>
    </section>
  );
}

export function RainfallScenarioExplorer({
  scenarios,
  onApply,
}: {
  scenarios: RainfallScenario[];
  onApply: (rainfallMm: number) => void;
}) {
  return (
    <section className="scenario-explorer" aria-labelledby="scenario-title">
      <div className="scenario-heading">
        <div><span className="kicker">Rainfall scenario explorer</span><h3 id="scenario-title">One drain. Three operating conditions.</h3></div>
        <p>Scenario exploration for decision support. These are controlled inputs, not a weather forecast or a prediction of flooding or pollution volume.</p>
      </div>
      <div className="scenario-grid">
        {scenarios.map((scenario) => (
          <button key={scenario.key} type="button" onClick={() => onApply(scenario.rainfallMm)}>
            <span>{scenario.label}</span>
            <strong>{scenario.priority}<small>/100 cleanup</small></strong>
            <div className="scenario-bar"><i style={{ width: `${scenario.priority}%` }} /></div>
            <p>{scenario.rainfallMm} mm input · environmental concern {scenario.environmentalRisk}/100</p>
            <b>Apply scenario →</b>
          </button>
        ))}
      </div>
    </section>
  );
}

export function EnvironmentalDashboard({ records }: { records: DashboardRecord[] }) {
  const liveRecords = useMemo(() => records.filter((record) => !record.isDemo), [records]);
  const demoRecords = useMemo(() => records.filter((record) => record.isDemo), [records]);
  const [showDemo, setShowDemo] = useState(false);
  const activeRecords = showDemo ? demoRecords : liveRecords;
  const metrics = useMemo(() => {
    let highConcern = 0;
    let awaitingCleanup = 0;
    let verified = 0;
    let review = 0;
    let reductionTotal = 0;
    let reductionCount = 0;
    const distribution = { low: 0, moderate: 0, high: 0, critical: 0 };

    for (const record of activeRecords) {
      const environmentalRisk = record.environmentalRisk ?? record.risk;
      if (environmentalRisk >= 60) highConcern += 1;
      if (record.status === "Verified clear") verified += 1;
      else awaitingCleanup += 1;
      if (record.status === "Needs review") review += 1;
      if (typeof record.verifiedReduction === "number") {
        reductionTotal += record.verifiedReduction;
        reductionCount += 1;
      }
      if (environmentalRisk >= 80) distribution.critical += 1;
      else if (environmentalRisk >= 60) distribution.high += 1;
      else if (environmentalRisk >= 40) distribution.moderate += 1;
      else distribution.low += 1;
    }
    return {
      total: activeRecords.length,
      highConcern,
      awaitingCleanup,
      verified,
      review,
      averageReduction: reductionCount ? Math.round(reductionTotal / reductionCount) : null,
      distribution,
    };
  }, [activeRecords]);

  return (
    <section className="impact-dashboard" id="dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard-heading">
        <div><span className="kicker">Live impact story</span><h2 id="dashboard-title">What changed because we prioritized these drains?</h2></div>
        <div className="dataset-toggle" role="group" aria-label="Dashboard dataset">
          <button className={!showDemo ? "active" : ""} type="button" onClick={() => setShowDemo(false)}>Live reports</button>
          <button className={showDemo ? "active" : ""} type="button" onClick={() => setShowDemo(true)}>Demo preview</button>
        </div>
      </div>
      <p className="dataset-label">{showDemo ? "Sample data for demonstration — never presented as municipal impact." : "Calculated only from reports added on this device. Demo scenarios are excluded."}</p>
      {metrics.total === 0 ? (
        <div className="dashboard-empty">
          <strong>No live reports yet.</strong>
          <p>Add a location after inspecting a photo, or select Demo preview to see how the dashboard responds.</p>
        </div>
      ) : (
        <>
          <div className="metric-grid">
            <article><span>Total reports</span><strong>{metrics.total}</strong><small>in selected dataset</small></article>
            <article><span>High concern</span><strong>{metrics.highConcern}</strong><small>environmental risk ≥ 60</small></article>
            <article><span>Awaiting cleanup</span><strong>{metrics.awaitingCleanup}</strong><small>not verified clear</small></article>
            <article><span>Verified cleanups</span><strong>{metrics.verified}</strong><small>evidence checks passed</small></article>
            <article><span>Human review</span><strong>{metrics.review}</strong><small>uncertain evidence</small></article>
            <article><span>Avg. improvement</span><strong>{metrics.averageReduction ?? "—"}</strong><small>{metrics.averageReduction === null ? "no verified pairs" : "obstruction points"}</small></article>
          </div>
          <div className="distribution-card">
            <div><span>Reports by environmental risk level</span><strong>{metrics.total} total</strong></div>
            {Object.entries(metrics.distribution).map(([level, count]) => (
              <div className="distribution-row" key={level}>
                <span>{level}</span>
                <div><i className={`distribution-${level}`} style={{ width: `${metrics.total ? (count / metrics.total) * 100 : 0}%` }} /></div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

const shockLabels = [
  { value: 0, label: "☀ Dry" },
  { value: 8, label: "🌦 Light rain" },
  { value: 24, label: "🌧 Moderate rain" },
  { value: 64, label: "⛈ Heavy rain" },
];

function shockLabel(rainfall: number) {
  if (rainfall >= 48) return "⛈ Heavy rain";
  if (rainfall >= 16) return "🌧 Moderate rain";
  if (rainfall > 0) return "🌦 Light rain";
  return "☀ Dry";
}

export type ActionPlan = {
  rankedOpen: MapSite[];
  selected: MapSite[];
  nextWave: MapSite[];
  crewPlans: MapSite[][];
};

export function buildActionPlan(sites: MapSite[], crews: number, capacity: number): ActionPlan {
  const rankedOpen = sites
    .filter((site) => !["Verified clear", "Needs review"].includes(site.status))
    .sort((a, b) => b.risk - a.risk);
  const selected = rankedOpen.slice(0, Math.min(capacity, rankedOpen.length));
  const nextWave = rankedOpen.slice(selected.length);
  const crewPlans = Array.from({ length: crews }, (_, crewIndex) => selected.filter((_, index) => index % crews === crewIndex));
  return { rankedOpen, selected, nextWave, crewPlans };
}

export function PriorityShockPanel({
  sites,
  rainfall,
  crews,
  capacity,
  rippleVersion,
  onRainfallChange,
}: {
  sites: MapSite[];
  rainfall: number;
  crews: number;
  capacity: number;
  rippleVersion: number;
  onRainfallChange: (value: number) => void;
}) {
  const rankedSites = useMemo(() => [...sites].sort((a, b) => b.risk - a.risk), [sites]);
  const currentPlan = useMemo(() => buildActionPlan(rankedSites, crews, capacity), [capacity, crews, rankedSites]);
  const rankSnapshot = useMemo(() => Object.fromEntries(rankedSites.map((site, index) => [site.id, index + 1])), [rankedSites]);
  const scoreSnapshot = useMemo(() => Object.fromEntries(rankedSites.map((site) => [site.id, site.risk])), [rankedSites]);
  const previousRanksRef = useRef<Record<string, number>>({});
  const previousScoresRef = useRef<Record<string, number>>({});
  const previousPlanRef = useRef<ActionPlan | null>(null);
  const previousRippleRef = useRef(rippleVersion);
  const [previousRanks, setPreviousRanks] = useState<Record<string, number>>({});
  const [previousScores, setPreviousScores] = useState<Record<string, number>>({});
  const [previousPlan, setPreviousPlan] = useState<ActionPlan | null>(null);
  const [ripplePhase, setRipplePhase] = useState<"idle" | "conditions" | "recalculating" | "updated">("idle");

  useEffect(() => {
    if (previousRippleRef.current !== rippleVersion) {
      setPreviousRanks(previousRanksRef.current);
      setPreviousScores(previousScoresRef.current);
      setPreviousPlan(previousPlanRef.current);
      setRipplePhase("conditions");
      const recalculateTimer = window.setTimeout(() => setRipplePhase("recalculating"), 420);
      const updatedTimer = window.setTimeout(() => setRipplePhase("updated"), 980);
      const resetTimer = window.setTimeout(() => setRipplePhase("idle"), 3600);
      previousRippleRef.current = rippleVersion;
      previousRanksRef.current = rankSnapshot;
      previousScoresRef.current = scoreSnapshot;
      previousPlanRef.current = currentPlan;
      return () => {
        window.clearTimeout(recalculateTimer);
        window.clearTimeout(updatedTimer);
        window.clearTimeout(resetTimer);
      };
    }
    previousRanksRef.current = rankSnapshot;
    previousScoresRef.current = scoreSnapshot;
    previousPlanRef.current = currentPlan;
  }, [currentPlan, rankSnapshot, rippleVersion, scoreSnapshot]);

  const changedCount = rankedSites.filter((site) => previousRanks[site.id] && previousRanks[site.id] !== rankSnapshot[site.id]).length;
  const urgentCount = rankedSites.filter((site) => site.risk >= 80).length;
  const beforeRanked = previousRanks
    ? [...rankedSites].sort((a, b) => (previousRanks[a.id] ?? 99) - (previousRanks[b.id] ?? 99)).slice(0, 3)
    : [];
  const beforePlan = previousPlan?.selected ?? [];
  const afterPlan = currentPlan.selected;
  const planChanged = beforePlan.length > 0 && beforePlan.map((site) => site.id).join(",") !== afterPlan.map((site) => site.id).join(",");

  return (
    <section className="priority-shock" aria-labelledby="priority-shock-title">
      <div className="priority-shock-head">
        <div><span className="kicker">⚡ Priority Shock</span><h3 id="priority-shock-title">Same drains. Different conditions. Different priorities.</h3></div>
        <strong>{shockLabel(rainfall)}</strong>
      </div>
      <p className="priority-shock-note">Change the rainfall scenario and watch the existing scoring logic update priority, environmental concern, and the ranked queue. This is scenario exploration for decision support—not a weather forecast or flood prediction.</p>
      <div className="shock-control">
        <div className="shock-control-label"><span>Rainfall input</span><strong>{rainfall} mm / 24h</strong></div>
        <input type="range" min="0" max="64" step="1" value={rainfall} onChange={(event) => onRainfallChange(Number(event.target.value))} aria-label="Priority Shock rainfall input" />
        <div className="shock-scale"><span>0 mm · Dry</span><span>64+ mm · Heavy</span></div>
        <div className="shock-presets">{shockLabels.map((preset) => <button type="button" key={preset.value} className={rainfall === preset.value ? "active" : ""} onClick={() => onRainfallChange(preset.value)}>{preset.label}</button>)}</div>
      </div>
      {ripplePhase !== "idle" && <div className={`decision-ripple-status ripple-${ripplePhase}`} role="status" aria-live="polite">
        <strong>{ripplePhase === "conditions" ? "Conditions changed" : ripplePhase === "recalculating" ? "Recalculating inspection priorities" : "⚡ ACTION PLAN UPDATED"}</strong>
        <span>{ripplePhase === "conditions" ? "The rainfall input is different." : ripplePhase === "recalculating" ? "Only evidence-linked values are being refreshed." : "The queue settled, then the crew plan followed it."}</span>
      </div>}
      <div className="shock-summary" aria-live="polite">
        <div><span>Current condition</span><strong>{shockLabel(rainfall)}</strong><small>{rainfall} mm selected</small></div>
        <div><span>Urgent inspection</span><strong>{urgentCount}</strong><small>reports at 80+ priority</small></div>
        <div><span>Priority movement</span><strong>{changedCount ? `${changedCount} changed` : "Ready"}</strong><small>{changedCount ? "conditions changed the queue" : "move rainfall to compare"}</small></div>
      </div>
      <div className="shock-queue" aria-label="Priority Shock ranked queue">
        {rankedSites.map((site) => {
          const rank = rankSnapshot[site.id];
          const oldRank = previousRanks[site.id];
          const movement = oldRank ? oldRank - rank : 0;
          const oldScore = previousScores[site.id];
          return (
            <details className="shock-report" key={site.id} open={rank === 1}>
              <summary>
                <span className="shock-rank">#{rank}</span>
                <span className="shock-place"><strong>{site.id}</strong><small>{site.place}</small></span>
                <span className="shock-priority"><b>{site.risk}</b><small>/100</small></span>
                <span className={`rank-movement ${movement > 0 ? "up" : movement < 0 ? "down" : "steady"}`}>{movement > 0 ? `↑ ${movement}` : movement < 0 ? `↓ ${Math.abs(movement)}` : "—"}</span>
              </summary>
              <div className="shock-report-detail">
                <p>{site.status === "Verified clear" ? "Cleanup already verified; this report remains visible for routine monitoring." : (site.blockage ?? 0) >= 70 ? "Severe visible obstruction remains the strongest priority contributor." : "Visible evidence remains lower than the reports above it."}</p>
                {oldRank && oldRank !== rank && <div className="shock-change"><strong>Why did this change?</strong><span>Rank #{oldRank} → #{rank} · priority {oldScore ?? "—"} → {site.risk}</span><small>The visible blockage and litter stayed tied to this report; the selected rainfall scenario changed the urgency component.</small></div>}
              </div>
            </details>
          );
        })}
      </div>
      {previousRanks && Object.keys(previousRanks).length > 0 && rippleVersion > 0 && (
        <div className="decision-compare" aria-label="Before and after decision comparison">
          <div className="decision-compare-head"><span>Before / after decision</span><strong>Same reports. Same crew. New conditions.</strong></div>
          <div className="decision-compare-grid">
            <div><small>Before conditions change</small><h4>Priority ranking</h4>{beforeRanked.map((site) => <p key={site.id}><b>#{previousRanks[site.id]}</b><span>{site.id}</span><em>{previousScores[site.id] ?? site.risk}</em></p>)}<h4>Crew plan</h4><p className="decision-plan">{beforePlan.length ? beforePlan.map((site) => site.id).join(" → ") : "No dispatchable reports"}</p></div>
            <div className="decision-compare-after"><small>After conditions change</small><h4>Priority ranking</h4>{rankedSites.slice(0, 3).map((site, index) => <p key={site.id}><b>#{index + 1}</b><span>{site.id}</span><em>{site.risk}</em></p>)}<h4>Crew plan</h4><p className="decision-plan">{afterPlan.length ? afterPlan.map((site) => site.id).join(" → ") : "No dispatchable reports"}</p></div>
          </div>
          {planChanged && <strong className="decision-ripple-callout">{crews} {crews === 1 ? "crew" : "crews"}. {afterPlan.length} inspections. Different decision.</strong>}
        </div>
      )}
    </section>
  );
}

export function ActionPlanner({
  sites,
  crews,
  capacity,
  onCrewsChange,
  onCapacityChange,
  rippleVersion,
}: {
  sites: MapSite[];
  crews: number;
  capacity: number;
  onCrewsChange: (value: number) => void;
  onCapacityChange: (value: number) => void;
  rippleVersion: number;
}) {
  const plan = useMemo(() => buildActionPlan(sites, crews, capacity), [capacity, crews, sites]);
  const { rankedOpen, selected, nextWave, crewPlans } = plan;
  const [planChanged, setPlanChanged] = useState(false);
  useEffect(() => {
    if (rippleVersion === 0) return;
    // Keep the transition visible long enough for the queue and plan to be read together.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlanChanged(true);
    const timer = window.setTimeout(() => setPlanChanged(false), 3000);
    return () => window.clearTimeout(timer);
  }, [rippleVersion]);
  const lastSelected = selected[selected.length - 1];

  return (
    <section className="action-planner" aria-labelledby="action-planner-title">
      <div className="action-planner-head"><div><span className="kicker">🚚 Action Planner</span><h3 id="action-planner-title">If you only have one crew, where should it go?</h3></div><strong>{selected.length} of {rankedOpen.length} reports planned</strong></div>
      <p className="action-planner-note">Transparent capacity allocation—not route optimization. DrainGuard selects the highest-priority dispatchable reports using the current scenario and distributes them across available crews. Human-review cases stay with the review queue.</p>
      <div className="planner-controls">
        <label><span>Available crews</span><select value={crews} onChange={(event) => onCrewsChange(Number(event.target.value))}>{[1, 2, 3].map((value) => <option value={value} key={value}>{value} {value === 1 ? "crew" : "crews"}</option>)}</select></label>
        <label><span>Inspection capacity</span><select value={capacity} onChange={(event) => onCapacityChange(Number(event.target.value))}>{[2, 4, 6].map((value) => <option value={value} key={value}>{value} reports</option>)}</select></label>
        <div className="planner-capacity"><span>Today&apos;s capacity</span><strong>{selected.length} / {Math.min(capacity, rankedOpen.length)}</strong><small>top-ranked open reports</small></div>
      </div>
      {planChanged && <div className="plan-updated" role="status">⚡ Action plan updated <span>Selected reports changed with the current priority scenario.</span></div>}
      <div className="planner-columns">
        <div className="planner-now"><div className="planner-column-head"><span>Recommended now</span><strong>Within capacity</strong></div>{crewPlans.map((crew, index) => <div className="crew-plan" key={index}><span className="crew-label">Crew {index + 1}</span>{crew.length ? crew.map((site, stop) => <div className="plan-row" key={site.id}><b>{stop + 1}</b><span><strong>{site.id}</strong><small>{site.place}</small></span><em>{site.risk} priority</em></div>) : <p className="plan-empty">No report assigned.</p>}</div>)}</div>
        <div className="planner-next"><div className="planner-column-head"><span>Monitor / next wave</span><strong>{nextWave.length} outside capacity</strong></div>{nextWave.length ? nextWave.map((site, index) => <details className="why-not" key={site.id}><summary><span>#{selected.length + index + 1}</span><strong>{site.id}</strong><small>{site.place}</small><em>{site.risk}</em></summary><div><p><b>Why is this not in today&apos;s plan?</b> This report remains open, but capacity is allocated to higher-priority evidence.</p><table><tbody><tr><th>Factor</th><th>Last selected</th><th>{site.id}</th></tr><tr><td>Blockage</td><td>{lastSelected?.blockage ?? "—"}</td><td>{site.blockage ?? "—"}</td></tr><tr><td>Rainfall</td><td>{lastSelected?.rainfall ?? "—"} mm</td><td>{site.rainfall ?? "—"} mm</td></tr><tr><td>Litter</td><td>{lastSelected?.litter ?? "—"}</td><td>{site.litter ?? "—"}</td></tr><tr><td>Priority</td><td>{lastSelected?.risk ?? "—"}</td><td>{site.risk}</td></tr></tbody></table></div></details>) : <p className="plan-empty">All open reports fit within today&apos;s capacity.</p>}</div>
      </div>
      <div className="decision-timeline"><span>Controlled demo timeline</span><div><b>09:00</b> Report received</div><i>→</i><div><b>09:01</b> Evidence detected</div><i>→</i><div><b>09:02</b> Rainfall scenario updated</div><i>→</i><div><b>09:03</b> Added to crew plan</div><i>→</i><div><b>✓</b> Verified clear after cleanup evidence</div></div>
    </section>
  );
}

export function WorkflowComparison() {
  const rows = [
    ["Someone reports a problem", "AI evaluates visible evidence"],
    ["Reports remain in a queue", "Conditions influence priority"],
    ["Static task ordering", "Priorities adapt"],
    ["Teams choose manually", "Limited capacity gets an action plan"],
    ["Task marked complete", "Cleanup evidence is verified"],
  ];
  return (
    <section className="workflow-comparison" aria-labelledby="workflow-comparison-title">
      <div className="workflow-comparison-head"><div><span className="kicker">Why DrainGuard?</span><h3 id="workflow-comparison-title">Most systems stop at reporting.</h3></div><strong>DrainGuard closes the decision loop.</strong></div>
      <div className="workflow-comparison-table"><div className="workflow-comparison-labels"><span>Basic / static reporting workflow</span><span>DrainGuard workflow</span></div>{rows.map(([basic, drain]) => <div className="workflow-comparison-row" key={basic}><span>{basic}</span><strong>{drain}</strong></div>)}</div>
      <p className="workflow-comparison-close"><strong>Detection is not the finish line.</strong> Verified action is.</p>
    </section>
  );
}

export function DemoMode({ scenarios, onSelect }: { scenarios: DemoScenario[]; onSelect: (scenario: DemoScenario) => void }) {
  return (
    <section className="demo-mode" aria-labelledby="demo-mode-title">
      <div className="demo-heading"><div><span className="kicker">Controlled scenarios</span><h3 id="demo-mode-title">Demo mode</h3></div><strong>Sample data for demonstration</strong></div>
      <p>Select a controlled scenario to update the inspection, scoring, explanation, and map workflow. These examples are not real municipal observations.</p>
      <div className="demo-grid">
        {scenarios.map((scenario, index) => (
          <button key={scenario.id} type="button" onClick={() => onSelect(scenario)}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{scenario.title}</strong>
            <small>{scenario.description}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

export function VerificationChecklist({ checks }: { checks: VerificationCheck[] }) {
  return (
    <div className="verification-checklist" aria-label="Verification decision checks">
      {checks.map((check) => (
        <div className={`check-${check.state}`} key={check.label}>
          <span aria-hidden="true">{check.state === "pass" ? "✓" : check.state === "fail" ? "!" : "·"}</span>
          <div><strong>{check.label}</strong><small>{check.detail}</small></div>
        </div>
      ))}
    </div>
  );
}

export function ValidationPanel() {
  return (
    <section className="validation-panel" aria-labelledby="validation-title">
      <div className="validation-heading">
        <div><span className="kicker">Validation & limitations</span><h3 id="validation-title">What the prototype proves—and what it does not.</h3></div>
        <strong>Automated decision suite</strong>
      </div>
      <div className="validation-columns">
        <div>
          <h4>Executable checks</h4>
          <ul>
            <li>✓ Cleanup-priority weighting and thresholds</li>
            <li>✓ Environmental-risk weighting and missing-context behavior</li>
            <li>✓ Rainfall sensitivity across controlled scenarios</li>
            <li>✓ Before/after scene mismatch detection</li>
            <li>✓ Human-review routing and cleanup gates</li>
          </ul>
        </div>
        <div>
          <h4>Still requires field validation</h4>
          <ul>
            <li>Drain detection and blockage-estimation accuracy</li>
            <li>Environmental-risk calibration</li>
            <li>Real-world precision, recall, and false-positive rates</li>
            <li>Bias across lighting, devices, seasons, and weather</li>
            <li>Coverage and freshness of mapped water features</li>
          </ul>
        </div>
      </div>
      <p>Passing workflow tests demonstrates deterministic product behavior. It does not establish scientific validity or field-model accuracy.</p>
    </section>
  );
}

export function TrustPanel() {
  return (
    <section className="trust-panel" aria-labelledby="trust-title">
      <div><span className="kicker">Trust principles</span><h3 id="trust-title">Why should you trust this recommendation?</h3></div>
      <div className="trust-grid">
        <article><strong>Evidence, not magic</strong><p>Every priority exposes the blockage, litter, rainfall, and context evidence contributing to it.</p></article>
        <article><strong>Missing data stays missing</strong><p>Unavailable map or weather context lowers coverage instead of becoming a fabricated value.</p></article>
        <article><strong>Humans remain in control</strong><p>Low-confidence images, mismatched scenes, and uncertain cleanup evidence route to review.</p></article>
      </div>
    </section>
  );
}
