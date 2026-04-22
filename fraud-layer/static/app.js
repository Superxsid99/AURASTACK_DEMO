let selectedCaseId = null;
let trendPoints = [18, 24, 33, 41, 38, 52, 47, 65, 58, 72];

const STEPS = [
  { key: "intake_normalize", name: "Intake & Normalize" },
  { key: "entity_profiling", name: "Entity Profiling" },
  { key: "graph_linkage", name: "Relational Graph" },
  { key: "deviation_ml", name: "Deviation / ML Score" },
  { key: "rules_verdict", name: "Rules + Verdict" },
  { key: "explanation", name: "Explanation Layer" },
];

const qs = (id) => document.getElementById(id);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(path, options = {}) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json();
}

function scoreColor(score) {
  if (score >= 75) return "#ff758f";
  if (score >= 55) return "#ffd46d";
  if (score >= 35) return "#7ebcff";
  return "#78ffb1";
}

function renderRules(rules) {
  const wrap = qs("rules");
  wrap.innerHTML = "";
  for (const rule of rules) {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <div><strong>${rule.name}</strong>
        <span class="badge ${rule.severity === "CRITICAL" ? "danger" : "ok"}">${rule.severity}</span>
      </div>
      <div class="meta">${rule.key}</div>
      <div class="meta">${rule.description}</div>
    `;
    wrap.appendChild(row);
  }
}

function renderCases(cases) {
  const wrap = qs("cases");
  wrap.innerHTML = "";
  for (const c of cases) {
    const latest = c.latest_detection || null;
    const row = document.createElement("div");
    row.className = "item";
    if (c.case_id === selectedCaseId) row.classList.add("selected");
    row.innerHTML = `
      <div><strong>${c.case_id}</strong>
        <span class="badge ${c.is_known_fraud ? "danger" : "ok"}">${c.is_known_fraud ? "FRAUD-LABEL" : "UNLABELED"}</span>
      </div>
      <div class="meta">${c.customer_name || "Unknown"} | ${c.provider_name || "NA"}</div>
      <div class="meta">Amount: ${Number(c.claim_amount || 0).toLocaleString()}</div>
      <div class="meta">Latest: ${latest ? `${latest.verdict} (${latest.score})` : "Not yet detected"}</div>
      <button data-id="${c.case_id}">Detect</button>
    `;
    row.querySelector("button").onclick = async (event) => {
      event.stopPropagation();
      selectedCaseId = c.case_id;
      await detectCase();
      await loadCases();
    };
    row.onclick = async () => {
      selectedCaseId = c.case_id;
      await loadCases();
      if (latest) renderDetectionOutput(latest);
    };
    wrap.appendChild(row);
  }
}

function setBusy(buttonId, busy, busyText, normalText) {
  const btn = qs(buttonId);
  if (!btn) return;
  if (!btn.dataset.normalText) btn.dataset.normalText = normalText || btn.textContent;
  btn.disabled = busy;
  btn.textContent = busy ? busyText : btn.dataset.normalText;
}

function renderPipeline() {
  const wrap = qs("pipelineSteps");
  wrap.innerHTML = STEPS.map(
    (step) => `
      <div class="step" id="step-${step.key}">
        <div class="name">${step.name}</div>
        <div class="status" id="status-${step.key}">Pending</div>
      </div>
    `
  ).join("");
  setPipelineProgress(0, "Ready");
}

function setPipelineProgress(percent, label) {
  qs("pipelineProgress").style.width = `${percent}%`;
  qs("pipelineLabel").textContent = label;
}

function setStepState(stepKey, state, statusText) {
  const el = qs(`step-${stepKey}`);
  const status = qs(`status-${stepKey}`);
  if (!el || !status) return;
  el.classList.remove("active", "done", "failed");
  if (state) el.classList.add(state);
  status.textContent = statusText;
}

function resetStepStates() {
  for (const step of STEPS) setStepState(step.key, "", "Pending");
}

async function animateStepFlow() {
  resetStepStates();
  setPipelineProgress(0, "Running detection...");
  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    setStepState(step.key, "active", "Running...");
    setPipelineProgress(((i + 0.35) / STEPS.length) * 100, `Executing ${step.name}`);
    await wait(320 + i * 40);
    setStepState(step.key, "done", "Completed");
    setPipelineProgress(((i + 1) / STEPS.length) * 100, `${step.name} complete`);
    await wait(120);
  }
  setPipelineProgress(100, "Detection complete");
}

function animateCounter(el, toValue, suffix = "") {
  if (!el) return;
  const duration = 680;
  const start = performance.now();
  const from = 0;
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = from + (toValue - from) * eased;
    el.textContent = `${Math.round(current)}${suffix}`;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function updateKpis(data) {
  const findings = data.findings || {};
  animateCounter(qs("kpiRisk"), Number(data.score || 0), "/100");
  animateCounter(qs("kpiRules"), Number((data.triggered_rules || []).length), "");
  animateCounter(qs("kpiLinks"), Number(findings.relatedEntities || 0), "");
  qs("kpiVerdict").textContent = data.verdict || "--";
}

function drawTrend() {
  const canvas = qs("trendCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(132, 176, 245, 0.2)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const y = (h / 6) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const padX = 24;
  const padY = 20;
  const max = 100;
  const n = trendPoints.length;

  const points = trendPoints.map((val, i) => {
    const x = padX + (i * (w - 2 * padX)) / (n - 1);
    const y = h - padY - (val / max) * (h - 2 * padY);
    return { x, y };
  });

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(83, 242, 207, 0.42)");
  grad.addColorStop(1, "rgba(83, 242, 207, 0)");

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.lineTo(points[points.length - 1].x, h - padY);
  ctx.lineTo(points[0].x, h - padY);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = "#53f2cf";
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function formatLayerTrace(layerTrace = []) {
  return layerTrace
    .map(
      (layer) => `
      <li>
        <strong>${layer.stage_name}</strong> (${layer.model}) -> 
        score ${Number(layer.score || 0).toFixed(2)} 
        <span class="meta">[${layer.status}]</span>
      </li>
    `
    )
    .join("");
}

function renderDetectionOutput(data) {
  const color = scoreColor(Number(data.score || 0));
  const breakdown = data.model_breakdown || {};
  const rules = data.triggered_rules || [];
  const findings = data.findings || {};
  const models = data.model_selection || {};
  const pre = qs("result");
  const layerTrace = Array.isArray(data.layer_trace) ? data.layer_trace : [];

  pre.innerHTML = `
    <div class="headline">
      <div class="title">Live Fraud Decision</div>
      <span class="pill">${data.risk_band}</span>
    </div>

    <div class="meta-grid">
      <div class="m"><span class="k">Case ID</span><span class="v">${data.case_id}</span></div>
      <div class="m"><span class="k">Verdict</span><span class="v">${data.verdict}</span></div>
      <div class="m"><span class="k">Risk Score</span><span class="v">${data.score}/100</span></div>
      <div class="m"><span class="k">Decision Time</span><span class="v">${new Date(data.created_at).toLocaleTimeString()}</span></div>
    </div>

    <div class="section">
      <div class="h">Model Breakdown</div>
      <ul>
        <li>Entity Profiling: ${breakdown.entityProfiling ?? "-"}</li>
        <li>Relational Graph: ${breakdown.relationalGraph ?? "-"}</li>
        <li>Deviation Score: ${breakdown.deviationScore ?? "-"}</li>
        <li>GMM Likelihood: ${breakdown.gmmLikelihood ?? "-"}</li>
        <li>Rules Score: ${breakdown.rulesScore ?? "-"}</li>
      </ul>
    </div>

    <div class="section">
      <div class="h">Selected Models</div>
      <ul>
        <li>Intake: ${models.intake_normalize ?? "-"}</li>
        <li>Entity: ${models.entity_profiling ?? "-"}</li>
        <li>Graph: ${models.graph_linkage ?? "-"}</li>
        <li>Deviation: ${models.deviation_ml ?? "-"}</li>
        <li>Rules: ${models.rules_verdict ?? "-"}</li>
        <li>Explanation: ${models.explanation ?? "-"}</li>
      </ul>
    </div>

    <div class="section">
      <div class="h">Layer Trace</div>
      <ul>${formatLayerTrace(layerTrace) || "<li>No layer trace</li>"}</ul>
    </div>

    <div class="section">
      <div class="h">Triggered Rules (${rules.length})</div>
      <ul>${rules.length ? rules.map((r) => `<li>${r}</li>`).join("") : "<li>No hard-rule breach</li>"}</ul>
    </div>

    <div class="section">
      <div class="h">Investigator Summary</div>
      <div>${data.explanation}</div>
    </div>

    <div class="section">
      <div class="h">Case Findings</div>
      <ul>
        <li>Related Entities: ${findings.relatedEntities ?? "-"}</li>
        <li>Provider: ${findings.providerName ?? "-"}</li>
        <li>Policy Number: ${findings.policyNumber ?? "-"}</li>
        <li>Claim Amount: ${findings.claimAmount ?? "-"}</li>
      </ul>
    </div>
  `;

  pre.style.borderColor = color;
  pre.style.boxShadow = `0 0 0 1px ${color}44 inset, 0 0 34px ${color}22`;
  updateKpis(data);
  trendPoints = [...trendPoints.slice(-9), Number(data.score || 0)];
  drawTrend();
}

function renderSweepOutput(data) {
  const pre = qs("result");
  pre.innerHTML = `
    <div class="headline">
      <div class="title">Sector Sweep Report</div>
      <span class="pill">${String(data.sector || "").toUpperCase()}</span>
    </div>
    <div class="meta-grid">
      <div class="m"><span class="k">Total Cases</span><span class="v">${data.count}</span></div>
      <div class="m"><span class="k">Fraud Rate</span><span class="v">${data.fraudRate}%</span></div>
      <div class="m"><span class="k">Average Score</span><span class="v">${data.avgScore}</span></div>
      <div class="m"><span class="k">Top Rule</span><span class="v">${data.topRule}</span></div>
    </div>
  `;
  pre.style.borderColor = "#53f2cf";
  pre.style.boxShadow = "0 0 0 1px rgba(83,242,207,0.25) inset, 0 0 24px rgba(83,242,207,0.16)";
}

async function loadRules() {
  const sector = qs("sector").value;
  const data = await api(`/api/rules?sector=${encodeURIComponent(sector)}`);
  renderRules(data.rules || []);
}

async function loadCases() {
  const sector = qs("sector").value;
  const data = await api(`/api/cases?sector=${encodeURIComponent(sector)}`);
  const rows = data.data || [];
  const heroCases = qs("heroActiveCases");
  if (heroCases) heroCases.textContent = String(rows.length);
  if (!rows.length) {
    selectedCaseId = null;
    qs("cases").innerHTML = '<div class="item"><div class="meta">No cases for this sector yet.</div></div>';
    return;
  }
  const found = rows.find((r) => r.case_id === selectedCaseId);
  if (!found) selectedCaseId = rows[0].case_id;
  renderCases(rows);
  const selected = rows.find((r) => r.case_id === selectedCaseId);
  if (selected && selected.latest_detection) renderDetectionOutput(selected.latest_detection);
}

async function detectCase() {
  if (!selectedCaseId) return;
  try {
    setBusy("detectSelected", true, "Detecting...", "Detect Selected");
    await animateStepFlow();
    const out = await api("/api/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: selectedCaseId }),
    });
    renderDetectionOutput(out.data);
  } catch (err) {
    setPipelineProgress(100, "Failed");
    setStepState("rules_verdict", "failed", "Failed");
    qs("result").textContent = `Detection failed:\n${err.message}`;
  } finally {
    setBusy("detectSelected", false, "Detecting...", "Detect Selected");
  }
}

async function runSweep() {
  const sector = qs("sector").value;
  setPipelineProgress(15, "Running sector sweep...");
  try {
    setBusy("runSweep", true, "Running...", "Run Sector Sweep");
    const out = await api("/api/sweep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sector }),
    });
    setPipelineProgress(100, "Sweep completed");
    renderSweepOutput(out.data);
  } catch (err) {
    setPipelineProgress(100, "Sweep failed");
    qs("result").textContent = `Sweep failed:\n${err.message}`;
  } finally {
    setBusy("runSweep", false, "Running...", "Run Sector Sweep");
  }
}

async function uploadEvidence(event) {
  event.preventDefault();
  const file = qs("file").files[0];
  if (!file) return;
  const form = new FormData();
  form.append("sector", qs("sector").value);
  form.append("title", qs("title").value || file.name);
  form.append("file", file);
  try {
    const uploadBtn = qs("uploadForm")?.querySelector("button[type='submit']");
    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.textContent = "Uploading...";
    }
    const out = await api("/api/upload-evidence", { method: "POST", body: form });
    selectedCaseId = out.case_id;
    await loadCases();
    resetStepStates();
    setPipelineProgress(0, "Uploaded. Ready to detect");
    qs("result").textContent = `Uploaded as ${out.case_id}. Click "Detect Selected" now.`;
    qs("uploadForm").reset();
  } catch (err) {
    qs("result").textContent = `Upload failed:\n${err.message}`;
  } finally {
    const uploadBtn = qs("uploadForm")?.querySelector("button[type='submit']");
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload Evidence";
    }
  }
}

async function boot() {
  qs("sector").onchange = async () => {
    selectedCaseId = null;
    await loadRules();
    await loadCases();
  };
  qs("refreshCases").onclick = loadCases;
  qs("runSweep").onclick = runSweep;
  qs("detectSelected").onclick = detectCase;
  qs("uploadForm").onsubmit = uploadEvidence;
  renderPipeline();
  drawTrend();
  await loadRules();
  await loadCases();
}

boot().catch((err) => {
  qs("result").textContent = `Startup error:\n${err.message}`;
});
