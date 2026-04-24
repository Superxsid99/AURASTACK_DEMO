import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { HomeView } from './components/HomeView';
import { CasesView } from './components/CasesView';
import { WorkflowsView } from './components/WorkflowsView';
import { AgentsView } from './components/AgentsView';
import { SystemView } from './components/SystemView';
import { DataLabView } from './components/DataLabView';
import { FraudDetectionView } from './components/FraudDetectionView';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'sonner';
import { Routes, Route, useLocation, useNavigate, Navigate, matchPath } from 'react-router-dom';
import { INITIAL_WORKFLOWS } from './constants/workflows';
import { INITIAL_AGENTS } from './constants/agents';
import { INITIAL_CONVERSATIONS } from './constants/intake';
import { AuditEntry, Case } from './types/case';
import { WorkflowDefinition } from './types/workflow';
import { AgentDefinition } from './types/agent';
import { Conversation, Message } from './types/intake';
import { TaskInstance, ExecutionLog } from './types/execution';
import { ExecutionEngine } from './services/executionEngine';
import { InboxView } from './components/InboxView';
import { CustomerPortal } from './components/CustomerPortal';
import { ShieldAlert } from 'lucide-react';
import { LoginPage } from './components/LoginPage';
import { v4 as uuidv4 } from 'uuid';
import { ROLES, INITIAL_USER } from './constants/auth';
import { Permission, Role, RoleId } from './types/auth';

export const PermissionContext = React.createContext<{
  hasPermission: (p: Permission) => boolean;
  userRole: RoleId;
  setUserRole: (r: RoleId) => void;
  roles: Role[];
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
}>({
  hasPermission: () => false,
  userRole: 'ADMIN',
  setUserRole: () => {},
  roles: ROLES,
  setRoles: () => {}
});

export const ThemeContext = React.createContext<{
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}>({
  theme: 'dark',
  toggleTheme: () => {}
});

