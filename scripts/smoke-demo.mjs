import assert from 'node:assert/strict';
const origin=process.argv[2];
if(!origin)throw new Error('Pass the deployed origin. This test uses one synthetic TinyFish demo run.');
let cookie='';
async function call(path,body){
 const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];
 if(!r.ok)throw new Error(`${path}: ${r.status} ${await r.text()}`);
 if(r.headers.get('content-type')?.includes('text/event-stream')){
  const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='',last;
  while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const frames=buffer.split('\n\n');buffer=frames.pop();for(const frame of frames){const line=frame.split('\n').find(l=>l.startsWith('data: '));if(line){last=JSON.parse(line.slice(6));if(last.error)throw new Error(last.error);console.log(JSON.stringify({stage:path,status:last.status,findings:last.findings?.length,request:last.findings?.[0]?.requestStatus}));}}}
  return last;
 }
 return r.json();
}
const session=await call('/api/session');assert.equal(session.configured,true);assert.equal(session.signedIn,false);
const denied=await fetch(origin+'/api/scans',{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({demo:false,consent:true,subject:{name:'Alex Morgan',email:'alex.morgan@example.com'}})});assert.equal(denied.status,401);
let scan=await call('/api/scans',{demo:true,consent:true});assert.ok(scan.findings.length,'TinyFish Fetch must discover the synthetic listing');
const id=scan.findings[0].id,path=`/api/cases/${scan.id}/${id}`;
const other=await fetch(origin+`/api/scans/${scan.id}`);assert.equal(other.status,404,'Another visitor cannot read this case');
const unauthorized=await fetch(origin+path+'/submit',{method:'POST',headers:{'content-type':'application/json',cookie},body:'{}'});assert.equal(unauthorized.status,400,'Submission requires review and approval');
scan=await call(path+'/confirm',{confirmed:true});scan=await call(path+'/prepare',{});
scan=await call(path+'/submit',{approved:true,payload:scan.findings[0].payload});
assert.equal(scan.findings[0].requestStatus,'submitted',JSON.stringify(scan.findings[0].timeline));
scan=await call(path+'/verify',{});
assert.equal(scan.findings[0].observation,'not_observed',JSON.stringify(scan.findings[0].timeline));
assert.ok(scan.findings[0].screenshotId,'Verification captures evidence');
assert.equal(scan.findings[0].browserSessionId,undefined,'Browser session is explicitly closed');
console.log(JSON.stringify({result:'PASS',scanId:scan.id,checks:['anonymous real-scan denial','cross-session isolation','approval gate','Fetch discovery','Agent removal','Browser verification','screenshot','session cleanup']}));
