import { Agent, Workflow, Case, Message, ReviewQueueItem, SecurityLog, Document, LiveEvent } from './types';

export const INDIAN_FACES: Record<string, string> = {
  'Rahul Sharma': 'https://images.unsplash.com/photo-1507152832244-10d45c7eda57?auto=format&fit=crop&q=80&w=150&h=150',
  'Pankaj Varma': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=150&h=150',
  'Sunita Deshmukh': 'https://images.unsplash.com/photo-1589156280159-27698a70f29e?auto=format&fit=crop&q=80&w=150&h=150',
  'Amit Patel': 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=150&h=150',
  'Vikram Malhotra': 'https://images.unsplash.com/photo-1480429370139-e0132c086e2a?auto=format&fit=crop&q=80&w=150&h=150',
  'Neha Reddy': 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?auto=format&fit=crop&q=80&w=150&h=150',
  'Suresh Iyer': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150&h=150',
  'Meera Nair': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150&h=150',
  'Arjun Kapoor': 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=150&h=150',
  'Priya Sharma': 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?auto=format&fit=crop&q=80&w=150&h=150',
  'Rajesh Kumar': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150&h=150',
  'Deepak Joshi': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150&h=150',
  'Anjali Gupta': 'https://images.unsplash.com/photo-1589156280159-27698a70f29e?auto=format&fit=crop&q=80&w=150&h=150',
  'Brijesh Yadav': 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=150&h=150',
  'Vikas Mehta': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150&h=150',
  'Swati Bhosle': 'https://images.unsplash.com/photo-1554151228-14d9def656e4?auto=format&fit=crop&q=80&w=150&h=150',
  'Rohit Malhotra': 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=150&h=150',
  'Shalini Verma': 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&q=80&w=150&h=150',
};
export const DEFAULT_FACE = 'https://images.unsplash.com/photo-1507152832244-10d45c7eda57?auto=format&fit=crop&q=80&w=150&h=150';

export const INDUSTRIES = [
  'Banking',
  'Insurance - Health',
  'Insurance - Motor',
  'Insurance - Property & Casualty',
  'Cross-Industry',
];

const BFSI_WORKFLOW_LIBRARY = {
  'Banking': [
    { name: 'Loan Origination', description: 'End-to-end loan processing from intake to disbursal.', agents: ['Application Intake Agent', 'KYC & Identity Agent', 'Bureau Fetch Agent', 'Financial Data Agent', 'Risk Decision Agent', 'Offer Generation Agent', 'Disbursal Agent'] },
    { name: 'Credit Underwriting', description: 'Detailed credit assessment and risk evaluation.', agents: ['Case Aggregation Agent', 'Document Consistency Agent', 'Risk Flagging Agent', 'Underwriter Assist Agent', 'Decision Agent'] },
    { name: 'Loan Collections', description: 'Managing delinquent accounts with outreach and recovery.', agents: ['Delinquency Detection Agent', 'Segmentation Agent', 'Strategy Agent', 'Outreach Agent', 'Negotiation Agent', 'Resolution Agent'] },
    { name: 'Payments (UPI / IMPS / NEFT)', description: 'Real-time payment processing and reconciliation.', agents: ['Authorization Agent', 'Fraud Detection Agent', 'Routing Agent', 'Execution Agent', 'Reconciliation Agent'] },
    { name: 'Customer Servicing', description: 'Automated customer support and request resolution.', agents: ['Intent Detection Agent', 'Context Fetch Agent', 'Validation Agent', 'Action Agent', 'Resolution Agent'] },
    { name: 'AML Transaction Monitoring', description: 'Anti-money laundering monitoring and regulatory filing.', agents: ['Transaction Monitoring Agent', 'Pattern Detection Agent', 'Risk Scoring Agent', 'Alert Generation Agent', 'Case Investigation Agent', 'Regulatory Filing Agent'] },
    { name: 'Digital Account Opening', description: 'Seamless digital onboarding for new bank accounts.', agents: ['Application Intake Agent', 'KYC Verification Agent', 'Document Validation Agent', 'Risk & Compliance Agent', 'Account Creation Agent'] },
    { name: 'Cheque & Trade Document Processing', description: 'Automated processing of physical and trade documents.', agents: ['Document Intake Agent', 'Classification Agent', 'Extraction Agent', 'Validation Agent', 'Exception Handling Agent', 'Processing Agent'] },
    { name: 'Compliance & Regulatory Reporting', description: 'Automated data aggregation and submission for compliance.', agents: ['Data Aggregation Agent', 'Validation Agent', 'Report Generation Agent', 'Submission Agent'] }
  ],
  'Insurance - Health': [
    { name: 'Cashless Claims', description: 'Real-time pre-authorization and cashless settlement.', agents: ['Pre-Auth Intake Agent', 'Policy Validation Agent', 'Medical Validation Agent', 'Fraud Detection Agent', 'Approval Agent', 'Hospital Coordination Agent', 'Settlement Agent'] },
    { name: 'Reimbursement Claims', description: 'Post-hospitalization claim processing and settlement.', agents: ['Document Intake Agent', 'Validation Agent', 'Assessment Agent', 'Decision Agent', 'Settlement Agent'] },
    { name: 'Pre-Auth Automation', description: 'Rule-based medical pre-authorization.', agents: ['Pre-Auth Intake Agent', 'Policy Check Agent', 'Medical Rule Engine Agent', 'Approval Agent', 'Hospital Notification Agent'] },
    { name: 'TPA Coordination & Settlement', description: 'Managing TPA case management and discrepancy resolution.', agents: ['TPA Case Intake Agent', 'Document Exchange Agent', 'Validation Agent', 'Discrepancy Resolution Agent', 'Settlement Agent'] },
    { name: 'Policy Issuance', description: 'End-to-end health insurance policy issuance.', agents: ['Proposal Intake Agent', 'KYC Agent', 'Medical Underwriting Agent', 'Risk Evaluation Agent', 'Policy Generation Agent'] },
    { name: 'Medical Underwriting', description: 'Specialized medical risk assessment for policy applications.', agents: ['Medical Document Intake Agent', 'Medical Risk Analysis Agent', 'Underwriter Assist Agent', 'Decision Agent'] },
    { name: 'Member Servicing', description: 'Support services for existing health insurance members.', agents: ['Intent Detection Agent', 'Policy Context Agent', 'Validation Agent', 'Action Agent', 'Resolution Agent'] },
    { name: 'Policy Explainer', description: 'Explain policy clauses in plain language with citations.', agents: ['Question Intake Agent', 'Policy Retrieval Agent', 'Clause Interpretation Agent', 'Response Generation Agent'] },
    { name: 'Benefits Advisor', description: 'Recommend best-fit health plans based on profile and expected utilization.', agents: ['Profile Intake Agent', 'Plan Modeling Agent', 'Recommendation Agent', 'Trade-off Explanation Agent'] },
    { name: 'Fraud & SIU', description: 'Special Investigation Unit workflow for fraud detection.', agents: ['Case Intake Agent', 'Pattern Detection Agent', 'Cross-Claim Analysis Agent', 'Investigation Assist Agent', 'Decision Agent'] },
    { name: 'Appeals & Grievances', description: 'Managing customer appeals and grievance resolution.', agents: ['Case Intake Agent', 'History Aggregation Agent', 'Review Agent', 'Resolution Agent'] }
  ],
  'Insurance - Motor': [
    { name: 'Motor Claims (FNOL to Settlement)', description: 'End-to-end motor claim from FNOL to settlement.', agents: ['FNOL Intake Agent', 'Policy Validation Agent', 'Damage Assessment Agent', 'Garage Coordination Agent', 'Fraud Detection Agent', 'Approval Agent', 'Settlement Agent'] },
    { name: 'Surveyor Assignment & Tracking', description: 'Automated assignment and tracking of claim surveyors.', agents: ['Survey Request Agent', 'Surveyor Assignment Agent', 'Schedule Coordination Agent', 'Report Collection Agent', 'Status Tracking Agent'] },
    { name: 'Salvage & Recovery', description: 'Managing vehicle salvage and recovery operations.', agents: ['Salvage Identification Agent', 'Vendor Assignment Agent', 'Auction / Disposal Agent', 'Recovery Tracking Agent', 'Closure Agent'] },
    { name: 'Policy Issuance (Motor)', description: 'Automated issuance of motor insurance policies.', agents: ['Vehicle Data Agent', 'Risk Pricing Agent', 'Policy Generation Agent'] },
    { name: 'Renewals', description: 'Automated renewal reminders and processing.', agents: ['Renewal Reminder Agent', 'Risk Re-evaluation Agent', 'Offer Agent', 'Payment Agent'] },
    { name: 'Renewal Risk Scoring', description: 'Predict renewal risk and trigger targeted retention strategy.', agents: ['Policy History Agent', 'Behavioral Signal Agent', 'Risk Scoring Agent', 'Retention Strategy Agent'] }
  ],
  'Insurance - Property & Casualty': [
    { name: 'Property Claims', description: 'End-to-end property damage claim processing.', agents: ['Claim Intake Agent', 'Policy Validation Agent', 'Surveyor Assignment Agent', 'Assessment Agent', 'Fraud Detection Agent', 'Decision Agent', 'Settlement Agent'] },
    { name: 'Commercial Liability Claims', description: 'Managing complex commercial liability claim workflows.', agents: ['Incident Intake Agent', 'Liability Evaluation Agent', 'Legal Coordination Agent', 'Settlement Agent'] },
    { name: 'Commercial Underwriting', description: 'Complex risk assessment for commercial policies.', agents: ['Proposal Intake Agent', 'Risk Data Aggregation Agent', 'Site Analysis Agent', 'Underwriter Assist Agent', 'Decision Agent'] },
    { name: 'Policy Issuance (Commercial)', description: 'Structuring and issuing commercial insurance policies.', agents: ['Coverage Structuring Agent', 'Pricing Agent', 'Policy Generation Agent'] },
    { name: 'Renewals & Endorsements', description: 'Managing policy renewals and endorsements for P&C.', agents: ['Renewal Agent', 'Risk Update Agent', 'Policy Update Agent'] },
    { name: 'Renewal Risk Scoring (Commercial)', description: 'Commercial portfolio renewal risk prediction and retention plays.', agents: ['Portfolio Insight Agent', 'Renewal Risk Scoring Agent', 'Retention Offer Agent', 'Broker Follow-up Agent'] }
  ],
  'Cross-Industry': [
    { name: 'Document Lifecycle Processing', description: 'Universal document intake, extraction and routing.', agents: ['Document Intake Agent', 'Classification Agent', 'Extraction Agent', 'Validation Agent', 'Exception Handling Agent', 'Routing Agent'] },
    { name: 'Regulatory Reporting (RBI / SEBI / IRDAI)', description: 'Cross-industry regulatory data aggregation and reporting.', agents: ['Data Aggregation Agent', 'Validation Agent', 'Report Generation Agent', 'Submission Agent'] },
    { name: 'Agent Performance & SLA Monitoring', description: 'Monitoring and reporting on AI agent performance and SLAs.', agents: ['Activity Tracking Agent', 'KPI Measurement Agent', 'SLA Breach Detection Agent', 'Performance Reporting Agent'] },
    { name: 'Policy Comparison', description: 'Compare multiple policy options with coverage/exclusion clarity.', agents: ['Document Intake Agent', 'Coverage Extraction Agent', 'Comparison Agent', 'Advisor Summary Agent'] },
    { name: 'AI Sales Assistant', description: 'Conversational sales support from discovery to handoff.', agents: ['Lead Conversation Agent', 'Needs Assessment Agent', 'Offer Recommendation Agent', 'Sales Handoff Agent'] },
    { name: 'Lead Qualification', description: 'Score and route leads to the right sales queue with rationale.', agents: ['Lead Intake Agent', 'Qualification Agent', 'Scoring Agent', 'Routing Agent'] },
    { name: 'Quote Follow-Up', description: 'Automated quote follow-ups with objection handling and escalation.', agents: ['Quote Tracker Agent', 'Personalized Outreach Agent', 'Objection Assist Agent', 'Sales Escalation Agent'] },
    { name: 'Cross-Sell & Upsell', description: 'Detect cross-sell triggers and orchestrate personalized offers.', agents: ['Opportunity Detection Agent', 'Offer Personalization Agent', 'Outreach Agent', 'Conversion Tracking Agent'] },
    { name: 'CRM Data Entry Automation', description: 'Auto-capture and sync customer data from email/forms/calls to CRM.', agents: ['Channel Intake Agent', 'Entity Extraction Agent', 'CRM Mapping Agent', 'Sync Agent'] },
    { name: 'Document Generation', description: 'Generate policy letters, settlement notes, and compliance docs instantly.', agents: ['Template Selection Agent', 'Data Merge Agent', 'Narrative Generation Agent', 'Distribution Agent'] },
    { name: 'Multi-System Orchestrator', description: 'Plan and execute cross-system tasks end-to-end with retries and audit.', agents: ['Planner Agent', 'Execution Orchestrator Agent', 'Retry & Exception Agent', 'Audit Trail Agent'] }
  ]
};

