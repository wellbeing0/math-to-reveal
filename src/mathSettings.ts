import { type GradeLane, type MathSettings, type Operation } from "./mathEngine";

export function allowedOperationsForSettings(settings: MathSettings): Operation[] {
  return uniqueOperations(settings.gradeLanes.flatMap(operationsForGradeLane));
}

export function operationsForGradeLane(gradeLane: GradeLane): Operation[] {
  if (gradeLane === "kindergarten") {
    return ["count", "add", "subtract"];
  }
  if (gradeLane === "grade1") {
    return ["add", "subtract"];
  }
  if (gradeLane === "grade2") {
    return ["add", "subtract", "placeValue", "skipCount", "groups"];
  }
  if (gradeLane === "grade3") {
    return ["multiply", "divide", "arrays"];
  }
  return ["fraction", "decimal"];
}

export function uniqueOperations(values: readonly Operation[]): Operation[] {
  return [...new Set(values)];
}
