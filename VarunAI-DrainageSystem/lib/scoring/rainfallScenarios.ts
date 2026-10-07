import { SCORING_CONFIG } from "./config.ts";
import { calculateEnvironmentalRisk, type WaterwayContext } from "./environmentalRisk.ts";
import { calculatePriorityScore } from "./priority.ts";

export type RainfallScenario = {
  key: "dry" | "moderate" | "heavy";
  label: string;
  rainfallMm: number;
  priority: number;
  environmentalRisk: number;
};

export function calculateRainfallScenarios(input: {
  blockage: number;
  litter: number;
  waterway: WaterwayContext;
  evidenceConfidence?: number;
}): RainfallScenario[] {
  const definitions = [
    { key: "dry" as const, label: "Dry conditions", rainfallMm: SCORING_CONFIG.rainfall.scenariosMm.dry },
    { key: "moderate" as const, label: "Moderate rainfall", rainfallMm: SCORING_CONFIG.rainfall.scenariosMm.moderate },
    { key: "heavy" as const, label: "Heavy rainfall", rainfallMm: SCORING_CONFIG.rainfall.scenariosMm.heavy },
  ];

  return definitions.map((scenario) => ({
    ...scenario,
    priority: calculatePriorityScore({ ...input, rainfallMm: scenario.rainfallMm }).score,
    environmentalRisk: calculateEnvironmentalRisk({ ...input, rainfallMm: scenario.rainfallMm }).score,
  }));
}

