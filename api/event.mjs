import {rpc,reply} from '../lib/core.mjs';
export default async function handler(req,res){if(req.method!=='GET')return reply(res,405,{error:'Method not allowed.'});try{const event=await rpc('eai_public_event');return reply(res,200,{event});}catch{return reply(res,503,{error:'Registration service unavailable.'});}}
