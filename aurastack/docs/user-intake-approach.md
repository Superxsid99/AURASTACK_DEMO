# User Intake Platform Approach (AuraStack)

## 1) Objective
Build a clean intake front-door where customers can submit:
- New claim
- Claim status inquiry
- Sales/policy request
- Document upload

And route each submission into the correct workflow with full traceability.

## 2) Product Scope (Phase-Wise)

### Phase 1: Reliable Intake Capture
- Public-facing intake form (web + mobile responsive)
- Required fields: name, email, phone, policy number (if available), request type, message
- Multi-file upload (pdf/jpg/png)
- Case creation with unique case ID
- Timeline event: `INTAKE_RECEIVED`

### Phase 2: Smart Routing
- Intent classification (LLM + rules)
- Domain detection (Health / Motor / Property / Banking)
- Workflow selection + confidence score
- Fallback queue to `manual_triage` when confidence below threshold
- Timeline event: `WORKFLOW_SELECTED`

### Phase 3: AI Processing
- OCR / vision extraction from uploads
- Document splitting for large files (labs, invoices, discharge, prescriptions)
- Validation agent for mandatory docs checklist
- Decision/review recommendation
- Timeline events for each stage (`OCR_COMPLETED`, `VALIDATION_COMPLETED`, etc.)

### Phase 4: Communication Loop
- Auto-ack email to customer
- Outgoing status updates at key stages
- Show both IN and OUT messages in Inbox thread
- SLA tracker + escalation if no action in configured time

### Phase 5: Governance + Scale
- RBAC by team (Ops, Adjuster, Compliance, Admin)
- Audit logs for every agent and user action
- Metrics dashboard: intake volume, conversion, TAT, doc completion, escalations

## 3) Intake Data Contract (Minimum)

### Request payload
- `requestType`: claim | status_inquiry | policy_purchase | document_upload | other
- `domainHint`: health | motor | property | banking | unknown
- `customer`: name, email, phone
- `policyNumber`
- `message`
- `attachments[]`

### System metadata
- `sourceChannel`: portal | email | api | chat
- `receivedAt`
- `routingConfidence`
- `selectedWorkflowKey`
- `selectedWorkflowReason`

## 4) Routing Strategy (Recommended)
Use hybrid routing:
1. Hard rules first
   - If sender mailbox mapped to domain/workflow, apply mapping.
   - If subject contains known claim keywords + policy number pattern, prioritize claims workflows.
2. LLM classification second
   - Predict intent, domain, urgency, probable workflow.
3. Confidence gate
   - >= 0.80: auto-route
   - 0.55 - 0.79: route + flag for reviewer
   - < 0.55: manual triage queue

## 5) Demo-Ready Success Criteria
- Form submit creates case in < 2 seconds
- Uploaded docs visible in case documents tab
- Selected workflow visible in Inbox and Case metadata
- Outgoing acknowledgement visible in thread
- AI analysis shows extracted fields and decision rationale

## 6) Build Sequence (Practical)
1. Build standalone intake UI
2. POST intake to API (`/portal/intake`)
3. Save case + uploads + intake event
4. Add workflow selection service (`/routing/resolve`)
5. Trigger orchestration run
6. Add outgoing email updates and timeline markers
7. Add dashboards + SLA monitor

## 7) Risks to Avoid
- Routing without confidence thresholds
- OCR-only extraction for complex medical PDFs (always keep vision model fallback)
- Missing outbound communication logs
- No manual override path for low-confidence cases

