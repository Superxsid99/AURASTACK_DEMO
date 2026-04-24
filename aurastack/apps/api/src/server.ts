import "dotenv/config";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { Prisma, PrismaClient } from "@prisma/client";
import { Server as SocketIOServer } from "socket.io";
import { z } from "zod";
import type {
  AgentRunEvent,
  IntakeJobEvent
} from "@smart-case-buddy/shared-types";
import { closeQueue, enqueueIntakeJob } from "./queue.js";
import { closeWorkflowQueue } from "./workflow.queue.js";
import { WorkflowEngine } from "./workflowEngine.js";
import { WORKFLOW_STEP_TYPES } from "./workflow.types.js";
import { BFSI_WORKFLOW_LIBRARY, buildBfsiAnalytics, type BfsiWorkflowTemplate } from "./bfsi.js";
import {
  FRAUD_RULE_LIBRARY,
  detectFraud,
  type FraudDemoCase,
  getFraudDemoCaseById,
  getFraudDemoCases,
  getFraudTaxonomy,
  runFraudDemoSweep,
  type FraudSector
} from "./fraudSystem.js";

const prisma = new PrismaClient();
const app = Fastify({
  logger: true,
  bodyLimit: Number(process.env.API_BODY_LIMIT_BYTES ?? 120 * 1024 * 1024)
});

const port = Number(process.env.API_PORT ?? 8000);
const host = process.env.API_HOST ?? "0.0.0.0";
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:8080";
const agentsServiceUrl = process.env.AGENTS_SERVICE_URL ?? "http://localhost:8001";
const authRequired = (process.env.AUTH_REQUIRED ?? "true") === "true";
const internalWorkerToken = process.env.INTERNAL_WORKER_TOKEN ?? "dev-worker-token";
const accessTokenTtl = process.env.ACCESS_TOKEN_TTL ?? "15m";
const refreshTokenTtlDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30);
const bootstrapAdminToken = process.env.BOOTSTRAP_ADMIN_TOKEN ?? "";
const bootstrapAdminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL ?? "";
const bootstrapAdminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
const bootstrapAdminName = process.env.BOOTSTRAP_ADMIN_NAME ?? "Platform Admin";
const imapHost = process.env.IMAP_HOST ?? "imap.gmail.com";
const imapPort = Number(process.env.IMAP_PORT ?? 993);
const imapUser = process.env.IMAP_USER ?? "";
const imapPass = process.env.IMAP_PASS ?? "";
const imapMailbox = process.env.IMAP_MAILBOX ?? "INBOX";
const imapPollInterval = Number(process.env.IMAP_POLL_INTERVAL ?? 60);
const auditSignatureSecret = process.env.AUDIT_SIGNATURE_SECRET ?? (process.env.JWT_SECRET ?? "dev-jwt-secret");
const allowedAccountDomains = (process.env.ACCOUNT_ALLOWED_EMAIL_DOMAINS ?? "")
  .split(",")
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean);
const defaultLoginAllowlist = [
  "sidhant@claritty.in",
  "test@claritty.in",
  "test2@claritty.in",
  "test3@claritty.in",
  "test4@claritty.in",
  "test5@claritty.in"
];
const allowedLoginEmails = (process.env.AUTH_ALLOWED_LOGIN_EMAILS ?? defaultLoginAllowlist.join(","))
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const policyDocsDirectoryCandidates = process.env.POLICY_DOCS_DIR?.trim()
  ? [path.resolve(process.env.POLICY_DOCS_DIR.trim())]
  : [
      path.resolve(process.cwd(), "policy docs"),
      path.resolve(process.cwd(), "docs_important"),
      path.resolve(process.cwd(), "..", "policy docs"),
      path.resolve(process.cwd(), "..", "docs_important"),
      path.resolve(process.cwd(), "..", "..", "policy docs"),
      path.resolve(process.cwd(), "..", "..", "docs_important"),
      path.resolve(process.cwd(), "..", "..", "..", "policy docs"),
      path.resolve(process.cwd(), "..", "..", "..", "docs_important")
    ];
const medicalRecordsDirectoryCandidates = process.env.MED_RECORDS_DIR?.trim()
  ? [path.resolve(process.env.MED_RECORDS_DIR.trim())]
  : [
      path.resolve(process.cwd(), "med records"),
      path.resolve(process.cwd(), "..", "med records"),
      path.resolve(process.cwd(), "..", "..", "med records"),
      path.resolve(process.cwd(), "..", "..", "..", "med records")
    ];

await app.register(cors, {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
});

await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? "dev-jwt-secret"
});

const io = new SocketIOServer(app.server, {
  cors: {
    origin: webOrigin,
    credentials: true
  }
});

io.use(async (socket, next) => {
  if (!authRequired) {
    return next();
  }

  const authToken = typeof socket.handshake.auth?.token === "string"
    ? socket.handshake.auth.token
    : undefined;
  const headerAuth = socket.handshake.headers.authorization;
  const headerToken = typeof headerAuth === "string" && headerAuth.startsWith("Bearer ")
    ? headerAuth.slice("Bearer ".length)
    : undefined;
  const token = authToken ?? headerToken;

  if (!token) {
    return next(new Error("Unauthorized socket connection"));
  }

  try {
    const payload = await app.jwt.verify<AuthJwtPayload>(token);
    socket.data.user = payload;
    return next();
  } catch {
    return next(new Error("Unauthorized socket connection"));
  }
});

io.on("connection", (socket) => {
  socket.on("subscribeCase", (caseId: string) => {
    if (authRequired && !socket.data.user) {
      socket.emit("socketError", { error: "Unauthorized" });
      return;
    }
    socket.join(`case:${caseId}`);
  });
});

const flowStepSchema = z.object({
  id: z.string(),
  kind: z.enum(["extraction", "validation", "human_review"]),
  agentName: z.string(),
  nextOnSuccess: z.string().nullable(),
  nextOnFailure: z.string().nullable()
});

const flowConfigSchema = z.object({
  name: z.string(),
  steps: z.array(flowStepSchema)
});

type FlowStep = z.infer<typeof flowStepSchema>;
type FlowConfig = z.infer<typeof flowConfigSchema>;

const defaultFlowConfig: FlowConfig = {
  name: "Default Intake + Triage Flow",
  steps: [
    {
      id: "step_extract",
      kind: "extraction",
      agentName: "intakeExtractionAgent",
      nextOnSuccess: "step_validate",
      nextOnFailure: "step_review",
    },
    {
      id: "step_validate",
      kind: "validation",
      agentName: "triageValidationAgent",
      nextOnSuccess: null,
      nextOnFailure: "step_review"
    },
    {
      id: "step_review",
      kind: "human_review",
      agentName: "humanReviewQueue",
      nextOnSuccess: null,
      nextOnFailure: null
    }
  ]
};

const authLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
const authBootstrapSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(8),
  token: z.string().optional()
});
const authPasswordResetRequestSchema = z.object({
  email: z.string().email()
});
const authPasswordResetConfirmSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8)
});
const authFirstLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(120).optional()
});
const RBAC_ROLES = [
  "admin",
  "operator",
  "reviewer",
  "medical_adjuster",
  "underwriter",
  "compliance_officer",
  "claims_manager",
  "support_agent",
  "case_reviewer",
  "fraud_analyst",
  "financial_officer",
  "hospital_coord"
] as const;

const authCreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8),
  role: z.enum(RBAC_ROLES)
});
const authUpdateRoleSchema = z.object({
  role: z.enum(RBAC_ROLES)
});
const authUpdatePasswordSchema = z.object({
  currentPassword: z.string().min(8).optional(),
  newPassword: z.string().min(8)
});
const provisionUserSchema = z.object({
  token: z.string(),
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8),
  role: z.enum(RBAC_ROLES)
});
const authRefreshSchema = z.object({
  refreshToken: z.string().min(10)
});
const authLogoutSchema = z.object({
  refreshToken: z.string().min(10).optional(),
  revokeAll: z.boolean().optional()
});
const revokeSessionSchema = z.object({
  sessionId: z.string()
});
const fraudSectorSchema = z.enum(["insurance", "banking"]);
const fraudDetectInputSchema = z.object({
  caseId: z.string().optional(),
  sector: fraudSectorSchema,
  title: z.string().optional(),
  amount: z.coerce.number().nonnegative().optional(),
  signals: z.record(z.string(), z.any()).optional().default({})
});

type AppRole = (typeof RBAC_ROLES)[number];
type AuthJwtPayload = { sub: string; email: string; role: string; name: string };
type AppPermission =
  | "VIEW_MEDICAL_RECORDS"
  | "EDIT_FINANCIALS"
  | "MANAGE_ROLES"
  | "VIEW_AUDIT_TRAIL"
  | "EDIT_WORKFLOWS"
  | "IMPORT_DATA"
  | "EXECUTE_WORKFLOWS"
  | "VIEW_CASES";

const rolePermissions: Record<AppRole, AppPermission[]> = {
  admin: [
    "VIEW_MEDICAL_RECORDS",
    "EDIT_FINANCIALS",
    "MANAGE_ROLES",
    "VIEW_AUDIT_TRAIL",
    "EDIT_WORKFLOWS",
    "IMPORT_DATA",
    "EXECUTE_WORKFLOWS",
    "VIEW_CASES"
  ],
  operator: [
    "VIEW_MEDICAL_RECORDS",
    "EDIT_FINANCIALS",
    "EDIT_WORKFLOWS",
    "IMPORT_DATA",
    "EXECUTE_WORKFLOWS",
    "VIEW_CASES"
  ],
  reviewer: [
    "VIEW_MEDICAL_RECORDS",
    "VIEW_AUDIT_TRAIL",
    "VIEW_CASES"
  ],
  medical_adjuster: [
    "VIEW_MEDICAL_RECORDS",
    "VIEW_AUDIT_TRAIL",
    "VIEW_CASES"
  ],
  underwriter: [
    "VIEW_MEDICAL_RECORDS",
    "EDIT_FINANCIALS",
    "EXECUTE_WORKFLOWS",
    "VIEW_CASES"
  ],
  compliance_officer: [
    "VIEW_AUDIT_TRAIL",
    "MANAGE_ROLES",
    "VIEW_CASES"
  ],
  claims_manager: [
    "VIEW_MEDICAL_RECORDS",
    "EDIT_FINANCIALS",
    "EXECUTE_WORKFLOWS",
    "VIEW_CASES"
  ],
  support_agent: [
    "VIEW_CASES"
  ],
  case_reviewer: [
    "VIEW_MEDICAL_RECORDS",
    "VIEW_AUDIT_TRAIL",
    "VIEW_CASES"
  ],
  fraud_analyst: [
    "VIEW_AUDIT_TRAIL",
    "VIEW_CASES"
  ],
  financial_officer: [
    "EDIT_FINANCIALS",
    "VIEW_CASES"
  ],
  hospital_coord: [
    "VIEW_MEDICAL_RECORDS",
    "EXECUTE_WORKFLOWS",
    "VIEW_CASES"
  ]
};

function normalizeRole(input: string | null | undefined): AppRole {
  const value = (input ?? "").trim().toLowerCase();
  if ((RBAC_ROLES as readonly string[]).includes(value)) {
    return value as AppRole;
  }
  if (value === "system_administrator") return "admin";
  if (value === "medical_adjuster") return "medical_adjuster";
  if (value === "compliance_officer") return "compliance_officer";
  if (value === "claims_manager") return "claims_manager";
  if (value === "support_agent") return "support_agent";
  if (value === "case_reviewer") return "case_reviewer";
  if (value === "fraud_analyst") return "fraud_analyst";
  if (value === "financial_officer") return "financial_officer";
  if (value === "hospital_coord") return "hospital_coord";
  if (value === "underwriter") return "underwriter";
  if (value === "medical adjuster") return "medical_adjuster";
  if (value === "compliance officer") return "compliance_officer";
  if (value === "claims manager") return "claims_manager";
  if (value === "support agent") return "support_agent";
  if (value === "case reviewer") return "case_reviewer";
  if (value === "fraud analyst") return "fraud_analyst";
  if (value === "financial officer") return "financial_officer";
  if (value === "hospital coordinator") return "hospital_coord";
  if (value === "system administrator") return "admin";
  if (value === "adjuster") {
    return "medical_adjuster";
  }
  if (value === "auditor") {
    return "compliance_officer";
  }
  return "reviewer";
}

function hasPermission(role: string | null | undefined, permission: AppPermission): boolean {
  const normalized = normalizeRole(role);
  return rolePermissions[normalized].includes(permission);
}

function roleSatisfiesRequiredRole(userRole: AppRole, requiredRole: AppRole): boolean {
  if (userRole === "admin") return true;
  if (userRole === requiredRole) return true;

  if (requiredRole === "operator") {
    return [
      "operator",
      "medical_adjuster",
      "underwriter",
      "claims_manager",
      "support_agent",
      "financial_officer",
      "hospital_coord"
    ].includes(userRole);
  }

  if (requiredRole === "reviewer") {
    return [
      "reviewer",
      "case_reviewer",
      "fraud_analyst",
      "compliance_officer",
      "medical_adjuster"
    ].includes(userRole);
  }

  return false;
}

function requestUser(request: any): AuthJwtPayload | null {
  const payload = request.user as AuthJwtPayload | undefined;
  return payload ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function parseRunOutput(outputJson: unknown, output: string): Record<string, unknown> {
  if (outputJson && typeof outputJson === "object") {
    return outputJson as Record<string, unknown>;
  }

  try {
    const parsed = JSON.parse(output);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore parse errors and return raw output fallback
  }

  return { raw: output };
}

function summarizeRunOutput(payload: Record<string, unknown>): string {
  if (typeof payload.summary === "string" && payload.summary.trim().length > 0) {
    return payload.summary;
  }
  if (Array.isArray(payload.reasons) && payload.reasons.length > 0) {
    return payload.reasons.join(", ");
  }
  if (typeof payload.reason === "string" && payload.reason.trim().length > 0) {
    return payload.reason;
  }
  if (typeof payload.confidence === "number") {
    return `Confidence ${(payload.confidence * 100).toFixed(1)}%`;
  }

  return JSON.stringify(payload).slice(0, 260);
}

function classifyFailureReason(errorMessage: string | null | undefined): "timeout" | "schema_mismatch" | "tool_error" | "unknown" {
  const message = (errorMessage ?? "").toLowerCase();
  if (!message) return "unknown";
  if (message.includes("timeout") || message.includes("abort")) return "timeout";
  if (message.includes("schema") || message.includes("missing required")) return "schema_mismatch";
  if (message.includes("tool") || message.includes("api") || message.includes("agent service")) return "tool_error";
  return "unknown";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) {
    return false;
  }
  const actualHex = scryptSync(password, salt, 64).toString("hex");
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  if (expected.length !== actual.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

function refreshTokenExpiresAt(): Date {
  return new Date(Date.now() + refreshTokenTtlDays * 24 * 60 * 60 * 1000);
}

function buildAuditSignature(args: {
  previousSignature: string;
  timestamp: string;
  action: string;
  resource: string;
  resourceId: string | null;
  status: "success" | "failure";
  actor: string;
  details: string;
}): string {
  const payload = [
    args.previousSignature,
    args.timestamp,
    args.action,
    args.resource,
    args.resourceId ?? "",
    args.status,
    args.actor,
    args.details,
    auditSignatureSecret
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

async function writeAuditLog(args: {
  request?: any;
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  status: "success" | "failure";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const userFromRequest = args.request?.user as AuthJwtPayload | undefined;
    const actor = userFromRequest?.sub ? "user" : "system";
    const previousLog = await prisma.auditLog.findFirst({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { metadata: true }
    });
    const previousMetadata = asRecord(previousLog?.metadata);
    const previousSignature = typeof previousMetadata.signature === "string"
      ? previousMetadata.signature
      : "GENESIS";
    const timestamp = new Date().toISOString();
    const details = typeof args.metadata?.details === "string" ? args.metadata.details : args.action;
    const signature = buildAuditSignature({
      previousSignature,
      timestamp,
      action: args.action,
      resource: args.resource,
      resourceId: args.resourceId ?? null,
      status: args.status,
      actor,
      details
    });
    const mergedMetadata: Record<string, unknown> = {
      ...(args.metadata ?? {}),
      actor,
      details,
      signature,
      previous_signature: previousSignature,
      verification_status: "valid",
      event_type: args.action.toUpperCase().replace(/\./g, "_"),
      timestamp
    };

    await prisma.auditLog.create({
      data: {
        userId: args.userId ?? userFromRequest?.sub ?? null,
        action: args.action,
        resource: args.resource,
        resourceId: args.resourceId ?? null,
        status: args.status,
        ip: args.request?.ip ?? null,
        metadata: mergedMetadata as any
      }
    });
  } catch {
    // avoid interrupting API operations for audit failures
  }
}

async function issueSessionTokens(user: { id: string; email: string | null; role: string; name: string }, reply: any): Promise<{
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string | null;
    name: string;
    role: string;
  };
}> {
  const token = await reply.jwtSign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    {
      expiresIn: accessTokenTtl
    }
  );

  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: refreshTokenExpiresAt()
    }
  });

  return {
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  };
}

async function requireAuth(request: any, reply: any): Promise<void> {
  if (!authRequired) {
    return;
  }
  if (request.user) {
    return;
  }

  try {
    await request.jwtVerify();
  } catch {
    await writeAuditLog({
      request,
      action: "auth.unauthorized",
      resource: "api",
      status: "failure"
    });
    reply.code(401).send({ error: "Unauthorized" });
  }
}

function requireRoles(roles: AppRole[]) {
  return async (request: any, reply: any) => {
    await requireAuth(request, reply);
    if (reply.sent || !authRequired) {
      return;
    }

    const roleRaw = (request.user as { role?: string }).role;
    const normalizedRole = normalizeRole(roleRaw);
    const allowed = roles.map((role) => normalizeRole(role));
    const granted = allowed.some((requiredRole) => roleSatisfiesRequiredRole(normalizedRole, requiredRole));
    if (!roleRaw || !granted) {
      await writeAuditLog({
        request,
        action: "auth.forbidden",
        resource: "api",
        status: "failure",
        metadata: { requiredRoles: roles, currentRole: roleRaw ?? null }
      });
      reply.code(403).send({ error: "Forbidden" });
    }
  };
}

function requirePermissions(permissions: AppPermission[]) {
  return async (request: any, reply: any) => {
    await requireAuth(request, reply);
    if (reply.sent || !authRequired) {
      return;
    }

    const role = (request.user as { role?: string }).role;
    const missing = permissions.filter((permission) => !hasPermission(role, permission));
    if (missing.length > 0) {
      await writeAuditLog({
        request,
        action: "auth.permission_denied",
        resource: "api",
        status: "failure",
        metadata: {
          requiredPermissions: permissions,
          missingPermissions: missing,
          currentRole: role ?? null
        }
      });
      reply.code(403).send({ error: "Forbidden", missingPermissions: missing });
    }
  };
}

function buildCaseCode(): string {
  const stamp = Date.now().toString().slice(-5);
  return `CAS-${new Date().getFullYear()}-${stamp}`;
}

async function ensureBootstrapAdminFromEnv(): Promise<void> {
  const email = normalizeEmail(bootstrapAdminEmail);
  if (!email || !bootstrapAdminPassword) {
    return;
  }

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: bootstrapAdminName,
      role: "admin",
      passwordHash: hashPassword(bootstrapAdminPassword)
    },
    update: {
      name: bootstrapAdminName,
      role: "admin",
      passwordHash: hashPassword(bootstrapAdminPassword)
    }
  });
}

async function ensureAllowlistedLoginUsers(): Promise<void> {
  if (allowedLoginEmails.length === 0) return;
  for (const email of allowedLoginEmails) {
    const normalized = normalizeEmail(email);
    if (!normalized) continue;
    const existing = await prisma.user.findUnique({ where: { email: normalized }, select: { id: true } });
    if (existing) continue;
    await prisma.user.create({
      data: {
        email: normalized,
        name: displayNameFromEmail(normalized),
        role: "support_agent",
        passwordHash: null
      }
    });
  }
}

async function ensureDefaultHealthInboxFromEnv(): Promise<void> {
  const email = normalizeEmail(imapUser);
  if (!email || !imapPass) {
    return;
  }

  const workflows = await prisma.workflow.findMany({
    where: { status: "active" },
    select: { id: true, key: true, name: true },
    orderBy: { createdAt: "asc" }
  });

  let healthWorkflow = workflows.find((workflow) => deriveWorkflowCategory(workflow) === "Insurance - Health") ?? null;

  if (!healthWorkflow) {
    const template = buildAssistantWorkflowTemplate();
    healthWorkflow = await prisma.workflow.create({
      data: {
        key: "health_email_intake_default",
        name: "Health Email Intake (Default)",
        description: "Default health insurance email workflow with intake, classification, extraction, validation, decision, and customer notification.",
        status: "active",
        version: 1,
        steps: {
          create: template.map((step) => ({
            name: step.name,
            stepType: step.stepType,
            stepOrder: step.stepOrder,
            config: {
              key: step.key,
              source: "auto_bootstrap"
            }
          }))
        }
      },
      select: { id: true, key: true, name: true }
    });
  }

  await prisma.inboxEmail.upsert({
    where: { email },
    create: {
      label: "Health Insurance Intake",
      email,
      protocol: "imap",
      host: imapHost,
      port: imapPort,
      username: imapUser,
      password: imapPass,
      mailbox: imapMailbox,
      pollInterval: imapPollInterval,
      isActive: true,
      domain: "Insurance - Health",
      workflowKey: healthWorkflow?.key ?? healthWorkflow?.id ?? null,
      claimTypeKey: "health",
      autoReplyEnabled: true
    },
    update: {
      label: "Health Insurance Intake",
      protocol: "imap",
      host: imapHost,
      port: imapPort,
      username: imapUser,
      password: imapPass,
      mailbox: imapMailbox,
      pollInterval: imapPollInterval,
      isActive: true,
      domain: "Insurance - Health",
      workflowKey: healthWorkflow?.key ?? healthWorkflow?.id ?? null,
      claimTypeKey: "health",
      autoReplyEnabled: true
    }
  });
}

async function ensureHealthWorkflowTemplateIntegrity(): Promise<void> {
  const workflow = await prisma.workflow.findFirst({
    where: {
      OR: [
        { key: "health_email_intake_default" },
        { name: { equals: "Health Email Intake (Default)", mode: "insensitive" } }
      ]
    },
    include: {
      steps: {
        orderBy: { stepOrder: "asc" }
      }
    }
  });

  if (!workflow) {
    return;
  }

  const template = buildAssistantWorkflowTemplate();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.workflowStep.findMany({
      where: { workflowId: workflow.id },
      orderBy: { stepOrder: "asc" }
    });

    const selectedStepIds: string[] = [];
    const selectedSet = new Set<string>();

    for (let i = 0; i < template.length; i += 1) {
      const tpl = template[i];
      const found = existing.find(
        (step) => !selectedSet.has(step.id) && step.stepType === tpl.stepType
      );

      if (found) {
        selectedStepIds.push(found.id);
        selectedSet.add(found.id);
        await tx.workflowStep.update({
          where: { id: found.id },
          data: {
            name: tpl.name,
            stepOrder: 1000 + i,
            nextStepId: null,
            config: {
              ...(asRecord(found.config)),
              key: tpl.key,
              source: "auto_bootstrap"
            } as any
          }
        });
      } else {
        const created = await tx.workflowStep.create({
          data: {
            workflowId: workflow.id,
            name: tpl.name,
            stepType: tpl.stepType,
            stepOrder: 1000 + i,
            nextStepId: null,
            config: {
              key: tpl.key,
              source: "auto_bootstrap"
            } as any
          }
        });
        selectedStepIds.push(created.id);
        selectedSet.add(created.id);
      }
    }

    const leftover = existing.filter((step) => !selectedSet.has(step.id));
    for (let i = 0; i < leftover.length; i += 1) {
      await tx.workflowStep.update({
        where: { id: leftover[i].id },
        data: {
          stepOrder: 5000 + i,
          nextStepId: null
        }
      });
    }

    for (let i = 0; i < selectedStepIds.length; i += 1) {
      await tx.workflowStep.update({
        where: { id: selectedStepIds[i] },
        data: {
          stepOrder: i + 1,
          nextStepId: selectedStepIds[i + 1] ?? null
        }
      });
    }
  });
}

function inferPolicyTypeFromNumber(policyNumber: string | null | undefined): string {
  const pn = (policyNumber ?? "").toUpperCase();
  if (pn.startsWith("HLT") || pn.startsWith("MED")) return "health";
  if (pn.startsWith("AUT") || pn.startsWith("MOT")) return "auto";
  if (pn.startsWith("PRP")) return "property";
  if (pn.startsWith("LIF")) return "life";
  if (pn.startsWith("TRV")) return "travel";
  return "health";
}

function inferPolicyTypeFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes("health") || lower.includes("hospital") || lower.includes("critical") || lower.includes("ipa")) {
    return "health";
  }
  if (lower.includes("motor") || lower.includes("auto")) return "auto";
  if (lower.includes("property") || lower.includes("home")) return "property";
  if (lower.includes("life")) return "life";
  return "health";
}

function inferCoverageHintsFromFilename(filename: string): string[] {
  const lower = filename.toLowerCase();
  const hints = new Set<string>();
  if (lower.includes("critical")) hints.add("Critical Illness");
  if (lower.includes("hospital")) hints.add("Hospital Daily Cash");
  if (lower.includes("protector") || lower.includes("rider")) hints.add("Rider Benefit");
  if (lower.includes("health") || lower.includes("easyhealth")) hints.add("Health Base Cover");
  if (lower.includes("ipa")) hints.add("Personal Accident");
  if (hints.size === 0) hints.add("General Policy Terms");
  return Array.from(hints);
}

