import type { Assessment, Control, EvidencePreview } from "./types";

const API_ROOT = "/api/v1";

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const uploadDetail = detail as { message?: unknown; findings?: unknown };
    if (typeof uploadDetail.message === "string") {
      const findings = Array.isArray(uploadDetail.findings) ? uploadDetail.findings.filter((item): item is string => typeof item === "string") : [];
      return findings.length ? `${uploadDetail.message} Found: ${findings.join(", ")}.` : uploadDetail.message;
    }
  }
  return fallback;
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
  const response = await checkedResponse(await fetch(`${API_ROOT}/standards/hipaa-security-rule/controls`), "Could not load the HIPAA control catalog.");
  const payload = await response.json() as { controls: Control[] };
  return payload.controls;
}

export async function previewEvidenceFiles(files: File[]): Promise<EvidencePreview> {
  const response = await checkedResponse(
    await fetch(`${API_ROOT}/evidence/preview`, { method: "POST", body: evidenceFormData(files) }),
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
    await fetch(`${API_ROOT}/assessments/from-files/async`, { method: "POST", body: formData }),
    "Evidence assessment could not be started.",
  );
  return response.json() as Promise<Assessment>;
}

export async function loadAssessment(assessmentId: string): Promise<Assessment> {
  const response = await checkedResponse(await fetch(`${API_ROOT}/assessments/${assessmentId}`), "Could not refresh the assessment status.");
  return response.json() as Promise<Assessment>;
}
