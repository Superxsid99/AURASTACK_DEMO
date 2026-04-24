import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

type SeedPolicyholder = {
  policy_number: string;
  member_name: string;
  payer_name?: string | null;
  city?: string | null;
  state?: string | null;
};

async function loadPolicyholderCasesFromJson(limit = 250) {
  const candidatePaths = [
    path.resolve(process.cwd(), "data", "policyholders_with_policy_number.json"),
    path.resolve(process.cwd(), "..", "..", "data", "policyholders_with_policy_number.json")
  ];

  let raw = "";
  for (const filePath of candidatePaths) {
    try {
      raw = await readFile(filePath, "utf8");
      break;
    } catch {
      // try next candidate path
    }
  }

  if (!raw) {
    return [];
  }

  let parsed: SeedPolicyholder[] = [];
  try {
    parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as SeedPolicyholder[];
  } catch {
    return [];
  }

  return parsed
    .filter((item) => item.policy_number && item.member_name)
    .slice(0, limit)
    .map((item, index) => ({
      id: `CAS-POL-${String(index + 1).padStart(6, "0")}`,
      caseType: "Policy Servicing",
      workflowStage: "Policy Lookup",
      assignedUserName: index % 2 === 0 ? "Vikram Singh" : "Aisha Khan",
      aiStatus: "processing",
      priority: index % 5 === 0 ? "high" : "medium",
      memberName: item.member_name,
      status: index % 7 === 0 ? "review" : "in_progress",
      documentsTotal: 2,
      documentsComplete: 1,
      policyNumber: item.policy_number,
      customerEmail: `${item.member_name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/(^\\.|\\.$)/g, "") || "member"}@example.com`,
      claimClassification: "policy_query",
      createdAt: new Date(Date.now() - index * 15 * 60 * 1000),
      updatedAt: new Date(Date.now() - index * 10 * 60 * 1000)
    }));
}

