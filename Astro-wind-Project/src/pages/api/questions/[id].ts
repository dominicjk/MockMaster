import type { APIContext } from 'astro';
import fs from 'fs';
import path from 'path';
export const prerender = false;
interface Question { id:string; 'question-type':string; topic:string; level:string; difficulty:number; timeLimitMinute:number; questionTifUrl?:string; solutionTifUrl?:string; questionPngUrl?:string; solutionPngUrl?:string; tags?:string[]; complete:boolean; }
const DATA_PATH = path.resolve('./src/data/questions.json');
function readAll(): Question[] { try { return JSON.parse(fs.readFileSync(DATA_PATH,'utf-8')) as Question[]; } catch { return []; } }
function writeAll(all:Question[]) { fs.writeFileSync(DATA_PATH, JSON.stringify(all,null,2)); }
function serialize(q: Question) { return { ...q, questionTifUrl: q.questionTifUrl || q.questionPngUrl, solutionTifUrl: q.solutionTifUrl || q.solutionPngUrl, questionPngUrl: q.questionPngUrl || q.questionTifUrl, solutionPngUrl: q.solutionPngUrl || q.solutionTifUrl, timeLimitSeconds: Math.max(0, Math.floor((q.timeLimitMinute || 0) * 60)) }; }
export async function get({ params }: APIContext) { const id = params?.id as string|undefined; if(!id) return new Response(JSON.stringify({error:'missing-id'}),{status:400}); const all = readAll(); const f = all.find(q=>q.id===id); if(!f) return new Response(JSON.stringify({error:'not-found'}),{status:404}); return new Response(JSON.stringify(serialize(f)), { headers: { 'content-type': 'application/json' } }); }
export async function patch({ params, request }: APIContext) { const id = params?.id as string|undefined; if(!id) return new Response(JSON.stringify({error:'missing-id'}),{status:400}); const body: { complete?: boolean } = await request.json().catch(()=>({})); const all = readAll(); const idx = all.findIndex(q=>q.id===id); if(idx===-1) return new Response(JSON.stringify({error:'not-found'}),{status:404}); const updated: Question = { ...all[idx], ...(typeof body.complete==='boolean'?{complete:body.complete}:{}) }; all[idx]=updated; writeAll(all); return new Response(JSON.stringify(serialize(updated)), { headers: { 'content-type': 'application/json' } }); }
