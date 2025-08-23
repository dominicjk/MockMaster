import type { APIContext } from 'astro';
import fs from 'fs';
import path from 'path';

export const prerender = false;

interface Question { id:string; 'question-type':string; topic:string; level:string; difficulty:number; timeLimitMinute:number; questionTifUrl?:string; solutionTifUrl?:string; questionPngUrl?:string; solutionPngUrl?:string; tags?:string[]; complete:boolean; }
const DATA_PATH = path.resolve('./src/data/questions.json');
const jsonNoStore = { 'content-type': 'application/json', 'cache-control': 'no-store' } as const;
function readAll(): Question[] { try { return JSON.parse(fs.readFileSync(DATA_PATH,'utf-8')) as Question[]; } catch { return []; } }
function serialize(q: Question) { return { ...q, questionTifUrl: q.questionTifUrl || q.questionPngUrl, solutionTifUrl: q.solutionTifUrl || q.solutionPngUrl, questionPngUrl: q.questionPngUrl || q.questionTifUrl, solutionPngUrl: q.solutionPngUrl || q.solutionTifUrl, timeLimitSeconds: Math.max(0, Math.floor((q.timeLimitMinute || 0) * 60)) }; }
export async function get({ url }: APIContext) { try { const all = readAll(); const id = url.searchParams.get('id'); if (id) { const f = all.find(q=>q.id===id); if(!f) return new Response(JSON.stringify({error:'not-found'}),{status:404}); return new Response(JSON.stringify(serialize(f)), { headers: jsonNoStore }); } let filtered = all; const topic=url.searchParams.get('topic'); const level=url.searchParams.get('level'); const difficulty=url.searchParams.get('difficulty'); const onlyIncomplete=url.searchParams.get('onlyIncomplete')==='true'; if(topic) filtered=filtered.filter(q=>q.topic===topic); if(level) filtered=filtered.filter(q=>q.level===level); if(difficulty) filtered=filtered.filter(q=>String(q.difficulty)===difficulty); if(onlyIncomplete) filtered=filtered.filter(q=>!q.complete); if(!filtered.length) return new Response(JSON.stringify({error:'no-question'}),{status:404}); const chosen=filtered[Math.floor(Math.random()*filtered.length)]; return new Response(JSON.stringify(serialize(chosen)), { headers: jsonNoStore }); } catch { return new Response(JSON.stringify({ error: 'server-error' }), { status: 500 }); } }
