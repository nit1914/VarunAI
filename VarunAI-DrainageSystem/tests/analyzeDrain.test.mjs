import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { POST } from "../app/api/analyze-drain/route.ts";

test("POST /api/analyze-drain processes demo image successfully", async () => {
  const imagePath = path.resolve("public/demo-drain.jpg");
  assert.ok(fs.existsSync(imagePath), "demo-drain.jpg must exist");

  const imageBuffer = fs.readFileSync(imagePath);
  const blob = new Blob([imageBuffer], { type: "image/jpeg" });
  const file = new File([blob], "demo-drain.jpg", { type: "image/jpeg" });

  const formData = new FormData();
  formData.append("file", file);

  const req = new Request("http://localhost:3000/api/analyze-drain", {
    method: "POST",
    body: formData,
  });

  const res = await POST(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(typeof data.blockage === "number" && data.blockage >= 15 && data.blockage <= 95);
  assert.ok(typeof data.litter === "number");
  assert.ok(typeof data.obstructionType === "string" && data.obstructionType.length > 0);
  assert.ok(Array.isArray(data.objects));
  assert.ok(data.confidence >= 70);
  assert.ok(data.processingTimeMs < 2000, "Should complete quickly");
});
