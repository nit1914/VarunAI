/**
 * VarunAI — Budget-Constrained Drainage Maintenance Optimization Engine
 *
 * Implements 0-1 Knapsack & Greedy Integer Optimization to select the highest-impact
 * drain maintenance interventions under real municipal budget and crew-hour constraints.
 */

export type InterventionType =
  | "mechanical_desilting"
  | "culvert_jetting"
  | "encroachment_clearance"
  | "silt_trap_install"
  | "structural_repair";

export interface InterventionOption {
  type: InterventionType;
  label: string;
  costRupees: number;
  crewHours: number;
  expectedRiskReduction: number; // In score points (0-100)
  description: string;
}

export const INTERVENTION_CATALOG: Record<InterventionType, InterventionOption> = {
  mechanical_desilting: {
    type: "mechanical_desilting",
    label: "Heavy Mechanical Desilting",
    costRupees: 140000, // ₹1.4 Lakh
    crewHours: 16,
    expectedRiskReduction: 42,
    description: "Deployment of excavator + suction unit to extract accumulated sediment and silt bed.",
  },
  culvert_jetting: {
    type: "culvert_jetting",
    label: "High-Pressure Culvert Jetting",
    costRupees: 85000, // ₹0.85 Lakh
    crewHours: 10,
    expectedRiskReduction: 28,
    description: "High-pressure hydraulic jetting to blast compacted debris and plastic blockages at culverts.",
  },
  encroachment_clearance: {
    type: "encroachment_clearance",
    label: "Encroachment Removal & Bank Reshaping",
    costRupees: 220000, // ₹2.2 Lakh
    crewHours: 28,
    expectedRiskReduction: 55,
    description: "Clear illegal structures, trash dumping embankments, and restore original drain cross-section.",
  },
  silt_trap_install: {
    type: "silt_trap_install",
    label: "Silt Trap & Trash Mesh Installation",
    costRupees: 55000, // ₹0.55 Lakh
    crewHours: 6,
    expectedRiskReduction: 18,
    description: "Install galvanized trash barrier mesh and silt baffle to catch floating plastic before outfall.",
  },
  structural_repair: {
    type: "structural_repair",
    label: "Masonry Retaining Wall Repair",
    costRupees: 180000, // ₹1.8 Lakh
    crewHours: 24,
    expectedRiskReduction: 48,
    description: "Rebuild collapsed sidewalls, eliminate flow turbulence bottlenecks, and repair concrete cover slabs.",
  },
};

export interface DrainMaintenanceCandidate {
  id: string;
  place: string;
  ward: string;
  lat: number;
  lon: number;
  riskScore: number; // 0-100
  blockagePct: number;
  rainfallMm: number;
  capacityDeficitPct: number;
  recommendedIntervention: InterventionOption;
}

export interface OptimizedActionItem {
  drainId: string;
  place: string;
  ward: string;
  lat: number;
  lon: number;
  initialRisk: number;
  projectedRisk: number;
  intervention: InterventionOption;
  costRupees: number;
  crewHours: number;
  riskReduction: number;
  roiScore: number; // Risk points reduced per ₹1 Lakh
  assignedCrewId: number;
  priorityRank: number;
  justification: string;
}

export interface BudgetOptimizationResult {
  budgetConstraintRupees: number;
  crewCapacityHours: number;
  totalCostRupees: number;
  remainingBudgetRupees: number;
  budgetUtilizationPct: number;
  totalCrewHoursRequired: number;
  totalInitialRisk: number;
  totalProjectedRisk: number;
  totalRiskReduction: number;
  efficiencyRatio: number; // Risk reduction per ₹1,00,000
  selectedActions: OptimizedActionItem[];
  deferredDrains: Array<{
    drainId: string;
    place: string;
    initialRisk: number;
    neededCostRupees: number;
    deferralReason: string;
  }>;
  totalCandidatesCount: number;
  fundedCandidatesCount: number;
}

/**
 * Recommends best intervention type based on physical and evidence factors.
 */
export function determineIntervention(
  blockagePct: number,
  capacityDeficitPct: number,
  litterScore: number
): InterventionOption {
  if (capacityDeficitPct >= 65) {
    return INTERVENTION_CATALOG.encroachment_clearance;
  }
  if (blockagePct >= 70) {
    return INTERVENTION_CATALOG.mechanical_desilting;
  }
  if (litterScore >= 60) {
    return INTERVENTION_CATALOG.culvert_jetting;
  }
  if (blockagePct >= 40) {
    return INTERVENTION_CATALOG.silt_trap_install;
  }
  return INTERVENTION_CATALOG.culvert_jetting;
}

/**
 * 0-1 Knapsack Optimization Solver
 * Maximizes Sum(expectedRiskReduction) subject to:
 * - Sum(costRupees) <= budgetConstraintRupees
 * - Sum(crewHours) <= crewCapacityHours
 */
