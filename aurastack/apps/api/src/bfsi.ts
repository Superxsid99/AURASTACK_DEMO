export interface BfsiWorkflowTemplate {
  name: string;
  agents: string[];
}

export type BfsiWorkflowLibrary = Record<string, BfsiWorkflowTemplate[]>;

export const BFSI_WORKFLOW_LIBRARY: BfsiWorkflowLibrary = {
  Banking: [
    { name: "Loan Origination", agents: ["Application Intake Agent", "KYC & Identity Agent", "Bureau Fetch Agent", "Financial Data Agent", "Risk Decision Agent", "Offer Generation Agent", "Disbursal Agent"] },
    { name: "Credit Underwriting", agents: ["Case Aggregation Agent", "Document Consistency Agent", "Risk Flagging Agent", "Underwriter Assist Agent", "Decision Agent"] },
    { name: "Loan Collections", agents: ["Delinquency Detection Agent", "Segmentation Agent", "Strategy Agent", "Outreach Agent", "Negotiation Agent", "Resolution Agent"] },
    { name: "Payments (UPI / IMPS / NEFT)", agents: ["Authorization Agent", "Fraud Detection Agent", "Routing Agent", "Execution Agent", "Reconciliation Agent"] },
    { name: "Customer Servicing", agents: ["Intent Detection Agent", "Context Fetch Agent", "Validation Agent", "Action Agent", "Resolution Agent"] },
    { name: "AML Transaction Monitoring", agents: ["Transaction Monitoring Agent", "Pattern Detection Agent", "Risk Scoring Agent", "Alert Generation Agent", "Case Investigation Agent", "Regulatory Filing Agent"] },
    { name: "Digital Account Opening", agents: ["Application Intake Agent", "KYC Verification Agent", "Document Validation Agent", "Risk & Compliance Agent", "Account Creation Agent"] },
    { name: "Cheque & Trade Document Processing", agents: ["Document Intake Agent", "Classification Agent", "Extraction Agent", "Validation Agent", "Exception Handling Agent", "Processing Agent"] },
    { name: "Compliance & Regulatory Reporting", agents: ["Data Aggregation Agent", "Validation Agent", "Report Generation Agent", "Submission Agent"] }
  ],
  "Insurance - Health": [
    { name: "Cashless Claims", agents: ["Pre-Auth Intake Agent", "Policy Validation Agent", "Medical Validation Agent", "Fraud Detection Agent", "Approval Agent", "Hospital Coordination Agent", "Settlement Agent"] },
    { name: "Reimbursement Claims", agents: ["Document Intake Agent", "Validation Agent", "Assessment Agent", "Decision Agent", "Settlement Agent"] },
    { name: "Pre-Auth Automation", agents: ["Pre-Auth Intake Agent", "Policy Check Agent", "Medical Rule Engine Agent", "Approval Agent", "Hospital Notification Agent"] },
    { name: "TPA Coordination & Settlement", agents: ["TPA Case Intake Agent", "Document Exchange Agent", "Validation Agent", "Discrepancy Resolution Agent", "Settlement Agent"] },
    { name: "Policy Issuance", agents: ["Proposal Intake Agent", "KYC Agent", "Medical Underwriting Agent", "Risk Evaluation Agent", "Policy Generation Agent"] },
    { name: "Medical Underwriting", agents: ["Medical Document Intake Agent", "Medical Risk Analysis Agent", "Underwriter Assist Agent", "Decision Agent"] },
    { name: "Member Servicing", agents: ["Intent Detection Agent", "Policy Context Agent", "Validation Agent", "Action Agent", "Resolution Agent"] },
    { name: "Policy Explainer", agents: ["Question Intake Agent", "Policy Retrieval Agent", "Clause Interpretation Agent", "Response Generation Agent"] },
    { name: "Benefits Advisor", agents: ["Profile Intake Agent", "Plan Modeling Agent", "Recommendation Agent", "Trade-off Explanation Agent"] },
    { name: "Fraud & SIU", agents: ["Case Intake Agent", "Pattern Detection Agent", "Cross-Claim Analysis Agent", "Investigation Assist Agent", "Decision Agent"] },
    { name: "Appeals & Grievances", agents: ["Case Intake Agent", "History Aggregation Agent", "Review Agent", "Resolution Agent"] }
  ],
  "Insurance - Motor": [
    { name: "Motor Claims (FNOL to Settlement)", agents: ["FNOL Intake Agent", "Policy Validation Agent", "Damage Assessment Agent", "Garage Coordination Agent", "Fraud Detection Agent", "Approval Agent", "Settlement Agent"] },
    { name: "Surveyor Assignment & Tracking", agents: ["Survey Request Agent", "Surveyor Assignment Agent", "Schedule Coordination Agent", "Report Collection Agent", "Status Tracking Agent"] },
    { name: "Salvage & Recovery Workflow", agents: ["Salvage Identification Agent", "Vendor Assignment Agent", "Auction / Disposal Agent", "Recovery Tracking Agent", "Closure Agent"] },
    { name: "Policy Issuance (Motor)", agents: ["Vehicle Data Agent", "Risk Pricing Agent", "Policy Generation Agent"] },
    { name: "Renewals", agents: ["Renewal Reminder Agent", "Risk Re-evaluation Agent", "Offer Agent", "Payment Agent"] },
    { name: "Renewal Risk Scoring", agents: ["Policy History Agent", "Behavioral Signal Agent", "Risk Scoring Agent", "Retention Strategy Agent"] }
  ],
  "Insurance - Property & Casualty": [
    { name: "Property Claims", agents: ["Claim Intake Agent", "Policy Validation Agent", "Surveyor Assignment Agent", "Assessment Agent", "Fraud Detection Agent", "Decision Agent", "Settlement Agent"] },
    { name: "Commercial Liability Claims", agents: ["Incident Intake Agent", "Liability Evaluation Agent", "Legal Coordination Agent", "Settlement Agent"] },
    { name: "Commercial Underwriting", agents: ["Proposal Intake Agent", "Risk Data Aggregation Agent", "Site Analysis Agent", "Underwriter Assist Agent", "Decision Agent"] },
    { name: "Policy Issuance (Commercial)", agents: ["Coverage Structuring Agent", "Pricing Agent", "Policy Generation Agent"] },
    { name: "Renewals & Endorsements", agents: ["Renewal Agent", "Risk Update Agent", "Policy Update Agent"] },
    { name: "Renewal Risk Scoring (Commercial)", agents: ["Portfolio Insight Agent", "Renewal Risk Scoring Agent", "Retention Offer Agent", "Broker Follow-up Agent"] }
  ],
  "Cross-Industry": [
    { name: "Document Lifecycle Processing", agents: ["Document Intake Agent", "Classification Agent", "Extraction Agent", "Validation Agent", "Exception Handling Agent", "Routing Agent"] },
    { name: "Regulatory Reporting (RBI / SEBI / IRDAI)", agents: ["Data Aggregation Agent", "Validation Agent", "Report Generation Agent", "Submission Agent"] },
    { name: "Agent Performance & SLA Monitoring", agents: ["Activity Tracking Agent", "KPI Measurement Agent", "SLA Breach Detection Agent", "Performance Reporting Agent"] },
    { name: "Policy Comparison", agents: ["Document Intake Agent", "Coverage Extraction Agent", "Comparison Agent", "Advisor Summary Agent"] },
    { name: "AI Sales Assistant", agents: ["Lead Conversation Agent", "Needs Assessment Agent", "Offer Recommendation Agent", "Sales Handoff Agent"] },
    { name: "Lead Qualification", agents: ["Lead Intake Agent", "Qualification Agent", "Scoring Agent", "Routing Agent"] },
    { name: "Quote Follow-Up", agents: ["Quote Tracker Agent", "Personalized Outreach Agent", "Objection Assist Agent", "Sales Escalation Agent"] },
    { name: "Cross-Sell & Upsell", agents: ["Opportunity Detection Agent", "Offer Personalization Agent", "Outreach Agent", "Conversion Tracking Agent"] },
    { name: "CRM Data Entry Automation", agents: ["Channel Intake Agent", "Entity Extraction Agent", "CRM Mapping Agent", "Sync Agent"] },
    { name: "Document Generation", agents: ["Template Selection Agent", "Data Merge Agent", "Narrative Generation Agent", "Distribution Agent"] },
    { name: "Multi-System Orchestrator", agents: ["Planner Agent", "Execution Orchestrator Agent", "Retry & Exception Agent", "Audit Trail Agent"] }
  ]
};

