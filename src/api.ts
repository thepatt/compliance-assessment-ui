import type { CaseDetail, Control, EvidencePreview, Framework, RunDetail } from "./types";

// doc-cat-api requires a tenant on every request (no login yet, header only).
const TENANT_ID = "tenant-001";
const API_ROOT = "/api/v1/compliance-cases";

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

export async function loadFrameworks(): Promise<Framework[]> {
  const response = await checkedResponse(
    await fetch(`${API_ROOT}/frameworks`, { headers: tenantHeaders() }),
    "Could not load the list of compliance frameworks.",
  );
  return response.json() as Promise<Framework[]>;
}

export async function loadControls(frameworkCode: string = "HIPAA"): Promise<Control[]> {
  const response = await checkedResponse(
    await fetch(`${API_ROOT}/controls?framework=${encodeURIComponent(frameworkCode)}`, { headers: tenantHeaders() }),
    "Could not load the control catalog.",
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

export async function listCases(status?: "OPEN" | "CLOSED"): Promise<CaseDetail[]> {
  const query = status ? `?status_filter=${status}` : "";
  const response = await checkedResponse(
    await fetch(`${API_ROOT}${query}`, { headers: tenantHeaders() }),
    "Could not load the list of cases.",
  );
  return response.json() as Promise<CaseDetail[]>;
}

export async function createCase(payload: { name: string; frameworkCode: string }): Promise<CaseDetail> {
  const response = await checkedResponse(
    await fetch(API_ROOT, {
      method: "POST",
      headers: { ...tenantHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ name: payload.name, framework_code: payload.frameworkCode }),
    }),
    "The case could not be created.",
  );
  return response.json() as Promise<CaseDetail>;
}

export async function loadCase(caseId: string): Promise<CaseDetail> {
  const response = await checkedResponse(
    await fetch(`${API_ROOT}/${caseId}`, { headers: tenantHeaders() }),
    "Could not refresh the case.",
  );
  return response.json() as Promise<CaseDetail>;
}

export async function startCaseRun(caseId: string, files: File[]): Promise<RunDetail> {
  const response = await checkedResponse(
    await fetch(`${API_ROOT}/${caseId}/runs`, { method: "POST", headers: tenantHeaders(), body: evidenceFormData(files) }),
    "The run could not be started.",
  );
  return response.json() as Promise<RunDetail>;
}

export async function loadCaseRun(caseId: string, runId: string): Promise<RunDetail> {
  const response = await checkedResponse(
    await fetch(`${API_ROOT}/${caseId}/runs/${runId}`, { headers: tenantHeaders() }),
    "Could not refresh the run status.",
  );
  return response.json() as Promise<RunDetail>;
}

export async function closeCase(caseId: string): Promise<CaseDetail> {
  const response = await checkedResponse(
    await fetch(`${API_ROOT}/${caseId}/close`, { method: "POST", headers: tenantHeaders() }),
    "The case could not be closed.",
  );
  return response.json() as Promise<CaseDetail>;
}

export async function reopenCase(caseId: string): Promise<CaseDetail> {
  const response = await checkedResponse(
    await fetch(`${API_ROOT}/${caseId}/reopen`, { method: "POST", headers: tenantHeaders() }),
    "The case could not be reopened.",
  );
  return response.json() as Promise<CaseDetail>;
}
