import test from "node:test";
import assert from "node:assert/strict";

import {
  INTERVENTION_CATALOG,
  determineIntervention,
  solveBudgetOptimization,
  formatINR,
  generateActionPlanCSV,
} from "../lib/optimizer/budgetOptimizer.ts";

test("determineIntervention correctly maps physical criteria", () => {
  assert.equal(determineIntervention(80, 20, 30).type, "mechanical_desilting");
  assert.equal(determineIntervention(30, 75, 20).type, "encroachment_clearance");
  assert.equal(determineIntervention(20, 20, 65).type, "culvert_jetting");
  assert.equal(determineIntervention(45, 20, 20).type, "silt_trap_install");
});

test("solveBudgetOptimization strictly respects budget and crew constraints", () => {
  const mockCandidates = [
    {
      id: "DRN-101",
      place: "North Main Channel",
      ward: "Ward 45",
      lat: 13.0827,
      lon: 80.2707,
      riskScore: 92,
      blockagePct: 85,
      rainfallMm: 75,
      capacityDeficitPct: 40,
      recommendedIntervention: INTERVENTION_CATALOG.mechanical_desilting, // 1.4L, 16h, 42 pts
    },
    {
      id: "DRN-102",
      place: "Cross Culvert Junction",
      ward: "Ward 45",
      lat: 13.0845,
      lon: 80.2725,
      riskScore: 78,
      blockagePct: 65,
      rainfallMm: 60,
      capacityDeficitPct: 30,
      recommendedIntervention: INTERVENTION_CATALOG.culvert_jetting, // 0.85L, 10h, 28 pts
    },
    {
      id: "DRN-103",
      place: "South Outfall Canal",
      ward: "Ward 45",
      lat: 13.0810,
      lon: 80.2680,
      riskScore: 88,
      blockagePct: 70,
      rainfallMm: 70,
      capacityDeficitPct: 75,
      recommendedIntervention: INTERVENTION_CATALOG.encroachment_clearance, // 2.2L, 28h, 55 pts
    },
    {
      id: "DRN-104",
      place: "Market Road Drain",
      ward: "Ward 45",
      lat: 13.0860,
      lon: 80.2750,
      riskScore: 65,
      blockagePct: 45,
      rainfallMm: 50,
      capacityDeficitPct: 20,
      recommendedIntervention: INTERVENTION_CATALOG.silt_trap_install, // 0.55L, 6h, 18 pts
    },
  ];

  // Budget of 2.5 Lakhs (250,000 INR)
  const result = solveBudgetOptimization(mockCandidates, 250000, 2, 40);

  // Total cost must not exceed budget
  assert.ok(result.totalCostRupees <= 250000, "Cost should not exceed budget constraint");
  assert.ok(result.totalCrewHoursRequired <= 80, "Crew hours should not exceed capacity");
  assert.ok(result.selectedActions.length > 0, "Should select top candidates");
  assert.ok(result.deferredDrains.length > 0, "Should defer drains exceeding budget");
  assert.ok(result.efficiencyRatio > 0, "Should have positive efficiency ratio");

  // Verify CSV export
  const csv = generateActionPlanCSV(result);
  assert.ok(csv.includes("DRN-101") || csv.includes("DRN-102"));
  assert.ok(csv.includes("Work Order Rank"));
});

test("formatINR formats numbers correctly", () => {
  assert.equal(formatINR(140000, true), "₹1.40 Lakh");
  assert.equal(formatINR(15000000, true), "₹1.50 Cr");
});