type PolicyDocVaultEntry = {
  id: string;
  fileName: string;
  absolutePath: string;
  sourceRoot: string;
  sizeBytes: number;
  sizeLabel: string;
  modifiedAt: string;
  policyType: string;
  coverageHints: string[];
  ingestStatus: "ready";
};

async function listPolicyDocsFromVault(): Promise<{ root: string; docs: PolicyDocVaultEntry[] }> {
  const fallbackRoot = policyDocsDirectoryCandidates[0] ?? path.resolve(process.cwd(), "policy docs");
  const resolvedRoots: string[] = [];
  const seenPaths = new Set<string>();
  const docs: PolicyDocVaultEntry[] = [];
  const allowedExtensions = new Set([".pdf", ".doc", ".docx"]);

  for (const candidate of policyDocsDirectoryCandidates) {
    let entries: Array<{ isFile: () => boolean; name: string }> = [];
    try {
      entries = await readdir(candidate, { withFileTypes: true, encoding: "utf8" });
      resolvedRoots.push(candidate);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fileName = entry.name;
      const extension = path.extname(fileName).toLowerCase();
      if (!allowedExtensions.has(extension)) continue;

      const absolutePath = path.join(candidate, fileName);
      const dedupeKey = absolutePath.toLowerCase();
      if (seenPaths.has(dedupeKey)) continue;

      let info;
      try {
        info = await stat(absolutePath);
      } catch {
        continue;
      }

      seenPaths.add(dedupeKey);
      docs.push({
        id: createHash("sha1").update(absolutePath).digest("hex").slice(0, 14),
        fileName,
        absolutePath,
        sourceRoot: candidate,
        sizeBytes: info.size,
        sizeLabel: `${(info.size / (1024 * 1024)).toFixed(2)} MB`,
        modifiedAt: info.mtime.toISOString(),
        policyType: inferPolicyTypeFromFilename(fileName),
        coverageHints: inferCoverageHintsFromFilename(fileName),
        ingestStatus: "ready"
      });
    }
  }

  return {
    root: resolvedRoots.length > 0 ? resolvedRoots.join(" | ") : fallbackRoot,
    docs: docs.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
  };
}

function defaultCoverageByPolicyType(policyType: string): string[] {
  const key = policyType.toLowerCase();
  if (key === "health") return ["Hospitalisation", "Day Care", "Critical Illness"];
  if (key === "auto") return ["Third Party", "Own Damage", "Personal Accident"];
  if (key === "property") return ["Fire", "Flood", "Theft"];
  if (key === "life") return ["Term Life", "Accidental Death Rider"];
  if (key === "travel") return ["Medical Emergency", "Trip Cancellation", "Baggage Loss"];
  return ["Basic Coverage"];
}

type MedicalRecordSeedDoc = {
  id: string;
  fileName: string;
  absolutePath: string;
  sizeBytes: number;
  sizeLabel: string;
  modifiedAt: string;
};

async function listMedicalRecordSeedDocs(): Promise<{ root: string; docs: MedicalRecordSeedDoc[] }> {
  let selectedRoot = medicalRecordsDirectoryCandidates[0] ?? path.resolve(process.cwd(), "med records");
  let entries: Array<{ isFile: () => boolean; name: string }> | null = null;
  for (const candidate of medicalRecordsDirectoryCandidates) {
    try {
      const maybe = await readdir(candidate, { withFileTypes: true, encoding: "utf8" });
      selectedRoot = candidate;
      entries = maybe;
      break;
    } catch {
      continue;
    }
  }

  if (!entries) {
    return { root: selectedRoot, docs: [] };
  }

  const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp"]);
  const docs: MedicalRecordSeedDoc[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fileName = entry.name;
    const extension = path.extname(fileName).toLowerCase();
    if (!allowedExtensions.has(extension)) continue;
    const absolutePath = path.join(selectedRoot, fileName);
    let info;
    try {
      info = await stat(absolutePath);
    } catch {
      continue;
    }
    docs.push({
      id: createHash("sha1").update(absolutePath).digest("hex").slice(0, 18),
      fileName,
      absolutePath,
      sizeBytes: info.size,
      sizeLabel: `${(info.size / (1024 * 1024)).toFixed(2)} MB`,
      modifiedAt: info.mtime.toISOString()
    });
  }

  return {
    root: selectedRoot,
    docs: docs.sort((a, b) => a.fileName.localeCompare(b.fileName))
  };
}

function seededNumber(seed: string, min: number, max: number): number {
  const range = Math.max(1, max - min + 1);
  const hash = createHash("sha1").update(seed).digest("hex");
  const raw = Number.parseInt(hash.slice(0, 8), 16);
  return min + (raw % range);
}

function inferMemberNameFromMedicalFile(fileName: string, index: number): string {
  const normalized = path.parse(fileName).name
    .replace(/ilide\.info[-_.]*/gi, "")
    .replace(/pr_[a-z0-9]+/gi, "")
    .replace(/\d+/g, " ")
    .replace(/[-_.()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const stopWords = new Set([
    "discharge",
    "summary",
    "documents",
    "document",
    "required",
    "report",
    "hospital",
    "untitled",
    "scan",
    "adobe",
    "info",
    "pr"
  ]);
  const parts = normalized
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && /^[a-z]+$/.test(part) && !stopWords.has(part));
  const selected = parts.slice(0, 2);
  if (selected.length === 0) {
    return `Medical Profile ${String(index + 1).padStart(2, "0")}`;
  }
  return selected
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildSyntheticPolicyNumber(seed: string): string {
  const year = new Date().getFullYear();
  const suffix = seededNumber(seed, 100000, 999999);
  return `HLT-${year}-${suffix}`;
}

function buildSyntheticCaseId(seed: string): string {
  const digest = createHash("sha1").update(seed).digest("hex").slice(0, 8).toUpperCase();
  return `CAS-MED-${digest}`;
}

function buildSyntheticMemberEmail(memberName: string, index: number): string {
  const slug = memberName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `${slug || `member${index + 1}`}@demo.aurastack.local`;
}

async function ensureMedicalProfilesAndCasesFromRecords(): Promise<void> {
  const vault = await listMedicalRecordSeedDocs();
  if (vault.docs.length === 0) {
    return;
  }

  const now = new Date();
  const oneYear = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));
  const sumInsuredBands = [300000, 500000, 700000, 1000000, 1500000, 2000000];
  const seededCaseIds: string[] = [];

  for (let index = 0; index < vault.docs.length; index += 1) {
    const doc = vault.docs[index];
    const seed = `${doc.absolutePath}:${doc.sizeBytes}:${doc.modifiedAt}`;
    const policyNumber = buildSyntheticPolicyNumber(seed);
    const memberName = inferMemberNameFromMedicalFile(doc.fileName, index);
    const memberEmail = buildSyntheticMemberEmail(memberName, index);
    const memberId = `MED-${seededNumber(`${seed}:member`, 100000, 999999)}`;
    const sumInsured = sumInsuredBands[seededNumber(`${seed}:sum`, 0, sumInsuredBands.length - 1)] ?? 500000;
    const claimAmount = seededNumber(`${seed}:claim`, 20000, 450000);
    const priorityBands = ["low", "medium", "high", "critical"] as const;
    const priority = priorityBands[seededNumber(`${seed}:priority`, 0, priorityBands.length - 1)] ?? "medium";
    const caseId = buildSyntheticCaseId(policyNumber);
    const documentId = `meddoc_${createHash("sha1").update(doc.absolutePath).digest("hex").slice(0, 20)}`;
    seededCaseIds.push(caseId);

    await prisma.$executeRaw`
      INSERT INTO "PolicyRegistry"
        ("id","policyNumber","memberId","memberName","memberEmail","policyType","coverageTypes","sumInsured","currency","payerName","status","effectiveDate","expiryDate","metadata","updatedAt")
      VALUES
        (${`pol_med_${doc.id}`}, ${policyNumber}, ${memberId}, ${memberName}, ${memberEmail}, ${"health"}, ${JSON.stringify(["Hospitalisation", "Diagnostics", "Critical Illness"])}::jsonb, ${sumInsured}, ${"INR"}, ${"Aura Health Insurance"}, ${"active"}, ${now}, ${oneYear}, ${JSON.stringify({
          source: "med_records_seed",
          sourceRoot: vault.root,
          sourceFileName: doc.fileName,
          sourcePath: doc.absolutePath,
          sourceSizeBytes: doc.sizeBytes,
          sourceModifiedAt: doc.modifiedAt,
          seededAt: now.toISOString()
        })}::jsonb, ${now})
      ON CONFLICT ("policyNumber") DO UPDATE SET
        "memberId" = EXCLUDED."memberId",
        "memberName" = EXCLUDED."memberName",
        "memberEmail" = EXCLUDED."memberEmail",
        "coverageTypes" = EXCLUDED."coverageTypes",
        "sumInsured" = EXCLUDED."sumInsured",
        "currency" = EXCLUDED."currency",
        "payerName" = EXCLUDED."payerName",
        "status" = EXCLUDED."status",
        "effectiveDate" = EXCLUDED."effectiveDate",
        "expiryDate" = EXCLUDED."expiryDate",
        "metadata" = EXCLUDED."metadata",
        "updatedAt" = EXCLUDED."updatedAt";
    `;

    const existingCase = await prisma.caseRecord.findUnique({
      where: { id: caseId },
      select: { id: true }
    });
    if (!existingCase) {
      await prisma.caseRecord.create({
        data: {
          id: caseId,
          caseType: "health",
          workflowStage: "Document Intake",
          aiStatus: "processing",
          priority,
          memberName,
          status: "new",
          documentsTotal: 1,
          documentsComplete: 1,
          customerEmail: memberEmail,
          claimClassification: "new_claim",
          policyNumber,
          claimAmount,
          incidentDate: new Date(doc.modifiedAt),
          slaDeadline: new Date(Date.now() + (48 * 60 * 60 * 1000)),
          slaBreached: false
        }
      });
    }

    const existingDoc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true }
    });
    if (!existingDoc) {
      await prisma.document.create({
        data: {
          id: documentId,
          caseId,
          name: doc.fileName,
          type: path.extname(doc.fileName).replace(".", "").toLowerCase() || "pdf",
          status: "uploaded",
          pages: null
        }
      });
    }
  }

  for (const caseId of seededCaseIds) {
    const [documentsTotal, documentsComplete] = await Promise.all([
      prisma.document.count({ where: { caseId } }),
      prisma.document.count({
        where: {
          caseId,
          status: {
            in: ["uploaded", "processed", "complete", "verified", "done", "success"]
          }
        }
      })
    ]);
    await prisma.caseRecord.update({
      where: { id: caseId },
      data: {
        documentsTotal,
        documentsComplete
      }
    });
  }
}

async function ensurePolicyRegistryTableAndSeed(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PolicyRegistry" (
      "id" TEXT NOT NULL,
      "policyNumber" TEXT NOT NULL,
      "memberId" TEXT,
      "memberName" TEXT NOT NULL,
      "memberEmail" TEXT,
      "policyType" TEXT NOT NULL,
      "coverageTypes" JSONB NOT NULL,
      "sumInsured" DOUBLE PRECISION NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'INR',
      "payerName" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "effectiveDate" TIMESTAMP(3),
      "expiryDate" TIMESTAMP(3),
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "PolicyRegistry_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "PolicyRegistry_policyNumber_key" ON "PolicyRegistry"("policyNumber");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PolicyRegistry_policyType_status_idx" ON "PolicyRegistry"("policyType", "status");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PolicyRegistry_memberEmail_idx" ON "PolicyRegistry"("memberEmail");
  `);

  const now = new Date();
  const oneYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const samplePolicies = [
    {
      id: `pol_${randomBytes(6).toString("hex")}`,
      policyNumber: "HLT-2026-7788",
      memberId: "MEM-7788",
      memberName: "Sidhant",
      memberEmail: "sidhant@claritty.com",
      policyType: "health",
      coverageTypes: ["Hospitalisation", "Pre/Post Hospitalisation", "Day Care"],
      sumInsured: 500000,
      currency: "INR",
      payerName: "Aura Health Insurance"
    },
    {
      id: `pol_${randomBytes(6).toString("hex")}`,
      policyNumber: "HLT-2024-89234",
      memberId: "MEM-456789",
      memberName: "Rajesh Kumar",
      memberEmail: "rajesh.kumar@apollo-patient.com",
      policyType: "health",
      coverageTypes: ["Hospitalisation", "OPD", "Critical Illness"],
      sumInsured: 500000,
      currency: "INR",
      payerName: "Aura Health Insurance"
    },
    {
      id: `pol_${randomBytes(6).toString("hex")}`,
      policyNumber: "AUT-2024-56789",
      memberId: "MEM-AUTO-56789",
      memberName: "Priya Sharma",
      memberEmail: "priya.sharma@gmail.com",
      policyType: "auto",
      coverageTypes: ["Third Party", "Comprehensive", "Personal Accident"],
      sumInsured: 1000000,
      currency: "INR",
      payerName: "Aura Motor Insurance"
    },
    {
      id: `pol_${randomBytes(6).toString("hex")}`,
      policyNumber: "PRP-2023-12456",
      memberId: "MEM-PRP-12456",
      memberName: "Arun Mehta",
      memberEmail: "arun.mehta@outlook.com",
      policyType: "property",
      coverageTypes: ["Fire", "Flood", "Theft"],
      sumInsured: 2500000,
      currency: "INR",
      payerName: "Aura Property Shield"
    }
  ];

  for (const p of samplePolicies) {
    await prisma.$executeRaw`
      INSERT INTO "PolicyRegistry"
        ("id","policyNumber","memberId","memberName","memberEmail","policyType","coverageTypes","sumInsured","currency","payerName","status","effectiveDate","expiryDate","updatedAt")
      VALUES
        (${p.id}, ${p.policyNumber}, ${p.memberId}, ${p.memberName}, ${p.memberEmail}, ${p.policyType}, ${JSON.stringify(p.coverageTypes)}::jsonb, ${p.sumInsured}, ${p.currency}, ${p.payerName}, 'active', ${now}, ${oneYear}, ${now})
      ON CONFLICT ("policyNumber") DO UPDATE SET
        "memberId" = EXCLUDED."memberId",
        "memberName" = EXCLUDED."memberName",
        "memberEmail" = EXCLUDED."memberEmail",
        "policyType" = EXCLUDED."policyType",
        "coverageTypes" = EXCLUDED."coverageTypes",
        "sumInsured" = EXCLUDED."sumInsured",
        "currency" = EXCLUDED."currency",
        "payerName" = EXCLUDED."payerName",
        "status" = EXCLUDED."status",
        "effectiveDate" = EXCLUDED."effectiveDate",
        "expiryDate" = EXCLUDED."expiryDate",
        "updatedAt" = EXCLUDED."updatedAt";
    `;
  }

  await ensureMedicalProfilesAndCasesFromRecords();
}

const publicAuthPaths = new Set([
  "/health",
  "/auth/login",
  "/auth/refresh",
  "/auth/bootstrap-admin",
  "/auth/first-login",
  "/auth/password-reset/request",
  "/auth/password-reset/confirm"
]);

app.addHook("preHandler", async (request, reply) => {
  if (!authRequired) {
    return;
  }
  const requestPath = request.url.split("?")[0] ?? "";
  if (
    publicAuthPaths.has(requestPath)
    || requestPath.startsWith("/internal/")
    || requestPath === "/email/inbound"
  ) {
    return;
  }
  await requireAuth(request, reply);
});

function normalizeEmail(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

function displayNameFromEmail(email: string): string {
  const local = (email.split("@")[0] || "").trim();
  if (!local) return "User";
  const cleaned = local.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function emailDomain(value: string): string {
  const [, domain = ""] = normalizeEmail(value).split("@");
  return domain;
}

function isAllowedAccountEmail(email: string): boolean {
  if (allowedAccountDomains.length === 0) {
    return true;
  }
  return allowedAccountDomains.includes(emailDomain(email));
}

function isAllowedLoginEmail(email: string): boolean {
  if (allowedLoginEmails.length === 0) {
    return true;
  }
  return allowedLoginEmails.includes(normalizeEmail(email));
}

function parseBearerToken(headerValue: unknown): string | null {
  if (typeof headerValue !== "string") {
    return null;
  }
  if (!headerValue.startsWith("Bearer ")) {
    return null;
  }
  return headerValue.slice("Bearer ".length).trim();
}

function requestHasInternalWorkerToken(request: any): boolean {
  const authToken = parseBearerToken(request.headers?.authorization);
  const internalHeader = typeof request.headers?.["x-internal-token"] === "string"
    ? request.headers["x-internal-token"]
    : null;
  return authToken === internalWorkerToken || internalHeader === internalWorkerToken;
}

function deriveWorkflowCategory(workflow: { key: string | null; name: string }): string {
  const key = (workflow.key ?? "").toLowerCase();
  const name = workflow.name.toLowerCase();

  if (key.startsWith("banking_") || name.includes("loan") || name.includes("aml")) {
    return "Banking";
  }
  if (key.startsWith("health_") || name.includes("cashless") || name.includes("reimbursement")) {
    return "Insurance - Health";
  }
  if (key.startsWith("motor_") || name.includes("motor") || name.includes("fnol")) {
    return "Insurance - Motor";
  }
  if (key.startsWith("property_") || name.includes("property") || name.includes("liability")) {
    return "Insurance - Property & Casualty";
  }
  return "Cross-Industry";
}

function findActiveWorkflowByKey(
  workflows: Array<{ id: string; key: string | null; name: string }>,
  workflowKeyOrId: string | null | undefined
) {
  if (!workflowKeyOrId) return null;
  return workflows.find((item) => item.key === workflowKeyOrId || item.id === workflowKeyOrId) ?? null;
}

function resolveInboundWorkflow({
  activeWorkflows,
  inboxWorkflowKey,
  inboxDomain
}: {
  activeWorkflows: Array<{ id: string; key: string | null; name: string }>;
  inboxWorkflowKey?: string | null;
  inboxDomain?: string | null;
}) {
  const byWorkflow = findActiveWorkflowByKey(activeWorkflows, inboxWorkflowKey);
  if (byWorkflow && inboxDomain && deriveWorkflowCategory(byWorkflow) === inboxDomain) {
    return byWorkflow;
  }
  if (byWorkflow) {
    return byWorkflow;
  }
  if (inboxDomain) {
    const byDomain = activeWorkflows.find((item) => deriveWorkflowCategory(item) === inboxDomain) ?? null;
    if (byDomain) {
      return byDomain;
    }
  }
  return activeWorkflows[0] ?? null;
}

type WorkflowRoutingAlternative = {
  workflowId: string;
  workflowKey: string | null;
  workflowName: string;
  score: number;
  reasons: string[];
};

type WorkflowRoutingDecision = {
  selectedWorkflowId: string;
  selectedWorkflowKey: string | null;
  selectedWorkflowName: string;
  source: "inbox_config" | "claim_type_mapping" | "domain_fallback" | "active_default";
  confidence: number;
  reasons: string[];
  alternatives: WorkflowRoutingAlternative[];
  context: {
    inboxDomain: string | null;
    inboxWorkflowKey: string | null;
    claimType: string;
    claimTypeWorkflowKey: string | null;
    sender: string;
    cascadeWorkflowKeys?: string[];
    cascadeWorkflowNames?: string[];
    preProcessorSummary?: string | null;
  };
};

function computeRoutingAlternatives(args: {
  workflows: Array<{ id: string; key: string | null; name: string }>;
  inboxDomain: string | null;
  inboxWorkflowKey: string | null;
  claimType: string;
  claimTypeWorkflowKey: string | null;
  subject: string;
  body: string;
}): WorkflowRoutingAlternative[] {
  const normalizedText = `${args.subject} ${args.body}`.toLowerCase();
  const claimTypeNormalized = args.claimType.toLowerCase();

  const alternatives = args.workflows.map((workflow) => {
    const category = deriveWorkflowCategory(workflow);
    const reasons: string[] = [];
    let score = 0.1;

    if (args.inboxWorkflowKey && (workflow.key === args.inboxWorkflowKey || workflow.id === args.inboxWorkflowKey)) {
      score += 0.55;
      reasons.push("Configured directly on inbox");
    }
    if (args.claimTypeWorkflowKey && (workflow.key === args.claimTypeWorkflowKey || workflow.id === args.claimTypeWorkflowKey)) {
      score += 0.5;
      reasons.push("Mapped by claim type configuration");
    }
    if (args.inboxDomain && category === args.inboxDomain) {
      score += 0.28;
      reasons.push(`Matches inbox domain (${args.inboxDomain})`);
    }
    if (caseTypeBelongsToDomain(claimTypeNormalized, category)) {
      score += 0.22;
      reasons.push(`Claim type aligns to ${category}`);
    }

    const workflowTokens = `${workflow.name} ${workflow.key ?? ""}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4);
    const lexicalHits = workflowTokens.filter((token) => normalizedText.includes(token)).length;
    if (lexicalHits > 0) {
      score += Math.min(0.12, lexicalHits * 0.03);
      reasons.push(`Inbound content matched ${lexicalHits} workflow keyword(s)`);
    }

    return {
      workflowId: workflow.id,
      workflowKey: workflow.key,
      workflowName: workflow.name,
      score: Number(score.toFixed(3)),
      reasons: reasons.length > 0 ? reasons : ["Fallback candidate"]
    };
  });

  return alternatives.sort((a, b) => b.score - a.score);
}

function caseTypeBelongsToDomain(caseType: string, domain: string): boolean {
  const normalized = caseType.toLowerCase();
  if (domain === "Banking") {
    return ["loan", "credit", "collection", "payment", "aml", "kyc", "account", "cheque", "trade", "regulatory"].some((term) => normalized.includes(term));
  }
  if (domain === "Insurance - Health") {
    return ["health", "cashless", "reimbursement", "pre-auth", "tpa", "medical", "member", "grievance", "appeal"].some((term) => normalized.includes(term));
  }
  if (domain === "Insurance - Motor") {
    return ["motor", "fnol", "surveyor", "salvage", "garage", "vehicle", "renewal"].some((term) => normalized.includes(term));
  }
  if (domain === "Insurance - Property & Casualty") {
    return ["property", "casualty", "liability", "commercial", "endorsement", "site"].some((term) => normalized.includes(term));
  }
  return ["document", "regulatory", "sla", "performance"].some((term) => normalized.includes(term));
}

function textBelongsToDomain(subject: string, body: string, domain: string): boolean {
  const normalized = `${subject} ${body}`.toLowerCase();
  if (domain === "Banking") {
    return ["loan", "credit", "collection", "payment", "aml", "kyc", "account", "neft", "imps", "upi"].some((term) => normalized.includes(term));
  }
  if (domain === "Insurance - Health") {
    const healthNegative = ["motor", "vehicle", "car", "bike", "garage", "accident", "fnol", "property", "casualty", "liability", "fire", "flood", "loan", "kyc", "aml", "upi", "neft", "imps"];
    if (healthNegative.some((term) => normalized.includes(term))) {
      return false;
    }

    const healthPositive = ["health", "cashless", "reimbursement", "pre-auth", "preauth", "hospital", "medical", "surgery", "tpa", "patient", "admission", "discharge"];
    if (healthPositive.some((term) => normalized.includes(term))) {
      return true;
    }

    return ["insurance claim", "claim submission", "claim intimation", "policy number", "hospital bill", "discharge summary", "medical report"].some((term) => normalized.includes(term));
  }
  if (domain === "Insurance - Motor") {
    return ["motor", "vehicle", "car", "bike", "garage", "accident", "fnol", "repair", "surveyor", "salvage"].some((term) => normalized.includes(term));
  }
  if (domain === "Insurance - Property & Casualty") {
    return ["property", "casualty", "liability", "commercial", "fire", "flood", "site", "endorsement"].some((term) => normalized.includes(term));
  }
  return ["document", "regulatory", "sla", "performance"].some((term) => normalized.includes(term));
}

function caseWhereForDomain(domain: string): Prisma.CaseRecordWhereInput {
  const domainTerms: Record<string, string[]> = {
    Banking: ["loan", "credit", "collection", "payment", "aml", "kyc", "account", "cheque", "trade", "regulatory"],
    "Insurance - Health": ["health", "cashless", "reimbursement", "pre-auth", "tpa", "medical", "member", "grievance", "appeal"],
    "Insurance - Motor": ["motor", "fnol", "surveyor", "salvage", "garage", "vehicle", "renewal"],
    "Insurance - Property & Casualty": ["property", "casualty", "liability", "commercial", "endorsement", "site"],
    "Cross-Industry": ["document", "regulatory", "sla", "performance"]
  };

  const terms = domainTerms[domain] ?? [];
  if (terms.length === 0) return {};
  return { OR: terms.map((term) => ({ caseType: { contains: term, mode: "insensitive" } })) };
}

function slugifyKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const ASSISTANT_DOMAINS = [
  "Banking",
  "Insurance - Health",
  "Insurance - Motor",
  "Insurance - Property & Casualty",
  "Cross-Industry"
] as const;

function normalizeAssistantDomain(domain: string | undefined | null): (typeof ASSISTANT_DOMAINS)[number] | null {
  if (!domain) return null;
  const direct = ASSISTANT_DOMAINS.find((item) => item.toLowerCase() === domain.toLowerCase());
  if (direct) return direct;
  if (domain.toLowerCase().includes("property")) return "Insurance - Property & Casualty";
  if (domain.toLowerCase().includes("health") || domain.toLowerCase().includes("helth")) return "Insurance - Health";
  if (domain.toLowerCase().includes("motor")) return "Insurance - Motor";
  if (domain.toLowerCase().includes("bank")) return "Banking";
  if (domain.toLowerCase().includes("cross")) return "Cross-Industry";
  return null;
}

