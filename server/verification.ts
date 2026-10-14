import type { Finding, Scan } from "../shared/types";
import { getRecord,mutateRecord,type AppEnv } from "./store";
import { tinyfish,closeSession,safeError } from "./tinyfish";
import { matchContent,pageBlocker,publicUrl } from "./matching";

class CDP {
  socket:WebSocket; id=0; sessionId?:string;
  pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  constructor(socket:WebSocket) {
    this.socket=socket;
    socket.addEventListener("message",event=>{try {const msg=JSON.parse(String(event.data));const p=this.pending.get(msg.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result);}catch{}});
    socket.addEventListener("close",()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error("The browser connection closed."));}this.pending.clear();});
  }
  send(method:string,params:Record<string,unknown>={},target=true):Promise<any> {
    const id=++this.id;
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error("Browser command timed out."));},15000);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params,...(target&&this.sessionId?{sessionId:this.sessionId}:{})}));});
  }
}

export async function verify(env:AppEnv,owner:string,scanId:string,caseId:string):Promise<Scan> {
  const rec=await getRecord<Scan>(env,scanId,owner);const f=rec?.data.findings.find(x=>x.id===caseId);
  if(!rec||!f)throw new Error("Case not found.");
  let remoteId:string|undefined;let socket:WebSocket|undefined;
  let screenshotId:string|undefined;let finalUrl=f.finalUrl;let observation:Finding["observation"]="unable_to_verify";let detail="";
  try {
    const url=publicUrl(f.sourceUrl);
    const session=await tinyfish(env).browser.sessions.create({timeout_seconds:90});remoteId=session.session_id;
    await mutateRecord<Scan>(env,scanId,owner,s=>{const c=s.findings.find(x=>x.id===caseId)!;c.browserSessionId=remoteId;c.timeline.push({at:new Date().toISOString(),title:"Browser verification started",detail:"Opening a fresh remote browser session."});});
    const upgrade=await fetch(session.cdp_url.replace(/^wss:/,"https:").replace(/^ws:/,"http:"),{headers:{Upgrade:"websocket"}});
    socket=upgrade.webSocket||undefined;if(!socket)throw new Error("Could not connect to the remote browser.");socket.accept();
    const cdp=new CDP(socket);
    const targets=await cdp.send("Target.getTargets",{},false);
    const pageTarget=targets.targetInfos.find((t:{type:string})=>t.type==="page");
    const targetId=pageTarget?.targetId||(await cdp.send("Target.createTarget",{url:"about:blank"},false)).targetId;
    const attached=await cdp.send("Target.attachToTarget",{targetId,flatten:true},false);cdp.sessionId=attached.sessionId;
    await cdp.send("Page.enable");
    const nav=await cdp.send("Page.navigate",{url});if(nav.errorText)throw new Error("The target page could not be loaded.");
    let page:{url:string;title:string;text:string;ready:string}|null=null;
    for(let i=0;i<20;i++) {
      await new Promise(r=>setTimeout(r,500));
      const result=await cdp.send("Runtime.evaluate",{expression:"JSON.stringify({url:location.href,title:document.title,text:document.body?.innerText||'',ready:document.readyState})",returnByValue:true});
      if(result.exceptionDetails)throw new Error("Readable browser content was unavailable.");
      page=JSON.parse(result.result.value||"null");
      if(page&&page.url!=="about:blank"&&page.ready==="complete"&&page.text.trim().length>30)break;
    }
    if(!page||page.url==="about:blank"||page.ready!=="complete")throw new Error("The page did not finish loading.");
    finalUrl=publicUrl(page.url);
    const blocker=pageBlocker(page.text,finalUrl);
    if(blocker)throw new Error(blocker);
    if(/^(404|410)|page not found|document (?:has been )?removed|content (?:has been )?removed/i.test(`${page.title} ${page.text.slice(0,300)}`)){observation="unavailable";detail="The original page is unavailable under the conditions checked.";}
    else {const matched=matchContent(page.text,rec.data.subject);const contactFields=f.exposedFields.filter(x=>x==="Email address"||x==="Phone number");const remains=contactFields.length?contactFields.some(x=>matched.fields.includes(x)):matched.matched;observation=remains?"visible":"not_observed";detail=remains?matched.evidence:"Previously observed identifiers were not found in this readable page. This observation does not establish deletion elsewhere.";}
    if(env.BUCKET) {const shot=await cdp.send("Page.captureScreenshot",{format:"jpeg",quality:70});screenshotId=crypto.randomUUID();const binary=Uint8Array.from(atob(shot.data),(c)=>c.charCodeAt(0));await env.BUCKET.put(`${owner}/${screenshotId}.jpg`,binary,{httpMetadata:{contentType:"image/jpeg"}});}
  }catch(e){detail=safeError(e);observation="unable_to_verify";}
  finally {
    socket?.close();
    if(remoteId)try {await closeSession(env,remoteId);remoteId=undefined;}catch(e){detail+=` ${safeError(e)}`;}
  }
  return mutateRecord<Scan>(env,scanId,owner,s=>{const c=s.findings.find(x=>x.id===caseId)!;c.observation=observation;c.checkedAt=new Date().toISOString();c.finalUrl=finalUrl;c.browserSessionId=remoteId;c.screenshotId=screenshotId||c.screenshotId;c.blocker=observation==="unable_to_verify"||remoteId?detail:undefined;c.timeline.push({at:c.checkedAt,title:observation==="visible"?"Information still visible":observation==="not_observed"?"Information not observed":observation==="unavailable"?"Page unavailable":"Unable to verify",detail});});
}
