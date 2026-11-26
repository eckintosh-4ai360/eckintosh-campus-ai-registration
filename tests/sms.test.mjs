import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultMessage, decryptApiKey, encryptApiKey, sendSms, smsRecipient, smsText, validSmsSettings} from '../lib/sms.mjs';

test('API key is encrypted and can be read only with the same secret', () => {
  const encrypted = encryptApiKey('sample-key', 'secret-one');
  assert.ok(!encrypted.includes('sample-key'));
  assert.equal(decryptApiKey(encrypted, 'secret-one'), 'sample-key');
  assert.throws(() => decryptApiKey(encrypted, 'secret-two'));
});
test('SMS settings require a reference and a key before enabling', () => {
  assert.throws(() => validSmsSettings({sender:'ECKINTOSH',message:'Payment complete',enabled:true}, false));
  assert.throws(() => validSmsSettings({sender:'ECKINTOSH',message:defaultMessage,enabled:true}, false));
  assert.equal(validSmsSettings({sender:'ECKINTOSH',message:defaultMessage,api_key:'sample-key',enabled:true}, false).enabled, true);
});
test('formats Ghana numbers and fills confirmation text', () => {
  assert.equal(smsRecipient('+233 24 123 4567'), '0241234567');
  assert.equal(smsText('Hi {name}, reference {reference}', {full_name:'Ama Mensah',reference:'AI-UG-1234'}), 'Hi Ama, reference AI-UG-1234');
});
test('sends one MNotify quick SMS and checks the accepted count', async () => {
  let payload;
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://api.mnotify.com/api/sms/quick?key=sample-key');
    payload = JSON.parse(options.body);
    return {ok:true,json:async () => ({status:'success',summary:{_id:'campaign-1',total_sent:1,total_rejected:0}})};
  };
  const settings = {api_key_encrypted:encryptApiKey('sample-key','secret-one'),sender:'ECKINTOSH',message:defaultMessage};
  const registration = {full_name:'Ama Mensah',reference:'AI-UG-1234',phone:'+233 24 123 4567'};
  assert.equal(await sendSms(settings,registration,'secret-one',fetcher), 'campaign-1');
  assert.deepEqual(payload.recipient,['0241234567']);
  assert.match(payload.message,/AI-UG-1234/);
  await assert.rejects(sendSms(settings,registration,'secret-one',async () => ({ok:true,json:async () => ({status:'success',summary:{total_sent:0,total_rejected:1}})})), /did not accept/);
});