async function main(): Promise<void> {
  await prisma.workflowExecutionStep.deleteMany();
  await prisma.workflowExecution.deleteMany();
  await prisma.workflowStep.deleteMany();
  await prisma.workflow.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.event.deleteMany();
  await prisma.agentRun.deleteMany();
  await prisma.intakeJob.deleteMany();
  await prisma.reviewTask.deleteMany();
  await prisma.document.deleteMany();
  await prisma.agentDefinition.deleteMany();
  await prisma.caseRecord.deleteMany();
  await prisma.user.deleteMany();

  const now = new Date();
  const hoursAgo = (value: number) => new Date(now.getTime() - value * 60 * 60 * 1000);
  const daysAgo = (value: number) => new Date(now.getTime() - value * 24 * 60 * 60 * 1000);

  const users = [
    { id: "usr_admin_anjali", name: "Anjali Mehta", email: "anjali.mehta@claritymvp.com", role: "admin" },
    { id: "usr_reviewer_priya", name: "Priya Nair", email: "priya.nair@claritymvp.com", role: "reviewer" },
    { id: "usr_reviewer_rahul", name: "Rahul Verma", email: "rahul.verma@claritymvp.com", role: "reviewer" },
    { id: "usr_operator_vikram", name: "Vikram Singh", email: "vikram.singh@claritymvp.com", role: "operator" },
    { id: "usr_operator_aisha", name: "Aisha Khan", email: "aisha.khan@claritymvp.com", role: "operator" },
    { id: "usr_compliance_neha", name: "Neha Iyer", email: "neha.iyer@claritymvp.com", role: "admin" }
  ];
  await prisma.user.createMany({ data: users });

  const agents = [
    {
      id: "agt_claim_intake",
      name: "Bharat Claim Intake Agent",
      agentType: "orchestrator",
      status: "running",
      role: "Intake Orchestrator",
      description: "Parses claim emails and routes cases to the right workflow.",
      instructions: "Process new inbound claims from Indian hospitals and TPAs.",
      provider: "Google",
      model: "Gemini 2.0 Flash",
      department: "Claims",
      policyRules: [
        "Always capture policy number and member name.",
        "Flag if hospitalization dates are missing."
      ],
      tools: [
        { name: "Email Connector", description: "Reads inbound claim emails", enabled: true },
        { name: "Case Router", description: "Routes to workflow by case type", enabled: true }
      ],
      integrations: ["IMAP", "Webhook API", "PostgreSQL"],
      flowConfig: { type: "graph", defaultFlow: "cashless-preauth-india" },
      metadata: { region: "India", languageSupport: ["en", "hi"] }
    },
    {
      id: "agt_doc_ocr",
      name: "Nidhi Document OCR Agent",
      agentType: "document_processing",
      status: "running",
      role: "OCR and Extraction",
      description: "Extracts fields from discharge summaries, bills, and KYC docs.",
      instructions: "Use OCR for scanned PDFs and extract diagnosis/procedure details.",
      provider: "OpenAI",
      model: "gpt-4o-mini",
      department: "Claims",
      policyRules: [
        "Use OCR for scanned uploads.",
        "Capture ICD and procedure summary if available."
      ],
      tools: [
        { name: "PDF OCR", description: "Reads scanned claim documents", enabled: true },
        { name: "Field Extractor", description: "Extracts claim and policy fields", enabled: true }
      ],
      integrations: ["S3", "Tesseract", "pypdf"],
      flowConfig: { type: "linear", steps: ["DOCUMENT_OCR", "DATA_EXTRACTION"] },
      metadata: { region: "India" }
    },
    {
      id: "agt_validation",
      name: "Kavach Validation Agent",
      agentType: "validation",
      status: "running",
      role: "Coverage Validation",
      description: "Validates member eligibility, policy limits, and exclusions.",
      instructions: "Validate cashless and reimbursement claims using policy rules.",
      provider: "OpenAI",
      model: "gpt-4o-mini",
      department: "Claims",
      policyRules: [
        "Check waiting period before approval.",
        "Check sum insured balance."
      ],
      tools: [
        { name: "Eligibility Checker", description: "Member and policy checks", enabled: true },
        { name: "Limit Engine", description: "Validates plan caps and co-pay", enabled: true }
      ],
      integrations: ["Policy API", "Member DB"],
      flowConfig: { type: "linear", steps: ["VALIDATION", "DECISION"] },
      metadata: { regulatory: "IRDAI" }
    },
    {
      id: "agt_decision",
      name: "IRDAI Policy Guard Agent",
      agentType: "decision_engine",
      status: "idle",
      role: "Decision Engine",
      description: "Makes APPROVED / REVIEW_REQUIRED / REJECTED recommendations.",
      instructions: "Return deterministic decision when LLM unavailable.",
      provider: "OpenAI",
      model: "gpt-4o-mini",
      department: "Compliance",
      policyRules: [
        "Escalate high-value cases over INR 5 lakhs.",
        "Require review when confidence < 0.8."
      ],
      tools: [
        { name: "Decision Router", description: "Routes by decision output", enabled: true }
      ],
      integrations: ["Rules Engine"],
      flowConfig: { type: "decision", labels: ["APPROVED", "REVIEW_REQUIRED", "REJECTED"] },
      metadata: { region: "India", currency: "INR" }
    },
    {
      id: "agt_fraud",
      name: "FraudShield SIU Agent",
      agentType: "monitoring",
      status: "running",
      role: "Fraud Monitoring",
      description: "Detects suspicious billing patterns and routes to SIU.",
      instructions: "Flag suspicious provider/member patterns.",
      provider: "Google",
      model: "Gemini 2.0 Flash",
      department: "Fraud & SIU",
      policyRules: [
        "Escalate repeated same-day procedure claims.",
        "Flag provider anomaly score over threshold."
      ],
      tools: [
        { name: "Anomaly Detector", description: "Detects fraud patterns", enabled: true }
      ],
      integrations: ["SIU Portal", "Claims Data Lake"],
      flowConfig: { type: "linear", steps: ["KNOWLEDGE_CHECK", "DECISION"] },
      metadata: { region: "India" }
    },
    {
      id: "agt_customer_comms",
      name: "Seva Customer Communication Agent",
      agentType: "communication",
      status: "running",
      role: "Policyholder Communication",
      description: "Sends approval, clarification, and rejection updates to members.",
      instructions: "Send clear messages in English/Hindi mix where configured.",
      provider: "OpenAI",
      model: "gpt-4o-mini",
      department: "Member Services",
      policyRules: [
        "Use compliant templates for rejection communications."
      ],
      tools: [
        { name: "Email Sender", description: "Sends customer notification emails", enabled: true }
      ],
      integrations: ["SMTP", "SMS Gateway"],
      flowConfig: { type: "linear", steps: ["EMAIL_REPLY"] },
      metadata: { region: "India", channel: ["email", "sms"] }
    }
  ];
  await prisma.agentDefinition.createMany({
    data: agents.map((agent) => ({
      ...agent,
      policyRules: agent.policyRules as any,
      tools: agent.tools as any,
      integrations: agent.integrations as any,
      flowConfig: agent.flowConfig as any,
      metadata: agent.metadata as any
    }))
  });

  const workflows = [
    {
      id: "wf_cashless_preauth",
      key: "cashless-preauth-india",
      name: "Cashless Pre-Authorization (India)",
      description: "Hospital pre-auth intake, validation, decision, and customer communication.",
      status: "active",
      version: 1
    },
    {
      id: "wf_reimbursement_claim",
      key: "reimbursement-claims-india",
      name: "Reimbursement Claim Processing (India)",
      description: "Invoice verification, OCR extraction, and settlement decision.",
      status: "active",
      version: 1
    },
    {
      id: "wf_fraud_watch",
      key: "fraud-watch-siu-india",
      name: "Fraud Watch & SIU Escalation",
      description: "Fraud risk screening and SIU escalation workflow.",
      status: "active",
      version: 1
    },
    {
      id: "wf_maternity_audit",
      key: "maternity-claims-audit",
      name: "Maternity Claims Audit",
      description: "Draft workflow for maternity claim policy checks.",
      status: "draft",
      version: 1
    },
    {
      id: "wf_senior_care_paused",
      key: "senior-care-review-paused",
      name: "Senior Citizen Chronic Care Review",
      description: "Paused workflow for chronic care claim handling.",
      status: "paused",
      version: 2
    }
  ];
  await prisma.workflow.createMany({ data: workflows });

  const workflowSteps = [
    {
      id: "wfstep_cp_1", workflowId: "wf_cashless_preauth", name: "Pre-auth Email Intake", stepType: "EMAIL_INTAKE", stepOrder: 1,
      nextStepId: "wfstep_cp_2",
      config: {
        mailbox: "preauth@claritymvp.com",
        uiMeta: {
          department: "Claims",
          agentId: "agt_claim_intake",
          triggers: [
            { type: "mailbox", config: "preauth@claritymvp.com" },
            { type: "webhook", config: "https://api.claritymvp.com/webhooks/preauth" }
          ]
        }
      }
    },
    { id: "wfstep_cp_2", workflowId: "wf_cashless_preauth", name: "Document OCR", stepType: "DOCUMENT_OCR", stepOrder: 2, nextStepId: "wfstep_cp_3", config: {} },
    { id: "wfstep_cp_3", workflowId: "wf_cashless_preauth", name: "Coverage Validation", stepType: "VALIDATION", stepOrder: 3, nextStepId: "wfstep_cp_4", config: { minConfidence: 0.8 } },
    { id: "wfstep_cp_4", workflowId: "wf_cashless_preauth", name: "Decision", stepType: "DECISION", stepOrder: 4, nextStepId: null, config: { routes: { APPROVED: "wfstep_cp_5", REVIEW_REQUIRED: "wfstep_cp_6", REJECTED: "wfstep_cp_7" } } },
    { id: "wfstep_cp_5", workflowId: "wf_cashless_preauth", name: "Approval", stepType: "APPROVAL", stepOrder: 5, nextStepId: "wfstep_cp_8", config: {} },
    { id: "wfstep_cp_6", workflowId: "wf_cashless_preauth", name: "Human Review", stepType: "HUMAN_REVIEW", stepOrder: 6, nextStepId: null, config: {} },
    { id: "wfstep_cp_7", workflowId: "wf_cashless_preauth", name: "Rejection", stepType: "REJECTION", stepOrder: 7, nextStepId: "wfstep_cp_8", config: {} },
    { id: "wfstep_cp_8", workflowId: "wf_cashless_preauth", name: "Customer Notification", stepType: "EMAIL_REPLY", stepOrder: 8, nextStepId: null, config: { template: "decision-template-v1" } },

    {
      id: "wfstep_rb_1", workflowId: "wf_reimbursement_claim", name: "Claim Intake", stepType: "EMAIL_INTAKE", stepOrder: 1,
      nextStepId: "wfstep_rb_2",
      config: {
        uiMeta: {
          department: "Claims",
          agentId: "agt_claim_intake",
          triggers: [
            { type: "mailbox", config: "reimbursement@claritymvp.com" }
          ]
        }
      }
    },
    { id: "wfstep_rb_2", workflowId: "wf_reimbursement_claim", name: "Data Extraction", stepType: "DATA_EXTRACTION", stepOrder: 2, nextStepId: "wfstep_rb_3", config: {} },
    { id: "wfstep_rb_3", workflowId: "wf_reimbursement_claim", name: "Validation", stepType: "VALIDATION", stepOrder: 3, nextStepId: "wfstep_rb_4", config: {} },
    { id: "wfstep_rb_4", workflowId: "wf_reimbursement_claim", name: "Decision", stepType: "DECISION", stepOrder: 4, nextStepId: null, config: { routes: { APPROVED: "wfstep_rb_5", REVIEW_REQUIRED: "wfstep_rb_6", REJECTED: "wfstep_rb_7" } } },
    { id: "wfstep_rb_5", workflowId: "wf_reimbursement_claim", name: "Approval", stepType: "APPROVAL", stepOrder: 5, nextStepId: null, config: {} },
    { id: "wfstep_rb_6", workflowId: "wf_reimbursement_claim", name: "Human Review", stepType: "HUMAN_REVIEW", stepOrder: 6, nextStepId: null, config: {} },
    { id: "wfstep_rb_7", workflowId: "wf_reimbursement_claim", name: "Rejection", stepType: "REJECTION", stepOrder: 7, nextStepId: null, config: {} },

    {
      id: "wfstep_fw_1", workflowId: "wf_fraud_watch", name: "Fraud Risk Intake", stepType: "EMAIL_INTAKE", stepOrder: 1,
      nextStepId: "wfstep_fw_2",
      config: {
        uiMeta: {
          department: "Fraud & SIU",
          agentId: "agt_fraud",
          triggers: [
            { type: "schedule", config: "Every 30 minutes" },
            { type: "webhook", config: "https://api.claritymvp.com/webhooks/fraud" }
          ]
        }
      }
    },
    { id: "wfstep_fw_2", workflowId: "wf_fraud_watch", name: "Knowledge Risk Check", stepType: "KNOWLEDGE_CHECK", stepOrder: 2, nextStepId: "wfstep_fw_3", config: {} },
    { id: "wfstep_fw_3", workflowId: "wf_fraud_watch", name: "Decision", stepType: "DECISION", stepOrder: 3, nextStepId: null, config: { routes: { APPROVED: "wfstep_fw_4", REVIEW_REQUIRED: "wfstep_fw_5", REJECTED: "wfstep_fw_6" } } },
    { id: "wfstep_fw_4", workflowId: "wf_fraud_watch", name: "Approval", stepType: "APPROVAL", stepOrder: 4, nextStepId: null, config: {} },
    { id: "wfstep_fw_5", workflowId: "wf_fraud_watch", name: "Human Review", stepType: "HUMAN_REVIEW", stepOrder: 5, nextStepId: null, config: {} },
    { id: "wfstep_fw_6", workflowId: "wf_fraud_watch", name: "Rejection", stepType: "REJECTION", stepOrder: 6, nextStepId: null, config: {} },

    {
      id: "wfstep_mt_1", workflowId: "wf_maternity_audit", name: "Maternity Intake", stepType: "EMAIL_INTAKE", stepOrder: 1,
      nextStepId: "wfstep_mt_2",
      config: {
        uiMeta: {
          department: "Compliance",
          agentId: "agt_decision",
          triggers: [{ type: "manual", config: "Compliance officer initiated" }]
        }
      }
    },
    { id: "wfstep_mt_2", workflowId: "wf_maternity_audit", name: "Validation", stepType: "VALIDATION", stepOrder: 2, nextStepId: null, config: {} },

    {
      id: "wfstep_sc_1", workflowId: "wf_senior_care_paused", name: "Senior Care Intake", stepType: "EMAIL_INTAKE", stepOrder: 1,
      nextStepId: "wfstep_sc_2",
      config: {
        uiMeta: {
          department: "Claims",
          agentId: "agt_validation",
          triggers: [{ type: "manual", config: "Ops batch upload" }]
        }
      }
    },
    { id: "wfstep_sc_2", workflowId: "wf_senior_care_paused", name: "Validation", stepType: "VALIDATION", stepOrder: 2, nextStepId: null, config: {} }
  ];
  await prisma.workflowStep.createMany({
    data: workflowSteps.map((step) => ({
      ...step,
      config: (step.config ?? {}) as any
    }))
  });

  const caseRecords = [
    { id: "CAS-IN-2026-0001", caseType: "Cashless Pre-Authorization", workflowStage: "Coverage Validation", assignedUserName: "Vikram Singh", aiStatus: "processing", priority: "high", memberName: "Rohit Sharma", status: "in_progress", documentsTotal: 4, documentsComplete: 3, createdAt: daysAgo(1) },
    { id: "CAS-IN-2026-0002", caseType: "Cashless Pre-Authorization", workflowStage: "Human Review", assignedUserName: "Priya Nair", aiStatus: "needs_review", priority: "critical", memberName: "Pooja Reddy", status: "review", documentsTotal: 5, documentsComplete: 4, createdAt: daysAgo(2) },
    { id: "CAS-IN-2026-0003", caseType: "Reimbursement Claim", workflowStage: "Completed", assignedUserName: "Aisha Khan", aiStatus: "complete", priority: "medium", memberName: "Suresh Kumar", status: "completed", documentsTotal: 6, documentsComplete: 6, createdAt: daysAgo(3) },
    { id: "CAS-IN-2026-0004", caseType: "Fraud Risk Screening", workflowStage: "SIU Escalation", assignedUserName: "Rahul Verma", aiStatus: "error", priority: "critical", memberName: "Meena Gupta", status: "escalated", documentsTotal: 3, documentsComplete: 2, createdAt: daysAgo(1) },
    { id: "CAS-IN-2026-0005", caseType: "Reimbursement Claim", workflowStage: "Decision", assignedUserName: null, aiStatus: "processing", priority: "high", memberName: "Arjun Patel", status: "new", documentsTotal: 4, documentsComplete: 2, createdAt: hoursAgo(10) },
    { id: "CAS-IN-2026-0006", caseType: "Daycare Procedure Claim", workflowStage: "Completed", assignedUserName: "Aisha Khan", aiStatus: "complete", priority: "low", memberName: "Sneha Deshmukh", status: "completed", documentsTotal: 3, documentsComplete: 3, createdAt: daysAgo(5) },
    { id: "CAS-IN-2026-0007", caseType: "Maternity Claim", workflowStage: "Draft Audit", assignedUserName: "Neha Iyer", aiStatus: "processing", priority: "medium", memberName: "Kavita Joshi", status: "in_progress", documentsTotal: 5, documentsComplete: 1, createdAt: daysAgo(4) },
    { id: "CAS-IN-2026-0008", caseType: "Senior Citizen Chronic Care", workflowStage: "Paused Queue", assignedUserName: null, aiStatus: "needs_review", priority: "high", memberName: "Ramesh Bhat", status: "review", documentsTotal: 4, documentsComplete: 2, createdAt: daysAgo(6) },
    { id: "CAS-IN-2026-0009", caseType: "Critical Illness Rider", workflowStage: "Validation Failed", assignedUserName: "Vikram Singh", aiStatus: "error", priority: "high", memberName: "Anita Menon", status: "escalated", documentsTotal: 4, documentsComplete: 1, createdAt: daysAgo(2) },
    { id: "CAS-IN-2026-0010", caseType: "Reimbursement Claim", workflowStage: "Awaiting Documents", assignedUserName: "Priya Nair", aiStatus: "needs_review", priority: "medium", memberName: "Deepak Yadav", status: "review", documentsTotal: 5, documentsComplete: 3, createdAt: hoursAgo(36) }
  ];
  const policyholderCases = await loadPolicyholderCasesFromJson(250);
  await prisma.caseRecord.createMany({ data: [...caseRecords, ...policyholderCases] });

  const documents = [
    { id: "doc_0001", caseId: "CAS-IN-2026-0001", name: "Pre-Authorization Form", type: "PDF", status: "parsed", pages: 3, createdAt: hoursAgo(20) },
    { id: "doc_0002", caseId: "CAS-IN-2026-0001", name: "Aadhaar Card", type: "PDF", status: "parsed", pages: 1, createdAt: hoursAgo(20) },
    { id: "doc_0003", caseId: "CAS-IN-2026-0001", name: "Doctor Prescription", type: "PDF", status: "parsed", pages: 2, createdAt: hoursAgo(19) },
    { id: "doc_0004", caseId: "CAS-IN-2026-0001", name: "Estimated Hospital Bill", type: "PDF", status: "pending", pages: 2, createdAt: hoursAgo(19) },

    { id: "doc_0005", caseId: "CAS-IN-2026-0002", name: "Admission Note", type: "PDF", status: "parsed", pages: 2, createdAt: daysAgo(2) },
    { id: "doc_0006", caseId: "CAS-IN-2026-0002", name: "PAN Card", type: "PDF", status: "parsed", pages: 1, createdAt: daysAgo(2) },
    { id: "doc_0007", caseId: "CAS-IN-2026-0002", name: "Policy Schedule", type: "PDF", status: "parsed", pages: 4, createdAt: daysAgo(2) },
    { id: "doc_0008", caseId: "CAS-IN-2026-0002", name: "ABHA ID Proof", type: "PDF", status: "missing", pages: null, createdAt: daysAgo(2) },
    { id: "doc_0009", caseId: "CAS-IN-2026-0002", name: "Hospital Estimate", type: "PDF", status: "parsed", pages: 3, createdAt: daysAgo(2) },

    { id: "doc_0010", caseId: "CAS-IN-2026-0003", name: "Discharge Summary", type: "PDF", status: "parsed", pages: 6, createdAt: daysAgo(3) },
    { id: "doc_0011", caseId: "CAS-IN-2026-0003", name: "Final Hospital Bill", type: "PDF", status: "parsed", pages: 5, createdAt: daysAgo(3) },
    { id: "doc_0012", caseId: "CAS-IN-2026-0003", name: "Pharmacy Bill", type: "PDF", status: "parsed", pages: 2, createdAt: daysAgo(3) },
    { id: "doc_0013", caseId: "CAS-IN-2026-0003", name: "Diagnostic Report", type: "PDF", status: "parsed", pages: 4, createdAt: daysAgo(3) },
    { id: "doc_0014", caseId: "CAS-IN-2026-0003", name: "Cancelled Cheque", type: "PDF", status: "parsed", pages: 1, createdAt: daysAgo(3) },
    { id: "doc_0015", caseId: "CAS-IN-2026-0003", name: "KYC Form", type: "PDF", status: "parsed", pages: 1, createdAt: daysAgo(3) },

    { id: "doc_0016", caseId: "CAS-IN-2026-0004", name: "High Value Bill", type: "PDF", status: "parsed", pages: 8, createdAt: daysAgo(1) },
    { id: "doc_0017", caseId: "CAS-IN-2026-0004", name: "Provider Statement", type: "PDF", status: "error", pages: 2, createdAt: daysAgo(1) },
    { id: "doc_0018", caseId: "CAS-IN-2026-0004", name: "Policy ID", type: "PDF", status: "parsed", pages: 1, createdAt: daysAgo(1) },

    { id: "doc_0019", caseId: "CAS-IN-2026-0005", name: "Claim Form", type: "PDF", status: "parsed", pages: 2, createdAt: hoursAgo(9) },
    { id: "doc_0020", caseId: "CAS-IN-2026-0005", name: "Hospital Invoice", type: "PDF", status: "pending", pages: 4, createdAt: hoursAgo(9) },
    { id: "doc_0021", caseId: "CAS-IN-2026-0005", name: "Doctor Certificate", type: "PDF", status: "parsed", pages: 2, createdAt: hoursAgo(9) },
    { id: "doc_0022", caseId: "CAS-IN-2026-0005", name: "Bank Passbook Copy", type: "PDF", status: "missing", pages: null, createdAt: hoursAgo(9) },

    { id: "doc_0023", caseId: "CAS-IN-2026-0006", name: "Daycare Procedure Summary", type: "PDF", status: "parsed", pages: 2, createdAt: daysAgo(5) },
    { id: "doc_0024", caseId: "CAS-IN-2026-0006", name: "Payment Receipt", type: "PDF", status: "parsed", pages: 1, createdAt: daysAgo(5) },
    { id: "doc_0025", caseId: "CAS-IN-2026-0006", name: "Prescription", type: "PDF", status: "parsed", pages: 1, createdAt: daysAgo(5) },

    { id: "doc_0026", caseId: "CAS-IN-2026-0007", name: "Maternity Claim Form", type: "PDF", status: "parsed", pages: 3, createdAt: daysAgo(4) },
    { id: "doc_0027", caseId: "CAS-IN-2026-0007", name: "Delivery Summary", type: "PDF", status: "pending", pages: 4, createdAt: daysAgo(4) },
    { id: "doc_0028", caseId: "CAS-IN-2026-0007", name: "Mother ID Proof", type: "PDF", status: "parsed", pages: 1, createdAt: daysAgo(4) },
    { id: "doc_0029", caseId: "CAS-IN-2026-0007", name: "Baby Discharge Card", type: "PDF", status: "missing", pages: null, createdAt: daysAgo(4) },
    { id: "doc_0030", caseId: "CAS-IN-2026-0007", name: "Hospital Tariff Sheet", type: "PDF", status: "error", pages: 2, createdAt: daysAgo(4) },

    { id: "doc_0031", caseId: "CAS-IN-2026-0008", name: "Senior Care Prescription", type: "PDF", status: "parsed", pages: 2, createdAt: daysAgo(6) },
    { id: "doc_0032", caseId: "CAS-IN-2026-0008", name: "Lab Results", type: "PDF", status: "pending", pages: 3, createdAt: daysAgo(6) },
    { id: "doc_0033", caseId: "CAS-IN-2026-0008", name: "Policy Rider", type: "PDF", status: "parsed", pages: 2, createdAt: daysAgo(6) },
    { id: "doc_0034", caseId: "CAS-IN-2026-0008", name: "KYC Update", type: "PDF", status: "missing", pages: null, createdAt: daysAgo(6) },

    { id: "doc_0035", caseId: "CAS-IN-2026-0009", name: "Critical Illness Form", type: "PDF", status: "error", pages: 3, createdAt: daysAgo(2) },
    { id: "doc_0036", caseId: "CAS-IN-2026-0009", name: "Oncologist Report", type: "PDF", status: "parsed", pages: 5, createdAt: daysAgo(2) },
    { id: "doc_0037", caseId: "CAS-IN-2026-0009", name: "Policy Bond", type: "PDF", status: "pending", pages: 3, createdAt: daysAgo(2) },
    { id: "doc_0038", caseId: "CAS-IN-2026-0009", name: "Identity Proof", type: "PDF", status: "missing", pages: null, createdAt: daysAgo(2) },

    { id: "doc_0039", caseId: "CAS-IN-2026-0010", name: "Claim Declaration", type: "PDF", status: "parsed", pages: 2, createdAt: hoursAgo(34) },
    { id: "doc_0040", caseId: "CAS-IN-2026-0010", name: "Hospital Bill", type: "PDF", status: "parsed", pages: 4, createdAt: hoursAgo(34) },
    { id: "doc_0041", caseId: "CAS-IN-2026-0010", name: "Prescription", type: "PDF", status: "parsed", pages: 1, createdAt: hoursAgo(34) },
    { id: "doc_0042", caseId: "CAS-IN-2026-0010", name: "Cancelled Cheque", type: "PDF", status: "pending", pages: 1, createdAt: hoursAgo(34) },
    { id: "doc_0043", caseId: "CAS-IN-2026-0010", name: "KYC Proof", type: "PDF", status: "missing", pages: null, createdAt: hoursAgo(34) }
  ];
  await prisma.document.createMany({ data: documents });

  const intakeJobs = [
    { id: "intake_0001", caseId: "CAS-IN-2026-0001", status: "validating", currentStep: "validation", flowConfig: { name: "Cashless Preauth", steps: [] }, createdAt: hoursAgo(20), updatedAt: hoursAgo(1) },
    { id: "intake_0002", caseId: "CAS-IN-2026-0002", status: "needs_review", currentStep: "human_review", flowConfig: { name: "Cashless Preauth", steps: [] }, createdAt: daysAgo(2), updatedAt: daysAgo(1) },
    { id: "intake_0003", caseId: "CAS-IN-2026-0003", status: "completed", currentStep: "done", flowConfig: { name: "Reimbursement", steps: [] }, createdAt: daysAgo(3), updatedAt: daysAgo(3) },
    { id: "intake_0004", caseId: "CAS-IN-2026-0004", status: "failed", currentStep: "fraud_check", errorMessage: "Provider anomaly score exceeded threshold", flowConfig: { name: "Fraud Watch", steps: [] }, createdAt: daysAgo(1), updatedAt: hoursAgo(5) },
    { id: "intake_0005", caseId: "CAS-IN-2026-0005", status: "parsing", currentStep: "data_extraction", flowConfig: { name: "Reimbursement", steps: [] }, createdAt: hoursAgo(10), updatedAt: hoursAgo(2) },
    { id: "intake_0006", caseId: "CAS-IN-2026-0006", status: "completed", currentStep: "done", flowConfig: { name: "Reimbursement", steps: [] }, createdAt: daysAgo(5), updatedAt: daysAgo(5) },
    { id: "intake_0007", caseId: "CAS-IN-2026-0007", status: "parsing", currentStep: "validation", flowConfig: { name: "Maternity Audit", steps: [] }, createdAt: daysAgo(4), updatedAt: hoursAgo(30) },
    { id: "intake_0008", caseId: "CAS-IN-2026-0008", status: "needs_review", currentStep: "manual_queue", flowConfig: { name: "Senior Care", steps: [] }, createdAt: daysAgo(6), updatedAt: daysAgo(5) },
    { id: "intake_0009", caseId: "CAS-IN-2026-0009", status: "failed", currentStep: "validation", errorMessage: "Critical document mismatch", flowConfig: { name: "Critical Illness", steps: [] }, createdAt: daysAgo(2), updatedAt: daysAgo(1) },
    { id: "intake_0010", caseId: "CAS-IN-2026-0010", status: "needs_review", currentStep: "review_queue", flowConfig: { name: "Reimbursement", steps: [] }, createdAt: hoursAgo(36), updatedAt: hoursAgo(6) }
  ];
  await prisma.intakeJob.createMany({
    data: intakeJobs.map((job) => ({
      ...job,
      flowConfig: job.flowConfig as any
    }))
  });

  const reviewTasks = [
    { id: "review_0001", caseId: "CAS-IN-2026-0002", reason: "Waiting period edge case", status: "open", assignedTo: null, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { id: "review_0002", caseId: "CAS-IN-2026-0008", reason: "Senior citizen chronic exception requires manual approval", status: "claimed", assignedTo: "usr_reviewer_priya", createdAt: daysAgo(5), updatedAt: daysAgo(3) },
    { id: "review_0003", caseId: "CAS-IN-2026-0010", reason: "Bank details mismatch in reimbursement documents", status: "resolved", assignedTo: "usr_reviewer_rahul", createdAt: hoursAgo(30), updatedAt: hoursAgo(12) },
    { id: "review_0004", caseId: "CAS-IN-2026-0004", reason: "Potential fraudulent provider billing", status: "open", assignedTo: null, createdAt: hoursAgo(20), updatedAt: hoursAgo(20) }
  ];
  await prisma.reviewTask.createMany({ data: reviewTasks });

  const agentRuns = [
    { id: "run_0001", caseId: "CAS-IN-2026-0001", intakeJobId: "intake_0001", agentId: "agt_claim_intake", agentName: "Bharat Claim Intake Agent", step: "email_intake", stepKind: "EMAIL_INTAKE", status: "completed", output: "{\"message\":\"intake complete\"}", durationMs: 1400, createdAt: hoursAgo(20), updatedAt: hoursAgo(20) },
    { id: "run_0002", caseId: "CAS-IN-2026-0001", intakeJobId: "intake_0001", agentId: "agt_doc_ocr", agentName: "Nidhi Document OCR Agent", step: "document_ocr", stepKind: "DOCUMENT_OCR", status: "completed", output: "{\"pages\":8}", durationMs: 3200, createdAt: hoursAgo(19), updatedAt: hoursAgo(19) },
    { id: "run_0003", caseId: "CAS-IN-2026-0001", intakeJobId: "intake_0001", agentId: "agt_validation", agentName: "Kavach Validation Agent", step: "validation", stepKind: "VALIDATION", status: "completed", output: "{\"confidence\":0.86}", durationMs: 2100, createdAt: hoursAgo(18), updatedAt: hoursAgo(18) },
    { id: "run_0004", caseId: "CAS-IN-2026-0002", intakeJobId: "intake_0002", agentId: "agt_decision", agentName: "IRDAI Policy Guard Agent", step: "decision", stepKind: "DECISION", status: "completed", output: "{\"decision\":\"REVIEW_REQUIRED\"}", durationMs: 1700, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { id: "run_0005", caseId: "CAS-IN-2026-0003", intakeJobId: "intake_0003", agentId: "agt_decision", agentName: "IRDAI Policy Guard Agent", step: "decision", stepKind: "DECISION", status: "completed", output: "{\"decision\":\"APPROVED\"}", durationMs: 1500, createdAt: daysAgo(3), updatedAt: daysAgo(3) },
    { id: "run_0006", caseId: "CAS-IN-2026-0004", intakeJobId: "intake_0004", agentId: "agt_fraud", agentName: "FraudShield SIU Agent", step: "fraud_check", stepKind: "KNOWLEDGE_CHECK", status: "failed", output: "{\"risk\":0.94}", error: "Fraud risk too high", durationMs: 1800, createdAt: hoursAgo(22), updatedAt: hoursAgo(22) },
    { id: "run_0007", caseId: "CAS-IN-2026-0005", intakeJobId: "intake_0005", agentId: "agt_doc_ocr", agentName: "Nidhi Document OCR Agent", step: "data_extraction", stepKind: "DATA_EXTRACTION", status: "completed", output: "{\"fields\":16}", durationMs: 2600, createdAt: hoursAgo(8), updatedAt: hoursAgo(8) },
    { id: "run_0008", caseId: "CAS-IN-2026-0009", intakeJobId: "intake_0009", agentId: "agt_validation", agentName: "Kavach Validation Agent", step: "validation", stepKind: "VALIDATION", status: "failed", output: "{\"confidence\":0.41}", error: "Invalid policy rider mapping", durationMs: 1900, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { id: "run_0009", caseId: "CAS-IN-2026-0010", intakeJobId: "intake_0010", agentId: "agt_customer_comms", agentName: "Seva Customer Communication Agent", step: "email_reply", stepKind: "EMAIL_REPLY", status: "completed", output: "{\"channel\":\"email\"}", durationMs: 900, createdAt: hoursAgo(12), updatedAt: hoursAgo(12) }
  ];
  await prisma.agentRun.createMany({
    data: agentRuns.map((run) => ({
      ...run,
      outputJson: JSON.parse(run.output) as any,
      inputJson: { caseId: run.caseId, intakeJobId: run.intakeJobId } as any
    }))
  });

  const workflowExecutions = [
    { id: "wfx_0001", workflowId: "wf_cashless_preauth", caseId: "CAS-IN-2026-0001", source: "mailbox", status: "running", currentStep: "wfstep_cp_3", input: { source: "email" }, context: { steps: { "Pre-auth Email Intake": { ok: true } } }, startedAt: hoursAgo(20), finishedAt: null },
    { id: "wfx_0002", workflowId: "wf_cashless_preauth", caseId: "CAS-IN-2026-0002", source: "webhook", status: "completed", currentStep: "wfstep_cp_6", input: { source: "hospital portal" }, context: { decision: "REVIEW_REQUIRED" }, output: { decision: "REVIEW_REQUIRED" }, startedAt: daysAgo(2), finishedAt: daysAgo(1) },
    { id: "wfx_0003", workflowId: "wf_reimbursement_claim", caseId: "CAS-IN-2026-0003", source: "mailbox", status: "completed", currentStep: "wfstep_rb_5", input: { source: "email" }, context: { decision: "APPROVED" }, output: { decision: "APPROVED" }, startedAt: daysAgo(3), finishedAt: daysAgo(3) },
    { id: "wfx_0004", workflowId: "wf_fraud_watch", caseId: "CAS-IN-2026-0004", source: "schedule", status: "failed", currentStep: "wfstep_fw_3", input: { source: "batch" }, context: { fraudScore: 0.94 }, errorMessage: "High fraud score escalated", startedAt: daysAgo(1), finishedAt: hoursAgo(20) },
    { id: "wfx_0005", workflowId: "wf_reimbursement_claim", caseId: "CAS-IN-2026-0005", source: "mailbox", status: "queued", currentStep: "wfstep_rb_1", input: { source: "email" }, context: {}, startedAt: hoursAgo(10), finishedAt: null },
    { id: "wfx_0006", workflowId: "wf_reimbursement_claim", caseId: "CAS-IN-2026-0006", source: "mailbox", status: "completed", currentStep: "wfstep_rb_5", input: { source: "email" }, context: { decision: "APPROVED" }, output: { decision: "APPROVED" }, startedAt: daysAgo(5), finishedAt: daysAgo(5) },
    { id: "wfx_0007", workflowId: "wf_maternity_audit", caseId: "CAS-IN-2026-0007", source: "manual", status: "running", currentStep: "wfstep_mt_2", input: { source: "ops" }, context: {}, startedAt: daysAgo(4), finishedAt: null },
    { id: "wfx_0008", workflowId: "wf_senior_care_paused", caseId: "CAS-IN-2026-0008", source: "manual", status: "queued", currentStep: "wfstep_sc_1", input: { source: "ops" }, context: {}, startedAt: daysAgo(6), finishedAt: null },
    { id: "wfx_0009", workflowId: "wf_reimbursement_claim", caseId: "CAS-IN-2026-0010", source: "mailbox", status: "completed", currentStep: "wfstep_rb_6", input: { source: "email" }, context: { decision: "REVIEW_REQUIRED" }, output: { decision: "REVIEW_REQUIRED" }, startedAt: hoursAgo(36), finishedAt: hoursAgo(10) }
  ];
  await prisma.workflowExecution.createMany({
    data: workflowExecutions.map((execution) => ({
      ...execution,
      input: (execution.input ?? {}) as any,
      context: (execution.context ?? {}) as any,
      output: (execution.output ?? null) as any
    }))
  });

  const workflowExecutionSteps = [
    { id: "wfxs_0001", executionId: "wfx_0001", stepId: "wfstep_cp_1", stepName: "Pre-auth Email Intake", stepType: "EMAIL_INTAKE", status: "completed", decision: null, durationMs: 1200, startedAt: hoursAgo(20), finishedAt: hoursAgo(20), input: { source: "email" }, output: { emailReceived: true } },
    { id: "wfxs_0002", executionId: "wfx_0001", stepId: "wfstep_cp_2", stepName: "Document OCR", stepType: "DOCUMENT_OCR", status: "completed", decision: null, durationMs: 3100, startedAt: hoursAgo(19), finishedAt: hoursAgo(19), input: { docs: 4 }, output: { textExtracted: true } },
    { id: "wfxs_0003", executionId: "wfx_0001", stepId: "wfstep_cp_3", stepName: "Coverage Validation", stepType: "VALIDATION", status: "running", decision: null, durationMs: null, startedAt: hoursAgo(1), finishedAt: null, input: { confidence: 0.86 }, output: null },

    { id: "wfxs_0004", executionId: "wfx_0002", stepId: "wfstep_cp_4", stepName: "Decision", stepType: "DECISION", status: "completed", decision: "REVIEW_REQUIRED", durationMs: 1500, startedAt: daysAgo(2), finishedAt: daysAgo(2), input: { confidence: 0.72 }, output: { reason: "Edge-case waiting period" } },
    { id: "wfxs_0005", executionId: "wfx_0002", stepId: "wfstep_cp_6", stepName: "Human Review", stepType: "HUMAN_REVIEW", status: "completed", decision: null, durationMs: 900, startedAt: daysAgo(1), finishedAt: daysAgo(1), input: {}, output: { reviewTaskCreated: true } },

    { id: "wfxs_0006", executionId: "wfx_0003", stepId: "wfstep_rb_4", stepName: "Decision", stepType: "DECISION", status: "completed", decision: "APPROVED", durationMs: 1400, startedAt: daysAgo(3), finishedAt: daysAgo(3), input: { confidence: 0.91 }, output: { settlement: "Approved" } },
    { id: "wfxs_0007", executionId: "wfx_0003", stepId: "wfstep_rb_5", stepName: "Approval", stepType: "APPROVAL", status: "completed", decision: null, durationMs: 700, startedAt: daysAgo(3), finishedAt: daysAgo(3), input: {}, output: { approved: true } },

    { id: "wfxs_0008", executionId: "wfx_0004", stepId: "wfstep_fw_2", stepName: "Knowledge Risk Check", stepType: "KNOWLEDGE_CHECK", status: "completed", decision: null, durationMs: 1000, startedAt: daysAgo(1), finishedAt: daysAgo(1), input: {}, output: { riskScore: 0.94 } },
    { id: "wfxs_0009", executionId: "wfx_0004", stepId: "wfstep_fw_3", stepName: "Decision", stepType: "DECISION", status: "failed", decision: "REJECTED", durationMs: 1100, startedAt: hoursAgo(21), finishedAt: hoursAgo(20), input: {}, output: { reason: "Fraud suspected" } },

    { id: "wfxs_0010", executionId: "wfx_0005", stepId: "wfstep_rb_1", stepName: "Claim Intake", stepType: "EMAIL_INTAKE", status: "running", decision: null, durationMs: null, startedAt: hoursAgo(9), finishedAt: null, input: {}, output: null },

    { id: "wfxs_0011", executionId: "wfx_0009", stepId: "wfstep_rb_4", stepName: "Decision", stepType: "DECISION", status: "completed", decision: "REVIEW_REQUIRED", durationMs: 1300, startedAt: hoursAgo(13), finishedAt: hoursAgo(12), input: {}, output: { reason: "Bank mismatch" } },
    { id: "wfxs_0012", executionId: "wfx_0009", stepId: "wfstep_rb_6", stepName: "Human Review", stepType: "HUMAN_REVIEW", status: "completed", decision: null, durationMs: 600, startedAt: hoursAgo(12), finishedAt: hoursAgo(11), input: {}, output: { resolved: true } }
  ];
  await prisma.workflowExecutionStep.createMany({
    data: workflowExecutionSteps.map((step) => ({
      ...step,
      input: (step.input ?? null) as any,
      output: (step.output ?? null) as any
    }))
  });

  const events = [
    { id: "evt_0001", caseId: "CAS-IN-2026-0001", type: "workflowStepStatus", payload: { message: "Coverage Validation started", status: "running" }, createdAt: hoursAgo(1) },
    { id: "evt_0002", caseId: "CAS-IN-2026-0002", type: "reviewQueueChange", payload: { status: "open", reason: "Waiting period edge case" }, createdAt: daysAgo(1) },
    { id: "evt_0003", caseId: "CAS-IN-2026-0003", type: "intakeStatus", payload: { status: "completed", message: "Claim settled" }, createdAt: daysAgo(3) },
    { id: "evt_0004", caseId: "CAS-IN-2026-0004", type: "workflowStepStatus", payload: { status: "failed", message: "Fraud risk exceeded threshold" }, createdAt: hoursAgo(20) },
    { id: "evt_0005", caseId: "CAS-IN-2026-0010", type: "reviewQueueChange", payload: { status: "resolved", reason: "Bank details verified manually" }, createdAt: hoursAgo(10) }
  ];
  await prisma.event.createMany({
    data: events.map((event) => ({
      ...event,
      payload: event.payload as any
    }))
  });

  const auditLogs = [
    { id: "audit_0001", userId: "usr_admin_anjali", action: "auth.login", resource: "session", resourceId: null, status: "success", ip: "49.36.110.10", metadata: { role: "admin" }, createdAt: hoursAgo(5) },
    { id: "audit_0002", userId: "usr_operator_vikram", action: "agent.create", resource: "agent", resourceId: "agt_customer_comms", status: "success", ip: "49.36.110.11", metadata: { source: "demo-seed" }, createdAt: hoursAgo(48) },
    { id: "audit_0003", userId: "usr_reviewer_priya", action: "review_task.claim", resource: "review_task", resourceId: "review_0002", status: "success", ip: "117.98.88.14", metadata: null, createdAt: hoursAgo(26) },
    { id: "audit_0004", userId: "usr_reviewer_rahul", action: "review_task.resolve", resource: "review_task", resourceId: "review_0003", status: "success", ip: "117.98.88.15", metadata: { note: "Verified KYC and bank details" }, createdAt: hoursAgo(11) },
    { id: "audit_0005", userId: "usr_compliance_neha", action: "workflow.status_update", resource: "workflow", resourceId: "wf_maternity_audit", status: "success", ip: "103.12.120.19", metadata: { status: "draft" }, createdAt: daysAgo(4) },
    { id: "audit_0006", userId: "usr_admin_anjali", action: "audit_logs.read", resource: "audit_log", resourceId: null, status: "success", ip: "49.36.110.10", metadata: { limit: 200 }, createdAt: hoursAgo(2) }
  ];
  await prisma.auditLog.createMany({
    data: auditLogs.map((log) => ({
      ...log,
      metadata: (log.metadata ?? null) as any
    }))
  });

  console.log(
    `Seed complete: ${users.length} users, ${agents.length} agents, ${workflows.length} workflows, ` +
    `${caseRecords.length + policyholderCases.length} cases, ${documents.length} documents, ${reviewTasks.length} review tasks, ` +
    `${workflowExecutions.length} workflow executions, ${auditLogs.length} audit logs.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
