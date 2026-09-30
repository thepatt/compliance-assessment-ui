import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  FileUp,
  Lock,
  LoaderCircle,
  Send,
  Unlock,
  X,
} from "lucide-react";
import { closeCase, loadCase, loadCaseRun, loadControls, previewEvidenceFiles, reopenCase, startCaseRun } from "../api";
import type { CaseDetail, Control, EvidencePreview, RunDetail } from "../types";
import { groupControls } from "../lib/groupControls";
import { statusLabel } from "../lib/statusLabels";

const allowedExtensions = [".pdf", ".docx", ".txt", ".md", ".zip"];
const maxFileSizeBytes = 10 * 1024 * 1024;
const maxFiles = 5;

function fileExtension(fileName: string) {
  return `.${fileName.split(".").pop()?.toLowerCase() ?? ""}`;
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

type Props = {
  caseId: string;
  onBack: () => void;
};

export default function CaseDetailView({ caseId, onBack }: Props) {
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [controls, setControls] = useState<Control[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [deidentifiedConfirmed, setDeidentifiedConfirmed] = useState(false);
  const [preview, setPreview] = useState<EvidencePreview | null>(null);
  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeRun, setActiveRun] = useState<RunDetail | null>(null);
  const [error, setError] = useState("");

  const catalogGroups = groupControls(controls);
  const stateByControlId = new Map((caseDetail?.control_states ?? []).map((state) => [state.control_id, state]));
  const isOpen = caseDetail?.status === "OPEN";

  useEffect(() => {
    let cancelled = false;
    setCaseDetail(null);
    setControls([]);
    loadCase(caseId)
      .then((detail) => {
        if (cancelled) return;
        setCaseDetail(detail);
        return loadControls(detail.framework_code);
      })
      .then((loadedControls) => {
        if (!cancelled && loadedControls) setControls(loadedControls);
      })
      .catch((loadError: Error) => !cancelled && setError(loadError.message));
    return () => {
      cancelled = true;
    };
  }, [caseId]);

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
    return () => {
      cancelled = true;
    };
  }, [uploadedFiles]);

  useEffect(() => {
    if (!activeRun || activeRun.status !== "RUNNING") return;
    let cancelled = false;

    async function poll() {
      try {
        const run = await loadCaseRun(caseId, activeRun!.id);
        if (cancelled) return;
        setActiveRun(run);
        if (run.status !== "RUNNING") {
          setIsSubmitting(false);
          const detail = await loadCase(caseId);
          if (!cancelled) setCaseDetail(detail);
          if (run.status === "FAILED") setError(run.failure_detail ?? "The run could not be completed.");
        }
      } catch (pollError) {
        if (!cancelled) {
          setError(pollError instanceof Error ? pollError.message : "Could not refresh the run status.");
          setIsSubmitting(false);
        }
      }
    }

    const timer = window.setInterval(poll, 1200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeRun, caseId]);

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
      setError(`Upload no more than ${maxFiles} evidence files at a time.`);
      return;
    }
    setUploadedFiles((current) => [...current, ...uniqueCandidates]);
    setError("");
  }

  function removeFile(file: File) {
    setUploadedFiles((current) => current.filter((candidate) => fileKey(candidate) !== fileKey(file)));
  }

  async function submitRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!deidentifiedConfirmed) {
      setError("Confirm that the evidence is de-identified before continuing.");
      return;
    }
    if (!uploadedFiles.length) {
      setError("Upload at least one evidence file.");
      return;
    }
    if (previewStatus !== "ready") {
      setError("Wait for the evidence preflight to complete before starting the run.");
      return;
    }

    setIsSubmitting(true);
    try {
      const run = await startCaseRun(caseId, uploadedFiles);
      setActiveRun(run);
      setUploadedFiles([]);
      setDeidentifiedConfirmed(false);
      if (run.status !== "RUNNING") {
        setIsSubmitting(false);
        setCaseDetail(await loadCase(caseId));
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The run could not be started.");
      setIsSubmitting(false);
    }
  }

  async function handleClose() {
    setError("");
    try {
      setCaseDetail(await closeCase(caseId));
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "The case could not be closed.");
    }
  }

  async function handleReopen() {
    setError("");
    try {
      setCaseDetail(await reopenCase(caseId));
    } catch (reopenError) {
      setError(reopenError instanceof Error ? reopenError.message : "The case could not be reopened.");
    }
  }

  if (!caseDetail) {
    return (
      <section className="workspace">
        <div className="empty-state"><LoaderCircle aria-hidden="true" /><p>Loading case…</p></div>
      </section>
    );
  }

  const progress = activeRun?.progress ?? 0;

  return (
    <section className="workspace">
      <button type="button" className="back-link" onClick={onBack}><ArrowLeft aria-hidden="true" />All cases</button>

      <header className="page-header">
        <div>
          <p className="eyebrow">{caseDetail.framework_code} · VERSION {caseDetail.framework_version_number}</p>
          <h1>{caseDetail.name}</h1>
        </div>
        <div className="case-header-actions">
          <span className={`case-status ${caseDetail.status.toLowerCase()}`}>{caseDetail.status}</span>
          {caseDetail.status === "OPEN"
            ? <button type="button" className="secondary-action" onClick={handleClose}><Lock aria-hidden="true" />Close case</button>
            : <button type="button" className="secondary-action" onClick={handleReopen}><Unlock aria-hidden="true" />Reopen case</button>}
        </div>
      </header>

      <div className="coverage-summary">
        <div className="coverage-bar"><span style={{ width: `${caseDetail.coverage_percent}%` }} /></div>
        <strong>{caseDetail.coverage_percent}% fully covered</strong>
        <span>{caseDetail.evidence.length} evidence document{caseDetail.evidence.length === 1 ? "" : "s"} · {caseDetail.runs.length} run{caseDetail.runs.length === 1 ? "" : "s"}</span>
      </div>

      {error && <div className="alert" role="alert"><AlertTriangle aria-hidden="true" />{error}</div>}

      {isOpen && (
        <form className="panel intake-panel" onSubmit={submitRun}>
          <div className="panel-heading"><div><h2>Add evidence &amp; run</h2><p>Only controls not yet fully covered will be re-assessed.</p></div></div>
          <label className="upload-zone" htmlFor="evidence-files">
            <FileUp aria-hidden="true" />
            <span>Choose evidence files</span>
            <small>PDF, DOCX, TXT, MD, or ZIP. Up to 5 uploads, 10 MB each.</small>
          </label>
          <input className="file-input" id="evidence-files" type="file" accept=".pdf,.docx,.txt,.md,.zip" multiple disabled={isSubmitting} onChange={addFiles} />
          {uploadedFiles.length > 0 && <ul className="file-list" aria-label="Selected evidence files">
            {uploadedFiles.map((file) => <li key={fileKey(file)}><FileText aria-hidden="true" /><span>{file.name}</span><small>{Math.ceil(file.size / 1024)} KB</small><button type="button" disabled={isSubmitting} onClick={() => removeFile(file)} aria-label={`Remove ${file.name}`}><X aria-hidden="true" /></button></li>)}
          </ul>}
          {uploadedFiles.length > 0 && previewStatus === "ready" && preview && (
            <p className="field-note">{preview.artifact_count} document(s) detected, {preview.extracted_characters.toLocaleString()} characters extracted.</p>
          )}
          <label className="deidentify-confirmation" htmlFor="deidentified-confirmation">
            <input id="deidentified-confirmation" type="checkbox" disabled={isSubmitting} checked={deidentifiedConfirmed} onChange={(event) => setDeidentifiedConfirmed(event.target.checked)} />
            <span>I confirm these files contain no PHI/ePHI, patient identifiers, secrets, or raw production logs.</span>
          </label>
          <button className="primary-action" type="submit" disabled={isSubmitting || (uploadedFiles.length > 0 && previewStatus !== "ready")}>
            <Send aria-hidden="true" />{isSubmitting ? "Assessing evidence…" : "Run assessment"}
          </button>
        </form>
      )}
      {!isOpen && <div className="empty-state"><Lock aria-hidden="true" /><p>This case is closed. Reopen it to add more evidence.</p></div>}

      {activeRun?.status === "RUNNING" && (
        <section className="assessment-progress" role="status" aria-live="polite">
          <div className="progress-heading"><div><p className="eyebrow">RUN IN PROGRESS</p><h2>{activeRun.phase}</h2></div><strong>{progress}%</strong></div>
          <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
        </section>
      )}

      {caseDetail.evidence.length > 0 && (
        <section className="panel evidence-panel">
          <div className="panel-heading"><div><h2>Evidence on file</h2><p>Persisted for this case and reused as context on every future run.</p></div></div>
          <ul className="file-list">
            {caseDetail.evidence.map((document) => (
              <li key={document.id}><FileText aria-hidden="true" /><span>{document.file_name}</span><small>{Math.ceil(document.size_bytes / 1024)} KB</small></li>
            ))}
          </ul>
        </section>
      )}

      <section className="results-section">
        <div className="results-heading"><div><p className="eyebrow">CONTROL CATALOG</p><h2>Current status</h2></div></div>
        <div className="results-domains">
          {catalogGroups.map(([domain, standards]) => (
            <section className="results-domain" key={domain}>
              <div className="results-domain-heading"><h3>{domain}</h3></div>
              {standards.map(([standard, standardControls]) => (
                <section className="results-standard" key={standard}>
                  <h4>{standard}</h4>
                  <div className="results-list">
                    {standardControls.map((control) => {
                      const state = stateByControlId.get(control.control_id);
                      const status = state?.status ?? null;
                      return (
                        <article className="result-row" key={control.control_id}>
                          <div>
                            <span className={`result-status ${(status ?? "not_evaluated").toLowerCase()}`}>{statusLabel(status)}</span>
                            <h3>{control.title}</h3>
                            {state?.summary && <p>{state.summary}</p>}
                            {status === "FULLY_COVERED" && <p className="human-review-note">Locked in — skipped on future runs.</p>}
                          </div>
                          <div className="result-detail">
                            <strong>Evidence</strong>
                            {state?.evidence.length ? state.evidence.map((citation) => (
                              <div className="evidence-citation" key={`${citation.artifact_name}-${citation.excerpt}`}>
                                <cite>{citation.artifact_name}</cite>
                                <span className="evidence-location">{citation.source_location}</span>
                                <blockquote>{citation.excerpt}</blockquote>
                              </div>
                            )) : <p>None yet.</p>}
                            {state?.missing_evidence.length ? (
                              <div className="evidence-gap has-gaps"><strong>Evidence gaps</strong><p>{state.missing_evidence.join(", ")}</p></div>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </section>
          ))}
        </div>
      </section>

      {caseDetail.runs.length > 0 && (
        <section className="panel run-history-panel">
          <div className="panel-heading"><div><h2>Run history</h2></div></div>
          <ul className="run-history-list">
            {caseDetail.runs.map((run) => (
              <li key={run.id}>
                <span className={`result-status ${run.status.toLowerCase()}`}>{run.status}</span>
                <span>{new Date(run.created_at).toLocaleString()}</span>
                <span>{run.control_ids.length} control{run.control_ids.length === 1 ? "" : "s"} evaluated</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
