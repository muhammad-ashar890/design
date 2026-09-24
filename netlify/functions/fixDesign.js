// DesignCoach /api/fix-design — generates fixed design as SVG mockup
const R = (c, b) => ({
  statusCode: c,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(b)
});

async function generateFix({ mime, data, issues, fixAll }) {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || 'gemini-3.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const issueList = issues.map((i, idx) =>
    `${idx + 1}. [${i.severity.toUpperCase()}] ${i.title}: ${i.description} (Fix: ${i.how_to_improve})`
  ).join('\n');

  const SYSTEM = `You are DesignCoach. The user has a design with issues. You must generate a FIXED version of their design as an SVG.

Look at the original design image carefully. Then create an SVG that:
1. Keeps the same layout, text content, and overall structure
2. Fixes the specific issues mentioned
3. Looks professional and polished

Reply with ONLY one JSON object:
{
  "fixed_svg": "<svg>...the complete SVG code...</svg>",
  "changes_made": ["Change 1: what was fixed", "Change 2: what was fixed"],
  "summary": "Brief summary of all changes made"
}

IMPORTANT SVG RULES:
- Use viewBox="0 0 600 800" or appropriate size
- Include ALL text from the original design
- Use web-safe fonts (Arial, Helvetica, sans-serif)
- Make colors high contrast for readability
- Keep the same general layout structure
- Make it look like a real, polished design`;

  const parts = [
    { inline_data: { mime_type: mime, data: data } },
    { text: `Fix these issues in this design:\n\n${issueList}\n\nGenerate the fixed version as SVG.${fixAll ? ' Fix ALL issues.' : ' Fix the most critical issue.'}` }
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
        systemInstruction: { parts: [{ text: SYSTEM }] },
        generationConfig: {
          maxOutputTokens: 16000,
          temperature: 0.3,
          responseMimeType: 'application/json'
        }
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error('Gemini API error ' + res.status + ': ' + errBody);
    }

    const j = await res.json();
    const raw = (j.candidates || [])
      .flatMap(c => (c.content?.parts || []))
      .map(p => p.text || '')
      .join('');

    // Find the JSON object - handle cases where model adds extra text
    let result;
    try {
      // Try parsing the whole thing first
      result = JSON.parse(raw);
    } catch {
      // Find the last valid JSON object
      const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
      if (s < 0 || e < 0) throw new Error('no json');
      try {
        result = JSON.parse(raw.slice(s, e + 1));
      } catch {
        // Try to find balanced braces
        let depth = 0, end = s;
        for (let i = s; i < raw.length; i++) {
          if (raw[i] === '{') depth++;
          if (raw[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
        }
        result = JSON.parse(raw.slice(s, end + 1));
      }
    }

    // Clean and convert SVG to data URL
    let svgData = result.fixed_svg || '';
    // Remove markdown code blocks if present
    svgData = svgData.replace(/```svg\n?/g, '').replace(/```\n?/g, '').trim();
    // Ensure it starts with <svg
    const svgStart = svgData.indexOf('<svg');
    if (svgStart > 0) svgData = svgData.slice(svgStart);
    // Ensure it ends with </svg>
    const svgEnd = svgData.lastIndexOf('</svg>');
    if (svgEnd >= 0) svgData = svgData.slice(0, svgEnd + 6);
    
    if (svgData && svgData.includes('<svg')) {
      svgData = 'data:image/svg+xml;base64,' + Buffer.from(svgData).toString('base64');
    } else {
      svgData = '';
    }

    return {
      fixed_image: svgData,
      changes_made: result.changes_made || [],
      description: result.summary || 'Fixed design with issues resolved.'
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

    const result = await generateFix({ mime, data, issues, fixAll: !!fixAll });
    return R(200, result);
  } catch (err) {
    console.error('fix-design failed:', err && err.message);
    return R(502, { error: 'Could not generate fixed design: ' + (err?.message || 'Unknown error') });
  }
};
