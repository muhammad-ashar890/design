// DesignCoach /api/fix-design — generates a FIXED version of the design image
const MAGIC = { 'image/jpeg': [0xff, 0xd8], 'image/png': [0x89, 0x50], 'image/webp': [0x52, 0x49] };
const MAX = 10 * 1024 * 1024;
const R = (c, b) => ({
  statusCode: c,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(b)
});

async function generateFixedImage({ mime, data, issues, fixAll }) {
  const apiKey = process.env.AI_API_KEY;
  // Use image generation model
  const model = 'gemini-2.0-flash-exp';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const issueList = issues.map((i, idx) =>
    `${idx + 1}. [${i.severity.toUpperCase()}] ${i.title}: ${i.description} (Fix: ${i.how_to_improve})`
  ).join('\n');

  const prompt = fixAll
    ? `Edit this design image to fix ALL of these issues. Keep the same overall layout, content, text, and style — only fix the problems listed below. Do NOT add new content or change the message. Output ONLY the fixed image.

Issues to fix:
${issueList}

Rules:
- Keep all original text and content
- Keep the same general layout and style
- Only fix the specific issues mentioned
- Make it look professional and polished
- Ensure good contrast and readability`
    : `Edit this design image to fix this one issue. Keep everything else exactly the same — only fix this specific problem. Output ONLY the fixed image.

Issue to fix:
${issueList}

Rules:
- Keep all original text and content  
- Keep everything else identical
- Only change what's needed to fix this issue
- Make it look professional`;

  const parts = [
    { inline_data: { mime_type: mime, data: data } },
    { text: prompt }
  ];

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 90000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
          temperature: 0.4
        }
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error('Gemini API error ' + res.status + ': ' + errBody);
    }

    const j = await res.json();
    const candidates = j.candidates || [];
    
    // Extract image and text from response
    let fixedImage = null;
    let description = '';
    
    for (const c of candidates) {
      for (const p of (c.content?.parts || [])) {
        if (p.inlineData) {
          fixedImage = {
            mime: p.inlineData.mimeType || 'image/png',
            data: p.inlineData.data
          };
        }
        if (p.text) {
          description += p.text;
        }
      }
    }

    if (!fixedImage) {
      throw new Error('Could not generate fixed image. The model may not support image editing for this type of design.');
    }

    return {
      fixed_image: 'data:' + fixedImage.mime + ';base64,' + fixedImage.data,
      description: description || 'Fixed design with issues resolved.'
    };
  } finally { clearTimeout(t); }
}

exports.handler = async (e) => {
  if (e.httpMethod !== 'POST') return R(405, { error: 'Method not allowed.' });
  if (!process.env.AI_API_KEY) return R(500, { error: 'API key not configured.' });

  try {
    const body = JSON.parse(e.body || '{}');
    const image = body.image;
    const issues = body.issues;
    const fixAll = body.fixAll;

    if (!image || !issues || !issues.length) return R(400, { error: 'Missing image or issues.' });

    const cut = image.indexOf(';base64,');
    if (!image.startsWith('data:') || cut < 0) return R(400, { error: 'Invalid image format.' });

    const mime = image.slice(5, cut);
    const data = image.slice(cut + 8);

    const buf = Buffer.from(data, 'base64');
    if (buf.length > MAX) return R(413, { error: 'Image too large.' });

    const result = await generateFixedImage({ mime, data, issues, fixAll: !!fixAll });
    return R(200, result);
  } catch (err) {
    console.error('fix-design failed:', err && err.message);
    return R(502, { error: 'Could not generate fixed image: ' + (err?.message || 'Unknown error') });
  }
};
