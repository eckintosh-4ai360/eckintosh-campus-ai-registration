import {createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {body, dbQuery, reply, sameOrigin, uuid} from '../lib/core.mjs';
import {defaultMessage, encryptApiKey, sendSms, validSmsSettings} from '../lib/sms.mjs';

const scrypt = promisify(scryptCallback);
const cookieName = 'eai_admin_session';
const sessionSeconds = 8 * 60 * 60;
const maxAttempts = 10;

function config() {
  const {ADMIN_EMAIL: email, ADMIN_PASSWORD_HASH: hash, ADMIN_SESSION_SECRET: secret} = process.env;
  if (!email || !/^[a-f0-9]{32}:[a-f0-9]{64}$/i.test(hash || '') || !/^[a-f0-9]{64,}$/i.test(secret || '')) throw new Error('Admin configuration unavailable');
  return {email: email.trim().toLowerCase(), hash, secret};
}
function signature(expiry, nonce, settings) {
  return createHmac('sha256', settings.secret).update(`${expiry}:${nonce}:${settings.hash}`).digest('base64url');
}
function safeEqual(a, b) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function cookieValue(req) {
  const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`));
  return cookie ? cookie.slice(cookieName.length + 1) : '';
}
function hashSession(token) { return createHash('sha256').update(token).digest('hex'); }
async function hasSession(req, settings) {
  const token = cookieValue(req);
  const [expiry, nonce, sig, extra] = token.split('.');
  const value = Number(expiry), now = Math.floor(Date.now() / 1000);
  if (extra || !Number.isSafeInteger(value) || value <= now || value > now + sessionSeconds || !/^[A-Za-z0-9_-]{43}$/.test(nonce || '') || typeof sig !== 'string' || !safeEqual(sig, signature(expiry, nonce, settings))) return false;
  const result = await dbQuery('select 1 from public.eai_admin_sessions where session_hash=$1 and expires_at>now()', [hashSession(token)]);
  return result.rowCount === 1;
}
async function setSession(res, settings) {
  const expiry = Math.floor(Date.now() / 1000) + sessionSeconds;
  const nonce = randomBytes(32).toString('base64url');
  const token = `${expiry}.${nonce}.${signature(expiry, nonce, settings)}`;
  await dbQuery('delete from public.eai_admin_sessions where expires_at<=now()');
  await dbQuery('insert into public.eai_admin_sessions(session_hash,expires_at) values($1,to_timestamp($2))', [hashSession(token), expiry]);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionSeconds}${secure}`);
}
async function clearSession(req, res) {
  await dbQuery('delete from public.eai_admin_sessions where session_hash=$1', [hashSession(cookieValue(req))]);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}
