export const SCORING_CONFIG = {
  priority: {
    blockage: 0.55,
    rainfall: 0.3,
    litter: 0.15,
  },
  environmental: {
    blockage: 0.4,
    rainfall: 0.3,
    litter: 0.2,
    waterwayProximity: 0.1,
  },
  rainfall: {
    fullExposureMm: 64,
    scenariosMm: {
      dry: 0,
      moderate: 24,
      heavy: 64,
    },
  },
  waterway: {
    highConcernMeters: 250,
    mediumConcernMeters: 750,
    searchRadiusMeters: 2000,
  },
} as const;

export type RiskLevel = "low" | "moderate" | "high" | "critical";