function detectDomainFromMessage(message: string, fallback: string | null): (typeof ASSISTANT_DOMAINS)[number] {
  const lower = message.toLowerCase();
  if (lower.includes("property") || lower.includes("casualty") || lower.includes("liability")) return "Insurance - Property & Casualty";
  if (lower.includes("health") || lower.includes("helth") || lower.includes("cashless") || lower.includes("reimbursement") || lower.includes("medical")) return "Insurance - Health";
  if (lower.includes("motor") || lower.includes("fnol") || lower.includes("vehicle") || lower.includes("garage")) return "Insurance - Motor";
  if (lower.includes("bank") || lower.includes("loan") || lower.includes("aml") || lower.includes("kyc")) return "Banking";
  if (lower.includes("cross") || lower.includes("document lifecycle") || lower.includes("regulatory")) return "Cross-Industry";
  return (fallback as (typeof ASSISTANT_DOMAINS)[number] | null) ?? "Banking";
}

function domainPrefix(domain: (typeof ASSISTANT_DOMAINS)[number]): string {
  if (domain === "Banking") return "banking";
  if (domain === "Insurance - Health") return "health";
  if (domain === "Insurance - Motor") return "motor";
  if (domain === "Insurance - Property & Casualty") return "property";
  return "cross";
}

function buildAssistantWorkflowTemplate() {
  return [
    { key: "email_intake", name: "Email Intake", stepType: "EMAIL_INTAKE" as const, stepOrder: 1 },
    { key: "claim_classification", name: "Claim Classification", stepType: "CLAIM_CLASSIFICATION" as const, stepOrder: 2 },
    { key: "document_ocr", name: "Document OCR", stepType: "DOCUMENT_OCR" as const, stepOrder: 3 },
    { key: "data_extraction", name: "Data Extraction", stepType: "DATA_EXTRACTION" as const, stepOrder: 4 },
    { key: "policy_lookup", name: "Policy Lookup", stepType: "POLICY_LOOKUP" as const, stepOrder: 5 },
    { key: "validation", name: "Validation", stepType: "VALIDATION" as const, stepOrder: 6 },
    { key: "decision", name: "Decision", stepType: "DECISION" as const, stepOrder: 7 },
    { key: "notify_customer", name: "Notify Customer", stepType: "NOTIFY_CUSTOMER" as const, stepOrder: 8 }
  ];
}

function defaultWorkflowPlaybook(workflowName: string) {
  return {
    acknowledgementSubject: `We have received your request - ${workflowName}`,
    acknowledgementBody: "Hi {{memberName}},\n\nWe have received your request and started processing it. Case ID: {{caseId}}.\n\nRegards,\nAuraStack",
    approvalSubject: `Update: Your request has been approved - ${workflowName}`,
    approvalBody: "Hi {{memberName}},\n\nYour request has been approved. Case ID: {{caseId}}.\n\nRegards,\nAuraStack",
    rejectionSubject: `Update: Your request could not be approved - ${workflowName}`,
    rejectionBody: "Hi {{memberName}},\n\nAfter review, your request could not be approved. Case ID: {{caseId}}.\n\nRegards,\nAuraStack",
    reviewSubject: `Update: Your request needs additional review - ${workflowName}`,
    reviewBody: "Hi {{memberName}},\n\nYour request needs additional review from our team. Case ID: {{caseId}}.\n\nRegards,\nAuraStack"
  };
}

function parseQuotedValue(message: string, label: "workflow" | "step"): string | null {
  if (label === "workflow") {
    const quotedWorkflow = message.match(/workflow(?:\s+called|\s+named)?\s+["']([^"']{2,100})["']/i)?.[1]?.trim();
    if (quotedWorkflow) return quotedWorkflow;
    return message.match(/workflow(?:\s+called|\s+named)?\s+([a-z0-9][a-z0-9\s\-_&]{1,100}?)(?=(?:\s+(?:at\s+position|to\s+position))|$)/i)?.[1]?.trim() ?? null;
  }
  const quotedStep = message.match(/step(?:\s+called|\s+named)?\s+["']([^"']{2,100})["']/i)?.[1]?.trim();
  if (quotedStep) return quotedStep;
  return message.match(/step(?:\s+called|\s+named)?\s+([a-z0-9][a-z0-9\s\-_&]{1,100}?)(?=(?:\s+(?:to\s+position|at\s+position|to\s+workflow|in\s+workflow|from\s+workflow))|$)/i)?.[1]?.trim() ?? null;
}

function parsePosition(message: string): number | null {
  const match = message.match(/(?:position|pos|at)\s+(\d{1,3})/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function applyWorkflowStepOrder(tx: Prisma.TransactionClient, workflowId: string, orderedStepIds: string[]): Promise<void> {
  // Phase 1: assign non-overlapping temporary orders to avoid unique(workflowId, stepOrder) conflicts.
  for (let i = 0; i < orderedStepIds.length; i += 1) {
    await tx.workflowStep.update({
      where: { id: orderedStepIds[i] },
      data: {
        workflowId,
        stepOrder: 1000 + i,
        nextStepId: null
      }
    });
  }

  // Phase 2: assign final orders and links.
  for (let i = 0; i < orderedStepIds.length; i += 1) {
    await tx.workflowStep.update({
      where: { id: orderedStepIds[i] },
      data: {
        workflowId,
        stepOrder: i + 1,
        nextStepId: orderedStepIds[i + 1] ?? null
      }
    });
  }
}

function stepTypeFromAgentName(agentName: string): (typeof WORKFLOW_STEP_TYPES)[number] {
  const lower = agentName.toLowerCase();
  if (lower.includes("pre-process") || lower.includes("preprocess") || lower.includes("split")) return "PRE_PROCESSOR";
  if (lower.includes("intake") || lower.includes("request")) return "EMAIL_INTAKE";
  if (lower.includes("classif")) return "CLAIM_CLASSIFICATION";
  if (lower.includes("ocr")) return "DOCUMENT_OCR";
  if (lower.includes("document validation") || lower.includes("doc check")) return "DOCUMENT_VALIDATION";
  if (lower.includes("medical coding") || lower.includes("icd")) return "MEDICAL_CODING";
  if (lower.includes("policy") || lower.includes("lookup")) return "POLICY_LOOKUP";
  if (lower.includes("coverage")) return "COVERAGE_RULES";
  if (lower.includes("provider network") || lower.includes("network")) return "PROVIDER_NETWORK_CHECK";
  if (lower.includes("settlement") || lower.includes("estimator")) return "SETTLEMENT_ESTIMATION";
  if (lower.includes("fraud")) return "FRAUD_SCREENING";
  if (lower.includes("handoff") || lower.includes("escalation")) return "HUMAN_HANDOFF";
  if (lower.includes("customer comm") || lower.includes("communication") || lower.includes("notify")) return "CUSTOMER_COMMS";
  if (lower.includes("audit") || lower.includes("compliance")) return "AUDIT_COMPLIANCE";
  if (lower.includes("comparison") || lower.includes("explainer") || lower.includes("advisor")) return "KNOWLEDGE_CHECK";
  if (lower.includes("document")) return "DOCUMENT_OCR";
  if (lower.includes("extract")) return "DATA_EXTRACTION";
  if (lower.includes("generation") || lower.includes("merge") || lower.includes("template") || lower.includes("crm")) return "DATA_EXTRACTION";
  if (lower.includes("kyc") || lower.includes("valid")) return "VALIDATION";
  if (lower.includes("lead") || lower.includes("qualification") || lower.includes("scoring")) return "DECISION";
  if (lower.includes("risk") || lower.includes("fraud") || lower.includes("decision") || lower.includes("underwrit")) return "DECISION";
  if (lower.includes("orchestrator") || lower.includes("planner") || lower.includes("retry") || lower.includes("audit trail")) return "SLA_CHECK";
  if (lower.includes("outreach") || lower.includes("coordination")) return "NOTIFY_CUSTOMER";
  if (lower.includes("sales") || lower.includes("follow-up") || lower.includes("cross-sell") || lower.includes("upsell") || lower.includes("handoff")) return "NOTIFY_CUSTOMER";
  return "APPROVAL";
}

type WorkflowValidationIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  stepId?: string;
};

function validateWorkflowGraph(steps: Array<{
  id: string;
  name: string;
  stepType: string;
  stepOrder: number;
  nextStepId: string | null;
  config: unknown;
}>): {
  valid: boolean;
  errors: WorkflowValidationIssue[];
  warnings: WorkflowValidationIssue[];
} {
  const errors: WorkflowValidationIssue[] = [];
  const warnings: WorkflowValidationIssue[] = [];
  if (steps.length === 0) {
    errors.push({
      code: "EMPTY_WORKFLOW",
      severity: "error",
      message: "Workflow has no steps."
    });
    return { valid: false, errors, warnings };
  }

  const sorted = steps.slice().sort((a, b) => a.stepOrder - b.stepOrder);
  const idSet = new Set(sorted.map((step) => step.id));
  const byId = new Map(sorted.map((step) => [step.id, step]));
  const firstStep = sorted[0];

  for (const step of sorted) {
    if (!step.name?.trim()) {
      errors.push({
        code: "MISSING_STEP_NAME",
        severity: "error",
        message: "A step is missing a name.",
        stepId: step.id
      });
    }
    if (!WORKFLOW_STEP_TYPES.includes(step.stepType as any)) {
      errors.push({
        code: "UNSUPPORTED_STEP_TYPE",
        severity: "error",
        message: `Unsupported step type "${step.stepType}".`,
        stepId: step.id
      });
    }
    if (step.nextStepId && !idSet.has(step.nextStepId)) {
      errors.push({
        code: "NEXT_STEP_NOT_FOUND",
        severity: "error",
        message: `Step points to missing nextStepId "${step.nextStepId}".`,
        stepId: step.id
      });
    }
    if (step.nextStepId && step.nextStepId === step.id) {
      errors.push({
        code: "SELF_LOOP",
        severity: "error",
        message: "Step cannot point to itself as nextStepId.",
        stepId: step.id
      });
    }

    const cfg = asRecord(step.config);
    const routes = asRecord(cfg.routes);
    for (const [decision, nextId] of Object.entries(routes)) {
      if (typeof nextId !== "string" || nextId.length === 0) {
        errors.push({
          code: "INVALID_ROUTE_TARGET",
          severity: "error",
          message: `Route "${decision}" has invalid target.`,
          stepId: step.id
        });
        continue;
      }
      if (!idSet.has(nextId)) {
        errors.push({
          code: "ROUTE_TARGET_NOT_FOUND",
          severity: "error",
          message: `Route "${decision}" points to unknown step "${nextId}".`,
          stepId: step.id
        });
      }
    }
  }

  const reachable = new Set<string>();
  const stack: string[] = [firstStep.id];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    const step = byId.get(current);
    if (!step) continue;
    if (step.nextStepId) stack.push(step.nextStepId);
    const routes = asRecord(asRecord(step.config).routes);
    for (const nextId of Object.values(routes)) {
      if (typeof nextId === "string" && nextId.length > 0) {
        stack.push(nextId);
      }
    }
  }

  for (const step of sorted) {
    if (!reachable.has(step.id)) {
      warnings.push({
        code: "UNREACHABLE_STEP",
        severity: "warning",
        message: `Step "${step.name}" is unreachable from the first step.`,
        stepId: step.id
      });
    }
  }

  const terminalSteps = sorted.filter((step) => {
    const routes = asRecord(asRecord(step.config).routes);
    const hasRoutes = Object.keys(routes).length > 0;
    return !step.nextStepId && !hasRoutes;
  });
  if (terminalSteps.length === 0) {
    warnings.push({
      code: "NO_TERMINAL_STEP",
      severity: "warning",
      message: "Workflow has no explicit terminal step."
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

async function createCaseWithDocuments(input: {
  caseType: string;
  priority: "critical" | "high" | "medium" | "low";
  memberName: string;
  documents: Array<{ name: string; type: string; pages?: number; text?: string }>;
}): Promise<{ id: string }> {
  const caseId = buildCaseCode();
  const createdCase = await prisma.caseRecord.create({
    data: {
      id: caseId,
      caseType: input.caseType,
      workflowStage: "Queued for Workflow",
      assignedUserName: null,
      aiStatus: "processing",
      priority: input.priority,
      memberName: input.memberName,
      status: "new",
      documentsTotal: input.documents.length,
      documentsComplete: 0
    }
  });

  if (input.documents.length > 0) {
    await prisma.document.createMany({
      data: input.documents.map((document) => ({
        caseId,
        name: document.name,
        type: document.type,
        status: "pending",
        pages: document.pages ?? null
      }))
    });
  }

  return createdCase;
}

async function startWorkflowExecutionForIntake(args: {
  workflowId: string;
  caseType: string;
  priority: "critical" | "high" | "medium" | "low";
  memberName: string;
  emailSubject?: string;
  emailBody?: string;
  documents: Array<{ name: string; type: string; pages?: number; text?: string }>;
  source: string;
}): Promise<{
  caseRecord: { id: string };
  executionId: string;
  queued: boolean;
}> {
  const caseRecord = await createCaseWithDocuments({
    caseType: args.caseType,
    priority: args.priority,
    memberName: args.memberName,
    documents: args.documents
  });

  const start = await workflowEngine.startExecution({
    workflowId: args.workflowId,
    caseId: caseRecord.id,
    source: args.source,
    input: {
      memberName: args.memberName,
      caseType: args.caseType,
      priority: args.priority,
      emailSubject: args.emailSubject ?? "",
      emailBody: args.emailBody ?? "",
      documents: args.documents
    }
  });

  if (!start.queued) {
    app.log.warn(`Workflow queue unavailable, processing inline execution ${start.executionId}`);
    await workflowEngine.processExecution(start.executionId);
  }

  return {
    caseRecord,
    executionId: start.executionId,
    queued: start.queued
  };
}

async function emitIntakeStatus(jobId: string, caseId: string, status: string, message: string): Promise<void> {
  const payload: IntakeJobEvent = {
    jobId,
    caseId,
    status: status as IntakeJobEvent["status"],
    message,
    timestamp: new Date().toISOString()
  };

  io.emit("intakeJobStatus", payload);
  io.to(`case:${caseId}`).emit("intakeJobStatus", payload);

  await prisma.event.create({
    data: {
      caseId,
      type: "intakeJobStatus",
      payload: payload as any
    }
  });
}

async function emitAgentRun(caseId: string, runId: string, step: string, status: string, output: string): Promise<void> {
  const payload: AgentRunEvent = {
    runId,
    caseId,
    step,
    status: status as AgentRunEvent["status"],
    output,
    timestamp: new Date().toISOString()
  };
  io.emit("agentRunStatus", payload);
  io.to(`case:${caseId}`).emit("agentRunStatus", payload);

  await prisma.event.create({
    data: {
      caseId,
      type: "agentRunStatus",
      payload: payload as any
    }
  });
}

async function emitReviewQueueChange(caseId: string, taskId: string, status: string, reason: string): Promise<void> {
  const payload = {
    caseId,
    taskId,
    status,
    reason,
    timestamp: new Date().toISOString()
  };

  io.emit("reviewQueueUpdates", payload);
  io.to(`case:${caseId}`).emit("reviewQueueUpdates", payload);

  await prisma.event.create({
    data: {
      caseId,
      type: "reviewQueueUpdates",
      payload: payload as any
    }
  });
}

async function emitWorkflowStepLog(args: {
  caseId: string;
  executionId: string;
  stepId: string;
  stepName: string;
  stepType: string;
  status: "running" | "completed" | "failed";
  message: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const eventPayload = {
    executionId: args.executionId,
    stepId: args.stepId,
    stepName: args.stepName,
    stepType: args.stepType,
    status: args.status,
    message: args.message,
    payload: args.payload ?? {},
    timestamp: new Date().toISOString()
  };
  io.emit("workflowStepStatus", eventPayload);
  io.to(`case:${args.caseId}`).emit("workflowStepStatus", eventPayload);

  await prisma.event.create({
    data: {
      caseId: args.caseId,
      type: "workflowStepStatus",
      payload: eventPayload as any
    }
  });

  // Persist workflow step activity to agentRuns so case timelines and analytics
  // can show real execution traces (not just static placeholders).
  await prisma.agentRun.create({
    data: {
      caseId: args.caseId,
      agentId: null,
      agentName: args.stepName,
      step: args.stepName,
      stepKind: args.stepType,
      status: args.status,
      output: args.message,
      outputJson: (args.payload ?? {}) as any
    }
  });
}

const workflowEngine = new WorkflowEngine({
  prisma,
  agentsServiceUrl,
  onStepLogged: async (args) => {
    await emitWorkflowStepLog({
      caseId: args.caseId,
      executionId: args.executionId,
      stepId: args.stepId,
      stepName: args.stepName,
      stepType: args.stepType,
      status: args.status,
      message: args.message,
      payload: args.payload
    });
  },
  onHumanReviewRequired: async (args) => {
    const reviewTask = await prisma.reviewTask.create({
      data: {
        caseId: args.caseId,
        reason: args.reason,
        status: "open"
      }
    });
    await emitReviewQueueChange(args.caseId, reviewTask.id, "open", args.reason);
  }
});

async function callAgent(endpoint: string, payload: unknown): Promise<any> {
  try {
    const response = await fetch(`${agentsServiceUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Agent service failed with status ${response.status}`);
    }

    return await response.json();
  } catch {
    // Deterministic fallback keeps local development functional even when
    // the ADK service is unavailable.
    if (endpoint === "/run/extraction") {
      return {
        extractedFields: 18,
        missingDocuments: [],
        summary: "Fallback extraction completed."
      };
    }

    return {
      confidence: 0.7,
      requiresReview: true,
      reasons: [
        "ADK service unavailable; manual review required."
      ]
    };
  }
}

async function processIntakeJob(jobId: string): Promise<void> {
  const job = await prisma.intakeJob.findUnique({
    where: {
      id: jobId
    }
  });

  if (!job) {
    return;
  }

  const resolvedFlow = flowConfigSchema.safeParse(job.flowConfig);
  const flow = resolvedFlow.success ? resolvedFlow.data : defaultFlowConfig;

  let extractionOutput: Record<string, unknown> = {};
  let validationOutput: Record<string, unknown> = {};
  let reviewReason = "Validation requires human review";
  let needsReview = false;
  const flowAgentNames = Array.from(new Set(flow.steps.map((step) => step.agentName)));
  const flowAgents: Array<{ id: string; name: string }> = await prisma.agentDefinition.findMany({
    where: {
      name: {
        in: flowAgentNames
      }
    },
    select: {
      id: true,
      name: true
    }
  });
  const agentIdByName = new Map(flowAgents.map((agent) => [agent.name, agent.id]));

  let currentStep: FlowStep | null = flow.steps.find((step) => step.kind === "extraction") ?? flow.steps[0] ?? null;

  while (currentStep) {
    const intakeStatus = currentStep.kind === "extraction"
      ? "parsing"
      : currentStep.kind === "validation"
        ? "validating"
        : "needs_review";

    await prisma.intakeJob.update({
      where: { id: jobId },
      data: {
        status: intakeStatus,
        currentStep: currentStep.id
      }
    });

    await emitIntakeStatus(jobId, job.caseId, intakeStatus, `${currentStep.agentName} running`);

    const startedAt = Date.now();
    let output: Record<string, unknown> = {};
    let inputPayload: Record<string, unknown> = {};

    if (currentStep.kind === "extraction") {
      inputPayload = {
        caseId: job.caseId,
        intakeJobId: jobId,
        agentName: currentStep.agentName
      };
      output = await callAgent("/run/extraction", inputPayload);
      extractionOutput = output;
    } else if (currentStep.kind === "validation") {
      inputPayload = {
        caseId: job.caseId,
        intakeJobId: jobId,
        extraction: extractionOutput,
        agentName: currentStep.agentName
      };
      output = await callAgent("/run/validation", inputPayload);
      validationOutput = output;
      const confidence = Number(output.confidence ?? 0);
      const requiresReview = Boolean(output.requiresReview);
      needsReview = requiresReview || confidence < 0.8;
      reviewReason = Array.isArray(output.reasons)
        ? output.reasons.join(", ")
        : "Validation flagged review";
    } else {
      inputPayload = {
        caseId: job.caseId,
        intakeJobId: jobId,
        agentName: currentStep.agentName
      };
      output = {
        requiresReview: true,
        reason: "Flow reached human review step"
      };
      needsReview = true;
      reviewReason = "Flow directed case to human review step";
    }

    const durationMs = Date.now() - startedAt;
    const run = await prisma.agentRun.create({
      data: {
        caseId: job.caseId,
        intakeJobId: jobId,
        agentId: agentIdByName.get(currentStep.agentName) ?? null,
        agentName: currentStep.agentName,
        step: `${currentStep.id}:${currentStep.kind}`,
        stepKind: currentStep.kind,
        status: "completed",
        output: JSON.stringify(output),
        outputJson: output as any,
        inputJson: inputPayload as any,
        durationMs
      }
    });

    await emitAgentRun(job.caseId, run.id, currentStep.kind, "completed", `${currentStep.agentName} completed`);

    const nextId: string | null = currentStep.kind === "validation" && needsReview
      ? currentStep.nextOnFailure
      : currentStep.nextOnSuccess;
    if (!nextId) {
      break;
    }
    currentStep = flow.steps.find((step) => step.id === nextId) ?? null;
  }

  if (needsReview) {
    const reviewTask = await prisma.reviewTask.create({
      data: {
        caseId: job.caseId,
        reason: reviewReason,
        status: "open"
      }
    });

    await prisma.caseRecord.update({
      where: { id: job.caseId },
      data: {
        status: "review",
        aiStatus: "needs_review",
        workflowStage: "Human Review"
      }
    });
    await prisma.intakeJob.update({
      where: { id: jobId },
      data: {
        status: "needs_review",
        currentStep: "human_review"
      }
    });

    await emitReviewQueueChange(job.caseId, reviewTask.id, "open", reviewReason);
    await emitIntakeStatus(jobId, job.caseId, "needs_review", "Case routed to human review queue");
    return;
  }

  await prisma.caseRecord.update({
    where: { id: job.caseId },
    data: {
      status: "completed",
      aiStatus: "complete",
      workflowStage: "Completed"
    }
  });
  await prisma.intakeJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      currentStep: "done"
    }
  });
  await emitIntakeStatus(jobId, job.caseId, "completed", "Intake flow completed");
}

app.get("/health", async () => {
  const [runningExecutions, openReviewTasks] = await Promise.all([
    prisma.workflowExecution.count({ where: { status: "running" } }),
    prisma.reviewTask.count({ where: { status: { in: ["open", "claimed"] } } })
  ]);
  return {
    status: "ok",
    service: "api",
    telemetry: {
      activeWorkflows: runningExecutions,
      openReviewTasks
    }
  };
});

app.get("/fraud/system/taxonomy", async () => {
  return {
    data: {
      sectors: getFraudTaxonomy(),
      rules: FRAUD_RULE_LIBRARY
    }
  };
});

app.get("/fraud/system/demo-cases", async (request) => {
  const querySchema = z.object({
    sector: fraudSectorSchema.optional()
  });
  const { sector } = querySchema.parse(request.query ?? {});
  return {
    data: getFraudDemoCases(sector)
  };
});

app.get("/fraud/system/demo-cases/:caseId", async (request, reply) => {
  const paramsSchema = z.object({
    caseId: z.string()
  });
  const { caseId } = paramsSchema.parse(request.params ?? {});
  const demoCase = getFraudDemoCaseById(caseId);
  if (!demoCase) {
    return reply.code(404).send({ error: "Fraud demo case not found" });
  }
  return { data: demoCase };
});

app.post("/fraud/system/detect", async (request, reply) => {
  const input = fraudDetectInputSchema.parse(request.body ?? {});

  const baseCase = input.caseId ? getFraudDemoCaseById(input.caseId) : null;
  if (input.caseId && !baseCase) {
    return reply.code(404).send({ error: "Fraud demo case not found for detection" });
  }

  const detectionInput: FraudDemoCase = {
    ...(baseCase ?? {
      id: `adhoc-${Date.now()}`,
      caseCode: `FRD-ADHOC-${Date.now()}`,
      sector: input.sector,
      product: input.sector === "insurance" ? "Adhoc Insurance" : "Adhoc Banking",
      title: input.title ?? "Adhoc fraud detection request",
      claimOrTxnAmount: input.amount ?? 0,
      customerName: "Adhoc Customer",
      customerId: "ADHOC",
      policyOrAccountNumber: "ADHOC-0001",
      channel: "api" as const,
      geo: "Unknown",
      expectedLabel: "genuine" as const,
      signals: {},
      documents: []
    }),
    sector: input.sector as FraudSector,
    title: input.title ?? baseCase?.title ?? "Adhoc fraud detection request",
    claimOrTxnAmount: input.amount ?? baseCase?.claimOrTxnAmount ?? 0,
    signals: {
      ...(baseCase?.signals ?? {}),
      ...((input.signals ?? {}) as Record<string, string | number | boolean>)
    }
  };

  const result = detectFraud(detectionInput);
  return { data: { input: detectionInput, result } };
});

app.post("/fraud/system/demo-run", async (request) => {
  const bodySchema = z.object({
    sector: fraudSectorSchema.optional()
  });
  const { sector } = bodySchema.parse(request.body ?? {});
  const results = runFraudDemoSweep(sector);
  const metrics = {
    total: results.length,
    flagged: results.filter((r) => r.verdict !== "allow").length,
    blocked: results.filter((r) => r.verdict === "block").length,
    review: results.filter((r) => r.verdict === "review").length
  };

  return { data: { metrics, results } };
});

app.post("/auth/login", async (request, reply) => {
  const input = authLoginSchema.parse(request.body);
  const email = normalizeEmail(input.email);
  if (!isAllowedLoginEmail(email)) {
    return reply.code(403).send({ error: "Email is not enabled for login" });
  }
  const user = await prisma.user.findUnique({
    where: { email }
  });
  if (user && !user.passwordHash) {
    return reply.code(409).send({
      error: "FIRST_LOGIN_REQUIRED",
      message: "First-time setup required. Please set your password.",
      data: { firstLogin: true, email }
    });
  }
  const passwordHash = user?.passwordHash ?? null;
  const credentialsValid = Boolean(user && passwordHash && verifyPassword(input.password, passwordHash));

  if (!user || !credentialsValid) {
    await writeAuditLog({
      request,
      userId: user?.id ?? null,
      action: "auth.login",
      resource: "session",
      status: "failure"
    });
    return reply.code(401).send({ error: "Invalid email or password" });
  }

  const session = await issueSessionTokens(user, reply);
  await writeAuditLog({
    request,
    userId: user.id,
    action: "auth.login",
    resource: "session",
    status: "success",
    metadata: { role: user.role }
  });

  return {
    data: session
  };
});

app.post("/auth/first-login", async (request, reply) => {
  const input = authFirstLoginSchema.parse(request.body ?? {});
  const email = normalizeEmail(input.email);
  if (!isAllowedLoginEmail(email)) {
    return reply.code(403).send({ error: "Email is not enabled for first-time setup" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.passwordHash) {
    return reply.code(409).send({ error: "Account is already initialized. Please log in." });
  }

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: (input.name ?? "").trim() || displayNameFromEmail(email),
      role: "support_agent",
      passwordHash: hashPassword(input.password)
    },
    update: {
      name: (input.name ?? "").trim() || existing?.name || displayNameFromEmail(email),
      passwordHash: hashPassword(input.password)
    }
  });

  const session = await issueSessionTokens(user, reply);
  await writeAuditLog({
    request,
    userId: user.id,
    action: "auth.first_login",
    resource: "session",
    status: "success"
  });

  return reply.code(201).send({ data: session });
});

