import test from 'node:test';import assert from 'node:assert/strict';import {validate,sameOrigin,validPhone,validReference} from '../lib/core.mjs';
const valid={event_id:'0a111111-1111-4111-8111-111111111111',name:'Test Student',phone:'+233 24 123 4567',programme:'Engineering',level:'Level 200',experience:'',consent:true};
test('accepts a valid form without an institution',()=>{const data=validate(valid);assert.equal(data.p_email,null);assert.equal(data.p_institution,null);});
test('explains an invalid phone number',()=>assert.throws(()=>validate({...valid,phone:'123'}),/phone number/));
test('explains missing consent',()=>assert.throws(()=>validate({...valid,consent:false}),/privacy notice/));
for(const [key,value] of Object.entries({name:'',phone:'123',programme:'',level:'invalid',experience:'unknown',consent:false,event_id:'broken'})){test('rejects '+key,()=>assert.throws(()=>validate({...valid,[key]:value})));}
test('rejects hostile origin',()=>assert.equal(sameOrigin({headers:{host:'example.com',origin:'https://evil.example'}}),false));
test('accepts same origin',()=>assert.equal(sameOrigin({headers:{host:'example.com',origin:'https://example.com'}}),true));

test('validates formatted phone numbers',()=>{assert.equal(validPhone('+233 24 123 4567'),true);assert.equal(validPhone('hello'),false);});

test('accepts new and existing registration reference formats',()=>{assert.equal(validReference('AI-UG-0123'),true);assert.equal(validReference('AIUG0123'),true);assert.equal(validReference('EAI-0123456789ABCDEF0123456789ABCDEF'),true);assert.equal(validReference('AI-UG-123'),false);});
