import assert from 'node:assert/strict';
import {interpretGoogleResults,googleAgentRequest} from '../server/google-results.ts';
const rows=[{url:'https://linkedin.com/in/example?utm_source=google',title:'Faaiz Hussain - LinkedIn',snippet:'Public profile',query:'Faaiz Hussain',rank:1},{url:'https://exam.example.edu/results.pdf',title:'Exam results',snippet:'FAAAIZ OTHER; Faaiz Hussain 2025',query:'Faaiz Hussain',rank:2},{url:'https://linkedin.com/in/example',title:'Faaiz Hussain',snippet:'Duplicate',query:'Faaiz Hussain',rank:3},{url:'https://example.com/unrelated',title:'Faiz Hussain',snippet:'Different spelling',query:'Faaiz Hussain',rank:4},{url:'http://127.0.0.1/',title:'Faaiz Hussain',snippet:'Invalid target',query:'Faaiz Hussain',rank:5}];
const result=interpretGoogleResults({outcome:'complete',pagesChecked:2,note:'Bounded search',results:rows},'Faaiz Hussain',true);
assert.equal(result.results.length,2);assert.equal(result.status,'checked');assert.ok(result.results[1].url.endsWith('.pdf'));
assert.equal(interpretGoogleResults({outcome:'blocked',pagesChecked:1,note:'Challenge',results:rows},'Faaiz Hussain',true).results.length,2);
assert.equal(interpretGoogleResults(null,'Faaiz Hussain',true).status,'incomplete');
assert.ok(googleAgentRequest('Faaiz Hussain').url.includes('Faaiz%20Hussain'));
console.log('PASS: LinkedIn and PDF candidates retained, tracking duplicates removed, unrelated names and unsafe URLs rejected, partial evidence preserved.');
