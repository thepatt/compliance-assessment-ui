import { FormEvent, useEffect, useState } from "react";
import { ClipboardCheck, LoaderCircle, Plus } from "lucide-react";
import { createCase, listCases } from "../api";
import type { CaseSummary } from "../types";

// Only HIPAA has a seeded catalog today. ISO/HITRUST are shown so the
// roadmap is visible, but disabled until a published catalog exists for them.
const FRAMEWORK_OPTIONS = [
  { code: "HIPAA", name: "HIPAA Security Rule", disabled: false },
  { code: "ISO27001", name: "ISO/IEC 27001", disabled: true },
  { code: "HITRUST", name: "HITRUST CSF", disabled: true },
];

type Props = {
  onOpenCase: (caseId: string) => void;
};

export default function CaseList({ onOpenCase }: Props) {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [name, setName] = useState("");
  const [frameworkCode, setFrameworkCode] = useState("HIPAA");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  function refresh() {
    listCases()
      .then(setCases)
      .catch((loadError: Error) => setError(loadError.message));
  }

  useEffect(refresh, []);

  async function submitNewCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Add a case name.");
      return;
    }
    setIsCreating(true);
    try {
      const created = await createCase({ name: name.trim(), frameworkCode });
      setName("");
      onOpenCase(created.case_id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "The case could not be created.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section className="workspace">
      <header className="page-header">
        <div>
          <p className="eyebrow">COMPLIANCE ASSESSMENT</p>
          <h1>Cases</h1>
        </div>
      </header>

      {error && <div className="alert" role="alert">{error}</div>}

      <form className="panel intake-panel new-case-form" onSubmit={submitNewCase}>
        <div className="panel-heading"><div><h2>New case</h2><p>A case can be revisited and reassessed until you close it.</p></div></div>
        <label htmlFor="case-name">Case name</label>
        <input id="case-name" value={name} disabled={isCreating} onChange={(event) => setName(event.target.value)} placeholder="Q1 2026 HIPAA readiness review" />
        <label htmlFor="case-framework">Framework</label>
        <select id="case-framework" value={frameworkCode} disabled={isCreating} onChange={(event) => setFrameworkCode(event.target.value)}>
          {FRAMEWORK_OPTIONS.map((option) => (
            <option key={option.code} value={option.code} disabled={option.disabled}>
              {option.name}{option.disabled ? " — coming soon" : ""}
            </option>
          ))}
        </select>
        <button className="primary-action" type="submit" disabled={isCreating}>
          <Plus aria-hidden="true" />{isCreating ? "Creating…" : "Create case"}
        </button>
      </form>

      <section className="results-section">
        <div className="results-heading"><div><p className="eyebrow">ALL CASES</p><h2>Case list</h2></div></div>
        {cases === null && <div className="empty-state"><LoaderCircle aria-hidden="true" /><p>Loading cases…</p></div>}
        {cases?.length === 0 && <div className="empty-state"><ClipboardCheck aria-hidden="true" /><p>No cases yet. Create one above to get started.</p></div>}
        {cases && cases.length > 0 && (
          <div className="case-grid">
            {cases.map((item) => (
              <button type="button" className="case-card" key={item.case_id} onClick={() => onOpenCase(item.case_id)}>
                <div className="case-card-heading">
                  <span>{item.name}</span>
                  <span className={`case-status ${item.status.toLowerCase()}`}>{item.status}</span>
                </div>
                <p className="eyebrow">{item.framework_code} · v{item.framework_version_number}</p>
                <div className="coverage-bar"><span style={{ width: `${item.coverage_percent}%` }} /></div>
                <small>{item.coverage_percent}% fully covered · updated {new Date(item.updated_at).toLocaleDateString()}</small>
              </button>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
