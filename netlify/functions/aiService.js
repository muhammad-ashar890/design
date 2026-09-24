// AI provider layer. To switch provider, only change callModel() below.
const KB = require('../../public/knowledge.js');
const CATS = ['alignment', 'spacing', 'typography', 'color', 'readability', 'hierarchy', 'composition', 'grammar'];
const clamp = (n, a, b) => Math.max(a, Math.min(b, Number.isFinite(+n) ? +n : a));
const str = (v) => (typeof v === 'string' ? v : '');

const SYSTEM = `You are DesignCoach, a warm, expert graphic design mentor for beginners. Critique the supplied design (image or PDF).
Reply with ONLY one JSON object, no markdown, in this shape:
{"overall":{"score":0-100,"summary":""},"categories":{${CATS.map((c) => `"${c}":{"score":0-100,"issues":[]}`).join(',')}},"strengths":[""],"recommendations":[""],"learning_topics":[""]}
Each issue: {"title","severity":"critical|important|minor","description","why_it_matters","how_to_improve","learning_tip","location":{"x","y","width","height"} or null}.
Rules: coordinates are percentages 0-100 of the image (x,y = top-left). If you are not confident where an issue is, use null; never invent coordinates.
Never name an exact font; say e.g. "appears to be a modern sans-serif". Give HEX colors only as approximate. Always include real strengths. Reserve "critical" for problems that seriously hurt readability or communication; never for taste. Scores measure adherence to the principles, not artistic talent. Only suggest copy rewrites when they truly improve clarity. Explain in beginner-friendly language. For learning_topics use: ${KB.lessons.map((l) => l.title).join(', ')}.
Design principles to apply:
${KB.lessons.map((l) => `- ${l.title}: ${l.what} Common mistake: ${l.mistake} Good practice: ${l.good}`).join('\n')}`;

async function callModel({ mime, data }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 55000);
  try {
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL || 'gemini-3.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    // Build parts array based on mime type
    const parts = [];
    
    // Add image/document part
    parts.push({
      inline_data: {
        mime_type: mime,
        data: data
      }
    });
    
    // Add text prompt
    parts.push({
      text: 'Analyze this design now. JSON only.'
    });
    
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        systemInstruction: {
          parts: [{ text: SYSTEM }]
        },
        generationConfig: {
          maxOutputTokens: 4000,
          temperature: 0.7,
          responseMimeType: 'application/json'
        }
      }),
    });
    
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Gemini API error ${res.status}: ${errBody}`);
    }
    
    const j = await res.json();
    // Extract text from Gemini response
    return (j.candidates || [])
      .flatMap(c => (c.content?.parts || []))
      .map(p => p.text || '')
      .join('');
  } finally { clearTimeout(t); }
}

function normalize(raw) {
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s < 0 || e < 0) throw new Error('no json');
  const j = JSON.parse(raw.slice(s, e + 1));
  if (!j.categories || !j.overall) throw new Error('bad shape');
  const list = (a) => (Array.isArray(a) ? a.map(str).filter(Boolean) : []);
  const out = { overall: { score: clamp(j.overall.score, 0, 100), summary: str(j.overall.summary) }, categories: {}, strengths: list(j.strengths), recommendations: list(j.recommendations), learning_topics: list(j.learning_topics) };
  for (const c of CATS) {
    const cat = j.categories[c] || {};
    out.categories[c] = { score: clamp(cat.score, 0, 100), issues: (Array.isArray(cat.issues) ? cat.issues : []).map((i) => {
      const L = i.location;
      const ok = L && [L.x, L.y, L.width, L.height].every((n) => Number.isFinite(+n)) && +L.width > 0 && +L.height > 0;
      return { title: str(i.title) || 'Issue', severity: ['critical', 'important', 'minor'].includes(i.severity) ? i.severity : 'minor',
        description: str(i.description), why_it_matters: str(i.why_it_matters), how_to_improve: str(i.how_to_improve), learning_tip: str(i.learning_tip),
        location: ok ? { x: clamp(L.x, 0, 100), y: clamp(L.y, 0, 100), width: clamp(L.width, 1, 100), height: clamp(L.height, 1, 100) } : null };
    }) };
  }
  return out;
}

exports.analyzeDesign = async (file) => normalize(await callModel(file));
