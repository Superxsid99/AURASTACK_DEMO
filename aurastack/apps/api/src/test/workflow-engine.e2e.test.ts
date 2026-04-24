import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://smart:smart@localhost:5433/smart_case_buddy?schema=public";

const { app, prisma, shutdown } = await import("../server");

describe("workflow engine execution", () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(async () => {
    await prisma.workflowExecutionStep.deleteMany();
    await prisma.workflowExecution.deleteMany();
    await prisma.workflowStep.deleteMany();
    await prisma.workflow.deleteMany();
    await prisma.reviewTask.deleteMany();
    await prisma.event.deleteMany();
    await prisma.document.deleteMany();
    await prisma.caseRecord.deleteMany();
  });

  afterAll(async () => {
    await shutdown();
  });

  it("creates workflow and runs dynamic step routing", async () => {
    const createWorkflowResponse = await app.inject({
      method: "POST",
      url: "/workflows",
      payload: {
        key: "test-claims-workflow",
        name: "Test Claims Workflow",
        steps: [
          { key: "email", name: "Email Intake", stepType: "EMAIL_INTAKE", stepOrder: 1, nextStepKey: "validate" },
          { key: "validate", name: "Validation", stepType: "VALIDATION", stepOrder: 2, nextStepKey: "decision" },
          {
            key: "decision",
            name: "Decision",
            stepType: "DECISION",
            stepOrder: 3,
            config: {
              routes: {
                APPROVED: "approval",
                REVIEW_REQUIRED: "review",
                REJECTED: "reject"
              }
            }
          },
          { key: "approval", name: "Approval", stepType: "APPROVAL", stepOrder: 4 },
          { key: "review", name: "Human Review", stepType: "HUMAN_REVIEW", stepOrder: 5 },
          { key: "reject", name: "Rejection", stepType: "REJECTION", stepOrder: 6 }
        ]
      }
    });

    expect(createWorkflowResponse.statusCode).toBe(201);
    const workflowId: string = createWorkflowResponse.json().data.id;

    const executeResponse = await app.inject({
      method: "POST",
      url: `/workflows/${workflowId}/execute`,
      payload: {
        memberName: "Workflow Member",
        caseType: "Claims Review",
        priority: "high",
        emailSubject: "New claim submission",
        emailBody: "Please process attached claim documents.",
        documents: [
          { name: "Claim.pdf", type: "PDF", pages: 4, text: "Claim Number CLM-12" },
          { name: "ID.pdf", type: "PDF", pages: 1, text: "Photo ID verified" }
        ]
      }
    });

    expect(executeResponse.statusCode).toBe(202);
    const executionId: string = executeResponse.json().data.executionId;
    expect(executionId).toBeTruthy();

    const executionResponse = await app.inject({
      method: "GET",
      url: `/workflow-executions/${executionId}`
    });

    expect(executionResponse.statusCode).toBe(200);
    const execution = executionResponse.json().data;
    expect(execution.status).toBe("completed");
    expect(execution.steps.length).toBeGreaterThan(0);
    const stepTypes = execution.steps.map((step: { stepType: string }) => step.stepType);
    expect(stepTypes).toContain("DECISION");
    expect(stepTypes).toContain("APPROVAL");
  });
});

