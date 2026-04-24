import { createHash } from "node:crypto";

export type FraudSector = "insurance" | "banking";

export type FraudRule = {
  key: string;
  sector: FraudSector;
  fraudType: string;
  description: string;
  severity: "medium" | "high" | "critical";
  weight: number;
  signals: string[];
};

export type FraudDemoDocument = {
  id: string;
  name: string;
  type: "pdf" | "image" | "statement" | "invoice" | "claim_form" | "kyc";
  summary: string;
  content: string;
};

export type FraudDemoCase = {
  id: string;
  caseCode: string;
  sector: FraudSector;
  product: string;
  title: string;
  claimOrTxnAmount: number;
  customerName: string;
  customerId: string;
  policyOrAccountNumber: string;
  channel: "email" | "branch" | "api" | "mobile" | "partner";
  geo: string;
  expectedLabel: "fraud" | "genuine";
  expectedFraudType?: string;
  signals: Record<string, number | boolean | string>;
  documents: FraudDemoDocument[];
};

export type FraudDetectionFinding = {
  ruleKey: string;
  fraudType: string;
  severity: "medium" | "high" | "critical";
  scoreContribution: number;
  evidence: string[];
};

export type FraudDetectionResult = {
  caseId: string;
  caseCode: string;
  sector: FraudSector;
  riskScore: number;
  riskBand: "low" | "medium" | "high" | "critical";
  verdict: "allow" | "review" | "block";
  triggeredFindings: FraudDetectionFinding[];
  summary: string;
};

export const FRAUD_RULE_LIBRARY: FraudRule[] = [
  {
    key: "INS_DUPLICATE_CLAIM",
    sector: "insurance",
    fraudType: "Duplicate Claim Submission",
    description: "Same treatment window and invoice details submitted across multiple claims.",
    severity: "high",
    weight: 28,
    signals: ["duplicateClaimCount", "sameInvoiceHashSeen"]
  },
  {
    key: "INS_UPCODING_PROVIDER",
    sector: "insurance",
    fraudType: "Provider Upcoding / Unbundling",
    description: "Procedure and billing pattern exceeds diagnosis norms and regional baselines.",
    severity: "critical",
    weight: 32,
    signals: ["procedureDiagnosisMismatch", "providerAnomalyScore", "billingInflationPercent"]
  },
  {
    key: "INS_WAITING_PERIOD_BREACH",
    sector: "insurance",
    fraudType: "Coverage Eligibility Breach",
    description: "Claim falls within waiting period or excluded condition window.",
    severity: "high",
    weight: 24,
    signals: ["waitingPeriodBreach", "excludedConditionFlag"]
  },
  {
    key: "INS_DOCUMENT_TAMPER",
    sector: "insurance",
    fraudType: "Document Forgery / Tampering",
    description: "Metadata mismatch, OCR inconsistency, or signature irregularity detected.",
    severity: "critical",
    weight: 36,
    signals: ["ocrInconsistencyScore", "metadataTamperFlag", "signatureMismatchFlag"]
  },
  {
    key: "BNK_ACCOUNT_TAKEOVER",
    sector: "banking",
    fraudType: "Account Takeover (ATO)",
    description: "New device + impossible travel + credential reset prior to high-value transfer.",
    severity: "critical",
    weight: 38,
    signals: ["newDeviceFlag", "geoVelocityKm", "recentPasswordReset", "beneficiaryAddedWithin24h"]
  },
  {
    key: "BNK_MULE_LAYERING",
    sector: "banking",
    fraudType: "Mule Account / Layering",
    description: "Rapid in-out transfers with circular patterns and high counterpart entropy.",
    severity: "critical",
    weight: 40,
    signals: ["cashInOutVelocity", "roundTripTransferFlag", "counterpartyEntropy"]
  },
  {
    key: "BNK_SYNTHETIC_IDENTITY",
    sector: "banking",
    fraudType: "Synthetic Identity",
    description: "KYC mismatches across PAN, address, and bureau profile with fabricated footprints.",
    severity: "high",
    weight: 30,
    signals: ["kycMismatchCount", "bureauThinFileFlag", "deviceReuseAcrossIdentities"]
  },
  {
    key: "BNK_LOAN_DOC_FABRICATION",
    sector: "banking",
    fraudType: "Loan Application Fabrication",
    description: "Declared income and employment docs conflict with bank statement patterns.",
    severity: "high",
    weight: 29,
    signals: ["incomeMismatchPercent", "statementAnomalyScore", "employerVerificationFailed"]
  }
];

