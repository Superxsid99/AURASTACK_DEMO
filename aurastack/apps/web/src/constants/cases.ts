import { Case } from '../types/case';

export const INITIAL_CASES: Case[] = [
  {
    id: 'PAT-1',
    title: "Heart Disease: Patient 1",
    description: "45-year-old Female treated for Heart Disease via Angioplasty. Cost: $15,000. Length of Stay: 5 days. Outcome: Recovered.",
    category: 'MEDICAL',
    status: 'STABLE',
    execution_status: 'COMPLETED',
    priority: 'MEDIUM',
    type: 'CLAIM',
    department: 'CLAIMS',
    claimant: {
      name: 'Jane Smith',
      dob: '1981-05-12',
      gender: 'FEMALE',
      id: 'CLM-001',
      email: 'jane.smith@example.com'
    },
    financials: {
      total_billed: 15000,
      total_paid: 12000,
      reserve_amount: 3000,
      currency: 'USD'
    },
    dates: {
      incident_date: '2026-03-20T09:00:00Z',
      service_date: '2026-03-20T09:00:00Z',
      closed_at: '2026-03-30T10:00:00Z'
    },
    policy: {
      policy_number: 'POL-88221',
      policy_type: 'PPO Gold',
      carrier: 'AuraHealth Insurance'
    },
    sla: {
      due_date: '2026-03-27T09:00:00Z',
      status: 'ON_TRACK'
    },
    created_at: '2026-03-20T09:00:00Z',
    last_updated: '2026-03-30T10:00:00Z',
    assigned_to: 'Medical-Data-Extractor',
    workflow_id: 'claims_mgmt_v1',
    current_node_id: 'end',
    risk_score: 4.0,
    summary: "Standard angioplasty procedure. Claim processed and settled.",
    ai_insights: [
      {
        id: 'ins-1',
        type: 'COMPLIANCE',
        title: 'Policy Alignment',
        description: 'Procedure codes (CPT 92920) perfectly align with PPO Gold coverage parameters.',
        confidence: 0.99,
        agent_id: 'Medical-Data-Extractor',
        timestamp: '2026-03-20T10:00:00Z'
      },
      {
        id: 'ins-2',
        type: 'RISK',
        title: 'Low Recurrence Risk',
        description: 'Patient history and post-op markers indicate high probability of stable recovery.',
        confidence: 0.92,
        agent_id: 'Clinical-Risk-Modeler',
        timestamp: '2026-03-21T14:00:00Z'
      }
    ],
    risk_markers: [
      { id: 'rm-1', type: 'Clinical Consistency', status: 'INFO', description: 'All lab results match expected post-angioplasty ranges.' },
      { id: 'rm-2', type: 'Provider History', status: 'INFO', description: 'Dr. Miller has a 100% success rate with this patient profile.' }
    ],
    document_extraction_status: [
      { id: 'ext-1', type: 'Medical Records', progress: 100, status: 'COMPLETED' },
      { id: 'ext-2', type: 'Identity Proof', progress: 100, status: 'COMPLETED' }
    ],
    audit_trail: [
      {
        id: 'aud-1',
        timestamp: '2026-03-20T09:00:00Z',
        actor: { id: 'aurastack_core', name: 'Aurastack Core', type: 'system' },
        action: 'Case Intake & Registration',
        signature: 'sig_v1_7a2b3c4d',
        duration_ms: 120
      },
      {
        id: 'aud-2',
        timestamp: '2026-03-20T14:00:00Z',
        actor: { id: 'dr_miller', name: 'Dr. Sarah Miller', type: 'human', role: 'Physician' },
        action: 'Clinical Procedure: Angioplasty',
        signature: 'sig_v1_9e8f7g6h',
        duration_ms: 3600000
      }
    ],
    documents: [
      { 
        id: 'DOC-101', 
        name: 'Cardiac_Report_P1.pdf', 
        type: 'Medical Records', 
        status: 'VERIFIED', 
        uploaded_at: '2026-03-20T09:05:00Z', 
        size: '1.2 MB',
        extraction_data: {
          patient_name: 'Jane Smith',
          dob: '1981-05-12',
          procedure: 'Angioplasty',
          facility: 'Aura General Hospital',
          physician: 'Dr. Sarah Miller'
        }
      }
    ],
    timeline: [
      { title: 'Admission', description: 'Patient admitted for cardiac procedure', timestamp: '2026-03-20T09:00:00Z', type: 'system' },
      { title: 'Procedure', description: 'Angioplasty performed successfully', timestamp: '2026-03-20T14:00:00Z', type: 'human' },
      { title: 'Claim Filed', description: 'Insurance claim initiated for $15,000', timestamp: '2026-03-21T10:00:00Z', type: 'system' }
    ]
  },
  {
    id: 'PAT-2',
    title: "Diabetes: Patient 2",
    description: "60-year-old Male treated for Diabetes via Insulin Therapy. Cost: $2,000. Readmission: Yes. Outcome: Stable.",
    category: 'MEDICAL',
    status: 'CRITICAL',
    execution_status: 'IN_PROGRESS',
    priority: 'HIGH',
    type: 'CLAIM',
    department: 'CLAIMS',
    claimant: {
      name: 'John Doe',
      dob: '1966-03-28',
      gender: 'MALE',
      id: 'CLM-002',
      email: 'john.doe@example.com'
    },
    financials: {
      total_billed: 2000,
      total_paid: 0,
      reserve_amount: 2000,
      currency: 'USD'
    },
    dates: {
      incident_date: '2026-03-28T11:00:00Z',
      service_date: '2026-03-28T11:00:00Z'
    },
    policy: {
      policy_number: 'POL-99112',
      policy_type: 'HMO Basic',
      carrier: 'AuraHealth Insurance'
    },
    sla: {
      due_date: '2026-03-31T11:00:00Z',
      status: 'AT_RISK'
    },
    created_at: '2026-03-28T11:00:00Z',
    last_updated: '2026-03-30T08:30:00Z',
    assigned_to: 'Clinical-Risk-Modeler',
    workflow_id: 'claims_mgmt_v1',
    current_node_id: 'fraud',
    risk_score: 7.8,
    summary: "Patient readmitted within 30 days. High risk of complications. Fraud sentinel monitoring claim patterns.",
    ai_insights: [
      {
        id: 'ins-pat2-1',
        type: 'RISK',
        title: 'Readmission Risk',
        description: 'Patient readmitted within 30 days of previous discharge. High probability of diabetic ketoacidosis.',
        confidence: 0.94,
        agent_id: 'Clinical-Risk-Modeler',
        timestamp: '2026-03-29T09:00:00Z'
      },
      {
        id: 'ins-pat2-2',
        type: 'ANOMALY',
        title: 'Billing Pattern',
        description: 'Multiple insulin prescriptions from different providers flagged for review.',
        confidence: 0.88,
        agent_id: 'Fraud-Sentinel',
        timestamp: '2026-03-30T08:30:00Z'
      }
    ],
    risk_markers: [
      { id: 'rm-pat2-1', type: 'Clinical Risk', status: 'CRITICAL', description: 'Patient shows signs of severe insulin resistance.' },
      { id: 'rm-pat2-2', type: 'Fraud Risk', status: 'WARNING', description: 'Unusual prescription frequency detected.' }
    ],
    document_extraction_status: [
      { id: 'ext-pat2-1', type: 'Medical History', progress: 100, status: 'COMPLETED' },
      { id: 'ext-pat2-2', type: 'Lab Results', progress: 45, status: 'IN_PROGRESS' }
    ],
    audit_trail: [
      {
        id: 'aud-3',
        timestamp: '2026-03-28T11:00:00Z',
        actor: { id: 'aurastack_core', name: 'Aurastack Core', type: 'system' },
        action: 'Readmission Alert Triggered',
        signature: 'sig_v1_1a2b3c4d',
        duration_ms: 45
      }
    ],
    documents: [
      { id: 'DOC-201', name: 'Insulin_Therapy_Log.docx', type: 'Medical History', status: 'PENDING', uploaded_at: '2026-03-28T11:30:00Z', size: '45 KB' }
    ],
    timeline: [
      { title: 'Readmission', description: 'Patient readmitted for diabetic complications', timestamp: '2026-03-28T11:00:00Z', type: 'system' },
      { title: 'Risk Assessment', description: 'Clinical risk model flagged high readmission probability', timestamp: '2026-03-29T09:00:00Z', type: 'ai' }
    ]
  },
  {
    id: 'AUTO-1',
    title: "Collision: 2023 Tesla Model 3",
    description: "Front-end collision at intersection. Airbags deployed. Estimated repair: $12,500.",
    category: 'AUTO',
    status: 'IN_REVIEW',
    execution_status: 'IN_PROGRESS',
    priority: 'HIGH',
    type: 'CLAIM',
    department: 'CLAIMS',
    claimant: {
      name: 'Michael Chen',
      dob: '1992-11-15',
      gender: 'MALE',
      id: 'CLM-AUTO-001',
      email: 'm.chen@example.com'
    },
    financials: {
      total_billed: 12500,
      total_paid: 0,
      reserve_amount: 15000,
      currency: 'USD'
    },
    dates: {
      incident_date: '2026-03-29T14:30:00Z',
      service_date: '2026-03-30T09:00:00Z'
    },
    policy: {
      policy_number: 'AUTO-77119',
      policy_type: 'Comprehensive',
      carrier: 'AuraDrive Insurance'
    },
    sla: {
      due_date: '2026-04-01T14:30:00Z',
      status: 'ON_TRACK'
    },
    created_at: '2026-03-29T15:00:00Z',
    last_updated: '2026-03-30T10:00:00Z',
    assigned_to: 'Auto-Damage-Estimator',
    workflow_id: 'auto_claims_v1',
    current_node_id: 'estimate',
    risk_score: 3.2,
    summary: "Severe front-end damage. AI analyzing photos for structural integrity issues.",
    ai_insights: [
      {
        id: 'ins-auto1-1',
        type: 'RISK',
        title: 'Structural Integrity',
        description: 'AI photo analysis suggests potential frame damage not visible in initial inspection.',
        confidence: 0.91,
        agent_id: 'Auto-Damage-Estimator',
        timestamp: '2026-03-30T10:00:00Z'
      }
    ],
    risk_markers: [
      { id: 'rm-auto1-1', type: 'Damage Severity', status: 'WARNING', description: 'High-impact collision detected via telemetry.' }
    ],
    document_extraction_status: [
      { id: 'ext-auto1-1', type: 'Accident Photos', progress: 100, status: 'COMPLETED' },
      { id: 'ext-auto1-2', type: 'Police Report', progress: 0, status: 'PENDING' }
    ],
    documents: [
      { id: 'DOC-A1', name: 'Accident_Photos.zip', type: 'Photos', status: 'VERIFIED', uploaded_at: '2026-03-29T15:30:00Z', size: '24 MB' },
      { id: 'DOC-A2', name: 'Police_Report.pdf', type: 'Report', status: 'PENDING', uploaded_at: '2026-03-30T08:00:00Z', size: '1.1 MB' }
    ],
    timeline: [
      { title: 'Accident Reported', description: 'Claim initiated via mobile app', timestamp: '2026-03-29T15:00:00Z', type: 'system' },
      { title: 'Photo Upload', description: 'Damage photos received', timestamp: '2026-03-29T15:30:00Z', type: 'system' }
    ]
  },
  {
    id: 'PROP-1',
    title: "Water Damage: Residential",
    description: "Burst pipe in kitchen causing extensive hardwood floor damage. Estimated: $8,500.",
    category: 'PROPERTY',
    status: 'ELEVATED',
    execution_status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    type: 'CLAIM',
    department: 'CLAIMS',
    claimant: {
      name: 'Sarah Wilson',
      dob: '1975-02-20',
      gender: 'FEMALE',
      id: 'CLM-PROP-001',
      email: 's.wilson@example.com'
    },
    financials: {
      total_billed: 8500,
      total_paid: 0,
      reserve_amount: 10000,
      currency: 'USD'
    },
    dates: {
      incident_date: '2026-03-28T08:00:00Z',
      service_date: '2026-03-28T10:00:00Z'
    },
    policy: {
      policy_number: 'HOME-11223',
      policy_type: 'Homeowners H3',
      carrier: 'AuraHome Insurance'
    },
    sla: {
      due_date: '2026-03-31T08:00:00Z',
      status: 'ON_TRACK'
    },
    created_at: '2026-03-28T09:00:00Z',
    last_updated: '2026-03-30T11:00:00Z',
    assigned_to: 'Property-Adjuster-AI',
    workflow_id: 'property_claims_v1',
    current_node_id: 'adjust',
    risk_score: 2.1,
    summary: "Water mitigation team on site. AI reviewing contractor estimates.",
    ai_insights: [
      {
        id: 'ins-prop1-1',
        type: 'OPPORTUNITY',
        title: 'Mitigation Efficiency',
        description: 'Early intervention by water team likely reduced total claim cost by 15%.',
        confidence: 0.89,
        agent_id: 'Property-Adjuster-AI',
        timestamp: '2026-03-30T11:00:00Z'
      }
    ],
    risk_markers: [
      { id: 'rm-prop1-1', type: 'Environmental Risk', status: 'INFO', description: 'Mold risk assessed as low due to rapid drying.' }
    ],
    document_extraction_status: [
      { id: 'ext-prop1-1', type: 'Contractor Estimate', progress: 60, status: 'IN_PROGRESS' }
    ],
    timeline: [
      { title: 'Claim Filed', description: 'Emergency water damage reported', timestamp: '2026-03-28T09:00:00Z', type: 'system' }
    ]
  },
  {
    id: 'KYC-1',
    title: "KYC Onboarding: Global Tech Corp",
    description: "Corporate entity onboarding. Multi-jurisdictional verification required for 14 beneficial owners.",
    category: 'GENERAL',
    status: 'ELEVATED',
    execution_status: 'IN_PROGRESS',
    priority: 'HIGH',
    type: 'KYC',
    department: 'KYC_ONBOARDING',
    claimant: {
      name: 'Global Tech Corp',
      dob: '2010-01-01',
      gender: 'OTHER',
      id: 'CORP-001',
      email: 'compliance@globaltech.com'
    },
    financials: {
      total_billed: 0,
      total_paid: 0,
      reserve_amount: 0,
      currency: 'USD'
    },
    dates: {
      incident_date: '2026-03-25T09:00:00Z',
      service_date: '2026-03-25T09:00:00Z'
    },
    policy: {
      policy_number: 'N/A',
      policy_type: 'Commercial General Liability',
      carrier: 'Aura Commercial'
    },
    sla: {
      due_date: '2026-04-05T09:00:00Z',
      status: 'ON_TRACK'
    },
    created_at: '2026-03-25T09:00:00Z',
    last_updated: '2026-03-30T14:00:00Z',
    assigned_to: 'KYC-Verification-Agent',
    workflow_id: 'kyc_onboarding_v1',
    current_node_id: 'verification',
    risk_score: 6.5,
    summary: "Complex corporate structure. AI extracting ownership data from international registries.",
    ai_insights: [
      {
        id: 'ins-kyc1-1',
        type: 'COMPLIANCE',
        title: 'Ownership Mapping',
        description: 'Complex multi-layered ownership structure identified. 3 UBOs in high-risk jurisdictions.',
        confidence: 0.95,
        agent_id: 'KYC-Verification-Agent',
        timestamp: '2026-03-26T11:00:00Z'
      }
    ],
    risk_markers: [
      { id: 'rm-kyc1-1', type: 'Jurisdiction Risk', status: 'WARNING', description: 'Entities registered in offshore tax havens.' }
    ],
    document_extraction_status: [
      { id: 'ext-kyc1-1', type: 'Corporate Registry', progress: 100, status: 'COMPLETED' },
      { id: 'ext-kyc1-2', type: 'UBO Identity', progress: 30, status: 'IN_PROGRESS' }
    ],
    timeline: [
      { title: 'Application Received', description: 'Onboarding request initiated', timestamp: '2026-03-25T09:00:00Z', type: 'system' },
      { title: 'Entity Extraction', description: 'AI identified 14 UBOs from provided documents', timestamp: '2026-03-26T11:00:00Z', type: 'ai' }
    ]
  },
  {
    id: 'UW-1',
    title: "Underwriting: Life Policy - David Miller",
    description: "High-value life insurance application ($2M). Medical history review and lifestyle assessment in progress.",
    category: 'LIFE',
    status: 'IN_REVIEW',
    execution_status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    type: 'UNDERWRITING',
    department: 'UNDERWRITING',
    claimant: {
      name: 'David Miller',
      dob: '1978-08-14',
      gender: 'MALE',
      id: 'CUST-UW-001',
      email: 'd.miller@example.com'
    },
    financials: {
      total_billed: 2000000,
      total_paid: 0,
      reserve_amount: 0,
      currency: 'USD'
    },
    dates: {
      incident_date: '2026-03-27T10:00:00Z',
      service_date: '2026-03-27T10:00:00Z'
    },
    policy: {
      policy_number: 'PENDING-UW-1',
      policy_type: 'Term Life 20yr',
      carrier: 'AuraLife'
    },
    sla: {
      due_date: '2026-04-10T10:00:00Z',
      status: 'ON_TRACK'
    },
    created_at: '2026-03-27T10:00:00Z',
    last_updated: '2026-03-30T15:30:00Z',
    assigned_to: 'Medical-Underwriter-AI',
    workflow_id: 'underwriting_v1',
    current_node_id: 'medical_review',
    risk_score: 4.2,
    summary: "Standard medical exam completed. AI analyzing lab results for potential risk factors.",
    ai_insights: [
      {
        id: 'ins-uw1-1',
        type: 'RISK',
        title: 'Lifestyle Assessment',
        description: 'Social media and public record analysis confirms active lifestyle, aligning with application.',
        confidence: 0.88,
        agent_id: 'Medical-Underwriter-AI',
        timestamp: '2026-03-30T15:30:00Z'
      }
    ],
    risk_markers: [
      { id: 'rm-uw1-1', type: 'Health Risk', status: 'INFO', description: 'Lab results within normal range for age group.' }
    ],
    document_extraction_status: [
      { id: 'ext-uw1-1', type: 'Medical Exam', progress: 100, status: 'COMPLETED' },
      { id: 'ext-uw1-2', type: 'Lab Results', progress: 100, status: 'COMPLETED' }
    ],
    timeline: [
      { title: 'Application Submitted', description: 'Life insurance application received', timestamp: '2026-03-27T10:00:00Z', type: 'system' },
      { title: 'Medical Exam', description: 'Paramedical exam results uploaded', timestamp: '2026-03-29T09:00:00Z', type: 'human' }
    ]
  },
  {
    id: 'COMP-1',
    title: "Compliance Audit: Q1 Data Privacy",
    description: "Quarterly audit of data handling procedures in the Claims department. SOC2 compliance check.",
    category: 'GENERAL',
    status: 'STABLE',
    execution_status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    type: 'COMPLIANCE',
    department: 'COMPLIANCE',
    claimant: {
      name: 'Internal Audit',
      dob: '2020-01-01',
      gender: 'OTHER',
      id: 'AUDIT-001',
      email: 'compliance@aurastack.com'
    },
    financials: {
      total_billed: 0,
      total_paid: 0,
      reserve_amount: 0,
      currency: 'USD'
    },
    dates: {
      incident_date: '2026-03-01T00:00:00Z',
      service_date: '2026-03-01T00:00:00Z'
    },
    policy: {
      policy_number: 'N/A',
      policy_type: 'Internal Audit',
      carrier: 'AuraStack'
    },
    sla: {
      due_date: '2026-03-31T23:59:59Z',
      status: 'AT_RISK'
    },
    created_at: '2026-03-01T09:00:00Z',
    last_updated: '2026-03-30T16:00:00Z',
    assigned_to: 'Compliance-Officer-AI',
    workflow_id: 'compliance_audit_v1',
    current_node_id: 'reporting',
    risk_score: 1.5,
    summary: "95% of controls verified. Final report generation in progress.",
    ai_insights: [
      {
        id: 'ins-comp1-1',
        type: 'COMPLIANCE',
        title: 'Control Verification',
        description: '95% of SOC2 controls verified through automated evidence collection.',
        confidence: 0.99,
        agent_id: 'Compliance-Officer-AI',
        timestamp: '2026-03-30T16:00:00Z'
      }
    ],
    risk_markers: [
      { id: 'rm-comp1-1', type: 'Audit Integrity', status: 'INFO', description: 'All evidence trails are cryptographically signed.' }
    ],
    document_extraction_status: [
      { id: 'ext-comp1-1', type: 'Audit Evidence', progress: 100, status: 'COMPLETED' },
      { id: 'ext-comp1-2', type: 'Final Report', progress: 95, status: 'IN_PROGRESS' }
    ],
    timeline: [
      { title: 'Audit Started', description: 'Q1 Compliance audit initiated', timestamp: '2026-03-01T09:00:00Z', type: 'system' }
    ]
  }
];