app.post("/auth/bootstrap-admin", async (request, reply) => {
  const input = authBootstrapSchema.parse(request.body);
  const existingAdmin = await prisma.user.findFirst({
    where: {
      role: "admin",
      passwordHash: { not: null }
    },
    select: { id: true }
  });
  if (existingAdmin) {
    return reply.code(409).send({ error: "Admin already initialized" });
  }
  if (bootstrapAdminToken && input.token !== bootstrapAdminToken) {
    return reply.code(403).send({ error: "Invalid bootstrap token" });
  }

  const email = normalizeEmail(input.email);
  if (!isAllowedAccountEmail(email)) {
    return reply.code(403).send({ error: "Email domain is not allowed for account provisioning" });
  }
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: input.name ?? "Platform Admin",
      role: "admin",
      passwordHash: hashPassword(input.password)
    },
    update: {
      name: input.name ?? undefined,
      role: "admin",
      passwordHash: hashPassword(input.password)
    }
  });

  await writeAuditLog({
    request,
    userId: user.id,
    action: "auth.bootstrap_admin",
    resource: "user",
    resourceId: user.id,
    status: "success"
  });

  return reply.code(201).send({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
});

app.post("/auth/password-reset/request", async (request, reply) => {
  const input = authPasswordResetRequestSchema.parse(request.body ?? {});
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success shape to avoid account enumeration.
  const genericResponse = {
    data: {
      requested: true,
      message: "If this account exists, password reset instructions have been sent."
    }
  };

  if (!user || !user.email) {
    await writeAuditLog({
      request,
      action: "auth.password_reset.request",
      resource: "user",
      status: "success",
      metadata: { email, userFound: false }
    });
    return genericResponse;
  }

  const resetToken = await reply.jwtSign(
    {
      sub: user.id,
      email: user.email,
      purpose: "password_reset"
    },
    { expiresIn: "30m" }
  );

  const resetUrl = `${request.protocol}://${request.hostname}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const subject = "AuraStack Password Reset";
  const body =
    `Hi ${user.name || "User"},\n\n` +
    `A password reset was requested for your AuraStack account.\n\n` +
    `Reset link (valid for 30 minutes):\n${resetUrl}\n\n` +
    `If you did not request this, you can ignore this email.\n\n` +
    `- AuraStack Security`;

  let emailSent = false;
  try {
    const sent = await fetch(`${agentsServiceUrl}/email/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: user.email,
        subject,
        body
      })
    });
    emailSent = sent.ok;
  } catch {
    emailSent = false;
  }

  await writeAuditLog({
    request,
    userId: user.id,
    action: "auth.password_reset.request",
    resource: "user",
    resourceId: user.id,
    status: "success",
    metadata: { emailSent }
  });

  const exposeTokenInDev = (process.env.AUTH_PASSWORD_RESET_DEV_TOKEN ?? (process.env.NODE_ENV !== "production" ? "true" : "false")) === "true";
  if (exposeTokenInDev) {
    return {
      data: {
        requested: true,
        message: emailSent
          ? "Reset email sent."
          : "Reset email dispatch unavailable; use dev token to proceed.",
        resetToken
      }
    };
  }

  return genericResponse;
});

app.post("/auth/password-reset/confirm", async (request, reply) => {
  const input = authPasswordResetConfirmSchema.parse(request.body ?? {});
  let payload: { sub?: string; email?: string; purpose?: string } | null = null;

  try {
    payload = await app.jwt.verify<{ sub: string; email?: string; purpose?: string }>(input.token);
  } catch {
    await writeAuditLog({
      request,
      action: "auth.password_reset.confirm",
      resource: "user",
      status: "failure",
      metadata: { reason: "invalid_token" }
    });
    return reply.code(401).send({ error: "Invalid or expired reset token" });
  }

  if (!payload?.sub || payload.purpose !== "password_reset") {
    await writeAuditLog({
      request,
      action: "auth.password_reset.confirm",
      resource: "user",
      status: "failure",
      metadata: { reason: "invalid_payload" }
    });
    return reply.code(401).send({ error: "Invalid or expired reset token" });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    return reply.code(404).send({ error: "User not found" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(input.newPassword) }
  });

  // Revoke all existing sessions after password reset.
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() }
  });

  await writeAuditLog({
    request,
    userId: user.id,
    action: "auth.password_reset.confirm",
    resource: "user",
    resourceId: user.id,
    status: "success"
  });

  return { data: { reset: true } };
});

app.post("/auth/refresh", async (request, reply) => {
  const input = authRefreshSchema.parse(request.body);
  const tokenHash = hashToken(input.refreshToken);
  const refreshToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!refreshToken || refreshToken.revokedAt || refreshToken.expiresAt < new Date()) {
    await writeAuditLog({
      request,
      action: "auth.refresh",
      resource: "session",
      status: "failure"
    });
    return reply.code(401).send({ error: "Invalid refresh token" });
  }

  await prisma.refreshToken.update({
    where: { id: refreshToken.id },
    data: { revokedAt: new Date() }
  });

  const session = await issueSessionTokens(refreshToken.user, reply);
  await writeAuditLog({
    request,
    userId: refreshToken.userId,
    action: "auth.refresh",
    resource: "session",
    status: "success"
  });

  return { data: session };
});

app.post("/auth/logout", { preHandler: [requireAuth] }, async (request, reply) => {
  const input = authLogoutSchema.parse(request.body ?? {});
  const payload = request.user as AuthJwtPayload | undefined;
  const userId = payload?.sub ?? null;

  if (!userId && authRequired) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  if (input.revokeAll && userId) {
    await prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  if (input.refreshToken) {
    await prisma.refreshToken.updateMany({
      where: {
        tokenHash: hashToken(input.refreshToken),
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  await writeAuditLog({
    request,
    userId,
    action: "auth.logout",
    resource: "session",
    status: "success",
    metadata: { revokeAll: Boolean(input.revokeAll) }
  });

  return { data: { revoked: true } };
});

app.get("/auth/me", { preHandler: [requireAuth] }, async (request, reply) => {
  if (!authRequired) {
    return { data: { mode: "auth-optional" } };
  }

  const payload = request.user as AuthJwtPayload;
  const user = await prisma.user.findUnique({
    where: { id: payload.sub }
  });
  if (!user) {
    return reply.code(404).send({ error: "User not found" });
  }

  return {
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  };
});

app.get("/auth/sessions", { preHandler: [requireAuth] }, async (request, reply) => {
  if (!authRequired) {
    return { data: [] };
  }

  const payload = requestUser(request);
  if (!payload) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  const sessions = await prisma.refreshToken.findMany({
    where: {
      userId: payload.sub
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 100
  });

  await writeAuditLog({
    request,
    userId: payload.sub,
    action: "auth.sessions.read",
    resource: "session",
    status: "success"
  });

  return {
    data: sessions.map((session: { id: string; createdAt: Date; updatedAt: Date; expiresAt: Date; revokedAt: Date | null }) => ({
      id: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt
    }))
  };
});

app.post("/auth/sessions/:sessionId/revoke", { preHandler: [requireAuth] }, async (request, reply) => {
  if (!authRequired) {
    return { data: { revoked: false } };
  }

  const payload = requestUser(request);
  if (!payload) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  const { sessionId } = revokeSessionSchema.parse(request.params);
  const session = await prisma.refreshToken.findUnique({
    where: { id: sessionId }
  });
  if (!session || session.userId !== payload.sub) {
    await writeAuditLog({
      request,
      userId: payload.sub,
      action: "auth.session.revoke",
      resource: "session",
      resourceId: sessionId,
      status: "failure"
    });
    return reply.code(404).send({ error: "Session not found" });
  }

  await prisma.refreshToken.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() }
  });

  await writeAuditLog({
    request,
    userId: payload.sub,
    action: "auth.session.revoke",
    resource: "session",
    resourceId: sessionId,
    status: "success"
  });

  return { data: { revoked: true, sessionId } };
});

app.get("/auth/users", { preHandler: [requireRoles(["admin"])] }, async () => {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  });

  return { data: users };
});

app.post("/auth/users", { preHandler: [requireRoles(["admin"])] }, async (request, reply) => {
  const input = authCreateUserSchema.parse(request.body);
  const email = normalizeEmail(input.email);
  if (!isAllowedAccountEmail(email)) {
    return reply.code(403).send({ error: "Email domain is not allowed for account provisioning" });
  }

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: input.name,
      role: input.role,
      passwordHash: hashPassword(input.password)
    },
    update: {
      name: input.name,
      role: input.role,
      passwordHash: hashPassword(input.password)
    }
  });

  await writeAuditLog({
    request,
    userId: requestUser(request)?.sub ?? null,
    action: "auth.user.upsert",
    resource: "user",
    resourceId: user.id,
    status: "success",
    metadata: { role: user.role }
  });

  return reply.code(201).send({
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

app.patch("/auth/users/:userId/role", { preHandler: [requireRoles(["admin"])] }, async (request, reply) => {
  const { userId } = z.object({ userId: z.string() }).parse(request.params);
  const { role } = authUpdateRoleSchema.parse(request.body);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { role }
  });

  await writeAuditLog({
    request,
    userId: requestUser(request)?.sub ?? null,
    action: "auth.user.role.update",
    resource: "user",
    resourceId: user.id,
    status: "success",
    metadata: { role }
  });

  return {
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  };
});

app.patch("/auth/me/password", { preHandler: [requireAuth] }, async (request, reply) => {
  const payload = requestUser(request);
  if (!payload) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const input = authUpdatePasswordSchema.parse(request.body);
  const user = await prisma.user.findUnique({
    where: { id: payload.sub }
  });
  if (!user) {
    return reply.code(404).send({ error: "User not found" });
  }
  if (user.passwordHash) {
    const currentPassword = input.currentPassword ?? "";
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return reply.code(401).send({ error: "Current password is incorrect" });
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(input.newPassword) }
  });

  await writeAuditLog({
    request,
    userId: user.id,
    action: "auth.password.update",
    resource: "user",
    resourceId: user.id,
    status: "success"
  });

  return { data: { updated: true } };
});

app.get("/cases", async (request) => {
  const querySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    status: z.string().optional(),
    domain: z.string().optional()
  });
  const { page, limit, status, domain } = querySchema.parse(request.query ?? {});
  const pageValue = page ?? 1;
  const limitValue = limit ?? 100;

  const where: Prisma.CaseRecordWhereInput = {
    ...(status ? { status } : {}),
    ...(domain ? caseWhereForDomain(domain) : {})
  };
  const [total, data] = await Promise.all([
    prisma.caseRecord.count({ where }),
    prisma.caseRecord.findMany({
      where,
      include: {
        documents: true,
        reviewTasks: {
          orderBy: { createdAt: "desc" },
          take: 5
        },
        agentRuns: {
          orderBy: { createdAt: "desc" },
          take: 10
        }
      },
      orderBy: { createdAt: "desc" },
      skip: (pageValue - 1) * limitValue,
      take: limitValue
    })
  ]);

  return {
    data,
    total,
    page: pageValue,
    limit: limitValue
  };
});

app.get("/documents", async () => {
  const data = await prisma.document.findMany({
    include: {
      case: {
        select: {
          id: true,
          caseType: true,
          workflowStage: true,
          memberName: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
  return { data };
});

app.get("/cases/:caseId", async (request, reply) => {
  const schema = z.object({ caseId: z.string() });
  const { caseId } = schema.parse(request.params);

  const record = await prisma.caseRecord.findUnique({
    where: { id: caseId },
    include: {
      documents: true,
      intakeJobs: {
        orderBy: {
          createdAt: "desc"
        }
      },
      reviewTasks: {
        orderBy: {
          createdAt: "desc"
        }
      },
      agentRuns: {
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  if (!record) {
    return reply.code(404).send({ error: "Case not found" });
  }

  return { data: record };
});

app.get("/cases/:caseId/events", async (request) => {
  const schema = z.object({ caseId: z.string() });
  const { caseId } = schema.parse(request.params);
  const events = await prisma.event.findMany({
    where: { caseId },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return { data: events };
});

app.get("/audit/logs", { preHandler: [requirePermissions(["VIEW_AUDIT_TRAIL"])] }, async (request) => {
  const querySchema = z.object({
    limit: z.coerce.number().min(1).max(500).optional()
  });
  const { limit } = querySchema.parse(request.query ?? {});

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit ?? 200,
    include: {
      user: true
    }
  });

  await writeAuditLog({
    request,
    action: "audit_logs.read",
    resource: "audit_log",
    status: "success",
    metadata: { limit: limit ?? 200 }
  });

  return { data: logs };
});

app.get("/audit/verify", { preHandler: [requirePermissions(["VIEW_AUDIT_TRAIL"])] }, async (request) => {
  const querySchema = z.object({
    limit: z.coerce.number().min(1).max(5000).optional()
  });
  const { limit } = querySchema.parse(request.query ?? {});
  const logs = await prisma.auditLog.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit ?? 2000
  });

  let previousSignature = "GENESIS";
  const broken: Array<{ id: string; reason: string }> = [];

  for (const log of logs) {
    const metadata = asRecord(log.metadata);
    const actor = typeof metadata.actor === "string" ? metadata.actor : (log.userId ? "user" : "system");
    const details = typeof metadata.details === "string" ? metadata.details : log.action;
    const timestamp = typeof metadata.timestamp === "string" ? metadata.timestamp : log.createdAt.toISOString();
    const expected = buildAuditSignature({
      previousSignature,
      timestamp,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      status: log.status as "success" | "failure",
      actor,
      details
    });
    const actual = typeof metadata.signature === "string" ? metadata.signature : "";
    if (!actual || actual !== expected) {
      broken.push({
        id: log.id,
        reason: !actual ? "missing_signature" : "signature_mismatch"
      });
    }
    previousSignature = actual || previousSignature;
  }

  return {
    data: {
      verified: broken.length === 0,
      checked: logs.length,
      brokenCount: broken.length,
      broken
    }
  };
});

app.post("/audit/backfill-signatures", { preHandler: [requireRoles(["admin"])] }, async (request) => {
  const logs = await prisma.auditLog.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });

  let previousSignature = "GENESIS";
  let updated = 0;

  for (const log of logs) {
    const metadata = asRecord(log.metadata);
    const actor = typeof metadata.actor === "string" ? metadata.actor : (log.userId ? "user" : "system");
    const details = typeof metadata.details === "string" ? metadata.details : log.action;
    const timestamp = typeof metadata.timestamp === "string" ? metadata.timestamp : log.createdAt.toISOString();
    const expected = buildAuditSignature({
      previousSignature,
      timestamp,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      status: log.status as "success" | "failure",
      actor,
      details
    });

    const nextMetadata: Record<string, unknown> = {
      ...metadata,
      actor,
      details,
      timestamp,
      event_type: typeof metadata.event_type === "string" ? metadata.event_type : log.action.toUpperCase().replace(/\./g, "_"),
      previous_signature: previousSignature,
      signature: expected,
      verification_status: "valid"
    };

    const currentSignature = typeof metadata.signature === "string" ? metadata.signature : "";
    if (currentSignature !== expected) {
      await prisma.auditLog.update({
        where: { id: log.id },
        data: {
          metadata: nextMetadata as any
        }
      });
      updated += 1;
    }
    previousSignature = expected;
  }

  await writeAuditLog({
    request,
    action: "audit.backfill_signatures",
    resource: "audit_log",
    status: "success",
    metadata: {
      updatedEntries: updated
    }
  });

  return {
    data: {
      totalLogs: logs.length,
      updated
    }
  };
});

app.get("/audit/export", { preHandler: [requirePermissions(["VIEW_AUDIT_TRAIL"])] }, async (request, reply) => {
  const querySchema = z.object({
    caseId: z.string().optional(),
    eventType: z.string().optional(),
    actor: z.string().optional(),
    limit: z.coerce.number().min(1).max(5000).optional()
  });
  const { caseId, eventType, actor, limit } = querySchema.parse(request.query ?? {});

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit ?? 1000
  });

  const filtered = logs.filter((log) => {
    const metadata = asRecord(log.metadata);
    const metadataCaseId = typeof metadata.caseId === "string" ? metadata.caseId : null;
    const metadataEventType = typeof metadata.event_type === "string" ? metadata.event_type : log.action.toUpperCase().replace(/\./g, "_");
    const metadataActor = typeof metadata.actor === "string" ? metadata.actor : (log.userId ? "user" : "system");
    if (caseId && metadataCaseId !== caseId && log.resourceId !== caseId) return false;
    if (eventType && metadataEventType !== eventType) return false;
    if (actor && metadataActor !== actor) return false;
    return true;
  });

  const csvHeader = "timestamp,event_type,action,resource,resource_id,status,actor,signature,verification_status\n";
  const csvRows = filtered.map((log) => {
    const metadata = asRecord(log.metadata);
    const timestamp = typeof metadata.timestamp === "string" ? metadata.timestamp : log.createdAt.toISOString();
    const event = typeof metadata.event_type === "string" ? metadata.event_type : log.action.toUpperCase().replace(/\./g, "_");
    const actorLabel = typeof metadata.actor === "string" ? metadata.actor : (log.userId ? "user" : "system");
    const signature = typeof metadata.signature === "string" ? metadata.signature : "";
    const verification = typeof metadata.verification_status === "string" ? metadata.verification_status : "unknown";
    const escape = (value: string | null | undefined) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    return [
      escape(timestamp),
      escape(event),
      escape(log.action),
      escape(log.resource),
      escape(log.resourceId),
      escape(log.status),
      escape(actorLabel),
      escape(signature),
      escape(verification)
    ].join(",");
  });

  const csv = `${csvHeader}${csvRows.join("\n")}`;
  reply.header("content-type", "text/csv; charset=utf-8");
  reply.header("content-disposition", "attachment; filename=\"audit-export.csv\"");
  return reply.send(csv);
});

app.get("/rbac/permissions", { preHandler: [requireAuth] }, async (request) => {
  const user = requestUser(request);
  const role = normalizeRole(user?.role);
  return {
    data: {
      role,
      permissions: rolePermissions[role],
      allRoles: rolePermissions
    }
  };
});

app.get("/rbac/check", { preHandler: [requireAuth] }, async (request) => {
  const querySchema = z.object({
    permission: z.string()
  });
  const { permission } = querySchema.parse(request.query ?? {});
  const user = requestUser(request);
  const role = normalizeRole(user?.role);
  const granted = hasPermission(role, permission as AppPermission);
  return {
    data: {
      role,
      permission,
      granted
    }
  };
});

app.get("/telemetry/execution-engine", { preHandler: [requireAuth] }, async (request) => {
  const querySchema = z.object({
    windowMinutes: z.coerce.number().min(1).max(24 * 60).optional()
  });
  const { windowMinutes } = querySchema.parse(request.query ?? {});
  const effectiveWindowMinutes = windowMinutes ?? 60;
  const since = new Date(Date.now() - (effectiveWindowMinutes * 60 * 1000));

  const [runningWorkflows, steps, agentRuns] = await Promise.all([
    prisma.workflowExecution.count({ where: { status: "running" } }),
    prisma.workflowExecutionStep.findMany({
      where: { startedAt: { gte: since } },
      select: {
        id: true,
        status: true,
        durationMs: true,
        errorMessage: true,
        stepType: true
      }
    }),
    prisma.agentRun.findMany({
      where: { createdAt: { gte: since } },
      select: { status: true, error: true }
    })
  ]);

  const completedSteps = steps.filter((step) => step.status === "completed");
  const failedSteps = steps.filter((step) => step.status === "failed");
  const totalLatencyMs = completedSteps.reduce((sum, step) => sum + (step.durationMs ?? 0), 0);
  const avgLatencyMs = completedSteps.length > 0 ? Math.round(totalLatencyMs / completedSteps.length) : 0;
  const executionsPerMinute = Number((steps.length / effectiveWindowMinutes).toFixed(2));
  const handoffSuccess = agentRuns.filter((run) => run.status === "completed").length;
  const handoffFailure = agentRuns.filter((run) => run.status === "failed").length;
  const handoffTotal = handoffSuccess + handoffFailure;
  const handoffSuccessRate = handoffTotal > 0 ? Number(((handoffSuccess / handoffTotal) * 100).toFixed(2)) : 0;
  const failureReasons = failedSteps.reduce<Record<string, number>>((acc, step) => {
    const key = classifyFailureReason(step.errorMessage);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return {
    data: {
      windowMinutes: effectiveWindowMinutes,
      activeWorkflows: runningWorkflows,
      nodeExecutions: {
        count: steps.length,
        executionsPerMinute,
        avgLatencyMs
      },
      agentHandoffs: {
        success: handoffSuccess,
        failure: handoffFailure,
        successRate: handoffSuccessRate,
        failureReasons
      }
    }
  };
});

app.get("/telemetry/event-bus", { preHandler: [requireAuth] }, async (request) => {
  const querySchema = z.object({
    caseId: z.string().optional(),
    eventType: z.string().optional(),
    actor: z.string().optional(),
    limit: z.coerce.number().min(1).max(1000).optional()
  });
  const { caseId, eventType, actor, limit } = querySchema.parse(request.query ?? {});
  const take = limit ?? 200;

  const [events, logs] = await Promise.all([
    prisma.event.findMany({
      where: caseId ? { caseId } : undefined,
      orderBy: { createdAt: "desc" },
      take
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take
    })
  ]);

  const eventRows = events.map((event) => {
    const payload = asRecord(event.payload);
    return {
      timestamp: event.createdAt.toISOString(),
      event_type: event.type,
      details: payload,
      actor: typeof payload.actor === "string" ? payload.actor : "system",
      case_id: event.caseId,
      source: "event"
    };
  });

  const logRows = logs
    .map((log) => {
      const metadata = asRecord(log.metadata);
      return {
        timestamp: typeof metadata.timestamp === "string" ? metadata.timestamp : log.createdAt.toISOString(),
        event_type: typeof metadata.event_type === "string" ? metadata.event_type : log.action.toUpperCase().replace(/\./g, "_"),
        details: metadata,
        actor: typeof metadata.actor === "string" ? metadata.actor : (log.userId ? "user" : "system"),
        case_id: typeof metadata.caseId === "string" ? metadata.caseId : log.resourceId,
        source: "audit_log"
      };
    });

  const merged = [...eventRows, ...logRows]
    .filter((item) => {
      if (caseId && item.case_id !== caseId) return false;
      if (eventType && item.event_type !== eventType) return false;
      if (actor && item.actor !== actor) return false;
      return true;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, take);

  return { data: merged };
});

app.get("/telemetry/compliance", { preHandler: [requirePermissions(["VIEW_AUDIT_TRAIL"])] }, async () => {
  const logs = await prisma.auditLog.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 5000
  });

  let previousSignature = "GENESIS";
  let invalidSignatures = 0;
  for (const log of logs) {
    const metadata = asRecord(log.metadata);
    const actor = typeof metadata.actor === "string" ? metadata.actor : (log.userId ? "user" : "system");
    const details = typeof metadata.details === "string" ? metadata.details : log.action;
    const timestamp = typeof metadata.timestamp === "string" ? metadata.timestamp : log.createdAt.toISOString();
    const expected = buildAuditSignature({
      previousSignature,
      timestamp,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      status: log.status as "success" | "failure",
      actor,
      details
    });
    const actual = typeof metadata.signature === "string" ? metadata.signature : "";
    if (!actual || actual !== expected) {
      invalidSignatures += 1;
    }
    previousSignature = actual || previousSignature;
  }

  const accessViolations = logs.filter((log) => log.action.startsWith("auth.")).length;
  const failureCount = logs.filter((log) => log.status === "failure").length;
  const total = Math.max(logs.length, 1);
  const signaturePenalty = Math.min(50, Math.round((invalidSignatures / total) * 100));
  const failurePenalty = Math.min(30, Math.round((failureCount / total) * 100));
  const accessPenalty = Math.min(20, Math.round((accessViolations / total) * 100));
  const baseScore = Math.max(0, 100 - signaturePenalty - failurePenalty - accessPenalty);

  return {
    data: {
      standards: {
        SOC2: baseScore,
        GDPR: Math.max(0, baseScore - 2),
        ISO27001: Math.max(0, baseScore - 1),
        HIPAA: Math.max(0, baseScore - 3)
      },
      factors: {
        totalLogs: logs.length,
        invalidSignatures,
        accessViolations,
        failureCount
      }
    }
  };
});

app.get("/review-tasks", { preHandler: [requireRoles(["reviewer", "operator", "admin"])] }, async () => {
  const data = await prisma.reviewTask.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      case: true,
      assignee: true
    }
  });

  return { data };
});

app.post("/review-tasks/:taskId/claim", { preHandler: [requireRoles(["reviewer", "admin"])] }, async (request, reply) => {
  const paramsSchema = z.object({ taskId: z.string() });
  const bodySchema = z.object({ assigneeName: z.string().min(1) });
  const { taskId } = paramsSchema.parse(request.params);
  const { assigneeName } = bodySchema.parse(request.body);

  const user = await prisma.user.upsert({
    where: { email: `${assigneeName.toLowerCase().replace(/\s+/g, ".")}@smartcase.local` },
    create: {
      name: assigneeName,
      role: "reviewer",
      email: `${assigneeName.toLowerCase().replace(/\s+/g, ".")}@smartcase.local`
    },
    update: {
      name: assigneeName
    }
  });

  const task = await prisma.reviewTask.update({
    where: { id: taskId },
    data: {
      status: "claimed",
      assignedTo: user.id
    }
  });

  await emitReviewQueueChange(task.caseId, task.id, "claimed", "Task claimed");
  await writeAuditLog({
    request,
    userId: user.id,
    action: "review_task.claim",
    resource: "review_task",
    resourceId: task.id,
    status: "success"
  });
  return reply.send({ data: task });
});

app.post("/review-tasks/:taskId/resolve", { preHandler: [requireRoles(["reviewer", "admin"])] }, async (request, reply) => {
  const paramsSchema = z.object({ taskId: z.string() });
  const bodySchema = z.object({
    resolutionNote: z.string().optional()
  });
  const { taskId } = paramsSchema.parse(request.params);
  const { resolutionNote } = bodySchema.parse(request.body);

  const task = await prisma.reviewTask.update({
    where: { id: taskId },
    data: {
      status: "resolved"
    }
  });
  await prisma.caseRecord.update({
    where: { id: task.caseId },
    data: {
      status: "completed",
      aiStatus: "complete",
      workflowStage: "Resolved"
    }
  });
  await emitReviewQueueChange(task.caseId, task.id, "resolved", resolutionNote ?? "Resolved");
  await writeAuditLog({
    request,
    action: "review_task.resolve",
    resource: "review_task",
    resourceId: task.id,
    status: "success"
  });
  return reply.send({ data: task });
});

app.get("/agents", async () => {
  const agents = await prisma.agentDefinition.findMany({
    orderBy: {
      createdAt: "asc"
    }
  });
  const runRows = await prisma.agentRun.findMany({
    where: {
      agentId: {
        not: null
      }
    },
    select: {
      agentId: true,
      createdAt: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });
  const runStatsMap = new Map<string, { totalRuns: number; lastRunAt: Date | null }>();
  for (const row of runRows) {
    if (!row.agentId) {
      continue;
    }

    const existing = runStatsMap.get(row.agentId);
    if (!existing) {
      runStatsMap.set(row.agentId, {
        totalRuns: 1,
        lastRunAt: row.createdAt
      });
      continue;
    }

    existing.totalRuns += 1;
    if (!existing.lastRunAt || existing.lastRunAt < row.createdAt) {
      existing.lastRunAt = row.createdAt;
    }
  }

  const data = agents.map((agent: {
    id: string;
    name: string;
    agentType: string;
    status: string;
    role: string | null;
    description: string | null;
    instructions: string | null;
    provider: string | null;
    model: string | null;
    department: string | null;
    policyRules: unknown;
    tools: unknown;
    integrations: unknown;
    flowConfig: unknown;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }) => {
    const stat = runStatsMap.get(agent.id);
    return {
      ...agent,
      metrics: {
        totalRuns: stat?.totalRuns ?? 0,
        lastRunAt: stat?.lastRunAt ?? null
      }
    };
  });
  return { data };
});

app.post("/agents", { preHandler: [requireRoles(["admin"])] }, async (request, reply) => {
  const schema = z.object({
    name: z.string().min(2),
    agentType: z.string(),
    status: z.string().default("idle"),
    role: z.string().optional(),
    description: z.string().optional(),
    instructions: z.string().optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
    department: z.string().optional(),
    policyRules: z.array(z.string()).optional(),
    tools: z.array(z.object({
      name: z.string(),
      description: z.string().optional(),
      enabled: z.boolean().optional()
    })).optional(),
    integrations: z.array(z.string()).optional(),
    flowConfig: z.any()
  });
  const input = schema.parse(request.body);

  const created = await prisma.agentDefinition.create({
    data: {
      name: input.name,
      agentType: input.agentType,
      status: input.status,
      role: input.role ?? null,
      description: input.description ?? null,
      instructions: input.instructions ?? `Agent ${input.name} executes ${input.agentType} tasks.`,
      provider: input.provider ?? null,
      model: input.model ?? null,
      department: input.department ?? null,
      policyRules: (input.policyRules ?? []) as any,
      tools: (input.tools ?? []) as any,
      integrations: (input.integrations ?? []) as any,
      flowConfig: input.flowConfig,
      metadata: {
        source: "app"
      } as any
    }
  });
  const policyRules = asStringArray(created.policyRules);

  try {
    await fetch(`${agentsServiceUrl}/agents`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name: created.name,
        kind: created.agentType === "decision_engine" ? "validation" : "orchestrator",
        instructions: created.instructions ?? `Agent ${created.name} created from app`,
        rules: policyRules.length > 0 ? policyRules : ["Follow configured flow and validation policies."]
      })
    });
  } catch {
    // Keep API creation successful even if agent service is unavailable.
  }

  await writeAuditLog({
    request,
    action: "agent.create",
    resource: "agent",
    resourceId: created.id,
    status: "success"
  });

  return reply.code(201).send({ data: created });
});

