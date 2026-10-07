import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { calculateBaseVisionScores, extractVisualSignalsFromRgba } from "../lib/vision.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");
const benchmarkDirectory = path.join(root, "evaluation", "blockage-benchmark");
const manifestPath = path.join(benchmarkDirectory, "manifest.json");
const outputPath = path.join(benchmarkDirectory, "baseline-results.json");

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

async function scoreEntry(entry) {
  const { data, info } = await sharp(path.join(benchmarkDirectory, entry.file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const signals = extractVisualSignalsFromRgba(data, info.width, info.height);
  return {
    id: entry.id,
    camera: entry.camera,
    split: entry.split,
    actual: entry.label,
    score: calculateBaseVisionScores(signals).blockage,
    signals: {
      debrisTone: Number(signals.debrisTone.toFixed(4)),
      texture: Number(signals.texture.toFixed(4)),
      drainStructure: Number(signals.drainStructure.toFixed(4)),
    },
  };
}

function confusion(rows, threshold) {
  const counts = { tp: 0, tn: 0, fp: 0, fn: 0 };
  for (const row of rows) {
    const predicted = row.score >= threshold ? "blocked" : "clear";
    if (row.actual === "blocked" && predicted === "blocked") counts.tp += 1;
    if (row.actual === "clear" && predicted === "clear") counts.tn += 1;
    if (row.actual === "clear" && predicted === "blocked") counts.fp += 1;
    if (row.actual === "blocked" && predicted === "clear") counts.fn += 1;
  }
  return counts;
}

function divide(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function rounded(value) {
  return Number(value.toFixed(3));
}

function wilson(successes, total, z = 1.96) {
  if (total === 0) return [0, 0];
  const proportion = successes / total;
  const denominator = 1 + (z ** 2) / total;
  const center = (proportion + (z ** 2) / (2 * total)) / denominator;
  const margin = z * Math.sqrt((proportion * (1 - proportion) + (z ** 2) / (4 * total)) / total) / denominator;
  return [rounded(center - margin), rounded(center + margin)];
}

function metrics(rows, threshold) {
  const matrix = confusion(rows, threshold);
  const { tp, tn, fp, fn } = matrix;
  const total = tp + tn + fp + fn;
  const accuracy = divide(tp + tn, total);
  const recall = divide(tp, tp + fn);
  const specificity = divide(tn, tn + fp);
  const precision = divide(tp, tp + fp);
  return {
    threshold,
    samples: total,
    cameras: new Set(rows.map((row) => row.camera)).size,
    confusionMatrix: matrix,
    accuracy: rounded(accuracy),
    accuracyWilson95: wilson(tp + tn, total),
    balancedAccuracy: rounded((recall + specificity) / 2),
    precision: rounded(precision),
    recall: rounded(recall),
    specificity: rounded(specificity),
    f1: rounded(divide(2 * precision * recall, precision + recall)),
  };
}

const scored = await Promise.all(manifest.entries.map(scoreEntry));
const calibration = scored.filter((row) => row.split === "calibration");
const test = scored.filter((row) => row.split === "audit");
const candidates = Array.from({ length: 81 }, (_, index) => index + 14);
const rankedThresholds = candidates
  .map((threshold) => metrics(calibration, threshold))
  .sort((a, b) => b.balancedAccuracy - a.balancedAccuracy || b.recall - a.recall || Math.abs(a.threshold - 50) - Math.abs(b.threshold - 50));
const selectedThreshold = rankedThresholds[0].threshold;
const testMetrics = metrics(test, selectedThreshold);

const results = {
  schemaVersion: 1,
  generatedBy: "npm run evaluate:baseline",
  protocol: {
    calibration: "Threshold selected only on 28 images from 7 cameras by maximum balanced accuracy; ties prefer blocked recall, then proximity to 50.",
    test: "Frozen threshold evaluated on 40 images from the 4 cameras held out by the source paper, balanced 20 blocked / 20 clear.",
    model: "DrainGuard deterministic offline visual blockage score; COCO-SSD litter detections excluded because the source labels blockage, not object classes.",
  },
  selectedThreshold,
  calibration: metrics(calibration, selectedThreshold),
  test: testMetrics,
  scoreSummary: {
    blockedMean: rounded(test.filter((row) => row.actual === "blocked").reduce((sum, row) => sum + row.score, 0) / test.filter((row) => row.actual === "blocked").length),
    clearMean: rounded(test.filter((row) => row.actual === "clear").reduce((sum, row) => sum + row.score, 0) / test.filter((row) => row.actual === "clear").length),
  },
  predictions: scored.map((row) => ({
    ...row,
    predicted: row.score >= selectedThreshold ? "blocked" : "clear",
  })),
};

await fs.writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ selectedThreshold, calibration: results.calibration, test: results.test, scoreSummary: results.scoreSummary }, null, 2));
