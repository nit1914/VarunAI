const DEFAULT_SIGNALS = {
  texture: 0.45,
  debrisTone: 0.4,
  naturalColor: 0.35,
  drainStructure: 0.5,
  fingerprint: [],
};

/** @param {number} value @param {number} [min] @param {number} [max] */
export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Extract the same deterministic visual features in the browser and benchmark.
 * Input must be an RGBA buffer whose length is width * height * 4.
 * @param {ArrayLike<number>} pixels
 * @param {number} width
 * @param {number} height
 */
export function extractVisualSignalsFromRgba(pixels, width, height) {
  if (width < 2 || height < 2 || pixels.length !== width * height * 4) return DEFAULT_SIGNALS;

  let dark = 0;
  let earthy = 0;
  let colorful = 0;
  let edge = 0;
  let horizontalEdge = 0;
  let verticalEdge = 0;
  const luminance = [];

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminance.push(lum);
    if (lum < 72) dark += 1;
    if (r > b * 1.14 && g > b * 1.04 && r < 190) earthy += 1;
    if (Math.max(r, g, b) - Math.min(r, g, b) > 22) colorful += 1;
  }

  for (let y = 1; y < height; y += 1) {
    for (let x = 1; x < width; x += 1) {
      const current = luminance[y * width + x];
      const left = luminance[y * width + x - 1];
      const above = luminance[(y - 1) * width + x];
      const horizontalDelta = Math.abs(current - above);
      const verticalDelta = Math.abs(current - left);
      if (horizontalDelta + verticalDelta > 75) edge += 1;
      if (horizontalDelta > 42) horizontalEdge += 1;
      if (verticalDelta > 42) verticalEdge += 1;
    }
  }

  const gridWidth = 12;
  const gridHeight = 8;
  const fingerprint = [];
  for (let gy = 0; gy < gridHeight; gy += 1) {
    for (let gx = 0; gx < gridWidth; gx += 1) {
      let total = 0;
      let count = 0;
      const startX = Math.floor((gx / gridWidth) * width);
      const endX = Math.floor(((gx + 1) / gridWidth) * width);
      const startY = Math.floor((gy / gridHeight) * height);
      const endY = Math.floor(((gy + 1) / gridHeight) * height);
      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          total += luminance[y * width + x];
          count += 1;
        }
      }
      fingerprint.push(total / Math.max(1, count));
    }
  }

  const mean = fingerprint.reduce((sum, value) => sum + value, 0) / fingerprint.length;
  const variance = fingerprint.reduce((sum, value) => sum + (value - mean) ** 2, 0) / fingerprint.length;
  const deviation = Math.max(12, Math.sqrt(variance));
  const normalizedFingerprint = fingerprint.map((value) => clamp((value - mean) / deviation, -2.5, 2.5));
  const edgeSamples = (width - 1) * (height - 1);
  const horizontalDensity = horizontalEdge / edgeSamples;
  const verticalDensity = verticalEdge / edgeSamples;
  const drainStructure = clamp(
    Math.min(horizontalDensity + verticalDensity, 0.34) / 0.34 * 0.62
      + Math.min(horizontalDensity, verticalDensity, 0.1) / 0.1 * 0.38,
    0,
    1,
  );

  return {
    texture: edge / edgeSamples,
    debrisTone: (dark + earthy * 0.7) / (width * height),
    naturalColor: colorful / (width * height),
    drainStructure,
    fingerprint: normalizedFingerprint,
  };
}

/** @param {{ texture: number, debrisTone: number }} signals */
export function calculateBaseVisionScores(signals) {
  return {
    blockage: clamp(Math.round(24 + signals.debrisTone * 64 + signals.texture * 88), 14, 94),
    litter: clamp(Math.round(14 + signals.texture * 105), 8, 96),
  };
}

/**
 * @param {{ drainStructure: number, debrisTone: number, naturalColor: number }} signals
 * @param {Array<{class: string, bbox: [number, number, number, number]}>} predictions
 */
export function calculateDrainConfidence(signals, predictions) {
  const unrelatedClasses = new Set(["person", "car", "truck", "bus", "dog", "cat", "chair", "couch", "bed", "tv", "laptop"]);
  const unrelatedArea = predictions.reduce((total, item) => {
    if (!unrelatedClasses.has(item.class)) return total;
    return total + (item.bbox[2] * item.bbox[3]) / 10000;
  }, 0);
  const surfaceEvidence = Math.min(signals.debrisTone / 0.45, 1);
  const naturalSceneEvidence = Math.min(signals.naturalColor / 0.55, 1);
  return clamp(Math.round(18 + signals.drainStructure * 42 + surfaceEvidence * 18 + naturalSceneEvidence * 28 - Math.min(unrelatedArea, 0.7) * 42), 8, 96);
}

/** @param {number[]} before @param {number[]} after */
export function compareSceneFingerprints(before, after) {
  if (before.length === 0 || before.length !== after.length) return 0;
  let dot = 0;
  let beforeMagnitude = 0;
  let afterMagnitude = 0;
  for (let index = 0; index < before.length; index += 1) {
    dot += before[index] * after[index];
    beforeMagnitude += before[index] ** 2;
    afterMagnitude += after[index] ** 2;
  }
  if (beforeMagnitude === 0 || afterMagnitude === 0) return 0;
  const correlation = dot / Math.sqrt(beforeMagnitude * afterMagnitude);
  return clamp(Math.round(((correlation + 1) / 2) * 100));
}
