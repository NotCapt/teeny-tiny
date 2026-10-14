import { z } from "zod";
import type { Scan, Subject, Finding, RequestPayload } from "../shared/types";
import { getRecord,insertRecord,listRecords,mutateRecord,type AppEnv } from "./store";
import { discover } from "./discovery";
import { prepare,runRemoval,reconcile } from "./removal";
import { verify } from "./verification";
import { cancelRun,closeSession,safeError } from "./tinyfish";
import { publicUrl } from "./matching";

export const DEMO_SUBJECT:Subject={name:"Alex Morgan",email:"alex.morgan@example.com",phone:"+1 202 555 0147",employer:"Northstar Studio",location:"San Francisco"};
const subjectSchema=z.object({name:z.string().trim().min(2).max(120),email:z.string().trim().email().max(200),phone:z.string().trim().max(40).optional(),employer:z.string().trim().max(150).optional(),location:z.string().trim().max(150).optional(),linkedin:z.string().trim().max(500).optional(),knownUrl:z.string().trim().max(1500).optional()});
const json=(data:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",...headers}});
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]!));
const frame=(title:string,body:string)=>`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(title)}</title><style>body{font:16px/1.7 system-ui;background:#f5f3ee;color:#263a32;margin:0;padding:8vw}main{max-width:650px;margin:auto;background:white;padding:40px;border-radius:20px;border:1px solid #deded4}label{display:block;margin:20px 0}input{display:block;width:90%;padding:14px;border:1px solid #b7c6b8;border-radius:8px}button{background:#315f47;color:white;border:0;padding:15px 28px;border-radius:10px;font-size:16px}small{color:#718377}</style></head><body><main>${body}</main></body></html>`;

