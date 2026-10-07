"use client";

import { useMemo, useState } from "react";
import type { MapSite } from "./DrainMap";
import {
  type BudgetOptimizationResult,
  type DrainMaintenanceCandidate,
  determineIntervention,
  formatINR,
  generateActionPlanCSV,
  solveBudgetOptimization,
} from "../lib/optimizer/budgetOptimizer";

export function VarunAIBudgetPlanner({
  sites,
  budgetRupees,
  availableCrews,
  onBudgetChange,
  onCrewsChange,
  onSelectDrain,
}: {
  sites: MapSite[];
  budgetRupees: number;
  availableCrews: number;
  onBudgetChange: (budget: number) => void;
  onCrewsChange: (crews: number) => void;
  onSelectDrain: (drainId: string) => void;
}) {
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Convert MapSite into DrainMaintenanceCandidate
  const candidates: DrainMaintenanceCandidate[] = useMemo(() => {
    return sites.map((s) => {
      const blockage = s.blockage ?? 50;
      const capacityDeficit = s.capacityDeficit ?? Math.min(90, Math.round(blockage * 0.9 + 10));
      const litter = s.litter ?? 30;
      const intervention = determineIntervention(blockage, capacityDeficit, litter);

      return {
        id: s.id,
        place: s.place,
        ward: s.ward ?? "Ward 45 (Central)",
        lat: s.lat,
        lon: s.lon,
        riskScore: s.environmentalRisk ?? s.risk,
        blockagePct: blockage,
        rainfallMm: s.rainfall ?? 18,
        capacityDeficitPct: capacityDeficit,
        recommendedIntervention: intervention,
      };
    });
  }, [sites]);

  // Run the 0-1 Knapsack Optimization Solver
  const optimizationResult: BudgetOptimizationResult = useMemo(() => {
    return solveBudgetOptimization(candidates, budgetRupees, availableCrews);
  }, [candidates, budgetRupees, availableCrews]);

  function handleDownloadCSV() {
    const csvContent = generateActionPlanCSV(optimizationResult);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `VarunAI_PreMonsoon_WorkOrder_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 4000);
  }

  return (
    <section className="varunai-planner-panel" aria-labelledby="varunai-planner-heading">
      {/* Header */}
      <div className="planner-header">
        <div>
          <span className="badge-kicker">Municipal Resource Allocator</span>
          <h3 id="varunai-planner-heading">Budget-Constrained Pre-Monsoon Action Plan</h3>
          <p className="planner-subtext">
            Solves the binary knapsack problem to maximize citywide risk reduction under strict municipal fiscal caps.
          </p>
        </div>
        <button
          type="button"
          className="btn-export-workorder"
          onClick={handleDownloadCSV}
          title="Export official CSV work order for contractors"
        >
          {downloadSuccess ? "✓ Work Order Exported!" : "📥 Export Municipal Work Order"}
        </button>
      </div>

      {/* Interactive Controls Bar */}
      <div className="budget-slider-card">
        <div className="slider-row">
          <div className="slider-label-group">
            <span className="slider-title">Municipal Maintenance Budget</span>
            <strong className="slider-value">{formatINR(budgetRupees)}</strong>
          </div>
          <input
            type="range"
            min={100000}
            max={2500000}
            step={50000}
            value={budgetRupees}
            onChange={(e) => onBudgetChange(Number(e.target.value))}
            className="budget-range-input"
            aria-label="Adjust municipal maintenance budget"
          />
          <div className="slider-scale">
            <span>₹1.0 Lakh</span>
            <span>₹5.0 Lakh</span>
            <span>₹12.0 Lakh</span>
            <span>₹25.0 Lakh</span>
          </div>
        </div>

        <div className="crew-selector-group">
          <label htmlFor="crew-select" className="crew-label">Available Desilting Crews:</label>
          <select
            id="crew-select"
            value={availableCrews}
            onChange={(e) => onCrewsChange(Number(e.target.value))}
            className="crew-select"
          >
            {[1, 2, 3, 4, 5].map((num) => (
              <option key={num} value={num}>
                {num} {num === 1 ? "Crew (40 hrs capacity)" : `Crews (${num * 40} hrs capacity)`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Metrics Dashboard */}
      <div className="kpi-metrics-grid">
        <div className="kpi-card">
          <span className="kpi-title">Allocated Spend</span>
          <strong className="kpi-main-val">{formatINR(optimizationResult.totalCostRupees)}</strong>
          <small className="kpi-subtext">
            {optimizationResult.budgetUtilizationPct}% utilized · {formatINR(optimizationResult.remainingBudgetRupees)} buffer
          </small>
        </div>

        <div className="kpi-card highlight-green">
          <span className="kpi-title">Funded Interventions</span>
          <strong className="kpi-main-val">
            {optimizationResult.fundedCandidatesCount} <span className="kpi-total">/ {optimizationResult.totalCandidatesCount} Drains</span>
          </strong>
          <small className="kpi-subtext">
            {optimizationResult.totalCrewHoursRequired} crew-hours committed
          </small>
        </div>

        <div className="kpi-card highlight-blue">
          <span className="kpi-title">Citywide Risk Reduced</span>
          <strong className="kpi-main-val">-{optimizationResult.totalRiskReduction} pts</strong>
          <small className="kpi-subtext">
            Overall risk down to {optimizationResult.totalProjectedRisk} pts
          </small>
        </div>

        <div className="kpi-card">
          <span className="kpi-title">Cost-Efficiency ROI</span>
          <strong className="kpi-main-val">{optimizationResult.efficiencyRatio}</strong>
          <small className="kpi-subtext">Risk points reduced per ₹1.0 Lakh</small>
        </div>
      </div>

      {/* Action Plan Table */}
      <div className="plan-tables-container">
        <div className="funded-actions-section">
          <div className="section-title-row">
            <h4>⚡ Approved Pre-Monsoon Work Orders (Ranked by ROI)</h4>
            <span className="count-tag funded">{optimizationResult.selectedActions.length} Approved</span>
          </div>

          {optimizationResult.selectedActions.length === 0 ? (
            <p className="empty-message">Budget is insufficient for any major intervention. Increase budget slider above.</p>
          ) : (
            <div className="table-responsive">
              <table className="varunai-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Drain Segment</th>
                    <th>Intervention</th>
                    <th>Budget</th>
                    <th>Crew Hrs</th>
                    <th>Risk Impact</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {optimizationResult.selectedActions.map((action) => (
                    <tr key={action.drainId} className="action-row">
                      <td>
                        <span className="rank-badge">#{action.priorityRank}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="drain-link-btn"
                          onClick={() => onSelectDrain(action.drainId)}
                        >
                          <strong>{action.drainId}</strong>
                          <span className="location-name">{action.place}</span>
                        </button>
                      </td>
                      <td>
                        <span className="intervention-pill">{action.intervention.label}</span>
                      </td>
                      <td className="cost-cell">{formatINR(action.costRupees)}</td>
                      <td>{action.crewHours} hrs (Crew {action.assignedCrewId})</td>
                      <td>
                        <span className="risk-drop-badge">
                          {action.initialRisk} → <strong>{action.projectedRisk}</strong> (-{action.riskReduction})
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-inspect-mini"
                          onClick={() => onSelectDrain(action.drainId)}
                        >
                          View Map
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Deferred Queue */}
        {optimizationResult.deferredDrains.length > 0 && (
          <div className="deferred-section">
            <div className="section-title-row">
              <h4>⏳ Deferred Backlog (Pending Additional Fiscal Allocation)</h4>
              <span className="count-tag deferred">{optimizationResult.deferredDrains.length} Deferred</span>
            </div>
            <div className="deferred-list">
              {optimizationResult.deferredDrains.map((item) => (
                <div key={item.drainId} className="deferred-item">
                  <div className="deferred-left">
                    <button
                      type="button"
                      className="drain-link-btn"
                      onClick={() => onSelectDrain(item.drainId)}
                    >
                      <strong>{item.drainId}</strong> — {item.place}
                    </button>
                    <span className="deferred-reason">{item.deferralReason}</span>
                  </div>
                  <div className="deferred-right">
                    <span className="unfunded-risk">Risk: {item.initialRisk}/100</span>
                    <span className="shortfall-amount">Needs {formatINR(item.neededCostRupees)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