async function checkPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const derived = await scrypt(password, Buffer.from(salt, 'hex'), 32);
  return timingSafeEqual(derived, Buffer.from(hash, 'hex'));
}
async function login(req, res, data, settings) {
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const password = typeof data.password === 'string' ? data.password : '';
  if (email.length > 254 || password.length > 256) return reply(res, 400, {error: 'Invalid credentials.'});
  const guard = await dbQuery(`insert into public.eai_admin_login_guard(id,window_start,attempts) values (true,now(),1)
    on conflict (id) do update set
    attempts=case when eai_admin_login_guard.window_start < now()-interval '15 minutes' then 1 else eai_admin_login_guard.attempts+1 end,
    window_start=case when eai_admin_login_guard.window_start < now()-interval '15 minutes' then now() else eai_admin_login_guard.window_start end
    returning attempts`);
  if (guard.rows[0].attempts > maxAttempts) return reply(res, 429, {error: 'Too many sign-in attempts. Try again in 15 minutes.'});
  const passwordOK = await checkPassword(password, settings.hash);
  if (!safeEqual(email, settings.email) || !passwordOK) return reply(res, 401, {error: 'Incorrect email or password.'});
  await dbQuery('update public.eai_admin_login_guard set attempts=0, window_start=now() where id=true');
  await setSession(res, settings);
  return reply(res, 200, {ok: true});
}
async function list(res, req) {
  const url = new URL(req.url, 'http://localhost');
  const rawPage = Number(url.searchParams.get('page') || 1);
  const page = Number.isSafeInteger(rawPage) ? Math.max(1, Math.min(rawPage, 100000)) : 1;
  const search = (url.searchParams.get('search') || '').trim().slice(0, 100);
  const term = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  const where = `where ($1 = '' or r.reference ilike $2 or r.full_name ilike $2 or r.phone ilike $2)`;
  const count = await dbQuery(`select count(*)::int as total from public.eai_registrations r ${where}`, [search, term]);
  const rows = await dbQuery(`select r.id,r.reference,r.full_name,r.phone,r.programme,r.study_level,r.status,r.expected_fee_pesewas,r.payment_reference,r.payment_verified_at,r.sms_status,r.sms_attempted_at,r.sms_sent_at,r.sms_campaign_id,r.sms_error,r.created_at,e.date_label,e.venue
    from public.eai_registrations r join public.eai_events e on e.id=r.event_id ${where}
    order by r.created_at desc,r.id desc limit 50 offset $3`, [search, term, (page - 1) * 50]);
  return reply(res, 200, {registrations: rows.rows, page, total: count.rows[0].total, pageSize: 50});
}
async function getSmsSettings() {
  const result = await dbQuery('select account_id,sender,message,api_key_encrypted,enabled from public.eai_sms_settings where id=true');
  return result.rows[0] || {account_id:'',sender:'ECKINTOSH',message:defaultMessage,api_key_encrypted:null,enabled:false};
}
async function smsSettings(res) {
  const settings = await getSmsSettings();
  return reply(res, 200, {settings:{account_id:settings.account_id,sender:settings.sender,message:settings.message,has_api_key:!!settings.api_key_encrypted,enabled:settings.enabled}});
}
async function saveSmsSettings(res, data, secret) {
  const existing = await getSmsSettings();
  let value;
  try { value = validSmsSettings(data, !!existing.api_key_encrypted); }
  catch(error) { return reply(res, 400, {error:error.message}); }
  const encrypted = value.apiKey ? encryptApiKey(value.apiKey, secret) : existing.api_key_encrypted;
  await dbQuery(`insert into public.eai_sms_settings(id,account_id,sender,message,api_key_encrypted,enabled) values(true,$1,$2,$3,$4,$5)
    on conflict(id) do update set account_id=excluded.account_id,sender=excluded.sender,message=excluded.message,api_key_encrypted=excluded.api_key_encrypted,enabled=excluded.enabled,updated_at=now()`,
  [value.accountId,value.sender,value.message,encrypted,value.enabled]);
  return reply(res, 200, {ok:true,has_api_key:!!encrypted});
}
async function deliverSms(registration, settings, secret) {
  try {
    const campaign = await sendSms(settings, registration, secret);
    await dbQuery("update public.eai_registrations set sms_status='submitted',sms_sent_at=now(),sms_campaign_id=$2,sms_error=null where id=$1 and sms_status='sending'", [registration.id,campaign]);
    return {status:'submitted'};
  } catch(error) {
    const status = error.definitive ? 'failed' : 'unknown';
    const reason = error.definitive ? error.message : 'The send result is uncertain. Check MNotify before retrying.';
    await dbQuery('update public.eai_registrations set sms_status=$2,sms_error=$3 where id=$1 and sms_status=$4', [registration.id,status,reason,'sending']);
    return {status,error:reason};
  }
}
async function retrySms(res, data, secret) {
  if (typeof data.id !== 'string' || !uuid.test(data.id)) return reply(res, 400, {error:'Invalid registration.'});
  const settings = await getSmsSettings();
  if (!settings.enabled || !settings.api_key_encrypted) return reply(res, 400, {error:'Enable SMS and save an MNotify API key first.'});
  const result = await dbQuery(`update public.eai_registrations set sms_status='sending',sms_attempted_at=now(),sms_error=null
    where id=$1 and status='paid' and (sms_status in ('not_sent','failed','unknown') or (sms_status='sending' and sms_attempted_at<now()-interval '2 minutes'))
    returning id,reference,full_name,phone`, [data.id]);
  if (!result.rowCount) return reply(res, 409, {error:'SMS is already submitted or this registration cannot be sent. Refresh the page.'});
  return reply(res, 200, {sms:await deliverSms(result.rows[0], settings, secret)});
}
async function update(res, data, secret) {
  if (typeof data.id !== 'string' || !uuid.test(data.id)) return reply(res, 400, {error: 'Invalid registration.'});
  const status = data.status;
  const paymentReference = typeof data.payment_reference === 'string' ? data.payment_reference.trim() : '';
  let query, args, smsSettings;
  if (status === 'paid') {
    if (!paymentReference || paymentReference.length > 200) return reply(res, 400, {error: 'Enter the payment transaction reference.'});
    smsSettings = await getSmsSettings();
    const shouldSend = smsSettings.enabled && !!smsSettings.api_key_encrypted;
    query = "update public.eai_registrations set status='paid',payment_reference=$2,payment_verified_at=now(),sms_status=$3,sms_attempted_at=case when $3='sending' then now() else null end where id=$1 and status='pending' returning id,reference,full_name,phone,status,payment_reference,payment_verified_at,sms_status";
    args = [data.id, paymentReference, shouldSend ? 'sending' : 'not_sent'];
  } else if (status === 'cancelled') {
    query = "update public.eai_registrations set status='cancelled' where id=$1 and status='pending' returning reference,status,payment_reference,payment_verified_at";
    args = [data.id];
  } else if (status === 'refunded') {
    query = "update public.eai_registrations set status='refunded' where id=$1 and status='paid' returning reference,status,payment_reference,payment_verified_at";
    args = [data.id];
  } else return reply(res, 400, {error: 'Invalid status change.'});
  try {
    const result = await dbQuery(query, args);
    if (!result.rowCount) return reply(res, 409, {error: 'This registration has already changed. Refresh and try again.'});
    const registration = result.rows[0];
    const sms = status === 'paid' && registration.sms_status === 'sending' ? await deliverSms(registration, smsSettings, secret) : {status:'not_sent'};
    return reply(res, 200, {registration, sms});
  } catch (error) {
    if (error.code === '23505') return reply(res, 409, {error: 'That payment reference is already in use.'});
    throw error;
  }
}
export default async function handler(req, res) {
  if (!['GET','POST'].includes(req.method)) return reply(res, 405, {error: 'Method not allowed.'});
  if (req.method === 'POST' && (!req.headers.origin || !sameOrigin(req))) return reply(res, 403, {error: 'Invalid origin.'});
  try {
    const settings = config();
    if (req.method === 'GET') {
      if (!await hasSession(req, settings)) return reply(res, 401, {error: 'Please sign in.'});
      if (new URL(req.url, 'http://localhost').searchParams.get('view') === 'sms') return await smsSettings(res);
      return await list(res, req);
    }
    let data;
    try { data = body(req); } catch { return reply(res, 400, {error: 'Invalid request.'}); }
    if (data.action === 'login') return await login(req, res, data, settings);
    if (!await hasSession(req, settings)) return reply(res, 401, {error: 'Please sign in.'});
    if (data.action === 'logout') { await clearSession(req, res); return reply(res, 200, {ok: true}); }
    if (data.action === 'sms_settings') return await saveSmsSettings(res, data, settings.secret);
    if (data.action === 'send_sms') return await retrySms(res, data, settings.secret);
    if (data.action === 'update') return await update(res, data, settings.secret);
    return reply(res, 400, {error: 'Invalid request.'});
  } catch { return reply(res, 503, {error: 'Admin service unavailable. Please try again later.'}); }
}
