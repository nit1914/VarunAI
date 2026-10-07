import { SCORING_CONFIG } from "./config.ts";
import { clampScore, rainfallExposureIndex, scoreLevel, type ExplainedScore, type ScoreFactor } from "./priority.ts";

export type WaterwayContext = {
  status: "available" | "unavailable" | "loading";
  distanceMeters: number | null;
  featureName?: string;
  featureType?: string;
  source: "OpenStreetMap / Overpass";
  message: string;
};

export function waterwayProximityScore(distanceMeters: number) {
  const { highConcernMeters, mediumConcernMeters } = SCORING_CONFIG.waterway;
  if (distanceMeters < highConcernMeters) return 100;
  if (distanceMeters <= mediumConcernMeters) return 60;
  return 25;
}

export function waterwayConcernLabel(distanceMeters: number) {
  const { highConcernMeters, mediumConcernMeters } = SCORING_CONFIG.waterway;
  if (distanceMeters < highConcernMeters) return "High";
  if (distanceMeters <= mediumConcernMeters) return "Medium";
  return "Low";
}

export function calculateEnvironmentalRisk(input: {
  blockage: number;
  litter: number;
  rainfallMm: number | null;
  waterway: WaterwayContext;
  evidenceConfidence?: number;
}): ExplainedScore {
  const weights = SCORING_CONFIG.environmental;
  const blockage = clampScore(input.blockage);
  const litter = clampScore(input.litter);
  const hasRainfall = typeof input.rainfallMm === "number" && Number.isFinite(input.rainfallMm);
  const rainfall = hasRainfall ? rainfallExposureIndex(input.rainfallMm as number) : null;
  const hasWaterway = input.waterway.status === "available" && input.waterway.distanceMeters !== null;
  const proximity = hasWaterway ? waterwayProximityScore(input.waterway.distanceMeters as number) : null;

  const factors: ScoreFactor[] = [
    {
      key: "blockage",
      name: "Blockage severity",
      rawValue: blockage,
      weight: weights.blockage,
      contribution: blockage * weights.blockage,
      explanation: "Visible obstruction may retain and mobilize street waste during rainfall.",
    },
    {
      key: "rainfall",
      name: "Rainfall exposure",
      rawValue: rainfall,
      weight: weights.rainfall,
      contribution: rainfall === null ? null : rainfall * weights.rainfall,
      explanation: hasRainfall
        ? `Uses ${Math.max(0, input.rainfallMm as number).toFixed(1)} mm as the current or selected scenario input.`
        : "Live rainfall is unavailable. No fallback rainfall value was invented.",
    },
    {
      key: "litter",
      name: "Visible litter",
      rawValue: litter,
      weight: weights.litter,
      contribution: litter * weights.litter,
      explanation: "Visible waste increases potential environmental concern; it does not measure pollution volume.",
    },
    {
      key: "waterwayProximity",
      name: "Environmental context",
      rawValue: proximity,
      weight: weights.waterwayProximity,
      contribution: proximity === null ? null : proximity * weights.waterwayProximity,
      explanation: hasWaterway
        ? `${waterwayConcernLabel(input.waterway.distanceMeters as number)} proximity concern: mapped ${input.waterway.featureType ?? "water feature"} about ${Math.round(input.waterway.distanceMeters as number)} m away.`
        : "Environmental context unavailable. No proximity value was fabricated.",
    },
  ];

  const availableWeight = factors.reduce((total, factor) => total + (factor.contribution === null ? 0 : factor.weight), 0);
  const weightedTotal = factors.reduce((total, factor) => total + (factor.contribution ?? 0), 0);
  const score = Math.round(clampScore(weightedTotal / Math.max(availableWeight, 0.01)));
  const coverage = Math.round(availableWeight * 100);
  const confidenceValue = Math.min(input.evidenceConfidence ?? 70, coverage);
  const confidence = confidenceValue >= 80 ? "high" : confidenceValue >= 60 ? "medium" : "low";
  const limitations = [
    "Environmental decision-support estimate; not a hydrological model or a prediction of pollution volume.",
  ];
  if (!hasRainfall) limitations.push("Live rainfall was unavailable, so the score was normalized without that factor.");
  if (!hasWaterway) limitations.push("Mapped waterway context was unavailable, so the score was normalized across the available evidence.");

  return { score, level: scoreLevel(score), factors, confidence, coverage, limitations };
}