// ── BFSI Analytics data (consumed by Analytics.tsx) ─────────────────────────
export const BFSI_ANALYTICS = {
  loanOrigination: {
    applicationsDaily: 1047, conversionRate: 38.2, autoApproval: 58.7,
    avgTAT_hours: 4.2, baselineTAT_hours: 120, dropoffPct: 25.4,
    trend: [
      { month: 'Oct', apps: 812, approved: 312 }, { month: 'Nov', apps: 891, approved: 341 },
      { month: 'Dec', apps: 968, approved: 374 }, { month: 'Jan', apps: 1024, approved: 391 },
      { month: 'Feb', apps: 1047, approved: 401 },
    ],
  },
  aml: {
    transactionsMonitored: 203400, alertRate: 1.04, falsePositiveRate: 69.7, strsWeekly: 14,
    riskDist: [{ name: 'Low Risk', value: 68 }, { name: 'Medium Risk', value: 24 }, { name: 'High Risk', value: 8 }],
    trend: [
      { day: 'Mon', monitored: 196000, alerts: 2058 }, { day: 'Tue', monitored: 209000, alerts: 2174 },
      { day: 'Wed', monitored: 218000, alerts: 2267 }, { day: 'Thu', monitored: 204000, alerts: 2122 },
      { day: 'Fri', monitored: 221000, alerts: 2298 },
    ],
  },
  collections: {
    efficiency: 67.3, promiseToPay: 44.1, writeOffRate: 3.2,
    dpd: [
      { bucket: 'DPD 0-30', pct: 58, accounts: 14326 }, { bucket: 'DPD 31-60', pct: 24, accounts: 5932 },
      { bucket: 'DPD 61-90', pct: 11, accounts: 2717 }, { bucket: 'DPD 90+', pct: 7, accounts: 1729 },
    ],
    channelEffectiveness: [
      { channel: 'WhatsApp', contacts: 8420, converted: 3782, rate: 44.9 },
      { channel: 'Voice Call', contacts: 7110, converted: 1387, rate: 19.5 },
      { channel: 'Field Visit', contacts: 1230, converted: 512, rate: 41.6 },
      { channel: 'Email', contacts: 5800, converted: 638, rate: 11.0 },
    ],
  },
  payments: {
    dailyVolume: 412800, dailyValue_cr: 2847, successRate: 97.3,
    fraudDetectionRate: 0.82, falsePositivePct: 2.1, avgProcessingMs: 340, reconciliationMismatch: 47,
    failureReasons: [
      { reason: 'Insufficient Funds', pct: 38 }, { reason: 'Invalid Account', pct: 21 },
      { reason: 'Timeout', pct: 18 }, { reason: 'Fraud Block', pct: 14 }, { reason: 'Other', pct: 9 },
    ],
  },
  cashlessClaims: {
    preAuthDaily: 2612, approvalRate: 71.3, avgApprovalTAT_min: 47, baselineTAT_hr: 6,
    avgClaimSize_rs: 48200, fraudFlagRate: 3.2, settlementTAT_days: 2.1,
    hospitalDist: [
      { name: 'Apollo', claims: 412 }, { name: 'Fortis', claims: 387 }, { name: 'Max', claims: 341 },
      { name: 'Manipal', claims: 298 }, { name: 'AIIMS', claims: 274 }, { name: 'Others', claims: 900 },
    ],
    trend: [
      { month: 'Oct', preAuth: 2310, approved: 1651, flagged: 74 }, { month: 'Nov', preAuth: 2450, approved: 1753, flagged: 78 },
      { month: 'Dec', preAuth: 2580, approved: 1853, flagged: 83 }, { month: 'Jan', preAuth: 2612, approved: 1864, flagged: 84 },
    ],
  },
  reimbursement: {
    claimsMonthly: 8240, settledMonthly: 7106, avgProcessingDays: 4.8,
    docDeficiencyRate: 31.0, approvalRate: 74.2, costPerClaim_rs: 340,
    rejectionReasons: [
      { reason: 'Doc Deficiency', pct: 31 }, { reason: 'Policy Exclusion', pct: 24 },
      { reason: 'Duplicate', pct: 18 }, { reason: 'SI Exhausted', pct: 16 }, { reason: 'Other', pct: 11 },
    ],
  },
  motorClaims: {
    fnolDaily: 712, approvalRate: 82.4, avgSettlementDays: 6.2, baselineDays: 14,
    avgRepairCost_rs: 38400, fraudDetectionRate: 4.1, garageCoordTime_min: 38,
    trend: [
      { month: 'Oct', fnol: 641, approved: 529, fraud: 26 }, { month: 'Nov', fnol: 678, approved: 558, fraud: 28 },
      { month: 'Dec', fnol: 702, approved: 578, fraud: 29 }, { month: 'Jan', fnol: 712, approved: 587, fraud: 29 },
    ],
  },
  surveyor: { avgAssignmentMin: 23, completionTAT_days: 1.4, pendingPct: 7.2, pendingCount: 51 },
  salvage: { caseCount: 284, recoveryValuePct: 73.1, auctionSuccessRate: 81.4, avgRecoveryDays: 11.2 },
  docProcessing: {
    dailyVolume: 16200, stpRate: 82.3, extractionAccuracy: 99.1, exceptionRate: 11.0,
    avgProcessingMin: 1.2, costPerDoc_rs: 12, baselineCost_rs: 68,
    trend: [
      { day: 'Mon', processed: 14200, stp: 11682 }, { day: 'Tue', processed: 15800, stp: 13003 },
      { day: 'Wed', processed: 17100, stp: 14075 }, { day: 'Thu', processed: 16200, stp: 13333 },
      { day: 'Fri', processed: 18000, stp: 14814 },
    ],
  },
  agentPerformance: {
    avgCasesPerAgent: 47, slaBreach: 6.2, queueBacklogPct: 2.8, costPerCase_rs: 28,
    productivity: [
      { name: 'Rajesh Kumar', cases: 52, sla: 96.2, score: 94 }, { name: 'Priya Sharma', cases: 48, sla: 97.1, score: 96 },
      { name: 'Rahul Sharma', cases: 47, sla: 94.8, score: 91 }, { name: 'Amit Patel', cases: 44, sla: 93.2, score: 89 },
      { name: 'Neha Reddy', cases: 41, sla: 95.6, score: 92 },
    ],
  },
  beforeAfter: {
    tatImprovement: '6.8x faster', costReduction: '4.7x lower',
    manualInterventionDrop: '3.2x lower', errorRateDrop: '2.1x lower',
  },
};

