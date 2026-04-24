import type { JsonObject, WorkflowStepType } from "./workflow.types.js";

export interface AgentServiceStepRequest {
  executionId: string;
  caseId: string;
  workflowId: string;
  stepId: string;
  stepName: string;
  stepType: WorkflowStepType;
  payload: JsonObject;
  context: JsonObject;
  config: JsonObject;
}

export interface AgentServiceStepResponse {
  output: JsonObject;
  decision?: "APPROVED" | "REVIEW_REQUIRED" | "REJECTED";
}

export class AgentService {
  private readonly fallbackEnabled = (process.env.AGENT_FALLBACK_ENABLED ?? "false") === "true";
  private readonly ocrTimeoutMs = Number(process.env.AGENT_OCR_TIMEOUT_MS ?? "240000");
  private readonly dataExtractionTimeoutMs = Number(process.env.AGENT_DATA_EXTRACTION_TIMEOUT_MS ?? "120000");

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = Number(process.env.AGENT_TIMEOUT_MS ?? "60000")
  ) {}

  async executeStep(input: AgentServiceStepRequest): Promise<AgentServiceStepResponse> {
    const effectiveTimeoutMs =
      input.stepType === "DOCUMENT_OCR"
        ? this.ocrTimeoutMs
        : input.stepType === "DATA_EXTRACTION"
          ? this.dataExtractionTimeoutMs
          : this.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/workflow/execute-step`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(input),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Agent service returned ${response.status}: ${text}`);
      }

      const body = await response.json() as {
        data?: AgentServiceStepResponse;
      };

      if (!body.data) {
        throw new Error("Agent service response missing data payload");
      }

      return body.data;
    } catch (error) {
      if (this.fallbackEnabled) {
        return this.fallbackStepResponse(input.stepType, input.payload, input.context);
      }
      const message = error instanceof Error ? error.message : "Unknown agent service error";
      throw new Error(`Agent step execution failed for ${input.stepType}: ${message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  private fallbackStepResponse(
    stepType: WorkflowStepType,
    payload: JsonObject,
    context: JsonObject
  ): AgentServiceStepResponse {
    if (stepType === "DOCUMENT_OCR") {
      const documents = Array.isArray(payload.documents) ? payload.documents : [];
      return {
        output: {
          text: documents
            .map((document) => (typeof (document as { text?: unknown }).text === "string" ? (document as { text: string }).text : ""))
            .filter((text) => text.length > 0)
            .join("\n"),
          documentCount: documents.length,
          ocrProcessedDocuments: documents.length,
          hasExtractedText: documents.length > 0
        }
      };
    }

    if (stepType === "DATA_EXTRACTION") {
      return {
        output: {
          extractedFields: {
            memberName: payload.memberName ?? null,
            claimNumber: null,
            policyNumber: null
          }
        }
      };
    }

    if (stepType === "VALIDATION" || stepType === "KNOWLEDGE_CHECK") {
      const documents = Array.isArray(payload.documents) ? payload.documents : [];
      const confidence = documents.length > 1 ? 0.86 : 0.72;
      return {
        output: {
          confidence,
          passed: confidence >= 0.8,
          requiresHumanReview: confidence < 0.8,
          reasons: confidence < 0.8 ? ["Insufficient confidence in fallback validation"] : []
        }
      };
    }

    if (stepType === "DECISION") {
      const validation = context.steps && typeof context.steps === "object"
        ? (context.steps as Record<string, unknown>).Validation
        : null;
      const confidence = validation && typeof validation === "object"
        ? Number((validation as Record<string, unknown>).confidence ?? 0)
        : 0;
      const decision = confidence >= 0.85 ? "APPROVED" : confidence >= 0.65 ? "REVIEW_REQUIRED" : "REJECTED";
      return {
        decision,
        output: {
          decision,
          reason: "Fallback decisioning used because agent service was unavailable.",
          requiresHumanReview: decision === "REVIEW_REQUIRED"
        }
      };
    }

    if (stepType === "EMAIL_INTAKE" || stepType === "EMAIL_REPLY") {
      return {
        output: {
          status: "processed",
          stepType
        }
      };
    }

    if (stepType === "PRE_PROCESSOR") {
      const documents = Array.isArray(payload.documents) ? payload.documents : [];
      const total = documents.length;
      const clinical = documents.filter((d) => /discharge|lab|report|scan|prescription/i.test(String((d as { name?: unknown }).name ?? "")));
      const billing = documents.filter((d) => /invoice|bill|receipt|payment/i.test(String((d as { name?: unknown }).name ?? "")));
      const bodyText = `${String(payload.emailSubject ?? "")} ${String(payload.emailBody ?? "")}`.toLowerCase();
      const oncologySignal = /oncology|metastatic|carcinoma|chemotherapy|cancer/i.test(bodyText);
      return {
        output: {
          totalDocuments: total,
          totalPdfPages: 0,
          containsLargePdf: total >= 8,
          triage: {
            intent: "CLAIM",
            claimType: "health",
            severityBand: oncologySignal ? "critical" : "high",
            oncologySignal
          },
          documentGroups: [
            {
              group: "clinical_records",
              routedAgent: "lab_analyst_ai",
              files: clinical.map((d) => String((d as { name?: unknown }).name ?? "document"))
            },
            {
              group: "billing_documents",
              routedAgent: "billing_ai",
              files: billing.map((d) => String((d as { name?: unknown }).name ?? "document"))
            }
          ],
          recommendedWorkflowKeys: oncologySignal
            ? ["hospital_intake_v1", "claims_mgmt_v1", "medical_uw_v1", "compliance_audit_v1"]
            : ["hospital_intake_v1", "claims_mgmt_v1"],
          cascadeRequired: true
        }
      };
    }

    if (stepType === "CLAIM_CLASSIFICATION") {
      const emailSubject = typeof payload.emailSubject === "string" ? payload.emailSubject.toLowerCase() : "";
      const emailBody = typeof payload.emailBody === "string" ? payload.emailBody.toLowerCase() : "";
      const combined = `${emailSubject} ${emailBody}`;
      const isHealth = /health|medical|hospital|doctor|prescription|surgery/.test(combined);
      const isAuto = /car|vehicle|auto|accident|collision|crash/.test(combined);
      const isProperty = /home|house|property|fire|flood|theft/.test(combined);
      const isLife = /life|death|beneficiary|deceased/.test(combined);
      const claimType = isHealth ? "health" : isAuto ? "auto" : isProperty ? "property" : isLife ? "life" : "other";
      const isNewClaim = /file a claim|new claim|accident|damage|injured/.test(combined);
      return {
        output: {
          inquiryType: isNewClaim ? "new_claim" : "general_query",
          claimType,
          priority: "medium",
          policyNumber: null,
          memberName: payload.memberName ?? null,
          summary: `Fallback classification: ${claimType} claim`,
          requiredDocuments: [],
          confidence: 0.55,
          method: "fallback"
        }
      };
    }

    if (stepType === "POLICY_LOOKUP") {
      return {
        output: {
          policyFound: false,
          policyNumber: "UNKNOWN",
          policyType: "health",
          coverageTypes: ["Basic Coverage"],
          sumInsured: 250000,
          status: "unknown",
          lookupMethod: "fallback",
          note: "Agent service unavailable"
        }
      };
    }

    if (stepType === "NOTIFY_CUSTOMER") {
      return {
        output: {
          emailSent: false,
          simulated: true,
          note: "Agent service unavailable – email not sent"
        }
      };
    }

    if (stepType === "DOCUMENT_VALIDATION") {
      const documents = Array.isArray(payload.documents) ? payload.documents : [];
      return {
        output: {
          passed: documents.length >= 2,
          submittedDocuments: documents.length,
          missingDocumentLabels: documents.length >= 2 ? [] : ["required_docs_missing"],
          documentCompleteness: documents.length >= 2 ? 1 : 0.5,
          confidence: documents.length >= 2 ? 0.84 : 0.68,
          requiresHumanReview: documents.length < 2
        }
      };
    }

    if (stepType === "FRAUD_SCREENING") {
      return {
        output: {
          fraudScore: 42,
          fraudRiskBand: "medium",
          flags: ["fallback_screening"],
          requiresHumanReview: true
        }
      };
    }

    if (stepType === "MEDICAL_CODING") {
      return {
        output: {
          diagnosisCodes: [],
          primaryDiagnosisCode: null,
          medicalCodingConfidence: 0.6
        }
      };
    }

    if (stepType === "COVERAGE_RULES") {
      return {
        output: {
          coverageEligible: true,
          coverageIssues: [],
          requiresHumanReview: false
        }
      };
    }

    if (stepType === "PROVIDER_NETWORK_CHECK") {
      return {
        output: {
          providerInNetwork: null,
          providerName: null,
          networkConfidence: 0.5,
          requiresHumanReview: false
        }
      };
    }

    if (stepType === "SETTLEMENT_ESTIMATION") {
      return {
        output: {
          currency: "INR",
          claimAmount: 0,
          sumInsured: 0,
          deductibleAmount: 0,
          coPayAmount: 0,
          estimatedPayable: 0
        }
      };
    }

    if (stepType === "HUMAN_HANDOFF") {
      return {
        output: {
          handoffRequired: true,
          handoffQueue: "claims-human-review",
          handoffReasons: ["fallback_manual_gate"],
          ownerRole: "reviewer",
          slaHours: 24
        }
      };
    }

    if (stepType === "CUSTOMER_COMMS") {
      return {
        output: {
          channel: "email",
          messageDraft: "Your case is being processed. We will update you shortly.",
          handoffRequired: false
        }
      };
    }

    if (stepType === "AUDIT_COMPLIANCE") {
      return {
        output: {
          auditTrailComplete: false,
          requiredSteps: [],
          missingAuditSteps: [],
          executedSteps: [],
          complianceScore: 0.5
        }
      };
    }

    if (stepType === "SLA_CHECK") {
      return {
        output: {
          slaStatus: "active",
          checked: false,
          note: "Agent service unavailable"
        }
      };
    }

    return {
      output: {}
    };
  }
}