app.get("/agents/:agentId", async (request, reply) => {
  const paramsSchema = z.object({ agentId: z.string() });
  const { agentId } = paramsSchema.parse(request.params);
  const agent = await prisma.agentDefinition.findUnique({
    where: { id: agentId }
  });
  if (!agent) {
    return reply.code(404).send({ error: "Agent not found" });
  }

  const runFilter = {
    OR: [
      { agentId: agent.id },
      { agentId: null, agentName: agent.name }
    ]
  };

  const totalRuns = await prisma.agentRun.count({ where: runFilter });
  const completedRuns = await prisma.agentRun.count({ where: { ...runFilter, status: "completed" } });
  const failedRuns = await prisma.agentRun.count({ where: { ...runFilter, status: "failed" } });
  const recentRuns = await prisma.agentRun.findMany({
    where: runFilter,
    include: {
      intakeJob: {
        select: {
          flowConfig: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 50
  }) as Array<{
    id: string;
    caseId: string;
    intakeJobId: string | null;
    status: string;
    step: string;
    stepKind: string | null;
    agentName: string | null;
    durationMs: number | null;
    createdAt: Date;
    output: string;
    outputJson: unknown;
    intakeJob: { flowConfig: unknown } | null;
  }>;
  const distinctCaseRuns = await prisma.agentRun.findMany({
    where: runFilter,
    select: {
      caseId: true
    },
    distinct: ["caseId"]
  }) as Array<{ caseId: string }>;

  const durations = recentRuns
    .map((run: { durationMs: number | null }) => run.durationMs)
    .filter((value: number | null): value is number => typeof value === "number" && Number.isFinite(value));
  const avgDurationMs = durations.length > 0
    ? Math.round(durations.reduce((sum: number, value: number) => sum + value, 0) / durations.length)
    : null;
  const linkedFlows = Array.from(new Set(recentRuns.map((run: { intakeJob: { flowConfig: unknown } | null }) => {
    const parsed = flowConfigSchema.safeParse(run.intakeJob?.flowConfig);
    return parsed.success ? parsed.data.name : null;
  }).filter((name: string | null): name is string => Boolean(name))));

  const response = {
    ...agent,
    metrics: {
      totalRuns,
      completedRuns,
      failedRuns,
      successRate: totalRuns > 0 ? Number(((completedRuns / totalRuns) * 100).toFixed(1)) : 0,
      casesTouched: distinctCaseRuns.length,
      avgDurationMs,
      lastRunAt: recentRuns[0]?.createdAt ?? null
    },
    linkedFlows,
    recentRuns: recentRuns.map((run: {
      id: string;
      caseId: string;
      intakeJobId: string | null;
      status: string;
      step: string;
      stepKind: string | null;
      agentName: string | null;
      durationMs: number | null;
      createdAt: Date;
      outputJson: unknown;
      output: string;
    }) => {
      const runOutput = parseRunOutput(run.outputJson, run.output);
      return {
        id: run.id,
        caseId: run.caseId,
        intakeJobId: run.intakeJobId,
        status: run.status,
        step: run.step,
        stepKind: run.stepKind,
        agentName: run.agentName,
        durationMs: run.durationMs,
        createdAt: run.createdAt,
        outputSummary: summarizeRunOutput(runOutput),
        output: runOutput
      };
    })
  };

  return {
    data: response
  };
});

app.post("/agents/:agentId/status", { preHandler: [requireRoles(["admin"])] }, async (request, reply) => {
  const paramsSchema = z.object({ agentId: z.string() });
  const bodySchema = z.object({ status: z.string() });
  const { agentId } = paramsSchema.parse(request.params);
  const { status } = bodySchema.parse(request.body);

  const updated = await prisma.agentDefinition.update({
    where: { id: agentId },
    data: { status }
  });
  await writeAuditLog({
    request,
    action: "agent.status_update",
    resource: "agent",
    resourceId: updated.id,
    status: "success",
    metadata: { status }
  });
  return reply.send({ data: updated });
});

app.get("/workflows", async (request) => {
  const querySchema = z.object({
    domain: z.string().optional()
  });
  const { domain } = querySchema.parse(request.query ?? {});
  const workflows = await prisma.workflow.findMany({
    include: {
      steps: {
        orderBy: {
          stepOrder: "asc"
        }
      },
      executions: {
        select: {
          id: true,
          status: true,
          startedAt: true,
          finishedAt: true
        },
        orderBy: {
          startedAt: "desc"
        },
        take: 100
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });
  const workflowIds = workflows.map((workflow) => workflow.id);
  const stepIds = workflows.flatMap((workflow) => workflow.steps.map((step) => step.id));

  const executionSteps = stepIds.length > 0
    ? await prisma.workflowExecutionStep.findMany({
      where: {
        stepId: { in: stepIds }
      },
      select: {
        stepId: true,
        status: true,
        durationMs: true
      }
    })
    : [];

  const metricsByStep = new Map<string, { total: number; completed: number; failed: number; avgDurationMs: number }>();
  for (const row of executionSteps) {
    const current = metricsByStep.get(row.stepId) ?? { total: 0, completed: 0, failed: 0, avgDurationMs: 0 };
    current.total += 1;
    if (String(row.status).toLowerCase() === "completed") current.completed += 1;
    if (String(row.status).toLowerCase() === "failed") current.failed += 1;
    if (typeof row.durationMs === "number" && Number.isFinite(row.durationMs) && row.durationMs > 0) {
      const priorCount = current.total - 1;
      current.avgDurationMs = Math.round(((current.avgDurationMs * priorCount) + row.durationMs) / current.total);
    }
    metricsByStep.set(row.stepId, current);
  }

  const data = workflows.map((workflow) => {
    const stepMetrics = workflow.steps.reduce<Record<string, {
      total: number;
      completed: number;
      failed: number;
      successRate: number;
      avgDurationMs: number;
    }>>((acc, step) => {
      const metric = metricsByStep.get(step.id) ?? { total: 0, completed: 0, failed: 0, avgDurationMs: 0 };
      const successRate = metric.total > 0 ? Number(((metric.completed / metric.total) * 100).toFixed(1)) : 0;
      acc[step.id] = {
        total: metric.total,
        completed: metric.completed,
        failed: metric.failed,
        successRate,
        avgDurationMs: metric.avgDurationMs
      };
      return acc;
    }, {});

    return {
      ...workflow,
      category: deriveWorkflowCategory(workflow),
      stepMetrics
    };
  });
  return {
    data: domain
      ? data.filter((workflow) => workflow.category === domain)
      : data
  };
});

app.get("/workflows/library", async () => {
  return { data: BFSI_WORKFLOW_LIBRARY };
});

app.post("/workflows/bootstrap-bfsi", { preHandler: [requireRoles(["admin"])] }, async (_request) => {
  const created: string[] = [];
  const skipped: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const [category, templates] of Object.entries(BFSI_WORKFLOW_LIBRARY)) {
      for (const template of templates) {
        const key = `${slugifyKey(category)}_${slugifyKey(template.name)}`;
        const existing = await tx.workflow.findUnique({ where: { key } });
        if (existing) {
          skipped.push(key);
          continue;
        }

        const workflow = await tx.workflow.create({
          data: {
            key,
            name: template.name,
            description: `${category} workflow`,
            status: "active"
          }
        });

        const stepIds = template.agents.map(() => `wfstep_${randomBytes(8).toString("hex")}`);
        await tx.workflowStep.createMany({
          data: template.agents.map((agentName, index) => ({
            id: stepIds[index],
            workflowId: workflow.id,
            name: agentName,
            stepType: stepTypeFromAgentName(agentName),
            stepOrder: index + 1,
            config: {
              uiMeta: {
                category,
                agentRole: agentName
              }
            } as any,
            nextStepId: stepIds[index + 1] ?? null
          }))
        });

        created.push(key);
      }
    }
  });

  return {
    data: {
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped
    }
  };
});

app.get("/analytics/bfsi", async (request) => {
  const querySchema = z.object({
    rangeDays: z.coerce.number().int().min(7).max(90).optional()
  });
  const { rangeDays } = querySchema.parse(request.query ?? {});
  const data = buildBfsiAnalytics(rangeDays ?? 30);
  return { data };
});

app.get("/analytics/workflow-executions", { preHandler: [requireAuth] }, async (request) => {
  const querySchema = z.object({
    domain: z.string().optional(),
    rangeDays: z.coerce.number().int().min(1).max(365).optional()
  });
  const { domain, rangeDays } = querySchema.parse(request.query ?? {});
  const since = new Date(Date.now() - ((rangeDays ?? 30) * 24 * 60 * 60 * 1000));

  const workflows = await prisma.workflow.findMany({
    include: {
      executions: {
        where: { startedAt: { gte: since } },
        orderBy: { startedAt: "desc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const filtered = domain
    ? workflows.filter((workflow) => deriveWorkflowCategory(workflow) === domain)
    : workflows;

  const data = filtered.map((workflow) => {
    const runs = workflow.executions.length;
    const completed = workflow.executions.filter((run) => run.status === "completed").length;
    const failed = workflow.executions.filter((run) => run.status === "failed").length;
    const queued = workflow.executions.filter((run) => run.status === "queued").length;
    const running = workflow.executions.filter((run) => run.status === "running").length;
    const durations = workflow.executions
      .filter((run) => run.finishedAt && run.startedAt)
      .map((run) => Math.max(0, (new Date(run.finishedAt as Date).getTime() - new Date(run.startedAt).getTime()) / 1000));
    const avgDurationSec = durations.length > 0
      ? Number((durations.reduce((acc, value) => acc + value, 0) / durations.length).toFixed(1))
      : 0;

    return {
      workflowId: workflow.id,
      workflowName: workflow.name,
      category: deriveWorkflowCategory(workflow),
      status: workflow.status,
      runs,
      completed,
      failed,
      queued,
      running,
      successRatePct: runs > 0 ? Number(((completed / runs) * 100).toFixed(1)) : 0,
      avgDurationSec,
      lastRunAt: workflow.executions[0]?.startedAt?.toISOString() ?? null
    };
  });

  return { data };
});

app.get("/analytics/summary", async () => {
  const [totalCases, inProgress, needsReview, completed, escalated] = await Promise.all([
    prisma.caseRecord.count(),
    prisma.caseRecord.count({ where: { status: { in: ["new", "in_progress"] } } }),
    prisma.caseRecord.count({ where: { status: "review" } }),
    prisma.caseRecord.count({ where: { status: { in: ["completed", "closed"] } } }),
    prisma.caseRecord.count({ where: { status: "escalated" } })
  ]);

  return {
    data: {
      totalCases,
      inProgress,
      needsReview,
      completed,
      escalated
    }
  };
});

app.get("/assistant/actions", { preHandler: [requireAuth] }, async (request) => {
  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).optional()
  });
  const { limit } = querySchema.parse(request.query ?? {});

  const data = await prisma.auditLog.findMany({
    where: {
      OR: [
        { action: { startsWith: "assistant." } },
        { action: { startsWith: "workflow." } }
      ]
    },
    orderBy: { createdAt: "desc" },
    take: limit ?? 50,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  return { data };
});

app.post("/assistant/chat", { preHandler: [requireAuth] }, async (request, reply) => {
  const bodySchema = z.object({
    message: z.string().min(1),
    domain: z.string().optional()
  });
  const input = bodySchema.parse(request.body ?? {});
  const message = input.message.trim();
  const lower = message.toLowerCase();
  const selectedDomain = normalizeAssistantDomain(input.domain) ?? "Banking";
  const intentDomain = detectDomainFromMessage(message, selectedDomain);

  if (lower.includes("add step") && lower.includes("workflow")) {
    const workflowName = parseQuotedValue(message, "workflow");
    const stepName = parseQuotedValue(message, "step");
    const requestedPosition = parsePosition(message);

    if (!workflowName || !stepName) {
      return {
        data: {
          action: "none",
          reply: "Please provide both workflow and step names. Example: add step \"Fraud Validation\" to workflow \"Banking Fast Track\" at position 3."
        }
      };
    }

    const workflow = await prisma.workflow.findFirst({
      where: { name: { equals: workflowName, mode: "insensitive" } },
      include: { steps: { orderBy: { stepOrder: "asc" } } }
    });
    if (!workflow) {
      return { data: { action: "none", reply: `Workflow "${workflowName}" was not found.` } };
    }

    const maxPosition = workflow.steps.length + 1;
    const position = requestedPosition ? Math.min(Math.max(requestedPosition, 1), maxPosition) : maxPosition;

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdStep = await tx.workflowStep.create({
        data: {
          id: `wfstep_${randomBytes(8).toString("hex")}`,
          workflowId: workflow.id,
          name: stepName,
          stepType: stepTypeFromAgentName(stepName),
          stepOrder: 9999,
          config: {} as any,
          nextStepId: null
        }
      });

      const orderedIds = workflow.steps.map((step) => step.id);
      orderedIds.splice(position - 1, 0, createdStep.id);
      await applyWorkflowStepOrder(tx, workflow.id, orderedIds);

      const updated = await tx.workflow.findUnique({
        where: { id: workflow.id },
        include: { steps: { orderBy: { stepOrder: "asc" } } }
      });
      return { createdStep, updated };
    });

    return {
      data: {
        action: "none",
        reply: `Added step "${stepName}" to workflow "${workflow.name}" at position ${position}. Total steps: ${result.updated?.steps.length ?? workflow.steps.length + 1}.`
      }
    };
  }

  if ((lower.includes("remove step") || lower.includes("delete step")) && lower.includes("workflow")) {
    const workflowName = parseQuotedValue(message, "workflow");
    const stepName = parseQuotedValue(message, "step");

    if (!workflowName || !stepName) {
      return {
        data: {
          action: "none",
          reply: "Please provide both workflow and step names. Example: remove step \"Validation\" from workflow \"Banking Fast Track\"."
        }
      };
    }

    const workflow = await prisma.workflow.findFirst({
      where: { name: { equals: workflowName, mode: "insensitive" } },
      include: { steps: { orderBy: { stepOrder: "asc" } } }
    });
    if (!workflow) {
      return { data: { action: "none", reply: `Workflow "${workflowName}" was not found.` } };
    }

    const target = workflow.steps.find((step) => step.name.toLowerCase() === stepName.toLowerCase());
    if (!target) {
      return { data: { action: "none", reply: `Step "${stepName}" was not found in workflow "${workflow.name}".` } };
    }
    if (workflow.steps.length <= 1) {
      return { data: { action: "none", reply: `Cannot remove the only step from workflow "${workflow.name}".` } };
    }

    const remaining = workflow.steps.filter((step) => step.id !== target.id).map((step) => step.id);
    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.workflowStep.delete({ where: { id: target.id } });
      await applyWorkflowStepOrder(tx, workflow.id, remaining);
      return tx.workflow.findUnique({
        where: { id: workflow.id },
        include: { steps: { orderBy: { stepOrder: "asc" } } }
      });
    });

    return {
      data: {
        action: "none",
        reply: `Removed step "${target.name}" from workflow "${workflow.name}". Remaining steps: ${updated?.steps.length ?? remaining.length}.`
      }
    };
  }

  if ((lower.includes("move step") || lower.includes("reorder step")) && lower.includes("workflow")) {
    const workflowName = parseQuotedValue(message, "workflow");
    const stepName = parseQuotedValue(message, "step");
    const requestedPosition = parsePosition(message);

    if (!workflowName || !stepName || !requestedPosition) {
      return {
        data: {
          action: "none",
          reply: "Please provide workflow, step, and position. Example: move step \"Decision\" to position 3 in workflow \"Banking Fast Track\"."
        }
      };
    }

    const workflow = await prisma.workflow.findFirst({
      where: { name: { equals: workflowName, mode: "insensitive" } },
      include: { steps: { orderBy: { stepOrder: "asc" } } }
    });
    if (!workflow) {
      return { data: { action: "none", reply: `Workflow "${workflowName}" was not found.` } };
    }

    const currentIndex = workflow.steps.findIndex((step) => step.name.toLowerCase() === stepName.toLowerCase());
    if (currentIndex === -1) {
      return { data: { action: "none", reply: `Step "${stepName}" was not found in workflow "${workflow.name}".` } };
    }

    const boundedPosition = Math.min(Math.max(requestedPosition, 1), workflow.steps.length);
    const orderedIds = workflow.steps.map((step) => step.id);
    const [moving] = orderedIds.splice(currentIndex, 1);
    orderedIds.splice(boundedPosition - 1, 0, moving);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await applyWorkflowStepOrder(tx, workflow.id, orderedIds);
    });

    return {
      data: {
        action: "none",
        reply: `Moved step "${stepName}" to position ${boundedPosition} in workflow "${workflow.name}".`
      }
    };
  }

  if ((lower.includes("pause workflow") || lower.includes("deactivate workflow") || lower.includes("resume workflow") || lower.includes("activate workflow")) && lower.includes("workflow")) {
    const action = (lower.includes("pause") || lower.includes("deactivate")) ? "paused" : "active";
    const quotedName = message.match(/["']([^"']{3,80})["']/)?.[1]?.trim();
    const namedMatch = message.match(/workflow(?:\s+called|\s+named)?\s+([a-z0-9][a-z0-9\s\-_&]{2,80})/i)?.[1]?.trim();
    const workflowName = quotedName ?? namedMatch ?? null;

    if (!workflowName) {
      return {
        data: {
          action: "none",
          reply: "Please specify the workflow name. Example: pause workflow \"Banking Fast Track\"."
        }
      };
    }

    const workflow = await prisma.workflow.findFirst({
      where: {
        name: { equals: workflowName, mode: "insensitive" }
      }
    });

    if (!workflow) {
      return {
        data: {
          action: "none",
          reply: `I could not find workflow "${workflowName}".`
        }
      };
    }

    const updated = await prisma.workflow.update({
      where: { id: workflow.id },
      data: { status: action }
    });

    await writeAuditLog({
      request,
      action: "assistant.workflow_status_update",
      resource: "workflow",
      resourceId: updated.id,
      status: "success",
      metadata: { requestedStatus: action }
    });

    return {
      data: {
        action: "none",
        reply: `Workflow "${updated.name}" is now ${updated.status}.`
      }
    };
  }

  if ((lower.includes("workflow performance") || lower.includes("workflow metrics") || lower.includes("workflow status")) && !lower.includes("create")) {
    const workflows = await prisma.workflow.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        steps: true,
        executions: {
          orderBy: { startedAt: "desc" },
          take: 50
        }
      }
    });

    const filtered = workflows.filter((item) => deriveWorkflowCategory(item) === intentDomain);
    if (filtered.length === 0) {
      return {
        data: {
          action: "none",
          reply: `No workflows found in ${intentDomain}.`
        }
      };
    }

    const lines = filtered.slice(0, 8).map((workflow) => {
      const totalExec = workflow.executions.length;
      const completed = workflow.executions.filter((run) => run.status === "completed").length;
      const failed = workflow.executions.filter((run) => run.status === "failed").length;
      const successRate = totalExec > 0 ? `${Math.round((completed / totalExec) * 100)}%` : "N/A";
      return `${workflow.name}: status=${workflow.status}, steps=${workflow.steps.length}, runs=${totalExec}, success=${successRate}, failed=${failed}`;
    });

    return {
      data: {
        action: "none",
        reply: `Workflow performance for ${intentDomain}:\n${lines.join("\n")}`
      }
    };
  }

  if ((lower.includes("bootstrap") || lower.includes("initialize") || lower.includes("seed")) && lower.includes("workflow")) {
    const bootstrapAll = lower.includes("all");
    const created: string[] = [];
    const skipped: string[] = [];
    const targets: Array<[string, BfsiWorkflowTemplate[]]> = bootstrapAll
      ? Object.entries(BFSI_WORKFLOW_LIBRARY).map(([category, workflows]) => [category, workflows])
      : [[intentDomain, BFSI_WORKFLOW_LIBRARY[intentDomain] ?? []]];

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const [category, workflows] of targets) {
        for (const template of workflows) {
          const key = `${slugifyKey(category)}_${slugifyKey(template.name)}`;
          const existing = await tx.workflow.findUnique({ where: { key } });
          if (existing) {
            skipped.push(key);
            continue;
          }

          const workflow = await tx.workflow.create({
            data: {
              key,
              name: template.name,
              description: `${category} workflow`,
              status: "active"
            }
          });

          const stepIds = template.agents.map(() => `wfstep_${randomBytes(8).toString("hex")}`);
          await tx.workflowStep.createMany({
            data: template.agents.map((agentName: string, index: number) => ({
              id: stepIds[index],
              workflowId: workflow.id,
              name: agentName,
              stepType: stepTypeFromAgentName(agentName),
              stepOrder: index + 1,
              config: { uiMeta: { category, agentRole: agentName } } as any,
              nextStepId: stepIds[index + 1] ?? null
            }))
          });

          created.push(key);
        }
      }
    });

    return {
      data: {
        action: "none",
        reply: `Workflow bootstrap completed (${bootstrapAll ? "all domains" : intentDomain}). Created: ${created.length}, skipped existing: ${skipped.length}.`
      }
    };
  }

  if (/(create|build|add).*(workflow)|new workflow/.test(lower)) {
    const quotedName = message.match(/["']([^"']{3,80})["']/)?.[1]?.trim();
    const namedMatch = message.match(/workflow(?:\s+called|\s+named)?\s+([a-z0-9][a-z0-9\s\-_&]{2,80})/i)?.[1]?.trim();
    const rawName = quotedName ?? namedMatch ?? `${intentDomain} Automated Workflow`;
    const name = rawName
      .replace(/\s+in\s+(insurance\s*-\s*health|insurance\s*-\s*motor|insurance\s*-\s*property\s*&?\s*casualty|banking|cross-?industry|health|helth|motor|property)\s*$/i, "")
      .trim();
    const key = `${domainPrefix(intentDomain)}_${slugifyKey(name)}`;
    const existingByKey = await prisma.workflow.findUnique({
      where: { key },
      include: { steps: { orderBy: { stepOrder: "asc" } } }
    });

    if (existingByKey) {
      return {
        data: {
          action: "workflow_exists",
          workflow: {
            id: existingByKey.id,
            key: existingByKey.key,
            name: existingByKey.name,
            description: existingByKey.description,
            category: deriveWorkflowCategory(existingByKey),
            stepsCount: existingByKey.steps.length
          },
          reply: `Workflow "${existingByKey.name}" already exists in ${deriveWorkflowCategory(existingByKey)} with ${existingByKey.steps.length} steps.`
        }
      };
    }

    const sameNameCandidates = await prisma.workflow.findMany({
      where: { name: { equals: name, mode: "insensitive" } },
      include: { steps: { orderBy: { stepOrder: "asc" } } }
    });
    const sameNameInDomain = sameNameCandidates.find((workflow) => deriveWorkflowCategory(workflow) === intentDomain);
    if (sameNameInDomain) {
      return {
        data: {
          action: "workflow_exists",
          workflow: {
            id: sameNameInDomain.id,
            key: sameNameInDomain.key,
            name: sameNameInDomain.name,
            description: sameNameInDomain.description,
            category: deriveWorkflowCategory(sameNameInDomain),
            stepsCount: sameNameInDomain.steps.length
          },
          reply: `Workflow "${sameNameInDomain.name}" already exists in ${deriveWorkflowCategory(sameNameInDomain)} with ${sameNameInDomain.steps.length} steps.`
        }
      };
    }

    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const workflow = await tx.workflow.create({
        data: {
          key,
          name,
          description: `Auto-created by Clarity AI Assistant for ${intentDomain}`,
          status: "active"
        }
      });

      const template = buildAssistantWorkflowTemplate();
      const idByKey = new Map(template.map((step) => [step.key, `wfstep_${randomBytes(8).toString("hex")}`]));
      for (const step of template) {
        await tx.workflowStep.create({
          data: {
            id: idByKey.get(step.key),
            workflowId: workflow.id,
            name: step.name,
            stepType: step.stepType,
            stepOrder: step.stepOrder,
            config: {} as any,
            nextStepId: idByKey.get(template[step.stepOrder]?.key) ?? null
          }
        });
      }

      return tx.workflow.findUnique({
        where: { id: workflow.id },
        include: { steps: { orderBy: { stepOrder: "asc" } } }
      });
    });

    await writeAuditLog({
      request,
      action: "assistant.create_workflow",
      resource: "workflow",
      resourceId: created?.id ?? null,
      status: "success",
      metadata: { domain: intentDomain, key }
    });

    return reply.code(201).send({
      data: {
        action: "workflow_created",
        workflow: created
          ? {
            id: created.id,
            key: created.key,
            name: created.name,
            description: created.description,
            category: deriveWorkflowCategory(created),
            stepsCount: created.steps.length
          }
          : null,
        reply: created
          ? `Created workflow "${created.name}" in ${deriveWorkflowCategory(created)} with ${created.steps.length} steps.`
          : "Workflow creation attempted, but no workflow data was returned."
      }
    });
  }

  if (lower.includes("workflow")) {
    const workflows = await prisma.workflow.findMany({
      orderBy: { createdAt: "desc" },
      include: { steps: true }
    });
    const filtered = workflows.filter((item) => deriveWorkflowCategory(item) === intentDomain);
    const top = filtered.slice(0, 8);
    const names = top.map((item) => `${item.name} (${item.steps.length} steps)`).join(", ");
    return {
      data: {
        action: "none",
        reply: filtered.length > 0
          ? `In ${intentDomain}, we currently have ${filtered.length} workflows. Recent ones: ${names}. Ask me "create workflow called <name>" to add a new one.`
          : `No workflows found in ${intentDomain} yet. Ask me to create one and I will provision it with intake, classification, validation, decision, and customer notification steps.`
      }
    };
  }

  if (lower.includes("agent")) {
    try {
      const response = await fetch(`${agentsServiceUrl}/agents`);
      const parsed = response.ok ? await response.json() : { data: [] };
      const names = Array.isArray(parsed.data) ? parsed.data.map((item: any) => item?.name).filter(Boolean) : [];
      const sample = names.slice(0, 10).join(", ");
      return {
        data: {
          action: "none",
          reply: names.length > 0
            ? `Agents are step-specialized workers. Flow is: intake -> classify -> extract -> validate -> decide -> notify. Active registered agents include: ${sample}.`
            : "Agent service is reachable but no agent definitions were returned."
        }
      };
    } catch {
      return {
        data: {
          action: "none",
          reply: "Agents run step-by-step inside each workflow: intake, classification, extraction, validation, decision, and customer notification. I could not fetch live agent registry right now."
        }
      };
    }
  }

  if (lower.includes("email") || lower.includes("inbox")) {
    const inboxes = await prisma.inboxEmail.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" }
    });
    const byDomain = inboxes.reduce<Record<string, number>>((acc, inbox) => {
      const domain = inbox.domain ?? "Unmapped";
      acc[domain] = (acc[domain] ?? 0) + 1;
      return acc;
    }, {});
    const domainSummary = Object.entries(byDomain).map(([domain, count]) => `${domain}: ${count}`).join(", ");
    return {
      data: {
        action: "none",
        reply: inboxes.length > 0
          ? `Email automation is active with ${inboxes.length} inboxes. Domain split: ${domainSummary}. Incoming mail is classified, routed to domain/workflow, and customers receive acknowledgement + decision updates.`
          : "No active inboxes found yet. Configure at least one inbox in Admin, map it to a domain/workflow, then run poll to activate automated intake."
      }
    };
  }

  const [workflowCount, activeCases, inboxCount] = await Promise.all([
    prisma.workflow.count(),
    prisma.caseRecord.count({ where: { status: { in: ["new", "in_progress", "review"] } } }),
    prisma.inboxEmail.count({ where: { isActive: true } })
  ]);

  return {
    data: {
      action: "none",
      reply: `Current platform snapshot: ${workflowCount} workflows, ${activeCases} active cases, ${inboxCount} active inbox configurations. You can ask me domain-specific workflow questions or say "create workflow called <name>".`
    }
  };
});

