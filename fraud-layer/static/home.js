const qs = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json();
}

function animateNumber(el, target) {
  if (!el) return;
  const start = performance.now();
  const from = 0;
  const duration = 650;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = String(Math.round(from + (target - from) * eased));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function boot() {
  const [insRules, bnkRules, insCases, bnkCases] = await Promise.all([
    api("/api/rules?sector=insurance"),
    api("/api/rules?sector=banking"),
    api("/api/cases?sector=insurance"),
    api("/api/cases?sector=banking"),
  ]);
  const ruleCount = insRules.rules.length + bnkRules.rules.length;
  const caseCount = (insCases.data || []).length + (bnkCases.data || []).length;
  animateNumber(qs("homeRules"), ruleCount);
  animateNumber(qs("homeCases"), caseCount);
}

boot().catch((err) => {
  const el = qs("homeCases");
  if (el) el.textContent = "ERR";
  console.error(err);
});