// ── Static BFSI Review Queue ─────────────────────────────────────────────────
export const MOCK_REVIEW_QUEUE: ReviewQueueItem[] = [
  { id: 'RQ-1001', caseId: 'HA-1157', title: 'High-Value Cashless Claim — Apollo Hospital', type: 'Claims Review', assignedTo: 'Priya Sharma', status: 'pending', priority: 'critical', submittedAt: new Date(Date.now() - 45 * 60000).toISOString(), agentId: 'ag-fraud-health', confidenceScore: 64.2, reasonForReview: 'Claim ₹8,40,000 exceeds auto-approval limit; medical docs incomplete' },
  { id: 'RQ-1002', caseId: 'AML-1189', title: 'AML Alert — Structuring Pattern Detected', type: 'Claims Review', assignedTo: 'Rajesh Kumar', status: 'in-review', priority: 'critical', submittedAt: new Date(Date.now() - 90 * 60000).toISOString(), agentId: 'ag-txn-monitor', confidenceScore: 71.8, reasonForReview: 'Suspected structuring: 6 transactions below ₹2L threshold in 47 min' },
  { id: 'RQ-1003', caseId: 'FRD-1201', title: 'Fraud Flag — Lotus Medical Upcoding', type: 'Claims Review', assignedTo: 'Rajesh Kumar', status: 'in-review', priority: 'critical', submittedAt: new Date(Date.now() - 120 * 60000).toISOString(), agentId: 'ag-fraud-health', confidenceScore: 58.4, reasonForReview: 'Same patient billed for 3 procedures on same day; cross-claim anomaly' },
  { id: 'RQ-1004', caseId: 'MC-1224', title: 'Motor Claim — Borderline Total Loss', type: 'Claims Review', assignedTo: undefined, status: 'pending', priority: 'high', submittedAt: new Date(Date.now() - 180 * 60000).toISOString(), agentId: 'ag-damage', confidenceScore: 72.1, reasonForReview: 'Repair estimate 73% of IDV — borderline total loss; surveyor disagreement' },
  { id: 'RQ-1005', caseId: 'LOAN-1087', title: 'Loan Application — FOIR Exception (0.52)', type: 'New Application', assignedTo: 'Amit Patel', status: 'pending', priority: 'high', submittedAt: new Date(Date.now() - 240 * 60000).toISOString(), agentId: 'ag-risk', confidenceScore: 68.9, reasonForReview: 'FOIR at 0.52 (threshold 0.50); applicant holds 2 existing loans' },
  { id: 'RQ-1006', caseId: 'HR-1148', title: 'Reimbursement — Missing Discharge Summary', type: 'Eligibility Check', assignedTo: undefined, status: 'pending', priority: 'medium', submittedAt: new Date(Date.now() - 300 * 60000).toISOString(), agentId: 'ag-med-valid', confidenceScore: 81.3, reasonForReview: 'Discharge summary missing; other documents verified; patient consent required' },
  { id: 'RQ-1007', caseId: 'PC-1132', title: 'Property Claim — Possible Arson (Risk 87/100)', type: 'Claims Review', assignedTo: 'Priya Sharma', status: 'in-review', priority: 'critical', submittedAt: new Date(Date.now() - 360 * 60000).toISOString(), agentId: 'ag-fraud-health', confidenceScore: 53.7, reasonForReview: 'Fire claim filed 3 days post inception; arson risk score 87/100' },
  { id: 'RQ-1008', caseId: 'KYC-1198', title: 'Account Opening — Video KYC Re-attempt Needed', type: 'Eligibility Check', assignedTo: undefined, status: 'pending', priority: 'medium', submittedAt: new Date(Date.now() - 420 * 60000).toISOString(), agentId: 'ag-kyc', confidenceScore: 88.1, reasonForReview: 'Liveness check failed first attempt; second attempt scheduled' },
  { id: 'RQ-1009', caseId: 'HA-1163', title: 'Pre-Auth — Experimental Procedure (Code 87943)', type: 'Policy Comparison', assignedTo: 'Neha Reddy', status: 'pending', priority: 'high', submittedAt: new Date(Date.now() - 480 * 60000).toISOString(), agentId: 'ag-med-valid', confidenceScore: 61.5, reasonForReview: 'Procedure code 87943 flagged experimental; policy exclusion check required' },
  { id: 'RQ-1010', caseId: 'COL-1174', title: 'Collections — Moratorium Request (DPD 45)', type: 'Eligibility Check', assignedTo: 'Rahul Sharma', status: 'pending', priority: 'medium', submittedAt: new Date(Date.now() - 540 * 60000).toISOString(), agentId: 'ag-delinquency', confidenceScore: 79.2, reasonForReview: 'Customer requesting 90-day moratorium; flood impact documented; mgr approval needed' },
  { id: 'RQ-1011', caseId: 'UW-1121', title: 'Credit Underwriting — RM Override Request', type: 'New Application', assignedTo: undefined, status: 'pending', priority: 'high', submittedAt: new Date(Date.now() - 600 * 60000).toISOString(), agentId: 'ag-risk', confidenceScore: 74.6, reasonForReview: 'Risk agent recommends rejection; relationship manager requesting override' },
  { id: 'RQ-1012', caseId: 'MC-1238', title: 'Motor Claim — Customer Disputes Garage Bill', type: 'Claims Review', assignedTo: undefined, status: 'pending', priority: 'low', submittedAt: new Date(Date.now() - 720 * 60000).toISOString(), agentId: 'ag-garage-coord', confidenceScore: 83.4, reasonForReview: 'Customer disputes repair bill variance of ₹18,000; independent estimate requested' },
  { id: 'RQ-1013', caseId: 'LOAN-1093', title: 'Loan Application — Bureau Score Discrepancy', type: 'Eligibility Check', assignedTo: 'Amit Patel', status: 'approved', priority: 'medium', submittedAt: new Date(Date.now() - 24 * 3600000).toISOString(), agentId: 'ag-bureau', confidenceScore: 85.7, reasonForReview: 'CIBIL and Experian scores diverge by 68 pts; applicant claims earlier dispute resolved' },
  { id: 'RQ-1014', caseId: 'HR-1155', title: 'Reimbursement — Sum Insured Exhausted', type: 'Policy Comparison', assignedTo: 'Priya Sharma', status: 'rejected', priority: 'low', submittedAt: new Date(Date.now() - 30 * 3600000).toISOString(), agentId: 'ag-med-valid', confidenceScore: 94.1, reasonForReview: 'Sum insured ₹5L exhausted; top-up policy not purchased; claim effectively denied' },
  { id: 'RQ-1015', caseId: 'AML-1192', title: 'AML — STR Filing Awaits Compliance Sign-off', type: 'Claims Review', assignedTo: 'Rajesh Kumar', status: 'approved', priority: 'critical', submittedAt: new Date(Date.now() - 36 * 3600000).toISOString(), agentId: 'ag-txn-monitor', confidenceScore: 91.3, reasonForReview: 'STR report ready for FIU submission; compliance officer sign-off required' },
];

