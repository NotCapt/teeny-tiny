import type { Subject } from "../shared/types";
export function matchContent(text: string, subject: Subject) {
  const content=text.toLowerCase();
  const fields:string[]=[];
  let index=-1;
  const email=subject.email.trim().toLowerCase();
  const escaped=email.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const emailMatch=new RegExp(`(?<![a-z0-9._%+-])${escaped}(?![a-z0-9.-])`,"i").exec(text);
  if(emailMatch) { fields.push("Email address"); index=emailMatch.index; }
  const digits=(subject.phone||"").replace(/\D/g,"");
  if(digits.length>=7 && text.replace(/[^\d]/g,"").includes(digits)) fields.push("Phone number");
  const name=subject.name.trim().toLowerCase();
  if(name.length>=4 && content.includes(name)) { fields.push("Full name"); if(index<0) index=content.indexOf(name); }
  if(subject.employer && content.includes(subject.employer.toLowerCase())) fields.push("Employer");
  if(subject.location && content.includes(subject.location.toLowerCase())) fields.push("Location");
  const hasPersonal=fields.some(f=>["Email address","Phone number","Full name"].includes(f));
  const strong=fields.includes("Email address")||fields.includes("Phone number");
  return { matched:hasPersonal, fields, strong, evidence: text.slice(Math.max(0,index-100),Math.max(0,index-100)+420).replace(/\s+/g," ").trim(), reason:strong?"An exact contact identifier appears in readable page content.":"The name appears in readable content. Confirm this belongs to you." };
}
export function pageBlocker(text:string,url:string) {
  if(/\/login(?:[/?#]|$)|\/signin(?:[/?#]|$)/i.test(url)) return "The page requires sign-in.";
  if(/verify you are human|checking your browser|just a moment|access denied|client challenge|unusual traffic|enable javascript and cookies/i.test(text.slice(0,2500))) return "A browser challenge prevented verification.";
  if(text.trim().length<40) return "The page did not return enough readable content.";
  return null;
}
export function publicUrl(value:string) {
  const u=new URL(value); const h=u.hostname.toLowerCase();
  if(!["http:","https:"].includes(u.protocol)||u.username||u.password||h==="localhost"||h.endsWith(".local")||h.endsWith(".internal")||h.includes(":")||/^\d+(\.\d+){3}$/.test(h)||!h.includes(".")) throw new Error("Use a public website URL without credentials.");
  return u.toString();
}