app.patch("/workflows/:workflowId", { preHandler: [requireRoles(["admin"])] }, async (request, reply) => {
  const paramsSchema = z.object({
    workflowId: z.string()
  });
  const bodySchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    status: z.string().optional()
  });
  const { workflowId } = paramsSchema.parse(request.params);
  const input = bodySchema.parse(request.body ?? {});

  const updated = await prisma.workflow.update({
    where: {
      id: workflowId
    },
    data: {
      name: input.name,
      description: input.description,
      status: input.status
    },
    include: {
      steps: {
        orderBy: {
          stepOrder: "asc"
        }
      },
      executions: {
        select: {
          id: true,
          status: true,
          startedAt: true,
          finishedAt: true
        },
        orderBy: {
          startedAt: "desc"
        },
        take: 100
      }
    }
  });

  await writeAuditLog({
    request,
    action: "workflow.update",
    resource: "workflow",
    resourceId: updated.id,
    status: "success"
  });

  return { data: updated };
});

app.post("/workflows/:workflowId/status", { preHandler: [requireRoles(["admin"])] }, async (request, reply) => {
  const paramsSchema = z.object({
    workflowId: z.string()
  });
  const bodySchema = z.object({
    status: z.string().min(1)
  });
  const { workflowId } = paramsSchema.parse(request.params);
  const { status } = bodySchema.parse(request.body);
  const normalizedTargetStatus = status.trim().toLowerCase();

  if (["active", "running", "published", "deployed"].includes(normalizedTargetStatus)) {
    const current = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" }
        }
      }
    });

    if (!current) {
      return reply.code(404).send({ error: "Workflow not found" });
    }

    const validation = validateWorkflowGraph(
      current.steps.map((step) => ({
        id: step.id,
        name: step.name,
        stepType: step.stepType,
        stepOrder: step.stepOrder,
        nextStepId: step.nextStepId,
        config: step.config
      }))
    );

    if (!validation.valid) {
      return reply.code(422).send({
        error: "WORKFLOW_VALIDATION_FAILED",
        message: "Workflow cannot be activated because graph validation failed.",
        data: {
          valid: false,
          errors: validation.errors,
          warnings: validation.warnings
        }
      });
    }
  }

  const updated = await prisma.workflow.update({
    where: {
      id: workflowId
    },
    data: {
      status
    }
  });

  await writeAuditLog({
    request,
    action: "workflow.status_update",
    resource: "workflow",
    resourceId: workflowId,
    status: "success",
    metadata: {
      status
    }
  });

  return { data: updated };
});

app.delete("/workflows/:workflowId", { preHandler: [requireRoles(["admin"])] }, async (request, reply) => {
  const paramsSchema = z.object({
    workflowId: z.string()
  });
  const { workflowId } = paramsSchema.parse(request.params);

  await prisma.workflow.delete({
    where: {
      id: workflowId
    }
  });

  await writeAuditLog({
    request,
    action: "workflow.delete",
    resource: "workflow",
    resourceId: workflowId,
    status: "success"
  });

  return reply.code(204).send();
});

app.get("/workflows/:workflowId", async (request, reply) => {
  const paramsSchema = z.object({
    workflowId: z.string()
  });
  const { workflowId } = paramsSchema.parse(request.params);
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      steps: {
        orderBy: {
          stepOrder: "asc"
        }
      },
      executions: {
        orderBy: {
          startedAt: "desc"
        },
        take: 50,
        include: {
          steps: {
            orderBy: {
              startedAt: "asc"
            }
          }
        }
      }
    }
  });
  if (!workflow) {
    return reply.code(404).send({ error: "Workflow not found" });
  }
  return { data: workflow };
});

app.get("/workflows/:workflowId/validate", { preHandler: [requireAuth] }, async (request, reply) => {
  const paramsSchema = z.object({
    workflowId: z.string()
  });
  const { workflowId } = paramsSchema.parse(request.params);
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      steps: {
        orderBy: {
          stepOrder: "asc"
        }
      }
    }
  });
  if (!workflow) {
    return reply.code(404).send({ error: "Workflow not found" });
  }

  const result = validateWorkflowGraph(
    workflow.steps.map((step) => ({
      id: step.id,
      name: step.name,
      stepType: step.stepType,
      stepOrder: step.stepOrder,
      nextStepId: step.nextStepId,
      config: step.config
    }))
  );

  return {
    data: {
      workflowId: workflow.id,
      workflowName: workflow.name,
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings
    }
  };
});

app.get("/workflows/:workflowId/email-playbook", { preHandler: [requireAuth] }, async (request, reply) => {
  const paramsSchema = z.object({
    workflowId: z.string()
  });
  const { workflowId } = paramsSchema.parse(request.params);

  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      steps: {
        orderBy: { stepOrder: "asc" }
      }
    }
  });

  if (!workflow) {
    return reply.code(404).send({ error: "Workflow not found" });
  }

  const notifyStep = workflow.steps.find((step) => step.stepType === "NOTIFY_CUSTOMER");
  if (!notifyStep) {
    return reply.code(404).send({ error: "Workflow does not contain NOTIFY_CUSTOMER step" });
  }

  const config = asRecord(notifyStep.config);
  const currentPlaybook = asRecord(config.playbook);
  const playbook = {
    ...defaultWorkflowPlaybook(workflow.name),
    ...currentPlaybook
  };

  return {
    data: {
      workflowId: workflow.id,
      workflowName: workflow.name,
      notifyStepId: notifyStep.id,
      playbook
    }
  };
});

app.patch("/workflows/:workflowId/email-playbook", { preHandler: [requireRoles(["admin"])] }, async (request, reply) => {
  const paramsSchema = z.object({
    workflowId: z.string()
  });
  const bodySchema = z.object({
    playbook: z.object({
      acknowledgementSubject: z.string().min(1),
      acknowledgementBody: z.string().min(1),
      approvalSubject: z.string().min(1),
      approvalBody: z.string().min(1),
      rejectionSubject: z.string().min(1),
      rejectionBody: z.string().min(1),
      reviewSubject: z.string().min(1),
      reviewBody: z.string().min(1)
    })
  });
  const { workflowId } = paramsSchema.parse(request.params);
  const { playbook } = bodySchema.parse(request.body ?? {});

  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      steps: {
        orderBy: { stepOrder: "asc" }
      }
    }
  });
  if (!workflow) {
    return reply.code(404).send({ error: "Workflow not found" });
  }
  const notifyStep = workflow.steps.find((step) => step.stepType === "NOTIFY_CUSTOMER");
  if (!notifyStep) {
    return reply.code(404).send({ error: "Workflow does not contain NOTIFY_CUSTOMER step" });
  }

  const existingConfig = asRecord(notifyStep.config);
  const updatedConfig = {
    ...existingConfig,
    playbook
  };

  await prisma.workflowStep.update({
    where: { id: notifyStep.id },
    data: {
      config: updatedConfig as any
    }
  });

  await writeAuditLog({
    request,
    action: "workflow.playbook_update",
    resource: "workflow_step",
    resourceId: notifyStep.id,
    status: "success",
    metadata: { workflowId }
  });

  return {
    data: {
      workflowId: workflow.id,
      workflowName: workflow.name,
      notifyStepId: notifyStep.id,
      playbook
    }
  };
});

app.post("/workflows", { preHandler: [requireRoles(["admin"])] }, async (request, reply) => {
  const workflowCreateSchema = z.object({
    key: z.string().optional(),
    name: z.string().min(3),
    description: z.string().optional(),
    status: z.string().default("active"),
    steps: z.array(z.object({
      key: z.string().min(1),
      name: z.string().min(1),
      stepType: z.enum(WORKFLOW_STEP_TYPES),
      stepOrder: z.number().int().positive(),
      config: z.record(z.string(), z.unknown()).optional(),
      nextStepKey: z.string().optional().nullable()
    })).min(1)
  });
  const input = workflowCreateSchema.parse(request.body);

  const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const workflow = await tx.workflow.create({
      data: {
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        status: input.status
      }
    });

    const keyToId = new Map<string, string>(
      input.steps.map((step) => [step.key, `wfstep_${randomBytes(8).toString("hex")}`])
    );
    for (const step of input.steps) {
      const rawConfig = asRecord(step.config ?? {});
      const mappedRoutes = Object.entries(asRecord(rawConfig.routes)).reduce<Record<string, string>>((acc, [label, target]) => {
        if (typeof target !== "string") {
          return acc;
        }
        acc[label] = keyToId.get(target) ?? target;
        return acc;
      }, {});
      const normalizedConfig = Object.keys(mappedRoutes).length > 0
        ? { ...rawConfig, routes: mappedRoutes }
        : rawConfig;

      await tx.workflowStep.create({
        data: {
          id: keyToId.get(step.key),
          workflowId: workflow.id,
          name: step.name,
          stepType: step.stepType,
          stepOrder: step.stepOrder,
          config: normalizedConfig as any,
          nextStepId: step.nextStepKey ? (keyToId.get(step.nextStepKey) ?? null) : null
        }
      });
    }

    return tx.workflow.findUnique({
      where: { id: workflow.id },
      include: {
        steps: {
          orderBy: {
            stepOrder: "asc"
          }
        }
      }
    });
  });

  await writeAuditLog({
    request,
    action: "workflow.create",
    resource: "workflow",
    resourceId: created?.id ?? null,
    status: "success"
  });
  return reply.code(201).send({ data: created });
});

app.post("/workflows/:workflowId/execute", { preHandler: [requireRoles(["operator", "admin"])] }, async (request, reply) => {
  const paramsSchema = z.object({
    workflowId: z.string()
  });
  const bodySchema = z.object({
    memberName: z.string().min(1),
    caseType: z.string().min(1),
    priority: z.enum(["critical", "high", "medium", "low"]),
    emailSubject: z.string().optional(),
    emailBody: z.string().optional(),
    documents: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        pages: z.number().optional(),
        text: z.string().optional()
      })
    ).default([])
  });
  const { workflowId } = paramsSchema.parse(request.params);
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId }
  });
  if (!workflow) {
    return reply.code(404).send({ error: "Workflow not found" });
  }

  const input = bodySchema.parse(request.body);
  const started = await startWorkflowExecutionForIntake({
    workflowId,
    caseType: input.caseType,
    priority: input.priority,
    memberName: input.memberName,
    emailSubject: input.emailSubject,
    emailBody: input.emailBody,
    documents: input.documents,
    source: "workflow.execute"
  });

  await writeAuditLog({
    request,
    action: "workflow.execute",
    resource: "workflow",
    resourceId: workflowId,
    status: "success",
    metadata: {
      caseId: started.caseRecord.id,
      executionId: started.executionId,
      queued: started.queued
    }
  });

  return reply.code(202).send({
    data: {
      workflowId,
      caseId: started.caseRecord.id,
      executionId: started.executionId,
      queued: started.queued
    }
  });
});

app.post("/workflow-intake/email", { preHandler: [requireRoles(["operator", "admin"])] }, async (request, reply) => {
  const bodySchema = z.object({
    workflowKey: z.string().optional(),
    memberName: z.string().min(1),
    caseType: z.string().min(1),
    priority: z.enum(["critical", "high", "medium", "low"]),
    emailSubject: z.string().optional(),
    emailBody: z.string().optional(),
    documents: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        pages: z.number().optional(),
        text: z.string().optional()
      })
    ).default([])
  });
  const input = bodySchema.parse(request.body);
  const workflow = input.workflowKey
    ? await prisma.workflow.findFirst({
      where: {
        key: input.workflowKey
      }
    })
    : await prisma.workflow.findFirst({
      where: {
        status: "active"
      },
      orderBy: {
        createdAt: "asc"
      }
    });

  if (!workflow) {
    return reply.code(404).send({ error: "No workflow available for email intake" });
  }

  const started = await startWorkflowExecutionForIntake({
    workflowId: workflow.id,
    caseType: input.caseType,
    priority: input.priority,
    memberName: input.memberName,
    emailSubject: input.emailSubject,
    emailBody: input.emailBody,
    documents: input.documents,
    source: "email.intake"
  });

  await writeAuditLog({
    request,
    action: "workflow.email_intake",
    resource: "workflow",
    resourceId: workflow.id,
    status: "success",
    metadata: {
      caseId: started.caseRecord.id,
      executionId: started.executionId,
      queued: started.queued
    }
  });

  return reply.code(202).send({
    data: {
      workflowId: workflow.id,
      workflowKey: workflow.key,
      caseId: started.caseRecord.id,
      executionId: started.executionId,
      queued: started.queued
    }
  });
});

app.get("/workflow-executions/:executionId", async (request, reply) => {
  const paramsSchema = z.object({
    executionId: z.string()
  });
  const { executionId } = paramsSchema.parse(request.params);
  const execution = await prisma.workflowExecution.findUnique({
    where: { id: executionId },
    include: {
      workflow: true,
      steps: {
        orderBy: {
          startedAt: "asc"
        }
      }
    }
  });
  if (!execution) {
    return reply.code(404).send({ error: "Workflow execution not found" });
  }

  return { data: execution };
});

app.post("/intake/submissions", { preHandler: [requireRoles(["operator", "admin"])] }, async (request, reply) => {
  const schema = z.object({
    memberName: z.string().min(1),
    caseType: z.string().min(1),
    priority: z.enum(["critical", "high", "medium", "low"]),
    documents: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        pages: z.number().optional()
      })
    ).default([]),
    flowConfig: flowConfigSchema.optional()
  });
  const input = schema.parse(request.body);
  const flowConfig = input.flowConfig ?? defaultFlowConfig;

  const caseId = buildCaseCode();
  const createdCase = await prisma.caseRecord.create({
    data: {
      id: caseId,
      caseType: input.caseType,
      workflowStage: "Queued for Intake",
      assignedUserName: null,
      aiStatus: "processing",
      priority: input.priority,
      memberName: input.memberName,
      status: "new",
      documentsTotal: input.documents.length,
      documentsComplete: 0
    }
  });

  if (input.documents.length > 0) {
    await prisma.document.createMany({
      data: input.documents.map((document) => ({
        caseId,
        name: document.name,
        type: document.type,
        status: "pending",
        pages: document.pages ?? null
      }))
    });
  }

  await prisma.agentDefinition.create({
    data: {
      name: flowConfig.name,
      agentType: "orchestrator",
      status: "running",
      flowConfig
    }
  });

  const intakeJob = await prisma.intakeJob.create({
    data: {
      caseId,
      status: "queued",
      currentStep: "queued",
      flowConfig
    }
  });

  await emitIntakeStatus(intakeJob.id, caseId, "queued", "Intake submission accepted");
  const queued = await enqueueIntakeJob(intakeJob.id);
  if (!queued) {
    app.log.warn("Intake queue unavailable, processing inline");
    void processIntakeJob(intakeJob.id);
  } else {
    const fallbackDelayMs = Number(process.env.INTAKE_INLINE_FALLBACK_DELAY_MS ?? "2000");
    const delay = Number.isFinite(fallbackDelayMs) && fallbackDelayMs > 0 ? fallbackDelayMs : 2000;
    setTimeout(async () => {
      try {
        const latest = await prisma.intakeJob.findUnique({
          where: { id: intakeJob.id },
          select: { status: true }
        });
        if (latest?.status === "queued") {
          app.log.warn(`Intake job ${intakeJob.id} still queued; running inline fallback`);
          await processIntakeJob(intakeJob.id);
        }
      } catch {
        // Best-effort fallback only.
      }
    }, delay);
  }
  await writeAuditLog({
    request,
    action: "intake.submit",
    resource: "case",
    resourceId: createdCase.id,
    status: "success",
    metadata: { queued }
  });

  return reply.code(201).send({
    data: {
      case: createdCase,
      intakeJob,
      queued
    }
  });
});

app.post("/internal/intake/process", async (request, reply) => {
  const schema = z.object({
    jobId: z.string(),
    token: z.string()
  });
  const input = schema.parse(request.body);

  if (input.token !== internalWorkerToken) {
    await writeAuditLog({
      request,
      action: "worker.unauthorized",
      resource: "intake_job",
      resourceId: input.jobId,
      status: "failure"
    });
    return reply.code(401).send({ error: "Unauthorized worker call" });
  }

  await processIntakeJob(input.jobId);
  await writeAuditLog({
    request,
    action: "worker.process_intake",
    resource: "intake_job",
    resourceId: input.jobId,
    status: "success"
  });
  return {
    data: {
      jobId: input.jobId,
      processed: true
    }
  };
});

