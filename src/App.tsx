import { useState } from "react";
import { ClipboardCheck, LockKeyhole, ShieldCheck } from "lucide-react";
import CaseList from "./components/CaseList";
import CaseDetailView from "./components/CaseDetailView";

type View = { name: "cases" } | { name: "case-detail"; caseId: string };

export default function App() {
  const [view, setView] = useState<View>({ name: "cases" });

  return (
    <main className="app-shell">
      <aside className="rail" aria-label="Application navigation">
        <div className="brand-mark"><ShieldCheck aria-hidden="true" /><span>CONTROL<br />ROOM</span></div>
        <nav>
          <a
            className={`nav-link ${view.name === "cases" ? "active" : ""}`}
            href="#cases"
            onClick={(event) => { event.preventDefault(); setView({ name: "cases" }); }}
          >
            <ClipboardCheck aria-hidden="true" />Cases
          </a>
        </nav>
        <p className="rail-note"><LockKeyhole aria-hidden="true" />Use de-identified evidence only.</p>
      </aside>

      {view.name === "cases"
        ? <CaseList onOpenCase={(caseId) => setView({ name: "case-detail", caseId })} />
        : <CaseDetailView caseId={view.caseId} onBack={() => setView({ name: "cases" })} />}
    </main>
  );
}
