# AuraStack Insurance Product Implementation Matrix

Sources used:
- `HDFC_Life_AI_Usecases_v2.docx.pdf` (insurance operating model + India-specific constraints)
- `Agentic AI in Insurance_ 30 Use Cases with Real-World Context.pdf` (30-agent reference blueprint)

## 1) Product North Star

Build one production system where every insurance workflow can run through the same control plane:
- Entry: email, webhook, API, operator queue
- Orchestration: stages, assigned agents, SLA, handoff/escalation
- Decisioning: AI recommendation + human override for regulated steps
- Action: CRM/core-policy/core-claims updates + customer communication
- Audit: immutable timeline, rationale, document lineage, regulatory exports

## 2) Canonical Object Model (must stay consistent)

- `Domain` -> `Workflow` -> `Stage` -> `AgentAssignment`
- `Trigger` (mailbox/webhook/schedule/manual)
- `Case` (customer work item with status, SLA, owner)
- `InboxConfig` (domain + workflow scoped receiving identity)
- `DecisionRecord` (input facts, recommendation, approver, final action)
- `CommunicationLog` (inbound/outbound email/WhatsApp/SMS/call)
- `AuditEvent` (who/what/when/why)

## 3) Platform Capabilities Required Across All Workflows

1. Multi-inbox routing:
- many inboxes per domain and per workflow
- routing priority: `workflow+domain` > `workflow` > `domain` > default

2. AI execution policy:
- auto-approve only for low-risk thresholds
- mandatory human-in-loop for high-value, fraud-flagged, or compliance-sensitive cases

3. Explainability:
- each AI decision must store evidence + confidence + rules used

4. Operational safety:
- dead-letter queue for failed actions
- replay for failed steps
- SLA breach detector with escalation routing

5. Analytics:
- before vs after baseline, TAT, STP, exception, cost per case, leakage/fraud savings

## 4) P0 Build Matrix (complete first, production-critical)

| Use Case | Domain | AuraStack Workflow | Key Stages | Triggers | Human Gate | Core KPI |
|---|---|---|---|---|---|---|
| FNOL Agent | Motor/Health/P&C | `Claims Intake & FNOL` | Intake -> Policy check -> Case create -> Assignment -> Comms | Email, WhatsApp webhook, call transcript | Required when policy mismatch | FNOL completion time |
| Claims Document Processor | Cross + Claims | `Claims Document Pipeline` | Classify -> Extract -> Validate -> Missing-doc loop -> Case update | Email attachments, portal upload | Low-confidence extraction | Extraction accuracy, STP |
| Claims Communication Agent | All insurance | `Claims Status Comms` | Intent detect -> Context fetch -> Compose -> Send -> Log | Email/WhatsApp inbound + status events | For adverse/denial responses | Query deflection rate |
| Coverage Validation Agent | All insurance | `Coverage Determination` | Clause retrieval -> Fact match -> Determination -> Explainability pack | Case event | Required before denial | Coverage decision TAT |
| Fraud Detection Agent | All insurance | `Fraud & SIU` | Signal aggregation -> Risk score -> Triage -> SIU assignment | Claim creation + doc ingestion | SIU escalation approval | Fraud hit rate, false positive |
| Claims Decision Co-Pilot | Claims | `Claims Decision Assist` | Case summary -> Precedent retrieval -> Recommendation -> Adjuster action | Ready-for-decision event | Mandatory adjuster confirmation | Decision cycle time |
| Claims Settlement Agent | Claims | `Settlement Automation` | Payout validation -> Approval -> Payment instruction -> Notification | Approved claim event | For payouts above threshold | Settlement TAT |
| Submission Intake Agent | Underwriting | `Submission Intake` | Intake -> Completeness -> Data normalization -> Queue/routing | Email/webhook | Incomplete submissions | Intake-to-ready time |
| Risk Profiling Agent | Underwriting | `Risk Profiling` | Data aggregation -> Model score -> Risk band -> Referral | Submission ready event | High-risk referral | Referral rate, score stability |
| Underwriting Decision Assistant | Underwriting | `UW Decision Assist` | Rule check -> Similar-case retrieval -> Recommendation -> UW final decision | Risk profile event | Mandatory UW sign-off | UW decision TAT |
| Email Workflow Agent | Operations | `Email Automation Core` | Ingest -> Classify -> Route -> Act -> Reply -> Audit | Mailbox polling/IMAP/webhook | On uncertain intent | Auto-resolution rate |
| Multi-System Orchestrator | Cross | `Orchestration Control Plane` | Dispatch -> Step state -> Retry -> Escalate -> Close | Any workflow trigger | For failed integration retries | End-to-end success rate |

## 5) P1 Expansion Matrix

| Use Case Group | Workflows to Add/Upgrade | Why |
|---|---|---|
| Sales/Distribution | AI Sales Agent, Lead Qualification, Quote Follow-Up, Broker Co-Pilot, Cross-sell/Upsell | Revenue growth + conversion lift |
| Servicing | Policy Explainer, Benefits Advisor, Renewal Reminder, CRM Data Entry | Deflection + retention + service quality |
| Operations | SOP Execution, Compliance & Audit, Document Generation, Vendor Coordination | Cost-out + governance + turnaround |
| Recovery | Subrogation and recovery extensions in motor/P&C | Direct financial recovery impact |

## 6) Workflow Configuration Standard (for every workflow)

- Metadata: name, domain, owner department, default agent
- Stage config: stage SLA, success condition, escalation condition
- Agent config: primary + backup + confidence threshold
- Trigger config: mailbox/webhook/schedule/manual + payload schema
- Decision config: auto-approve limits + mandatory approver roles
- Communication config: templates for ack/update/approval/reject/escalate
- Audit config: event taxonomy + export format (regulatory-ready)

## 7) Email Automation Product Spec (what you requested)

1. Admin must support unlimited inboxes with:
- domain binding
- workflow binding
- optional claim-type key
- active flag + auto-reply flag

2. Runtime behavior:
- poll inbox -> parse thread -> classify intent
- map to workflow using routing table
- create/update case
- run workflow stages
- reply customer with status/action request
- escalate to human when confidence/rules require

3. Mandatory safeguards:
- duplicate email/thread deduplication
- PII masking in logs
- action approval for financial/regulatory outcomes
- full thread + attachment retention for audit

## 8) AI Assistant Product Spec (operator copilot)

Assistant must support:
- workflow discovery by domain
- "create workflow called <name>" in current domain
- explain stage/agent logic and SLA risks
- runbook Q&A from live configuration
- case lookup, timeline explain, and escalation suggestion

Guardrails:
- no direct destructive actions without confirmation
- all assistant actions logged as `assistant.*` audit events
- role-aware capabilities (RBAC-ready)

## 9) Definition of Done for "Complete Product" Milestone

1. P0 workflows are live with real triggers and case lifecycle.
2. Email automation works per domain/per workflow with customer replies.
3. Assistant can create, explain, and operate workflows with audit logs.
4. Human override and approval gates work for regulated decisions.
5. Analytics dashboard shows baseline vs current (TAT, STP, exceptions, cost).
6. UAT passes with at least one real scenario in each insurance line.
7. Production readiness: retries, alerting, backup, audit export, access controls.

## 10) Suggested Delivery Sequence (practical)

- Week 1-2: harden email ingestion + routing + case linkage
- Week 2-3: finalize P0 claims and underwriting workflows
- Week 3-4: add assistant actions (create/explain/run) + audit trail
- Week 4-5: add compliance/export/reporting + operational dashboards
- Week 5-6: pilot with one health and one motor use case end-to-end

