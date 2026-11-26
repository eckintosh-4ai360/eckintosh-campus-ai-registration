import {createCipheriv, createDecipheriv, createHash, randomBytes} from 'node:crypto';

export const defaultMessage = 'Hi {name}, your payment for the Eckintosh AI Campus Programme is confirmed. Your registration reference is {reference}. We look forward to seeing you!';

function key(secret) {
  return createHash('sha256').update(`eai-mnotify-key:${secret}`).digest();
}
export function encryptApiKey(value, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}
export function decryptApiKey(value, secret) {
  const data = Buffer.from(value, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key(secret), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}
export function smsText(template, registration) {
  const firstName = registration.full_name.trim().split(/\s+/)[0];
  return template.replace(/\{name\}/g, firstName).replace(/\{reference\}/g, registration.reference);
}
export function smsRecipient(phone) {
  const digits = phone.replace(/\D/g, '');
  return /^233\d{9}$/.test(digits) ? `0${digits.slice(3)}` : digits;
}
export function validSmsSettings(data, hasKey) {
  const accountId = typeof data.account_id === 'string' ? data.account_id.trim() : '';
  const sender = typeof data.sender === 'string' ? data.sender.trim() : '';
  const message = typeof data.message === 'string' ? data.message.trim() : '';
  const apiKey = typeof data.api_key === 'string' ? data.api_key.trim() : '';
  if (accountId.length > 100 || !/^[A-Za-z0-9 ]{1,11}$/.test(sender) || message.length < 10 || message.length > 500 || !message.includes('{reference}') || apiKey.length > 512 || (data.enabled === true && !apiKey && !hasKey)) throw new Error('Enter a sender ID (up to 11 letters, numbers or spaces), a message containing {reference}, and an API key before enabling SMS.');
  return {accountId, sender, message, apiKey, enabled: data.enabled === true};
}
export async function sendSms(settings, registration, secret, fetcher = fetch) {
  let apiKey;
  try { apiKey = decryptApiKey(settings.api_key_encrypted, secret); }
  catch {
    const error = new Error('Saved MNotify API key cannot be read. Enter it again in SMS settings.');
    error.definitive = true;
    throw error;
  }
  const response = await fetcher(`https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({recipient:[smsRecipient(registration.phone)], sender:settings.sender, message:smsText(settings.message, registration), is_schedule:false, schedule_date:''}),
    signal: AbortSignal.timeout(10000)
  });
  const result = await response.json();
  if (!response.ok || result.status !== 'success' || Number(result.summary?.total_sent) === 0 || Number(result.summary?.total_rejected || 0) > 0 || Number(result.summary?.international_dropped || 0) > 0) {
    const error = new Error('MNotify did not accept the SMS. Check the account, sender ID, credit and recipient.');
    error.definitive = true;
    throw error;
  }
  if (Number(result.summary?.total_sent) !== 1) throw new Error('MNotify response did not confirm one accepted SMS.');
  return String(result.summary?._id || '').slice(0, 100);
}
