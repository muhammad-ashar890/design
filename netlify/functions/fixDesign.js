// DesignCoach /api/fix-design — takes image + issues, returns fix instructions
const KB = require('../../public/knowledge.js');

async function callFixModel({ mime, data, issues, fixAll }) {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || 'gemini-3.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const issueList = issues.map((i, idx) =>
    `${idx + 1}. [${i.severity.toUpperCase()}] ${i.title}\n   Problem: ${i.description}\n   Category: ${i.cat}\n   Current fix suggestion: ${i.how_to_improve}`
  ).join('\n\n');

  const SYSTEM = `You are DesignCoach, an expert graphic design mentor. The user wants to fix issues in their design.

For EACH issue provided, give SPECIFIC, ACTIONABLE fix instructions that a beginner can follow.

Reply with ONLY one JSON object in this EXACT shape:
{
  "fixes": [
    {
      "issue_title": "exact issue title",
      "steps": ["Step 1: do this", "Step 2: do that", "Step 3: etc"],
      "css_changes": "any CSS code if applicable, or empty string",
      "specific_values": {"color": "#hex or empty", "font_size": "16px or empty", "margin": "16px or empty"},
      "before_description": "what it looks like now",
      "after_description": "what it should look like after fix",
      "difficulty": "easy|medium|hard",
      "time_estimate": "5 minutes"
    }
  ],
  "overall_fix_plan": {
    "priority_order": ["fix 1 title", "fix 2 title"],
    "quick_wins": ["easy fixes that make big impact"],
    "summary": "Brief summary of all fixes"
  }
}

IMPORTANT:
- Be VERY specific with values (exact hex colors, exact pixel sizes, exact font weights)
- Give step-by-step instructions a beginner can follow
- If it is a code fix (CSS/HTML), provide the actual code
- Estimate difficulty and time for each fix
- Prioritize fixes by impact
- Explain in simple, friendly language`;

  const parts = [
    { inline_data: { mime_type: mime, data: data } },
    { text: `Analyze this design and provide fix instructions for these issues:\n\n${issueList}\n\n${fixAll ? 'Provide fixes for ALL issues listed above.' : 'Provide fix for the FIRST issue only.'}` }
  ];

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 80000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        systemInstruction: { parts: [{ text: SYSTEM }] },
        generationConfig: {
          maxOutputTokens: 8000,
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

    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s < 0 || e < 0) throw new Error('no json');
    return JSON.parse(raw.slice(s, e + 1));
  } finally { clearTimeout(t); }
}

const R = (c, b) => ({
  statusCode: c,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(b)
});

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

    const result = await callFixModel({ mime, data, issues, fixAll: !!fixAll });
    return R(200, result);
  } catch (err) {
    console.error('fix-design failed:', err && err.message);
    return R(502, { error: 'Could not generate fix instructions. Please try again.' });
  }
};
