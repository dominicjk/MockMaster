import type { APIContext } from 'astro';
import fs from 'fs';
import path from 'path';

// JSON file with all questions
const dataPath = path.resolve('./src/data/questions.json');

interface Question {
  id: string;
  "question-type": string; // e.g. 'custom'
  topic: string;            // e.g. 'algebra'
  level: string;            // e.g. 'lc'
  difficulty: number;       // numeric scale (e.g. 1..3)
  timeLimitMinute: number;  // integer minutes
  questionTifUrl?: string;  // Optional tif naming
  solutionTifUrl?: string;
  questionPngUrl?: string;  // Backward compat
  solutionPngUrl?: string;
  tags?: string[];
  complete: boolean;
}

function readAll(): Question[] {
  const raw = fs.readFileSync(dataPath, 'utf-8');
  return JSON.parse(raw) as Question[];
}

function writeAll(data: Question[]) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

// GET /api/questions?topic=&level=&difficulty=&onlyIncomplete=true
export async function get({ url }: APIContext) {
  try {
    let questions = readAll();
    const directId = url.searchParams.get('id');
    if (directId) {
      const found = questions.find(q => q.id === directId);
      if (!found) return new Response(JSON.stringify({ error: 'not-found' }), { status: 404 });
      const payload = {
        ...found,
        questionTifUrl: found.questionTifUrl || found.questionPngUrl,
        solutionTifUrl: found.solutionTifUrl || found.solutionPngUrl,
        questionPngUrl: found.questionPngUrl || found.questionTifUrl,
        solutionPngUrl: found.solutionPngUrl || found.solutionTifUrl,
        timeLimitSeconds: Math.max(0, Math.floor((found.timeLimitMinute || 0) * 60))
      } as Question & { timeLimitSeconds: number };
      return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    }

    const topic = url.searchParams.get('topic');
    const level = url.searchParams.get('level');
    const difficulty = url.searchParams.get('difficulty'); // number as string
    const onlyIncomplete = url.searchParams.get('onlyIncomplete') === 'true';

    if (topic) questions = questions.filter(q => q.topic === topic);
    if (level) questions = questions.filter(q => q.level === level);
    if (difficulty) questions = questions.filter(q => String(q.difficulty) === difficulty);
    if (onlyIncomplete) questions = questions.filter(q => !q.complete);

    if (questions.length === 0) {
      return new Response(JSON.stringify({ error: 'no-question' }), { status: 404 });
    }

    const chosen = questions[Math.floor(Math.random() * questions.length)];
    const payload = {
      ...chosen,
      // Normalise field names so client can use either
      questionTifUrl: chosen.questionTifUrl || chosen.questionPngUrl,
      solutionTifUrl: chosen.solutionTifUrl || chosen.solutionPngUrl,
      questionPngUrl: chosen.questionPngUrl || chosen.questionTifUrl,
      solutionPngUrl: chosen.solutionPngUrl || chosen.solutionTifUrl,
      timeLimitSeconds: Math.max(0, Math.floor((chosen.timeLimitMinute || 0) * 60))
    } as Question & { timeLimitSeconds: number };

    return new Response(JSON.stringify(payload), {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'server-error' }), { status: 500 });
  }
}

// PATCH /api/questions/:id  (mark complete or toggle fields)
// Body: { complete?: boolean }
export async function patch(ctx: APIContext) {
  try {
    const id = ctx.params?.id as string | undefined;
    if (!id) return new Response(JSON.stringify({ error: 'missing-id' }), { status: 400 });

  const body: { complete?: boolean } = await ctx.request.json().catch(() => ({}));
    const nextComplete = typeof body.complete === 'boolean' ? body.complete : true; // default true

    const all = readAll();
    const idx = all.findIndex(q => q.id === id);
    if (idx === -1) return new Response(JSON.stringify({ error: 'not-found' }), { status: 404 });

  const updated: Question = { ...all[idx], complete: nextComplete };
    all[idx] = updated;
    writeAll(all);

    const payload = {
      ...updated,
      questionTifUrl: updated.questionTifUrl || updated.questionPngUrl,
      solutionTifUrl: updated.solutionTifUrl || updated.solutionPngUrl,
      questionPngUrl: updated.questionPngUrl || updated.questionTifUrl,
      solutionPngUrl: updated.solutionPngUrl || updated.solutionTifUrl,
      timeLimitSeconds: Math.max(0, Math.floor((updated.timeLimitMinute || 0) * 60))
    } as Question & { timeLimitSeconds: number };

    return new Response(JSON.stringify(payload), {
      headers: { 'content-type': 'application/json' }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'server-error' }), { status: 500 });
  }
}

/*
Front-end usage (no converting, PNG directly):

// load
const res = await fetch(`/api/questions?topic=${encodeURIComponent(topic)}&onlyIncomplete=true`, { cache: 'no-store' });
const q = await res.json();
questionImg.innerHTML = `<img src="${q.questionPngUrl}" alt="" class="w-full"/>`;
solutionImg.innerHTML = `<img src="${q.solutionPngUrl}" alt="" class="w-full"/>`;

// mark complete when user clicks "I got it"
await fetch(`/api/questions/${q.id}`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ complete: true })
});
*/
