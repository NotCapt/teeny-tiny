import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  FileText,
  Fingerprint,
  Globe2,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Scan } from "../shared/types";

export const COVERAGE = [
  {
    id: "google",
    name: "Google",
    icon: Search,
    label: "Profiles, results & public PDFs",
    detail:
      "A TinyFish browser agent searches your name, including professional profiles and academic documents. Search snippets remain available while destination pages are checked.",
    tool: "Browser agent",
    short: "Name & profile matches",
  },
  {
    id: "web",
    name: "Public web",
    icon: Globe2,
    label: "Contact details across the web",
    detail:
      "TinyFish Search and Fetch look for your email, phone and other identifiers on public pages. A known exposure URL can give the scan a specific page to inspect.",
    tool: "Search + Fetch",
    short: "Email & phone exposure",
  },
  {
    id: "scribd",
    name: "Scribd",
    icon: FileText,
    label: "Information inside public documents",
    detail:
      "Look for personal information in publicly accessible documents. Review the available evidence and prepare a complaint for the reporting route; you complete the handoff.",
    tool: "Search + Fetch",
    short: "Public document traces",
  },
  {
    id: "easyleadz",
    name: "EasyLeadz",
    icon: BookOpen,
    label: "Professional contact listings",
    detail:
      "Review contact listings and confirm the match. With your explicit approval, TinyFish Agent can submit the supported opt-out form and save the submission outcome.",
    tool: "Search + Agent",
    short: "Contact listing opt-outs",
  },
  {
    id: "hibp",
    name: "Have I Been Pwned",
    icon: ShieldCheck,
    label: "Email exposure in historical breaches",
    detail:
      "TinyFish Agent opens the HIBP website, enters the scan email and reads the visible result. Breach history informs account security; a removal request cannot undo a breach.",
    tool: "Website agent",
    short: "Historical email breaches",
  },
];

export function OverviewHero({
  scan,
  working,
  signedIn,
  onStart,
  onHelp,
}: {
  scan?: Scan;
  working: boolean;
  signedIn: boolean;
  onStart: () => void;
  onHelp: () => void;
}) {
  return (
    <section className="hero-card" aria-label="What Veil does">
      <div className="hero-copy">
        <span className="tiny-tag">
          <span className="live-dot" /> YOUR PERSONAL PRIVACY AGENT
        </span>
        <h2>
          Less exposed.
          <br />
          <span>More in control.</span>
        </h2>
        <p>
          See where your personal information appears online. Review the
          evidence, approve a removal request, and check the page again to see
          what changed.
        </p>
        <div className="hero-actions">
          <button className="button lime" disabled={working} onClick={onStart}>
            {signedIn ? <Search size={18} /> : <Sparkles size={18} />}{" "}
            {signedIn ? "Scan my footprint" : "Explore the live demo"}
            <ArrowRight size={18} />
          </button>
          <button className="text-button" onClick={onHelp}>
            How it works <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="hero-assurance">
          <LockKeyhole size={14} /> Your approval comes before every removal
          request.
        </div>
      </div>
      <div className="coverage-map">
        <div className="map-heading">
          <Fingerprint size={20} />
          <span>ONE WORKSPACE. FIVE CHECKS.</span>
          <span className="map-mark">V / 01</span>
        </div>
        <div className="map-sources">
          {COVERAGE.map((source) => (
            <div className="map-source" key={source.id}>
              <span className={`map-icon ${source.id}`}>
                <source.icon size={17} />
              </span>
              <div>
                <strong>{source.name}</strong>
                <span>{source.short}</span>
              </div>
              <ArrowUpRight size={14} />
            </div>
          ))}
        </div>
        <div className="map-caption">
          <Check size={14} />
          {scan
            ? `Evidence saved for ${scan.subject.name}`
            : "Evidence first. You decide what happens next."}
        </div>
      </div>
    </section>
  );
}

export function Workflow({
  scan,
  onNavigate,
}: {
  scan?: Scan;
  onNavigate: (section: string) => void;
}) {
  const findings = scan?.findings || [];
  const steps = [
    {
      title: "Discover",
      icon: Search,
      count: findings.filter((f) => f.matchStatus !== "dismissed").length,
      label: "potential exposures",
      detail: "Find public pages and keep the evidence that matched.",
      target: "My exposures",
    },
    {
      title: "Review",
      icon: Fingerprint,
      count: findings.filter((f) => f.matchStatus === "confirmed").length,
      label: "matches confirmed by you",
      detail: "Check each result. A shared name is only a candidate.",
      target: "My exposures",
    },
    {
      title: "Take action",
      icon: ArrowUpRight,
      count: findings.filter((f) => f.requestStatus !== "none").length,
      label: "removal cases started",
      detail: "Approve a supported form or use a prepared complaint.",
      target: "Removal requests",
    },
    {
      title: "Verify",
      icon: ShieldCheck,
      count: findings.filter(
        (f) =>
          ["not_observed", "unavailable"].includes(f.observation) &&
          f.timeline.some(
            (event) => event.title === "Browser verification started",
          ),
      ).length,
      label: "no longer seen on recheck",
      detail:
        "Save a fresh browser observation. A request alone is not removal.",
      target: "Activity",
    },
  ];
  return (
    <section className="workflow" aria-label="Your privacy workflow">
      {steps.map((step, index) => (
        <button
          className="workflow-step"
          key={step.title}
          onClick={() => onNavigate(step.target)}
        >
          <div className="workflow-top">
            <span className="step-number">0{index + 1}</span>
            <step.icon size={19} />
            <ArrowUpRight className="step-link" size={15} />
          </div>
          <h3>{step.title}</h3>
          <p>{step.detail}</p>
          <div className="step-stat">
            <strong>
              {scan ? step.count.toString().padStart(2, "0") : "—"}
            </strong>
            <span>{scan ? step.label : "Ready with your first scan"}</span>
          </div>
        </button>
      ))}
    </section>
  );
}
