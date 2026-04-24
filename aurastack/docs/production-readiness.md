# AuraStack Production Readiness

This is the operational checklist to call AuraStack "production-ready".

## 1) Hard Gates (must pass)

1. `AUTH_REQUIRED=true` in production.
2. No default/shared secrets:
   - `JWT_SECRET` (>= 32 chars)
   - `INTERNAL_WORKER_TOKEN` (>= 24 chars)
   - `API_INBOUND_TOKEN` (>= 24 chars)
3. API and Agents health endpoints are reachable.
4. DB backups enabled and tested restore at least once.
5. RBAC enforced in backend routes (not UI-only).
6. Audit logs enabled and retained per compliance policy.
7. SMTP + IMAP credentials are app-password/service credentials (not personal password).
8. OpenAI key present with spend/rate limits configured.

## 2) Automated Preflight

Run before every release:

```bash
npm run prod:preflight
```

Strict gate mode (warnings fail build):

```bash
npm run prod:go-live
```

Optional custom targets:

```bash
node deploy/scripts/prod-preflight.mjs --strict --env-file deploy/vps/.env.vps --api-url https://api.yourdomain.com/health --agents-url https://agents.yourdomain.com/health
```

## 3) Go-Live Runbook

1. Deploy infrastructure (VPS/GCP).
2. Apply DB migrations.
3. Seed only required baseline data (no dev demo seed in prod).
4. Start API, Worker, Agents, Web.
5. Run `prod:go-live`.
6. Smoke tests:
   - Login
   - Inbound email -> case creation
   - OCR/extraction visible in case analysis
   - Outbound decision email visible in Inbox timeline
   - Workflow routing reason visible
7. Enable alerts:
   - API 5xx rate
   - queue lag
   - worker crash loops
   - IMAP poll failures
   - SMTP send failures
8. Capture release snapshot (git SHA + env checksum + migration version).

## 4) Current Priority Gaps to Close

1. Long-document OCR reliability (34+ page PDFs):
   - page-level chunking
   - extraction retries per chunk
   - fail-fast + recoverable partial outputs
2. Workflow routing explainability:
   - selected workflow
   - reason codes
   - confidence
3. Inbox parity:
   - incoming + automated outgoing in same thread
4. Resilience:
   - dead-letter queue
   - idempotency keys for inbound mail/webhooks
   - stuck-run reaper job
5. Security:
   - rotate all exposed/test credentials
   - enforce HTTPS-only cookies/session
   - domain-restricted user provisioning

## 5) Production Definition of Done

AuraStack can be called production-ready when all below are true:

1. Preflight passes in strict mode.
2. 7-day soak test with no Sev-1 incidents.
3. End-to-end email->OCR->workflow->decision->customer reply works with >98% successful pipeline completion on target volume.
4. Monitoring dashboards and on-call playbooks are active.
5. Recovery drill (DB restore + service restart) is validated.

