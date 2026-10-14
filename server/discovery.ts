import type { Scan, Finding, Source, Breach } from "../shared/types";
import { insertRecord, mutateRecord, type AppEnv } from "./store";
import { tinyfish, safeError } from "./tinyfish";
import { matchContent, pageBlocker, publicUrl } from "./matching";

const stamp=()=>new Date().toISOString();
export function sourceOf(url:string):Source {
  const host=new URL(url).hostname;
  return /(^|\.)scribd\.com$/.test(host)?"scribd":/(^|\.)easyleadz\.com$/.test(host)?"easyleadz":"web";
}
export async function hibp(env:AppEnv,scan:Scan) {
  if(!env.HIBP_API_KEY&&!scan.demo) return {status:"not_configured" as const,detail:"A separate Have I Been Pwned subscription key is required.",breaches:[] as Breach[]};
  const email=scan.demo?"multiple-breaches@hibp-integration-tests.com":scan.subject.email;
  const response=await fetch(`https://haveibeenpwned.com/api/v3/breachedAccount/${encodeURIComponent(email)}?truncateResponse=false`,{headers:{"hibp-api-key":scan.demo?"00000000000000000000000000000000":env.HIBP_API_KEY!,"user-agent":"VeilPrivacyHackathon/1.0"},signal:AbortSignal.timeout(12000)});
  if(response.status===404) return {status:"checked" as const,detail:"No indexed breaches found for this lookup.",breaches:[] as Breach[]};
  if(!response.ok) throw new Error(response.status===429?"HIBP is rate limited. Check again later.":`HIBP could not complete the lookup (${response.status}).`);
  const data=await response.json() as Array<{Name:string;Title:string;BreachDate:string;Description:string;DataClasses:string[]}>;
  return {status:"checked" as const,detail:scan.demo?"Official HIBP integration-test account; not your email.":"Historical breach lookup completed.",breaches:data.map(b=>({name:b.Title||b.Name,date:b.BreachDate,description:b.Description.replace(/<[^>]*>/g," "),fields:b.DataClasses}))};
}
export async function discover(env:AppEnv,owner:string,scan:Scan,origin:string,emit:(s:Scan)=>void) {
  const save=async()=>{await mutateRecord<Scan>(env,scan.id,owner,s=>Object.assign(s,scan));emit(scan);};
  const check=(source:string,status:Scan["checks"][number]["status"],detail:string)=>{const item=scan.checks.find(c=>c.source===source);if(item)Object.assign(item,{status,detail});};
  const client=tinyfish(env);
  const candidates=new Map<string,{source:Source;title:string;snippet:string;fixtureId?:string}>();
  let anyFailure=false;
  check("hibp","running","Checking historical breach exposure…");await save();
  try {const result=await hibp(env,scan);scan.breaches=result.breaches;check("hibp",result.status,result.detail);} catch(e) {check("hibp","incomplete",safeError(e));anyFailure=true;} await save();
  if(scan.demo) {
    const fixtureId=crypto.randomUUID();
    await insertRecord(env,fixtureId,owner,"fixture",{removed:false,createdAt:stamp(),subject:scan.subject});
    candidates.set(`${origin}/demo/exposure/${fixtureId}`,{source:"demo",title:"Synthetic contact directory",snippet:"",fixtureId});
    for(const source of ["web","scribd","easyleadz"]) check(source,"checked",source==="web"?"Controlled synthetic fixture; checking with TinyFish Fetch.":"Live discovery is available in a personal scan. No synthetic broker findings.");
    await save();
  } else {
    if(scan.subject.knownUrl) { const url=publicUrl(scan.subject.knownUrl);candidates.set(url,{source:sourceOf(url),title:"Provided exposure URL",snippet:""}); }
    const queries=[{source:"web",query:`\"${scan.subject.email}\"`,domains:undefined},{source:"web",query:`\"${scan.subject.name}\" ${scan.subject.employer||scan.subject.location||""}`,domains:undefined},{source:"scribd",query:`\"${scan.subject.name}\" ${scan.subject.email}`,domains:"scribd.com"},{source:"easyleadz",query:`\"${scan.subject.name}\" ${scan.subject.employer||""}`,domains:"easyleadz.com"}];
    if(scan.subject.phone) queries.splice(1,0,{source:"web",query:`\"${scan.subject.phone}\"`,domains:undefined});
    for(const q of queries) {
      check(q.source,"running","Searching for matching public pages…");await save();
      try {
        const found=await client.search.query({query:q.query,...(q.domains?{include_domains:q.domains}:{}),language:"en"});
        for(const result of found.results.slice(0,5)) {try {const url=publicUrl(result.url);if(q.domains&&!new URL(url).hostname.endsWith(q.domains))continue;if(!candidates.has(url))candidates.set(url,{source:sourceOf(url),title:result.title,snippet:result.snippet});}catch{}}
        if(scan.checks.find(c=>c.source===q.source)?.status!=="incomplete")check(q.source,"checked","Search completed; examining readable page evidence.");
      }catch(e){check(q.source,"incomplete",safeError(e));anyFailure=true;}
      await save();
    }
  }
  const urls=[...candidates.keys()].slice(0,10);
  if(urls.length) {
    try {
      const fetched=await client.fetch.getContents({urls,format:"markdown",per_url_timeout_ms:25000,ttl:0});
      for(const page of fetched.results) {
        const meta=candidates.get(page.url); if(!meta)continue;
        const text=typeof page.text==="string"?page.text:"";
        const blocker=pageBlocker(text,page.final_url||page.url);
        const match=matchContent(text,scan.subject);
        if(!match.matched)continue;
        const finding:Finding={id:crypto.randomUUID(),scanId:scan.id,source:meta.source,sourceUrl:page.url,finalUrl:page.final_url||page.url,title:page.title||meta.title,evidence:match.evidence,exposedFields:match.fields,checkedAt:stamp(),matchReason:match.reason,matchStatus:"possible",requestStatus:"none",observation:blocker?"unable_to_verify":"visible",blocker:blocker||undefined,fixtureId:meta.fixtureId,timeline:[{at:stamp(),title:"Exposure discovered",detail:blocker||match.reason}]};
        if(!scan.findings.some(f=>f.finalUrl===finding.finalUrl))scan.findings.push(finding);
      }
      for(const failed of fetched.errors||[]) {
        anyFailure=true;
        const meta=candidates.get(failed.url);if(!meta)continue;
        const source=meta.source==="demo"?"web":meta.source;
        check(source,"incomplete",`Some pages could not be read: ${failed.error}.`);
      }
    }catch(e){anyFailure=true;check("web","incomplete",safeError(e));}
  }
  scan.status=anyFailure?"partial":"complete";
  for(const c of scan.checks)if(c.status==="running"||c.status==="waiting") {c.status="checked";c.detail="No readable matching page found in this bounded scan.";}
  await save();
}
