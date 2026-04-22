const LAYER_ORDER = [
  "intake_normalize",
  "entity_profiling",
  "graph_linkage",
  "deviation_ml",
  "rules_verdict",
  "explanation",
];

let selectedSector = "insurance";
let selectedCaseId = null;
let selectedLayerKey = null;
let cachedTrace = [];

const qs = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pretty(value) {
  return escapeHtml(JSON.stringify(value ?? {}, null, 2));
}

function verdictBadgeClass(verdict) {
  if (verdict === "FRAUD") return "danger";
  if (verdict === "REVIEW") return "warn";
  return "ok";
}

function renderCases(rows) {
  const wrap = qs("cases");
  wrap.innerHTML = "";
  if (!rows.length) {
    wrap.innerHTML = '<div class="item"><div class="meta">No cases found for this sector.</div></div>';
    return;
  }

  for (const c of rows) {
    const latest = c.latest_detection;
    const row = document.createElement("div");
    row.className = "item";
    if (c.case_id === selectedCaseId) row.classList.add("selected");

    const verdict = latest?.verdict ?? "NO DETECTION";
    const score = latest?.score ?? "-";
    row.innerHTML = `
      <div><strong>${escapeHtml(c.case_id)}</strong>
        <span class="badge ${verdictBadgeClass(verdict)}">${escapeHtml(verdict)}</span>
      </div>
      <div class="meta">${escapeHtml(c.customer_name || "Unknown")} | ${escapeHtml(c.provider_name || "Unknown Provider")}</div>
      <div class="meta">Amount: ${Number(c.claim_amount || 0).toLocaleString()}</div>
      <div class="meta">Score: ${escapeHtml(score)}</div>
    `;

    row.onclick = async () => {
      selectedCaseId = c.case_id;
      selectedLayerKey = null;
      await loadCases();
      await loadExplainability();
    };

    wrap.appendChild(row);
  }
}

function sortedTrace(layerTrace) {
  const rank = new Map(LAYER_ORDER.map((key, idx) => [key, idx]));
  return [...layerTrace].sort((a, b) => {
    const ai = rank.has(a.stage_key) ? rank.get(a.stage_key) : 999;
    const bi = rank.has(b.stage_key) ? rank.get(b.stage_key) : 999;
    return ai - bi;
  });
}

function renderTimeline(layerTrace) {
  const wrap = qs("layerTimeline");
  wrap.innerHTML = "";
  if (!layerTrace.length) {
    wrap.innerHTML = '<div class="item"><div class="meta">No layer trace available yet.</div></div>';
    return;
  }

  const ordered = sortedTrace(layerTrace);
  for (const layer of ordered) {
    const item = document.createElement("div");
    item.className = "item layer-item";
    if (layer.stage_key === selectedLayerKey) item.classList.add("selected");
    const score = Number(layer.score || 0).toFixed(2);
    const pct = Math.max(0, Math.min(100, Number(layer.score || 0)));
    item.innerHTML = `
      <div class="layer-head">
        <strong>${escapeHtml(layer.stage_name || layer.stage_key)}</strong>
        <span class="badge ${layer.status === "completed" ? "ok" : "warn"}">${escapeHtml(layer.status || "unknown")}</span>
      </div>
      <div class="meta">Model: ${escapeHtml(layer.model || "NA")}</div>
      <div class="meta">Score: ${score} | Weight: ${Number(layer.weight || 0).toFixed(2)}</div>
      <div class="layer-progress"><span style="width:${pct}%"></span></div>
      <div class="meta">${escapeHtml(layer.summary || "")}</div>
    `;
    item.onclick = () => {
      selectedLayerKey = layer.stage_key;
      renderTimeline(cachedTrace);
      renderLayerDetail(layer);
    };
    wrap.appendChild(item);
  }

  if (!selectedLayerKey) {
    selectedLayerKey = ordered[0].stage_key;
  }
  const selected = ordered.find((l) => l.stage_key === selectedLayerKey) || ordered[0];
  renderLayerDetail(selected);
}

function renderLayerDetail(layer) {
  const panel = qs("layerDetail");
  panel.innerHTML = `
    <div class="headline">
      <div class="title">${escapeHtml(layer.stage_name || layer.stage_key)}</div>
      <span class="pill">${escapeHtml(layer.model || "NA")}</span>
    </div>

    <div class="meta-grid">
      <div class="m"><span class="k">Stage Key</span><span class="v">${escapeHtml(layer.stage_key || "NA")}</span></div>
      <div class="m"><span class="k">Status</span><span class="v">${escapeHtml(layer.status || "NA")}</span></div>
      <div class="m"><span class="k">Score</span><span class="v">${Number(layer.score || 0).toFixed(2)}</span></div>
      <div class="m"><span class="k">Weight</span><span class="v">${Number(layer.weight || 0).toFixed(2)}</span></div>
    </div>

    <div class="section">
      <div class="h">Stage Summary</div>
      <div>${escapeHtml(layer.summary || "No summary available")}</div>
    </div>

    <div class="section">
      <div class="h">Input Signals</div>
      <pre class="json-box">${pretty(layer.input_signals || {})}</pre>
    </div>

    <div class="section">
      <div class="h">Output</div>
      <pre class="json-box">${pretty(layer.output || {})}</pre>
    </div>
  `;
}

async function loadCases() {
  const data = await api(`/api/cases?sector=${encodeURIComponent(selectedSector)}`);
  const rows = data.data || [];
  if (!rows.length) {
    selectedCaseId = null;
    cachedTrace = [];
    renderCases(rows);
    renderTimeline([]);
    return;
  }
  const stillExists = rows.some((r) => r.case_id === selectedCaseId);
  if (!selectedCaseId || !stillExists) selectedCaseId = rows[0].case_id;
  renderCases(rows);
}

async function loadExplainability() {
  if (!selectedCaseId) return;
  const data = await api(`/api/explain/${encodeURIComponent(selectedCaseId)}`);
  const latest = data.latest_detection;
  cachedTrace = Array.isArray(latest?.layer_trace) ? latest.layer_trace : [];
  renderTimeline(cachedTrace);
}

async function runDetectionForSelected() {
  if (!selectedCaseId) return;
  const panel = qs("layerDetail");
  panel.textContent = "Generating detection and layer trace...";
  try {
    await api("/api/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: selectedCaseId }),
    });
    await loadCases();
    await loadExplainability();
  } catch (err) {
    panel.textContent = `Detection failed: ${err.message}`;
  }
}

async function boot() {
  qs("sector").onchange = async (event) => {
    selectedSector = event.target.value;
    selectedCaseId = null;
    selectedLayerKey = null;
    await loadCases();
    await loadExplainability();
  };

  qs("refreshCases").onclick = async () => {
    await loadCases();
    await loadExplainability();
  };

  qs("generateDetection").onclick = runDetectionForSelected;

  selectedSector = qs("sector").value || "insurance";
  await loadCases();
  await loadExplainability();
}

boot().catch((err) => {
  const panel = qs("layerDetail");
  panel.textContent = `Startup error: ${err.message}`;
});

