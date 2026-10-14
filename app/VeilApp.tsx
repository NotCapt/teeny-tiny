"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Fingerprint,
  Globe2,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { COVERAGE, OverviewHero, Workflow } from "./WorkspaceOverview";
import type {
  Finding,
  RequestPayload,
  Scan,
  SessionInfo,
  Subject,
} from "../shared/types";

const SOURCES: Record<
  string,
  { name: string; caption: string; icon: typeof Globe2 }
> = {
  google: {
    name: "Google",
    caption: "Name search · Browser agent",
    icon: Search,
  },
  web: {
    name: "Public web",
    caption: "Search engines & websites",
    icon: Globe2,
  },
  scribd: { name: "Scribd", caption: "Public documents", icon: FileText },
  easyleadz: {
    name: "EasyLeadz",
    caption: "Professional contact data",
    icon: BookOpen,
  },
  hibp: {
    name: "Have I Been Pwned",
    caption: "Historical data breaches",
    icon: ShieldCheck,
  },
  demo: {
    name: "Demo directory",
    caption: "Synthetic exposure fixture",
    icon: Globe2,
  },
};
const LABELS: Record<string, string> = {
  complete: "Scan complete",
  partial: "Partial coverage",
  possible: "Needs confirmation",
  confirmed: "Confirmed match",
  dismissed: "Dismissed",
  none: "No request",
  prepared: "Ready for review",
  submitting: "Agent working",
  submitted: "Request submitted",
  action_required: "Your action needed",
  unknown: "Outcome uncertain",
  failed: "Request failed",
  unchecked: "Not checked",
  visible: "Still visible",
  not_observed: "Not observed",
  unavailable: "Page unavailable",
  unable_to_verify: "Unable to verify",
  skipped: "Demo skipped",
  waiting: "Not checked",
  running: "Checking",
  checked: "Checked",
  incomplete: "Incomplete",
  blocked: "Blocked",
  not_configured: "Not configured",
};
const emptySubject: Subject = {
  name: "",
  email: "",
  phone: "",
  employer: "",
  location: "",
  linkedin: "",
  knownUrl: "",
};
function date(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function Badge({ value }: { value: string }) {
  return (
    <span className={`badge ${value}`}>
      <span className="status-dot" />
      {LABELS[value] || value}
    </span>
  );
}
function useDialog(onClose: () => void) {
  const ref = useRef<HTMLElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]',
        ) || [],
      ).filter((el) => el.getClientRects().length > 0);
    (focusable()[0] || ref.current)?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items.at(-1);
        if (!first) {
          event.preventDefault();
          ref.current?.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return ref;
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useDialog(onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={ref}
        tabIndex={-1}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        {children}
      </section>
    </div>
  );
}

