const STAGES = [
  {
    key: "intake_normalize",
    name: "Intake & Normalize",
    description: "OCR + document normalization + field canonicalization",
  },
  {
    key: "entity_profiling",
    name: "Entity Profiling",
    description: "Customer/provider behavioral scoring and velocity checks",
  },
  {
    key: "graph_linkage",
    name: "Relational Graph",
    description: "Shared identifiers and suspicious network linkage analysis",
  },
  {
    key: "deviation_ml",
    name: "Deviation / ML",
    description: "Outlier probability from anomaly and distribution models",
  },
  {
    key: "rules_verdict",
    name: "Rules + Verdict",
    description: "Policy rule evaluation and final deterministic verdict",
  },
  {
    key: "explanation",
    name: "Explanation Layer",
    description: "Human-readable rationale for audit and investigations",
  },
];

const MODEL_OPTIONS = [
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-4.1-mini",
  "xgboost-claim-risk-v2",
  "lightgbm-fraud-v5",
  "graphsage-link-v1",
  "gmm-ewma-hybrid",
  "iforest-anomaly-v3",
  "rule-engine-v3",
  "hybrid-rule-ml-v2",
  "__custom__",
];

const qs = (id) => document.getElementById(id);
let currentConfig = {};

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

function renderModelRows() {
  const wrap = qs("modelTable");
  wrap.innerHTML = "";
  for (const stage of STAGES) {
    const current = currentConfig[stage.key] || "";
    const hasKnownOption = MODEL_OPTIONS.includes(current);
    const selected = hasKnownOption ? current : "__custom__";

    const row = document.createElement("div");
    row.className = "model-card";
    row.innerHTML = `
      <div class="stage">${escapeHtml(stage.name)}</div>
      <div class="desc">${escapeHtml(stage.description)}</div>
      <div class="model-row">
        <label class="model-label">Model</label>
        <select data-role="select" data-key="${stage.key}">
          ${MODEL_OPTIONS.map((model) => {
            const label = model === "__custom__" ? "Custom model..." : model;
            return `<option value="${escapeHtml(model)}" ${selected === model ? "selected" : ""}>${escapeHtml(label)}</option>`;
          }).join("")}
        </select>
      </div>
      <div class="model-row">
        <label class="model-label">Custom (optional)</label>
        <input data-role="custom" data-key="${stage.key}" type="text" placeholder="e.g. my-org/fraud-deviation-v9" value="${escapeHtml(hasKnownOption ? "" : current)}" />
      </div>
    `;
    wrap.appendChild(row);
  }

  for (const select of wrap.querySelectorAll('select[data-role="select"]')) {
    select.addEventListener("change", (event) => {
      const key = event.target.getAttribute("data-key");
      const value = event.target.value;
      const customInput = wrap.querySelector(`input[data-role="custom"][data-key="${key}"]`);
      if (value !== "__custom__") {
        customInput.value = "";
        currentConfig[key] = value;
      }
    });
  }

  for (const input of wrap.querySelectorAll('input[data-role="custom"]')) {
    input.addEventListener("input", (event) => {
      const key = event.target.getAttribute("data-key");
      const custom = event.target.value.trim();
      const select = wrap.querySelector(`select[data-role="select"][data-key="${key}"]`);
      if (custom) {
        select.value = "__custom__";
        currentConfig[key] = custom;
      } else if (select.value !== "__custom__") {
        currentConfig[key] = select.value;
      } else {
        currentConfig[key] = "";
      }
    });
  }
}

function collectPayload() {
  const wrap = qs("modelTable");
  const configs = {};
  for (const stage of STAGES) {
    const select = wrap.querySelector(`select[data-role="select"][data-key="${stage.key}"]`);
    const custom = wrap
      .querySelector(`input[data-role="custom"][data-key="${stage.key}"]`)
      .value.trim();
    if (custom) {
      configs[stage.key] = custom;
    } else if (select && select.value && select.value !== "__custom__") {
      configs[stage.key] = select.value;
    } else if (currentConfig[stage.key]) {
      configs[stage.key] = currentConfig[stage.key];
    }
  }
  return configs;
}

async function loadConfigs() {
  const data = await api("/api/model-configs");
  currentConfig = data.data || {};
  renderModelRows();
}

async function saveConfigs() {
  const status = qs("saveStatus");
  status.textContent = "Saving model config...";
  status.classList.remove("warn");

  try {
    const payload = collectPayload();
    const out = await api("/api/model-configs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configs: payload }),
    });
    currentConfig = out.data || payload;
    renderModelRows();
    status.textContent = `Saved at ${new Date().toLocaleTimeString()} - New detections will use this mapping.`;
  } catch (err) {
    status.classList.add("warn");
    status.textContent = `Save failed: ${err.message}`;
  }
}

async function boot() {
  qs("saveConfig").onclick = saveConfigs;
  await loadConfigs();
}

boot().catch((err) => {
  qs("saveStatus").textContent = `Startup error: ${err.message}`;
  qs("saveStatus").classList.add("warn");
});

