import type { APIContext } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';

type Question = {
  id: string;
  ['question-type']: string;
  topic: string;
  level: string;
  difficulty: number;
  timeLimitMinute: number;
  questionTifUrl: string;
  solutionTifUrl: string;
  tags?: string[];
  complete: boolean;
};

const DATA_PATH = path.resolve(import.meta.dirname!, '../../data/questions.json');

async function readAll(): Promise<Question[]> {
  const fileUrl = new URL('../../data/questions.json', import.meta.url);
  const text = await fs.readFile(fileUrl, 'utf8');
  return JSON.parse(text);
}

async function writeAll(data: Question[]) {
  // Write to the real file path (node:fs needs a file system path)
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(DATA_PATH, json, 'utf8');
}

export async function patch({ params, request }: APIContext) {
  try {
    const { id } = params as { id: string };
    if (!id) return new Response('Missing id', { status: 400 });

    const body = await request.json().catch(() => ({} as any));
    // Supported fields to mutate (keep it tight)
    const mutate = {
      complete: typeof body.complete === 'boolean' ? body.complete : undefined
    };

    const all = await readAll();
    const idx = all.findIndex(q => q.id === id);
    if (idx === -1) return new Response('Not found', { status: 404 });

    const updated = { ...all[idx], ...mutate };
    all[idx] = updated;

    await writeAll(all);

    // Include computed seconds for client consistency
    const payload = {
      ...updated,
      timeLimitSeconds: Math.max(0, Math.floor((updated.timeLimitMinute ?? 0) * 60))
    };

    return new Response(JSON.stringify(payload), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'failed-to-update' }), { status: 500 });
  }
}

// Optional: GET single by id
export async function get({ params }: APIContext) {
  const { id } = params as { id: string };
  const all = await readAll();
  const item = all.find(q => q.id === id);
  if (!item) return new Response('Not found', { status: 404 });
  const payload = { ...item, timeLimitSeconds: Math.max(0, Math.floor((item.timeLimitMinute ?? 0) * 60)) };
  return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } });
}
