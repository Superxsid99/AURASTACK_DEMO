import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Case, Message, Agent, Workflow, UserProfile, ReviewQueueItem, SecurityLog, Document, LiveEvent } from '../types';
import { 
  MOCK_CASES, 
  MOCK_MESSAGES, 
  MOCK_AGENTS, 
  MOCK_WORKFLOWS, 
  INDIAN_FACES,
  INDUSTRIES,
  MOCK_REVIEW_QUEUE,
  MOCK_SECURITY_LOGS,
  MOCK_DOCUMENTS,
  MOCK_LIVE_EVENTS
} from '../constants';
import { getCases, getAgents, getWorkflows, type ApiCase, type ApiAgent, type ApiWorkflow } from '../lib/api';

type DomainName = (typeof INDUSTRIES)[number];

function deriveCaseCategory(caseType: string): string {
  const normalized = caseType.toLowerCase();
  if (['loan', 'credit', 'collection', 'payment', 'aml', 'kyc', 'account', 'cheque', 'trade'].some(t => normalized.includes(t))) return 'Banking';
  if (['health', 'cashless', 'reimbursement', 'pre-auth', 'medical', 'tpa'].some(t => normalized.includes(t))) return 'Insurance - Health';
  if (['motor', 'fnol', 'surveyor', 'salvage', 'garage', 'vehicle'].some(t => normalized.includes(t))) return 'Insurance - Motor';
  if (['property', 'casualty', 'liability', 'commercial', 'endorsement'].some(t => normalized.includes(t))) return 'Insurance - Property & Casualty';
  return 'Cross-Industry';
}

function getRunOutput(run: ApiCase['agentRuns'][number] | undefined): Record<string, unknown> {
  if (!run) return {};
  if (run.outputJson && typeof run.outputJson === 'object') return run.outputJson;
  if (typeof run.output === 'string' && run.output.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(run.output);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // ignore parse errors
    }
  }
  return {};
}

function findLatestRun(caseRuns: ApiCase['agentRuns'], stepNames: string[]): ApiCase['agentRuns'][number] | undefined {
  const normalized = new Set(stepNames.map((name) => name.toLowerCase()));
  return caseRuns.find((run) => normalized.has((run.step ?? '').toLowerCase()));
}

