export type Framework = {
  code: string;
  name: string;
  has_published_version: boolean;
};

export type Control = {
  control_id: string;
  citation: string;
  title: string;
  evidence_types: string[];
  domain: string;
  standard: string;
  requirement_type: string;
  release: string;
  priority: string;
  lifecycle_status: "active" | "planned";
};

export type ControlStatus =
  | "FULLY_COVERED"
  | "PARTIALLY_COVERED"
  | "NEEDS_REVIEW"
  | "NO_EVIDENCE"
  | "NOT_COVERED"
  | "UNSUPPORTED_CONTROL";

export type EvidenceCitation = {
  artifact_name: string;
  source_location: string;
  excerpt: string;
};

export type ControlResult = {
  control_id: string;
  status: ControlStatus;
  summary: string;
  evidence: EvidenceCitation[];
  missing_evidence: string[];
  requires_human_review: boolean;
};

// The case's CURRENT state for one control, as of whichever run last touched
// it. `status` is null when the control has never been evaluated yet.
export type ControlState = {
  control_id: string;
  status: ControlStatus | null;
  summary: string;
  evidence: EvidenceCitation[];
  missing_evidence: string[];
  updated_at: string | null;
};

export type EvidencePreview = {
  artifact_count: number;
  artifact_names: string[];
  file_type_counts: Record<string, number>;
  extracted_characters: number;
};

export type EvidenceDocument = {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
  storage_status: string;
  uploaded_in_run_id: string;
  created_at: string;
};

// One evidence-upload-and-evaluate execution inside a case. `control_ids`
// covers only the controls actually evaluated this run (not yet
// FULLY_COVERED at run-start) — a case's coverage grows across runs instead
// of every run re-grading everything.
export type RunSummary = {
  id: string;
  status: "RUNNING" | "COMPLETE" | "FAILED";
  progress: number;
  phase: string;
  control_ids: string[];
  created_at: string;
};

export type RunDetail = RunSummary & {
  failure_detail: string | null;
  evidence_document_ids: string[];
  results: ControlResult[];
};

// The persistent, resumable case. OPEN cases accept more evidence and more
// runs; CLOSED cases are read-only until reopened.
export type CaseSummary = {
  case_id: string;
  tenant_id: string;
  name: string;
  framework_code: string;
  framework_version_number: number;
  status: "OPEN" | "CLOSED";
  coverage_percent: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export type CaseDetail = CaseSummary & {
  control_states: ControlState[];
  evidence: EvidenceDocument[];
  runs: RunSummary[];
};