function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function ranged(base: number, spread: number, seed: number, digits = 1): number {
  const value = base + (seededNoise(seed) - 0.5) * spread;
  const precision = Math.pow(10, digits);
  return Math.round(value * precision) / precision;
}

function dayLabels(rangeDays: number): string[] {
  const now = new Date();
  const points = Math.min(10, Math.max(5, Math.ceil(rangeDays / 7)));
  const step = Math.max(1, Math.floor(rangeDays / points));
  const labels: string[] = [];
  for (let i = points - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * step * 24 * 60 * 60 * 1000);
    labels.push(d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }));
  }
  return labels;
}

export function buildBfsiAnalytics(rangeDays = 30): Record<string, unknown> {
  const labels = dayLabels(rangeDays);
  const loanTrend = labels.map((label, i) => {
    const apps = Math.round(ranged(1020, 260, i + 1, 0));
    const approved = Math.round(apps * ranged(0.382, 0.05, i + 29, 3));
    return { month: label, apps, approved };
  });

  const amlTrend = labels.map((label, i) => ({
    day: label,
    monitored: Math.round(ranged(203400, 32000, i + 53, 0)),
    alerts: Math.round(ranged(203400 * 0.0104, 450, i + 67, 0))
  }));

  const cashlessTrend = labels.map((label, i) => {
    const preAuth = Math.round(ranged(2612, 300, i + 73, 0));
    return {
      month: label,
      preAuth,
      approved: Math.round(preAuth * ranged(0.713, 0.04, i + 79, 3)),
      flagged: Math.round(preAuth * ranged(0.032, 0.008, i + 83, 4))
    };
  });

  const motorTrend = labels.map((label, i) => {
    const fnol = Math.round(ranged(712, 120, i + 97, 0));
    return {
      month: label,
      fnol,
      approved: Math.round(fnol * ranged(0.824, 0.05, i + 101, 3)),
      fraud: Math.round(fnol * ranged(0.041, 0.01, i + 103, 4))
    };
  });

  const docTrend = labels.map((label, i) => {
    const processed = Math.round(ranged(16200, 2000, i + 107, 0));
    return {
      day: label,
      processed,
      stp: Math.round(processed * ranged(0.823, 0.05, i + 109, 3))
    };
  });

  return {
    loanOrigination: {
      applicationsDaily: Math.round(ranged(1047, 120, 201, 0)),
      conversionRate: ranged(38.2, 4, 202, 1),
      autoApproval: ranged(58.7, 6, 203, 1),
      avgTAT_hours: ranged(4.2, 0.5, 204, 1),
      baselineTAT_hours: 120,
      dropoffPct: ranged(25.4, 3, 205, 1),
      trend: loanTrend
    },
    aml: {
      transactionsMonitored: Math.round(ranged(203400, 25000, 211, 0)),
      alertRate: ranged(1.04, 0.18, 212, 2),
      falsePositiveRate: ranged(69.7, 3.2, 213, 1),
      strsWeekly: Math.round(ranged(14, 4, 214, 0)),
      riskDist: [{ name: "Low Risk", value: 68 }, { name: "Medium Risk", value: 24 }, { name: "High Risk", value: 8 }],
      trend: amlTrend
    },
    collections: {
      efficiency: ranged(67.3, 4, 221, 1),
      promiseToPay: ranged(44.1, 4, 222, 1),
      writeOffRate: ranged(3.2, 0.8, 223, 1),
      dpd: [
        { bucket: "DPD 0-30", pct: 58, accounts: 14326 },
        { bucket: "DPD 31-60", pct: 24, accounts: 5932 },
        { bucket: "DPD 61-90", pct: 11, accounts: 2717 },
        { bucket: "DPD 90+", pct: 7, accounts: 1729 }
      ],
      channelEffectiveness: [
        { channel: "WhatsApp", contacts: 8420, converted: 3782, rate: 44.9 },
        { channel: "Voice Call", contacts: 7110, converted: 1387, rate: 19.5 },
        { channel: "Field Visit", contacts: 1230, converted: 512, rate: 41.6 },
        { channel: "Email", contacts: 5800, converted: 638, rate: 11.0 }
      ]
    },
    cashlessClaims: {
      preAuthDaily: Math.round(ranged(2612, 260, 231, 0)),
      approvalRate: ranged(71.3, 4, 232, 1),
      avgApprovalTAT_min: Math.round(ranged(47, 8, 233, 0)),
      baselineTAT_hr: 6,
      avgClaimSize_rs: Math.round(ranged(48200, 7000, 234, 0)),
      fraudFlagRate: ranged(3.2, 0.8, 235, 1),
      settlementTAT_days: ranged(2.1, 0.5, 236, 1),
      hospitalDist: [
        { name: "Apollo", claims: 412 },
        { name: "Fortis", claims: 387 },
        { name: "Max", claims: 341 },
        { name: "Manipal", claims: 298 },
        { name: "AIIMS", claims: 274 },
        { name: "Others", claims: 900 }
      ],
      trend: cashlessTrend
    },
    reimbursement: {
      claimsMonthly: Math.round(ranged(8240, 800, 241, 0)),
      settledMonthly: Math.round(ranged(7106, 600, 242, 0)),
      avgProcessingDays: ranged(4.8, 0.8, 243, 1),
      docDeficiencyRate: ranged(31, 3, 244, 1),
      approvalRate: ranged(74.2, 4, 245, 1),
      costPerClaim_rs: Math.round(ranged(340, 30, 246, 0)),
      rejectionReasons: [
        { reason: "Doc Deficiency", pct: 31 },
        { reason: "Policy Exclusion", pct: 24 },
        { reason: "Duplicate", pct: 18 },
        { reason: "SI Exhausted", pct: 16 },
        { reason: "Other", pct: 11 }
      ]
    },
    motorClaims: {
      fnolDaily: Math.round(ranged(712, 140, 251, 0)),
      approvalRate: ranged(82.4, 4, 252, 1),
      avgSettlementDays: ranged(6.2, 0.8, 253, 1),
      baselineDays: 14,
      avgRepairCost_rs: Math.round(ranged(38400, 6000, 254, 0)),
      fraudDetectionRate: ranged(4.1, 0.8, 255, 1),
      garageCoordTime_min: Math.round(ranged(38, 8, 256, 0)),
      trend: motorTrend
    },
    surveyor: {
      avgAssignmentMin: Math.round(ranged(23, 4, 261, 0)),
      completionTAT_days: ranged(1.4, 0.3, 262, 1),
      pendingPct: ranged(7.2, 1.2, 263, 1),
      pendingCount: Math.round(ranged(51, 12, 264, 0))
    },
    docProcessing: {
      dailyVolume: Math.round(ranged(16200, 2400, 271, 0)),
      stpRate: ranged(82.3, 4, 272, 1),
      extractionAccuracy: 99.1,
      exceptionRate: ranged(11.0, 1.5, 273, 1),
      avgProcessingMin: ranged(1.2, 0.2, 274, 1),
      costPerDoc_rs: Math.round(ranged(12, 2, 275, 0)),
      baselineCost_rs: 68,
      trend: docTrend
    },
    agentPerformance: {
      avgCasesPerAgent: Math.round(ranged(47, 4, 281, 0)),
      slaBreach: ranged(6.2, 1.1, 282, 1),
      queueBacklogPct: ranged(2.8, 0.8, 283, 1),
      costPerCase_rs: Math.round(ranged(28, 4, 284, 0)),
      productivity: [
        { name: "Rajesh Kumar", cases: 52, sla: 96.2, score: 94 },
        { name: "Priya Sharma", cases: 48, sla: 97.1, score: 96 },
        { name: "Rahul Sharma", cases: 47, sla: 94.8, score: 91 },
        { name: "Amit Patel", cases: 44, sla: 93.2, score: 89 },
        { name: "Neha Reddy", cases: 41, sla: 95.6, score: 92 }
      ]
    },
    beforeAfter: {
      tatImprovement: "6.8x faster",
      costReduction: "4.7x lower",
      manualInterventionDrop: "3.2x lower",
      errorRateDrop: "2.1x lower"
    },
    meta: {
      rangeDays,
      generatedAt: new Date().toISOString()
    }
  };
}
