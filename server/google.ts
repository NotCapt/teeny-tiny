import type { Scan } from "../shared/types";
import type { AppEnv } from "./store";
import { tinyfish } from "./tinyfish";
import { googleAgentRequest,interpretGoogleResults } from "./google-results";

export async function googleSearch(env:AppEnv,scan:Scan,progress:(detail:string)=>Promise<void>){
  const stream=await tinyfish(env).agent.stream(googleAgentRequest(scan.subject.name));
  let result:unknown;let completed=false;
  for await(const event of stream){
    if(event.type==="STARTED"){scan.googleRunId=event.run_id;await progress("TinyFish Agent is searching your full name on Google.");}
    if(event.type==="PROGRESS")await progress(event.purpose);
    if(event.type==="COMPLETE"){result=event.result;completed=event.status==="COMPLETED";}
  }
  return interpretGoogleResults(result,scan.subject.name,completed);
}
