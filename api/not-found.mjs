import {reply} from '../lib/core.mjs';
export default function handler(req,res){return reply(res,404,{error:'Not found.'});}
