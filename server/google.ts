import type { Scan } from "../shared/types";
import type { AppEnv } from "./store";
import { tinyfish } from "./tinyfish";
import { googleAgentRequest,interpretGoogleResults } from "./google-results";

export async function googleSearch(env:AppEnv,scan:Scan,progress:(detail:string)=>Promise<void>){
  const client=tinyfish(env,600000);
  let result:unknown;let completed=false;
  try {
    const stream=await client.agent.stream(googleAgentRequest(scan.subject.name));
    for await(const event of stream){
      if(event.type==="STARTED"){scan.googleRunId=event.run_id;await progress("TinyFish Agent is searching your full name on Google.");}
      if(event.type==="PROGRESS")await progress(event.purpose);
      if(event.type==="COMPLETE"){result=event.result;completed=event.status==="COMPLETED";}
    }
  }catch(error){
    if(!scan.googleRunId)throw error;
    await progress("The connection ended. Checking the existing Google run without starting another search.");
    for(let attempt=0;attempt<6;attempt++){
      const run=await client.runs.get(scan.googleRunId);
      if(run.status!=="RUNNING"&&run.status!=="PENDING"){result=run.result;completed=run.status==="COMPLETED";break;}
      if(attempt===5)throw new Error(`Google is still processing run ${scan.googleRunId}. Its ID is saved; the remaining sources will continue.`);
      await new Promise(resolve=>setTimeout(resolve,10000));
    }
  }
  return interpretGoogleResults(result,scan.subject.name,completed);
}