const INSURANCE_CASES: FraudDemoCase[] = [
  {
    id: "ins-001",
    caseCode: "FRD-INS-001",
    sector: "insurance",
    product: "Health Claims",
    title: "Cashless oncology claim with repeated invoice line items",
    claimOrTxnAmount: 486000,
    customerName: "Seema Agarwal",
    customerId: "CUS-INS-7721",
    policyOrAccountNumber: "HLT-2024-88291",
    channel: "email",
    geo: "Mumbai",
    expectedLabel: "fraud",
    expectedFraudType: "Duplicate Claim Submission",
    signals: {
      duplicateClaimCount: 2,
      sameInvoiceHashSeen: true,
      procedureDiagnosisMismatch: false,
      waitingPeriodBreach: false,
      ocrInconsistencyScore: 0.11
    },
    documents: [
      {
        id: "d1",
        name: "discharge_summary_34_pages.pdf",
        type: "pdf",
        summary: "Oncology discharge summary with chemo protocol and admission timeline.",
        content:
          "Diagnosis: Metastatic Pancreatic Adenocarcinoma. Admission: 10-Sep-2026. Discharge: 16-Sep-2026. Treatment: Gemcite + Abraxane Cycle II/III."
      },
      {
        id: "d2",
        name: "hospital_invoice_apollo_sep.pdf",
        type: "invoice",
        summary: "Invoice appears previously claimed under another claim id.",
        content:
          "Invoice No APH-448892. Total INR 486,000. Item lines repeat exact quantities and timestamps of previously settled claim CLM-998117."
      }
    ]
  },
  {
    id: "ins-002",
    caseCode: "FRD-INS-002",
    sector: "insurance",
    product: "Health Claims",
    title: "Appendectomy claim with clean document chain",
    claimOrTxnAmount: 128000,
    customerName: "Rohit Menon",
    customerId: "CUS-INS-4901",
    policyOrAccountNumber: "HLT-2025-11993",
    channel: "email",
    geo: "Bengaluru",
    expectedLabel: "genuine",
    signals: {
      duplicateClaimCount: 0,
      sameInvoiceHashSeen: false,
      procedureDiagnosisMismatch: false,
      waitingPeriodBreach: false,
      ocrInconsistencyScore: 0.03
    },
    documents: [
      {
        id: "d1",
        name: "discharge_summary_appendix.pdf",
        type: "pdf",
        summary: "Single admission episode with coherent clinical pathway.",
        content: "Diagnosis: Acute appendicitis. Laparoscopic appendectomy done. Recovery uneventful."
      }
    ]
  },
  {
    id: "ins-003",
    caseCode: "FRD-INS-003",
    sector: "insurance",
    product: "Motor Claims",
    title: "Motor claim with suspicious inflated repair estimate",
    claimOrTxnAmount: 311000,
    customerName: "Ishita Rao",
    customerId: "CUS-INS-3234",
    policyOrAccountNumber: "MTR-2024-71220",
    channel: "partner",
    geo: "Pune",
    expectedLabel: "fraud",
    expectedFraudType: "Provider Upcoding / Unbundling",
    signals: {
      procedureDiagnosisMismatch: true,
      providerAnomalyScore: 0.91,
      billingInflationPercent: 64,
      ocrInconsistencyScore: 0.08
    },
    documents: [
      {
        id: "d1",
        name: "garage_estimate_rev3.pdf",
        type: "invoice",
        summary: "Estimate includes parts not linked to collision impact zone.",
        content: "Rear-collision incident yet estimate includes full front suspension and ECU replacement."
      }
    ]
  },
  {
    id: "ins-004",
    caseCode: "FRD-INS-004",
    sector: "insurance",
    product: "Health Claims",
    title: "Critical illness claim filed inside waiting period",
    claimOrTxnAmount: 950000,
    customerName: "Anupam Das",
    customerId: "CUS-INS-2911",
    policyOrAccountNumber: "HLT-2026-55109",
    channel: "email",
    geo: "Kolkata",
    expectedLabel: "fraud",
    expectedFraudType: "Coverage Eligibility Breach",
    signals: {
      waitingPeriodBreach: true,
      excludedConditionFlag: true,
      duplicateClaimCount: 0,
      ocrInconsistencyScore: 0.02
    },
    documents: [
      {
        id: "d1",
        name: "policy_schedule.pdf",
        type: "pdf",
        summary: "Policy in-force for 41 days with 90-day waiting period clause.",
        content: "Coverage start: 01-Aug-2026. Claim event: 11-Sep-2026. Waiting period for CI: 90 days."
      }
    ]
  },
  {
    id: "ins-005",
    caseCode: "FRD-INS-005",
    sector: "insurance",
    product: "Health Claims",
    title: "Possible tampered pathology report",
    claimOrTxnAmount: 174000,
    customerName: "Karan Bedi",
    customerId: "CUS-INS-9920",
    policyOrAccountNumber: "HLT-2024-30081",
    channel: "email",
    geo: "Delhi",
    expectedLabel: "fraud",
    expectedFraudType: "Document Forgery / Tampering",
    signals: {
      metadataTamperFlag: true,
      signatureMismatchFlag: true,
      ocrInconsistencyScore: 0.87,
      duplicateClaimCount: 0
    },
    documents: [
      {
        id: "d1",
        name: "pathology_report_scan.jpeg",
        type: "image",
        summary: "OCR fields and embedded metadata show timestamp overwrite.",
        content: "Report header date differs from footer date; digital signature hash mismatch."
      }
    ]
  }
];

