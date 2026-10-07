import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { inspectionDecision, passesCleanupVerification } from "../lib/decisions.js";

test("produces a deployable Next.js build", async () => {
  await access(new URL("../.next/BUILD_ID", import.meta.url));
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /DrainGuard/);
  assert.match(page, /Which drain should your crew inspect before the <em>storm\?<\/em>/);
  assert.match(page, /Photo in\. Priority out\./);
  assert.doesNotMatch(page, /codex-preview|Your site is taking shape/);
});

test("ships the explainable risk model and responsible-use language", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../lib/scoring/config.ts", import.meta.url), "utf8");
  assert.match(config, /blockage: 0\.55/);
  assert.match(config, /rainfall: 0\.3/);
  assert.match(config, /litter: 0\.15/);
  assert.match(page, /does not predict floods/i);
  assert.match(page, /COCO-SSD/);
  assert.match(layout, /Which drain should your crew inspect before the storm\?/);
});

test("connects location search to a real garbage-risk map", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const map = await readFile(new URL("../app/DrainMap.tsx", import.meta.url), "utf8");
  assert.match(page, /Where is the garbage\?/);
  assert.match(page, /nominatim\.openstreetmap\.org\/search/);
  assert.match(page, /geocoding-api\.open-meteo\.com/);
  assert.match(page, /<DrainMap sites=\{queueSites\}/);
  assert.match(map, /tile\.openstreetmap\.org/);
  assert.match(map, /map\.flyTo/);
});

test("verifies cleanup from a real after photo instead of a demo toggle", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Upload after-cleanup photo/);
  assert.match(page, /verifyCleanup/);
  assert.match(page, /passesCleanupVerification/);
  assert.match(page, /Same-drain evidence comparison/);
  assert.match(page, /compareSceneFingerprints/);
  assert.match(page, /sceneMatch >= SAME_DRAIN_THRESHOLD/);
  assert.match(page, /status: "Verified clear"/);
  assert.doesNotMatch(page, /Simulate after-cleanup photo/);
});

test("passes all 12 documented decision regression cases", () => {
  const cases = [
    ["blocked control A", "Dispatch now", inspectionDecision({ drainConfidence: 81, risk: 88 })],
    ["blocked control B", "Inspect today", inspectionDecision({ drainConfidence: 74, risk: 72 })],
    ["blocked control C", "Monitor", inspectionDecision({ drainConfidence: 66, risk: 54 })],
    ["clear control A", "Monitor", inspectionDecision({ drainConfidence: 79, risk: 34 })],
    ["clear control B", "Monitor", inspectionDecision({ drainConfidence: 71, risk: 25 })],
    ["clear control C", "Monitor", inspectionDecision({ drainConfidence: 63, risk: 18 })],
    ["same drain cleaned A", true, passesCleanupVerification({ sameDrain: true, drainConfidence: 82, blockage: 31, litter: 28, reduction: 41 })],
    ["same drain cleaned B", true, passesCleanupVerification({ sameDrain: true, drainConfidence: 75, blockage: 44, litter: 39, reduction: 18 })],
    ["unchanged after", false, passesCleanupVerification({ sameDrain: true, drainConfidence: 82, blockage: 76, litter: 62, reduction: 0 })],
    ["different scene A", false, passesCleanupVerification({ sameDrain: false, drainConfidence: 81, blockage: 22, litter: 20, reduction: 60 })],
    ["different scene B", false, passesCleanupVerification({ sameDrain: false, drainConfidence: 76, blockage: 35, litter: 31, reduction: 36 })],
    ["non-drain input", "Needs review", inspectionDecision({ drainConfidence: 55, risk: 84 })],
  ];
  for (const [name, expected, actual] of cases) assert.equal(actual, expected, name);
});

test("ships the final pilot safeguards and evidence surfaces", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /drainguard-pilot:v2/);
  assert.match(page, /localStorage\.setItem/);
  assert.match(page, /latitude=\$\{selectedSite\.lat\}/);
  assert.match(page, /Human review/);
  assert.match(page, /originalStatus = "Needs review"/);
  assert.match(page, /Held-out AI evaluation/);
  assert.match(page, /accuracy on unseen cameras/);
  assert.match(page, /12\/12 expected decisions/);
  assert.match(page, /Different-scene after photos/);
  assert.match(page, /Drain not confirmed · human review/);
  assert.match(page, /not claimed Bengaluru street-drain accuracy/);
});