// ── Static BFSI Security Logs ─────────────────────────────────────────────────
export const MOCK_SECURITY_LOGS: SecurityLog[] = [
  { id: 'LOG-5001', timestamp: new Date(Date.now() - 5 * 60000).toISOString(), event: 'Agent Policy Updated', user: 'Rajesh Kumar', ipAddress: '10.0.1.42', severity: 'low', status: 'success', location: 'Mumbai, IN' },
  { id: 'LOG-5002', timestamp: new Date(Date.now() - 22 * 60000).toISOString(), event: 'Unauthorized API Access Attempt', user: 'Unknown', ipAddress: '185.220.101.47', severity: 'critical', status: 'blocked', location: 'Chisinau, MD' },
  { id: 'LOG-5003', timestamp: new Date(Date.now() - 45 * 60000).toISOString(), event: 'PHI Data Export', user: 'Priya Sharma', ipAddress: '10.0.1.31', severity: 'medium', status: 'success', location: 'Delhi, IN' },
  { id: 'LOG-5004', timestamp: new Date(Date.now() - 72 * 60000).toISOString(), event: 'Login Failed — Brute Force', user: 'amit.patel@axis.bank', ipAddress: '203.101.55.12', severity: 'high', status: 'blocked', location: 'Anonymous Proxy' },
  { id: 'LOG-5005', timestamp: new Date(Date.now() - 120 * 60000).toISOString(), event: 'Workflow Deployed to Production', user: 'Rajesh Kumar', ipAddress: '10.0.1.42', severity: 'low', status: 'success', location: 'Mumbai, IN' },
  { id: 'LOG-5006', timestamp: new Date(Date.now() - 180 * 60000).toISOString(), event: 'API Key Rotated (AML Service)', user: 'System', ipAddress: '10.0.0.1', severity: 'low', status: 'success', location: 'Internal' },
  { id: 'LOG-5007', timestamp: new Date(Date.now() - 240 * 60000).toISOString(), event: 'AML Case PDF Downloaded', user: 'Rahul Sharma', ipAddress: '10.0.1.55', severity: 'medium', status: 'success', location: 'Bangalore, IN' },
  { id: 'LOG-5008', timestamp: new Date(Date.now() - 300 * 60000).toISOString(), event: 'Role Elevated to Admin', user: 'Rajesh Kumar', ipAddress: '10.0.1.42', severity: 'high', status: 'success', location: 'Mumbai, IN' },
  { id: 'LOG-5009', timestamp: new Date(Date.now() - 360 * 60000).toISOString(), event: 'AML Alert Accessed', user: 'Priya Sharma', ipAddress: '10.0.1.31', severity: 'medium', status: 'success', location: 'Delhi, IN' },
  { id: 'LOG-5010', timestamp: new Date(Date.now() - 480 * 60000).toISOString(), event: 'Bulk Agent Import (47 agents)', user: 'System', ipAddress: '10.0.0.1', severity: 'medium', status: 'success', location: 'Internal' },
  { id: 'LOG-5011', timestamp: new Date(Date.now() - 600 * 60000).toISOString(), event: 'SSO Login — New Device', user: 'Amit Patel', ipAddress: '49.206.11.88', severity: 'medium', status: 'success', location: 'Hyderabad, IN' },
  { id: 'LOG-5012', timestamp: new Date(Date.now() - 720 * 60000).toISOString(), event: 'IRDAI Compliance Report Exported', user: 'Priya Sharma', ipAddress: '10.0.1.31', severity: 'low', status: 'success', location: 'Delhi, IN' },
];

