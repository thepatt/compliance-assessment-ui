import type { Assessment, Control, EvidencePreview } from "./types";

// doc-cat-api requires a tenant on every request (no login yet, header only).
const TENANT_ID = "tenant-001";
const API_ROOT = "/api/v1/compliance-assessments";

function tenantHeaders(): HeadersInit {
  return { "X-Tenant-Id": TENANT_ID };
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const body = payload as { message?: unknown; errors?: { findings?: unknown } };
  if (typeof body.message !== "string") return fallback;
  const findings = Array.isArray(body.errors?.findings)
    ? body.errors.findings.filter((item): item is string => typeof item === "string")
    : [];
  return findings.length ? `${body.message} Found: ${findings.join(", ")}.` : body.message;
}

function evidenceFormData(files: File[]): FormData {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  return formData;
}

async function checkedResponse(response: Response, fallback: string): Promise<Response> {
  if (!response.ok) throw new Error(errorMessage(await response.json().catch(() => null), fallback));
  return response;
}

export async function loadControls(): Promise<Control[]> {
  const response = await checkedResponse(
    await fetch(`${API_ROOT}/controls`, { headers: tenantHeaders() }),
    "Could not load the HIPAA control catalog.",
  );
  const payload = await response.json() as { controls: Control[] };
  return payload.controls;
}

export async function previewEvidenceFiles(files: File[]): Promise<EvidencePreview> {
  const response = await checkedResponse(
    await fetch(`${API_ROOT}/evidence/preview`, { method: "POST", headers: tenantHeaders(), body: evidenceFormData(files) }),
    "Evidence preflight could not be completed.",
  );
  return response.json() as Promise<EvidencePreview>;
}

export async function startAssessmentFromFiles(payload: {
  name: string;
  controlIds: string[];
  files: File[];
}): Promise<Assessment> {
  const formData = evidenceFormData(payload.files);
  formData.append("name", payload.name);
  formData.append("control_ids", JSON.stringify(payload.controlIds));
  const response = await checkedResponse(
    await fetch(`${API_ROOT}/assessments/from-files/async`, { method: "POST", headers: tenantHeaders(), body: formData }),
    "Evidence assessment could not be started.",
  );
  return response.json() as Promise<Assessment>;
}

export async function loadAssessment(assessmentId: string): Promise<Assessment> {
  const response = await checkedResponse(
    await fetch(`${API_ROOT}/assessments/${assessmentId}`, { headers: tenantHeaders() }),
    "Could not refresh the assessment status.",
  );
  return response.json() as Promise<Assessment>;
}
