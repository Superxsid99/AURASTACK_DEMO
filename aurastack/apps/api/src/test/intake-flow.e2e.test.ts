import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://smart:smart@localhost:5433/smart_case_buddy?schema=public";

const { app, prisma, shutdown } = await import("../server");

describe("intake + review flow", () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(async () => {
    await prisma.workflowExecutionStep.deleteMany();
    await prisma.workflowExecution.deleteMany();
    await prisma.workflowStep.deleteMany();
    await prisma.workflow.deleteMany();
    await prisma.event.deleteMany();
    await prisma.agentRun.deleteMany();
    await prisma.reviewTask.deleteMany();
    await prisma.intakeJob.deleteMany();
    await prisma.document.deleteMany();
    await prisma.caseRecord.deleteMany();
    await prisma.agentDefinition.deleteMany();
  });

  afterAll(async () => {
    await shutdown();
  });

  it("creates intake job and resolves review queue", async () => {
    const flowResponse = await app.inject({
      method: "GET",
      url: "/agent-flows/default"
    });
    expect(flowResponse.statusCode).toBe(200);
    const flow = flowResponse.json().data;

    const createResponse = await app.inject({
      method: "POST",
      url: "/intake/submissions",
      payload: {
        memberName: "Test Member",
        caseType: "Submission Intake",
        priority: "high",
        documents: [
          { name: "Submission.pdf", type: "PDF", pages: 5 }
        ],
        flowConfig: flow
      }
    });
    expect(createResponse.statusCode).toBe(201);

    const created = createResponse.json().data;
    const jobId: string = created.intakeJob.id;
    const caseId: string = created.case.id;

    let attempts = 0;
    let finalStatus = "queued";
    while (attempts < 30) {
      const jobResponse = await app.inject({
        method: "GET",
        url: `/intake/jobs/${jobId}`
      });
      finalStatus = jobResponse.json().data.status as string;
      if (["needs_review", "completed", "failed"].includes(finalStatus)) {
        break;
      }
      attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(["needs_review", "completed"]).toContain(finalStatus);

    if (finalStatus === "needs_review") {
      const tasksResponse = await app.inject({
        method: "GET",
        url: "/review-tasks"
      });
      expect(tasksResponse.statusCode).toBe(200);
      const task = tasksResponse
        .json()
        .data.find((item: { caseId: string }) => item.caseId === caseId);
      expect(task).toBeTruthy();

      const claimResponse = await app.inject({
        method: "POST",
        url: `/review-tasks/${task.id}/claim`,
        payload: { assigneeName: "QA Reviewer" }
      });
      expect(claimResponse.statusCode).toBe(200);

      const resolveResponse = await app.inject({
        method: "POST",
        url: `/review-tasks/${task.id}/resolve`,
        payload: { resolutionNote: "Looks good" }
      });
      expect(resolveResponse.statusCode).toBe(200);
    }
  });
});