// ── Static BFSI Documents ─────────────────────────────────────────────────────
export const MOCK_DOCUMENTS: Document[] = [
  { id: 'DOC-8001', name: 'Discharge_Summary_Meera_Kapoor_Apollo.pdf', type: 'PDF', category: 'Medical', size: '2.3 MB', uploadedBy: 'Apollo Hospital', uploadedAt: new Date(Date.now() - 2 * 3600000).toISOString(), caseId: 'HA-1157', status: 'processing', tags: ['urgent', 'cashless'] },
  { id: 'DOC-8002', name: 'AML_Transaction_Report_AC2847391.pdf', type: 'PDF', category: 'Financial', size: '0.8 MB', uploadedBy: 'System', uploadedAt: new Date(Date.now() - 3 * 3600000).toISOString(), caseId: 'AML-1189', status: 'processed', tags: ['confidential', 'aml'] },
  { id: 'DOC-8003', name: 'Aadhaar_Vikas_Mehta_Masked.jpg', type: 'JPG', category: 'KYC', size: '1.1 MB', uploadedBy: 'Vikas Mehta', uploadedAt: new Date(Date.now() - 5 * 3600000).toISOString(), caseId: 'LOAN-1087', status: 'processed', tags: ['verified', 'kyc'] },
  { id: 'DOC-8004', name: 'Salary_Slip_Vikas_Mehta_Feb2026.pdf', type: 'PDF', category: 'Financial', size: '0.4 MB', uploadedBy: 'Vikas Mehta', uploadedAt: new Date(Date.now() - 5.2 * 3600000).toISOString(), caseId: 'LOAN-1087', status: 'processed', tags: ['verified', 'income'] },
  { id: 'DOC-8005', name: 'FNOL_Photos_HondaCity_MH02AB1234.zip', type: 'PNG', category: 'Claim', size: '14.7 MB', uploadedBy: 'Swati Bhosle', uploadedAt: new Date(Date.now() - 8 * 3600000).toISOString(), caseId: 'MC-1224', status: 'processing', tags: ['motor-claim', 'fnol'] },
  { id: 'DOC-8006', name: 'Property_Survey_Report_OberoisFire.pdf', type: 'PDF', category: 'Claim', size: '5.2 MB', uploadedBy: 'Deepak Singh (Surveyor)', uploadedAt: new Date(Date.now() - 12 * 3600000).toISOString(), caseId: 'PC-1132', status: 'processed', tags: ['property', 'survey', 'arson-risk'] },
  { id: 'DOC-8007', name: 'Lotus_Medical_Bill_Disputed_FRD1201.pdf', type: 'PDF', category: 'Medical', size: '1.8 MB', uploadedBy: 'Lotus Medical Centre', uploadedAt: new Date(Date.now() - 6 * 3600000).toISOString(), caseId: 'FRD-1201', status: 'processed', tags: ['fraud', 'confidential', 'siu'] },
  { id: 'DOC-8008', name: 'IRDAI_Quarterly_Report_Q1FY26_Draft.xlsx', type: 'CSV', category: 'Financial', size: '3.4 MB', uploadedBy: 'System', uploadedAt: new Date(Date.now() - 48 * 3600000).toISOString(), caseId: undefined, status: 'pending', tags: ['compliance', 'regulatory', 'irdai'] },
  { id: 'DOC-8009', name: 'Policy_Schedule_HLT202488312_ApolloHosp.pdf', type: 'PDF', category: 'Policy', size: '0.9 MB', uploadedBy: 'System', uploadedAt: new Date(Date.now() - 72 * 3600000).toISOString(), caseId: 'HA-1157', status: 'processed', tags: ['policy', 'health'] },
  { id: 'DOC-8010', name: 'Bank_Statement_BrijeshYadav_6mo.pdf', type: 'PDF', category: 'Financial', size: '2.1 MB', uploadedBy: 'Brijesh Yadav', uploadedAt: new Date(Date.now() - 96 * 3600000).toISOString(), caseId: 'COL-1174', status: 'processed', tags: ['collections', 'financial'] },
  { id: 'DOC-8011', name: 'PAN_Card_Deepak_Joshi_Verified.jpg', type: 'JPG', category: 'KYC', size: '0.6 MB', uploadedBy: 'Deepak Joshi', uploadedAt: new Date(Date.now() - 120 * 3600000).toISOString(), caseId: 'LOAN-1042', status: 'processed', tags: ['verified', 'kyc'] },
  { id: 'DOC-8012', name: 'Garage_Repair_Invoice_MH02AB1234.pdf', type: 'PDF', category: 'Claim', size: '1.2 MB', uploadedBy: 'Sai Auto Workshop', uploadedAt: new Date(Date.now() - 144 * 3600000).toISOString(), caseId: 'MC-1238', status: 'pending', tags: ['motor', 'repair', 'dispute'] },
];

// ── Static BFSI Inbox Messages ────────────────────────────────────────────────
export const MOCK_MESSAGES: Message[] = [
  { id: 'msg-1', sender: 'Rahul Sharma', content: 'My car was in an accident on NH-48 near Gurgaon. Airbags deployed, front is completely damaged. Policy No: RQBE-MOT-2024-8832. Please guide on claim process. Sending photos.', timestamp: new Date(Date.now() - 12 * 60000).toISOString(), channel: 'whatsapp', status: 'unread', isFlagged: false, needsReview: false, riskLevel: 'low' },
  { id: 'msg-2', sender: 'Apollo Hospital – Billing Desk', content: 'Pre-Auth required for patient Meera Kapoor (Policy #HLT-2024-88312). Procedure: Left Knee Arthroplasty. Estimated cost: ₹4,80,000. Please approve urgently — surgery scheduled 9 AM tomorrow.', timestamp: new Date(Date.now() - 38 * 60000).toISOString(), channel: 'email', status: 'unread', isFlagged: false, needsReview: true, riskLevel: 'medium' },
  { id: 'msg-3', sender: 'Fraud Monitoring System', content: 'ALERT: Account AC-2847391 initiated ₹9,85,000 in 6 transactions over 47 minutes. Structuring pattern detected. Possible AML violation — immediate review required.', timestamp: new Date(Date.now() - 120 * 60000).toISOString(), channel: 'app', status: 'unread', isFlagged: true, needsReview: true, riskLevel: 'high' },
  { id: 'msg-4', sender: 'Vikas Mehta', content: 'I applied for a ₹25L home loan 3 days ago. Status still shows Processing. Can you check? My CIBIL score is 782 and all documents are ready.', timestamp: new Date(Date.now() - 180 * 60000).toISOString(), channel: 'chat', status: 'read', isFlagged: false, needsReview: false, riskLevel: 'low' },
  { id: 'msg-5', sender: 'Sunrise Hospital – TPA Desk', content: 'Claim #HA-1487 has discrepancy: billed ₹2,12,000 but policy covers only ₹1,80,000 ICU/day rate. Patient discharged. Requesting settlement approval for covered amount.', timestamp: new Date(Date.now() - 240 * 60000).toISOString(), channel: 'email', status: 'read', isFlagged: false, needsReview: true, riskLevel: 'medium' },
  { id: 'msg-6', sender: 'Brijesh Yadav', content: 'Sir I missed 2 EMIs. My shop was flooded last month. I have the insurance claim receipt. Can you arrange 90-day moratorium? Will clear everything once claim settles.', timestamp: new Date(Date.now() - 300 * 60000).toISOString(), channel: 'whatsapp', status: 'read', isFlagged: false, needsReview: false, riskLevel: 'medium' },
  { id: 'msg-7', sender: 'SIU Investigation Unit', content: 'Case FRD-1234: Lotus Medical Centre flagged for upcoding. Same patient billed 3 procedures same day. Cross-referencing with 8 other claims in last 60 days. Refer to SIU.', timestamp: new Date(Date.now() - 360 * 60000).toISOString(), channel: 'app', status: 'read', isFlagged: true, needsReview: true, riskLevel: 'high' },
  { id: 'msg-8', sender: 'Swati Bhosle', content: 'Hi, submitted motor claim for Honda City MH02-AB-1234. Accident on 22nd March. Please confirm surveyor assigned. Need car back urgently for office.', timestamp: new Date(Date.now() - 480 * 60000).toISOString(), channel: 'email', status: 'replied', isFlagged: false, needsReview: false, riskLevel: 'low' },
  { id: 'msg-9', sender: 'Compliance System', content: 'Monthly IRDAI report due in 3 days. Data aggregation 94% complete. Pending: Reinsurance treaty data from 2 branches. Please confirm before EOD.', timestamp: new Date(Date.now() - 600 * 60000).toISOString(), channel: 'app', status: 'read', isFlagged: false, needsReview: false, riskLevel: 'low' },
  { id: 'msg-10', sender: 'Fortis Hospital', content: 'Pre-Auth approved for Rohit Malhotra. Need final TDS certificate and discharge pre-approval letter before cashless component can process. Policy #HLT-2024-77211.', timestamp: new Date(Date.now() - 720 * 60000).toISOString(), channel: 'email', status: 'replied', isFlagged: false, needsReview: false, riskLevel: 'low' },
  { id: 'msg-11', sender: 'RBI Compliance Portal', content: 'URGENT: Quarterly NPA disclosure report deadline is 25-Mar-2026 17:00 IST. Status: Draft. Approve and submit immediately to avoid ₹5L/day penalty.', timestamp: new Date(Date.now() - 840 * 60000).toISOString(), channel: 'email', status: 'unread', isFlagged: true, needsReview: true, riskLevel: 'high' },
  { id: 'msg-12', sender: 'Deepak Joshi', content: 'I want to add my wife as co-borrower for LOAN-1042. She earns ₹80,000/month now. This should improve my FOIR — can we increase the loan limit to ₹35L?', timestamp: new Date(Date.now() - 1080 * 60000).toISOString(), channel: 'whatsapp', status: 'read', isFlagged: false, needsReview: false, riskLevel: 'low' },
];