app.post("/internal/workflows/process", async (request, reply) => {
  const schema = z.object({
    executionId: z.string(),
    token: z.string()
  });
  const input = schema.parse(request.body);

  if (input.token !== internalWorkerToken) {
    await writeAuditLog({
      request,
      action: "worker.workflow_unauthorized",
      resource: "workflow_execution",
      resourceId: input.executionId,
      status: "failure"
    });
    return reply.code(401).send({ error: "Unauthorized worker call" });
  }

  await workflowEngine.processExecution(input.executionId);
  await writeAuditLog({
    request,
    action: "worker.process_workflow",
    resource: "workflow_execution",
    resourceId: input.executionId,
    status: "success"
  });

  return {
    data: {
      executionId: input.executionId,
      processed: true
    }
  };
});

app.post("/internal/cases/:caseId/reconcile", async (request, reply) => {
  const schema = z.object({
    caseId: z.string(),
    token: z.string()
  });
  const { caseId, token } = schema.parse({
    ...(request.params as Record<string, unknown>),
    ...(request.body as Record<string, unknown>)
  });

  if (token !== internalWorkerToken) {
    return reply.code(401).send({ error: "Unauthorized worker call" });
  }

  const record = await prisma.caseRecord.findUnique({
    where: { id: caseId },
    include: {
      documents: true,
      workflowExecutions: {
        orderBy: { startedAt: "desc" },
        take: 1,
        include: {
          steps: {
            orderBy: { startedAt: "asc" }
          }
        }
      },
      agentRuns: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  if (!record) {
    return reply.code(404).send({ error: "Case not found" });
  }

  if (["completed", "review"].includes(record.status)) {
    await prisma.document.updateMany({
      where: { caseId, status: "pending" },
      data: { status: "uploaded" }
    });
  }

  const [documentsTotal, documentsComplete] = await Promise.all([
    prisma.document.count({ where: { caseId } }),
    prisma.document.count({ where: { caseId, status: "uploaded" } })
  ]);

  await prisma.caseRecord.update({
    where: { id: caseId },
    data: {
      documentsTotal,
      documentsComplete
    }
  });

  if (!record.agentRuns.length && record.workflowExecutions[0]) {
    const execution = record.workflowExecutions[0];
    const rows = execution.steps.map((step) => ({
      caseId,
      step: step.stepName,
      stepKind: step.stepType,
      status: step.status,
      output: step.errorMessage ?? step.decision ?? "Workflow step processed",
      outputJson: (step.output ?? {}) as any,
      createdAt: step.startedAt ?? new Date(),
      updatedAt: step.finishedAt ?? step.startedAt ?? new Date()
    }));

    if (rows.length > 0) {
      await prisma.agentRun.createMany({ data: rows });
    }
  }

  return {
    data: {
      caseId,
      reconciled: true
    }
  };
});

app.post("/internal/policies/lookup", async (request, reply) => {
  const schema = z.object({
    token: z.string(),
    policyNumber: z.string().optional().nullable(),
    memberEmail: z.string().optional().nullable(),
    memberName: z.string().optional().nullable(),
    caseType: z.string().optional().nullable()
  });
  const input = schema.parse(request.body ?? {});

  if (input.token !== internalWorkerToken) {
    return reply.code(401).send({ error: "Unauthorized worker call" });
  }

  const normalizedPolicyNumber = (input.policyNumber ?? "").trim().toUpperCase();
  const normalizedMemberEmail = normalizeEmail(input.memberEmail);
  const normalizedMemberName = (input.memberName ?? "").trim();
  const normalizedPolicyType = inferPolicyTypeFromNumber(normalizedPolicyNumber || input.caseType || "");

  let row: Record<string, any> | null = null;
  if (normalizedPolicyNumber) {
    const rows = await prisma.$queryRaw<Array<Record<string, any>>>`
      SELECT * FROM "PolicyRegistry"
      WHERE UPPER("policyNumber") = ${normalizedPolicyNumber}
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `;
    row = rows[0] ?? null;
  }

  if (!row && normalizedMemberEmail) {
    const rows = await prisma.$queryRaw<Array<Record<string, any>>>`
      SELECT * FROM "PolicyRegistry"
      WHERE LOWER(COALESCE("memberEmail", '')) = ${normalizedMemberEmail}
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `;
    row = rows[0] ?? null;
  }

  if (!row && normalizedMemberName) {
    const rows = await prisma.$queryRaw<Array<Record<string, any>>>`
      SELECT * FROM "PolicyRegistry"
      WHERE "memberName" ILIKE ${`%${normalizedMemberName}%`}
        AND LOWER("policyType") = ${normalizedPolicyType.toLowerCase()}
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `;
    row = rows[0] ?? null;
  }

  if (!row) {
    return {
      data: {
        policyFound: false,
        policyNumber: normalizedPolicyNumber || null,
        policyType: normalizedPolicyType,
        coverageTypes: defaultCoverageByPolicyType(normalizedPolicyType),
        sumInsured: 0,
        currency: "INR",
        policyHolder: normalizedMemberName || null,
        status: "not_found",
        expiryDate: null,
        lookupMethod: "db"
      }
    };
  }

  const coverageTypes = Array.isArray(row.coverageTypes) ? row.coverageTypes : [];
  const sumInsured = typeof row.sumInsured === "number" ? row.sumInsured : Number(row.sumInsured ?? 0);
  return {
    data: {
      policyFound: true,
      policyNumber: row.policyNumber,
      policyType: row.policyType,
      coverageTypes,
      sumInsured: Number.isFinite(sumInsured) ? sumInsured : 0,
      currency: row.currency ?? "INR",
      policyHolder: row.memberName ?? normalizedMemberName ?? "",
      status: row.status ?? "active",
      expiryDate: row.expiryDate ? new Date(row.expiryDate).toISOString().slice(0, 10) : null,
      memberId: row.memberId ?? null,
      payerName: row.payerName ?? null,
      lookupMethod: "db"
    }
  };
});

app.get("/datalab/policy-docs", async (_request, reply) => {
  const vault = await listPolicyDocsFromVault();
  const docs = vault.docs;
  const byType = docs.reduce<Record<string, number>>((acc, doc) => {
    const key = doc.policyType;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return reply.send({
    data: {
      root: vault.root,
      count: docs.length,
      byType,
      docs
    }
  });
});

app.get("/datalab/quality-summary", async (_request, reply) => {
  const [totalDocs, verifiedDocs, pendingDocs, totalCases, pendingCases] = await Promise.all([
    prisma.document.count(),
    prisma.document.count({ where: { status: { in: ["verified", "VERIFIED", "complete", "COMPLETED"] } } }),
    prisma.document.count({ where: { status: { in: ["pending", "PENDING"] } } }),
    prisma.caseRecord.count(),
    prisma.caseRecord.count({ where: { workflowStage: { in: ["Queued for Workflow", "Human Review"] } } })
  ]);
  const processedDocs = Math.max(0, totalDocs - pendingDocs);
  const completionRate = totalDocs > 0 ? Number(((processedDocs / totalDocs) * 100).toFixed(1)) : 0;

  return reply.send({
    data: {
      totalDocs,
      verifiedDocs,
      pendingDocs,
      processedDocs,
      completionRate,
      totalCases,
      pendingCases
    }
  });
});

app.get("/datalab/workflow-routing-insights", async (request, reply) => {
  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(25)
  });
  const { limit } = querySchema.parse(request.query ?? {});
  const runs = await prisma.agentRun.findMany({
    where: { stepKind: "WORKFLOW_ROUTING" },
    include: {
      case: {
        select: {
          id: true,
          caseType: true,
          memberName: true,
          customerEmail: true,
          workflowStage: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: limit
  });

  const rows = runs.map((run) => {
    const payload = (run.outputJson ?? {}) as Record<string, any>;
    const alternatives = Array.isArray(payload.alternatives) ? payload.alternatives : [];
    return {
      runId: run.id,
      at: run.createdAt.toISOString(),
      caseId: run.caseId,
      caseType: run.case?.caseType ?? null,
      customerEmail: run.case?.customerEmail ?? null,
      selectedWorkflowName: typeof payload.selectedWorkflowName === "string" ? payload.selectedWorkflowName : null,
      selectedWorkflowKey: typeof payload.selectedWorkflowKey === "string" ? payload.selectedWorkflowKey : null,
      source: typeof payload.source === "string" ? payload.source : null,
      confidence: typeof payload.confidence === "number" ? payload.confidence : null,
      reasons: Array.isArray(payload.reasons) ? payload.reasons : [],
      alternatives: alternatives.slice(0, 3)
    };
  });

  return reply.send({ data: rows });
});

app.get("/provisioning/policy", async (request, reply) => {
  if (!requestHasInternalWorkerToken(request)) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  return {
    data: {
      allowedDomains: allowedAccountDomains,
      roles: [...RBAC_ROLES]
    }
  };
});

app.post("/provisioning/users", async (request, reply) => {
  const input = provisionUserSchema.parse(request.body);
  if (input.token !== internalWorkerToken) {
    await writeAuditLog({
      request,
      action: "provision.user",
      resource: "user",
      status: "failure"
    });
    return reply.code(401).send({ error: "Unauthorized provisioning call" });
  }

  const email = normalizeEmail(input.email);
  if (!isAllowedAccountEmail(email)) {
    return reply.code(403).send({ error: "Email domain is not allowed for account provisioning" });
  }

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: input.name,
      role: input.role,
      passwordHash: hashPassword(input.password)
    },
    update: {
      name: input.name,
      role: input.role,
      passwordHash: hashPassword(input.password)
    }
  });

  await writeAuditLog({
    request,
    action: "provision.user",
    resource: "user",
    resourceId: user.id,
    status: "success",
    metadata: { role: user.role }
  });

  return reply.code(201).send({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
});

app.get("/agent-flows/default", async () => {
  return {
    data: defaultFlowConfig
  };
});

app.get("/intake/jobs/:jobId", async (request, reply) => {
  const schema = z.object({ jobId: z.string() });
  const { jobId } = schema.parse(request.params);
  const job = await prisma.intakeJob.findUnique({
    where: {
      id: jobId
    }
  });

  if (!job) {
    return reply.code(404).send({ error: "Job not found" });
  }

  return { data: job };
});

// ── Inbox Email Settings (multiple receiving mailboxes) ───────────────────────
app.get("/inbox-settings", { preHandler: [requireRoles(["admin"])] }, async (_request, reply) => {
  const inboxes = await prisma.inboxEmail.findMany({ orderBy: { createdAt: "asc" } });
  return reply.send({ data: inboxes.map((i) => ({ ...i, password: "********" })) });
});

app.get("/internal/inbox-settings", async (request, reply) => {
  if (!requestHasInternalWorkerToken(request)) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const inboxes = await prisma.inboxEmail.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" }
  });
  return reply.send({ data: inboxes });
});

app.post("/inbox-settings", { preHandler: [requireRoles(["admin"])] }, async (request, reply) => {
  const schema = z.object({
    label: z.string().min(1),
    email: z.string().email(),
    host: z.string().min(1),
    port: z.number().int().default(993),
    username: z.string().min(1),
    password: z.string().min(1),
    mailbox: z.string().default("INBOX"),
    pollInterval: z.number().int().default(60),
    isActive: z.boolean().default(true),
    domain: z.string().min(1),
    workflowKey: z.string().optional().nullable(),
    claimTypeKey: z.string().optional().nullable(),
    autoReplyEnabled: z.boolean().default(true)
  });
  const input = schema.parse(request.body);
  const inbox = await prisma.inboxEmail.create({
    data: {
      ...input,
      email: normalizeEmail(input.email),
      domain: input.domain,
      workflowKey: input.workflowKey ?? null,
      claimTypeKey: input.claimTypeKey ?? null
    }
  });
  return reply.code(201).send({ data: { ...inbox, password: "********" } });
});

app.patch("/inbox-settings/:id", { preHandler: [requireRoles(["admin"])] }, async (request, reply) => {
  const { id } = z.object({ id: z.string() }).parse(request.params);
  const schema = z.object({
    label: z.string().min(1).optional(),
    email: z.string().email().optional(),
    host: z.string().min(1).optional(),
    port: z.number().int().optional(),
    username: z.string().min(1).optional(),
    password: z.string().min(1).optional(),
    mailbox: z.string().optional(),
    pollInterval: z.number().int().optional(),
    isActive: z.boolean().optional(),
    domain: z.string().min(1).optional(),
    workflowKey: z.string().optional().nullable(),
    claimTypeKey: z.string().optional().nullable(),
    autoReplyEnabled: z.boolean().optional()
  });
  const input = schema.parse(request.body);
  const inbox = await prisma.inboxEmail.update({
    where: { id },
    data: {
      ...input,
      email: input.email ? normalizeEmail(input.email) : undefined,
      domain: input.domain === undefined ? undefined : input.domain,
      workflowKey: input.workflowKey === undefined ? undefined : (input.workflowKey ?? null),
      claimTypeKey: input.claimTypeKey === undefined ? undefined : (input.claimTypeKey ?? null)
    }
  });
  return reply.send({ data: { ...inbox, password: "********" } });
});

app.delete("/inbox-settings/:id", { preHandler: [requireRoles(["admin"])] }, async (request, reply) => {
  const { id } = z.object({ id: z.string() }).parse(request.params);
  await prisma.inboxEmail.delete({ where: { id } });
  return reply.send({ data: { deleted: true } });
});

app.post("/email/poll", { preHandler: [requireRoles(["operator", "admin"])] }, async (_request, reply) => {
  const response = await fetch(`${agentsServiceUrl}/email/poll`, {
    method: "POST",
    headers: { "content-type": "application/json" }
  });
  if (!response.ok) {
    return reply.code(502).send({ error: "Failed to trigger email poller" });
  }
  const data = await response.json();
  return { data };
});

// ── Email inbound webhook (called by Python IMAP poller) ─────────────────────
app.post("/portal/requests", async (request, reply) => {
  const schema = z.object({
    customerName: z.string().min(1),
    customerEmail: z.string().email(),
    subject: z.string().min(1),
    body: z.string().min(1),
    requestType: z.string().min(1),
    channel: z.enum(["CHAT", "EMAIL"]).default("CHAT"),
    policyId: z.string().optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    attachments: z.array(z.object({
      name: z.string().min(1),
      mimeType: z.string().optional(),
      contentBase64: z.string().optional()
    })).optional()
  });
  const input = schema.parse(request.body ?? {});

  const activeInbox = await prisma.inboxEmail.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" }
  });
  const toAddress =
    activeInbox?.email ||
    activeInbox?.username ||
    process.env.IMAP_USER ||
    process.env.SMTP_FROM ||
    "support@aurastack.local";

  const messageId = `portal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const inboundPayload = {
    token: internalWorkerToken,
    messageId,
    fromAddress: input.customerEmail,
    toAddress,
    subject: input.subject,
    body: input.body,
    attachments: (input.attachments ?? []).map((a) => ({
      name: a.name,
      mimeType: a.mimeType || "application/octet-stream",
      contentBase64: a.contentBase64 || ""
    }))
  };

  const inboundResponse = await fetch(`http://127.0.0.1:${port}/email/inbound`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(inboundPayload)
  });
  if (!inboundResponse.ok) {
    const detail = await inboundResponse.text();
    return reply.code(502).send({ error: "PORTAL_REQUEST_FAILED", detail });
  }

  const inboundJson: any = await inboundResponse.json();
  const threadId = inboundJson?.data?.threadId as string | undefined;
  const caseId = inboundJson?.data?.caseId as string | null | undefined;

  if (threadId) {
    await prisma.emailThread.update({
      where: { id: threadId },
      data: {
        rawHeaders: {
          source: "customer_portal",
          channel: input.channel,
          requestType: input.requestType,
          customerName: input.customerName,
          policyId: input.policyId ?? null,
          metadata: input.metadata ?? {}
        } as any
      }
    });
  }

  return reply.code(201).send({
    data: {
      threadId: threadId ?? null,
      caseId: caseId ?? null,
      messageId,
      toAddress
    }
  });
});

app.post("/email/inbound", async (request, reply) => {
  const schema = z.object({
    token: z.string(),
    messageId: z.string(),
    fromAddress: z.string(),
    toAddress: z.string().optional(),
    subject: z.string().optional(),
    body: z.string().optional(),
    attachments: z.array(z.any()).optional()
  });

  const input = schema.parse(request.body);
  if (input.token !== internalWorkerToken) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  const toAddress = normalizeEmail(input.toAddress);
  const inboxConfig = toAddress
    ? await prisma.inboxEmail.findFirst({
      where: {
        isActive: true,
        OR: [
          { email: toAddress },
          { username: toAddress }
        ]
      }
    })
    : null;

  // Idempotency – skip if already seen
  const existing = await prisma.emailThread.findUnique({ where: { messageId: input.messageId } });
  if (existing) {
    return { data: { duplicate: true, id: existing.id } };
  }

  const thread = await prisma.emailThread.create({
    data: {
      messageId: input.messageId,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress ?? "",
      subject: input.subject ?? "(no subject)",
      body: input.body ?? "",
      attachments: (input.attachments ?? []) as any,
      direction: "inbound",
      status: "received"
    }
  });

  if (inboxConfig?.domain && !textBelongsToDomain(input.subject ?? "", input.body ?? "", inboxConfig.domain)) {
    await prisma.emailThread.update({
      where: { id: thread.id },
      data: {
        status: "ignored_domain",
        processedAt: new Date()
      }
    });
    return { data: { threadId: thread.id, caseId: null, filtered: true, reason: "domain_keyword_mismatch" } };
  }

  // Run claim classifier via agent service
  try {
    const classifyResult = await fetch(`${agentsServiceUrl}/workflow/execute-step`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        executionId: `inbound-${thread.id}`,
        caseId: "inbound-email",
        workflowId: inboxConfig?.workflowKey ?? "inbound-classifier",
        stepId: "claim_classification",
        stepName: "Email Classifier",
        stepType: "CLAIM_CLASSIFICATION",
        payload: { emailSubject: input.subject, emailBody: input.body, fromAddress: input.fromAddress },
        context: {},
        config: {}
      })
    });
    const classifyJson: any = classifyResult.ok ? await classifyResult.json() : null;
    const output = classifyJson?.data?.output ?? {};

    // Pre-processor: split large PDFs into logical groups and build cascade hints.
    const attachmentDocs = (input.attachments ?? []).map((att: any) => ({
      name: String(att.name ?? "attachment"),
      mimeType: String(att.mimeType ?? "application/octet-stream"),
      contentBase64: String(att.contentBase64 ?? "")
    }));
    let preProcessorOutput: Record<string, any> = {};
    try {
      const preProcessResult = await fetch(`${agentsServiceUrl}/workflow/execute-step`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          executionId: `preprocess-${thread.id}`,
          caseId: "inbound-email",
          workflowId: inboxConfig?.workflowKey ?? "inbound-preprocess",
          stepId: "pre_processor",
          stepName: "Pre Processor",
          stepType: "PRE_PROCESSOR",
          payload: {
            emailSubject: input.subject,
            emailBody: input.body,
            fromAddress: input.fromAddress,
            documents: attachmentDocs
          },
          context: {},
          config: {}
        })
      });
      const preProcessJson: any = preProcessResult.ok ? await preProcessResult.json() : null;
      preProcessorOutput = (preProcessJson?.data?.output ?? {}) as Record<string, any>;
    } catch {
      preProcessorOutput = {};
    }

    const claimType: string = typeof output.claimType === "string" ? output.claimType : "other";
    const priority: "critical" | "high" | "medium" | "low" =
      output.priority === "critical" ? "critical"
        : output.priority === "high" ? "high"
          : output.priority === "medium" ? "medium"
            : "low";
    const memberName = typeof output.memberName === "string" && output.memberName
      ? output.memberName
      : input.fromAddress.split("@")[0];

    const preClaimType = typeof preProcessorOutput?.triage?.claimType === "string"
      ? String(preProcessorOutput.triage.claimType).trim().toLowerCase()
      : "";
    const effectiveClaimType = inboxConfig?.claimTypeKey?.trim() || preClaimType || claimType;

    if (inboxConfig?.domain && !caseTypeBelongsToDomain(effectiveClaimType, inboxConfig.domain)) {
      await prisma.emailThread.update({
        where: { id: thread.id },
        data: {
          status: "ignored_domain",
          processedAt: new Date()
        }
      });

      return { data: { threadId: thread.id, caseId: null, filtered: true, reason: "domain_mismatch" } };
    }

    const claimTypeConfig = await prisma.claimType.findFirst({
      where: {
        OR: [
          { key: effectiveClaimType },
          { key: claimType }
        ],
        isActive: true
      },
      orderBy: { createdAt: "asc" }
    });

    const activeWorkflows = await prisma.workflow.findMany({
      where: { status: "active" },
      orderBy: { createdAt: "asc" }
    });

    const routingAlternatives = computeRoutingAlternatives({
      workflows: activeWorkflows,
      inboxDomain: inboxConfig?.domain ?? null,
      inboxWorkflowKey: inboxConfig?.workflowKey ?? null,
      claimType: effectiveClaimType,
      claimTypeWorkflowKey: claimTypeConfig?.workflowKey ?? null,
      subject: input.subject ?? "",
      body: input.body ?? ""
    });

    let workflow: { id: string; key: string | null; name: string } | null = resolveInboundWorkflow({
      activeWorkflows,
      inboxWorkflowKey: inboxConfig?.workflowKey,
      inboxDomain: inboxConfig?.domain
    });

    if (!workflow && claimTypeConfig?.workflowKey) {
      workflow = findActiveWorkflowByKey(activeWorkflows, claimTypeConfig.workflowKey);
    }

    const recommendedWorkflowKeys = Array.isArray(preProcessorOutput?.recommendedWorkflowKeys)
      ? preProcessorOutput.recommendedWorkflowKeys
          .map((item: unknown) => String(item || "").trim())
          .filter((item: string) => item.length > 0)
      : [];
    const resolvedCascadeWorkflows = recommendedWorkflowKeys
      .map((workflowKey: string) => findActiveWorkflowByKey(activeWorkflows, workflowKey))
      .filter((item): item is { id: string; key: string | null; name: string } => Boolean(item));
    const hasLargePdf = Boolean(preProcessorOutput?.containsLargePdf);

    if (hasLargePdf && !inboxConfig?.workflowKey) {
      const hospitalIntake = findActiveWorkflowByKey(activeWorkflows, "hospital_intake_v1");
      if (hospitalIntake) {
        workflow = hospitalIntake;
      }
    }
    if (!workflow && resolvedCascadeWorkflows.length > 0) {
      workflow = resolvedCascadeWorkflows[0];
    }

    if (workflow) {
      const selectedAlternative = routingAlternatives.find((item) => item.workflowId === workflow?.id) ?? routingAlternatives[0];
      const topAlternative = routingAlternatives[0];
      const scoreGap = Math.max(
        0,
        (topAlternative?.score ?? selectedAlternative?.score ?? 0.5) - (routingAlternatives[1]?.score ?? 0)
      );
      const confidence = Math.max(
        0.5,
        Math.min(
          0.99,
          Number((((selectedAlternative?.score ?? 0.6) + Math.min(0.2, scoreGap * 0.5))).toFixed(2))
        )
      );
      const source: WorkflowRoutingDecision["source"] =
        inboxConfig?.workflowKey && (workflow.key === inboxConfig.workflowKey || workflow.id === inboxConfig.workflowKey)
          ? "inbox_config"
          : claimTypeConfig?.workflowKey && (workflow.key === claimTypeConfig.workflowKey || workflow.id === claimTypeConfig.workflowKey)
            ? "claim_type_mapping"
            : inboxConfig?.domain && deriveWorkflowCategory(workflow) === inboxConfig.domain
              ? "domain_fallback"
              : "active_default";

      const routingDecision: WorkflowRoutingDecision = {
        selectedWorkflowId: workflow.id,
        selectedWorkflowKey: workflow.key,
        selectedWorkflowName: workflow.name,
        source,
        confidence,
        reasons: selectedAlternative?.reasons ?? [],
        alternatives: routingAlternatives.slice(0, 3),
        context: {
          inboxDomain: inboxConfig?.domain ?? null,
          inboxWorkflowKey: inboxConfig?.workflowKey ?? null,
          claimType: effectiveClaimType,
          claimTypeWorkflowKey: claimTypeConfig?.workflowKey ?? null,
          sender: input.fromAddress,
          cascadeWorkflowKeys: resolvedCascadeWorkflows.map((item) => item.key ?? item.id),
          cascadeWorkflowNames: resolvedCascadeWorkflows.map((item) => item.name),
          preProcessorSummary: typeof preProcessorOutput?.summary === "string" ? preProcessorOutput.summary : null
        }
      };

      const preProcessorDocPageMap = (() => {
        const groups = asRecord(preProcessorOutput?.documentGroups);
        const pageMap = new Map<string, number>();
        for (const entries of Object.values(groups)) {
          if (!Array.isArray(entries)) continue;
          for (const entry of entries) {
            const rec = asRecord(entry);
            const rawName = String(rec.name ?? "").trim().toLowerCase();
            if (!rawName) continue;
            const pagesValue = Number(rec.pages);
            const pageValue = Number(rec.page);
            const current = pageMap.get(rawName) ?? 0;
            if (Number.isFinite(pagesValue) && pagesValue > 0) {
              pageMap.set(rawName, Math.max(current, Math.trunc(pagesValue)));
              continue;
            }
            if (Number.isFinite(pageValue) && pageValue > 0) {
              pageMap.set(rawName, current + 1);
            }
          }
        }
        return pageMap;
      })();

      const caseRecord = await createCaseWithDocuments({
        caseType: effectiveClaimType,
        priority,
        memberName,
        documents: attachmentDocs.map((d) => {
          const mime = String(d.mimeType || "");
          const lowerName = String(d.name || "").trim().toLowerCase();
          const preProcessedPages = preProcessorDocPageMap.get(lowerName);
          const pages = (typeof preProcessedPages === "number" && Number.isFinite(preProcessedPages))
            ? Math.max(1, Math.trunc(preProcessedPages))
            : (mime.toLowerCase().includes("pdf") ? undefined : 1);
          return {
            name: d.name,
            type: d.mimeType,
            pages
          };
        })
      });

      await prisma.caseRecord.update({
        where: { id: caseRecord.id },
        data: {
          customerEmail: input.fromAddress,
          claimClassification: typeof output.inquiryType === "string" ? output.inquiryType : null,
          policyNumber: typeof output.policyNumber === "string" ? output.policyNumber : null
        }
      });

      await prisma.agentRun.create({
        data: {
          caseId: caseRecord.id,
          step: "Workflow Routing",
          stepKind: "WORKFLOW_ROUTING",
          status: "completed",
          agentName: "Workflow Router",
          output: `Routed to ${workflow.name} (${Math.round(confidence * 100)}% confidence)` ,
          outputJson: routingDecision as any,
          inputJson: {
            subject: input.subject ?? "",
            claimType: effectiveClaimType,
            inboxDomain: inboxConfig?.domain ?? null,
            inboxWorkflowKey: inboxConfig?.workflowKey ?? null
          } as any,
          durationMs: 0
        }
      });

      if (Object.keys(preProcessorOutput).length > 0) {
        await prisma.agentRun.create({
          data: {
            caseId: caseRecord.id,
            step: "Pre Processor",
            stepKind: "PRE_PROCESSOR",
            status: "completed",
            agentName: "Pre Processor Agent",
            output: `Pre-processed ${Number(preProcessorOutput.totalDocuments ?? attachmentDocs.length)} document(s)` ,
            outputJson: preProcessorOutput as any,
            inputJson: {
              subject: input.subject ?? "",
              attachments: attachmentDocs.map((doc) => ({ name: doc.name, mimeType: doc.mimeType }))
            } as any,
            durationMs: 0
          }
        });
      }

      if (resolvedCascadeWorkflows.length > 1) {
        await prisma.agentRun.create({
          data: {
            caseId: caseRecord.id,
            step: "Cascading Orchestration",
            stepKind: "WORKFLOW_CASCADE",
            status: "completed",
            agentName: "Cascade Orchestrator",
            output: `Cascade planned: ${resolvedCascadeWorkflows.map((item) => item.name).join(" -> ")}`,
            outputJson: {
              primaryWorkflowId: workflow.id,
              primaryWorkflowName: workflow.name,
              cascadeWorkflowKeys: resolvedCascadeWorkflows.map((item) => item.key ?? item.id),
              cascadeWorkflowNames: resolvedCascadeWorkflows.map((item) => item.name)
            } as any,
            inputJson: {
              recommendedWorkflowKeys
            } as any,
            durationMs: 0
          }
        });
      }

      await prisma.emailThread.update({
        where: { id: thread.id },
        data: { caseId: caseRecord.id, status: "processed", processedAt: new Date() }
      });

      const start = await workflowEngine.startExecution({
        workflowId: workflow.id,
        caseId: caseRecord.id,
        source: "email.inbound",
        input: {
          memberName,
          caseType: effectiveClaimType,
          priority,
          emailSubject: input.subject ?? "",
          emailBody: input.body ?? "",
          fromAddress: input.fromAddress,
          sender: input.fromAddress,
          customerEmail: input.fromAddress,
          documents: attachmentDocs,
          preProcessor: preProcessorOutput,
          routingDecision
        }
      });

      if (!start.queued) {
        void workflowEngine.processExecution(start.executionId);
      }

      // Cascade: hand off to additional workflows (if suggested and active).
      const secondaryCascades = resolvedCascadeWorkflows.filter((item) => item.id !== workflow!.id);
      for (const cascadeWorkflow of secondaryCascades) {
        try {
          const cascadeStart = await workflowEngine.startExecution({
            workflowId: cascadeWorkflow.id,
            caseId: caseRecord.id,
            source: "cascade.handoff",
            input: {
              memberName,
              caseType: effectiveClaimType,
              priority,
              emailSubject: input.subject ?? "",
              emailBody: input.body ?? "",
              fromAddress: input.fromAddress,
              sender: input.fromAddress,
              customerEmail: input.fromAddress,
              documents: attachmentDocs,
              preProcessor: preProcessorOutput,
              parentExecutionId: start.executionId,
              cascadeFromWorkflowId: workflow.id,
              cascadeFromWorkflowName: workflow.name
            }
          });
          if (!cascadeStart.queued) {
            void workflowEngine.processExecution(cascadeStart.executionId);
          }
        } catch (cascadeErr) {
          app.log.warn({ cascadeErr, workflowId: cascadeWorkflow.id }, "Failed to start cascade workflow");
        }
      }

      if (inboxConfig?.autoReplyEnabled !== false) {
        void (async () => {
          const autoReplySubject = `We have received your ${effectiveClaimType} request`;
          const autoReplyBody = `Hi ${memberName},\n\nYour request has been received and is being processed. Case ID: ${caseRecord.id}.\n\nYou will receive another update once a decision is made.\n\nRegards,\nAuraStack Claims`;
          const fromAddress = String(process.env.SMTP_FROM || process.env.IMAP_USER || "noreply@aurastack.local");
          let sent = false;
          try {
            const sentResponse = await fetch(`${agentsServiceUrl}/email/send`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                to: input.fromAddress,
                subject: autoReplySubject,
                body: autoReplyBody
              })
            });
            sent = sentResponse.ok;
          } catch {
            sent = false;
          }

          await prisma.emailThread.create({
            data: {
              caseId: caseRecord.id,
              fromAddress,
              toAddress: input.fromAddress,
              subject: autoReplySubject,
              body: autoReplyBody,
              direction: "outbound",
              status: sent ? "sent" : "failed",
              processedAt: new Date()
            }
          });
        })();
      }

      return { data: { threadId: thread.id, caseId: caseRecord.id, executionId: start.executionId } };
    }
  } catch (err) {
    app.log.warn({ err }, "Email inbound: classifier/workflow failed");
  }

  return { data: { threadId: thread.id, caseId: null } };
});