function valueToDisplay(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not detected';
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function normalizeStepName(name: string): string {
  return name.trim().toLowerCase();
}

function computeWorkflowProgress(caseType: string, agentRuns: ApiCase['agentRuns']) {
  const expectedByType: Record<string, string[]> = {
    health: ['Email Intake', 'Claim Classification', 'Document OCR', 'Data Extraction', 'Policy Lookup', 'Validation', 'Decision', 'Notify Customer'],
    motor: ['Email Intake', 'Claim Classification', 'Document OCR', 'Data Extraction', 'Policy Lookup', 'Validation', 'Decision', 'Notify Customer'],
    property: ['Email Intake', 'Claim Classification', 'Document OCR', 'Data Extraction', 'Policy Lookup', 'Validation', 'Decision', 'Notify Customer'],
    banking: ['Email Intake', 'Claim Classification', 'Document OCR', 'Data Extraction', 'Validation', 'Decision', 'Notify Customer'],
  };
  const expected = expectedByType[caseType.toLowerCase()] ?? ['Email Intake', 'Claim Classification', 'Document OCR', 'Data Extraction', 'Validation', 'Decision', 'Notify Customer'];
  const expectedSet = new Set(expected.map(normalizeStepName));
  const perStep = new Map<string, string>();

  for (const run of agentRuns) {
    const name = normalizeStepName(run.step ?? '');
    if (!expectedSet.has(name)) continue;
    const status = (run.status ?? '').toLowerCase();
    const prev = perStep.get(name);
    // Prefer completed > running > failed > started
    const rank = (s?: string) => s?.includes('completed') || s?.includes('success') ? 4 : s?.includes('running') ? 3 : s?.includes('fail') || s?.includes('error') ? 2 : s?.includes('start') ? 1 : 0;
    if (!prev || rank(status) >= rank(prev)) {
      perStep.set(name, status);
    }
  }

  const completedSteps = Array.from(perStep.values()).filter((s) => s.includes('completed') || s.includes('success')).length;
  const observedSteps = perStep.size;
  const totalSteps = Math.max(expected.length, observedSteps, completedSteps);
  const runningEntry = Array.from(perStep.entries()).find(([, s]) => s.includes('running'));
  const runningStep = runningEntry ? expected.find((e) => normalizeStepName(e) === runningEntry[0]) : undefined;
  const workflowProgress = Math.max(0, Math.min(100, Math.round((completedSteps / Math.max(1, totalSteps)) * 100)));
  return { workflowProgress, completedSteps, totalSteps, runningStep };
}

// Map backend case → frontend Case type
function apiCaseToCase(c: ApiCase): Case {
  const statusMap: Record<string, Case['status']> = {
    new: 'new', open: 'new', in_progress: 'processing', processing: 'processing',
    review: 'review', needs_review: 'review', completed: 'completed', escalated: 'escalated',
    closed: 'completed',
  };
  const aiStatusMap: Record<string, Case['aiStatus']> = {
    processing: 'processing', complete: 'complete', needs_review: 'needs review',
    rejected: 'needs review', error: 'failed',
  };
  const priorityMap: Record<string, Case['priority']> = {
    low: 'low', medium: 'medium', high: 'high', critical: 'critical',
  };
  const mapDocumentStatus = (status: string): 'uploaded' | 'pending' | 'missing' | 'error' => {
    const normalized = (status ?? '').toLowerCase();
    if (['uploaded', 'verified', 'processed', 'complete', 'completed', 'done', 'success'].includes(normalized)) return 'uploaded';
    if (['error', 'failed', 'rejected'].includes(normalized)) return 'error';
    if (['missing'].includes(normalized)) return 'missing';
    return 'pending';
  };
  const uploadedCount = (c.documents ?? []).filter((d) => mapDocumentStatus(d.status) === 'uploaded').length;
  const agentRuns = c.agentRuns ?? [];
  const extractionRun = findLatestRun(agentRuns, ['Data Extraction']);
  const ocrRun = findLatestRun(agentRuns, ['Document OCR']);
  const validationRun = findLatestRun(agentRuns, ['Validation']);
  const decisionRun = findLatestRun(agentRuns, ['Decision']);
  const classificationRun = findLatestRun(agentRuns, ['Claim Classification']);

  const extractionOutput = getRunOutput(extractionRun);
  const validationOutput = getRunOutput(validationRun);
  const decisionOutput = getRunOutput(decisionRun);
  const classificationOutput = getRunOutput(classificationRun);
  const ocrOutput = getRunOutput(ocrRun);

  const extractedFieldsRaw = extractionOutput.extractedFields;
  const extractedFields = extractedFieldsRaw && typeof extractedFieldsRaw === 'object'
    ? (extractedFieldsRaw as Record<string, unknown>)
    : {};

  const extractedData: Record<string, string> = {
    'Case ID': c.id,
    'Claim Type': valueToDisplay(extractedFields.claimType ?? c.caseType),
    'Workflow Stage': c.workflowStage,
    'Priority': c.priority,
    'Customer Email': c.customerEmail ?? 'Not available',
    'Classification': valueToDisplay(classificationOutput.inquiryType ?? c.claimClassification ?? 'Pending'),
    'Policy Number': valueToDisplay(extractedFields.policyNumber ?? c.policyNumber),
    'Claim Number': valueToDisplay(extractedFields.claimNumber),
    'Claimant Name': valueToDisplay(extractedFields.claimantName ?? c.memberName),
    'Diagnosis Codes': valueToDisplay(extractedFields.diagnosisCodes),
    'Treatment Description': valueToDisplay(extractedFields.treatmentDescription),
    'Provider Name': valueToDisplay(extractedFields.providerName),
    'Date of Incident': valueToDisplay(extractedFields.dateOfIncident ?? c.incidentDate),
    'Documents Received': `${c.documents?.length ?? 0}`,
    'Documents Verified': `${uploadedCount}`,
    'OCR Processed Documents': valueToDisplay(ocrOutput.ocrProcessedDocuments ?? 0),
    'OCR Failed Documents': valueToDisplay(ocrOutput.ocrFailedDocuments ?? 0),
    'Validation Passed': valueToDisplay(validationOutput.passed),
    'Validation Confidence': typeof validationOutput.confidence === 'number'
      ? `${Math.round(Number(validationOutput.confidence) * 100)}%`
      : 'Pending',
    'Decision': valueToDisplay(decisionOutput.decision),
    'Decision Reason': valueToDisplay(decisionOutput.reason),
  };
  const claimAmount = typeof extractedFields.claimAmount === 'number'
    ? extractedFields.claimAmount
    : c.claimAmount;
  if (typeof claimAmount === 'number') {
    extractedData['Claim Amount'] = `INR ${claimAmount.toLocaleString('en-IN')}`;
  }
  if (c.incidentDate) {
    extractedData['Incident Date (Record)'] = new Date(c.incidentDate).toLocaleDateString('en-IN');
  }
  const timeline = [
    { id: 't1', timestamp: c.createdAt, action: 'Case Created', type: 'system' as const, actor: 'System' },
    ...agentRuns.map((run) => ({
      id: `run-${run.id}`,
      timestamp: run.createdAt,
      action: `${run.step} (${run.status})`,
      type: 'agent' as const,
      actor: run.agentName ?? run.step
    }))
  ];
  const ocrFailedDocuments = Number(ocrOutput.ocrFailedDocuments ?? 0);
  const validationConfidence = typeof validationOutput.confidence === 'number'
    ? Number(validationOutput.confidence)
    : undefined;
  const decisionText = typeof decisionOutput.decision === 'string'
    ? decisionOutput.decision
    : undefined;
  const insights = [
    ...(c.reviewTasks ?? []).map((task) => ({
      id: `review-${task.id}`,
      type: (task.status === 'pending' ? 'warning' : 'info') as 'warning' | 'info' | 'error' | 'success',
      title: `Review ${task.status}`,
      description: task.reason
    })),
    ...agentRuns
      .filter((run) => run.status.toLowerCase().includes('fail') || run.status.toLowerCase().includes('error'))
      .map((run) => ({
        id: `issue-${run.id}`,
        type: 'error' as const,
        title: `Step issue: ${run.step}`,
        description: `Agent run ended with status "${run.status}".`
      })),
    ...(ocrFailedDocuments > 0 ? [{
      id: `ocr-${c.id}`,
      type: 'warning' as const,
      title: 'OCR quality warning',
      description: `${ocrFailedDocuments} document(s) failed OCR and may need manual review.`
    }] : [])
  ];
  const progress = computeWorkflowProgress(c.caseType, agentRuns);
  const isTerminal = ['completed', 'closed'].includes((c.status ?? '').toLowerCase())
    || ['complete'].includes((c.aiStatus ?? '').toLowerCase())
    || ['approved', 'rejected'].includes((c.workflowStage ?? '').toLowerCase());
  const aiMetrics = {
    modelConfidence: validationConfidence !== undefined ? Math.max(0, Math.min(1, validationConfidence)) : undefined,
    complianceScore: validationOutput.passed === true
      ? Math.max(0.88, 1 - (ocrFailedDocuments * 0.03))
      : validationOutput.passed === false
        ? 0.68
        : undefined,
    riskIndex: decisionText === 'REJECTED'
      ? Math.min(95, 78 + (ocrFailedDocuments * 4))
      : decisionText === 'REVIEW_REQUIRED'
        ? Math.min(75, 45 + (ocrFailedDocuments * 3))
        : decisionText === 'APPROVED'
          ? Math.max(8, 20 - (uploadedCount > 0 ? 4 : 0))
          : undefined,
    processingSeconds: typeof extractionOutput.sourceTextLength === 'number'
      ? Math.max(0.5, Math.min(8, Number(extractionOutput.sourceTextLength) / 120))
      : undefined,
    workflowProgress: isTerminal ? 100 : progress.workflowProgress,
    completedSteps: isTerminal ? Math.max(progress.totalSteps, progress.completedSteps) : progress.completedSteps,
    totalSteps: Math.max(progress.totalSteps, progress.completedSteps),
    runningStep: isTerminal ? undefined : progress.runningStep
  };
  return {
    id: c.id,
    title: `${c.caseType.charAt(0).toUpperCase() + c.caseType.slice(1)} Claim – ${c.memberName}`,
    type: c.caseType,
    category: deriveCaseCategory(c.caseType),
    status: statusMap[c.status] ?? 'new',
    priority: priorityMap[c.priority] ?? 'medium',
    customer: c.memberName,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    workflowId: c.caseType,
    stage: c.workflowStage,
    aiStatus: aiStatusMap[c.aiStatus] ?? 'processing',
    handlingType: 'automated',
    description: `${c.caseType} insurance claim`,
    aiInsights: typeof decisionOutput.reason === 'string' && decisionOutput.reason.length > 0
      ? decisionOutput.reason
      : c.reviewTasks?.length
        ? `Case has ${c.reviewTasks.length} review task(s). Latest: ${c.reviewTasks[0].reason}`
        : `Case is in ${c.workflowStage}. Documents received: ${c.documents?.length ?? 0}.`,
    extractedData,
    aiMetrics,
    insights,
    documents: (c.documents ?? []).map(d => ({
      id: d.id,
      name: d.name,
      type: d.type ?? 'Other',
      status: mapDocumentStatus(d.status),
      uploadedAt: c.createdAt,
      pages: d.pages,
    })),
    timeline,
  };
}

// Map backend agent → frontend Agent type
function apiAgentToAgent(a: ApiAgent): Agent {
  const kindMap: Record<string, Agent['type']> = {
    extraction: 'processing', validation: 'processing', orchestrator: 'monitoring',
    email: 'communication', document: 'processing', decision: 'decision',
    classifier: 'processing',
  };
  const backendKind = (a.kind ?? a.agentType ?? 'processing').toLowerCase();
  const rules = (a.rules ?? a.policyRules ?? []).filter((item): item is string => typeof item === 'string');
  return {
    id: a.id,
    name: a.name,
    type: kindMap[backendKind] ?? 'processing',
    description: a.instructions,
    rules,
    checklist: [],
    goals: [],
    status: 'active',
    createdAt: a.createdAt ?? new Date().toISOString(),
  };
}

// Map backend workflow → frontend Workflow type  
function apiWorkflowToWorkflow(w: ApiWorkflow): Workflow {
  const derivedCategory = w.category
    ?? (w.key?.startsWith('banking_') ? 'Banking'
      : w.key?.startsWith('health_') ? 'Insurance - Health'
      : w.key?.startsWith('motor_') ? 'Insurance - Motor'
      : w.key?.startsWith('property_') ? 'Insurance - Property & Casualty'
      : 'Cross-Industry');

  return {
    id: w.id,
    name: w.name,
    category: derivedCategory,
    description: w.description ?? '',
    agentIds: [],
    steps: (w.steps ?? []).map(s => ({
      id: s.id,
      type: 'agent' as const,
      label: s.name,
      description: s.stepType ?? s.type ?? 'STEP',
    })),
    status: (w.status ?? 'active') as Workflow['status'],
    createdAt: w.createdAt ?? new Date().toISOString(),
    automationRate: 85,
  };
}

interface PlatformContextType {
  selectedDomain: DomainName;
  domainOptions: DomainName[];
  setSelectedDomain: (domain: DomainName) => void;
  cases: Case[];
  messages: Message[];
  users: UserProfile[];
  agents: Agent[];
  workflows: Workflow[];
  reviewQueue: ReviewQueueItem[];
  securityLogs: SecurityLog[];
  documents: Document[];
  liveEvents: LiveEvent[];
  isLoading: boolean;
  refreshCases: () => void;
  addCase: (newCase: Omit<Case, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCase: (id: string, updates: Partial<Case>) => void;
  searchCases: (query: string) => Case[];
  addAgent: (agent: Omit<Agent, 'id' | 'createdAt'>) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
  addWorkflow: (workflow: Omit<Workflow, 'id' | 'createdAt'>) => void;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void;
  deleteWorkflow: (id: string) => void;
  updateUser: (id: string, updates: Partial<UserProfile>) => void;
  updateReviewItem: (id: string, updates: Partial<ReviewQueueItem>) => void;
  deleteDocument: (id: string) => void;
}

const PlatformContext = createContext<PlatformContextType | undefined>(undefined);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const domainOptions: DomainName[] = [...INDUSTRIES];
  const [selectedDomain, setSelectedDomain] = useState<DomainName>(INDUSTRIES[0] as DomainName);
  const [cases, setCases] = useState<Case[]>(MOCK_CASES);
  const [messages] = useState<Message[]>(MOCK_MESSAGES);
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([
    { id: 'u1', name: 'Rajesh Kumar', email: 'rajesh@rahejaqbe.com', role: 'admin', status: 'active', avatar: INDIAN_FACES['Rajesh Kumar'], lastActive: '2024-03-17T10:00:00Z' },
    { id: 'u2', name: 'Priya Sharma', email: 'priya@rahejaqbe.com', role: 'manager', status: 'active', avatar: INDIAN_FACES['Priya Sharma'], lastActive: '2024-03-17T09:45:00Z' },
    { id: 'u3', name: 'Rahul Sharma', email: 'rahul@rahejaqbe.com', role: 'agent', status: 'active', avatar: INDIAN_FACES['Rahul Sharma'], lastActive: '2024-03-17T08:30:00Z' },
  ]);
  const [agents, setAgents] = useState<Agent[]>(MOCK_AGENTS);
  const [workflows, setWorkflows] = useState<Workflow[]>(MOCK_WORKFLOWS);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>(MOCK_REVIEW_QUEUE);
  const [securityLogs] = useState<SecurityLog[]>(MOCK_SECURITY_LOGS);
  const [documents, setDocuments] = useState<Document[]>(MOCK_DOCUMENTS);
  const [liveEvents] = useState<LiveEvent[]>(MOCK_LIVE_EVENTS);

  const visibleCases = useMemo(() => (
    cases.filter((item) => item.category === selectedDomain)
  ), [cases, selectedDomain]);

  const visibleWorkflows = useMemo(() => (
    workflows.filter((item) => item.category === selectedDomain)
  ), [workflows, selectedDomain]);

  const visibleAgents = useMemo(() => (
    agents.filter((item) => !item.category || item.category === selectedDomain)
  ), [agents, selectedDomain]);

  const visibleCaseIds = useMemo(() => new Set(visibleCases.map((item) => item.id)), [visibleCases]);
  const visibleReviewQueue = useMemo(() => (
    reviewQueue.filter((item) => visibleCaseIds.has(item.caseId))
  ), [reviewQueue, visibleCaseIds]);
  const visibleDocuments = useMemo(() => (
    documents.filter((item) => !item.caseId || visibleCaseIds.has(item.caseId))
  ), [documents, visibleCaseIds]);
  const visibleEvents = useMemo(() => (
    liveEvents.filter((item) => visibleCaseIds.has(item.caseId))
  ), [liveEvents, visibleCaseIds]);

  // Fetch real cases from backend
  const refreshCases = useCallback(() => {
    setIsLoading(true);
    getCases({ limit: 100, domain: selectedDomain })
      .then(resp => {
        if (resp.data?.length) {
          setCases(resp.data.map(apiCaseToCase));
        }
      })
      .catch(() => { /* keep mock data on error */ })
      .finally(() => setIsLoading(false));
  }, [selectedDomain]);

  // Fetch real agents from backend
  const refreshAgents = useCallback(() => {
    getAgents()
      .then(apiAgents => {
        if (apiAgents?.length) {
          setAgents(apiAgents.map(apiAgentToAgent));
        }
      })
      .catch(() => { /* keep mock data */ });
  }, []);

  // Fetch real workflows from backend
  const refreshWorkflows = useCallback(() => {
    getWorkflows({ domain: selectedDomain })
      .then(apiWorkflows => {
        if (apiWorkflows?.length) {
          setWorkflows(apiWorkflows.map(apiWorkflowToWorkflow));
        }
      })
      .catch(() => { /* keep mock data */ });
  }, [selectedDomain]);

  // Initial load + periodic refresh
  useEffect(() => {
    refreshCases();
    refreshAgents();
    refreshWorkflows();
  const interval = setInterval(refreshCases, 3000); // faster refresh for near-live progress updates
    return () => clearInterval(interval);
  }, [refreshCases, refreshAgents, refreshWorkflows]);

  const addCase = (newCase: Omit<Case, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = `CASE-${Math.floor(1000 + Math.random() * 9000)}`;
    const timestamp = new Date().toISOString();
    const createdCase: Case = {
      ...newCase,
      id,
      createdAt: timestamp,
      updatedAt: timestamp,
      extractedData: {},
      insights: [],
      documents: [],
      timeline: [
        { id: `t-${Date.now()}`, timestamp, action: 'Case Created', type: 'system', actor: 'System' }
      ]
    };
    setCases(prev => [createdCase, ...prev]);
  };

  const updateCase = (id: string, updates: Partial<Case>) => {
    setCases(prev => prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c));
  };

  const searchCases = (query: string) => {
    const q = query.toLowerCase();
    return visibleCases.filter(c => 
      c.id.toLowerCase().includes(q) || 
      c.title.toLowerCase().includes(q) || 
      c.customer.toLowerCase().includes(q)
    );
  };

  const updateAgent = (id: string, updates: Partial<Agent>) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const addAgent = (agent: Omit<Agent, 'id' | 'createdAt'>) => {
    const newAgent: Agent = {
      ...agent,
      id: `a${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setAgents(prev => [newAgent, ...prev]);
  };

  const deleteAgent = (id: string) => {
    setAgents(prev => prev.filter(a => a.id !== id));
  };

  const addWorkflow = (workflow: Omit<Workflow, 'id' | 'createdAt'>) => {
    const newWorkflow: Workflow = {
      ...workflow,
      id: `wf-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setWorkflows(prev => [newWorkflow, ...prev]);
  };

  const updateWorkflow = (id: string, updates: Partial<Workflow>) => {
    setWorkflows(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  };

  const deleteWorkflow = (id: string) => {
    setWorkflows(prev => prev.filter(w => w.id !== id));
  };

  const updateUser = (id: string, updates: Partial<UserProfile>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
  };

  const updateReviewItem = (id: string, updates: Partial<ReviewQueueItem>) => {
    setReviewQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const deleteDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  return (
    <PlatformContext.Provider value={{ 
      selectedDomain,
      domainOptions,
      setSelectedDomain,
      cases: visibleCases,
      isLoading,
      refreshCases,
      messages, 
      users,
      addCase, 
      updateCase, 
      searchCases,
      agents: visibleAgents,
      addAgent,
      updateAgent,
      deleteAgent,
      workflows: visibleWorkflows,
      addWorkflow,
      updateWorkflow,
      deleteWorkflow,
      updateUser,
      reviewQueue: visibleReviewQueue,
      securityLogs,
      documents: visibleDocuments,
      liveEvents: visibleEvents,
      updateReviewItem,
      deleteDocument
    }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (context === undefined) {
    throw new Error('usePlatform must be used within a PlatformProvider');
  }
  return context;
}
