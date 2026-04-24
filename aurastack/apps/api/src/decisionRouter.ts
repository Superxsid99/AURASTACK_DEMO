import type {
  JsonObject,
  WorkflowDecision,
  WorkflowRuntimeStep,
  WorkflowStepExecutionResult
} from "./workflow.types.js";

function parseConfig(config: unknown): JsonObject {
  if (!config || typeof config !== "object") {
    return {};
  }
  return config as JsonObject;
}

function asRouteMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, route]) => {
    if (typeof route === "string" && route.length > 0) {
      acc[key] = route;
    }
    return acc;
  }, {});
}

export function resolveNextStepId(
  step: WorkflowRuntimeStep,
  result: WorkflowStepExecutionResult
): string | null {
  const config = parseConfig(step.config);
  const routes = asRouteMap(config.routes);
  const decision = result.decision as WorkflowDecision | undefined;

  if (decision && routes[decision]) {
    return routes[decision];
  }

  if (result.requiresHumanReview && routes.REVIEW_REQUIRED) {
    return routes.REVIEW_REQUIRED;
  }

  if (typeof config.defaultNextStepId === "string" && config.defaultNextStepId.length > 0) {
    return config.defaultNextStepId;
  }

  return step.nextStepId ?? null;
}

