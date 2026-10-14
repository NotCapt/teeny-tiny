import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const origin=process.argv[2];
const session=await fetch(origin+'/api/session');const cookie=session.headers.get('set-cookie')?.split(';')[0];
const response=await fetch(origin+'/api/scans',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({demo:true,consent:true})});
assert.ok(response.ok,await (!response.ok?response.text():Promise.resolve('')));
let last,buffer='';const reader=response.body.getReader(),decoder=new TextDecoder();
while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const frames=buffer.split('\n\n');buffer=frames.pop();for(const frame of frames){const line=frame.split('\n').find(l=>l.startsWith('data: '));if(line){last=JSON.parse(line.slice(6));console.log(JSON.stringify({status:last.status,hibp:last.checks?.find(c=>c.source==='hibp')}));}}}
assert.equal(last.hibpMode,'demo_browser');assert.ok(last.hibpRunId,'TinyFish Agent actually started');assert.ok(last.findings.length,'Discovery still works');
mkdirSync('outputs',{recursive:true});writeFileSync('outputs/hibp-browser-validation.json',JSON.stringify({runId:last.hibpRunId,check:last.checks.find(c=>c.source==='hibp'),breaches:last.breaches},null,2));
console.log(JSON.stringify({result:'Website integration exercised',runId:last.hibpRunId,hibp:last.checks.find(c=>c.source==='hibp')}));
