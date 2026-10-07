import assert from "node:assert/strict";
import test from "node:test";
import { GET as getEnvironmentalContext } from "../app/api/environmental-context/route.ts";
import { SCORING_CONFIG } from "../lib/scoring/config.ts";
import { fetchEnvironmentalContext } from "../lib/environment.ts";
import { calculateEnvironmentalRisk, waterwayConcernLabel, waterwayProximityScore } from "../lib/scoring/environmentalRisk.ts";
import { calculatePriorityScore } from "../lib/scoring/priority.ts";
import { calculateRainfallScenarios } from "../lib/scoring/rainfallScenarios.ts";

const availableWaterway = {
  status: "available",
  distanceMeters: 100,
  source: "OpenStreetMap / Overpass",
  message: "Mapped stream approximately 100 m away.",
};

const unavailableWaterway = {
  status: "unavailable",
  distanceMeters: null,
  source: "OpenStreetMap / Overpass",
  message: "Environmental context unavailable.",
};

test("environmental endpoint rejects missing and out-of-range coordinates", async () => {
  const missing = await getEnvironmentalContext(new Request("http://localhost/api/environmental-context"));
  const invalid = await getEnvironmentalContext(new Request("http://localhost/api/environmental-context?latitude=91&longitude=181"));
  assert.equal(missing.status, 400);
  assert.equal(invalid.status, 400);
  assert.match((await missing.json()).error, /latitude and longitude/i);
});

test("central scoring weights remain normalized", () => {
  const priorityTotal = Object.values(SCORING_CONFIG.priority).reduce((sum, value) => sum + value, 0);
  const environmentalTotal = Object.values(SCORING_CONFIG.environmental).reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(priorityTotal - 1) < Number.EPSILON * 2);
  assert.ok(Math.abs(environmentalTotal - 1) < Number.EPSILON * 2);
});

test("priority score exposes exact factor contributions", () => {
  const result = calculatePriorityScore({ blockage: 80, litter: 40, rainfallMm: 32, evidenceConfidence: 90 });
  assert.equal(result.score, 65);
  assert.equal(result.level, "high");
  assert.deepEqual(result.factors.map((factor) => factor.contribution), [44, 15, 6]);
  assert.equal(result.coverage, 100);
});

test("environmental score includes mapped proximity when available", () => {
  const result = calculateEnvironmentalRisk({ blockage: 80, litter: 40, rainfallMm: 32, waterway: availableWaterway, evidenceConfidence: 90 });
  assert.equal(result.score, 65);
  assert.equal(result.coverage, 100);
  assert.equal(result.confidence, "high");
  assert.equal(result.factors.at(-1)?.contribution, 10);
});

test("missing waterway context lowers coverage without inventing a value", () => {
  const result = calculateEnvironmentalRisk({ blockage: 80, litter: 40, rainfallMm: 32, waterway: unavailableWaterway, evidenceConfidence: 90 });
  assert.equal(result.coverage, 90);
  assert.equal(result.factors.at(-1)?.rawValue, null);
  assert.equal(result.factors.at(-1)?.contribution, null);
  assert.match(result.limitations.join(" "), /normalized across the available evidence/i);
});

test("missing rainfall lowers priority coverage without inventing a forecast", () => {
  const result = calculatePriorityScore({ blockage: 80, litter: 40, rainfallMm: null, evidenceConfidence: 90 });
  assert.equal(result.score, 71);
  assert.equal(result.coverage, 70);
  assert.equal(result.confidence, "medium");
  assert.equal(result.factors.find((factor) => factor.key === "rainfall")?.rawValue, null);
  assert.match(result.limitations.join(" "), /rainfall was unavailable/i);
});

test("missing rainfall and waterway context reduce environmental coverage to visible evidence", () => {
  const result = calculateEnvironmentalRisk({ blockage: 80, litter: 40, rainfallMm: null, waterway: unavailableWaterway, evidenceConfidence: 90 });
  assert.equal(result.score, 67);
  assert.equal(result.coverage, 60);
  assert.equal(result.confidence, "medium");
  assert.equal(result.factors.find((factor) => factor.key === "rainfall")?.contribution, null);
  assert.equal(result.factors.find((factor) => factor.key === "waterwayProximity")?.contribution, null);
});

test("environmental lookup preserves a real zero-rain forecast when waterway lookup fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("api.open-meteo.com")) {
      return Response.json({ daily: { precipitation_sum: [0], precipitation_probability_max: [5] } });
    }
    throw new Error("Overpass unavailable");
  };
  try {
    const result = await fetchEnvironmentalContext(12.9716, 77.5946);
    assert.equal(result.weather.status, "available");
    assert.equal(result.weather.precipitationMm, 0);
    assert.equal(result.waterway.status, "unavailable");
    assert.match(result.waterway.message, /No proximity value was fabricated/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("waterway thresholds match the published configuration", () => {
  assert.equal(waterwayConcernLabel(249), "High");
  assert.equal(waterwayConcernLabel(250), "Medium");
  assert.equal(waterwayConcernLabel(750), "Medium");
  assert.equal(waterwayConcernLabel(751), "Low");
  assert.deepEqual([waterwayProximityScore(249), waterwayProximityScore(250), waterwayProximityScore(751)], [100, 60, 25]);
});

test("rainfall scenario priority rises monotonically for the same drain", () => {
  const scenarios = calculateRainfallScenarios({ blockage: 58, litter: 44, waterway: availableWaterway, evidenceConfidence: 82 });
  assert.deepEqual(scenarios.map((scenario) => scenario.rainfallMm), [0, 24, 64]);
  assert.ok(scenarios[0].priority < scenarios[1].priority);
  assert.ok(scenarios[1].priority < scenarios[2].priority);
});
