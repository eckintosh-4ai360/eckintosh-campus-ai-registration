import test from 'node:test';import assert from 'node:assert/strict';import {validate,sameOrigin} from '../lib/core.mjs';
const valid={event_id:'0a111111-1111-4111-8111-111111111111',name:'Test Student',email:' STUDENT@EXAMPLE.COM ',phone:'+233 24 123 4567',programme:'Engineering',level:'Level 200',experience:'',consent:true,website:''};
test('accepts a valid form without an institution',()=>{const data=validate(valid);assert.equal(data.p_email,'student@example.com');assert.equal(data.p_institution,null);});
test('explains an invalid phone number',()=>assert.throws(()=>validate({...valid,phone:'123'}),/phone number/));
test('explains missing consent',()=>assert.throws(()=>validate({...valid,consent:false}),/privacy notice/));
for(const [key,value] of Object.entries({name:'',email:'broken',phone:'123',programme:'',level:'invalid',experience:'unknown',consent:false,website:'spam',event_id:'broken'})){test('rejects '+key,()=>assert.throws(()=>validate({...valid,[key]:value})));}
test('rejects hostile origin',()=>assert.equal(sameOrigin({headers:{host:'example.com',origin:'https://evil.example'}}),false));
test('accepts same origin',()=>assert.equal(sameOrigin({headers:{host:'example.com',origin:'https://example.com'}}),true));