test("explains AI evidence and protects the upload path", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const map = await readFile(new URL("../app/DrainMap.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /Why this score\?/);
  assert.match(page, /Research ResNet-50 blockage classifier/);
  assert.match(page, /12 \* 1024 \* 1024/);
  assert.match(page, /could not be decoded/);
  assert.match(page, /decision-path/);
  assert.match(map, /Coordinates \$\{site\.lat\.toFixed\(4\)/);
  assert.match(styles, /confidence-explainer/);
  assert.match(styles, /image-error/);
});

test("ships operational impact, review actions, and comparison slider", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /Operational impact snapshot/);
  assert.match(page, /Queue position/);
  assert.match(page, /Approve closure/);
  assert.match(page, /Request photo/);
  assert.match(page, /comparisonSplit/);
  assert.match(page, /Same-drain anchor/);
  assert.match(page, /version: 3/);
  assert.match(styles, /impact-strip/);
  assert.match(styles, /comparison-slider/);
});

test("removes the retired walkthrough surface", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const panels = await readFile(new URL("../app/EnvironmentalPanels.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.doesNotMatch(page, /90-second judge demo|nav-demo-tab|judge-narrator|JUDGE_STEPS|runJudgeDemo/);
  assert.doesNotMatch(panels, /90-second judge walkthrough/);
  assert.doesNotMatch(styles, /judge-narrator|nav-demo-tab/);
});

test("ships Priority Shock and transparent capacity allocation", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const panels = await readFile(new URL("../app/EnvironmentalPanels.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /PriorityShockPanel/);
  assert.match(page, /ActionPlanner/);
  assert.match(panels, /Priority Shock/);
  assert.match(panels, /Same drains\. Different conditions\. Different priorities\./);
  assert.match(panels, /existing scoring logic/);
  assert.match(panels, /Why is this not in today/);
  assert.match(panels, /Transparent capacity allocation/);
  assert.match(panels, /route optimization/);
  assert.match(styles, /priority-shock/);
  assert.match(styles, /action-planner/);
  assert.match(styles, /rank-movement/);
});

test("ships the signature decision ripple and verification reveal", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const panels = await readFile(new URL("../app/EnvironmentalPanels.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(panels, /Conditions changed/);
  assert.match(panels, /Recalculating inspection priorities/);
  assert.match(panels, /ACTION PLAN UPDATED/);
  assert.match(panels, /Before \/ after decision/);
  assert.match(page, /Checking the same scene/);
  assert.match(page, /Measuring improvement/);
  assert.match(page, /verification-finale/);
  assert.match(page, /One photo found the problem/);
  assert.match(page, /resource-pulse/);
  assert.match(panels, /WorkflowComparison/);
  assert.doesNotMatch(page, /JudgeQuestions|Judge-ready pilot/);
  assert.doesNotMatch(panels, /Judge questions|Does this optimize driving routes/);
  assert.doesNotMatch(styles, /judge-questions|button-judge/);
  assert.match(styles, /decision-ripple-status/);
  assert.match(styles, /decision-compare/);
  assert.match(styles, /verification-reveal/);
  assert.match(styles, /workflow-comparison/);
  assert.match(styles, /pitch-mode \.impact-dashboard/);
});

test("ships the environmental decision-support experience", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const panels = await readFile(new URL("../app/EnvironmentalPanels.tsx", import.meta.url), "utf8");
  const environment = await readFile(new URL("../lib/environment.ts", import.meta.url), "utf8");
  assert.match(page, /EnvironmentalDashboard/);
  assert.match(page, /PriorityExplanation/);
  assert.match(page, /RainfallScenarioExplorer/);
  assert.match(page, /DemoMode/);
  assert.match(panels, /Environmental decision-support estimate/);
  assert.match(panels, /Sample data for demonstration/);
  assert.match(panels, /Still requires field validation/);
  assert.match(environment, /overpass-api\.de\/api\/interpreter/);
  assert.match(environment, /Mapped waterway context unavailable/);
});

test("uses a validated server endpoint and never inserts a fake rainfall fallback", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/environmental-context/route.ts", import.meta.url), "utf8");
  const environment = await readFile(new URL("../lib/environment.ts", import.meta.url), "utf8");
  assert.match(page, /\/api\/environmental-context\?latitude=/);
  assert.doesNotMatch(page, /api\.open-meteo\.com\/v1\/forecast/);
  assert.doesNotMatch(page, /Forecast fallback/);
  assert.match(route, /-90, 90/);
  assert.match(route, /-180, 180/);
  assert.match(route, /s-maxage=900/);
  assert.match(environment, /Promise\.all/);
  assert.match(environment, /no fallback was invented/i);
});