async function fixture(request:Request,env:AppEnv,url:URL) {
  const match=url.pathname.match(/^\/demo\/(exposure|remove)\/([\w-]+)$/);if(!match)return null;
  const rec=await getRecord<{removed:boolean;subject:Subject}>(env,match[2]);if(!rec||rec.kind!=="fixture")return new Response("Not found",{status:404});
  const s=rec.data.subject;
  if(match[1]==="exposure")return new Response(frame("Synthetic contact directory",`<small>VEIL · SYNTHETIC DEMO FIXTURE</small><h1>${rec.data.removed?"Contact listing removed":"Team directory"}</h1>${rec.data.removed?"<p>This synthetic listing has been removed following an approved demo request.</p>":`<h2>${escape(s.name)}</h2><p>${escape(s.employer||"")} · ${escape(s.location||"")}</p><p>Email: ${escape(s.email)}<br>Phone: ${escape(s.phone||"")}</p>`}<p><small>This is invented information for an integration demonstration.</small></p>`),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Robots-Tag":"noindex"}});
  if(request.method==="POST") {
    const form=await request.formData();if(form.get("email")!==s.email||form.get("name")!==s.name)return new Response("The demo details do not match.",{status:400});
    await mutateRecord<{removed:boolean;subject:Subject}>(env,rec.id,rec.owner,d=>{d.removed=true;});
    return new Response(frame("Removal request received",`<h1>Removal request received</h1><p>Your synthetic contact listing has been removed from this demo directory.</p><p>Confirmation reference: VEIL-${escape(rec.id.slice(0,8))}</p><small>This confirmation applies only to the controlled demonstration.</small>`),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
  }
  return new Response(frame("Demo removal request",`<small>VEIL · CONTROLLED DEMO FORM</small><h1>Remove your contact listing</h1><p>This request only changes a synthetic directory.</p><form method="post"><label>Full name<input name="name" required></label><label>Email address<input name="email" type="email" required></label><button type="submit">Submit removal request</button></form>`),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
}

export async function handleApi(request:Request,env:AppEnv):Promise<Response|null> {
  const url=new URL(request.url);if(url.pathname.startsWith("/demo/"))try{return await fixture(request,env,url);}catch{return new Response("Demo unavailable",{status:503});}
  if(!url.pathname.startsWith("/api/"))return null;
  const signedUser=request.headers.get("oai-authenticated-user-id");
  let anonymous=request.headers.get("cookie")?.match(/(?:^|;\s*)veil_session=([a-f0-9-]{36})/)?.[1];
  if(!anonymous)anonymous=crypto.randomUUID();
  const owner=signedUser?`user:${signedUser}`:`demo:${anonymous}`;
  const headers={"Set-Cookie":`veil_session=${anonymous}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${url.protocol==="https:"?"; Secure":""}`};
  try {
    if(request.method!=="GET"&&request.headers.get("origin")&&request.headers.get("origin")!==url.origin) return json({error:"Cross-origin actions are not allowed."},403,headers);
    if(request.method!=="GET"&&request.method!=="DELETE"&&!request.headers.get("content-type")?.includes("application/json"))return json({error:"Use a JSON request."},415,headers);
    if(url.pathname==="/api/session"&&request.method==="GET")return json({signedIn:!!signedUser,name:request.headers.get("oai-authenticated-user-full-name")?decodeURIComponent(request.headers.get("oai-authenticated-user-full-name")!):request.headers.get("oai-authenticated-user-email"),configured:!!env.TINYFISH_API_KEY,canRunDemo:true,scans:await listRecords<Scan>(env,owner,"scan")},200,headers);
    if(url.pathname==="/api/session/data"&&request.method==="DELETE") {
      const scans=await listRecords<Scan>(env,owner,"scan");
      if(scans.some(s=>s.status==="running"||s.findings.some(f=>f.requestStatus==="submitting")))throw new Error("Wait for active operations to finish or cancel them before clearing data.");
      for(const scan of scans)for(const f of scan.findings)if(f.browserSessionId)await closeSession(env,f.browserSessionId);
      if(env.BUCKET){const list=await env.BUCKET.list({prefix:`${owner}/`});if(list.objects.length)await env.BUCKET.delete(list.objects.map(x=>x.key));}
      await env.DB!.prepare("DELETE FROM records WHERE owner=?").bind(owner).run();return json({cleared:true},200,headers);
    }
    if(url.pathname==="/api/scans"&&request.method==="POST") {
      const input=z.object({demo:z.boolean().default(false),consent:z.literal(true),subject:subjectSchema.optional()}).parse(await request.json());
      if(!input.demo&&!signedUser)return json({error:"Sign in to check your own information. Public demo uses invented details only."},401,headers);
      if(!env.TINYFISH_API_KEY)return json({error:"Configure TINYFISH_API_KEY on the server before starting a scan."},503,headers);
      const previous=await listRecords<Scan>(env,owner,"scan");
      if(previous.some(s=>s.status==="running"))throw new Error("A scan is already running. Wait for it to finish.");
      const today=new Date().toISOString().slice(0,10);const total=await env.DB!.prepare("SELECT COUNT(*) AS count FROM records WHERE kind='scan' AND created_at >= ?").bind(today).first<{count:number}>();
      if((total?.count||0)>=50||previous.filter(s=>s.createdAt.startsWith(today)).length>=5)return json({error:"Demo allowance reached for today. Saved cases remain available."},429,headers);
      const subject=input.demo?DEMO_SUBJECT:input.subject;if(!subject)throw new Error("Personal details are required.");
      if(subject.knownUrl)subject.knownUrl=publicUrl(subject.knownUrl);
      if(subject.linkedin&&!/^https:\/\/(www\.)?linkedin\.com\//i.test(subject.linkedin))throw new Error("Use a valid LinkedIn profile URL.");
      const scan:Scan={id:crypto.randomUUID(),subject,demo:input.demo,createdAt:new Date().toISOString(),consentAt:new Date().toISOString(),status:"running",checks:[{source:"web",status:"waiting",detail:"Ready to investigate public pages."},{source:"scribd",status:"waiting",detail:"Ready to inspect accessible documents."},{source:"easyleadz",status:"waiting",detail:"Ready to find professional listings."},{source:"hibp",status:"waiting",detail:"Ready to check historical breaches."}],findings:[],breaches:[],hibpMode:input.demo?"demo_browser":"browser"};
      await insertRecord(env,scan.id,owner,"scan",scan);
      return streamResponse(headers,async emit=>{emit(scan);try{await discover(env,owner,scan,env.PUBLIC_ORIGIN||url.origin,emit);}catch(e){const updated=await mutateRecord<Scan>(env,scan.id,owner,s=>{s.status="partial";for(const c of s.checks)if(c.status==="waiting"||c.status==="running"){c.status="incomplete";c.detail=safeError(e);}});emit(updated);}});
    }
    const scanMatch=url.pathname.match(/^\/api\/scans\/([\w-]+)$/);if(scanMatch&&request.method==="GET"){const record=await getRecord<Scan>(env,scanMatch[1],owner);return record?json(record.data,200,headers):json({error:"Not found."},404,headers);}
    const caseMatch=url.pathname.match(/^\/api\/cases\/([\w-]+)\/([\w-]+)\/(confirm|prepare|submit|verify|cancel|reconcile|screenshot|cleanup)$/);
    if(!caseMatch)return json({error:"Not found."},404,headers);
    const [,scanId,caseId,action]=caseMatch;const record=await getRecord<Scan>(env,scanId,owner);const finding=record?.data.findings.find(f=>f.id===caseId);
    if(!record||!finding)return json({error:"Not found."},404,headers);
    if(action==="screenshot"&&request.method==="GET") {if(!finding.screenshotId||!env.BUCKET)return json({error:"Screenshot not available."},404,headers);const obj=await env.BUCKET.get(`${owner}/${finding.screenshotId}.jpg`);return obj?new Response(obj.body,{headers:{"Content-Type":"image/jpeg","Cache-Control":"private, no-store",...headers}}):json({error:"Not found."},404,headers);}
    if(request.method!=="POST")return json({error:"Method not allowed."},405,headers);
    const input=await request.json() as Record<string,unknown>;
    if(action==="confirm") {if(finding.requestStatus==="submitting")throw new Error("An action is already running.");return json(await mutateRecord<Scan>(env,scanId,owner,s=>{const f=s.findings.find(f=>f.id===caseId)!;f.matchStatus=input.confirmed===true?"confirmed":"dismissed";f.timeline.push({at:new Date().toISOString(),title:input.confirmed===true?"Match confirmed by you":"Finding dismissed"});}),200,headers);}
    if(action==="prepare") {
      if(finding.matchStatus!=="confirmed")throw new Error("Confirm the finding first.");
      if(finding.actionId)throw new Error("A submission already exists. Check its outcome before preparing another.");
      return json(await mutateRecord<Scan>(env,scanId,owner,s=>{const f=s.findings.find(f=>f.id===caseId)!;f.payload=prepare(s,f,env.PUBLIC_ORIGIN||url.origin);f.requestStatus="prepared";f.timeline.push({at:new Date().toISOString(),title:"Request prepared",detail:"Review the destination and fields before approving."});}),200,headers);
    }
    if(action==="submit") {
      if(finding.actionId)return json(record.data,200,headers);
      if(finding.matchStatus!=="confirmed"||finding.requestStatus!=="prepared"||!finding.payload)throw new Error("Confirm the match and prepare a request first.");
      if(input.approved!==true)throw new Error("Explicit approval is required.");
      if(!["easyleadz","demo"].includes(finding.source))throw new Error("This source requires a manual reporting handoff.");
      const active=record.data.findings.filter(f=>f.requestStatus==="submitting");if(active.length>=2)throw new Error("Two Agent tasks are already active.");
      const p=z.object({name:z.string().trim().min(2).max(120),email:z.string().email(),phone:z.string().max(40),linkedin:z.string().max(500),profileUrl:z.string().max(1500)}).parse(input.payload);
      if(finding.source==="easyleadz"&&!/^https:\/\/(www\.)?linkedin\.com\//i.test(p.linkedin))throw new Error("EasyLeadz requires your LinkedIn profile URL.");
      if(p.profileUrl!==finding.sourceUrl)throw new Error("The request must refer to this confirmed exposure.");
      if(record.data.demo&&(p.name!==DEMO_SUBJECT.name||p.email!==DEMO_SUBJECT.email))throw new Error("The public demonstration uses the fixed synthetic identity.");
      const payload:RequestPayload={...finding.payload,...p};
      const updated=await mutateRecord<Scan>(env,scanId,owner,s=>{const f=s.findings.find(x=>x.id===caseId)!;if(f.actionId)throw new Error("This request has already started.");f.actionId=crypto.randomUUID();f.approvedAt=new Date().toISOString();f.payload=payload;f.requestStatus="submitting";f.timeline.push({at:f.approvedAt,title:"Submission approved",detail:"Only the reviewed fields have been authorized."});});
      return streamResponse(headers,async emit=>{emit(updated);await runRemoval(env,owner,scanId,caseId,payload,emit);});
    }
    if(action==="verify") {if(finding.matchStatus!=="confirmed")throw new Error("Confirm the finding before a recheck.");return json(await verify(env,owner,scanId,caseId),200,headers);}
    if(action==="reconcile")return json(await reconcile(env,owner,scanId,caseId),200,headers);
    if(action==="cancel") {if(!finding.runId)throw new Error("The run is not yet ready to cancel.");await cancelRun(env,finding.runId);return json(await reconcile(env,owner,scanId,caseId),200,headers);}
    if(action==="cleanup") {if(finding.browserSessionId)await closeSession(env,finding.browserSessionId);return json(await mutateRecord<Scan>(env,scanId,owner,s=>{s.findings.find(f=>f.id===caseId)!.browserSessionId=undefined;}),200,headers);}
    return json({error:"Unknown action."},404,headers);
  }catch(e){return json({error:e instanceof z.ZodError?e.issues[0]?.message:safeError(e)},400,headers);}
}
function streamResponse(headers:Record<string,string>,work:(emit:(scan:Scan)=>void)=>Promise<void>) {
  const encoder=new TextEncoder();let connected=true;
  const body=new ReadableStream<Uint8Array>({async start(controller){const emit=(scan:Scan)=>{if(connected)try{controller.enqueue(encoder.encode(`data: ${JSON.stringify(scan)}\n\n`));}catch{connected=false;}};try{await work(emit);}catch{if(connected)try{controller.enqueue(encoder.encode(`event: error\ndata: {"error":"The operation could not finish. Check the saved case."}\n\n`));}catch{}}finally{if(connected)try{controller.close();}catch{}}},cancel(){connected=false;}});
  return new Response(body,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache, no-transform","X-Accel-Buffering":"no",...headers}});
}
