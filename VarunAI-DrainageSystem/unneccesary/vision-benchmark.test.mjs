import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const benchmarkDirectory = path.join(root, "evaluation", "blockage-benchmark");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(benchmarkDirectory, name), "utf8"));
}

test("benchmark uses balanced, camera-disjoint splits", () => {
  const manifest = readJson("manifest.json");
  const expected = { calibration: { cameras: 7, images: 28 }, audit: { cameras: 4, images: 40 } };
  const camerasBySplit = new Map();

  for (const [split, splitExpected] of Object.entries(expected)) {
    const entries = manifest.entries.filter((entry) => entry.split === split);
    const cameras = new Set(entries.map((entry) => entry.camera));
    camerasBySplit.set(split, cameras);
    assert.equal(entries.length, splitExpected.images);
    assert.equal(cameras.size, splitExpected.cameras);
    assert.equal(entries.filter((entry) => entry.label === "blocked").length, entries.length / 2);
    assert.equal(entries.filter((entry) => entry.label === "clear").length, entries.length / 2);
  }

  for (const first of Object.keys(expected)) {
    for (const second of Object.keys(expected)) {
      if (first >= second) continue;
      assert.deepEqual([...camerasBySplit.get(first)].filter((camera) => camerasBySplit.get(second).has(camera)), []);
    }
  }
  assert.equal(manifest.source.license, "CC BY 4.0");
  for (const entry of manifest.entries) assert.equal(fs.existsSync(path.join(benchmarkDirectory, entry.file)), true, entry.file);
});

test("published classifier metrics are internally consistent and beat the frozen fallback", () => {
  const result = readJson("results.json");
  const baseline = readJson("baseline-results.json");
  const matrix = result.test.confusionMatrix;
  const total = matrix.tp + matrix.tn + matrix.fp + matrix.fn;
  assert.equal(total, 40);
  assert.equal(result.test.samples, total);
  assert.equal(result.test.accuracy, Number(((matrix.tp + matrix.tn) / total).toFixed(3)));
  assert.equal(result.predictions.length, 40);
  assert.ok(result.test.accuracy > baseline.test.accuracy);
  assert.ok(result.maximumQuantizationDifference < 0.2);

  const metadata = JSON.parse(fs.readFileSync(path.join(root, "public", "models", "drain-blockage-resnet50-v1.json"), "utf8"));
  const modelPath = path.join(root, "public", metadata.model.replace(/^\/models\//, "models/"));
  assert.equal(metadata.threshold, result.selectedThreshold);
  assert.deepEqual(metadata.evaluation, result.test);
  assert.equal(fs.statSync(modelPath).size, result.modelBytes);
});
