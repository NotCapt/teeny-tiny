import type { Scan } from "../shared/types";

// A worker that is evicted mid-stream never writes its final state. Anything still
// "running" or "submitting" well past the longest possible run is treated as interrupted.
export const STALE_AFTER_MS=30*60*1000;
const lastActivity=(scan:Scan)=>Math.max(Date.parse(scan.createdAt)||0,...scan.findings.flatMap(f=>f.timeline.map(e=>Date.parse(e.at)||0)));
export function reapStale(scan:Scan,now=Date.now()) {
  let changed=false;const at=new Date(now).toISOString();
  if(scan.status==="running"&&now-lastActivity(scan)>STALE_AFTER_MS) {
    scan.status="partial";changed=true;
    for(const c of scan.checks)if(c.status==="waiting"||c.status==="running"){c.status="incomplete";c.detail="This check was interrupted before it finished. Start a new scan to retry.";}
  }
  for(const f of scan.findings) {
    const last=Math.max(...f.timeline.map(e=>Date.parse(e.at)||0),Date.parse(f.approvedAt||"")||0);
    if(f.requestStatus==="submitting"&&now-last>STALE_AFTER_MS) {
      f.requestStatus=f.runId?"unknown":"failed";f.streamingUrl=undefined;changed=true;
      if(!f.runId)f.actionId=undefined;
      f.blocker=f.runId?"The connection to the agent ended before an outcome was saved. Use Check existing run.":"The request was interrupted before an agent run started. You can prepare it again.";
      f.timeline.push({at,title:"Submission outcome uncertain",detail:f.blocker});
    }
  }
  return changed;
}
