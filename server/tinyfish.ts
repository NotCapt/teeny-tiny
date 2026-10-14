import { TinyFish } from "@tiny-fish/sdk";
import type { AppEnv } from "./store";
export function tinyfish(env:AppEnv,timeout=150000) {
  if(!env.TINYFISH_API_KEY) throw new Error("TinyFish is not configured on this deployment.");
  return new TinyFish({apiKey:env.TINYFISH_API_KEY,timeout,maxRetries:0});
}
export async function cancelRun(env:AppEnv,id:string) {
  const response=await fetch(`https://agent.tinyfish.ai/v1/runs/${encodeURIComponent(id)}/cancel`,{method:"POST",headers:{"X-API-Key":env.TINYFISH_API_KEY!}});
  if(!response.ok) throw new Error(`Could not cancel run (${response.status}).`);
  return response.json() as Promise<{status:string}>;
}
export async function closeSession(env:AppEnv,id:string) {
  for(let attempt=0;attempt<3;attempt++) {
    const response=await fetch(`https://api.browser.tinyfish.ai/${encodeURIComponent(id)}`,{method:"DELETE",headers:{"X-API-Key":env.TINYFISH_API_KEY!}});
    if(response.ok||response.status===404) return;
    if(attempt===2) throw new Error("Browser session cleanup was not confirmed. Retry cleanup from this case.");
    await new Promise(r=>setTimeout(r,1000));
  }
}
export function safeError(e:unknown) { return (e instanceof Error?e.message:"The service could not complete this task.").replace(/sk-tinyfish-[\w-]+/g,"[redacted]").slice(0,500); }
