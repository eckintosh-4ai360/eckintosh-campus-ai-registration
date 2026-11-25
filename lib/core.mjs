import pg from 'pg';
const levels=new Set(['Level 100','Level 200','Level 300','Level 400','Level 500','Level 600','Postgraduate','Other']);
const experiences=new Set(['','New to AI','Occasional user','Regular user','Advanced user']);
export const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validate(input){const p=input||{};const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max+1):'';const data={p_event_id:clean(p.event_id,36),p_name:clean(p.name,120),p_email:clean(p.email,254).toLowerCase(),p_phone:clean(p.phone,25),p_institution:clean(p.institution,160),p_programme:clean(p.programme,160),p_level:clean(p.level,30),p_experience:clean(p.experience,30)};if(!uuid.test(data.p_event_id)||p.consent!==true||p.website||data.p_name.length<2||data.p_name.length>120||data.p_email.length>254||!emailPattern.test(data.p_email)||!/^\+?[\d ()-]{7,25}$/.test(data.p_phone)||data.p_phone.replace(/\D/g,'').length<7||data.p_phone.replace(/\D/g,'').length>15||!data.p_institution||data.p_institution.length>160||!data.p_programme||data.p_programme.length>160||!levels.has(data.p_level)||!experiences.has(data.p_experience))throw new Error('Please enter valid details in all required fields and accept the privacy notice.');return data;}
export function reply(res,status,data){res.setHeader('Cache-Control','no-store');return res.status(status).json(data);}
export function sameOrigin(req){const origin=req.headers.origin;const host=req.headers.host;return !origin||origin===`https://${host}`||(process.env.NODE_ENV!=='production'&&origin===`http://${host}`);}
export function body(req){const data=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!data||typeof data!=='object'||Array.isArray(data)||Buffer.byteLength(JSON.stringify(data))>12000)throw new Error('Invalid request.');return data;}
let pool;
export async function rpc(name,args={}){
 const queries={
  eai_public_event:['select public.eai_public_event() as result',[]],
  eai_register:['select public.eai_register($1,$2,$3,$4,$5,$6,$7,$8) as result',['p_event_id','p_name','p_email','p_phone','p_institution','p_programme','p_level','p_experience']],
  eai_status:['select public.eai_status($1,$2) as result',['p_reference','p_email']]
 };
 const query=queries[name];
 if(!query||!process.env.DATABASE_URL)throw new Error('Database configuration unavailable');
 pool ||= new pg.Pool({connectionString:process.env.DATABASE_URL,enableChannelBinding:true,max:5,connectionTimeoutMillis:8000,idleTimeoutMillis:10000,statement_timeout:8000});
 const result=await pool.query(query[0],query[1].map(key=>args[key]));
 return result.rows[0].result;
}
export async function verify(token){if(typeof token!=='string'||!token||token.length>2048||!process.env.TURNSTILE_SECRET_KEY||!process.env.TURNSTILE_SITE_KEY||!process.env.TURNSTILE_HOSTNAME)return false;const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY,response:token}),signal:AbortSignal.timeout(8000)});const data=await r.json();return data.success===true&&data.hostname===process.env.TURNSTILE_HOSTNAME;}