// ── Static BFSI Live Events ────────────────────────────────────────────────────
export const MOCK_LIVE_EVENTS: LiveEvent[] = [
  { id: 'ev-001', timestamp: new Date(Date.now() - 30 * 1000).toISOString(), type: 'automation', title: 'Pre-Auth Approved — Apollo Hospital', description: 'Cashless pre-auth for Knee Arthroplasty auto-approved in 43 min. Settlement ₹4,80,000 initiated.', caseId: 'HA-1157', agentId: 'ag-approval', workflowId: 'wf-cashless-claims' },
  { id: 'ev-002', timestamp: new Date(Date.now() - 2 * 60000).toISOString(), type: 'escalation', title: 'AML Alert — Structuring Detected, Human Review', description: 'AC-2847391 flagged for structuring pattern. Assigned to Rajesh Kumar for investigation.', caseId: 'AML-1189', agentId: 'ag-txn-monitor', workflowId: 'wf-aml' },
  { id: 'ev-003', timestamp: new Date(Date.now() - 4 * 60000).toISOString(), type: 'completion', title: 'Loan Disbursed — ₹25L Home Loan', description: 'Vikas Mehta home loan approved and disbursed in 4.1 hours end-to-end. No human touchpoints.', caseId: 'LOAN-1087', agentId: 'ag-disbursal', workflowId: 'wf-loan-origination' },
  { id: 'ev-004', timestamp: new Date(Date.now() - 6 * 60000).toISOString(), type: 'data_extraction', title: '16,200 Documents Processed Today', description: 'Daily document batch complete. STP rate 82.3%, extraction accuracy 99.1%, cost ₹12/doc.', caseId: 'DOC-1301', agentId: 'ag-extraction', workflowId: 'wf-doc-lifecycle' },
  { id: 'ev-005', timestamp: new Date(Date.now() - 9 * 60000).toISOString(), type: 'automation', title: 'Motor FNOL — Surveyor Assigned in 21 min', description: 'Swati Bhosle Honda City claim: FNOL received, surveyor Deepak Singh assigned in 21 min.', caseId: 'MC-1224', agentId: 'ag-fnol', workflowId: 'wf-motor-claims' },
  { id: 'ev-006', timestamp: new Date(Date.now() - 12 * 60000).toISOString(), type: 'escalation', title: 'Property Claim — Arson Risk Score 87/100', description: 'PC-1132 fire claim filed 3 days post policy inception. Risk score 87/100. SIU notified.', caseId: 'PC-1132', agentId: 'ag-fraud-health', workflowId: 'wf-property-claims' },
  { id: 'ev-007', timestamp: new Date(Date.now() - 15 * 60000).toISOString(), type: 'completion', title: 'Reimbursement Settled — ₹1,12,000', description: 'Vinod Kulkarni reimbursement claim processed in 4.6 days. Amount credited to bank account.', caseId: 'HR-1148', agentId: 'ag-settlement', workflowId: 'wf-reimbursement' },
  { id: 'ev-008', timestamp: new Date(Date.now() - 18 * 60000).toISOString(), type: 'automation', title: '203K Transactions Monitored — 2,112 Alerts', description: 'Daily AML scan complete. False positive rate 69.7%. 14 STRs queued for compliance review.', caseId: 'AML-1192', agentId: 'ag-txn-monitor', workflowId: 'wf-aml' },
  { id: 'ev-009', timestamp: new Date(Date.now() - 22 * 60000).toISOString(), type: 'completion', title: 'Digital Account Opened — KYC Complete', description: 'Aarav Shah account opened in 17 minutes. Video KYC passed. IFSC: HDFC0001234 assigned.', caseId: 'KYC-1198', agentId: 'ag-kyc', workflowId: 'wf-digital-account' },
  { id: 'ev-010', timestamp: new Date(Date.now() - 28 * 60000).toISOString(), type: 'automation', title: 'Collections — WhatsApp PTP Received', description: 'Brijesh Yadav committed to pay ₹48,000 by 30-Mar. Moratorium request escalated to manager.', caseId: 'COL-1174', agentId: 'ag-outreach', workflowId: 'wf-loan-collections' },
  { id: 'ev-011', timestamp: new Date(Date.now() - 35 * 60000).toISOString(), type: 'data_extraction', title: 'Salvage Auction — 73.1% Recovery', description: 'Motor total-loss vehicle auctioned. Recovery ₹2,84,000 vs estimated ₹3,88,000 (73.1%).', caseId: 'SLV-1280', agentId: 'ag-auction', workflowId: 'wf-salvage' },
  { id: 'ev-012', timestamp: new Date(Date.now() - 42 * 60000).toISOString(), type: 'completion', title: 'IRDAI Quarterly Report Submitted On Time', description: 'Q1 FY26 IRDAI report submitted. Data accuracy 99.1%, compliance score 98.7%. No penalties.', caseId: 'DOC-1302', agentId: 'ag-submission', workflowId: 'wf-reg-reporting' },
];

// ── BFSI Agents Generator ─────────────────────────────────────────────────────
const AGENT_TYPES: Agent['type'][] = ['communication', 'processing', 'decision', 'action', 'monitoring'];
const TYPE_MAP: Record<string, Agent['type']> = {
  'Intake': 'processing', 'Fetch': 'processing', 'Extraction': 'processing', 'Import': 'processing',
  'Detection': 'monitoring', 'Monitoring': 'monitoring', 'Tracking': 'monitoring', 'SLA': 'monitoring',
  'Decision': 'decision', 'Approval': 'decision', 'Risk': 'decision', 'Underwriting': 'decision',
  'Outreach': 'communication', 'Notification': 'communication', 'Coordination': 'communication',
};
function agentType(name: string): Agent['type'] {
  for (const [k, v] of Object.entries(TYPE_MAP)) if (name.includes(k)) return v;
  return AGENT_TYPES[Math.floor(Math.random() * AGENT_TYPES.length)];
}

const HUMAN_NAMES = ['Arjun Mehta', 'Priya Sharma', 'Vikram Singh', 'Ananya Iyer', 'Rohan Gupta', 'Saanvi Reddy', 'Ishaan Malhotra', 'Diya Kapoor', 'Aarav Patel', 'Kiara Advani'];

