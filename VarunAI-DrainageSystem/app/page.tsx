"use client";

import { useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import { DrainMap, type MapSite } from "./DrainMap";
import { VarunAIBudgetPlanner } from "./VarunAIPanels";
import {
  type DrainAnalysisResponse,
} from "./api/analyze-drain/route";
import {
  type DrainMaintenanceCandidate,
  type OptimizedActionItem,
  determineIntervention,
  formatINR,
  generateActionPlanCSV,
  solveBudgetOptimization,
} from "../lib/optimizer/budgetOptimizer";

const INITIAL_DRAIN_SITES: MapSite[] = [
  {
    id: "DRN-W45-101",
    place: "5th Cross Canal Inflow · Koramangala",
    ward: "Ward 45 (Central Basin)",
    risk: 88,
    environmentalRisk: 91,
    environmentalLevel: "critical",
    environmentalDistanceMeters: 180,
    environmentalContext: "Primary outfall conduit into Bellandur feeder canal",
    status: "Dispatch now",
    lat: 12.9352,
    lon: 77.6245,
    rainfall: 22,
    blockage: 84,
    litter: 68,
    capacityDeficit: 85,
    lengthM: 420,
    recommendedAction: "Heavy mechanical desilting required immediately.",
    photo: "/demo-drain.jpg",
  },
  {
    id: "DRN-W45-102",
    place: "Market Culvert Underpass · Shantinagar",
    ward: "Ward 45 (Central Basin)",
    risk: 78,
    environmentalRisk: 82,
    environmentalLevel: "high",
    environmentalDistanceMeters: 520,
    environmentalContext: "Cross-culvert junction with commercial market plastic deposition",
    status: "Inspect today",
    lat: 12.9536,
    lon: 77.5937,
    rainfall: 22,
    blockage: 75,
    litter: 60,
    capacityDeficit: 70,
    lengthM: 280,
    recommendedAction: "High-pressure culvert jetting and debris extraction.",
    photo: "/demo-drain.jpg",
  },
  {
    id: "DRN-W45-103",
    place: "Railway Embankment Drain · Cantonment",
    ward: "Ward 45 (Central Basin)",
    risk: 93,
    environmentalRisk: 95,
    environmentalLevel: "critical",
    environmentalDistanceMeters: 120,
    environmentalContext: "Severe silt bed & informal embankment constriction",
    status: "Dispatch now",
    lat: 12.9930,
    lon: 77.5980,
    rainfall: 24,
    blockage: 88,
    litter: 74,
    capacityDeficit: 90,
    lengthM: 350,
    recommendedAction: "Encroachment removal and channel bank excavation.",
    photo: "/demo-drain.jpg",
  },
  {
    id: "DRN-W45-104",
    place: "100ft Trunk Drain Siphon · Indiranagar",
    ward: "Ward 45 (Central Basin)",
    risk: 68,
    environmentalRisk: 70,
    environmentalLevel: "high",
    environmentalDistanceMeters: 380,
    environmentalContext: "Sediment build-up at inverted siphon inlet chamber",
    status: "Inspect today",
    lat: 12.9784,
    lon: 77.6408,
    rainfall: 20,
    blockage: 65,
    litter: 50,
    capacityDeficit: 62,
    lengthM: 650,
    recommendedAction: "Mechanical silt pump extraction.",
    photo: "/demo-drain.jpg",
  },
  {
    id: "DRN-W45-105",
    place: "Metro Drop Inlet Grate · MG Road",
    ward: "Ward 45 (Central Basin)",
    risk: 54,
    environmentalRisk: 52,
    environmentalLevel: "moderate",
    environmentalDistanceMeters: null,
    environmentalContext: "Urban street curb drop inlet grate",
    status: "Needs review",
    lat: 12.9750,
    lon: 77.6080,
    rainfall: 18,
    blockage: 50,
    litter: 36,
    capacityDeficit: 45,
    lengthM: 310,
    recommendedAction: "Silt trap and trash screen mesh installation.",
    photo: "/demo-drain.jpg",
  },
  {
    id: "DRN-W45-106",
    place: "Lake Outlet Spillway · Jayanagar",
    ward: "Ward 45 (Central Basin)",
    risk: 62,
    environmentalRisk: 65,
    environmentalLevel: "high",
    environmentalDistanceMeters: 250,
    environmentalContext: "Weed & silt deposition along secondary spillway channel",
    status: "Inspect today",
    lat: 12.9250,
    lon: 77.5938,
    rainfall: 18,
    blockage: 60,
    litter: 42,
    capacityDeficit: 55,
    lengthM: 520,
    recommendedAction: "Hydraulic desilting and vegetation clearance.",
    photo: "/demo-drain.jpg",
  },
  {
    id: "DRN-W45-107",
    place: "Industrial Canal Link · Peenya West",
    ward: "Ward 45 (Industrial Sector)",
    risk: 75,
    environmentalRisk: 78,
    environmentalLevel: "high",
    environmentalDistanceMeters: 400,
    environmentalContext: "Heavy industrial sludge and particulate sediment",
    status: "Inspect today",
    lat: 13.0280,
    lon: 77.5400,
    rainfall: 25,
    blockage: 70,
    litter: 58,
    capacityDeficit: 75,
    lengthM: 850,
    recommendedAction: "Excavator desilting and debris barrier installation.",
    photo: "/demo-drain.jpg",
  },
  {
    id: "DRN-W45-108",
    place: "Sector 2 Feeder Drain · HSR Layout",
    ward: "Ward 45 (South Sector)",
    risk: 32,
    environmentalRisk: 28,
    environmentalLevel: "low",
    environmentalDistanceMeters: 900,
    environmentalContext: "Masonry lined branch drain with unimpeded flow",
    status: "Verified clear",
    lat: 12.9120,
    lon: 77.6450,
    rainfall: 15,
    blockage: 24,
    litter: 16,
    capacityDeficit: 18,
    lengthM: 380,
    recommendedAction: "Cleanup verified. Routine pre-monsoon monitoring.",
    photo: "/demo-drain.jpg",
  },
];

type AppTab = "budget" | "inspector" | "simulator" | "report";

export default function VarunAIPage() {
  const [activeTab, setActiveTab] = useState<AppTab>("budget");
  const [sites, setSites] = useState<MapSite[]>(INITIAL_DRAIN_SITES);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("DRN-W45-103");
  const [budgetRupees, setBudgetRupees] = useState<number>(1000000); // ₹10.0 Lakhs default
  const [availableCrews, setAvailableCrews] = useState<number>(3);
  const [monsoonIntensityMm, setMonsoonIntensityMm] = useState<number>(45);

  // AI Inspection Intake State
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<DrainAnalysisResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reportDrainLocation, setReportDrainLocation] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Selected Site
  const selectedSite = useMemo(() => {
    return sites.find((s) => s.id === selectedSiteId) ?? sites[0];
  }, [sites, selectedSiteId]);

  // Recalculate candidates and run Knapsack Optimizer
  const candidates: DrainMaintenanceCandidate[] = useMemo(() => {
    return sites.map((s) => {
      const blockage = s.blockage ?? 50;
      const capacityDeficit = s.capacityDeficit ?? Math.min(95, Math.round(blockage * 0.9 + 10));
      const litter = s.litter ?? 30;

      // Adjust risk dynamically based on monsoon intensity in simulator mode
      const rainfallEffect = Math.min(30, (monsoonIntensityMm / 100) * 28);
      const compositeRisk = Math.min(99, Math.round((s.environmentalRisk ?? s.risk) * 0.75 + rainfallEffect));

      const intervention = determineIntervention(blockage, capacityDeficit, litter);
      return {
        id: s.id,
        place: s.place,
        ward: s.ward ?? "Ward 45 (Central Basin)",
        lat: s.lat,
        lon: s.lon,
        riskScore: compositeRisk,
        blockagePct: blockage,
        rainfallMm: monsoonIntensityMm,
        capacityDeficitPct: capacityDeficit,
        recommendedIntervention: intervention,
      };
    });
  }, [sites, monsoonIntensityMm]);

  const optimizationResult = useMemo(() => {
    return solveBudgetOptimization(candidates, budgetRupees, availableCrews);
  }, [candidates, budgetRupees, availableCrews]);

  const fundedMap = useMemo(() => {
    const map = new Map<string, OptimizedActionItem>();
    optimizationResult.selectedActions.forEach((a) => map.set(a.drainId, a));
    return map;
  }, [optimizationResult]);

  // Enriched sites with live funding status for the Leaflet Map
  const sitesWithFunding: MapSite[] = useMemo(() => {
    return sites.map((s) => {
      const funded = fundedMap.get(s.id);
      return {
        ...s,
        isFunded: Boolean(funded),
        fundedIntervention: funded?.intervention.label,
        allocatedCost: funded?.costRupees,
        crewHours: funded?.crewHours,
        expectedRiskReduction: funded?.riskReduction,
        assignedCrew: funded?.assignedCrewId,
      };
    });
  }, [sites, fundedMap]);

  // Handle Image Upload & Fast Server-Side AI Analysis
  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setAnalysisResult(null);
    setAnalyzingImage(true);

    const previewUrl = URL.createObjectURL(file);
    setUploadedPreviewUrl(previewUrl);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/analyze-drain", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data: DrainAnalysisResponse = await res.json();
      if (!data.success) {
        throw new Error("Analysis failed");
      }

      setAnalysisResult(data);
    } catch (err: unknown) {
      console.error("AI Analysis error:", err);
      const msg = err instanceof Error ? err.message : "Error analyzing image";
      setUploadError(`Analysis error: ${msg}. Please try another photo.`);
    } finally {
      setAnalyzingImage(false);
    }
  }

  // Commit Analyzed Photo to Ward Drainage Network
  function handleCommitReport() {
    if (!analysisResult) return;

    const newId = `DRN-W45-${109 + sites.length - 8}`;
    const newSite: MapSite = {
      id: newId,
      place: reportDrainLocation.trim() || `Field Report Inlet #${newId}`,
      ward: "Ward 45 (Central Basin)",
      lat: 12.945 + (Math.random() - 0.5) * 0.05,
      lon: 77.61 + (Math.random() - 0.5) * 0.05,
      risk: Math.round(analysisResult.blockage * 0.85 + 10),
      environmentalRisk: Math.round(analysisResult.blockage * 0.9),
      environmentalLevel: analysisResult.blockage >= 75 ? "critical" : "high",
      status: "Dispatch now",
      rainfall: monsoonIntensityMm,
      blockage: analysisResult.blockage,
      litter: analysisResult.litter,
      capacityDeficit: Math.round(analysisResult.blockage * 0.95),
      lengthM: 300,
      photo: uploadedPreviewUrl ?? "/demo-drain.jpg",
      recommendedAction: analysisResult.recommendedIntervention,
    };

    setSites((prev) => [newSite, ...prev]);
    setSelectedSiteId(newId);
    setActiveTab("budget"); // Switch back to see updated budget plan
  }

  return (
    <div className="varunai-app-shell">
      {/* Top Municipal Navigation Header */}
      <header className="varunai-top-header">
        <div className="header-left">
          <div className="logo-emblem">🌊</div>
          <div>
            <div className="brand-title">
              VARUNAI <span className="brand-subtitle">वरुण AI</span>
            </div>
            <div className="brand-caption">
              Municipal Urban Drainage Intelligence & Budget Optimizer
            </div>
          </div>
        </div>

        <div className="header-center">
          <div className="ward-pill">
            <span className="live-dot" /> Ward 45 · Central Urban Basin (Pre-Monsoon 2026)
          </div>
        </div>

        <div className="header-right">
          <div className="quick-budget-badge">
            <small>Active Budget Cap</small>
            <strong>{formatINR(budgetRupees)}</strong>
          </div>
          <button
            type="button"
            className="btn-quick-export"
            onClick={() => {
              const csv = generateActionPlanCSV(optimizationResult);
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `VarunAI_WorkOrders_Ward45.csv`;
              link.click();
            }}
          >
            📥 Export Work Orders
          </button>
        </div>
      </header>

      {/* Tab Navigation Ribbon */}
      <nav className="varunai-tab-ribbon" aria-label="Main Navigation">
        <button
          type="button"
          className={`tab-btn ${activeTab === "budget" ? "active" : ""}`}
          onClick={() => setActiveTab("budget")}
        >
          💰 1. Budget Allocator & Map
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "inspector" ? "active" : ""}`}
          onClick={() => setActiveTab("inspector")}
        >
          🔍 2. Asset Diagnostics & "Why This Drain?"
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "simulator" ? "active" : ""}`}
          onClick={() => setActiveTab("simulator")}
        >
          ⛈️ 3. Monsoon What-If Simulator
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "report" ? "active" : ""}`}
          onClick={() => setActiveTab("report")}
        >
          📸 4. Field Inspection AI Scanner
        </button>
      </nav>

      {/* Main Workspace Content */}
      <main className="varunai-main-container">
        {/* ============================================================ */}
        {/* TAB 1: BUDGET ALLOCATOR & MAP (CORE DIFFERENTIATOR)          */}
        {/* ============================================================ */}
        {activeTab === "budget" && (
          <div className="tab-pane active-fade">
            {/* Top Quick Stats Strip */}
            <div className="executive-kpi-bar">
              <div className="kpi-stat-item">
                <span className="stat-label">Municipal Budget</span>
                <span className="stat-value">{formatINR(budgetRupees)}</span>
                <span className="stat-meta">Fiscal Cap</span>
              </div>
              <div className="kpi-stat-item highlight-green">
                <span className="stat-label">Committed Spend</span>
                <span className="stat-value">{formatINR(optimizationResult.totalCostRupees)}</span>
                <span className="stat-meta">{optimizationResult.budgetUtilizationPct}% Allocated</span>
              </div>
              <div className="kpi-stat-item highlight-blue">
                <span className="stat-label">Drains Funded</span>
                <span className="stat-value">
                  {optimizationResult.fundedCandidatesCount} <small>/ {sites.length}</small>
                </span>
                <span className="stat-meta">{optimizationResult.totalCrewHoursRequired} Crew-Hrs</span>
              </div>
              <div className="kpi-stat-item highlight-emerald">
                <span className="stat-label">Citywide Flood Risk Drop</span>
                <span className="stat-value">-{optimizationResult.totalRiskReduction} pts</span>
                <span className="stat-meta">Direct Risk Alleviation</span>
              </div>
              <div className="kpi-stat-item">
                <span className="stat-label">Cost Efficiency</span>
                <span className="stat-value">{optimizationResult.efficiencyRatio}</span>
                <span className="stat-meta">Risk pts / ₹1.0 Lakh</span>
              </div>
            </div>

            {/* Main Interactive Split Layout */}
            <div className="budget-map-split-view">
              {/* Left Column: Interactive Leaflet Map */}
              <div className="map-column-card">
                <div className="column-card-header">
                  <div>
                    <h4>🗺️ Ward 45 Drainage Asset Network</h4>
                    <p className="card-subtitle">
                      Live sync with Knapsack Optimizer: ⚡ Emerald Green = Funded for Desilting
                    </p>
                  </div>
                  <span className="live-asset-count">{sites.length} Active Drains</span>
                </div>
                <div className="map-wrapper-box">
                  <DrainMap
                    sites={sitesWithFunding}
                    selectedId={selectedSiteId}
                    onSelect={(site) => setSelectedSiteId(site.id)}
                  />
                </div>
              </div>

              {/* Right Column: Optimizer & Action Planner */}
              <div className="planner-column-card">
                <VarunAIBudgetPlanner
                  sites={sitesWithFunding}
                  budgetRupees={budgetRupees}
                  availableCrews={availableCrews}
                  onBudgetChange={setBudgetRupees}
                  onCrewsChange={setAvailableCrews}
                  onSelectDrain={(id) => setSelectedSiteId(id)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: ASSET DIAGNOSTICS & "WHY THIS DRAIN?"                 */}
        {/* ============================================================ */}
        {activeTab === "inspector" && (
          <div className="tab-pane active-fade">
            <div className="diagnostics-layout">
              {/* Asset Selector Sidebar */}
              <div className="asset-selector-sidebar">
                <h4>Drain Assets in Ward 45</h4>
                <div className="asset-list-scroll">
                  {sitesWithFunding.map((site) => (
                    <button
                      key={site.id}
                      type="button"
                      className={`asset-item-btn ${site.id === selectedSiteId ? "selected" : ""}`}
                      onClick={() => setSelectedSiteId(site.id)}
                    >
                      <div className="asset-item-top">
                        <strong>{site.id}</strong>
                        <span className={`status-pill ${site.isFunded ? "funded" : "unfunded"}`}>
                          {site.isFunded ? "⚡ Funded" : "🔴 Unfunded"}
                        </span>
                      </div>
                      <span className="asset-item-name">{site.place}</span>
                      <div className="asset-item-bottom">
                        <small>Risk: {site.environmentalRisk ?? site.risk}/100</small>
                        <small>Blockage: {site.blockage ?? 50}%</small>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Asset Details & Evidence Breakdown */}
              <div className="asset-detail-card">
                <div className="detail-header">
                  <div>
                    <span className="kicker-tag">Asset Diagnostics</span>
                    <h3>{selectedSite.id} — {selectedSite.place}</h3>
                    <p className="detail-coords">
                      GPS: {selectedSite.lat.toFixed(4)}, {selectedSite.lon.toFixed(4)} · {selectedSite.ward}
                    </p>
                  </div>
                  <div className="risk-score-box">
                    <span className="score-num">{selectedSite.environmentalRisk ?? selectedSite.risk}</span>
                    <small>/ 100 Risk</small>
                  </div>
                </div>

                {/* Evidence Image Stage */}
                <div className="detail-evidence-stage">
                  <div className="evidence-photo-box">
                    <NextImage
                      src={selectedSite.photo ?? "/demo-drain.jpg"}
                      alt={selectedSite.id}
                      fill
                      className="evidence-img"
                      unoptimized
                    />
                    <div className="photo-tag-overlay">
                      <span>📸 Field Evidence Photo</span>
                    </div>
                  </div>

                  <div className="physical-specs-grid">
                    <div className="spec-item">
                      <span>Segment Length</span>
                      <strong>{selectedSite.lengthM ?? 350} meters</strong>
                    </div>
                    <div className="spec-item">
                      <span>Hydraulic Deficit</span>
                      <strong>{selectedSite.capacityDeficit ?? 75}%</strong>
                    </div>
                    <div className="spec-item">
                      <span>Current Blockage</span>
                      <strong>{selectedSite.blockage ?? 70}%</strong>
                    </div>
                    <div className="spec-item">
                      <span>Rainfall Exposure</span>
                      <strong>{selectedSite.rainfall ?? 20} mm/hr</strong>
                    </div>
                  </div>
                </div>

                {/* Auditable Factor Breakdown ("Why This Drain?") */}
                <div className="why-breakdown-section">
                  <h4>Auditable Factor Contributions ("Why this Drain?")</h4>
                  <p className="why-subtext">
                    Transparent formula weights: environmental risk is computed deterministically, never by a black box.
                  </p>

                  <div className="factor-bars-list">
                    <div className="factor-row">
                      <div className="factor-meta">
                        <span>Blockage & Silt Occlusion (35% weight)</span>
                        <strong>{selectedSite.blockage ?? 50}%</strong>
                      </div>
                      <div className="progress-bar-track">
                        <div
                          className="progress-bar-fill fill-red"
                          style={{ width: `${selectedSite.blockage ?? 50}%` }}
                        />
                      </div>
                    </div>

                    <div className="factor-row">
                      <div className="factor-meta">
                        <span>Hydraulic Capacity Deficit (25% weight)</span>
                        <strong>{selectedSite.capacityDeficit ?? 60}%</strong>
                      </div>
                      <div className="progress-bar-track">
                        <div
                          className="progress-bar-fill fill-orange"
                          style={{ width: `${selectedSite.capacityDeficit ?? 60}%` }}
                        />
                      </div>
                    </div>

                    <div className="factor-row">
                      <div className="factor-meta">
                        <span>Monsoon Rainfall Exposure (20% weight)</span>
                        <strong>{Math.min(100, Math.round(((selectedSite.rainfall ?? 20) / 75) * 100))}%</strong>
                      </div>
                      <div className="progress-bar-track">
                        <div
                          className="progress-bar-fill fill-blue"
                          style={{ width: `${Math.min(100, Math.round(((selectedSite.rainfall ?? 20) / 75) * 100))}%` }}
                        />
                      </div>
                    </div>

                    <div className="factor-row">
                      <div className="factor-meta">
                        <span>Citizen Complaint & Litter Evidence (20% weight)</span>
                        <strong>{selectedSite.litter ?? 40}%</strong>
                      </div>
                      <div className="progress-bar-track">
                        <div
                          className="progress-bar-fill fill-amber"
                          style={{ width: `${selectedSite.litter ?? 40}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assigned Municipal Action */}
                <div className="assigned-intervention-banner">
                  <div>
                    <span className="banner-kicker">Recommended Intervention</span>
                    <h4>{selectedSite.recommendedAction ?? "Heavy Mechanical Desilting"}</h4>
                    <p>{selectedSite.environmentalContext}</p>
                  </div>
                  <div className="banner-status-tag">
                    {selectedSite.isFunded ? (
                      <span className="badge-funded">⚡ APPROVED IN PLAN ({formatINR(selectedSite.allocatedCost ?? 140000)})</span>
                    ) : (
                      <span className="badge-unfunded">⏳ UNALLOCATED (Needs +{formatINR(140000)})</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: MONSOON WHAT-IF SIMULATOR                             */}
        {/* ============================================================ */}
        {activeTab === "simulator" && (
          <div className="tab-pane active-fade">
            <div className="simulator-panel-card">
              <div className="sim-header">
                <div>
                  <span className="kicker-tag">Controlled Simulation</span>
                  <h3>⛈️ Pre-Monsoon Cloudburst What-If Simulator</h3>
                  <p>
                    Adjust rainfall intensity to simulate how hydraulic risk spikes across the network and watch the optimizer adapt.
                  </p>
                </div>
                <div className="current-intensity-box">
                  <span className="intensity-value">{monsoonIntensityMm} mm/hr</span>
                  <small>Simulated Rainfall</small>
                </div>
              </div>

              {/* Slider & Presets */}
              <div className="sim-controls-box">
                <label className="sim-slider-label">
                  <span>Rainfall Intensity Slider</span>
                  <input
                    type="range"
                    min={10}
                    max={120}
                    step={5}
                    value={monsoonIntensityMm}
                    onChange={(e) => setMonsoonIntensityMm(Number(e.target.value))}
                    className="sim-range-input"
                  />
                </label>

                <div className="sim-presets-row">
                  <button
                    type="button"
                    className={`preset-btn ${monsoonIntensityMm === 20 ? "active" : ""}`}
                    onClick={() => setMonsoonIntensityMm(20)}
                  >
                    Moderate Rain (20 mm/hr)
                  </button>
                  <button
                    type="button"
                    className={`preset-btn ${monsoonIntensityMm === 55 ? "active" : ""}`}
                    onClick={() => setMonsoonIntensityMm(55)}
                  >
                    Heavy Monsoon (55 mm/hr)
                  </button>
                  <button
                    type="button"
                    className={`preset-btn ${monsoonIntensityMm === 95 ? "active" : ""}`}
                    onClick={() => setMonsoonIntensityMm(95)}
                  >
                    Extreme Cloudburst (95 mm/hr)
                  </button>
                </div>
              </div>

              {/* Simulation Impact Table */}
              <div className="sim-results-table-wrap">
                <h4>Network Surge Response Under {monsoonIntensityMm} mm/hr Storm</h4>
                <table className="varunai-table">
                  <thead>
                    <tr>
                      <th>Drain Segment</th>
                      <th>Location</th>
                      <th>Blockage</th>
                      <th>Nominal Capacity</th>
                      <th>Simulated Surge Risk</th>
                      <th>Optimizer Allocation Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((cand) => {
                      const isFunded = fundedMap.has(cand.id);
                      return (
                        <tr key={cand.id}>
                          <td><strong>{cand.id}</strong></td>
                          <td>{cand.place}</td>
                          <td>{cand.blockagePct}%</td>
                          <td>{cand.capacityDeficitPct}% Deficit</td>
                          <td>
                            <span className={`risk-tag ${cand.riskScore >= 80 ? "critical" : cand.riskScore >= 60 ? "high" : "moderate"}`}>
                              {cand.riskScore}/100
                            </span>
                          </td>
                          <td>
                            {isFunded ? (
                              <span className="badge-funded">⚡ Funded ({formatINR(cand.recommendedIntervention.costRupees)})</span>
                            ) : (
                              <span className="badge-unfunded">⏳ Defer Backlog</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: FIELD INSPECTION & RELIABLE AI SCANNER                */}
        {/* ============================================================ */}
        {activeTab === "report" && (
          <div className="tab-pane active-fade">
            <div className="scanner-container-card">
              <div className="scanner-header">
                <div>
                  <span className="kicker-tag">Server-Side Vision Engine</span>
                  <h3>📸 Field Photo & Citizen Blockage Scanner</h3>
                  <p>
                    Upload any drain photo for instant server-side AI analysis (~200ms). Eliminates heavy browser downloads and flaky CDNs.
                  </p>
                </div>
              </div>

              <div className="scanner-body-grid">
                {/* Upload & Stage Area */}
                <div className="upload-stage-box">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    style={{ display: "none" }}
                  />

                  {uploadedPreviewUrl ? (
                    <div className="preview-container">
                      <NextImage
                        src={uploadedPreviewUrl}
                        alt="Uploaded Drain"
                        fill
                        className="preview-img"
                        unoptimized
                      />
                      {analysisResult?.objects.map((obj, i) => (
                        <div
                          key={i}
                          className="vision-bounding-box"
                          style={{
                            left: `${obj.bbox[0]}%`,
                            top: `${obj.bbox[1]}%`,
                            width: `${obj.bbox[2]}%`,
                            height: `${obj.bbox[3]}%`,
                          }}
                        >
                          <span>{obj.class} ({Math.round(obj.score * 100)}%)</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="upload-dropzone"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="dropzone-icon">📷</div>
                      <strong>Upload Drain Inspection Photo</strong>
                      <p>Click to choose a JPG, PNG, or WEBP photo</p>
                    </div>
                  )}

                  <div className="upload-actions-bar">
                    <button
                      type="button"
                      className="btn-select-file"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={analyzingImage}
                    >
                      {analyzingImage ? "Analyzing with AI..." : "Select Photo to Scan →"}
                    </button>
                    {uploadedPreviewUrl && (
                      <button
                        type="button"
                        className="btn-clear-file"
                        onClick={() => {
                          setUploadedPreviewUrl(null);
                          setAnalysisResult(null);
                        }}
                      >
                        Reset Photo
                      </button>
                    )}
                  </div>

                  {uploadError && <p className="error-text">{uploadError}</p>}
                </div>

                {/* AI Analysis Diagnostic Results */}
                <div className="analysis-results-card">
                  <h4>AI Vision Diagnostics</h4>

                  {analyzingImage && (
                    <div className="loading-state-box">
                      <div className="spinner" />
                      <p>Scanning surface texture, sediment tone, and grate structure...</p>
                    </div>
                  )}

                  {!analyzingImage && !analysisResult && (
                    <div className="empty-analysis-state">
                      <p>Upload a photo on the left to run instantaneous neural feature extraction.</p>
                      <button
                        type="button"
                        className="btn-try-demo"
                        onClick={async () => {
                          setAnalyzingImage(true);
                          setUploadedPreviewUrl("/demo-drain.jpg");
                          try {
                            const res = await fetch("/demo-drain.jpg");
                            const blob = await res.blob();
                            const file = new File([blob], "demo-drain.jpg", { type: "image/jpeg" });
                            const formData = new FormData();
                            formData.append("file", file);
                            const apiRes = await fetch("/api/analyze-drain", { method: "POST", body: formData });
                            const data = await apiRes.json();
                            setAnalysisResult(data);
                          } catch (e) {
                            console.error(e);
                          } finally {
                            setAnalyzingImage(false);
                          }
                        }}
                      >
                        Try Sample Drain Image
                      </button>
                    </div>
                  )}

                  {analysisResult && (
                    <div className="analysis-data-view">
                      <div className="ai-top-badge-row">
                        <span className="badge-confirmed">✓ Drain Confirmed ({analysisResult.confidence}%)</span>
                        <span className="badge-latency">⚡ {analysisResult.processingTimeMs}ms Latency</span>
                      </div>

                      <div className="metrics-duo">
                        <div className="metric-box">
                          <span>Detected Blockage</span>
                          <strong className="blockage-val">{analysisResult.blockage}%</strong>
                        </div>
                        <div className="metric-box">
                          <span>Floating Litter</span>
                          <strong className="litter-val">{analysisResult.litter}%</strong>
                        </div>
                      </div>

                      <div className="diagnostic-row">
                        <span>Identified Obstruction:</span>
                        <strong>{analysisResult.obstructionType}</strong>
                      </div>

                      <div className="diagnostic-row">
                        <span>Required Intervention:</span>
                        <strong>{analysisResult.recommendedIntervention}</strong>
                      </div>

                      {/* Link to Drainage Network */}
                      <div className="link-report-form">
                        <label>
                          <span>Attach to Drain Location / Landmark</span>
                          <input
                            type="text"
                            placeholder="e.g. 12th Main Road Culvert Inflow"
                            value={reportDrainLocation}
                            onChange={(e) => setReportDrainLocation(e.target.value)}
                            className="input-location"
                          />
                        </label>
                        <button
                          type="button"
                          className="btn-commit-report"
                          onClick={handleCommitReport}
                        >
                          ⚡ Add to Active Network & Re-Optimize Budget
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