const BANKING_CASES: FraudDemoCase[] = [
  {
    id: "bnk-001",
    caseCode: "FRD-BNK-001",
    sector: "banking",
    product: "Retail Banking",
    title: "High-value transfer after password reset from new device",
    claimOrTxnAmount: 820000,
    customerName: "Amit Khanna",
    customerId: "CUS-BNK-2041",
    policyOrAccountNumber: "AC-004551882",
    channel: "mobile",
    geo: "New Delhi",
    expectedLabel: "fraud",
    expectedFraudType: "Account Takeover (ATO)",
    signals: {
      newDeviceFlag: true,
      geoVelocityKm: 1820,
      recentPasswordReset: true,
      beneficiaryAddedWithin24h: true
    },
    documents: [
      {
        id: "d1",
        name: "transaction_alert_bundle.txt",
        type: "statement",
        summary: "Burst transactions right after credential reset.",
        content: "11:03 reset password. 11:12 new beneficiary. 11:18 transfer INR 820,000 to first-time payee."
      }
    ]
  },
  {
    id: "bnk-002",
    caseCode: "FRD-BNK-002",
    sector: "banking",
    product: "Cards",
    title: "Card-not-present spree at known merchants",
    claimOrTxnAmount: 38000,
    customerName: "Neha Jain",
    customerId: "CUS-BNK-8911",
    policyOrAccountNumber: "CRD-2200-9912",
    channel: "api",
    geo: "Hyderabad",
    expectedLabel: "genuine",
    signals: {
      newDeviceFlag: false,
      geoVelocityKm: 14,
      cashInOutVelocity: 0,
      counterpartyEntropy: 0
    },
    documents: [
      {
        id: "d1",
        name: "merchant_receipts.zip.txt",
        type: "statement",
        summary: "Stable pattern with known wallet and merchant history.",
        content: "Same merchant cohort as last 90 days; 3DS challenge passed."
      }
    ]
  },
  {
    id: "bnk-003",
    caseCode: "FRD-BNK-003",
    sector: "banking",
    product: "Payments",
    title: "Mule layering pattern in newly opened account",
    claimOrTxnAmount: 1265000,
    customerName: "Ravi Solanki",
    customerId: "CUS-BNK-5592",
    policyOrAccountNumber: "AC-227710044",
    channel: "api",
    geo: "Lucknow",
    expectedLabel: "fraud",
    expectedFraudType: "Mule Account / Layering",
    signals: {
      cashInOutVelocity: 0.94,
      roundTripTransferFlag: true,
      counterpartyEntropy: 0.89,
      kycMismatchCount: 1
    },
    documents: [
      {
        id: "d1",
        name: "transaction_graph_snapshot.txt",
        type: "statement",
        summary: "Circular transfers across 17 beneficiaries in under 6 hours.",
        content: "Funds in from 6 accounts, fragmented out to 17 and partially returned to source chain."
      }
    ]
  },
  {
    id: "bnk-004",
    caseCode: "FRD-BNK-004",
    sector: "banking",
    product: "Loan Origination",
    title: "Personal loan with fabricated salary docs",
    claimOrTxnAmount: 1400000,
    customerName: "Sonal Verma",
    customerId: "CUS-BNK-3322",
    policyOrAccountNumber: "LN-PL-774902",
    channel: "branch",
    geo: "Jaipur",
    expectedLabel: "fraud",
    expectedFraudType: "Loan Application Fabrication",
    signals: {
      incomeMismatchPercent: 57,
      statementAnomalyScore: 0.82,
      employerVerificationFailed: true,
      bureauThinFileFlag: false
    },
    documents: [
      {
        id: "d1",
        name: "salary_slip_march.pdf",
        type: "pdf",
        summary: "Declared CTC differs materially from credited salary trend.",
        content: "Declared monthly net: INR 225,000; observed 6-month average bank credit: INR 86,400."
      }
    ]
  },
  {
    id: "bnk-005",
    caseCode: "FRD-BNK-005",
    sector: "banking",
    product: "Retail Onboarding",
    title: "Synthetic identity account opening attempt",
    claimOrTxnAmount: 0,
    customerName: "Arvind P.",
    customerId: "CUS-BNK-7003",
    policyOrAccountNumber: "AC-NEW-991027",
    channel: "mobile",
    geo: "Ahmedabad",
    expectedLabel: "fraud",
    expectedFraudType: "Synthetic Identity",
    signals: {
      kycMismatchCount: 3,
      bureauThinFileFlag: true,
      deviceReuseAcrossIdentities: true,
      geoVelocityKm: 710
    },
    documents: [
      {
        id: "d1",
        name: "kyc_bundle.pdf",
        type: "kyc",
        summary: "PAN and address verification mismatch; selfie reused across failed attempts.",
        content: "Name mismatch PAN vs Aadhaar; utility bill altered; selfie hash matches 4 rejected applications."
      }
    ]
  }
];