type ApiCaseRecord = {
  id: string;
  caseType?: string;
  workflowStage?: string | null;
  assignedUserName?: string | null;
  aiStatus?: string | null;
  priority?: string | null;
  memberName?: string | null;
  status?: string | null;
  documentsTotal?: number;
  documentsComplete?: number;
  customerEmail?: string | null;
  claimClassification?: string | null;
  policyNumber?: string | null;
  claimAmount?: number | null;
  incidentDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown> | null;
  documents?: Array<{
    id: string;
    name: string;
    type: string;
    status?: string;
    pages?: number | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
  agentRuns?: Array<{
    id: string;
    agentId?: string | null;
    agentName?: string | null;
    step?: string | null;
    stepKind?: string | null;
    output?: string | null;
    outputJson?: Record<string, unknown> | null;
    inputJson?: Record<string, unknown> | null;
    durationMs?: number | null;
    error?: string | null;
    createdAt?: string;
    updatedAt?: string;
    status?: string;
  }>;
  reviewTasks?: Array<{
    id: string;
    reason?: string | null;
    status?: string | null;
    assignedTo?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
};

type ApiCasesResponse = {
  data?: ApiCaseRecord[];
};

type ApiAttachment = {
  name?: string;
  mimeType?: string;
  contentBase64?: string;
};

type ApiEmailThread = {
  id: string;
  caseId?: string | null;
  fromAddress?: string;
  toAddress?: string;
  subject?: string;
  body?: string;
  direction?: string;
  status?: string;
  createdAt?: string;
  attachments?: ApiAttachment[] | null;
  rawHeaders?: Record<string, unknown> | null;
  case?: {
    id?: string;
    memberName?: string | null;
    status?: string | null;
    caseType?: string | null;
  } | null;
};

type ApiEmailThreadsResponse = {
  data?: ApiEmailThread[];
};

type ApiWorkflowStep = {
  id: string;
  name?: string;
  stepType?: string;
  stepOrder?: number;
  nextStepId?: string | null;
  config?: Record<string, unknown> | null;
};

type ApiWorkflowExecution = {
  id: string;
  status?: string;
  startedAt?: string;
  finishedAt?: string | null;
};

type ApiWorkflowRecord = {
  id: string;
  key?: string | null;
  name?: string;
  description?: string | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  category?: string;
  steps?: ApiWorkflowStep[];
  executions?: ApiWorkflowExecution[];
  stepMetrics?: Record<string, {
    total?: number;
    completed?: number;
    failed?: number;
    successRate?: number;
    avgDurationMs?: number;
  }>;
};

type ApiWorkflowsResponse = {
  data?: ApiWorkflowRecord[];
};

type AttachmentLookup = Map<string, { mimeType?: string; contentBase64?: string }>;

type CaseAttachmentSource = {
  createdAtMs: number;
  attachmentsByName: AttachmentLookup;
};

type AuthSessionUser = {
  id: string;
  email: string | null;
  name: string;
  role: string;
};

const AUTH_ACCESS_TOKEN_KEY = 'aurastack_access_token';
const AUTH_REFRESH_TOKEN_KEY = 'aurastack_refresh_token';
const AUTH_REQUEST_TIMEOUT_MS = 12000;
const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000;
const DIRECT_API_BASE = 'http://127.0.0.1:8000';

const mapApiRoleToUiRole = (role: string | null | undefined): RoleId => {
  const value = String(role || '').trim().toLowerCase();
  switch (value) {
    case 'admin':
    case 'system_administrator':
      return 'ADMIN';
    case 'medical_adjuster':
      return 'MEDICAL_ADJUSTER';
    case 'underwriter':
      return 'UNDERWRITER';
    case 'compliance_officer':
      return 'COMPLIANCE_OFFICER';
    case 'claims_manager':
      return 'CLAIMS_MANAGER';
    case 'support_agent':
    case 'operator':
      return 'SUPPORT_AGENT';
    case 'case_reviewer':
    case 'reviewer':
      return 'CASE_REVIEWER';
    case 'fraud_analyst':
      return 'FRAUD_ANALYST';
    case 'financial_officer':
      return 'FINANCIAL_OFFICER';
    case 'hospital_coord':
      return 'HOSPITAL_COORD';
    default:
      return 'SUPPORT_AGENT';
  }
};

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = AUTH_REQUEST_TIMEOUT_MS
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const fetchAuthWithFallback = async (
  endpoint: string,
  init: RequestInit
): Promise<Response> => {
  try {
    return await fetchWithTimeout(`/api${endpoint}`, init);
  } catch (error) {
    const isRetryable =
      error instanceof Error &&
      (error.name === 'AbortError' || /Failed to fetch|NetworkError/i.test(error.message));
    if (!isRetryable) throw error;
    return fetchWithTimeout(`${DIRECT_API_BASE}${endpoint}`, init);
  }
};

const fetchReadEndpoint = async (
  endpoint: string,
  authHeaders?: Record<string, string>
): Promise<Response> => {
  const withAuth = await fetchAuthWithFallback(endpoint, { headers: authHeaders });
  if (withAuth.status === 401 || withAuth.status === 403) {
    return fetchAuthWithFallback(endpoint, {});
  }
  return withAuth;
};

const normalizeSubject = (subject?: string | null): string => {
  const raw = String(subject || '').trim();
  if (!raw) return 'No Subject';
  return raw.replace(/^(re|fw|fwd)\s*:\s*/i, '').trim() || raw;
};

const toInboxType = (value?: string | null): Conversation['type'] => {
  const v = String(value || '').toLowerCase();
  if (v.includes('quote')) return 'QUOTE';
  if (v.includes('claim')) return 'CLAIM';
  if (v.includes('hospital')) return 'HOSPITAL_INTAKE';
  if (v.includes('kyc')) return 'KYC';
  if (v.includes('renewal')) return 'RENEWAL';
  if (v.includes('compliance')) return 'COMPLIANCE';
  if (v.includes('nominee')) return 'NOMINEE_CHANGE';
  if (v.includes('sales')) return 'SALES_APPLICATION';
  if (v.includes('policy')) return 'POLICY_INFO';
  return 'GENERAL';
};

const toConversationStatus = (caseStatus?: string | null): Conversation['status'] => {
  const s = String(caseStatus || '').toLowerCase();
  if (!s) return 'OPEN';
  if (s.includes('completed') || s.includes('approved') || s.includes('closed')) return 'RESOLVED';
  if (s.includes('in_progress') || s.includes('processing') || s.includes('review')) return 'IN_PROGRESS';
  return 'OPEN';
};

const extractWorkflowNameFromCase = (record?: ApiCaseRecord | null): string | null => {
  if (!record) return null;
  const runs = Array.isArray(record.agentRuns) ? record.agentRuns : [];
  const routingRun = runs.find(
    (run) => String(run.stepKind || "").toUpperCase().includes("WORKFLOW_ROUTING") || String(run.step || "").toLowerCase().includes("workflow routing")
  );
  if (!routingRun) return null;

  const outputJson = routingRun.outputJson ?? {};
  const selected = typeof outputJson.selectedWorkflowName === "string" ? outputJson.selectedWorkflowName.trim() : "";
  if (selected) return selected;

  const output = String(routingRun.output || "");
  const match = output.match(/Routed to\s+(.+?)\s+\(/i);
  const parsed = match?.[1]?.trim();
  if (parsed) return parsed;

  const metadata = asRecord(record.metadata);
  const routingFromMetadata = asRecord(metadata.routingDecision);
  if (typeof routingFromMetadata.selectedWorkflowName === "string" && routingFromMetadata.selectedWorkflowName.trim()) {
    return routingFromMetadata.selectedWorkflowName.trim();
  }

  return null;
};

const extractWorkflowRoutingDetails = (record?: ApiCaseRecord | null): { source?: string; reasons: string[] } => {
  if (!record) return { reasons: [] };
  const runs = Array.isArray(record.agentRuns) ? record.agentRuns : [];
  const routingRun = runs.find(
    (run) => String(run.stepKind || "").toUpperCase().includes("WORKFLOW_ROUTING") || String(run.step || "").toLowerCase().includes("workflow routing")
  );
  if (!routingRun) return { reasons: [] };

  const outputJson = routingRun.outputJson ?? {};
  const source = typeof outputJson.source === "string" ? outputJson.source : undefined;
  const reasons = Array.isArray(outputJson.reasons)
    ? outputJson.reasons.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  if (source || reasons.length > 0) {
    return { source, reasons };
  }

  const metadata = asRecord(record.metadata);
  const routingFromMetadata = asRecord(metadata.routingDecision);
  const fallbackSource =
    typeof routingFromMetadata.source === "string" ? routingFromMetadata.source : undefined;
  const fallbackReasons = Array.isArray(routingFromMetadata.reasons)
    ? routingFromMetadata.reasons.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  return { source: fallbackSource, reasons: fallbackReasons };
};

const buildAutomatedOutboundMessages = (record?: ApiCaseRecord | null): Message[] => {
  if (!record) return [];
  const runs = Array.isArray(record.agentRuns) ? record.agentRuns : [];
  const notifyRuns = runs.filter((run) => String(run.stepKind || "").toUpperCase() === "NOTIFY_CUSTOMER");

  return notifyRuns
    .map((run) => {
      const outputJson = run.outputJson ?? {};
      const body = typeof outputJson.body === "string" ? outputJson.body.trim() : "";
      const subject = typeof outputJson.subject === "string" ? outputJson.subject.trim() : "";
      const sent = Boolean(outputJson.emailSent);
      const content = body || String(run.output || "").trim();
      if (!sent || !content) return null;
      const rendered = subject ? `Subject: ${subject}\n\n${content}` : content;
      return {
        id: `auto-${run.id}`,
        sender: "AI" as const,
        content: rendered,
        timestamp: run.updatedAt || run.createdAt || record.updatedAt || new Date().toISOString()
      };
    })
    .filter((item): item is Message => Boolean(item));
};

const mapEmailThreadsToConversations = (threads: ApiEmailThread[], casesById: Map<string, ApiCaseRecord>): Conversation[] => {
  const groups = new Map<string, ApiEmailThread[]>();

  for (const thread of threads) {
    const normalized = normalizeSubject(thread.subject);
    const key = thread.caseId || `${normalized.toLowerCase()}|${String(thread.fromAddress || '').toLowerCase()}|${String(thread.toAddress || '').toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(thread);
  }

  const conversations: Conversation[] = [];
  for (const [key, items] of groups.entries()) {
    const sorted = items.slice().sort((a, b) => {
      const aMs = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bMs = b.createdAt ? Date.parse(b.createdAt) : 0;
      return aMs - bMs;
    });
    const latest = sorted[sorted.length - 1];
    const inboundRef = sorted.find((x) => String(x.direction || '').toLowerCase() === 'inbound') || latest;
    const customerEmail = String(inboundRef?.fromAddress || latest?.toAddress || latest?.fromAddress || '').trim();
    const customerName =
      String(latest?.case?.memberName || (latest?.rawHeaders as any)?.customerName || '').trim() ||
      (customerEmail.includes('@') ? customerEmail.split('@')[0] : 'Customer');
    const messages: Message[] = sorted.map((t) => ({
      id: t.id,
      sender: String(t.direction || '').toLowerCase() === 'outbound' ? 'AGENT' : 'CUSTOMER',
      content: t.body || '',
      timestamp: t.createdAt || new Date().toISOString(),
      attachments: (Array.isArray(t.attachments) ? t.attachments : [])
        .filter((a) => Boolean(a?.name))
        .map((a) => ({
          name: String(a.name),
          type: String(a.mimeType || 'application/octet-stream'),
          url: a.contentBase64 ? `data:${String(a.mimeType || 'application/octet-stream')};base64,${a.contentBase64}` : '#'
        }))
    }));

    const caseRecord = latest?.caseId ? casesById.get(latest.caseId) ?? null : null;
    const workflowName = extractWorkflowNameFromCase(caseRecord);
    const routing = extractWorkflowRoutingDetails(caseRecord);
    const automatedOutbound = buildAutomatedOutboundMessages(caseRecord).filter((autoMsg) =>
      !messages.some((existing) => existing.sender !== "CUSTOMER" && existing.content.trim() === autoMsg.content.trim())
    );
    const allMessages = [...messages, ...automatedOutbound].sort(
      (a, b) => Date.parse(a.timestamp || '') - Date.parse(b.timestamp || '')
    );

    const inboundCount = allMessages.filter((m) => m.sender === "CUSTOMER").length;
    const outboundCount = allMessages.filter((m) => m.sender !== "CUSTOMER").length;

    conversations.push({
      id: key,
      customer_name: customerName,
      customer_email: customerEmail || 'unknown@example.com',
      subject: normalizeSubject(latest?.subject),
      channel: String((latest?.rawHeaders as any)?.channel || '').toUpperCase() === 'CHAT' ? 'CHAT' : 'EMAIL',
      type: toInboxType((latest?.rawHeaders as any)?.requestType || latest?.case?.caseType || latest?.subject),
      status: toConversationStatus(latest?.case?.status),
      last_message_at: latest?.createdAt || new Date().toISOString(),
      messages: allMessages,
      linked_case_id: latest?.caseId || undefined,
      metadata: {
        inbound_count: inboundCount,
        outbound_count: outboundCount,
        to_address: latest?.toAddress,
        from_address: latest?.fromAddress,
        workflow_name: workflowName || undefined,
        workflow_source: routing.source || undefined,
        workflow_reasons: routing.reasons,
        workflow_evidence_available: Boolean(workflowName || routing.reasons.length > 0 || routing.source)
      }
    });
  }

  return conversations.sort((a, b) => Date.parse(b.last_message_at) - Date.parse(a.last_message_at));
};

const toCaseStatus = (apiStatus?: string | null, aiStatus?: string | null): Case['status'] => {
  const s = (apiStatus || '').toLowerCase();
  const a = (aiStatus || '').toLowerCase();
  if (s === 'completed' || s === 'closed' || a === 'complete') return 'STABLE';
  if (s === 'escalated' || a === 'error') return 'CRITICAL';
  if (s === 'review' || a === 'needs_review') return 'ELEVATED';
  return 'IN_REVIEW';
};

const toCasePriority = (priority?: string | null): Case['priority'] => {
  const p = (priority || '').toLowerCase();
  if (p === 'high' || p === 'critical') return 'HIGH';
  if (p === 'low') return 'LOW';
  return 'MEDIUM';
};

const toCaseType = (caseType?: string | null): Case['type'] => {
  const value = (caseType || '').toLowerCase();
  if (value.includes('kyc')) return 'KYC';
  if (value.includes('compliance')) return 'COMPLIANCE';
  if (value.includes('renewal')) return 'RENEWAL';
  if (value.includes('underwriting')) return 'UNDERWRITING';
  if (value.includes('servicing')) return 'POLICY_SERVICING';
  if (value.includes('sales')) return 'SALES';
  return 'CLAIM';
};

const toDepartment = (caseType?: string | null): Case['department'] => {
  const value = (caseType || '').toLowerCase();
  if (value.includes('kyc')) return 'KYC_ONBOARDING';
  if (value.includes('compliance')) return 'COMPLIANCE';
  if (value.includes('renewal')) return 'RENEWALS';
  if (value.includes('underwriting')) return 'UNDERWRITING';
  if (value.includes('servicing')) return 'POLICY_SERVICING';
  if (value.includes('sales')) return 'SALES';
  return 'CLAIMS';
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const getRunByStep = (
  runs: NonNullable<ApiCaseRecord['agentRuns']>,
  matcher: (run: NonNullable<ApiCaseRecord['agentRuns']>[number]) => boolean
) => {
  const candidates = runs.filter(matcher);
  if (candidates.length === 0) return undefined;

  const scored = candidates
    .map((run) => {
      const status = String(run.status || '').toLowerCase();
      const hasOutputText = typeof run.output === 'string' && run.output.trim().length > 0;
      const hasOutputJson = !!(run.outputJson && Object.keys(run.outputJson).length > 0);
      const createdAtMs = run.createdAt ? Date.parse(run.createdAt) : 0;
      let score = createdAtMs;
      if (status === 'completed' || status === 'success') score += 10_000_000_000;
      if (hasOutputJson) score += 1_000_000_000;
      if (hasOutputText) score += 100_000_000;
      return { run, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0].run;
};

const toExecutionStatus = (status?: string | null): TaskInstance['status'] => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed' || normalized === 'success') return 'COMPLETED';
  if (normalized === 'failed' || normalized === 'error') return 'FAILED';
  if (normalized === 'queued' || normalized === 'pending') return 'PENDING';
  return 'IN_PROGRESS';
};

const toActorType = (run: NonNullable<ApiCaseRecord['agentRuns']>[number]): TaskInstance['actor']['type'] => {
  const name = String(run.agentName || '').toLowerCase();
  if (name.includes('human') || name.includes('review')) return 'human';
  if (!name || name.includes('system')) return 'system';
  return 'agent';
};

const runToAuditEntry = (
  run: NonNullable<ApiCaseRecord['agentRuns']>[number],
  createdAtFallback: string
): AuditEntry => {
  const actorType = toActorType(run);
  return {
    id: run.id,
    timestamp: run.createdAt || createdAtFallback,
    actor: {
      id: run.agentId || run.agentName || 'system',
      name: run.agentName || (actorType === 'system' ? 'System' : 'Workflow Agent'),
      type: actorType,
      role: run.stepKind || undefined
    },
    action: run.output || `${run.step || 'Workflow Step'} ${run.status || 'completed'}`,
    node_id: run.stepKind || run.step || 'workflow_step',
    duration_ms: typeof run.durationMs === 'number' ? run.durationMs : undefined,
    signature: `run_${run.id}`,
    metadata: {
      status: run.status || 'completed'
    }
  };
};

const pickBestAttachmentSourceForCase = (
  item: ApiCaseRecord,
  sources: CaseAttachmentSource[]
): AttachmentLookup => {
  if (!Array.isArray(sources) || sources.length === 0) {
    return new Map();
  }

  const docNames = new Set(
    (Array.isArray(item.documents) ? item.documents : [])
      .map((doc) => String(doc.name || '').toLowerCase())
      .filter(Boolean)
  );
  const createdAtMs = item.createdAt ? Date.parse(item.createdAt) : Number.NaN;

  let best: CaseAttachmentSource | null = null;
  let bestScore = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const source of sources) {
    let score = 0;
    for (const docName of docNames) {
      if (source.attachmentsByName.has(docName)) {
        score += 1;
      }
    }
    const distance = Number.isFinite(createdAtMs)
      ? Math.abs(source.createdAtMs - createdAtMs)
      : Number.POSITIVE_INFINITY;

    if (
      score > bestScore ||
      (score === bestScore && distance < bestDistance) ||
      (score === bestScore && distance === bestDistance && source.createdAtMs > (best?.createdAtMs ?? 0))
    ) {
      best = source;
      bestScore = score;
      bestDistance = distance;
    }
  }

  return best?.attachmentsByName ?? new Map();
};

const mapStepTypeToNodeType = (stepType?: string): WorkflowDefinition['nodes'][number]['type'] => {
  const value = String(stepType || '').toUpperCase();
  if (['EMAIL_INTAKE', 'EMAIL_REPLY'].includes(value)) return 'input';
  if (['DOCUMENT_OCR', 'DATA_EXTRACTION', 'CLAIM_CLASSIFICATION', 'POLICY_LOOKUP', 'MEDICAL_CODING', 'FRAUD_SCREENING', 'NOTIFY_CUSTOMER', 'CUSTOMER_COMMS'].includes(value)) return 'ai_task';
  if (['VALIDATION', 'KNOWLEDGE_CHECK', 'DOCUMENT_VALIDATION', 'COVERAGE_RULES', 'PROVIDER_NETWORK_CHECK', 'AUDIT_COMPLIANCE', 'SLA_CHECK'].includes(value)) return 'validation';
  if (value === 'DECISION') return 'decision';
  if (value === 'HUMAN_REVIEW' || value === 'HUMAN_HANDOFF') return 'human_task';
  if (value === 'APPROVAL' || value === 'REJECTION') return 'end';
  return 'ai_task';
};

const mapWorkflowStatus = (status?: string): WorkflowDefinition['status'] => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'active') return 'Active';
  if (normalized === 'running') return 'Running';
  if (normalized === 'draft') return 'Draft';
  return 'Idle';
};

const mapWorkflowDepartment = (category?: string): WorkflowDefinition['department'] => {
  const value = String(category || '').toLowerCase();
  if (value.includes('bank')) return 'POLICY_SERVICING';
  if (value.includes('motor')) return 'CLAIMS';
  if (value.includes('property') || value.includes('casualty')) return 'CLAIMS';
  if (value.includes('cross')) return 'COMPLIANCE';
  return 'CLAIMS';
};

const mapApiWorkflowToUiWorkflow = (workflow: ApiWorkflowRecord): WorkflowDefinition => {
  const steps = Array.isArray(workflow.steps) ? workflow.steps.slice().sort((a, b) => Number(a.stepOrder || 0) - Number(b.stepOrder || 0)) : [];
  const stepIdToNodeId = new Map<string, string>();
  const nodeByStepId = new Map<string, WorkflowDefinition['nodes'][number]>();

  steps.forEach((step) => {
    stepIdToNodeId.set(step.id, `node_${step.id}`);
  });

  steps.forEach((step, index) => {
    const nodeId = stepIdToNodeId.get(step.id)!;
    const metric = workflow.stepMetrics?.[step.id];
    const node: WorkflowDefinition['nodes'][number] = {
      id: nodeId,
      type: mapStepTypeToNodeType(step.stepType),
      label: step.name || step.stepType || `Step ${index + 1}`,
      x: 80 + index * 250,
      y: 120,
      config: {
        runtime: {
          stepId: step.id,
          totalRuns: Number(metric?.total || 0),
          successRate: Number(metric?.successRate || 0),
          failedRuns: Number(metric?.failed || 0),
          avgDurationMs: Number(metric?.avgDurationMs || 0)
        }
      },
      execution: {
        execution_type: nodeByStepId.get(step.id)?.execution.execution_type || (mapStepTypeToNodeType(step.stepType) === 'human_task' ? 'human_task' : 'agent_processing'),
        department: mapWorkflowDepartment(workflow.category),
        consumes_event: '',
        produces_event: `${workflow.key || workflow.id}.${String(step.name || step.stepType || 'step').toLowerCase().replace(/[^a-z0-9]+/g, '_')}.done`,
        writes: ['step_output']
      },
      next: step.nextStepId && stepIdToNodeId.has(step.nextStepId) ? [stepIdToNodeId.get(step.nextStepId)!] : []
    };
    nodeByStepId.set(step.id, node);
  });

  const nodes = steps.map((step) => nodeByStepId.get(step.id)!).filter(Boolean);
  const executionList = Array.isArray(workflow.executions) ? workflow.executions : [];
  const completed = executionList.filter((run) => String(run.status || '').toLowerCase() === 'completed').length;
  const failed = executionList.filter((run) => String(run.status || '').toLowerCase() === 'failed').length;
  const successRate = executionList.length > 0 ? Math.round((completed / executionList.length) * 100) : 0;

  return {
    workflow_id: workflow.id,
    name: workflow.name || workflow.key || 'Untitled Workflow',
    description: workflow.description || `${workflow.category || 'Workflow'} automation flow`,
    department: mapWorkflowDepartment(workflow.category),
    version: '3.0.0',
    status: mapWorkflowStatus(workflow.status),
    nodes: nodes.length > 0 ? nodes : [
      {
        id: 'start',
        type: 'input',
        label: 'Start Node',
        x: 100,
        y: 100,
        config: {},
        execution: {
          execution_type: 'system_action',
          department: mapWorkflowDepartment(workflow.category),
          produces_event: 'workflow.start',
          writes: []
        },
        next: []
      }
    ],
    last_updated: workflow.updatedAt || workflow.createdAt || new Date().toISOString(),
    stats: {
      success: `${successRate}%`,
      volume: String(executionList.length),
      latency: `${Math.round(
        Object.values(workflow.stepMetrics || {}).reduce((sum, item) => sum + Number(item.avgDurationMs || 0), 0) /
        Math.max(1, Object.keys(workflow.stepMetrics || {}).length)
      )}ms`,
      verify: String(steps.length),
      auto: String(completed),
      manual: String(failed)
    }
  };
};

const mapApiCaseToUiCase = (
  item: ApiCaseRecord,
  attachmentByDocName: Map<string, { mimeType?: string; contentBase64?: string }> = new Map()
): Case => {
  const created = item.createdAt || new Date().toISOString();
  const updated = item.updatedAt || created;
  const mappedType = toCaseType(item.caseType);
  const mappedDepartment = toDepartment(item.caseType);
  const runs = Array.isArray(item.agentRuns) ? item.agentRuns : [];
  const extractionRun = getRunByStep(
    runs,
    (run) => (run.stepKind || '').toUpperCase().includes('DATA_EXTRACTION') || (run.step || '').toLowerCase().includes('data extraction') || (run.step || '').toLowerCase().includes('ocr')
  );
  const validationRun = getRunByStep(
    runs,
    (run) => (run.stepKind || '').toUpperCase().includes('VALIDATION') || (run.step || '').toLowerCase().includes('validation')
  );
  const decisionRun = getRunByStep(
    runs,
    (run) => (run.stepKind || '').toUpperCase().includes('DECISION') || (run.step || '').toLowerCase().includes('decision')
  );
  const policyRun = getRunByStep(
    runs,
    (run) => (run.stepKind || '').toUpperCase().includes('POLICY_LOOKUP') || (run.step || '').toLowerCase().includes('policy lookup')
  );
  const knowledgeRun = getRunByStep(
    runs,
    (run) => (run.stepKind || '').toUpperCase().includes('KNOWLEDGE_CHECK') || (run.step || '').toLowerCase().includes('knowledge')
  );
  const routingRun = getRunByStep(
    runs,
    (run) => (run.stepKind || '').toUpperCase().includes('WORKFLOW_ROUTING') || (run.step || '').toLowerCase().includes('workflow routing')
  );
  const preProcessorRun = getRunByStep(
    runs,
    (run) =>
      (run.stepKind || '').toUpperCase().includes('PRE_PROCESSOR') ||
      (run.step || '').toLowerCase().includes('pre processor')
  );
  const cascadeRun = getRunByStep(
    runs,
    (run) =>
      (run.stepKind || '').toUpperCase().includes('WORKFLOW_CASCADE') ||
      (run.step || '').toLowerCase().includes('cascading orchestration')
  );

  const extractionJson = asRecord(extractionRun?.outputJson);
  const extractedFields = asRecord(extractionJson?.extractedFields);
  const validationJson = asRecord(validationRun?.outputJson);
  const decisionJson = asRecord(decisionRun?.outputJson);
  const policyJson = asRecord(policyRun?.outputJson);
  const knowledgeJson = asRecord(knowledgeRun?.outputJson);
  const routingJson = asRecord(routingRun?.outputJson);
  const preProcessorJson = asRecord(preProcessorRun?.outputJson);
  const cascadeJson = asRecord(cascadeRun?.outputJson);
  const reviewTasks = Array.isArray(item.reviewTasks) ? item.reviewTasks : [];
  const totalProcessingMs = runs.reduce((sum, run) => sum + (typeof run.durationMs === 'number' ? run.durationMs : 0), 0);
  const ocrRun = getRunByStep(
    runs,
    (run) => (run.stepKind || '').toUpperCase().includes('OCR') || (run.step || '').toLowerCase().includes('ocr')
  );
  const ocrJson = asRecord(ocrRun?.outputJson);
  const ocrText = typeof ocrJson?.text === 'string' ? ocrJson.text : '';

  const extractedMemberName =
    (typeof extractedFields?.memberName === 'string' && extractedFields.memberName) ||
    (typeof extractedFields?.claimantName === 'string' && extractedFields.claimantName) ||
    null;
  const memberName = item.memberName || extractedMemberName || 'Unknown';
  const docs = Array.isArray(item.documents) ? item.documents : [];
  const preProcessorPageCount =
    typeof preProcessorJson?.totalPdfPages === 'number' && Number.isFinite(preProcessorJson.totalPdfPages)
      ? Math.max(1, Math.trunc(preProcessorJson.totalPdfPages))
      : undefined;
  const preProcessorDocPageMap = (() => {
    const groups = asRecord(preProcessorJson?.documentGroups);
    const pageMap = new Map<string, number>();
    for (const value of Object.values(groups)) {
      if (!Array.isArray(value)) continue;
      for (const entry of value) {
        const record = asRecord(entry);
        const nameRaw = String(record.name || "").trim().toLowerCase();
        if (!nameRaw) continue;
        const explicitPages = Number(record.pages);
        const explicitPage = Number(record.page);
        const current = pageMap.get(nameRaw) ?? 0;
        if (Number.isFinite(explicitPages) && explicitPages > 0) {
          pageMap.set(nameRaw, Math.max(current, Math.trunc(explicitPages)));
          continue;
        }
        if (Number.isFinite(explicitPage) && explicitPage > 0) {
          pageMap.set(nameRaw, current + 1);
        }
      }
    }
    return pageMap;
  })();
  const docsTotal = typeof item.documentsTotal === 'number' ? item.documentsTotal : docs.length;
  const docsComplete =
    typeof item.documentsComplete === 'number'
      ? item.documentsComplete
      : docs.filter((doc) => (doc.status || '').toLowerCase() === 'uploaded').length;

  const timelineFromRuns = runs.length
    ? runs
        .slice()
        .reverse()
        .slice(0, 8)
        .map((run) => ({
          title: run.step || 'Workflow Step',
          description: run.output || `${run.step || 'Step'} ${run.status || 'completed'}`,
          timestamp: run.createdAt || updated,
          type: 'ai' as const
        }))
    : [];

  const auditTrailFromRuns: AuditEntry[] = runs.map((run) => runToAuditEntry(run, created));
  const openReviewCount = reviewTasks.filter((task) => String(task.status || '').toLowerCase() === 'open').length;

  const validationConfidence = typeof validationJson?.confidence === 'number' ? validationJson.confidence : 0.75;
  const aiInsights: NonNullable<Case['ai_insights']> = [
    {
      id: `${item.id}-insight-summary`,
      type: 'RISK',
      title: 'Decision Summary',
      description:
        (typeof decisionJson?.reason === 'string' && decisionJson.reason) ||
        item.workflowStage ||
        'Automated workflow processing completed for this case.',
      confidence: typeof decisionJson?.confidence_level === 'number' ? decisionJson.confidence_level : validationConfidence,
      agent_id: 'Decision Agent',
      timestamp: decisionRun?.createdAt || updated
    },
    {
      id: `${item.id}-insight-extraction`,
      type: 'OPPORTUNITY',
      title: 'Extraction',
      description:
        (typeof extractionRun?.output === 'string' && extractionRun.output) ||
        `Extracted fields from ${docsTotal} document(s).`,
      confidence: typeof extractionJson?.confidence_level === 'number' ? extractionJson.confidence_level : 0.75,
      agent_id: 'Data Extraction Agent',
      timestamp: extractionRun?.createdAt || updated
    },
    {
      id: `${item.id}-insight-validation`,
      type: 'COMPLIANCE',
      title: 'Validation',
      description:
        (typeof validationRun?.output === 'string' && validationRun.output) ||
        'Validation checks completed against configured workflow policies.',
      confidence: validationConfidence,
      agent_id: 'Validation Agent',
      timestamp: validationRun?.createdAt || updated
    },
    {
      id: `${item.id}-insight-policy-evidence`,
      type: 'COMPLIANCE',
      title: 'Policy Evidence',
      description:
        (typeof knowledgeJson?.summary === 'string' && knowledgeJson.summary) ||
        (typeof knowledgeRun?.output === 'string' && knowledgeRun.output) ||
        'Policy knowledge-base evidence is being evaluated.',
      confidence:
        typeof knowledgeJson?.confidence === 'number'
          ? knowledgeJson.confidence
          : typeof policyJson?.confidence === 'number'
            ? policyJson.confidence
            : 0.72,
      agent_id: 'Knowledge Base Agent',
      timestamp: knowledgeRun?.createdAt || policyRun?.createdAt || updated
    }
  ];

  const validationReasons = Array.isArray(validationJson?.reasons) ? validationJson.reasons : [];
  const riskMarkers: NonNullable<Case['risk_markers']> =
    validationReasons.length > 0
      ? validationReasons.map((reason, idx) => ({
          id: `${item.id}-risk-${idx}`,
          type: 'Validation',
          status: 'WARNING' as const,
          description: typeof reason === 'string' ? reason : 'Validation warning raised.'
        }))
      : [
          {
            id: `${item.id}-risk-default`,
            type: 'Validation',
            status: 'INFO' as const,
            description: 'No significant risk markers identified from current automation signals.'
          }
        ];

  const extractionStatus: NonNullable<Case['document_extraction_status']> = [
    {
      id: `${item.id}-ext-docs`,
      type: 'Documents Received',
      progress: docsTotal > 0 ? 100 : 0,
      status: docsTotal > 0 ? 'COMPLETED' : 'PENDING'
    },
    {
      id: `${item.id}-ext-ocr`,
      type: 'OCR & Extraction',
      progress: extractionRun ? 100 : docsTotal > 0 ? 35 : 0,
      status: extractionRun ? 'COMPLETED' : docsTotal > 0 ? 'IN_PROGRESS' : 'PENDING'
    },
    {
      id: `${item.id}-ext-validation`,
      type: 'Validation',
      progress: validationRun ? 100 : 0,
      status: validationRun ? 'COMPLETED' : 'PENDING'
    }
  ];

  const computedRiskIndex =
    typeof decisionJson?.decision === 'string' && String(decisionJson.decision).toUpperCase() === 'REJECTED'
      ? 82
      : typeof decisionJson?.decision === 'string' && String(decisionJson.decision).toUpperCase() === 'REVIEW_REQUIRED'
        ? 58
        : item.aiStatus === 'error'
          ? 85
          : item.aiStatus === 'needs_review'
            ? 64
            : 28;

  const policyNumber =
    item.policyNumber ||
    (typeof extractedFields?.policyNumber === 'string' && extractedFields.policyNumber) ||
    (typeof policyJson?.policyNumber === 'string' && policyJson.policyNumber) ||
    undefined;

  return {
    id: item.id,
    title: `${mappedType.replace('_', ' ')}: ${memberName}`,
    description: item.workflowStage || 'Automated case from email intake workflow.',
    status: toCaseStatus(item.status, item.aiStatus),
    execution_status: item.status === 'completed' ? 'COMPLETED' : item.status === 'escalated' ? 'ESCALATED' : 'IN_PROGRESS',
    priority: toCasePriority(item.priority),
    type: mappedType,
    department: mappedDepartment,
    claimant: {
      name: memberName,
      dob: '1990-01-01',
      gender: 'OTHER',
      id: item.id,
      email: item.customerEmail || undefined
    },
    policy: item.policyNumber
      ? {
          policy_number: policyNumber,
          policy_type: 'Insurance',
          carrier: 'AuraStack'
        }
      : policyNumber
        ? {
            policy_number: policyNumber,
            policy_type: 'Insurance',
            carrier: 'AuraStack'
          }
        : undefined,
    dates: {
      incident_date: item.incidentDate || created,
      service_date: item.incidentDate || created
    },
    sla: {
      due_date: updated,
      status: (item.status || '').toLowerCase() === 'escalated' ? 'AT_RISK' : 'ON_TRACK'
    },
    created_at: created,
    last_updated: updated,
    assigned_to: item.assignedUserName || 'Unassigned',
    workflow_id: item.workflowStage || undefined,
    risk_score: computedRiskIndex / 10,
    compliance_score: Math.max(1, Math.min(100, Math.round(validationConfidence * 100))),
    summary:
      (typeof decisionJson?.reason === 'string' && decisionJson.reason) ||
      `Case ${item.id} is currently ${item.workflowStage || 'in progress'}.`,
    metadata: {
      source: 'live-api',
      processingMs: totalProcessingMs > 0 ? totalProcessingMs : Math.max(800, runs.length * 850),
      docStats: {
        total: docsTotal,
        complete: docsComplete,
        missing: Math.max(0, docsTotal - docsComplete)
      },
      claimClassification: item.claimClassification || null,
      extractedFields: extractedFields || null,
      ocrText: ocrText || null,
      sourceTextLength: typeof extractionJson?.sourceTextLength === 'number' ? extractionJson.sourceTextLength : null,
      ocrProcessedDocuments: typeof ocrJson?.ocrProcessedDocuments === 'number' ? ocrJson.ocrProcessedDocuments : null,
      ocrFailedDocuments: typeof ocrJson?.ocrFailedDocuments === 'number' ? ocrJson.ocrFailedDocuments : null,
      ocrFailedDocumentNames: Array.isArray(ocrJson?.failedDocumentNames) ? ocrJson.failedDocumentNames : [],
      openReviewCount,
      routingDecision: routingJson || null,
      preProcessor: preProcessorJson || null,
      cascadePlan: cascadeJson || null,
      policyEvidence:
        (Array.isArray(knowledgeJson?.citations) && knowledgeJson.citations.length > 0)
          ? knowledgeJson.citations
          : (Array.isArray(policyJson?.kbEvidence) ? policyJson.kbEvidence : []),
      policyKnowledgeSummary:
        (typeof knowledgeJson?.summary === 'string' && knowledgeJson.summary) ||
        (typeof policyJson?.lookupMethod === 'string' ? `Policy lookup via ${policyJson.lookupMethod}` : null)
    },
    documents: docs.map((doc) => {
      const matchedAttachment = attachmentByDocName.get((doc.name || '').toLowerCase());
      const mimeType = matchedAttachment?.mimeType || doc.type || 'application/octet-stream';
      const contentBase64 = matchedAttachment?.contentBase64;
      const url = contentBase64 ? `data:${mimeType};base64,${contentBase64}` : undefined;
      const parsedDocPages = Number((doc as { pages?: number | string }).pages);
      const normalizedDocPages =
        Number.isFinite(parsedDocPages) && parsedDocPages > 0
          ? Math.max(1, Math.trunc(parsedDocPages))
          : undefined;
      const fallbackPages =
        normalizedDocPages
          ? undefined
          : (
              preProcessorDocPageMap.get(String(doc.name || '').toLowerCase()) ||
              (
                preProcessorPageCount &&
                docs.length === 1 &&
                String(mimeType).toLowerCase().includes('pdf')
                  ? preProcessorPageCount
                  : undefined
              )
            );
      return {
      id: doc.id,
      name: doc.name,
      type: doc.type,
      status: doc.status === 'uploaded' ? 'VERIFIED' : doc.status === 'pending' ? 'PENDING' : 'PENDING',
      uploaded_at: doc.createdAt || updated,
      size: 'N/A',
      pages: normalizedDocPages || fallbackPages,
      url,
      extraction_data: extractedFields || undefined
      };
    }),
    ai_insights: aiInsights,
    risk_markers: riskMarkers,
    document_extraction_status: extractionStatus,
    audit_trail: auditTrailFromRuns,
    timeline: timelineFromRuns.length
      ? timelineFromRuns
      : [
          {
            title: 'Case Created',
            description: item.workflowStage || 'Case created from inbound email.',
            timestamp: created,
            type: 'system'
          }
        ]
  };
};

const mapApiCaseToUiCaseSafe = (
  item: ApiCaseRecord,
  attachmentByDocName: Map<string, { mimeType?: string; contentBase64?: string }> = new Map()
): Case => {
  try {
    return mapApiCaseToUiCase(item, attachmentByDocName);
  } catch (error) {
    console.error('[cases] failed to map case record, using fallback row', item?.id, error);
    const created = item.createdAt || new Date().toISOString();
    const updated = item.updatedAt || created;
    const memberName = item.memberName || 'Unknown';
    const mappedType = toCaseType(item.caseType);
    return {
      id: item.id || `case-${Math.random().toString(36).slice(2, 8)}`,
      title: `${mappedType.replace('_', ' ')}: ${memberName}`,
      description: item.workflowStage || 'Case from API',
      status: toCaseStatus(item.status, item.aiStatus),
      execution_status: 'IN_PROGRESS',
      priority: toCasePriority(item.priority),
      type: mappedType,
      department: toDepartment(item.caseType),
      created_at: created,
      last_updated: updated,
      assigned_to: item.assignedUserName || 'Unassigned',
      risk_score: 0,
      compliance_score: 0,
      summary: item.workflowStage || 'Case loaded with fallback mapper.',
      documents: [],
      timeline: [
        {
          title: 'Case Loaded',
          description: 'Fallback renderer applied for this case record.',
          timestamp: updated,
          type: 'system'
        }
      ]
    };
  }
};

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const adminPathBeforePortal = useRef<string>('/');

  useEffect(() => {
    if (!location.pathname.startsWith('/portal')) {
      adminPathBeforePortal.current = location.pathname;
    }
  }, [location.pathname]);

  const isCustomerMode = location.pathname.startsWith('/portal');

  const getActiveTabFromPath = (path: string) => {
    if (path === '/portal' || path.startsWith('/portal/')) return 'portal';
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return 'home';
    return segments[0];
  };

  const activeTab = getActiveTabFromPath(location.pathname);

  const getActiveIdFromPath = (path: string) => {
    const caseMatch = matchPath('/cases/:id', path);
    if (caseMatch) return caseMatch.params.id;

    const workflowMatch = matchPath('/workflows/:id', path);
    if (workflowMatch) return workflowMatch.params.id;

    const agentMatch = matchPath('/agents/:id', path);
    if (agentMatch) return agentMatch.params.id;

    const systemMatch = matchPath('/system/:subtab', path);
    if (systemMatch) return systemMatch.params.subtab;

    const datalabMatch = matchPath('/datalab/:subtab', path);
    if (datalabMatch) return datalabMatch.params.subtab;

    return null;
  };

  const activeId = getActiveIdFromPath(location.pathname);

  const [roles, setRoles] = useState<Role[]>(() => {
    try {
      const stored = localStorage.getItem('aurastack_rbac_roles');
      if (!stored) return ROLES;
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : ROLES;
    } catch {
      return ROLES;
    }
  });
  const [userRole, setUserRole] = useState<RoleId>(() => {
    try {
      const stored = localStorage.getItem('aurastack_active_role');
      if (!stored) return INITIAL_USER.role;
      return stored as RoleId;
    } catch {
      return INITIAL_USER.role;
    }
  });
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    try {
      localStorage.setItem('aurastack_rbac_roles', JSON.stringify(roles));
    } catch {
      // ignore storage errors
    }
  }, [roles]);

  useEffect(() => {
    try {
      localStorage.setItem('aurastack_active_role', userRole);
    } catch {
      // ignore storage errors
    }
  }, [userRole]);

  useEffect(() => {
    if (!roles.some((role) => role.id === userRole)) {
      setUserRole('ADMIN');
    }
  }, [roles, userRole]);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };
  const [cases, setCases] = useState<Case[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>(INITIAL_WORKFLOWS);
  const [agents, setAgents] = useState<AgentDefinition[]>(INITIAL_AGENTS);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthSessionUser | null>(null);
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null);

  const setSessionStorage = (accessToken: string, refreshToken: string) => {
    localStorage.setItem(AUTH_ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken);
  };

  const clearSessionStorage = () => {
    localStorage.removeItem(AUTH_ACCESS_TOKEN_KEY);
    localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
  };

  const refreshAccessToken = async (): Promise<string | null> => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    refreshInFlightRef.current = (async () => {
      try {
        const refreshToken = localStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
        if (!refreshToken) return null;
        const response = await fetchAuthWithFallback('/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
        if (!response.ok) return null;
        const payload = await response.json();
        const session = payload?.data;
        if (!session?.token || !session?.refreshToken) return null;
        setSessionStorage(session.token, session.refreshToken);
        return String(session.token);
      } catch {
        return null;
      } finally {
        refreshInFlightRef.current = null;
      }
    })();
    return refreshInFlightRef.current;
  };

  const fetchMe = async (token: string): Promise<AuthSessionUser | null> => {
    try {
      const response = await fetchReadEndpoint('/auth/me', {
        Authorization: `Bearer ${token}`
      });
      if (!response.ok) return null;
      const payload = await response.json();
      const user = payload?.data;
      if (!user?.id) return null;
      return {
        id: String(user.id),
        email: user.email ? String(user.email) : null,
        name: String(user.name || 'User'),
        role: String(user.role || '')
      };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : String(input);
      const isApiCall = url.startsWith('/api') || url.includes('/api/');
      const isAuthLogin = /\/api\/auth\/login$/i.test(url);
      const isAuthRefresh = /\/api\/auth\/refresh$/i.test(url);
      const isAuthBootstrap = /\/api\/auth\/bootstrap-admin$/i.test(url);
      const shouldAttach = isApiCall && !isAuthLogin && !isAuthRefresh && !isAuthBootstrap;

      const withAuthHeaders = (token: string | null, requestInit?: RequestInit): RequestInit => {
        const headers = new Headers(requestInit?.headers || (input instanceof Request ? input.headers : undefined));
        if (token && !headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        return {
          ...requestInit,
          headers
        };
      };

      let accessToken = localStorage.getItem(AUTH_ACCESS_TOKEN_KEY);
      let response = await originalFetch(input, shouldAttach ? withAuthHeaders(accessToken, init) : init);

      if (response.status === 401 && shouldAttach) {
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken) {
          accessToken = refreshedToken;
          response = await originalFetch(input, withAuthHeaders(accessToken, init));
        }
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const resolveUser = async (): Promise<AuthSessionUser | null> => {
          let token = localStorage.getItem(AUTH_ACCESS_TOKEN_KEY);
          let user: AuthSessionUser | null = null;

          if (token) {
            user = await fetchMe(token);
          }

          if (!user) {
            token = await refreshAccessToken();
            if (token) {
              user = await fetchMe(token);
            }
          }
          return user;
        };

        const timeoutUser = new Promise<AuthSessionUser | null>((resolve) => {
          window.setTimeout(() => resolve(null), AUTH_BOOTSTRAP_TIMEOUT_MS);
        });

        const user = await Promise.race([resolveUser(), timeoutUser]);

        if (!mounted) return;
        if (user) {
          setAuthUser(user);
          setUserRole(mapApiRoleToUiRole(user.role));
        } else {
          clearSessionStorage();
          setAuthUser(null);
        }
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };

    void initAuth();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogin = async (email: string, password: string) => {
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const response = await fetchAuthWithFallback('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : 'Login failed';
        const err = new Error(
          payload?.message && typeof payload.message === 'string' ? payload.message : message
        ) as Error & { code?: string };
        err.code = typeof payload?.error === 'string' ? payload.error : undefined;
        throw err;
      }
      const session = payload?.data;
      if (!session?.token || !session?.refreshToken || !session?.user) {
        throw new Error('Invalid login response');
      }
      setSessionStorage(String(session.token), String(session.refreshToken));
      const user: AuthSessionUser = {
        id: String(session.user.id),
        email: session.user.email ? String(session.user.email) : null,
        name: String(session.user.name || 'User'),
        role: String(session.user.role || '')
      };
      setAuthUser(user);
      setUserRole(mapApiRoleToUiRole(user.role));
      setAuthError(null);
    } catch (error) {
      const message = error instanceof Error
        ? (error.name === 'AbortError' ? 'Login request timed out. Please verify API server is running.' : error.message)
        : 'Login failed';
      setAuthError(message);
      throw error;
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleFirstLogin = async (email: string, password: string, name?: string): Promise<string> => {
    const response = await fetchAuthWithFallback('/auth/first-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to initialize account');
    }
    const session = payload?.data;
    if (!session?.token || !session?.refreshToken || !session?.user) {
      throw new Error('Invalid first-login response');
    }
    setSessionStorage(String(session.token), String(session.refreshToken));
    const user: AuthSessionUser = {
      id: String(session.user.id),
      email: session.user.email ? String(session.user.email) : null,
      name: String(session.user.name || 'User'),
      role: String(session.user.role || '')
    };
    setAuthUser(user);
    setUserRole(mapApiRoleToUiRole(user.role));
    setAuthError(null);
    return 'Account initialized successfully. Signed in.';
  };

  const handleRequestReset = async (email: string): Promise<string> => {
    const response = await fetchAuthWithFallback('/auth/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to request password reset');
    }
    const message = typeof payload?.data?.message === 'string'
      ? payload.data.message
      : 'Password reset instructions sent.';
    const token = typeof payload?.data?.resetToken === 'string' ? payload.data.resetToken : '';
    return token ? `${message} Dev reset token: ${token}` : message;
  };

  const handleConfirmReset = async (token: string, newPassword: string): Promise<string> => {
    const response = await fetchAuthWithFallback('/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to reset password');
    }
    return 'Password reset successful. You can log in with your new password.';
  };

  const handleLogout = async () => {
    const token = localStorage.getItem(AUTH_ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ refreshToken, revokeAll: true })
        });
      }
    } catch {
      // ignore logout network errors
    } finally {
      clearSessionStorage();
      setAuthUser(null);
      setAuthError(null);
      setUserRole('SUPPORT_AGENT');
      navigate('/');
    }
  };

  useEffect(() => {
    let mounted = true;
    let timer: number | null = null;
    const shouldBackgroundPoll = !(
      /^\/cases\/[^/]+/i.test(location.pathname) ||
      /^\/workflows\/[^/]+/i.test(location.pathname) ||
      /^\/agents\/[^/]+/i.test(location.pathname)
    );

    const loadCases = async () => {
      try {
        const token = localStorage.getItem(AUTH_ACCESS_TOKEN_KEY);
        const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
        const casesResponse = await fetchReadEndpoint('/cases?limit=200', authHeaders);
        if (!casesResponse.ok) {
          if (mounted) {
            setCases([]);
          }
          return;
        }

        const payload = (await casesResponse.json()) as ApiCasesResponse | ApiCaseRecord[];
        const [threadsResult, workflowsResult] = await Promise.allSettled([
          fetchReadEndpoint('/email/threads?limit=500', authHeaders),
          fetchReadEndpoint('/workflows', authHeaders)
        ]);

        let threadsPayload: ApiEmailThreadsResponse | ApiEmailThread[] = { data: [] };
        if (threadsResult.status === 'fulfilled' && threadsResult.value.ok) {
          threadsPayload = (await threadsResult.value.json()) as ApiEmailThreadsResponse | ApiEmailThread[];
        }

        let workflowsPayload: ApiWorkflowsResponse | ApiWorkflowRecord[] = { data: [] };
        if (workflowsResult.status === 'fulfilled' && workflowsResult.value.ok) {
          workflowsPayload = (await workflowsResult.value.json()) as ApiWorkflowsResponse | ApiWorkflowRecord[];
        }

        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.data)
            ? payload.data
            : [];
        const threadsList = Array.isArray(threadsPayload)
          ? threadsPayload
          : Array.isArray(threadsPayload.data)
            ? threadsPayload.data
            : [];
        const workflowList = Array.isArray(workflowsPayload)
          ? workflowsPayload
          : Array.isArray(workflowsPayload.data)
            ? workflowsPayload.data
            : [];

        if (mounted) {
          const casesById = new Map<string, ApiCaseRecord>(list.map((item) => [item.id, item]));
          const mappedConversations = mapEmailThreadsToConversations(threadsList, casesById);
          if (mappedConversations.length > 0) {
            setConversations(mappedConversations);
          }
          if (workflowList.length > 0) {
            setWorkflows(workflowList.map(mapApiWorkflowToUiWorkflow));
          }
        }

        const attachmentSourcesByCase = new Map<string, CaseAttachmentSource[]>();
        for (const thread of threadsList) {
          const caseId = thread.caseId || null;
          if (!caseId) continue;
          const attachments = Array.isArray(thread.attachments) ? thread.attachments : [];
          const attachmentsByName: AttachmentLookup = new Map();
          for (const attachment of attachments) {
            const name = String(attachment?.name || '').toLowerCase();
            if (!name) continue;
            attachmentsByName.set(name, {
              mimeType: attachment?.mimeType,
              contentBase64: attachment?.contentBase64
            });
          }
          if (!attachmentSourcesByCase.has(caseId)) attachmentSourcesByCase.set(caseId, []);
          attachmentSourcesByCase.get(caseId)!.push({
            createdAtMs: thread.createdAt ? Date.parse(thread.createdAt) : Date.now(),
            attachmentsByName
          });
        }

        if (!mounted) return;
        if (list.length > 0) {
          const mappedCases = list.map((item) =>
            mapApiCaseToUiCaseSafe(
              item,
              pickBestAttachmentSourceForCase(item, attachmentSourcesByCase.get(item.id) ?? [])
            )
          );

          const detailCaseMatch = matchPath('/cases/:id', location.pathname);
          const detailCaseId = detailCaseMatch?.params?.id;
          if (detailCaseId) {
            try {
              const detailResponse = await fetchReadEndpoint(`/cases/${detailCaseId}`, authHeaders);
              if (detailResponse.ok) {
                const detailPayload = await detailResponse.json() as { data?: ApiCaseRecord } | ApiCaseRecord;
                const detailRecord = (detailPayload && typeof detailPayload === 'object' && 'data' in detailPayload)
                  ? detailPayload.data
                  : detailPayload;
                if (detailRecord && typeof detailRecord === 'object' && typeof detailRecord.id === 'string') {
                  const mappedDetail = mapApiCaseToUiCaseSafe(
                    detailRecord,
                    pickBestAttachmentSourceForCase(
                      detailRecord,
                      attachmentSourcesByCase.get(detailRecord.id) ?? []
                    )
                  );
                  const detailIndex = mappedCases.findIndex((entry) => entry.id === mappedDetail.id);
                  if (detailIndex >= 0) {
                    mappedCases[detailIndex] = mappedDetail;
                  } else {
                    mappedCases.unshift(mappedDetail);
                  }
                }
              }
            } catch {
              // Keep list mapping as-is if detail enrich fails.
            }
          }

          setCases(mappedCases);

          const mappedTasks: TaskInstance[] = [];
          const mappedLogs: ExecutionLog[] = [];
          for (const item of list) {
            const runs = Array.isArray(item.agentRuns) ? item.agentRuns : [];
            const reviewTasks = Array.isArray(item.reviewTasks) ? item.reviewTasks : [];
            const department = toDepartment(item.caseType);

            for (const run of runs) {
              mappedTasks.push({
                id: run.id,
                case_id: item.id,
                workflow_id: item.workflowStage || 'workflow',
                node_id: run.stepKind || run.step || 'workflow_step',
                actor: {
                  type: toActorType(run),
                  id: run.agentId || run.agentName || 'system'
                },
                status: toExecutionStatus(run.status),
                input: run.inputJson || {},
                output: run.outputJson || run.output || null,
                error: run.error || undefined,
                started_at: run.createdAt || item.createdAt || new Date().toISOString(),
                completed_at: ['completed', 'failed', 'success', 'error'].includes(String(run.status || '').toLowerCase())
                  ? (run.updatedAt || run.createdAt || item.updatedAt || item.createdAt || new Date().toISOString())
                  : undefined,
                retry_count: 0
              });

              mappedLogs.push({
                id: `log-${run.id}`,
                case_id: item.id,
                task_id: run.id,
                event: String(run.status || 'completed').toUpperCase(),
                details: run.output || `${run.step || 'Workflow Step'} ${run.status || 'completed'}`,
                timestamp: run.createdAt || item.createdAt || new Date().toISOString(),
                department
              });
            }

            for (const task of reviewTasks) {
              mappedTasks.push({
                id: task.id,
                case_id: item.id,
                workflow_id: item.workflowStage || 'workflow',
                node_id: 'human_review',
                actor: {
                  type: 'human',
                  id: task.assignedTo || 'unassigned_reviewer'
                },
                status: String(task.status || '').toLowerCase() === 'open' ? 'IN_PROGRESS' : 'COMPLETED',
                input: { reason: task.reason || 'Manual review required' },
                output: null,
                started_at: task.createdAt || item.createdAt || new Date().toISOString(),
                completed_at: String(task.status || '').toLowerCase() === 'open'
                  ? undefined
                  : (task.updatedAt || task.createdAt || item.updatedAt || item.createdAt || new Date().toISOString()),
                retry_count: 0
              });
            }
          }

          setTasks(mappedTasks);
          setLogs(mappedLogs);
        }
      } catch {
        // Keep UI on demo fallback if API is unavailable.
      } finally {
        if (mounted && shouldBackgroundPoll) {
          timer = window.setTimeout(loadCases, 15000);
        }
      }
    };

    void loadCases();
    return () => {
      mounted = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [location.pathname]);

  const hasPermission = (permission: Permission) => {
    const role = roles.find(r => r.id === userRole);
    return role?.permissions.includes(permission) || false;
  };

  useEffect(() => {
    ExecutionEngine.getInstance().init(setCases, setTasks, setLogs);

    const handleViewCase = (e: any) => {
      const caseId = e.detail;
      navigate(`/cases/${caseId}`);
    };

    const handleViewWorkflow = (e: any) => {
      const workflowId = e.detail;
      navigate(`/workflows/${workflowId}`);
    };

    const handleHospitalMessage = (e: any) => {
      const { caseId, content, sender } = e.detail;
      setConversations(prev => prev.map(conv => {
        if (conv.linked_case_id === caseId || conv.id === caseId) {
          const newMessage: Message = {
            id: uuidv4(),
            sender: sender || 'AI',
            content,
            timestamp: new Date().toISOString()
          };
          return {
            ...conv,
            messages: [...conv.messages, newMessage],
            last_message_at: newMessage.timestamp,
            status: 'IN_PROGRESS'
          };
        }
        return conv;
      }));
    };

    const handleAuraCommunication = (e: any) => {
      const { caseId, content } = e.detail;
      setConversations(prev => prev.map(conv => {
        if (conv.linked_case_id === caseId) {
          const newMessage: Message = {
            id: uuidv4(),
            sender: 'AI',
            content,
            timestamp: new Date().toISOString()
          };
          return {
            ...conv,
            messages: [...conv.messages, newMessage],
            last_message_at: newMessage.timestamp,
            status: 'IN_PROGRESS'
          };
        }
        return conv;
      }));
    };

    window.addEventListener('view-case', handleViewCase);
    window.addEventListener('view-workflow', handleViewWorkflow);
    window.addEventListener('hospital-message-sent', handleHospitalMessage);
    window.addEventListener('aura-communication-sent', handleAuraCommunication);
    return () => {
      window.removeEventListener('view-case', handleViewCase);
      window.removeEventListener('view-workflow', handleViewWorkflow);
      window.removeEventListener('hospital-message-sent', handleHospitalMessage);
      window.removeEventListener('aura-communication-sent', handleAuraCommunication);
    };
  }, [navigate]);

  const ProtectedRoute = ({ children, permission }: { children: React.ReactNode, permission?: Permission }) => {
    if (permission && !hasPermission(permission)) {
      return (
        <div className="flex flex-col items-center justify-center h-full opacity-50">
          <ShieldAlert size={64} className="text-error mb-4" />
          <h2 className="text-xl font-bold uppercase tracking-widest">Access Restricted</h2>
          <p className="text-xs mt-2">Your current role ({userRole}) does not have permission to view this section.</p>
        </div>
      );
    }
    return <>{children}</>;
  };

  const handleApprove = () => {
    if (activeTab === 'cases' && activeId) {
      setCases(prev => prev.map(c =>
        c.id === activeId ? { ...c, status: 'STABLE' as const, execution_status: 'COMPLETED' as const } : c
      ));
      import('sonner').then(({ toast }) => toast.success(`Case ${activeId} approved successfully.`));
    }
  };

  const canApprove = activeTab === 'cases' && !!activeId;

  const filteredCases = cases.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWorkflows = workflows.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.workflow_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAgents = agents.filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.agent_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeItem =
    activeTab === 'cases' ? cases.find(c => c.id === activeId) :
    activeTab === 'workflows' ? workflows.find(w => w.workflow_id === activeId) :
    activeTab === 'agents' ? agents.find(a => a.agent_id === activeId) :
    activeTab === 'fraud' ? { id: 'fraud', title: 'FRAUD DETECTION' } :
    activeTab === 'system' ? { id: activeId || 'health', title: (activeId || 'health').toUpperCase() } :
    activeTab === 'datalab' ? { id: activeId || 'connectors', title: (activeId || 'connectors').toUpperCase() } : null;

  const handleToggleCustomerMode = () => {
    if (isCustomerMode) {
      navigate(adminPathBeforePortal.current || '/');
    } else {
      navigate('/portal');
    }
  };

  if (authLoading) {
    return (
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center">
          <div className="text-sm uppercase tracking-widest text-on-surface-variant">Authenticating...</div>
        </div>
      </ThemeContext.Provider>
    );
  }

  if (!authUser) {
    return (
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <LoginPage
          onLogin={handleLogin}
          onFirstLogin={handleFirstLogin}
          onRequestReset={handleRequestReset}
          onConfirmReset={handleConfirmReset}
          loading={authSubmitting}
          error={authError}
        />
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <PermissionContext.Provider value={{ hasPermission, userRole, setUserRole, roles, setRoles }}>
        <Toaster position="top-right" expand={false} richColors />
        <div className="min-h-screen text-on-surface selection:bg-primary/30">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => navigate(`/${tab === 'home' ? '' : tab}`)}
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <main className={`relative pt-14 min-h-screen transition-all duration-300 ${isSidebarCollapsed ? 'pl-16' : 'pl-44'} pr-0`}>
          <TopBar
            activeTab={isCustomerMode ? 'customer_portal' : activeTab}
            activeItem={activeItem}
            isCustomerMode={isCustomerMode}
            onToggleCustomerMode={handleToggleCustomerMode}
            isSidebarVisible={true}
            isSidebarCollapsed={isSidebarCollapsed}
            onBackToHome={() => navigate('/')}
            onNavigate={(path) => navigate(path)}
            onSearch={setSearchQuery}
            onApprove={handleApprove}
            canApprove={canApprove}
          />
          <div className="absolute right-3 top-16 z-40 flex items-center gap-2 rounded-md border border-outline bg-card/95 px-2 py-1 text-[10px] uppercase tracking-wider text-on-surface-variant">
            <span>{authUser.name}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded bg-primary/15 px-2 py-1 text-primary hover:bg-primary/25"
            >
              Logout
            </button>
          </div>

          <div className={`relative h-[calc(100vh-3.5rem)] min-h-0 ${location.pathname === '/inbox' ? 'overflow-hidden' : 'overflow-y-auto'} custom-scrollbar`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`p-0 h-full min-h-0 ${location.pathname === '/inbox' ? 'overflow-hidden flex flex-col' : ''}`}
              >
                <Routes>
                  <Route path="/portal" element={
                    <CustomerPortal conversations={conversations} setConversations={setConversations} />
                  } />
                  <Route path="/" element={<HomeView />} />
                  <Route path="/home" element={<Navigate to="/" replace />} />
                  <Route path="/inbox" element={
                    <ProtectedRoute permission="VIEW_INBOX">
                      <InboxView conversations={conversations} setConversations={setConversations} setCases={setCases} workflows={workflows} agents={agents} />
                    </ProtectedRoute>
                  } />
                  <Route path="/cases" element={
                    <ProtectedRoute permission="VIEW_CASES">
                      <CasesView cases={cases} setCases={setCases} tasks={tasks} logs={logs} workflows={workflows} agents={agents} selectedCaseId={null} setSelectedCaseId={(id) => navigate(id ? `/cases/${id}` : '/cases')} setActiveTab={(tab) => navigate(`/${tab}`)} />
                    </ProtectedRoute>
                  } />
                  <Route path="/cases/:id" element={
                    <ProtectedRoute permission="VIEW_CASES">
                      <CasesView cases={cases} setCases={setCases} tasks={tasks} logs={logs} workflows={workflows} agents={agents} selectedCaseId={null} setSelectedCaseId={(id) => navigate(id ? `/cases/${id}` : '/cases')} setActiveTab={(tab) => navigate(`/${tab}`)} />
                    </ProtectedRoute>
                  } />
                  <Route path="/workflows" element={
                    <ProtectedRoute permission="VIEW_WORKFLOWS">
                      <WorkflowsView workflows={workflows} setWorkflows={setWorkflows} selectedWorkflowId={null} setSelectedWorkflowId={(id) => navigate(id ? `/workflows/${id}` : '/workflows')} agents={agents} cases={cases} />
                    </ProtectedRoute>
                  } />
                  <Route path="/workflows/:id" element={
                    <ProtectedRoute permission="VIEW_WORKFLOWS">
                      <WorkflowsView workflows={workflows} setWorkflows={setWorkflows} selectedWorkflowId={null} setSelectedWorkflowId={(id) => navigate(id ? `/workflows/${id}` : '/workflows')} agents={agents} cases={cases} />
                    </ProtectedRoute>
                  } />
                  <Route path="/agents" element={
                    <ProtectedRoute permission="VIEW_AGENTS">
                      <AgentsView agents={filteredAgents} setAgents={setAgents} selectedAgentId={null} setSelectedAgentId={(id) => navigate(id ? `/agents/${id}` : '/agents')} />
                    </ProtectedRoute>
                  } />
                  <Route path="/agents/:id" element={
                    <ProtectedRoute permission="VIEW_AGENTS">
                      <AgentsView agents={filteredAgents} setAgents={setAgents} selectedAgentId={null} setSelectedAgentId={(id) => navigate(id ? `/agents/${id}` : '/agents')} />
                    </ProtectedRoute>
                  } />
                  <Route path="/datalab" element={
                    <ProtectedRoute permission="VIEW_DATA_LAB">
                      <DataLabView onImport={(newCases) => setCases(prev => [...newCases, ...prev])} />
                    </ProtectedRoute>
                  } />
                  <Route path="/datalab/:subtab" element={
                    <ProtectedRoute permission="VIEW_DATA_LAB">
                      <DataLabView onImport={(newCases) => setCases(prev => [...newCases, ...prev])} />
                    </ProtectedRoute>
                  } />
                  <Route path="/fraud" element={
                    <ProtectedRoute permission="VIEW_DATA_LAB">
                      <FraudDetectionView />
                    </ProtectedRoute>
                  } />
                  <Route path="/system" element={
                    <ProtectedRoute permission="VIEW_SYSTEM">
                      <SystemView logs={logs} />
                    </ProtectedRoute>
                  } />
                  <Route path="/system/:subtab" element={
                    <ProtectedRoute permission="VIEW_SYSTEM">
                      <SystemView logs={logs} />
                    </ProtectedRoute>
                  } />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      </PermissionContext.Provider>
    </ThemeContext.Provider>
  );
};

export default App;