function generateBFSIAgents(): Agent[] {
  const agents: Agent[] = [];
  let counter = 0;
  const seen = new Set<string>();
  Object.entries(BFSI_WORKFLOW_LIBRARY).forEach(([industry, workflows]) => {
    (workflows as { name: string; agents: string[] }[]).forEach(wf => {
      wf.agents.forEach(agentRole => {
        const key = `${industry}::${agentRole}`;
        if (seen.has(key)) return;
        seen.add(key);
        const id = `ag-${industry.toLowerCase().replace(/[^a-z]/g, '')}-${counter++}`;
        const recentActivity: NonNullable<Agent['recentActivity']> = Array.from({ length: 4 }, (_, i) => ({
          id: `act-${id}-${i}`,
          timestamp: new Date(Date.now() - (i + 1) * 47 * 60000).toISOString(),
          action: i % 2 === 0 ? `Processed ${wf.name} case` : `Validated document for ${industry}`,
          status: i === 3 ? 'warning' as const : 'success' as const,
          details: `${agentRole} completed workflow step for ${industry}.`,
        }));
        agents.push({
          id, name: HUMAN_NAMES[counter % HUMAN_NAMES.length], role: agentRole,
          type: agentType(agentRole), category: industry,
          description: `Specialized AI agent for ${industry} — ${agentRole.toLowerCase()}.`,
          rules: [`Comply with ${industry} regulatory requirements`, `Optimize ${agentRole} efficiency`, 'Maintain data integrity and audit trail'],
          checklist: ['Verification complete', 'Compliance check passed', 'Data logged to audit trail'],
          goals: [`Reduce ${agentRole} latency`, 'Improve accuracy and STP rate'],
          status: 'active', createdAt: new Date(Date.now() - Math.random() * 8e9).toISOString(),
          recentActivity,
        });
      });
    });
  });
  return agents;
}

export const MOCK_AGENTS: Agent[] = generateBFSIAgents();

// ── BFSI Workflows Generator ──────────────────────────────────────────────────
const WF_AUTOMATION: Record<string, number> = {
  'Payments': 97, 'Compliance & Regulatory Reporting': 95, 'Agent Performance & SLA Monitoring': 96,
  'Regulatory Reporting': 94, 'Digital Account Opening': 88, 'Motor Claims': 88, 'Customer Servicing': 84,
  'Document Lifecycle Processing': 82, 'Cheque & Trade Document Processing': 82, 'Policy Issuance (Motor)': 93,
  'Renewals': 86, 'Renewals & Endorsements': 84, 'AML Transaction Monitoring': 92,
  'Policy Issuance': 81, 'Pre-Auth Automation': 78, 'Reimbursement Claims': 74,
  'Medical Underwriting': 72, 'Property Claims': 74, 'Cashless Claims': 71, 'TPA Coordination': 69,
  'Loan Collections': 68, 'Commercial Underwriting': 68, 'Fraud & SIU': 64, 'Credit Underwriting': 76,
};

function getAutomationRate(name: string): number {
  for (const [k, v] of Object.entries(WF_AUTOMATION)) if (name.includes(k)) return v;
  return 74 + Math.floor(Math.random() * 15);
}

function generateBFSIWorkflows(): Workflow[] {
  const workflows: Workflow[] = [];
  Object.entries(BFSI_WORKFLOW_LIBRARY).forEach(([industry, templates]) => {
    (templates as { name: string; description: string; agents: string[] }[]).forEach((template, i) => {
      const id = `wf-${industry.toLowerCase().replace(/[^a-z]/g, '')}-${i}`;
      const agentIds = template.agents.map(agentName =>
        MOCK_AGENTS.find(a => a.role === agentName && a.category === industry)?.id
      ).filter(Boolean) as string[];
      workflows.push({
        id, name: template.name, category: industry, description: template.description,
        status: 'active',
        createdAt: new Date(Date.now() - Math.random() * 8e9).toISOString(),
        agentIds,
        automationRate: getAutomationRate(template.name),
        steps: [
          { id: 's0', type: 'trigger', label: 'Workflow Triggered' },
          ...template.agents.map((agentName, idx) => ({
            id: `s${idx + 1}`,
            type: (idx === template.agents.length - 1 ? 'action' : 'agent') as WorkflowStep['type'],
            label: agentName,
            assignedAgentId: MOCK_AGENTS.find(a => a.role === agentName && a.category === industry)?.id,
          })),
        ],
      });
    });
  });
  return workflows;
}

// ─ WorkflowStep type alias for generator ─
type WorkflowStep = { id: string; type: 'trigger' | 'condition' | 'agent' | 'action'; label: string; assignedAgentId?: string };

export const MOCK_WORKFLOWS: Workflow[] = generateBFSIWorkflows();

// ── BFSI Cases Generator ──────────────────────────────────────────────────────
interface CaseSeedConfig {
  category: string; wfKey: string; type: string; prefix: string;
  stages: string[]; customers: string[]; amtMin?: number; amtMax?: number;
}

