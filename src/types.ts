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

export type ControlResult = {
  control_id: string;
  status: "EVIDENCE_FOUND" | "MISSING_EVIDENCE" | "UNSUPPORTED_CONTROL";
  summary: string;
  evidence: { artifact_name: string; source_location: string; excerpt: string }[];
  missing_evidence: string[];
  requires_human_review: boolean;
};

export type EvidencePreview = {
  artifact_count: number;
  artifact_names: string[];
  file_type_counts: Record<string, number>;
  extracted_characters: number;
};

export type Assessment = {
  assessment_id: string;
  name: string;
  status: "RUNNING" | "COMPLETE" | "FAILED";
  progress: number;
  phase: string;
  failure_detail: string | null;
  created_at: string;
  control_ids: string[];
  artifact_names: string[];
  results: ControlResult[];
};
