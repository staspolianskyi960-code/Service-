// Reads a VIN or a part number from a photo using Claude (vision).
// Needs the ANTHROPIC_API_KEY environment variable in Vercel project settings.
const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
const ALLOWED = /^https:\/\/(sklad-stas[a-z0-9-]*\.vercel\.app)$|^http:\/\/localhost(:\d+)?$/;

const PROMPTS = {
  vin: 'This photo shows a vehicle VIN: a door-jamb sticker, windshield plate, registration card or title. ' +
       'Read the 17-character VIN exactly. VINs never contain I, O or Q. ' +
       'If several readings are possible, list the most likely first. ' +
       'Reply with only JSON: {"vins":["..."]} or {"vins":[]} if no VIN is visible.',
  part: 'This photo shows an auto part, its box or label. Find the manufacturer part number(s). ' +
        'Reply with only JSON: {"codes":["most likely part number", "..."], "name":"short part name in English or empty"}.'
};

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (origin && !ALLOWED.test(origin)) return res.status(403).json({ error: 'forbidden' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'no_key' });

  const { image, mode } = req.body || {};
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(image || '');
  if (!m || !PROMPTS[mode]) return res.status(400).json({ error: 'bad_request' });
  if (m[2].length > 4_000_000) return res.status(413).json({ error: 'too_large' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
          { type: 'text', text: PROMPTS[mode] }
        ]}]
      })
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: 'upstream', detail: j && j.error && j.error.type });
    const text = (j.content || []).map(c => c.text || '').join('');
    const json = JSON.parse((text.match(/\{[\s\S]*\}/) || ['{}'])[0]);
    return res.status(200).json(json);
  } catch (e) {
    return res.status(500).json({ error: 'failed' });
  }
};