const CASE_SEEDS: CaseSeedConfig[] = [
  { category: 'Banking', wfKey: 'wf-banking-0', type: 'loan-origination', prefix: 'LOAN',
    stages: ['Application Received', 'KYC in Progress', 'Bureau Fetch', 'Risk Assessment', 'Offer Generated', 'Disbursed'],
    customers: ['Vikas Mehta', 'Sunita Rao', 'Deepak Joshi', 'Kavya Nair', 'Ramesh Patel', 'Anita Bose', 'Suresh Kumar', 'Meera Iyer', 'Harsh Vardhan', 'Nisha Gupta', 'Tarun Seth', 'Arun Sinha'],
    amtMin: 200000, amtMax: 3000000 },
  { category: 'Banking', wfKey: 'wf-banking-1', type: 'credit-underwriting', prefix: 'UW',
    stages: ['Case Aggregation', 'Document Review', 'Risk Flagging', 'Underwriter Review', 'Decision'],
    customers: ['Harsh Vardhan', 'Nisha Gupta', 'Tarun Seth', 'Lalita Singh', 'Mohan Das', 'Ranjit Kaur', 'Yash Soni', 'Preeti Arora'] },
  { category: 'Banking', wfKey: 'wf-banking-2', type: 'loan-collections', prefix: 'COL',
    stages: ['DPD Identified', 'Segmented', 'Strategy Assigned', 'Outreach Sent', 'Promise to Pay', 'Resolved'],
    customers: ['Brijesh Yadav', 'Poonam Sharma', 'Kishore Nair', 'Rekha Pandit', 'Gopal Tiwari', 'Uma Reddy', 'Mangesh Patil', 'Sundar Rajan'] },
  { category: 'Banking', wfKey: 'wf-banking-3', type: 'payment', prefix: 'PAY',
    stages: ['Payment Initiated', 'Authorization', 'Fraud Check', 'Routing', 'Executed', 'Reconciled'],
    customers: ['Tech Mahindra Ltd', 'Infosys BPO', 'HCL Technologies', 'Wipro Ltd', 'TCS Digital', 'Bajaj Auto', 'Maruti Finance', 'LarsenToubro'] },
  { category: 'Banking', wfKey: 'wf-banking-5', type: 'aml-investigation', prefix: 'AML',
    stages: ['Transaction Flagged', 'Pattern Analysis', 'Risk Scored', 'Alert Raised', 'Investigation', 'STR Filed'],
    customers: ['FinCorp Pvt Ltd', 'Global Traders', 'Metro Finance', 'Alpha Capital', 'Beta Exports', 'Crescent Holdings', 'Silverton Trade'] },
  { category: 'Banking', wfKey: 'wf-banking-6', type: 'digital-account', prefix: 'KYC',
    stages: ['Application', 'Video KYC', 'Document Validation', 'Compliance Check', 'Account Created'],
    customers: ['Aarav Shah', 'Diya Patel', 'Rishabh Kapoor', 'Ishaan Mehta', 'Zara Khan', 'Aryan Fernandes', 'Kavya Joshi', 'Prateek Singh'] },
  { category: 'Insurance - Health', wfKey: 'wf-insurancehealth-0', type: 'cashless-claim', prefix: 'HA',
    stages: ['Pre-Auth Received', 'Policy Validated', 'Medical Review', 'Fraud Check', 'Approved', 'Hospital Notified', 'Settled'],
    customers: ['Rohit Malhotra', 'Shalini Verma', 'Arun Sinha', 'Geeta Mishra', 'Dhruv Chopra', 'Prachi Tiwari', 'Sachin Dubey', 'Ritika Shah', 'Meera Kapoor', 'Suresh Pillai', 'Ananda Rao', 'Lalitha Menon'],
    amtMin: 20000, amtMax: 850000 },
  { category: 'Insurance - Health', wfKey: 'wf-insurancehealth-1', type: 'reimbursement-claim', prefix: 'HR',
    stages: ['Claim Submitted', 'Document Verification', 'Assessment', 'Decision', 'Settlement'],
    customers: ['Vinod Kulkarni', 'Madhuri Desai', 'Sanjay Patil', 'Neha Joshi', 'Rajiv Bhatt', 'Sunanda Pillai', 'Prakash Mehta', 'Kavitha Iyer'],
    amtMin: 15000, amtMax: 250000 },
  { category: 'Insurance - Health', wfKey: 'wf-insurancehealth-7', type: 'fraud-investigation', prefix: 'FRD',
    stages: ['Fraud Flagged', 'Pattern Detection', 'Cross-Claim Analysis', 'SIU Investigation', 'Decision'],
    customers: ['Sunrise Hospital', 'Care Clinic', 'Lotus Medical', 'Vision Eye Care', 'Spine & Neuro', 'Ortho Plus', 'Cardio Hub'] },
  { category: 'Insurance - Motor', wfKey: 'wf-insurancemotor-0', type: 'motor-claim', prefix: 'MC',
    stages: ['FNOL Received', 'Policy Validated', 'Survey Assigned', 'Damage Assessed', 'Garage Assigned', 'Repair Approved', 'Settled'],
    customers: ['Harish Nambiar', 'Swati Bhosle', 'Rajan Menon', 'Pooja Agarwal', 'Dinesh Rawat', 'Shivani Pandey', 'Manoj Tiwari', 'Alka Srivastava', 'Nikhil Jain', 'Deepa Krishnan'],
    amtMin: 15000, amtMax: 120000 },
  { category: 'Insurance - Motor', wfKey: 'wf-insurancemotor-2', type: 'salvage', prefix: 'SLV',
    stages: ['Total Loss Declared', 'Salvage Identified', 'Vendor Assigned', 'Auction Initiated', 'Recovered'],
    customers: ['Ajay Khatri', 'Bhavna Lal', 'Chetan Soni', 'Divya Ahluwalia', 'Esha Gill', 'Faisal Ansari'] },
  { category: 'Insurance - Property & Casualty', wfKey: 'wf-insurancepropertycasualty-0', type: 'property-claim', prefix: 'PC',
    stages: ['Claim Filed', 'Policy Validated', 'Surveyor Assigned', 'Site Assessment', 'Fraud Check', 'Decision', 'Settled'],
    customers: ['Oberoi Hotels Ltd', 'Sun Pharma', 'Reliance Retail', 'Godrej Properties', 'DLF Limited', 'Prestige Estates', 'Brigade Group'],
    amtMin: 100000, amtMax: 10000000 },
  { category: 'Cross-Industry', wfKey: 'wf-crossindustry-0', type: 'document-processing', prefix: 'DOC',
    stages: ['Received', 'Classified', 'Extracted', 'Validated', 'Routed'],
    customers: ['System Upload', 'Batch Import', 'API Ingestion', 'Email Attachment', 'Portal Submission'] },
];

function generateBFSICases(): Case[] {
  const cases: Case[] = [];
  const CASE_COUNTS: Record<string, number> = { 'Insurance - Health': 22, 'Banking': 18, 'Insurance - Motor': 14, 'Insurance - Property & Casualty': 10, 'Cross-Industry': 8 };
  let counter = 1000;

  for (const cfg of CASE_SEEDS) {
    const count = CASE_COUNTS[cfg.category] || 10;
    for (let i = 0; i < count; i++) {
      const customer = cfg.customers[i % cfg.customers.length];
      const daysBack = Math.floor(Math.random() * 30);
      const created = new Date(Date.now() - daysBack * 86400000 - Math.random() * 3600000 * 12);
      const updated = new Date(created.getTime() + Math.random() * 21600000);
      const stageIdx = Math.floor(Math.random() * cfg.stages.length);
      const stage = cfg.stages[stageIdx];

      const isLast = stageIdx === cfg.stages.length - 1;
      const isFirst = stageIdx === 0;
      const isFraud = cfg.type === 'fraud-investigation' || cfg.type === 'aml-investigation';

      const status: Case['status'] = isLast ? 'completed' : isFirst ? 'new' : Math.random() > 0.87 ? 'escalated' : Math.random() > 0.7 ? 'review' : 'processing';
      const priority: Case['priority'] = isFraud ? (Math.random() > 0.4 ? 'critical' : 'high') : Math.random() > 0.85 ? 'critical' : Math.random() > 0.65 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low';
      const aiStatus: Case['aiStatus'] = status === 'escalated' ? 'needs review' : status === 'completed' ? 'complete' : Math.random() > 0.92 ? 'failed' : 'processing';

      let title = `${cfg.type.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')} — ${customer}`;
      let amtStr = '';
      if (cfg.amtMin && cfg.amtMax) {
        const amt = Math.floor(cfg.amtMin + Math.random() * (cfg.amtMax - cfg.amtMin));
        amtStr = `₹${amt.toLocaleString('en-IN')}`;
        title += ` (${amtStr})`;
      }

      cases.push({
        id: `${cfg.prefix}-${counter++}`,
        title, type: cfg.type, category: cfg.category,
        status, priority, customer,
        createdAt: created.toISOString(), updatedAt: updated.toISOString(),
        workflowId: cfg.wfKey, stage, aiStatus,
        handlingType: priority === 'critical' || status === 'escalated' ? 'human-assisted' : 'automated',
        description: `${cfg.category} — ${cfg.type.replace(/-/g, ' ')} case for ${customer}.`,
        extractedData: { customer, stage, caseType: cfg.type, amount: amtStr || 'N/A', category: cfg.category },
        insights: status === 'escalated'
          ? [{ id: 'i1', type: 'warning', title: 'Human Review Required', description: 'Confidence score below threshold or fraud flag raised.' }]
          : isFraud ? [{ id: 'i1', type: 'error', title: 'Fraud Indicator Detected', description: 'Pattern matched known fraud signature. SIU notified.' }]
          : priority === 'critical' ? [{ id: 'i1', type: 'error', title: 'Critical Priority', description: 'Case exceeds auto-approval thresholds — immediate action required.' }]
          : [],
        documents: [
          { id: `d${counter}-1`, name: `${cfg.prefix}_${counter}_main.pdf`, type: 'PDF', status: 'processed' },
          { id: `d${counter}-2`, name: `${cfg.prefix}_${counter}_kyc.jpg`, type: 'JPG', status: Math.random() > 0.7 ? 'pending' : 'processed' },
        ],
        timeline: [
          { id: 't1', timestamp: created.toISOString(), action: 'Case Created', type: 'system', actor: 'System' },
          { id: 't2', timestamp: updated.toISOString(), action: `Stage updated: ${stage}`, type: 'agent', actor: 'AI Agent' },
        ],
      });
    }
  }
  return cases;
}

export const MOCK_CASES: Case[] = generateBFSICases();
