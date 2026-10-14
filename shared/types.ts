export type Source = "web" | "scribd" | "easyleadz" | "demo";
export type SourceStatus = "waiting" | "running" | "checked" | "incomplete" | "blocked" | "not_configured";
export type Subject = { name: string; email: string; phone?: string; employer?: string; location?: string; linkedin?: string; knownUrl?: string };
export type TimelineEvent = { at: string; title: string; detail?: string };
export type Finding = {
  id: string; scanId: string; source: Source; sourceUrl: string; finalUrl: string; title: string;
  evidence: string; exposedFields: string[]; checkedAt: string; matchReason: string;
  matchStatus: "possible" | "confirmed" | "dismissed";
  requestStatus: "none" | "prepared" | "submitting" | "submitted" | "action_required" | "unknown" | "failed";
  observation: "unchecked" | "visible" | "not_observed" | "unavailable" | "unable_to_verify";
  payload?: RequestPayload; approvedAt?: string; actionId?: string; runId?: string; streamingUrl?: string;
  confirmation?: string; blocker?: string; screenshotId?: string; browserSessionId?: string;
  fixtureId?: string; timeline: TimelineEvent[];
};
export type RequestPayload = { name: string; email: string; phone: string; linkedin: string; profileUrl: string; destination: string; draft: string };
export type Breach = { name: string; date: string; description: string; fields: string[] };
export type Scan = { id: string; subject: Subject; demo: boolean; createdAt: string; consentAt: string; status: "running" | "complete" | "partial"; checks: { source: string; status: SourceStatus; detail: string }[]; findings: Finding[]; breaches: Breach[]; hibpMode: "live" | "test" | "unavailable" };
export type SessionInfo = { signedIn: boolean; name?: string; configured: boolean; canRunDemo: boolean; scans: Scan[] };
