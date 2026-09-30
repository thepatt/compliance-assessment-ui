import type { ControlStatus } from "../types";

const LABELS: Record<ControlStatus, string> = {
  FULLY_COVERED: "Fully covered",
  PARTIALLY_COVERED: "Partially covered",
  NEEDS_REVIEW: "Needs review",
  NO_EVIDENCE: "No evidence",
  NOT_COVERED: "Not covered",
  UNSUPPORTED_CONTROL: "Unsupported",
};

export function statusLabel(status: ControlStatus | string | null): string {
  if (!status) return "Not yet evaluated";
  return LABELS[status as ControlStatus] ?? status;
}
