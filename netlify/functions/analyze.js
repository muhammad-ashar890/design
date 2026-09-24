// DesignCoach /api/analyze — validates the upload, calls the AI service, returns checked JSON.
const { analyzeDesign } = require('./aiService');
const MAGIC = { 'image/jpeg': [0xff, 0xd8], 'image/png': [0x89, 0x50], 'image/webp': [0x52, 0x49], 'application/pdf': [0x25, 0x50] };
const MAX = 10 * 1024 * 1024;
const R = (c, b) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

exports.handler = async (e) => {
  if (e.httpMethod !== 'POST') return R(405, { error: 'Method not allowed.' });
  if (!process.env.AI_API_KEY) return R(500, { error: 'DesignCoach is not configured yet: the AI_API_KEY environment variable is missing. See the README.' });
  let mime, buf;
  try {
    const image = JSON.parse(e.body || '{}').image || '';
    const cut = image.indexOf(';base64,');
    if (!image.startsWith('data:') || cut < 0) throw 0;
    mime = image.slice(5, cut);
    buf = Buffer.from(image.slice(cut + 8), 'base64');
  } catch { return R(400, { error: 'No valid file was received. Please upload your design again.' }); }
  if (!MAGIC[mime]) return R(415, { error: 'Unsupported file type. Please upload a PNG, JPG, WEBP or PDF.' });
  if (!buf.length) return R(400, { error: 'The uploaded file is empty.' });
  if (buf.length > MAX) return R(413, { error: 'That file is larger than 10 MB.' });
  if (buf[0] !== MAGIC[mime][0] || buf[1] !== MAGIC[mime][1]) return R(400, { error: 'That file looks corrupted or is not what its extension says.' });
  try {
    return R(200, await analyzeDesign({ mime, data: buf.toString('base64') }));
  } catch (err) {
    console.error('analyze failed:', err && err.message);
    return R(502, { error: 'Something went wrong while analyzing your design. Please try again.' });
  }
};
