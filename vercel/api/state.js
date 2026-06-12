import { kv } from '@vercel/kv';
const KEY = 'ppc_grade_estado';
export default async function handler(req, res) {
  if (req.method === 'GET') {
    const s = await kv.get(KEY);
    return res.status(200).json(s || {});
  }
  if (req.method === 'POST') {
    const body = req.body || {};
    const cur = await kv.get(KEY);
    const curVersion = (cur && typeof cur.version === 'number') ? cur.version : 0;
    const sentVersion = (typeof body.version === 'number') ? body.version : 0;
    if (cur && sentVersion !== curVersion) {
      // conflito de concorrência: devolve o estado atual para merge no cliente
      return res.status(409).json(cur);
    }
    body.version = curVersion + 1;
    await kv.set(KEY, body);
    return res.status(200).json({ ok: true, version: body.version });
  }
  res.status(405).end();
}
