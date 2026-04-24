/**
 * Real API service - connects the frontend to AuraStack backend.
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";
const AUTH_STORAGE_KEY = "aurastack_auth_tokens_v1";

export type AuthRole = "admin" | "operator" | "reviewer";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AuthRole;
}

export interface AuthSession {
  token: string;
  refreshToken: string;
  user: AuthUser;
}

let accessToken: string | null = null;
let refreshTokenValue: string | null = null;
let refreshingPromise: Promise<boolean> | null = null;
let unauthorizedHandler: (() => void) | null = null;

function persistTokens(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!accessToken || !refreshTokenValue) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({ token: accessToken, refreshToken: refreshTokenValue })
  );
}

export function setAuthTokens(tokens: { token: string; refreshToken: string }): void {
  accessToken = tokens.token;
  refreshTokenValue = tokens.refreshToken;
  persistTokens();
}

export function clearAuthTokens(): void {
  accessToken = null;
  refreshTokenValue = null;
  persistTokens();
}

export function restoreAuthTokens(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return false;
  }
  try {
    const parsed = JSON.parse(raw) as { token?: string; refreshToken?: string };
    if (!parsed.token || !parsed.refreshToken) {
      return false;
    }
    accessToken = parsed.token;
    refreshTokenValue = parsed.refreshToken;
    return true;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return false;
  }
}

export function registerUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshTokenValue) {
    return false;
  }
  if (refreshingPromise) {
    return refreshingPromise;
  }
  refreshingPromise = (async () => {
    try {
      const response = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refreshTokenValue })
      });
      if (!response.ok) {
        clearAuthTokens();
        return false;
      }
      const body = await response.json();
      const session = body?.data as AuthSession | undefined;
      if (!session?.token || !session?.refreshToken) {
        clearAuthTokens();
        return false;
      }
      setAuthTokens({ token: session.token, refreshToken: session.refreshToken });
      return true;
    } catch {
      clearAuthTokens();
      return false;
    } finally {
      refreshingPromise = null;
    }
  })();
  return refreshingPromise;
}

async function req<T>(path: string, opts?: RequestInit, allowRefresh = true): Promise<T> {
  const headers = new Headers(opts?.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers
  });
  if (res.status === 401 && allowRefresh && path !== "/auth/login" && path !== "/auth/refresh") {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return req<T>(path, opts, false);
    }
    unauthorizedHandler?.();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${path}: ${res.status} ${text}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

export const login = (input: { email: string; password: string }) =>
  req<{ data: AuthSession }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  }).then((r) => r.data);

export const getMe = () =>
  req<{ data: AuthUser }>("/auth/me").then((r) => r.data);

export const logout = (refreshToken?: string) =>
  req<{ data: { revoked: boolean } }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ revokeAll: true, refreshToken: refreshToken ?? refreshTokenValue ?? undefined })
  }).then((r) => r.data);

// -- Cases -------------------------------------------------------------------

export interface ApiCase {
  id: string;
  memberName: string;
  caseType: string;
  status: string;
  priority: string;
  aiStatus: string;
  workflowStage: string;
  customerEmail?: string | null;
  claimClassification?: string | null;
  policyNumber?: string | null;
  claimAmount?: number | null;
  incidentDate?: string | null;
  documentsTotal?: number;
  documentsComplete?: number;
  assigned?: string;
  createdAt: string;
  updatedAt: string;
  documents: { id: string; name: string; type: string; status: string; pages?: number }[];
  agentRuns: {
    id: string;
    step: string;
    status: string;
    createdAt: string;
    output?: string;
    outputJson?: Record<string, unknown> | null;
    error?: string | null;
    agentName?: string | null;
    stepKind?: string | null;
  }[];
  reviewTasks: { id: string; status: string; reason: string }[];
}

export interface ApiCasesResponse {
  data: ApiCase[];
  total: number;
  page: number;
  limit: number;
}

export const getCases = (params?: { page?: number; limit?: number; status?: string; domain?: string }) => {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.status) q.set("status", params.status);
  if (params?.domain) q.set("domain", params.domain);
  return req<ApiCasesResponse>(`/cases?${q}`);
};

export const getCase = (id: string) => req<{ data: ApiCase }>(`/cases/${id}`).then((r) => r.data);

export interface CreateCaseInput {
  memberName: string;
  caseType: string;
  priority?: string;
  description?: string;
}

export const createCase = (input: CreateCaseInput) =>
  req<{ data: ApiCase }>("/cases", { method: "POST", body: JSON.stringify(input) }).then((r) => r.data);

export const updateCaseStatus = (id: string, status: string) =>
  req<{ data: ApiCase }>(`/cases/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }).then((r) => r.data);

// -- Execution / Pipeline ----------------------------------------------------

export interface ExecutionStep {
  id: string;
  stepName: string;
  stepType: string;
  status: string;
  output?: Record<string, unknown>;
  decision?: string;
  errorMessage?: string;
  durationMs?: number;
  startedAt?: string;
  finishedAt?: string;
}

export interface CaseExecution {
  id: string;
  status: string;
  source: string;
  startedAt: string;
  finishedAt?: string;
  workflow: { name: string };
  steps: ExecutionStep[];
}

export const getCaseExecution = (caseId: string) =>
  req<{ data: CaseExecution }>(`/cases/${caseId}/execution`)
    .then((r) => r.data)
    .catch(() => null);

// -- Agents ------------------------------------------------------------------

export interface ApiAgent {
  id: string;
  name: string;
  kind?: string;
  agentType?: string;
  instructions: string;
  rules?: string[];
  policyRules?: string[];
  createdAt: string;
}

export const getAgents = () =>
  req<{ data: ApiAgent[] }>("/agents").then((r) => r.data);

// -- Workflows ---------------------------------------------------------------

export interface ApiWorkflow {
  id: string;
  key?: string | null;
  name: string;
  category?: string;
  description?: string;
  steps: { id: string; name: string; type?: string; stepType?: string; agentType?: string }[];
  status: string;
  createdAt: string;
}

export const getWorkflows = (params?: { domain?: string }) => {
  const q = new URLSearchParams();
  if (params?.domain) q.set("domain", params.domain);
  return req<{ data: ApiWorkflow[] }>(`/workflows?${q}`).then((r) => r.data);
};

export const getWorkflowLibrary = () =>
  req<{ data: Record<string, Array<{ name: string; agents: string[] }>> }>("/workflows/library").then((r) => r.data);

// -- Review Queue ------------------------------------------------------------

export const getReviewQueue = () =>
  req<{ data: ApiCase[] }>("/cases?status=review&limit=50").then((r) => r.data);

// -- Analytics ---------------------------------------------------------------

export interface AnalyticsSummary {
  totalCases: number;
  inProgress: number;
  needsReview: number;
  completed: number;
  escalated: number;
}

export const getAnalytics = () =>
  req<{ data: AnalyticsSummary }>("/analytics/summary")
    .catch(() => ({
      data: { totalCases: 0, inProgress: 0, needsReview: 0, completed: 0, escalated: 0 }
    }))
    .then((r) => r.data);

export const getBfsiAnalytics = (rangeDays = 30) =>
  req<{ data: Record<string, unknown> }>(`/analytics/bfsi?rangeDays=${rangeDays}`).then((r) => r.data);

// -- Email / Inbox -----------------------------------------------------------

export const triggerEmailPoll = () =>
  req<void>("/email/poll", { method: "POST" }).catch(() => undefined);

export interface InboxEmailConfig {
  id: string;
  label: string;
  email: string;
  host: string;
  port: number;
  username: string;
  password: string;
  mailbox: string;
  pollInterval: number;
  isActive: boolean;
  domain?: string | null;
  workflowKey?: string | null;
  claimTypeKey?: string | null;
  autoReplyEnabled?: boolean;
}

export interface InboxEmailUpsertInput {
  label: string;
  email: string;
  host: string;
  port: number;
  username: string;
  password: string;
  mailbox: string;
  pollInterval: number;
  isActive: boolean;
  domain?: string | null;
  workflowKey?: string | null;
  claimTypeKey?: string | null;
  autoReplyEnabled?: boolean;
}

export const getInboxSettings = () =>
  req<{ data: InboxEmailConfig[] }>("/inbox-settings").then((r) => r.data);

export const createInboxSetting = (input: InboxEmailUpsertInput) =>
  req<{ data: InboxEmailConfig }>("/inbox-settings", {
    method: "POST",
    body: JSON.stringify(input)
  }).then((r) => r.data);

export const updateInboxSetting = (id: string, input: Partial<InboxEmailUpsertInput>) =>
  req<{ data: InboxEmailConfig }>(`/inbox-settings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  }).then((r) => r.data);

export const deleteInboxSetting = (id: string) =>
  req<{ data: { deleted: boolean } }>(`/inbox-settings/${id}`, {
    method: "DELETE"
  }).then((r) => r.data);

// -- Demo --------------------------------------------------------------------

export type DemoScenario = "health_approved" | "auto_review" | "property_approved" | "missing_rejected";

export const injectDemo = (scenario: DemoScenario) =>
  req<{ caseId: string; executionId: string }>("/demo/inject", {
    method: "POST",
    body: JSON.stringify({ scenario })
  });

// -- AI Assistant ------------------------------------------------------------

export interface AssistantChatResponse {
  reply: string;
  action?: "workflow_created" | "workflow_exists" | "none";
  workflow?: {
    id: string;
    key?: string | null;
    name: string;
    description?: string | null;
    category?: string;
    stepsCount?: number;
  } | null;
}

export const assistantChat = (message: string, domain?: string) =>
  req<{ data: AssistantChatResponse }>("/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ message, domain })
  }).then((r) => r.data);

export interface AssistantActionLog {
  id: string;
  action: string;
  resource: string;
  status: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  user?: { id: string; name: string; email: string } | null;
}

export const getAssistantActions = (limit = 50) =>
  req<{ data: AssistantActionLog[] }>(`/assistant/actions?limit=${limit}`).then((r) => r.data);

export interface WorkflowExecutionSummary {
  workflowId: string;
  workflowName: string;
  category: string;
  status: string;
  runs: number;
  completed: number;
  failed: number;
  queued: number;
  running: number;
  successRatePct: number;
  avgDurationSec: number;
  lastRunAt: string | null;
}

export const getWorkflowExecutionMetrics = (params?: { domain?: string; rangeDays?: number }) => {
  const q = new URLSearchParams();
  if (params?.domain) q.set("domain", params.domain);
  if (params?.rangeDays) q.set("rangeDays", String(params.rangeDays));
  return req<{ data: WorkflowExecutionSummary[] }>(`/analytics/workflow-executions?${q}`).then((r) => r.data);
};

export interface WorkflowEmailPlaybook {
  workflowId: string;
  workflowName: string;
  notifyStepId: string;
  playbook: {
    acknowledgementSubject: string;
    acknowledgementBody: string;
    approvalSubject: string;
    approvalBody: string;
    rejectionSubject: string;
    rejectionBody: string;
    reviewSubject: string;
    reviewBody: string;
  };
}

export const getWorkflowEmailPlaybook = (workflowId: string) =>
  req<{ data: WorkflowEmailPlaybook }>(`/workflows/${workflowId}/email-playbook`).then((r) => r.data);

export const updateWorkflowEmailPlaybook = (workflowId: string, playbook: WorkflowEmailPlaybook["playbook"]) =>
  req<{ data: WorkflowEmailPlaybook }>(`/workflows/${workflowId}/email-playbook`, {
    method: "PATCH",
    body: JSON.stringify({ playbook })
  }).then((r) => r.data);