export default function VeilApp() {
  const [session, setSession] = useState<SessionInfo | null>(null),
    [scans, setScans] = useState<Scan[]>([]),
    [scanId, setScanId] = useState<string>(),
    [selectedId, setSelectedId] = useState<string>();
  const [section, setSection] = useState("Overview"),
    [filter, setFilter] = useState("all"),
    [modal, setModal] = useState<"intake" | "demo" | "help" | null>(null);
  const [subject, setSubject] = useState<Subject>(emptySubject),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const [query, setQuery] = useState(""),
    [reviewFilter, setReviewFilter] = useState("all");
  const scan = scans.find((s) => s.id === scanId) || scans[0],
    selected = scan?.findings.find((f) => f.id === selectedId);
  const updateScan = (s: Scan) => {
    setScanId(s.id);
    setScans((current) => [s, ...current.filter((x) => x.id !== s.id)]);
  };
  useEffect(() => {
    void fetch("/api/session")
      .then(async (r) => {
        const d = (await r.json()) as SessionInfo & Scan & { error?: string };
        if (!r.ok) throw new Error(d.error);
        setSession(d);
        setScans(d.scans);
        setScanId(d.scans[0]?.id);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  const active =
    scan?.status === "running" ||
    scan?.findings.some((f) => f.requestStatus === "submitting");
  useEffect(() => {
    if (!scan || busy || !active) return;
    const id = scan.id;
    const t = setInterval(() => {
      void fetch(`/api/scans/${id}`)
        .then(async (r) => {
          if (r.ok) updateScan(await r.json());
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, [scan?.id, busy, active]);
  async function streamed(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const d = (await response.json()) as { error?: string };
      throw new Error(d.error || "The operation could not start.");
    }
    if (!response.headers.get("content-type")?.includes("text/event-stream")) {
      updateScan(await response.json());
      return;
    }
    const reader = response.body!.getReader(),
      decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const messages = buffer.split("\n\n");
      buffer = messages.pop() || "";
      for (const msg of messages) {
        const line = msg.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const d = JSON.parse(line.slice(6));
        if (d.error) throw new Error(d.error);
        updateScan(d);
      }
    }
  }
  async function startScan(demo: boolean) {
    setError("");
    setBusy("scan");
    setModal(null);
    setSelectedId(undefined);
    setSection("Overview");
    setFilter("all");
    setQuery("");
    setReviewFilter("all");
    try {
      await streamed("/api/scans", {
        demo,
        consent: true,
        ...(!demo ? { subject } : {}),
      });
      setToast("Scan saved. Review the evidence before taking action.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The scan could not finish.");
    } finally {
      setBusy("");
    }
  }
  async function action(kind: string, data: unknown = {}) {
    if (!selected || !scan) return;
    setError("");
    setBusy(kind);
    try {
      const url = `/api/cases/${scan.id}/${selected.id}/${kind}`;
      if (kind === "submit") await streamed(url, data);
      else {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const d = (await r.json()) as SessionInfo & Scan & { error?: string };
        if (!r.ok) throw new Error(d.error);
        updateScan(d);
      }
      if (kind === "verify") setToast("Fresh browser observation saved.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This action could not finish.",
      );
    } finally {
      setBusy("");
    }
  }
  async function clearData() {
    if (
      !window.confirm(
        "Delete your saved scans, requests and evidence? Active operations must finish first.",
      )
    )
      return;
    setBusy("clear");
    try {
      const r = await fetch("/api/session/data", { method: "DELETE" });
      const d = (await r.json()) as SessionInfo & Scan & { error?: string };
      if (!r.ok) throw new Error(d.error);
      setScans([]);
      setScanId(undefined);
      setSelectedId(undefined);
      setToast("Your saved data has been cleared.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear data.");
    } finally {
      setBusy("");
    }
  }
  function download() {
    if (!scan) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(scan, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `veil-report-${scan.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const findings = scan?.findings || [],
    isWorking = !!busy || !!active;
  const hasFilters =
    filter !== "all" || !!query.trim() || reviewFilter !== "all";
  function navigate(next: string) {
    setSection(next);
    setSelectedId(undefined);
    setFilter("all");
    setQuery("");
    setReviewFilter("all");
  }
  const displayed = findings.filter(
    (f) =>
      (filter === "all" ||
        (filter === "google"
          ? f.discoveredVia === "google"
          : f.source === filter)) &&
      (section !== "Removal requests" || f.requestStatus !== "none") &&
      (reviewFilter === "all" || f.matchStatus === reviewFilter) &&
      [f.title, f.sourceUrl, f.evidence, ...f.exposedFields]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const activities = findings
    .flatMap((f) =>
      f.timeline.map((event) => ({ ...event, caseId: f.id, source: f.source })),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-main">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Veil home">
          <span className="brand-mark">
            <Fingerprint size={29} />
          </span>
          <span>
            veil<span className="brand-period">.</span>
          </span>
        </a>
        <div className="workspace-label">YOUR PRIVACY WORKSPACE</div>
        <nav aria-label="Workspace">
          {[
            { name: "Overview", icon: LayoutDashboard },
            { name: "My exposures", icon: Eye },
            { name: "Removal requests", icon: ArrowUpRight },
            { name: "Activity", icon: Clock3 },
          ].map((item) => (
            <button
              key={item.name}
              title={item.name}
              aria-current={section === item.name ? "page" : undefined}
              className={`nav-item ${section === item.name ? "active" : ""}`}
              onClick={() => navigate(item.name)}
            >
              <item.icon size={19} />
              <span>{item.name}</span>
              {item.name === "My exposures" && findings.length > 0 && (
                <span className="nav-count">{findings.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="sidebar-note-label">
            <ShieldCheck size={17} /> HUMAN IN CONTROL
          </span>
          <strong>
            Your data.
            <br />
            Your decision.
          </strong>
          <p>
            Review every match.
            <br />
            Approve every request.
            <br />
            Keep the evidence.
          </p>
          <button onClick={() => setModal("help")}>
            Meet your privacy agent <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setModal("help")}>
            <CircleHelp size={18} />
            <span>How Veil works</span>
            <ArrowUpRight size={14} />
          </button>
          <div className="profile">
            <div className="avatar">
              {session?.signedIn
                ? (session.name || "You").charAt(0).toUpperCase()
                : "V"}
            </div>
            <div>
              <strong>
                {session?.signedIn
                  ? (session.name || "Your workspace").split("@")[0]
                  : "Personal workspace"}
              </strong>
              <a
                href={
                  session?.signedIn
                    ? "/signout-with-chatgpt?return_to=/"
                    : "/signin-with-chatgpt?return_to=/"
                }
                target="_top"
              >
                {session?.signedIn
                  ? "Sign out"
                  : "Sign in to save personal cases"}
              </a>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="mobile-brand">veil.</span>
            <span className="desktop-crumb">Workspace</span>
            <ChevronRight size={14} />
            <strong>{section}</strong>
          </div>
          <div className="topbar-right">
            <span className="service-pill">
              <span
                className={`live-dot ${session?.configured ? "" : "offline"}`}
              />
              {session?.configured
                ? "TinyFish connected"
                : session
                  ? "TinyFish not configured"
                  : "Connecting…"}
            </span>
            <a
              className="account-link"
              href={
                session?.signedIn
                  ? "/signout-with-chatgpt?return_to=/"
                  : "/signin-with-chatgpt?return_to=/"
              }
              target="_top"
            >
              {session?.signedIn ? "Sign out" : "Sign in"}
            </a>
            <button
              className="icon-button"
              onClick={() => setModal("help")}
              aria-label="Help"
            >
              <CircleHelp size={19} />
            </button>
          </div>
        </header>
        <main id="workspace-main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">DISCOVER / REVIEW / ACT / VERIFY</div>
              <h1>
                {section === "Overview"
                  ? "Your privacy, in focus."
                  : section === "My exposures"
                    ? "Every trace. All the evidence."
                    : section === "Removal requests"
                      ? "From exposure to action."
                      : "A record of every step."}
              </h1>
              <p>
                {section === "Overview"
                  ? "Find what’s public. Decide what stays. See what changed."
                  : section === "My exposures"
                    ? "Explore matching pages, understand the context, and confirm what belongs to you."
                    : section === "Removal requests"
                      ? "Review requests, follow agent progress, and check the outcome separately."
                      : "Your scans, decisions, requests and browser observations, in one evidence trail."}
              </p>
            </div>
            <button
              className="button primary"
              onClick={() => setModal("intake")}
              disabled={isWorking}
            >
              <Plus size={18} />
              New privacy scan
            </button>
          </div>
          <nav className="mobile-nav" aria-label="Mobile workspace">
            {["Overview", "My exposures", "Removal requests", "Activity"].map(
              (n) => (
                <button
                  aria-current={section === n ? "page" : undefined}
                  className={section === n ? "selected" : ""}
                  key={n}
                  onClick={() => navigate(n)}
                >
                  {n}
                </button>
              ),
            )}
          </nav>
          {error && (
            <div className="alert" role="alert">
              <CircleHelp size={18} />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {scan?.demo && (
            <div className="demo-banner">
              <Sparkles size={18} />
              <div>
                <strong>Live demo · Invented identity</strong>
                <span>
                  Alex Morgan’s listing is a controlled fixture. TinyFish checks
                  the synthetic email on the HIBP website. No broker findings
                  are fabricated.
                </span>
              </div>
            </div>
          )}
          {section === "Overview" && (
            <OverviewHero
              scan={scan}
              working={isWorking}
              signedIn={!!session?.signedIn}
              onStart={() => setModal(session?.signedIn ? "intake" : "demo")}
              onHelp={() => setModal("help")}
            />
          )}
          {section === "Overview" && (
            <Workflow scan={scan} onNavigate={navigate} />
          )}
          {scan && (
            <section className="scan-context" aria-label="Current scan">
              <div className="scan-identity">
                <div className="avatar">
                  <Fingerprint size={21} />
                </div>
                <div>
                  <span className="eyebrow">CURRENT SCAN</span>
                  <strong>{scan.subject.name}</strong>
                  <small>
                    {scan.subject.email} · {date(scan.createdAt)}
                  </small>
                </div>
              </div>
              <div className="scan-context-tools">
                {scans.length > 1 && (
                  <select
                    aria-label="Select scan"
                    value={scan.id}
                    onChange={(e) => {
                      setScanId(e.target.value);
                      setSelectedId(undefined);
                      setQuery("");
                      setFilter("all");
                      setReviewFilter("all");
                    }}
                  >
                    {scans.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subject.name} · {date(s.createdAt)}
                      </option>
                    ))}
                  </select>
                )}
                <Badge value={scan.status} />
              </div>
              {scan.status !== "running" && (
                <p>
                  {scan.status === "partial"
                    ? "Some checks could not finish. Review source coverage on Overview to see the gaps."
                    : "This scan is complete. Review source coverage and confirm each match before taking action."}
                </p>
              )}
            </section>
          )}
          {section === "Overview" && (
            <section className="sources-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">WHERE WE LOOK</span>
                  <h2>Five checks. One clear picture.</h2>
                  <p>
                    See what each source contributes, how it is checked, and
                    where a check stopped.
                  </p>
                </div>
                <span className="powered-label">
                  <Zap size={14} /> POWERED BY TINYFISH
                </span>
              </div>
              <div className="sources-grid">
                {COVERAGE.map((source) => {
                  const check = scan?.checks.find(
                    (c) => c.source === source.id,
                  );
                  return (
                    <article className="source-card" key={source.id}>
                      <div className="source-top">
                        <div className={`source-logo ${source.id}`}>
                          <source.icon size={22} />
                        </div>
                        <span className="source-tool">{source.tool}</span>
                      </div>
                      <h3>{source.name}</h3>
                      <p className="source-caption">{source.label}</p>
                      <Badge value={check?.status || "waiting"} />
                      <details
                        className="source-explainer"
                        open={
                          check &&
                          [
                            "running",
                            "blocked",
                            "incomplete",
                            "not_configured",
                          ].includes(check.status)
                            ? true
                            : undefined
                        }
                      >
                        <summary>
                          {check ? "Check details" : "What gets checked"}
                        </summary>
                        <p>{source.detail}</p>
                        {check && (
                          <div className="source-detail">{check.detail}</div>
                        )}
                        {source.id === "hibp" && scan?.demo && (
                          <p>
                            Synthetic demo email. These are not your personal
                            breach results.
                          </p>
                        )}
                      </details>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          {section !== "Activity" ? (
            <section className="findings-section">
              <div className="section-heading">
                <div>
                  <div className="heading-inline">
                    <h2>
                      {section === "Removal requests"
                        ? "Your removal cases"
                        : "Your exposures"}
                    </h2>
                    <span className="count-pill">{displayed.length}</span>
                  </div>
                  <p>
                    {section === "Removal requests"
                      ? "A submitted request and a removed page are tracked as separate outcomes."
                      : "Potential matches are evidence to review, not confirmed identities."}
                  </p>
                </div>
                <button
                  className="button secondary small"
                  onClick={download}
                  disabled={!scan}
                >
                  <Download size={15} />
                  Export report
                </button>
              </div>
              <div className="table-toolbar">
                <div className="filter-tabs" aria-label="Filter by source">
                  {[
                    { id: "all", name: "All sources" },
                    { id: "google", name: "Google" },
                    { id: "web", name: "Public web" },
                    { id: "scribd", name: "Scribd" },
                    { id: "easyleadz", name: "EasyLeadz" },
                    ...(scan?.demo ? [{ id: "demo", name: "Demo" }] : []),
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      aria-pressed={filter === tab.id}
                      className={filter === tab.id ? "selected" : ""}
                      onClick={() => setFilter(tab.id)}
                    >
                      {tab.name}
                    </button>
                  ))}
                </div>
                <div className="result-controls">
                  <label className="result-search">
                    <Search size={16} />
                    <input
                      aria-label="Search evidence"
                      placeholder="Search titles, URLs or evidence"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        aria-label="Clear search"
                        onClick={() => setQuery("")}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </label>
                  <label className="review-filter">
                    <ListFilter size={16} />
                    <select
                      aria-label="Filter by review status"
                      value={reviewFilter}
                      onChange={(e) => setReviewFilter(e.target.value)}
                    >
                      <option value="all">All review states</option>
                      <option value="possible">Needs confirmation</option>
                      <option value="confirmed">Confirmed matches</option>
                      <option value="dismissed">Dismissed</option>
                    </select>
                  </label>
                </div>
              </div>
              {displayed.length ? (
                <div className="findings-list">
                  <div className="table-head">
                    <span>SOURCE & MATCHING EVIDENCE</span>
                    <span>INFORMATION FOUND</span>
                    <span>CASE STATUS</span>
                    <span />
                  </div>
                  {displayed.map((f) => (
                    <button
                      className="finding-row"
                      key={f.id}
                      onClick={() => setSelectedId(f.id)}
                    >
                      <div className="finding-main">
                        <span className={`finding-icon ${f.source}`}>
                          <FileText size={20} />
                        </span>
                        <div>
                          <strong>{f.title}</strong>
                          <p>
                            {f.discoveredVia === "google"
                              ? "Google → " + SOURCES[f.source].name
                              : SOURCES[f.source].name}{" "}
                            <span>·</span> {date(f.checkedAt)}
                          </p>
                          <span className="finding-excerpt">{f.evidence}</span>
                          <span className="evidence-type">
                            {f.evidenceOrigin === "search_result"
                              ? "Search snippet · destination not yet verified"
                              : "Page evidence"}
                            {f.destinationPending
                              ? " · Destination pending"
                              : ""}
                          </span>
                        </div>
                      </div>
                      <div className="field-tags">
                        {f.exposedFields.map((field) => (
                          <span key={field}>{field}</span>
                        ))}
                      </div>
                      <div className="row-status">
                        <Badge value={f.matchStatus} />
                        {f.requestStatus !== "none" && (
                          <Badge value={f.requestStatus} />
                        )}
                        <span>
                          {f.observation === "unchecked"
                            ? "No browser recheck yet"
                            : LABELS[f.observation]}
                        </span>
                      </div>
                      <ArrowUpRight size={18} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">
                    {isWorking ? (
                      <LoaderCircle className="spin" size={27} />
                    ) : (
                      <Search size={27} />
                    )}
                  </div>
                  <h3>
                    {isWorking
                      ? "Following your digital trail…"
                      : hasFilters
                        ? "No cases match these filters."
                        : section === "Removal requests"
                          ? "Your next action starts with a match."
                          : scan
                            ? "No matching public page observed."
                            : "Your footprint starts with a first look."}
                  </h3>
                  <p>
                    {isWorking
                      ? "TinyFish is checking sources and collecting evidence. Findings appear here as the scan progresses; the coverage cards show any gaps."
                      : hasFilters
                        ? "Try another source or review state, or clear the search to see all cases."
                        : section === "Removal requests"
                          ? "Open an exposure, confirm that the information belongs to you, then prepare and review a removal request."
                          : scan
                            ? "A bounded scan cannot prove absence everywhere. Review source coverage on Overview, or add a known exposure URL to a new scan."
                            : "Run a personal scan after signing in, or follow an invented identity through a real TinyFish discovery, removal and browser recheck."}
                  </p>
                  {hasFilters ? (
                    <button
                      className="button secondary"
                      onClick={() => {
                        setFilter("all");
                        setQuery("");
                        setReviewFilter("all");
                      }}
                    >
                      Clear filters
                    </button>
                  ) : section === "Removal requests" ? (
                    <button
                      className="text-button accent"
                      onClick={() => navigate("My exposures")}
                    >
                      Review your exposures <ArrowRight size={16} />
                    </button>
                  ) : !scan && !isWorking ? (
                    <button
                      className="button secondary"
                      onClick={() => setModal("demo")}
                    >
                      Explore the live demo <ArrowRight size={16} />
                    </button>
                  ) : null}
                </div>
              )}
            </section>
          ) : (
            <section className="activity-panel">
              <div className="section-heading">
                <div>
                  <h2>The evidence trail</h2>
                  <p>
                    Every recorded event stays attached to its case. Open an
                    event for the full context.
                  </p>
                </div>
                <span className="count-pill">{activities.length} events</span>
              </div>
              {activities.length ? (
                activities.map((event, i) => (
                  <button
                    className="activity-row"
                    key={`${event.at}-${i}`}
                    onClick={() => setSelectedId(event.caseId)}
                  >
                    <span className="timeline-dot">
                      <Check size={13} />
                    </span>
                    <div>
                      <strong>{event.title}</strong>
                      <p>{event.detail}</p>
                      <small>
                        {SOURCES[event.source].name} · {date(event.at)}
                      </small>
                    </div>
                    <ArrowUpRight size={17} />
                  </button>
                ))
              ) : (
                <div className="empty-state">
                  <Clock3 size={28} />
                  <h3>A clean slate.</h3>
                  <p>
                    Your first scan begins the timeline. Decisions, requests and
                    fresh observations will appear here.
                  </p>
                </div>
              )}
            </section>
          )}
          {!!scan?.breaches.length && (
            <section className="breach-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">ACCOUNT SECURITY</span>
                  <h2>Historical breach exposure</h2>
                  <p>
                    Read what was exposed and take action on the affected
                    accounts.
                  </p>
                </div>
                <a
                  href="https://haveibeenpwned.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Have I Been Pwned <ExternalLink size={14} />
                </a>
              </div>
              {scan.hibpMode === "demo_browser" && (
                <p className="breach-note">
                  Website results for the synthetic demo email, not your
                  personal email.
                </p>
              )}
              {scan.hibpMode === "test" && (
                <p className="breach-note">
                  Saved legacy integration-test results. Start a new scan to
                  check the HIBP website using TinyFish Agent.
                </p>
              )}
              <div className="breach-grid">
                {scan.breaches.map((breach, i) => (
                  <article className="breach-card" key={`${breach.name}-${i}`}>
                    <div>
                      <Shield size={20} />
                      <h3>{breach.name}</h3>
                      <small>{breach.date}</small>
                    </div>
                    <div className="field-tags">
                      {breach.fields.map((field) => (
                        <span key={field}>{field}</span>
                      ))}
                    </div>
                    {breach.description && (
                      <details>
                        <summary>Read breach details</summary>
                        <p>{breach.description}</p>
                      </details>
                    )}
                    <p>
                      Review affected account passwords and enable two-factor
                      authentication. Historical breaches cannot be undone
                      through a removal request.
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}
          <footer className="page-footer">
            <span>
              <Fingerprint size={17} /> Your footprint. Your next move.
            </span>
            <div>
              <button onClick={() => setModal("demo")} disabled={isWorking}>
                Try live demo
              </button>
              <span>Built with TinyFish</span>
              <button
                onClick={() => void clearData()}
                disabled={isWorking || !scans.length}
              >
                <Trash2 size={14} />
                Clear my data
              </button>
            </div>
          </footer>
        </main>
      </div>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <CheckCheck size={18} />
          {toast}
        </div>
      )}
      {modal === "intake" && (
        <Modal title="New privacy scan" onClose={() => setModal(null)}>
          <div className="modal-symbol">
            <Fingerprint size={28} />
          </div>
          <span className="eyebrow">A LITTLE CLARITY STARTS HERE</span>
          <h2>Check your digital footprint.</h2>
          <p>
            Use details that belong to you, or someone who has authorized this
            check.
          </p>
          {!session?.signedIn ? (
            <div className="signin-panel">
              <LockKeyhole size={25} />
              <h3>Keep your personal scan private.</h3>
              <p>
                Sign in to create and access your own cases. Explore the public
                demo with invented details.
              </p>
              <a
                className="button primary"
                href="/signin-with-chatgpt?return_to=/"
                target="_top"
              >
                Sign in with ChatGPT <ArrowRight size={16} />
              </a>
              <button className="text-button" onClick={() => setModal("demo")}>
                Try the synthetic demo
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (consent) void startScan(false);
              }}
            >
              <div className="form-grid">
                {[
                  {
                    key: "name",
                    label: "Full name",
                    placeholder: "Your full name",
                    required: true,
                  },
                  {
                    key: "email",
                    label: "Email address",
                    placeholder: "you@example.com",
                    required: true,
                    type: "email",
                  },
                  {
                    key: "phone",
                    label: "Phone number",
                    placeholder: "Include country code",
                  },
                  {
                    key: "employer",
                    label: "Employer",
                    placeholder: "Company or organization",
                  },
                  {
                    key: "location",
                    label: "Location",
                    placeholder: "City or country",
                  },
                  {
                    key: "linkedin",
                    label: "LinkedIn profile",
                    placeholder: "https://linkedin.com/in/you",
                    type: "url",
                  },
                  {
                    key: "knownUrl",
                    label: "Known exposure URL",
                    placeholder: "A public page to inspect",
                    type: "url",
                    wide: true,
                  },
                ].map((field) => (
                  <label className={field.wide ? "wide" : ""} key={field.key}>
                    {field.label}
                    {!field.required && <span> optional</span>}
                    <input
                      type={field.type || "text"}
                      required={field.required}
                      placeholder={field.placeholder}
                      value={subject[field.key as keyof Subject] || ""}
                      onChange={(e) =>
                        setSubject({ ...subject, [field.key]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  I am the subject or an authorized representative. I agree to
                  send selected identifiers to TinyFish and the relevant
                  services for this check.
                </span>
              </label>
              <div className="modal-actions">
                <span>
                  <LockKeyhole size={13} /> Removal always needs approval.
                </span>
                <button
                  className="button primary"
                  type="submit"
                  disabled={!consent || isWorking}
                >
                  <Search size={16} />
                  Start privacy scan
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
      {modal === "demo" && (
        <Modal title="Live demo" onClose={() => setModal(null)}>
          <div className="modal-symbol">
            <Sparkles size={26} />
          </div>
          <span className="eyebrow">REAL TOOLS. INVENTED DETAILS.</span>
          <h2>Meet Alex. Reclaim a footprint.</h2>
          <p>
            Follow a synthetic contact listing through discovery, an approved
            TinyFish Agent removal, and a fresh remote Browser check.
          </p>
          <div className="demo-identity">
            <div className="avatar">AM</div>
            <div>
              <strong>Alex Morgan</strong>
              <span>alex.morgan@example.com · Northstar Studio</span>
            </div>
            <span className="tiny-tag">SYNTHETIC</span>
          </div>
          <div className="demo-steps">
            <span>
              <Search size={16} />
              Fetch evidence
            </span>
            <ChevronRight size={14} />
            <span>
              <Check size={16} />
              Approve action
            </span>
            <ChevronRight size={14} />
            <span>
              <Eye size={16} />
              Recheck
            </span>
          </div>
          <p className="small-note">
            The fixture is controlled demo content. HIBP is checked through its
            website using the synthetic demo email. No request is sent to a real
            broker. Agent and Browser actions use metered TinyFish services.
          </p>
          <button
            className="button primary full-width"
            onClick={() => void startScan(true)}
            disabled={isWorking || !session?.configured}
          >
            Start live demo <ArrowRight size={16} />
          </button>
        </Modal>
      )}
      {modal === "help" && (
        <Modal title="How Veil works" onClose={() => setModal(null)}>
          <div className="modal-symbol">
            <ShieldCheck size={27} />
          </div>
          <span className="eyebrow">CLARITY. CONTROL. EVIDENCE.</span>
          <h2>Privacy is a process.</h2>
          {[
            {
              step: "01",
              title: "Discover",
              text: "TinyFish Agent searches Google for your name, including profiles and public PDFs. Search snippets stay visible while Fetch checks destination pages.",
            },
            {
              step: "02",
              title: "Confirm",
              text: "You review each finding. A shared name alone never becomes a confirmed identity.",
            },
            {
              step: "03",
              title: "Take action",
              text: "Review the exact fields. TinyFish Agent submits supported forms after approval; other sources get a complaint draft and handoff.",
            },
            {
              step: "04",
              title: "Verify",
              text: "A fresh TinyFish Browser checks the saved page and captures evidence. Submitted and removed are different outcomes.",
            },
          ].map((item) => (
            <div className="help-step" key={item.step}>
              <span>{item.step}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </div>
          ))}
          <p className="small-note">
            Real scans require sign-in. Historical HIBP findings guide account
            security. Saved login profiles and scheduled monitoring are future
            features.
          </p>
          <button className="button primary" onClick={() => setModal(null)}>
            Got it <Check size={16} />
          </button>
        </Modal>
      )}
      {selected && scan && (
        <CasePanel
          finding={selected}
          scan={scan}
          busy={busy}
          error={error}
          action={action}
          onClose={() => setSelectedId(undefined)}
          notify={setToast}
        />
      )}
    </div>
  );
}

function CasePanel({
  finding: f,
  scan,
  busy,
  error,
  action,
  onClose,
  notify,
}: {
  finding: Finding;
  scan: Scan;
  busy: string;
  error: string;
  action: (kind: string, data?: unknown) => Promise<void>;
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const [payload, setPayload] = useState<RequestPayload | null>(
      f.payload || null,
    ),
    [approved, setApproved] = useState(false);
  useEffect(() => {
    setPayload(f.payload || null);
    setApproved(false);
  }, [f.id, f.requestStatus]);
  const dialogRef = useDialog(onClose);
  const automated = ["demo", "easyleadz"].includes(f.source);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        ref={dialogRef}
        tabIndex={-1}
        className="case-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Exposure case"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header">
          <span className="eyebrow">YOUR EXPOSURE CASE</span>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close case"
          >
            <X size={21} />
          </button>
        </div>
        <div className="drawer-content">
          <div className="case-source">
            <span className={`source-logo ${f.source}`}>
              <FileText size={20} />
            </span>
            {SOURCES[f.source].name}
            {f.source === "demo" && (
              <span className="tiny-tag">SYNTHETIC FIXTURE</span>
            )}
          </div>
          <h2>{f.title}</h2>
          <a
            className="source-link"
            href={f.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            {f.destinationPending ? "Open Google result" : "Open source page"}{" "}
            <ExternalLink size={13} />
          </a>
          <div className="case-statuses">
            <Badge value={f.matchStatus} />
            <Badge value={f.observation} />
            {f.requestStatus !== "none" && <Badge value={f.requestStatus} />}
          </div>
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          <section className="evidence-box">
            <div className="section-heading">
              <strong>
                {f.evidenceOrigin === "search_result"
                  ? "Search result evidence"
                  : "Matching page evidence"}
              </strong>
              <span>{date(f.checkedAt)}</span>
            </div>
            <blockquote>{f.evidence}</blockquote>
            <div className="field-tags">
              {f.exposedFields.map((field) => (
                <span key={field}>{field}</span>
              ))}
            </div>
            <p>{f.matchReason}</p>
            {f.discoveredVia === "google" && (
              <p>
                Found on Google{f.searchRank ? ` · result ${f.searchRank}` : ""}
                . {f.searchQuery && <>Query: {f.searchQuery}.</>}{" "}
                {f.evidenceOrigin === "search_result"
                  ? "This title/snippet is a candidate, not proof of what is currently visible on the destination."
                  : "The destination was also checked for matching content."}
              </p>
            )}
            {f.searchEvidence && f.evidenceOrigin === "page_content" && (
              <details>
                <summary>Original search result</summary>
                <blockquote>{f.searchEvidence}</blockquote>
              </details>
            )}
          </section>
          {f.matchStatus === "possible" && (
            <div className="confirm-box">
              <strong>Does this information belong to you?</strong>
              <p>
                Confirm the match before preparing a request or checking again.
              </p>
              <div>
                <button
                  className="button primary"
                  disabled={!!busy}
                  onClick={() => void action("confirm", { confirmed: true })}
                >
                  <Check size={15} />
                  {scan.demo ? "Confirm demo match" : "Yes, this is mine"}
                </button>
                <button
                  className="button secondary"
                  disabled={!!busy}
                  onClick={() => void action("confirm", { confirmed: false })}
                >
                  Dismiss match
                </button>
              </div>
            </div>
          )}
          {f.matchStatus === "confirmed" && (
            <>
              <div className="case-action-row">
                <button
                  className="button secondary"
                  disabled={!!busy}
                  onClick={() => void action("verify")}
                >
                  {busy === "verify" ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <Eye size={15} />
                  )}
                  Check again
                </button>
                {f.requestStatus === "none" && (
                  <button
                    className="button primary"
                    disabled={!!busy}
                    onClick={() => void action("prepare")}
                  >
                    <FileText size={15} />
                    Prepare request
                  </button>
                )}
              </div>
              {payload && f.requestStatus === "prepared" && (
                <section className="request-review">
                  <h3>Review your request.</h3>
                  <p>
                    Only these details will be used.{" "}
                    {f.source === "easyleadz"
                      ? "EasyLeadz retains your email on its opt-out list and will notify you after removal."
                      : f.source === "demo"
                        ? "This action only changes the synthetic fixture."
                        : "This source uses a manual reporting handoff."}
                  </p>
                  <a
                    className="destination"
                    href={payload.destination}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {f.source === "easyleadz"
                      ? "Official EasyLeadz removal form"
                      : f.source === "demo"
                        ? "Controlled demo removal form"
                        : "Reporting destination"}
                    <ExternalLink size={13} />
                  </a>
                  <div className="form-grid">
                    {[
                      { key: "name", label: "Full name" },
                      { key: "email", label: "Email address" },
                      { key: "phone", label: "Phone" },
                      { key: "linkedin", label: "LinkedIn URL" },
                    ].map((field) => (
                      <label key={field.key}>
                        {field.label}
                        <input
                          value={payload[field.key as keyof RequestPayload]}
                          readOnly={scan.demo}
                          onChange={(e) => {
                            setPayload({
                              ...payload,
                              [field.key]: e.target.value,
                            });
                            setApproved(false);
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  {!automated ? (
                    <>
                      <label className="draft-label">
                        Complaint draft
                        <textarea
                          rows={8}
                          value={payload.draft}
                          onChange={(e) =>
                            setPayload({ ...payload, draft: e.target.value })
                          }
                        />
                      </label>
                      <button
                        className="button secondary"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(payload.draft)
                            .then(() => notify("Complaint draft copied."))
                            .catch(() =>
                              notify("Select the draft and copy it manually."),
                            );
                        }}
                      >
                        Copy complaint draft
                      </button>
                      <a
                        className="button primary"
                        href={payload.destination}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open reporting route <ExternalLink size={14} />
                      </a>
                    </>
                  ) : (
                    <>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={approved}
                          onChange={(e) => setApproved(e.target.checked)}
                        />
                        <span>
                          I reviewed these fields and authorize one removal
                          request. Submission does not prove removal. TinyFish
                          Agent usage is metered.
                        </span>
                      </label>
                      <button
                        className="button primary full-width"
                        disabled={!approved || !!busy}
                        onClick={() =>
                          void action("submit", { approved: true, payload })
                        }
                      >
                        <Zap size={16} />
                        Approve and submit
                      </button>
                    </>
                  )}
                </section>
              )}
              {f.requestStatus === "submitting" && (
                <section className="agent-preview">
                  <div className="section-heading">
                    <strong>
                      <span className="live-dot" />
                      TinyFish agent is working
                    </strong>
                    <button
                      className="text-button"
                      disabled={!f.runId || busy === "cancel"}
                      onClick={() => void action("cancel")}
                    >
                      Cancel run
                    </button>
                  </div>
                  {f.streamingUrl ? (
                    <iframe
                      src={f.streamingUrl}
                      title="Live TinyFish browser preview"
                    />
                  ) : (
                    <div className="preview-loading">
                      <LoaderCircle className="spin" size={24} />
                      <p>Connecting to the live browser…</p>
                    </div>
                  )}
                  <p>
                    Read-only live view. Requests stop for verification
                    challenges.
                  </p>
                </section>
              )}
              {f.confirmation && (
                <div className="success-box">
                  <CheckCheck size={22} />
                  <div>
                    <strong>Submission confirmed</strong>
                    <p>{f.confirmation}</p>
                    <small>
                      Track page visibility separately from the request.
                    </small>
                  </div>
                </div>
              )}
              {f.blocker && (
                <div className="case-blocker">
                  <CircleHelp size={17} />
                  <p>{f.blocker}</p>
                </div>
              )}
              {f.runId &&
                ["unknown", "action_required", "submitting"].includes(
                  f.requestStatus,
                ) && (
                  <button
                    className="button secondary"
                    disabled={!!busy}
                    onClick={() => void action("reconcile")}
                  >
                    <Clock3 size={15} />
                    Check existing run
                  </button>
                )}
              {f.browserSessionId && (
                <button
                  className="button secondary"
                  disabled={!!busy}
                  onClick={() => void action("cleanup")}
                >
                  Retry browser cleanup
                </button>
              )}
              {f.screenshotId && (
                <section className="screenshot-panel">
                  <h3>Latest browser evidence</h3>
                  <a
                    href={`/api/cases/${scan.id}/${f.id}/screenshot`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      src={`/api/cases/${scan.id}/${f.id}/screenshot`}
                      alt="Screenshot captured during the latest verification"
                    />
                  </a>
                </section>
              )}
            </>
          )}
          <section className="case-timeline">
            <h3>Case timeline</h3>
            {[...f.timeline].reverse().map((event, i) => (
              <div className="timeline-item" key={`${event.at}-${i}`}>
                <span className="timeline-dot">
                  <Check size={10} />
                </span>
                <div>
                  <strong>{event.title}</strong>
                  <p>{event.detail}</p>
                  <small>{date(event.at)}</small>
                </div>
              </div>
            ))}
          </section>
          <p className="precision-note">
            <Shield size={13} /> An observation applies to the checked page and
            time. It does not prove every copy has been deleted.
          </p>
        </div>
      </aside>
    </div>
  );
}
