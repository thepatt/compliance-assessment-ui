import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  FileText,
  FileUp,
  LockKeyhole,
  LoaderCircle,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { loadAssessment, loadControls, previewEvidenceFiles, startAssessmentFromFiles } from "./api";
import type { Assessment, Control, ControlResult, EvidencePreview } from "./types";

const allowedExtensions = [".pdf", ".docx", ".txt", ".md", ".zip"];
const maxFileSizeBytes = 10 * 1024 * 1024;
const maxFiles = 5;

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    FULLY_COVERED: "Fully covered",
    PARTIALLY_COVERED: "Partially covered",
    NEEDS_REVIEW: "Needs review",
    NO_EVIDENCE: "No evidence",
    NOT_COVERED: "Not covered",
    UNSUPPORTED_CONTROL: "Unsupported",
  };
  return labels[status] ?? status;
}

function fileExtension(fileName: string) {
  return `.${fileName.split(".").pop()?.toLowerCase() ?? ""}`;
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function groupControls(controls: Control[]): Array<[string, Array<[string, Control[]]>]> {
  const domains = new Map<string, Map<string, Control[]>>();
  controls.forEach((control) => {
    const standards = domains.get(control.domain) ?? new Map<string, Control[]>();
    const items = standards.get(control.standard) ?? [];
    items.push(control);
    standards.set(control.standard, items);
    domains.set(control.domain, standards);
  });
  return Array.from(domains, ([domain, standards]) => [domain, Array.from(standards)]);
}

export default function App() {
  const [controls, setControls] = useState<Control[]>([]);
  const [selectedControls, setSelectedControls] = useState<string[]>([]);
  const [assessmentName, setAssessmentName] = useState("Q3 security readiness review");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [deidentifiedConfirmed, setDeidentifiedConfirmed] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState<EvidencePreview | null>(null);
  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");

  const activeControls = controls.filter((control) => control.lifecycle_status === "active");
  const catalogGroups = groupControls(controls);
  const controlsById = new Map(controls.map((control) => [control.control_id, control]));
  const progress = assessment?.progress ?? (isSubmitting ? 5 : 0);
  const assessmentPhase = assessment?.phase ?? "Submitting evidence";
  const activeAssessmentId = assessment?.status === "RUNNING" ? assessment.assessment_id : null;
  const resultByControlId = new Map(assessment?.results.map((result) => [result.control_id, result]) ?? []);

  useEffect(() => {
    loadControls()
      .then((catalog) => {
        setControls(catalog);
        setSelectedControls(catalog.filter((control) => control.lifecycle_status === "active").map((control) => control.control_id));
      })
      .catch((loadError: Error) => setError(loadError.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!uploadedFiles.length) {
      setPreview(null);
      setPreviewStatus("idle");
      return;
    }

    setPreview(null);
    setPreviewStatus("loading");
    previewEvidenceFiles(uploadedFiles)
      .then((nextPreview) => {
        if (!cancelled) {
          setPreview(nextPreview);
          setPreviewStatus("ready");
        }
      })
      .catch((previewError: Error) => {
        if (!cancelled) {
          setPreviewStatus("error");
          setError(previewError.message);
        }
      });
    return () => { cancelled = true; };
  }, [uploadedFiles]);

  useEffect(() => {
    if (!activeAssessmentId) return;
    const assessmentId = activeAssessmentId;
    let cancelled = false;

    async function refreshAssessment() {
      try {
        const nextAssessment = await loadAssessment(assessmentId);
        if (cancelled) return;
        setAssessment(nextAssessment);
        if (nextAssessment.status === "FAILED") {
          setError(nextAssessment.failure_detail ?? "The assessment could not be completed.");
          setIsSubmitting(false);
        } else if (nextAssessment.status === "COMPLETE") {
          setIsSubmitting(false);
        }
      } catch (refreshError) {
        if (!cancelled) {
          setError(refreshError instanceof Error ? refreshError.message : "Could not refresh the assessment status.");
          setIsSubmitting(false);
        }
      }
    }

    void refreshAssessment();
    const timer = window.setInterval(() => { void refreshAssessment(); }, 1200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeAssessmentId]);

  function toggleControl(control: Control) {
    if (control.lifecycle_status !== "active") return;
    setSelectedControls((current) => current.includes(control.control_id)
      ? current.filter((id) => id !== control.control_id)
      : [...current, control.control_id]);
  }

  function selectDomainControls(domain: string, shouldSelect: boolean) {
    const ids = controls.filter((control) => control.domain === domain && control.lifecycle_status === "active").map((control) => control.control_id);
    setSelectedControls((current) => shouldSelect
      ? Array.from(new Set([...current, ...ids]))
      : current.filter((id) => !ids.includes(id)));
  }

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const candidates = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!candidates.length) return;
    const invalidFile = candidates.find((file) => !allowedExtensions.includes(fileExtension(file.name)) || file.size > maxFileSizeBytes);
    if (invalidFile) {
      setError("Upload PDF, DOCX, TXT, Markdown, or ZIP files no larger than 10 MB.");
      return;
    }
    const uniqueCandidates = candidates.filter((file) => !uploadedFiles.some((current) => fileKey(current) === fileKey(file)));
    if (uploadedFiles.length + uniqueCandidates.length > maxFiles) {
      setError(`Upload no more than ${maxFiles} evidence files.`);
      return;
    }
    setUploadedFiles((current) => [...current, ...uniqueCandidates]);
    setError("");
  }

  function removeFile(file: File) {
    setUploadedFiles((current) => current.filter((candidate) => fileKey(candidate) !== fileKey(file)));
  }

  async function submitAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!assessmentName.trim()) {
      setError("Add an assessment name.");
      return;
    }
    if (!selectedControls.length) {
      setError("Select at least one active control.");
      return;
    }
    if (!deidentifiedConfirmed) {
      setError("Confirm that the evidence is de-identified before continuing.");
      return;
    }
    if (!uploadedFiles.length) {
      setError("Upload at least one evidence file.");
      return;
    }
    if (previewStatus !== "ready") {
      setError("Wait for the evidence preflight to complete before starting the assessment.");
      return;
    }

    setAssessment(null);
    setIsSubmitting(true);
    try {
      setAssessment(await startAssessmentFromFiles({ name: assessmentName.trim(), controlIds: selectedControls, files: uploadedFiles }));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The assessment could not be started.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="rail" aria-label="Application navigation">
        <div className="brand-mark"><ShieldCheck aria-hidden="true" /><span>CONTROL<br />ROOM</span></div>
        <nav>
          <a className="nav-link active" href="#assessment"><ClipboardCheck aria-hidden="true" />Assessment</a>
          <a className="nav-link" href="#results"><BadgeCheck aria-hidden="true" />Results</a>
        </nav>
        <p className="rail-note"><LockKeyhole aria-hidden="true" />Use de-identified evidence only.</p>
      </aside>

      <section className="workspace">
        <header className="page-header">
          <div>
            <p className="eyebrow">HIPAA SECURITY RULE / 45 CFR PART 164, SUBPART C</p>
            <h1>Readiness assessment</h1>
          </div>
          <div className="header-status"><span className="status-dot" />Review required</div>
        </header>

        {error && <div className="alert" role="alert"><AlertTriangle aria-hidden="true" />{error}</div>}

        <form className="assessment-grid" id="assessment" onSubmit={submitAssessment}>
          <section className="panel intake-panel">
            <div className="panel-heading"><span className="step">01</span><div><h2>Assessment</h2><p>Set the review and add de-identified evidence.</p></div></div>
            <label htmlFor="assessment-name">Assessment name</label>
            <input id="assessment-name" value={assessmentName} disabled={isSubmitting} onChange={(event) => setAssessmentName(event.target.value)} />

            <div className="evidence-title"><FileUp aria-hidden="true" /><h3>Evidence files</h3></div>
            <label className="upload-zone" htmlFor="evidence-files">
              <FileUp aria-hidden="true" />
              <span>Choose evidence files</span>
              <small>PDF, DOCX, TXT, MD, or ZIP. Up to 5 uploads, 10 MB each. ZIPs may contain up to 100 files.</small>
            </label>
            <input className="file-input" id="evidence-files" type="file" accept=".pdf,.docx,.txt,.md,.zip" multiple disabled={isSubmitting} onChange={addFiles} />
            {uploadedFiles.length > 0 && <ul className="file-list" aria-label="Selected evidence files">
              {uploadedFiles.map((file) => <li key={fileKey(file)}><FileText aria-hidden="true" /><span>{file.name}</span><small>{Math.ceil(file.size / 1024)} KB</small><button type="button" disabled={isSubmitting} onClick={() => removeFile(file)} aria-label={`Remove ${file.name}`} title={`Remove ${file.name}`}><X aria-hidden="true" /></button></li>)}
            </ul>}

            {uploadedFiles.length > 0 && <section className="evidence-preflight" aria-live="polite">
              <div className="preflight-heading"><div><p className="eyebrow">EVIDENCE PREFLIGHT</p><h3>{previewStatus === "loading" ? "Screening evidence" : previewStatus === "ready" ? "Evidence bundle ready" : "Evidence needs attention"}</h3></div><span className={`preflight-status ${previewStatus}`}>{previewStatus === "loading" ? "Scanning" : previewStatus === "ready" ? "Ready" : "Review"}</span></div>
              {previewStatus === "loading" && <p>Extracting readable text and checking the uploaded evidence in memory.</p>}
              {previewStatus === "ready" && preview && <>
                <p>{preview.artifact_count} documents detected with {preview.extracted_characters.toLocaleString()} extracted characters.</p>
                <ul className="preflight-types">{Object.entries(preview.file_type_counts).map(([type, count]) => <li key={type}>{count} {type}</li>)}</ul>
                <details><summary>Review detected documents</summary><ul className="preflight-files">{preview.artifact_names.map((name) => <li key={name}>{name}</li>)}</ul></details>
              </>}
              {previewStatus === "error" && <p>Resolve the upload error shown above, then choose the evidence files again.</p>}
            </section>}

            <label className="deidentify-confirmation" htmlFor="deidentified-confirmation">
              <input id="deidentified-confirmation" type="checkbox" disabled={isSubmitting} checked={deidentifiedConfirmed} onChange={(event) => setDeidentifiedConfirmed(event.target.checked)} />
              <span>I confirm these files contain no PHI/ePHI, patient identifiers, secrets, or raw production logs.</span>
            </label>
            <p className="field-note">Files are scanned and read in memory. The original upload is not stored by this MVP.</p>
          </section>

          <section className="panel controls-panel">
            <div className="panel-heading"><span className="step">02</span><div><h2>Control catalog</h2><p>{selectedControls.length} of {activeControls.length} active controls selected · {controls.length} catalog controls</p></div></div>
            <div className="catalog-actions">
              <button type="button" disabled={isSubmitting || !activeControls.length} onClick={() => setSelectedControls(activeControls.map((control) => control.control_id))}>Select all active</button>
              <button type="button" disabled={isSubmitting || !selectedControls.length} onClick={() => setSelectedControls([])}>Clear selection</button>
            </div>
            <div className="catalog-list">
              {catalogGroups.map(([domain, standards]) => {
                const domainControls = standards.flatMap(([, items]) => items);
                const domainActive = domainControls.filter((control) => control.lifecycle_status === "active");
                const selectedInDomain = domainActive.filter((control) => selectedControls.includes(control.control_id)).length;
                return <details className="catalog-domain" key={domain} open={domainActive.length > 0}>
                  <summary><span><strong>{domain}</strong><small>{selectedInDomain} / {domainActive.length} active selected · {domainControls.length} controls</small></span><span className="domain-summary-status">{domainActive.length ? `${domainActive.length} active` : "Planned"}</span></summary>
                  <div className="domain-actions">
                    {domainActive.length > 0 && <><button type="button" disabled={isSubmitting} onClick={() => selectDomainControls(domain, true)}>Select active</button><button type="button" disabled={isSubmitting || !selectedInDomain} onClick={() => selectDomainControls(domain, false)}>Clear active</button></>}
                  </div>
                  {standards.map(([standard, standardControls]) => <section className="catalog-standard" key={standard}>
                    <h3>{standard}</h3>
                    {standardControls.map((control) => {
                      const isSelected = selectedControls.includes(control.control_id);
                      const isActive = control.lifecycle_status === "active";
                      return <label className={`control-row ${isSelected ? "selected" : ""} ${isActive ? "" : "planned"}`} key={control.control_id}>
                        <input type="checkbox" disabled={isSubmitting || !isActive} checked={isSelected} onChange={() => toggleControl(control)} />
                        <span className="control-copy"><strong>{control.title}</strong><small>{control.control_id} · {control.citation}</small><span className="control-badges"><i>{control.requirement_type}</i><i>{control.priority} priority</i>{!isActive && <i className="planned-badge">{control.release}</i>}</span></span>
                        <span className="check-indicator" aria-hidden="true" />
                      </label>;
                    })}
                  </section>)}
                </details>;
              })}
            </div>
            <button className="primary-action" type="submit" disabled={isSubmitting || !selectedControls.length || (uploadedFiles.length > 0 && previewStatus !== "ready")}>
              <Send aria-hidden="true" />{isSubmitting ? "Assessing evidence..." : "Run assessment"}<ArrowRight aria-hidden="true" />
            </button>
          </section>
        </form>

        {isSubmitting && <section className="assessment-progress" role="status" aria-live="polite" aria-label={`Assessment progress: ${progress}%`}>
          <div className="progress-heading"><div><p className="eyebrow">ASSESSMENT IN PROGRESS</p><h2>{assessmentPhase}</h2></div><strong>{progress}%</strong></div>
          <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
          <div className="progress-meta"><LoaderCircle aria-hidden="true" /><span>{assessment?.status === "RUNNING" ? "Progress is reported by the backend as the assessment runs." : "Waiting for the assessment job to start."}</span></div>
          <ol className="progress-steps"><li className={progress >= 10 ? "complete" : ""}>Evidence received</li><li className={progress >= 35 ? "complete" : ""}>Context prepared</li><li className={progress >= 60 ? "active" : ""}>AI assessment</li><li className={progress >= 85 ? "active" : ""}>Citations validated</li></ol>
        </section>}

        <section className="results-section" id="results" aria-live="polite">
          <div className="results-heading"><div><p className="eyebrow">ASSESSMENT OUTPUT</p><h2>Control results</h2></div>{assessment && <span className="assessment-id">ID {assessment.assessment_id.slice(0, 8)}</span>}</div>
          {!assessment && <div className="empty-state"><ClipboardCheck aria-hidden="true" /><p>Run an assessment to see evidence and gaps by control.</p></div>}
          {assessment?.status === "RUNNING" && <div className="empty-state"><LoaderCircle aria-hidden="true" /><p>{assessment.phase}. Results will appear when assessment completes.</p></div>}
          {assessment?.status === "FAILED" && <div className="empty-state"><AlertTriangle aria-hidden="true" /><p>{assessment.failure_detail ?? "The assessment could not be completed."}</p></div>}
          {assessment?.status === "COMPLETE" && <div className="results-domains">
            {catalogGroups.map(([domain, standards]) => {
              const domainResults = standards.flatMap(([, items]) => items.map((control) => ({ control, result: resultByControlId.get(control.control_id) })).filter((item): item is { control: Control; result: ControlResult } => Boolean(item.result)));
              if (!domainResults.length) return null;
              return <section className="results-domain" key={domain}>
                <div className="results-domain-heading"><h3>{domain}</h3><span>{domainResults.length} controls assessed</span></div>
                {standards.map(([standard, standardControls]) => {
                  const standardResults = standardControls.map((control) => ({ control, result: resultByControlId.get(control.control_id) })).filter((item): item is { control: Control; result: ControlResult } => Boolean(item.result));
                  if (!standardResults.length) return null;
                  return <section className="results-standard" key={standard}><h4>{standard}</h4><div className="results-list">{standardResults.map(({ control, result }) => <article className="result-row" key={result.control_id}>
                    <div><span className={`result-status ${result.status.toLowerCase()}`}>{statusLabel(result.status)}</span><h3>{control.title}</h3><p>{result.summary}</p></div>
                    <div className="result-detail"><strong>Evidence</strong>{result.evidence.length ? result.evidence.map((citation) => <div className="evidence-citation" key={`${citation.artifact_name}-${citation.excerpt}`}><cite>{citation.artifact_name}</cite><span className="evidence-location">{citation.source_location}</span><blockquote>{citation.excerpt}</blockquote></div>) : <p>None submitted.</p>}<div className={`evidence-gap ${result.missing_evidence.length ? "has-gaps" : "no-gaps"}`}><strong>{result.missing_evidence.length ? "Evidence gaps" : "No evidence-type gaps identified"}</strong>{result.missing_evidence.length ? <p>{result.missing_evidence.join(", ")}</p> : <p>The submitted evidence addresses the evidence types in this control catalog.</p>}<p className="human-review-note">Human validation of scope and operating effectiveness remains required.</p></div></div>
                  </article>)}</div></section>;
                })}
              </section>;
            })}
          </div>}
        </section>
      </section>
    </main>
  );
}
