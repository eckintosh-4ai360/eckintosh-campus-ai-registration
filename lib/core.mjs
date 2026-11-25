import pg from 'pg';
const levels=new Set(['Level 100','Level 200','Level 300','Level 400','Level 500','Level 600','Postgraduate','Other']);
const experiences=new Set(['','New to AI','Occasional user','Regular user','Advanced user']);
export const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validReference(value){return /^(?:AI-UG-[0-9]{4}|AIUG[0-9]{4}|EAI-[A-F0-9]{32})$/.test(value);}
export function validPhone(value){const digits=value.replace(/\D/g,'');return /^\+?[\d ().-]{7,25}$/.test(value)&&digits.length>=7&&digits.length<=15;}
export function validate(input){
 const p=input||{};
 const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max+1):'';
 const data={p_event_id:clean(p.event_id,36),p_name:clean(p.name,120),p_email:null,p_phone:clean(p.phone,25),p_institution:null,p_programme:clean(p.programme,160),p_level:clean(p.level,30),p_experience:clean(p.experience,30)};
 if(!uuid.test(data.p_event_id))throw new Error('Workshop details are unavailable. Please refresh and try again.');
 if(data.p_name.length<2||data.p_name.length>120)throw new Error('Enter your full name (at least 2 characters).');
 if(!validPhone(data.p_phone))throw new Error('Enter a valid phone number with 7 to 15 digits.');
 if(!data.p_programme||data.p_programme.length>160)throw new Error('Enter your programme of study.');
 if(!levels.has(data.p_level))throw new Error('Select your level of study.');
 if(!experiences.has(data.p_experience))throw new Error('Select a valid AI experience.');
 if(p.consent!==true)throw new Error('Please accept the privacy notice.');
 return data;
}
export function reply(res,status,data){res.setHeader('Cache-Control','no-store');return res.status(status).json(data);}
export function sameOrigin(req){const origin=req.headers.origin;const host=req.headers.host;return !origin||origin===`https://${host}`||(process.env.NODE_ENV!=='production'&&origin===`http://${host}`);}
export function body(req){const data=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!data||typeof data!=='object'||Array.isArray(data)||Buffer.byteLength(JSON.stringify(data))>12000)throw new Error('Invalid request.');return data;}
let pool;
export async function dbQuery(query,values=[]){
 if(!process.env.DATABASE_URL)throw new Error('Database configuration unavailable');
 pool ||= new pg.Pool({connectionString:process.env.DATABASE_URL,enableChannelBinding:true,max:5,connectionTimeoutMillis:8000,idleTimeoutMillis:10000,statement_timeout:8000});
 return pool.query(query,values);
}
export async function rpc(name,args={}){
 const queries={
  eai_public_event:['select public.eai_public_event() as result',[]],
  eai_register:['select public.eai_register($1,$2,$3,$4,$5,$6,$7,$8) as result',['p_event_id','p_name','p_email','p_phone','p_institution','p_programme','p_level','p_experience']],
  eai_status:['select public.eai_status($1,$2) as result',['p_reference','p_phone']]
 };
 const query=queries[name];
 if(!query)throw new Error('Database configuration unavailable');
 const result=await dbQuery(query[0],query[1].map(key=>args[key]));
 return result.rows[0].result;
}