// ── Email threads ─────────────────────────────────────────────────────────────
app.post("/email/send", { preHandler: [requireAuth] }, async (request, reply) => {
  const schema = z.object({
    to: z.string().email(),
    subject: z.string().min(1),
    body: z.string().min(1),
    caseId: z.string().optional().nullable()
  });
  const input = schema.parse(request.body ?? {});

  const caseRecord = input.caseId
    ? await prisma.caseRecord.findUnique({ where: { id: input.caseId } })
    : null;
  const fromAddress = String(process.env.SMTP_FROM || process.env.IMAP_USER || "noreply@aurastack.local");

  let sendOk = false;
  let sendError: string | null = null;
  try {
    const sent = await fetch(`${agentsServiceUrl}/email/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: input.to,
        subject: input.subject,
        body: input.body
      })
    });
    sendOk = sent.ok;
    if (!sent.ok) {
      sendError = await sent.text();
    }
  } catch (err) {
    sendOk = false;
    sendError = err instanceof Error ? err.message : "Failed to call agents email service";
  }

  const thread = await prisma.emailThread.create({
    data: {
      caseId: caseRecord?.id ?? null,
      fromAddress,
      toAddress: input.to,
      subject: input.subject,
      body: input.body,
      direction: "outbound",
      status: sendOk ? "sent" : "failed",
      processedAt: new Date()
    },
    include: { case: { select: { id: true, memberName: true, status: true, caseType: true } } }
  });

  if (!sendOk) {
    return reply.code(502).send({
      error: "EMAIL_SEND_FAILED",
      message: sendError || "Outbound email service failed",
      data: thread
    });
  }
  return reply.code(201).send({ data: thread });
});

app.get("/email/threads", { preHandler: [requireAuth] }, async (request) => {
  const querySchema = z.object({
    direction: z.enum(["inbound", "outbound"]).optional(),
    caseId: z.string().optional(),
    limit: z.coerce.number().min(1).max(500).optional()
  });
  const { direction, caseId, limit } = querySchema.parse(request.query ?? {});

  const data = await prisma.emailThread.findMany({
    where: {
      ...(direction ? { direction } : {}),
      ...(caseId ? { caseId } : {})
    },
    orderBy: { createdAt: "desc" },
    take: limit ?? 100,
    include: { case: { select: { id: true, memberName: true, status: true, caseType: true } } }
  });

  return { data };
});

// ── Claim types CRUD ──────────────────────────────────────────────────────────
app.get("/claim-types", { preHandler: [requireAuth] }, async () => {
  const data = await prisma.claimType.findMany({ orderBy: { name: "asc" } });
  return { data };
});

app.post("/claim-types", { preHandler: [requireRoles(["admin"])] }, async (request, reply) => {
  const schema = z.object({
    key: z.string().min(1).regex(/^[a-z_]+$/, "key must be lowercase with underscores"),
    name: z.string().min(1),
    description: z.string().optional(),
    workflowKey: z.string().optional(),
    requiredDocuments: z.array(z.string()).optional(),
    slaHours: z.number().int().positive().optional(),
    autoApproveThreshold: z.number().min(0).max(1).optional(),
    minConfidence: z.number().min(0).max(1).optional(),
    validationRules: z.record(z.string(), z.unknown()).optional(),
    isActive: z.boolean().optional()
  });
  const input = schema.parse(request.body);

  const created = await prisma.claimType.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      workflowKey: input.workflowKey ?? null,
      requiredDocuments: (input.requiredDocuments ?? []) as any,
      slaHours: input.slaHours ?? 48,
      autoApproveThreshold: input.autoApproveThreshold ?? 0.92,
      minConfidence: input.minConfidence ?? 0.80,
      validationRules: (input.validationRules ?? {}) as any,
      isActive: input.isActive ?? true
    }
  });

  await writeAuditLog({
    request,
    action: "claim_type.create",
    resource: "claim_type",
    resourceId: created.id,
    status: "success"
  });

  return reply.code(201).send({ data: created });
});

app.patch("/claim-types/:id", { preHandler: [requireRoles(["admin"])] }, async (request, reply) => {
  const paramsSchema = z.object({ id: z.string() });
  const bodySchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    workflowKey: z.string().optional(),
    requiredDocuments: z.array(z.string()).optional(),
    slaHours: z.number().int().positive().optional(),
    autoApproveThreshold: z.number().min(0).max(1).optional(),
    minConfidence: z.number().min(0).max(1).optional(),
    validationRules: z.record(z.string(), z.unknown()).optional(),
    isActive: z.boolean().optional()
  });
  const { id } = paramsSchema.parse(request.params);
  const input = bodySchema.parse(request.body ?? {});

  const existing = await prisma.claimType.findUnique({ where: { id } });
  if (!existing) {
    return reply.code(404).send({ error: "ClaimType not found" });
  }

  const updated = await prisma.claimType.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      workflowKey: input.workflowKey,
      requiredDocuments: input.requiredDocuments as any,
      slaHours: input.slaHours,
      autoApproveThreshold: input.autoApproveThreshold,
      minConfidence: input.minConfidence,
      validationRules: input.validationRules as any,
      isActive: input.isActive
    }
  });

  await writeAuditLog({
    request,
    action: "claim_type.update",
    resource: "claim_type",
    resourceId: id,
    status: "success"
  });

  return { data: updated };
});

// ── Case execution (for demo / workspace view) ───────────────────────────────
app.get("/cases/:caseId/execution", { preHandler: [requireAuth] }, async (request, reply) => {
  const schema = z.object({ caseId: z.string() });
  const { caseId } = schema.parse(request.params);
  const execution = await prisma.workflowExecution.findFirst({
    where: { caseId },
    orderBy: { startedAt: "desc" },
    include: {
      steps: { orderBy: { startedAt: "asc" } },
      workflow: { select: { name: true } }
    }
  });
  if (!execution) {
    return reply.code(404).send({ error: "No execution found" });
  }
  return { data: execution };
});

// ── Demo injection ─────────────────────────────────────────────────────────────
app.post("/demo/inject", { preHandler: [requireAuth] }, async (request, reply) => {
  const schema = z.object({
    scenario: z.enum(["health_approved", "auto_review", "property_approved", "missing_rejected"])
  });
  const { scenario } = schema.parse(request.body);

  const SCENARIOS: Record<string, {
    memberName: string; fromAddress: string; subject: string; body: string;
    caseType: string; priority: "critical" | "high" | "medium" | "low";
    documents: Array<{ name: string; mimeType: string; text: string }>;
  }> = {
    health_approved: {
      memberName: "Rajesh Kumar",
      fromAddress: "rajesh.kumar@apollo-patient.com",
      subject: "Health Insurance Claim – Apollo Hospitals Discharge",
      body: "Dear Insurance Team,\n\nI am submitting my health insurance claim for hospitalization at Apollo Hospitals from March 10-15, 2026. Attached are the discharge summary, hospital bill, and ID card.\n\nPolicy Number: HLT-2024-89234\nClaim Reference: CLM-2026-45678\n\nRegards,\nRajesh Kumar",
      caseType: "health",
      priority: "high",
      documents: [
        {
          name: "discharge_summary.pdf",
          mimeType: "application/pdf",
          text: "APOLLO HOSPITALS - DISCHARGE SUMMARY\n\nPatient Name: Rajesh Kumar\nPatient ID: APH-2024-78234\nDate of Admission: March 10, 2026\nDate of Discharge: March 15, 2026\n\nPolicy Number: HLT-2024-89234\nClaim Number: CLM-2026-45678\nTPA: Health Insurance TPA Ltd.\nMember ID: MEM-456789\n\nDIAGNOSIS:\n- Primary: Acute Appendicitis (K35.89)\n- Secondary: Post-operative wound infection (T81.4)\n\nTREATMENT SUMMARY:\nEmergency appendectomy performed on March 10, 2026. Laparoscopic surgery under general anaesthesia. Post-operative recovery uneventful. Patient discharged March 15, 2026 in stable condition.\n\nFINANCIAL SUMMARY:\nRoom Charges (5 days @ Rs. 4,500): Rs. 22,500\nOperating Theatre Charges: Rs. 45,000\nSurgeon Fee: Rs. 25,000\nAnaesthesiologist Fee: Rs. 8,000\nMedicines & Consumables: Rs. 12,340\nInvestigation (Lab Tests): Rs. 7,160\nTotal Amount: Rs. 120,000\nInsurance Covered: Rs. 120,000\nPatient Payable: Rs. 0\n\nTreating Physician: Dr. Suresh Menon\nHospital Registration: MH/2015/456"
        },
        {
          name: "hospital_bill.pdf",
          mimeType: "application/pdf",
          text: "APOLLO HOSPITALS - TAX INVOICE\n\nBill No: APH-BILL-2026-78234\nDate: March 15, 2026\nPatient: Rajesh Kumar\nPolicy Number: HLT-2024-89234\nInsurance Company: Aura Health Insurance\n\nITEMISED CHARGES:\n1. Room Charges (5 nights): Rs. 22,500\n2. Operation Theatre: Rs. 45,000\n3. Surgeon Fees: Rs. 25,000\n4. Anaesthesia: Rs. 8,000\n5. Medicines & Drugs: Rs. 9,840\n6. Consumables: Rs. 2,500\n7. Lab Investigation: Rs. 4,160\n8. Post-operative Care: Rs. 3,000\n\nGRAND TOTAL: Rs. 120,000\nAmount Claimed from Insurance: Rs. 120,000\nPatient Payable: Rs. 0"
        },
        {
          name: "member_id_card.pdf",
          mimeType: "application/pdf",
          text: "AURA HEALTH INSURANCE - MEMBER ID CARD\n\nMember Name: RAJESH KUMAR\nMember ID: MEM-456789\nPolicy Number: HLT-2024-89234\nPlan: Gold Health Plus\nSum Insured: Rs. 5,00,000\nValid From: April 1, 2024\nValid Until: March 31, 2027\nDate of Birth: June 15, 1985\nTPA: Health Insurance TPA Ltd.\nEmergency: 1800-XXX-1234"
        }
      ]
    },
    auto_review: {
      memberName: "Priya Sharma",
      fromAddress: "priya.sharma@gmail.com",
      subject: "Auto Insurance Claim – Rear-end Accident on NH-48",
      body: "Hello,\n\nI was involved in a road accident on March 18, 2026 on NH-48 near Gurugram. My Hyundai Creta (DL-5C-AB-1234) was rear-ended. FIR copy and damage report attached.\n\nPolicy: AUT-2024-56789\n\nPriya Sharma",
      caseType: "auto",
      priority: "medium",
      documents: [
        {
          name: "police_fir.pdf",
          mimeType: "application/pdf",
          text: "HARYANA POLICE - FIRST INFORMATION REPORT\n\nFIR No: GGN-2026-451\nDate: March 18, 2026\nComplainant: Priya Sharma\n\nVehicle: Hyundai Creta, Registration DL-5C-AB-1234\nPolicy Number: AUT-2024-56789\n\nIncident: The complainant was driving in the left lane when a truck (HR-26-T-5678) rear-ended her vehicle at high speed near Hero Honda Chowk, Gurugram at 09:30 AM. The truck driver fled the scene. Vehicle has significant rear-end damage. Complainant suffered minor injuries.\n\nAction Taken: FIR registered, spot inspection done\nInvestigating Officer: SI Ramesh Kumar, Badge: HR-5678"
        },
        {
          name: "vehicle_damage_report.pdf",
          mimeType: "application/pdf",
          text: "AUTHORIZED SERVICE CENTER - DAMAGE ASSESSMENT\n\nReport No: ASC-2026-1234\nDate: March 19, 2026\nShop: Galaxy Motors (Hyundai Authorized), Gurugram\n\nVehicle: Hyundai Creta SX(O) Diesel 2023\nRegistration: DL-5C-AB-1234\nOwner: Priya Sharma\nPolicy: AUT-2024-56789\n\nDAMAGE ITEMS:\n1. Rear Bumper Assembly: Rs. 18,500\n2. Boot Lid repair and paint: Rs. 12,000\n3. Tail Lamp (Right): Rs. 6,500\n4. Rear Parking Sensor: Rs. 4,500\n5. Body Realignment: Rs. 8,000\n6. Paint Work: Rs. 7,500\n\nTotal Estimate: Rs. 59,000\nDepreciation (15%): Rs. 8,850\nNet Claim Amount: Rs. 50,150"
        }
      ]
    },
    property_approved: {
      memberName: "Arun Mehta",
      fromAddress: "arun.mehta@outlook.com",
      subject: "Property Insurance Claim – Fire Damage at Residence",
      body: "Dear Claims Department,\n\nFire incident at my residence Flat 1204, Shree Heights, Mumbai on March 15, 2026. Significant damage to kitchen and living area. Documents attached for claim under Policy PRP-2023-12456.\n\nArun Mehta",
      caseType: "property",
      priority: "critical",
      documents: [
        {
          name: "fire_brigade_report.pdf",
          mimeType: "application/pdf",
          text: "MUMBAI FIRE BRIGADE - INCIDENT REPORT\n\nReport No: MFB-2026-3421\nDate: March 15, 2026\nLocation: Flat 1204, Shree Heights, Andheri East, Mumbai\nOwner: Arun Mehta\n\nFire Origin: Kitchen – electrical short circuit in modular kitchen\nSpread: Kitchen, dining area, partial living room (approx. 400 sq ft)\nCasualties: None\n\nDamage: Kitchen completely burned; electrical wiring – complete damage; furniture – major damage; ceiling and walls – smoke damage\n\nFire Officer: Station Officer P.K. Desai, MFB-5678"
        },
        {
          name: "surveyor_damage_assessment.pdf",
          mimeType: "application/pdf",
          text: "IRDAI LICENSED SURVEYOR - DAMAGE ASSESSMENT\n\nSurveyor: Rajiv & Associates (IRDAI-SUR-MH-4567)\nSurvey Date: March 17, 2026\n\nProperty: Flat 1204, Shree Heights, Andheri East, Mumbai\nOwner: Arun Mehta\nPolicy Number: PRP-2023-12456\nInsurer: Aura Property Shield\nSum Insured: Rs. 25,00,000\n\nDAMAGE BREAKDOWN:\n1. Kitchen reconstruction: Rs. 1,85,000\n2. Electrical rewiring: Rs. 45,000\n3. Wall and ceiling repair: Rs. 1,20,000\n4. Furniture and contents: Rs. 1,95,000\n5. Electronics: Rs. 75,000\n6. Miscellaneous: Rs. 70,000\n\nGross Loss: Rs. 6,90,000\nDepreciation (10%): Rs. 69,000\nNet Claim Recommended: Rs. 6,21,000\n\nSurveyor Recommendation: APPROVED"
        },
        {
          name: "policy_document.pdf",
          mimeType: "application/pdf",
          text: "AURA PROPERTY SHIELD - POLICY SCHEDULE\n\nPolicy Number: PRP-2023-12456\nPolicyholder: ARUN MEHTA\nAddress: Flat 1204, Shree Heights, Andheri East, Mumbai\n\nBuilding Cover: Rs. 15,00,000\nContents Cover: Rs. 10,00,000\nTotal Sum Insured: Rs. 25,00,000\n\nCovered Perils: Fire and Allied Perils, Flood, Theft, Earthquake\n\nPremium Paid: Rs. 12,450/year\nPolicy Period: April 1, 2023 to March 31, 2027\nStatus: ACTIVE AND IN FORCE"
        }
      ]
    },
    missing_rejected: {
      memberName: "Vikram Singh",
      fromAddress: "vikram.singh@email.com",
      subject: "Claim for Medical Treatment",
      body: "Hi,\n\nI had a medical treatment recently and want to claim insurance. Please process my claim.\n\nVikram Singh",
      caseType: "health",
      priority: "low",
      documents: []
    }
  };

  const s = SCENARIOS[scenario];
  const messageId = `demo-${scenario}-${Date.now()}@aurastack.demo`;

  const thread = await prisma.emailThread.create({
    data: {
      messageId,
      fromAddress: s.fromAddress,
      toAddress: "demo@aurastack.ai",
      subject: s.subject,
      body: s.body,
      attachments: s.documents.map(d => ({ name: d.name, mimeType: d.mimeType })) as any,
      direction: "inbound",
      status: "received"
    }
  });

  const workflow = await prisma.workflow.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "asc" }
  });

  if (!workflow) {
    return reply.code(400).send({ error: "No active workflow found. Please create and activate a workflow first." });
  }

  const caseRecord = await createCaseWithDocuments({
    caseType: s.caseType,
    priority: s.priority,
    memberName: s.memberName,
    documents: s.documents.map(d => ({ name: d.name, type: d.mimeType }))
  });

  await prisma.caseRecord.update({
    where: { id: caseRecord.id },
    data: { customerEmail: s.fromAddress, claimClassification: "new_claim" }
  });

  await prisma.emailThread.update({
    where: { id: thread.id },
    data: { caseId: caseRecord.id, status: "processed", processedAt: new Date() }
  });

  const start = await workflowEngine.startExecution({
    workflowId: workflow.id,
    caseId: caseRecord.id,
    source: "demo.inject",
    input: {
      memberName: s.memberName,
      caseType: s.caseType,
      priority: s.priority,
      emailSubject: s.subject,
      emailBody: s.body,
      customerEmail: s.fromAddress,
      documents: s.documents
    }
  });

  if (!start.queued) {
    void workflowEngine.processExecution(start.executionId);
  }

  return { data: { threadId: thread.id, caseId: caseRecord.id, executionId: start.executionId } };
});

// ── SLA ───────────────────────────────────────────────────────────────────────
app.get("/sla/breached", { preHandler: [requireAuth] }, async (request) => {
  const querySchema = z.object({
    limit: z.coerce.number().min(1).max(500).optional()
  });
  const { limit } = querySchema.parse(request.query ?? {});

  const data = await prisma.caseRecord.findMany({
    where: { slaBreached: true },
    orderBy: { createdAt: "desc" },
    take: limit ?? 100,
    include: {
      reviewTasks: { where: { status: "open" }, take: 1 }
    }
  });

  return { data };
});

// SLA breach checker – runs every 5 minutes
if (process.env.NODE_ENV !== "test") {
  setInterval(async () => {
    try {
      const now = new Date();
      const breached = await prisma.caseRecord.findMany({
        where: {
          slaDeadline: { lt: now },
          slaBreached: false,
          status: { notIn: ["completed", "closed"] }
        },
        select: { id: true }
      });

      if (breached.length > 0) {
        const ids = breached.map((c: { id: string }) => c.id);
        await prisma.caseRecord.updateMany({
          where: { id: { in: ids } },
          data: { slaBreached: true }
        });

        for (const c of breached) {
          try {
            await prisma.reviewTask.create({
              data: { caseId: c.id, reason: "SLA deadline breached – escalation required", status: "open" }
            });
          } catch {
            // may already have open task
          }
        }
      }
    } catch {
      // don't crash the server on SLA check errors
    }
  }, 5 * 60 * 1000);
}

const shutdown = async (): Promise<void> => {
  await app.close();
  try {
    await closeQueue();
    await closeWorkflowQueue();
  } catch {
    // ignore queue close errors in shutdown paths
  }
  await prisma.$disconnect();
};

if (process.env.NODE_ENV !== "test") {
  await ensureBootstrapAdminFromEnv();
  await ensureAllowlistedLoginUsers();
  await ensureDefaultHealthInboxFromEnv();
  await ensureHealthWorkflowTemplateIntegrity();
  await ensurePolicyRegistryTableAndSeed();

  process.on("SIGINT", async () => {
    await shutdown();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await shutdown();
    process.exit(0);
  });

  await app.listen({
    host,
    port
  });
}

export { app, prisma, shutdown };
