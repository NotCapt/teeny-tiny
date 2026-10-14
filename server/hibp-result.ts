import { z } from "zod";

const resultSchema=z.object({
  outcome:z.enum(["checked","blocked","incomplete"]),
  checkedEmail:z.string(),
  evidence:z.string().trim().min(1).max(2000),
  breachCount:z.number().int().nonnegative().nullable(),
  breaches:z.array(z.object({name:z.string().trim().min(1),date:z.string(),description:z.string(),fields:z.array(z.string())})).max(100),
});
export function interpretHibpResult(raw:unknown,email:string,completed:boolean){
  const parsed=resultSchema.safeParse(raw);
  if(!completed||!parsed.success)return {status:"incomplete" as const,detail:"The HIBP website check did not return verified results. Open HIBP to check manually.",breaches:[]};
  const r=parsed.data;
  if(r.outcome!=="checked")return {status:r.outcome,detail:r.evidence,breaches:[]};
  if(r.checkedEmail.trim().toLowerCase()!==email.trim().toLowerCase()||r.breachCount===null||r.breachCount<r.breaches.length||(!r.breachCount&&r.breaches.length))return {status:"incomplete" as const,detail:"The website result could not be tied to this email. Check HIBP manually.",breaches:[]};
  return {status:r.breachCount===r.breaches.length?"checked" as const:"incomplete" as const,detail:`TinyFish checked the HIBP website: ${r.breachCount} breach${r.breachCount===1?"":"es"} reported. ${r.evidence}${r.breachCount>r.breaches.length?" Only some breach details could be read.":""}`,breaches:r.breaches};
}