const ALL_CASES: FraudDemoCase[] = [...INSURANCE_CASES, ...BANKING_CASES];

function isTruthy(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return false;
}

function evaluateRule(rule: FraudRule, signals: Record<string, unknown>): FraudDetectionFinding | null {
  const evidence: string[] = [];
  let matched = 0;

  for (const signalKey of rule.signals) {
    const value = signals[signalKey];
    if (!isTruthy(value)) continue;
    matched += 1;
    evidence.push(`${signalKey}: ${String(value)}`);
  }

  const minSignalMatch = Math.max(1, Math.ceil(rule.signals.length * 0.5));
  if (matched < minSignalMatch) return null;

  const matchRatio = matched / Math.max(1, rule.signals.length);
  const scoreContribution = Math.round(rule.weight * matchRatio);

  return {
    ruleKey: rule.key,
    fraudType: rule.fraudType,
    severity: rule.severity,
    scoreContribution,
    evidence
  };
}

export function detectFraud(caseInput: FraudDemoCase): FraudDetectionResult {
  const applicableRules = FRAUD_RULE_LIBRARY.filter((rule) => rule.sector === caseInput.sector);
  const triggeredFindings = applicableRules
    .map((rule) => evaluateRule(rule, caseInput.signals))
    .filter((finding): finding is FraudDetectionFinding => Boolean(finding))
    .sort((a, b) => b.scoreContribution - a.scoreContribution);

  const severityBonus: Record<FraudDetectionFinding["severity"], number> = {
    medium: 8,
    high: 14,
    critical: 20
  };
  const rawScore = triggeredFindings.reduce(
    (sum, finding) => sum + finding.scoreContribution + severityBonus[finding.severity],
    0
  );
  const riskScore = Math.max(0, Math.min(100, rawScore));
  const riskBand: FraudDetectionResult["riskBand"] =
    riskScore >= 80 ? "critical" :
    riskScore >= 60 ? "high" :
    riskScore >= 35 ? "medium" : "low";
  const verdict: FraudDetectionResult["verdict"] =
    riskScore >= 80 ? "block" :
    riskScore >= 35 ? "review" : "allow";

  const topFinding = triggeredFindings[0];
  const summary = topFinding
    ? `${topFinding.fraudType} suspected via ${topFinding.ruleKey}. ${triggeredFindings.length} fraud pattern(s) triggered.`
    : "No strong fraud pattern triggered. Continue with normal processing.";

  return {
    caseId: caseInput.id,
    caseCode: caseInput.caseCode,
    sector: caseInput.sector,
    riskScore,
    riskBand,
    verdict,
    triggeredFindings,
    summary
  };
}

export function getFraudTaxonomy(): Record<FraudSector, string[]> {
  return {
    insurance: [
      "Duplicate Claims",
      "Provider Upcoding / Unbundling",
      "Policy Waiting Period Breach",
      "Forged Medical/Repair Documents",
      "Staged Motor Damage",
      "Identity Misrepresentation"
    ],
    banking: [
      "Account Takeover",
      "Mule Accounts & Layering",
      "Synthetic Identity",
      "Loan Document Fabrication",
      "Card Not Present Burst Fraud",
      "Internal Collusion Patterns"
    ]
  };
}

export function getFraudDemoCases(sector?: FraudSector): FraudDemoCase[] {
  if (!sector) return ALL_CASES;
  return ALL_CASES.filter((item) => item.sector === sector);
}

export function getFraudDemoCaseById(caseId: string): FraudDemoCase | null {
  return ALL_CASES.find((item) => item.id === caseId || item.caseCode === caseId) ?? null;
}

export function runFraudDemoSweep(sector?: FraudSector): Array<FraudDetectionResult & { expectedLabel: string; expectedFraudType?: string }> {
  return getFraudDemoCases(sector).map((item) => ({
    ...detectFraud(item),
    expectedLabel: item.expectedLabel,
    expectedFraudType: item.expectedFraudType
  }));
}

export function fraudCaseDigest(caseInput: FraudDemoCase): string {
  return createHash("sha256")
    .update(JSON.stringify(caseInput))
    .digest("hex")
    .slice(0, 16);
}
