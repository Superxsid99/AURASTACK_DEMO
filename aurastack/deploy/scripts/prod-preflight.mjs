#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const args = process.argv.slice(2);
const strict = args.includes("--strict");

const envFileArgIndex = args.findIndex((a) => a === "--env-file");
const envFile =
  envFileArgIndex >= 0 && args[envFileArgIndex + 1]
    ? args[envFileArgIndex + 1]
    : ".env";

const apiUrlArgIndex = args.findIndex((a) => a === "--api-url");
const apiUrl =
  apiUrlArgIndex >= 0 && args[apiUrlArgIndex + 1]
    ? args[apiUrlArgIndex + 1]
    : "http://127.0.0.1:8000/health";

const agentsUrlArgIndex = args.findIndex((a) => a === "--agents-url");
const agentsUrl =
  agentsUrlArgIndex >= 0 && args[agentsUrlArgIndex + 1]
    ? args[agentsUrlArgIndex + 1]
    : "http://127.0.0.1:8001/health";

const readDotEnv = (filepath) => {
  const abs = path.isAbsolute(filepath) ? filepath : path.join(cwd, filepath);
  if (!fs.existsSync(abs)) return { abs, parsed: {} };
  const raw = fs.readFileSync(abs, "utf8");
  const parsed = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return { abs, parsed };
};

const mergedEnv = () => {
  const { abs, parsed } = readDotEnv(envFile);
  const merged = { ...parsed, ...process.env };
  return { envPath: abs, env: merged };
};

const { envPath, env } = mergedEnv();
const failures = [];
const warnings = [];
const passes = [];

const requireVar = (key) => {
  const val = env[key];
  if (!val || !String(val).trim()) {
    failures.push(`Missing required env: ${key}`);
    return "";
  }
  passes.push(`${key} present`);
  return String(val).trim();
};

const warnIf = (cond, msg) => {
  if (cond) warnings.push(msg);
};

const failIf = (cond, msg) => {
  if (cond) failures.push(msg);
};

const databaseUrl = requireVar("DATABASE_URL");
const redisUrl = requireVar("REDIS_URL");
const jwtSecret = requireVar("JWT_SECRET");
const workerToken = requireVar("INTERNAL_WORKER_TOKEN");
const authRequired = requireVar("AUTH_REQUIRED");
const openaiKey = requireVar("OPENAI_API_KEY");
const apiInboundToken = requireVar("API_INBOUND_TOKEN");

const smtpHost = requireVar("SMTP_HOST");
const smtpUser = requireVar("SMTP_USER");
const smtpPass = requireVar("SMTP_PASS");
const smtpFrom = requireVar("SMTP_FROM");
const imapHost = requireVar("IMAP_HOST");
const imapUser = requireVar("IMAP_USER");
const imapPass = requireVar("IMAP_PASS");

failIf(String(authRequired).toLowerCase() !== "true", "AUTH_REQUIRED must be true in production.");
failIf(jwtSecret.length < 32, "JWT_SECRET should be at least 32 characters.");
failIf(workerToken.length < 24, "INTERNAL_WORKER_TOKEN should be at least 24 characters.");
failIf(apiInboundToken.length < 24, "API_INBOUND_TOKEN should be at least 24 characters.");

const weakValues = new Set([
  "change-me",
  "change-me-in-production",
  "dev-worker-token",
  "dev-jwt-secret",
  "smart",
  "password",
  "12345678"
]);
for (const [k, v] of Object.entries({
  JWT_SECRET: jwtSecret,
  INTERNAL_WORKER_TOKEN: workerToken,
  API_INBOUND_TOKEN: apiInboundToken,
  SMTP_PASS: smtpPass,
  IMAP_PASS: imapPass
})) {
  if (weakValues.has(String(v).trim())) {
    failures.push(`${k} uses an insecure default value.`);
  }
}

warnIf(databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1"), "DATABASE_URL points to localhost. Use managed/private network DB for production.");
warnIf(redisUrl.includes("localhost") || redisUrl.includes("127.0.0.1"), "REDIS_URL points to localhost. Use managed/private Redis for production.");
warnIf(openaiKey.startsWith("sk-") === false, "OPENAI_API_KEY format looks unusual.");
warnIf(smtpHost.includes("gmail.com"), "SMTP_HOST uses Gmail. For production volume, use dedicated transactional provider.");
warnIf(imapHost.includes("gmail.com"), "IMAP_HOST uses Gmail. Ensure app-password and anti-rate-limit strategy are in place.");
warnIf(smtpUser.toLowerCase() !== imapUser.toLowerCase(), "SMTP_USER and IMAP_USER differ; ensure this is intentional.");
warnIf(smtpFrom.toLowerCase() !== smtpUser.toLowerCase(), "SMTP_FROM differs from SMTP_USER; verify SPF/DKIM alignment.");

const timeoutFetch = async (url, timeoutMs = 3500) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
};

const checkHealth = async () => {
  const api = await timeoutFetch(apiUrl);
  if (!api.ok) {
    failures.push(`API health check failed: ${apiUrl} (status=${api.status || "unreachable"})`);
  } else {
    passes.push(`API health check passed (${api.status})`);
  }

  const agents = await timeoutFetch(agentsUrl);
  if (!agents.ok) {
    warnings.push(`Agents health check failed: ${agentsUrl} (status=${agents.status || "unreachable"})`);
  } else {
    passes.push(`Agents health check passed (${agents.status})`);
  }
};

const run = async () => {
  await checkHealth();

  console.log(`\nAuraStack Production Preflight`);
  console.log(`Env source: ${envPath}`);
  console.log(`Strict mode: ${strict ? "ON" : "OFF"}`);

  if (passes.length) {
    console.log(`\nPASS (${passes.length})`);
    for (const p of passes) console.log(`  - ${p}`);
  }

  if (warnings.length) {
    console.log(`\nWARN (${warnings.length})`);
    for (const w of warnings) console.log(`  - ${w}`);
  }

  if (failures.length) {
    console.log(`\nFAIL (${failures.length})`);
    for (const f of failures) console.log(`  - ${f}`);
  }

  const shouldFail = failures.length > 0 || (strict && warnings.length > 0);
  if (shouldFail) {
    console.log(`\nPreflight result: NOT READY`);
    process.exit(1);
  }

  console.log(`\nPreflight result: READY`);
  process.exit(0);
};

run();

