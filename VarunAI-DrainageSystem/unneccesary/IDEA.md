# VarunAI — 90% Base Clone & Rapid Implementation Plan

## 1. Top Candidate Repositories Evaluated

Based on live GitHub inspection and deep code analysis of the repositories identified in the research document, two open-source repositories provide a **~85–90% head start**:

| Metric | Option A: DrainGuard AI (Recommended) | Option B: Jal-Drishti Delhi |
| :--- | :--- | :--- |
| **Repository** | `https://github.com/bhavyakeerthi3/drainguard-ai` | `https://github.com/TheAshutoshMishra/Jal-Drishti-Delhi` |
| **Overlap with VarunAI** | **~90%** (Drain-level asset resolution, blockage/litter detection, storm-drain map, explainable priority scoring, rainfall scenarios, cleanup queue) | **~85%** (Municipal command center, flood hotspots, resource allocation planning, scenario simulation, PDF report export) |
| **Tech Stack** | Next.js 16 (App Router), React 19, TypeScript, TailwindCSS, Leaflet | Python (Flask, ReportLab) + React, Leaflet, Vite |
| **Core Strengths** | • Exact drain-level asset modeling<br>• `lib/scoring/priority.ts` & `environmentalRisk.ts`<br>• Interactive `DrainMap.tsx` with risk markers<br>• Unified single-command stack (`npm run dev`) | • Dedicated resource allocation engine<br>• Municipal officer workflow<br>• Python backend ready for custom algorithms |
| **The Missing 10% (VarunAI Differentiator)** | Add budget slider + knapsack optimizer (`budget_optimizer.ts`) & pre-monsoon action plan export | Convert point hotspots to linear drain segments; add photo evidence upload |

---

## 2. Gap Analysis: The Missing 10% to Make it 100% VarunAI

Both existing repositories lack the single feature that defines VarunAI: **Budget-Constrained Knapsack Optimization**.

```
Existing Repo (90%):
[Drain Asset Map] + [Rainfall / Storm Input] + [Evidence / Blockage] → [Risk Score (0-100)] → [Priority List]

VarunAI Target (100%):
[Drain Asset Map] + [Rainfall / Storm Input] + [Evidence / Blockage] → [Risk Score]
                                                                            ↓
                                                            [Budget Slider: ₹5L - ₹50L]
                                                            [Crew Capacity: N crew-hours]
                                                                            ↓
                                                            [Integer Linear Optimizer (Knapsack)]
                                                                            ↓
                                                            [Ranked Municipal Action Plan]
                                                            [Max Risk Reduced per Rupee]
```

---

## 3. Step-by-Step Implementation Roadmap

### Step 1: Clone & Bootstrap Foundation (Hour 1)
1. Clone chosen base repository into `./varunai-app` or root.
2. Initialize and verify dependencies (`npm install` or `pip install -r requirements.txt`).
3. Verify local dev server runs cleanly with map and scoring active.

### Step 2: Adapt Data Model for Drainage Network (Hour 2)
Implement the core drain segment schema:
```typescript
interface DrainSegment {
  id: string;                // e.g. "DRN-W45-101"
  name: string;              // e.g. "Anna Nagar 4th Avenue Main Drain"
  coordinates: [number, number][]; // Lat/Lng line coordinates
  lengthMeters: number;      // e.g. 450
  widthMeters: number;       // e.g. 1.8
  nominalCapacityM3s: number;// e.g. 12.5
  currentBlockagePct: number;// 0 - 100%
  elevationSlope: number;    // gradient / elevation penalty
  historicalFloodIncidents: number;
  lastCleanedDate: string;
  interventions: {
    type: 'desilting' | 'culvert_repair' | 'encroachment_clear' | 'screening_mesh';
    costInRupees: number;    // e.g. 1,50,000
    crewHours: number;       // e.g. 24
    riskReductionScore: number; // e.g. 42
  }[];
}
```

### Step 3: Build the VarunAI Budget Optimizer (Hour 3)
Implement the 0-1 Knapsack / Dynamic Programming Solver in `lib/optimizer/budgetOptimizer.ts` (or Python service):
```typescript
export interface OptimizationResult {
  allocatedBudget: number;
  totalCost: number;
  totalRiskReduction: number;
  efficiencyRatio: number; // Risk reduction per Lakh ₹
  selectedDrains: Array<{
    drainId: string;
    intervention: string;
    cost: number;
    expectedRiskReduction: number;
    reason: string;
  }>;
  unfundedHighRiskCount: number;
}
```

### Step 4: UI/UX Integration (Hours 4–5)
1. **Budget Slider**: Add interactive slider (`₹2,00,000` to `₹25,00,000`) at top header.
2. **Dynamic Map Layer**:
   - 🔴 Red: High Risk (Unfunded)
   - 🟢 Green: High Risk (Funded for Immediate Intervention by Optimizer)
   - 🟡 Yellow: Moderate Risk / Monitored
   - ⚪ Gray: Low Risk
3. **"Why this Drain?" Drawer**: Shows breakdown:
   - Capacity Deficit: $w_1 \times X\%$
   - Blockage & Debris: $w_2 \times Y\%$
   - Rainfall Exposure: $w_3 \times Z\%$
   - Complaint / Photo Evidence: $w_4 \times W\%$
4. **Action Plan Table & Export**:
   - List of targeted drain segments, recommended action, cost in ₹, and crew hours.
   - Button to download CSV / printable PDF Municipal Work Order.

### Step 5: What-If Scenario Controls & Citizen Feedback (Hour 6)
- Rainfall intensity toggle: Low (20 mm/hr), Heavy (65 mm/hr), Extreme Monsoon (110 mm/hr).
- Quick Citizen Complaint Form: Pin location + report blockage → instantly bumps drain risk and recalculates the budget allocation.

---

## 4. Winning Hackathon Pitch & Demo Walkthrough

1. **The Hook (30s)**: "Every monsoon, cities spend crores on desilting, yet waterlogging persists because tenders are distributed uniformly instead of targeting actual hydraulic bottlenecks under strict municipal budget caps."
2. **The Problem (30s)**: Show standard flood map: "A map tells you Ward 45 is flooded. It doesn't tell a municipal commissioner which 12 drains to clean first with ₹15 Lakhs."
3. **The Live Demo (2 min)**:
   - Load Ward 45 drainage network.
   - Set Budget to ₹10 Lakhs: Optimizer selects the 8 most critical drains delivering 68% citywide risk reduction.
   - Move slider to ₹20 Lakhs: Watch map turn green as high-risk drains receive funded work orders in real-time.
   - Click a drain to reveal the auditable "Why this drain?" factor breakdown.
   - Simulate a citizen photo report of a blocked culvert → Risk score updates → Budget optimizer re-allocates funds.
   - Export official Municipal Work Order.
