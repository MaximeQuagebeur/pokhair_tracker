import { readChanges, readHandText } from '@/lib/cloud/db';

// Only compiled for the Vercel build (`.web.ts` page extension, see next.config.mjs).
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 1000;

function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function authorized(request: Request, key: string) {
  const header = request.headers.get('authorization') ?? '';
  return safeEqual(header, `Bearer ${key}`);
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

/**
 * GET /api/cloud?kind=hands|tournaments&stamp=<n>&id=<id>  → change feed page
 * GET /api/cloud?kind=text&id=<handId>                      → raw hand history (replayer)
 */
export async function GET(request: Request) {
  const key = process.env.APP_ACCESS_KEY?.trim();
  if (!key) return json({ error: 'APP_ACCESS_KEY non configurée sur Vercel (redéployez après l’ajout)' }, 503);
  if (!authorized(request, key)) return json({ error: 'Clé d’accès invalide' }, 401);
  const params = new URL(request.url).searchParams;
  const kind = params.get('kind');
  const id = params.get('id') ?? '';
  try {
    if (kind === 'text') {
      if (!id) return json({ error: 'id manquant' }, 400);
      const text = await readHandText(id);
      return text === null ? json({ error: 'Main introuvable' }, 404) : json({ id, text });
    }
    if (kind !== 'hands' && kind !== 'tournaments') return json({ error: 'kind invalide' }, 400);
    const stamp = Number(params.get('stamp') ?? 0);
    const page = await readChanges(kind, { stamp: Number.isFinite(stamp) ? stamp : 0, id }, PAGE_SIZE);
    return json(page);
  } catch (err) {
    console.error('[cloud]', err);
    return json({ error: 'Base cloud indisponible' }, 502);
  }
}