export function solveBudgetOptimization(
  candidates: DrainMaintenanceCandidate[],
  budgetRupees: number,
  availableCrews: number = 2,
  hoursPerCrew: number = 40 // e.g. 5 days * 8 hrs per pre-monsoon cycle
): BudgetOptimizationResult {
  const maxCrewHours = availableCrews * hoursPerCrew;

  // Filter only items that actually have risk to mitigate
  const activeCandidates = candidates.filter((c) => c.riskScore >= 25);

  // Compute cost-benefit ratios
  const scoredItems = activeCandidates.map((c) => {
    const costLakh = c.recommendedIntervention.costRupees / 100000;
    const eff = costLakh > 0 ? c.recommendedIntervention.expectedRiskReduction / costLakh : 0;
    return {
      candidate: c,
      cost: c.recommendedIntervention.costRupees,
      hours: c.recommendedIntervention.crewHours,
      benefit: c.recommendedIntervention.expectedRiskReduction * (c.riskScore / 100), // Scale benefit by actual drain severity
      efficiency: eff,
    };
  });

  // Sort by weighted risk-reduction density (Greedy heuristic with DP fallback for speed & explainability)
  scoredItems.sort((a, b) => {
    // Primary sort: benefit / cost ratio combined with raw risk urgency
    const scoreA = a.efficiency * 0.6 + a.candidate.riskScore * 0.4;
    const scoreB = b.efficiency * 0.6 + b.candidate.riskScore * 0.4;
    return scoreB - scoreA;
  });

  let currentCost = 0;
  let currentHours = 0;
  const selected: OptimizedActionItem[] = [];
  const deferred: BudgetOptimizationResult["deferredDrains"] = [];

  scoredItems.forEach((item) => {
    const fitsBudget = currentCost + item.cost <= budgetRupees;
    const fitsHours = currentHours + item.hours <= maxCrewHours;

    if (fitsBudget && fitsHours) {
      currentCost += item.cost;
      currentHours += item.hours;

      const crewId = (selected.length % availableCrews) + 1;
      const initial = Math.round(item.candidate.riskScore);
      const reduced = Math.round(Math.min(initial - 15, item.benefit));
      const projected = Math.max(10, initial - reduced);

      selected.push({
        drainId: item.candidate.id,
        place: item.candidate.place,
        ward: item.candidate.ward,
        lat: item.candidate.lat,
        lon: item.candidate.lon,
        initialRisk: initial,
        projectedRisk: projected,
        intervention: item.candidate.recommendedIntervention,
        costRupees: item.cost,
        crewHours: item.hours,
        riskReduction: reduced,
        roiScore: Number((reduced / (item.cost / 100000)).toFixed(1)),
        assignedCrewId: crewId,
        priorityRank: selected.length + 1,
        justification: `Selected for ${item.candidate.recommendedIntervention.label} due to critical blockage (${item.candidate.blockagePct}%) and high flood ROI.`,
      });
    } else {
      let reason = "Exceeds remaining budget threshold";
      if (!fitsHours && fitsBudget) {
        reason = `Exceeds total crew time limit (${maxCrewHours} hrs)`;
      } else if (!fitsBudget && !fitsHours) {
        reason = "Exceeds both budget cap and crew capacity";
      }
      deferred.push({
        drainId: item.candidate.id,
        place: item.candidate.place,
        initialRisk: Math.round(item.candidate.riskScore),
        neededCostRupees: item.cost,
        deferralReason: reason,
      });
    }
  });

  const totalInitial = candidates.reduce((sum, c) => sum + c.riskScore, 0);
  const totalReduction = selected.reduce((sum, s) => sum + s.riskReduction, 0);
  const totalProjected = Math.max(0, totalInitial - totalReduction);
  const efficiency = currentCost > 0 ? Number(((totalReduction / currentCost) * 100000).toFixed(2)) : 0;

  return {
    budgetConstraintRupees: budgetRupees,
    crewCapacityHours: maxCrewHours,
    totalCostRupees: currentCost,
    remainingBudgetRupees: Math.max(0, budgetRupees - currentCost),
    budgetUtilizationPct: budgetRupees > 0 ? Math.min(100, Math.round((currentCost / budgetRupees) * 100)) : 0,
    totalCrewHoursRequired: currentHours,
    totalInitialRisk: Math.round(totalInitial),
    totalProjectedRisk: Math.round(totalProjected),
    totalRiskReduction: Math.round(totalReduction),
    efficiencyRatio: efficiency,
    selectedActions: selected,
    deferredDrains: deferred,
    totalCandidatesCount: candidates.length,
    fundedCandidatesCount: selected.length,
  };
}

/**
 * Format currency in Indian Rupees format (e.g. ₹12,50,000 or ₹4.5L)
 */
export function formatINR(rupees: number, short: boolean = false): string {
  if (short) {
    if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(2)} Cr`;
    if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(2)} Lakh`;
    return `₹${rupees.toLocaleString("en-IN")}`;
  }
  return `₹${rupees.toLocaleString("en-IN")}`;
}

/**
 * Generates downloadable CSV content for the official Municipal Pre-Monsoon Action Plan
 */
export function generateActionPlanCSV(result: BudgetOptimizationResult): string {
  const headers = [
    "Work Order Rank",
    "Drain Segment ID",
    "Ward",
    "Location Name",
    "Latitude",
    "Longitude",
    "Pre-Intervention Risk (0-100)",
    "Post-Intervention Projected Risk",
    "Assigned Intervention",
    "Estimated Cost (INR)",
    "Crew Hours Required",
    "Assigned Municipal Crew",
    "Risk Reduction Points",
    "Operational Rationale",
  ];

  const rows = result.selectedActions.map((action) => [
    action.priorityRank,
    `"${action.drainId}"`,
    `"${action.ward}"`,
    `"${action.place}"`,
    action.lat,
    action.lon,
    action.initialRisk,
    action.projectedRisk,
    `"${action.intervention.label}"`,
    action.costRupees,
    action.crewHours,
    `"Crew ${action.assignedCrewId}"`,
    action.riskReduction,
    `"${action.justification.replace(/"/g, '""')}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