// Helper to generate more cases
const generateCases = (count: number, startId: number): Case[] => {
  const categories: Case['category'][] = ['MEDICAL', 'AUTO', 'PROPERTY', 'LIFE', 'GENERAL'];
  const types: Case['type'][] = ['CLAIM', 'UNDERWRITING', 'KYC', 'COMPLIANCE', 'RENEWAL', 'POLICY_SERVICING'];
  const priorities: Case['priority'][] = ['LOW', 'MEDIUM', 'HIGH'];
  const statuses: Case['status'][] = ['STABLE', 'ELEVATED', 'CRITICAL', 'IN_REVIEW'];
  const executionStatuses: Case['execution_status'][] = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];
  const departments: Case['department'][] = [
    'CLAIMS', 
    'POLICY_ISSUANCE', 
    'KYC_ONBOARDING', 
    'UNDERWRITING', 
    'POLICY_SERVICING', 
    'RENEWALS', 
    'COMPLIANCE'
  ];
  
  const names = ['Liam', 'Noah', 'Oliver', 'James', 'Elijah', 'William', 'Henry', 'Lucas', 'Benjamin', 'Theodore', 'Emma', 'Charlotte', 'Amelia', 'Sophia', 'Mia', 'Evelyn', 'Harper', 'Luna', 'Abigail', 'Gianna'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];

  const cases: Case[] = [];

  for (let i = 0; i < count; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const executionStatus = executionStatuses[Math.floor(Math.random() * executionStatuses.length)];
    const department = departments[Math.floor(Math.random() * departments.length)];
    const name = names[Math.floor(Math.random() * names.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const fullName = `${name} ${lastName}`;
    
    const id = `${category.substring(0, 3)}-${startId + i}`;
    const amount = Math.floor(Math.random() * 50000) + 500;
    
    cases.push({
      id,
      title: `${category.charAt(0) + category.slice(1).toLowerCase()} ${type.toLowerCase()}: ${fullName}`,
      description: `Automated ${category.toLowerCase()} ${type.toLowerCase()} for ${fullName}. Initial assessment indicates ${priority.toLowerCase()} priority.`,
      category,
      status,
      execution_status: executionStatus,
      priority,
      type,
      department,
      claimant: {
        name: fullName,
        dob: `19${Math.floor(Math.random() * 40) + 50}-01-01`,
        gender: Math.random() > 0.5 ? 'MALE' : 'FEMALE',
        id: `CLM-GEN-${startId + i}`,
        email: `${name.toLowerCase()}.${lastName.toLowerCase()}@example.com`
      },
      financials: {
        total_billed: amount,
        total_paid: executionStatus === 'COMPLETED' ? amount * 0.8 : 0,
        reserve_amount: amount * 0.2,
        currency: 'USD'
      },
      dates: {
        incident_date: '2026-03-25T10:00:00Z',
        service_date: '2026-03-26T10:00:00Z',
        closed_at: executionStatus === 'COMPLETED' ? '2026-03-30T10:00:00Z' : undefined
      },
      policy: {
        policy_number: `POL-${Math.floor(Math.random() * 90000) + 10000}`,
        policy_type: 'Standard Plus',
        carrier: 'Aura Insurance Group'
      },
      sla: {
        due_date: '2026-04-05T10:00:00Z',
        status: Math.random() > 0.8 ? 'AT_RISK' : 'ON_TRACK'
      },
      created_at: '2026-03-25T10:00:00Z',
      last_updated: '2026-03-30T10:00:00Z',
      risk_score: Math.floor(Math.random() * 100) / 10,
      ai_insights: [
        {
          id: `ins-${startId + i}-1`,
          type: Math.random() > 0.5 ? 'RISK' : 'COMPLIANCE',
          title: 'Automated Insight',
          description: `AI analysis suggests ${priority.toLowerCase()} priority for this ${type.toLowerCase()} case in ${department.toLowerCase()}.`,
          confidence: 0.85 + Math.random() * 0.1,
          agent_id: 'AI-Analyst',
          timestamp: '2026-03-26T10:00:00Z'
        }
      ],
      risk_markers: [
        { id: `rm-${startId + i}-1`, type: 'Pattern Analysis', status: Math.random() > 0.8 ? 'WARNING' : 'INFO', description: 'No significant anomalies detected in initial scan.' }
      ],
      document_extraction_status: [
        { id: `ext-${startId + i}-1`, type: 'Identity Proof', progress: 100, status: 'COMPLETED' },
        { id: `ext-${startId + i}-2`, type: 'Application Form', progress: 85, status: 'IN_PROGRESS' }
      ],
      timeline: [
        { title: 'Intake', description: 'Case registered in system', timestamp: '2026-03-25T10:00:00Z', type: 'system' }
      ]
    });
  }
  
  return cases;
};

// Add 71 more cases to reach 75 total
INITIAL_CASES.push(...generateCases(71, 100));
