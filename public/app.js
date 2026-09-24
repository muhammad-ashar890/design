const CATS = ['typography', 'spacing', 'alignment', 'color', 'readability', 'hierarchy', 'composition', 'grammar'];
const $ = (s) => document.querySelector(s), app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } } };
const S = { file: null, src: null, pdf: false, result: null, demo: false, sel: null, teach: {}, err: '', busy: false, q: 0, pick: null, stage: 0, fixBusy: false, fixResult: null, fixIssue: null };
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'], MB = 1048576;
const catLesson = (c) => KB.lessons.find((l) => l.id === (c === 'grammar' ? 'readability' : c)) || KB.lessons[0];

/* ---------- demo ---------- */
const DEMO_SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 800'><rect width='600' height='800' fill='#f4efe6'/><text x='60' y='300' font-size='84' font-weight='800' font-family='Arial' fill='#1f2a44'>SUMMER</text><text x='60' y='390' font-size='84' font-weight='800' font-family='Arial' fill='#1f2a44'>SALE</text><text x='60' y='450' font-size='26' font-family='Arial' fill='#e2d79c'>Up to 50% off everything in store</text><rect x='270' y='620' width='240' height='60' rx='8' fill='#c9b458'/><text x='300' y='658' font-size='22' font-family='Arial' fill='#fff'>Shop now</text><text x='60' y='775' font-size='11' font-family='Arial' fill='#999'>Terms and conditions apply. Offer valid while stocks lasts.</text></svg>";
const iss = (title, severity, description, why, how, tip, location) => ({ title, severity, description, why_it_matters: why, how_to_improve: how, learning_tip: tip, location });
const DEMO = {
  design_type: 'Poster', design_type_reason: 'A large-format promotional poster with headline, subtext, and call-to-action button.',
  overall: { score: 62, summary: 'A bold headline gives this poster a strong start, but low-contrast supporting text and a misaligned button weaken it.' },
  categories: { typography: { score: 70, issues: [] }, spacing: { score: 65, issues: [] }, alignment: { score: 55, issues: [iss('Button does not align with the text', 'important', 'The button starts further right than the headline and subtitle.', 'Shared edges make a layout feel intentional.', 'Move the button to the same left edge as the headline (or center everything).', 'Draw a vertical line through your text edges and snap other elements to it.', { x: 45, y: 77, width: 40, height: 8 })] }, color: { score: 55, issues: [] }, readability: { score: 40, issues: [iss('Subtitle is nearly invisible', 'critical', 'Pale yellow text on a beige background has very low contrast.', 'If people cannot read the offer, the poster fails at its main job.', 'Use a dark navy for the subtitle, or place it on a dark block.', 'Aim for a contrast ratio of at least 4.5:1.', { x: 9, y: 52, width: 62, height: 7 })] }, hierarchy: { score: 72, issues: [iss('Button blends into the background', 'important', 'The gold button with white text is weak compared with the headline.', 'The call to action should be easy to find.', 'Use a dark or strongly contrasting button with clear text.', 'Reserve your accent color for the one action you want.', { x: 45, y: 77, width: 40, height: 8 })] }, composition: { score: 68, issues: [] }, grammar: { score: 80, issues: [iss('Small verb error in footer', 'minor', '"Offer valid while stocks lasts" should read "while stocks last".', 'Small copy slips reduce trust.', 'Change "lasts" to "last". The footer text is also very small.', 'Proofread text out loud.', { x: 9, y: 95, width: 72, height: 3 })] } },
  strengths: ['The bold navy headline is clear and is the first thing you notice.', 'A simple, limited palette keeps the poster uncluttered.', 'Generous white space around the headline gives it room to breathe.'],
  recommendations: ['Darken the subtitle so it is readable.', 'Align the button to the left edge shared by the text.', 'Make the button higher-contrast.', 'Fix the footer grammar.'],
  learning_topics: ['Contrast', 'Alignment', 'Visual Hierarchy'],
  accessibility: { contrast_issues: ['Subtitle text has very low contrast against background'], font_size_issues: ['Footer text is very small'], color_blindness_risk: 'low', overall_rating: 'C' },
  design_suggestions: { color_palette: ['#1f2a44', '#f4efe6', '#c9b458'], layout_tip: 'Align all left edges to a single vertical line for a cleaner look.' }
};

/* ---------- helpers ---------- */
const issues = (r) => { let a = []; for (const c of CATS) for (const i of r.categories[c]?.issues || []) a.push({ ...i, cat: c }); const o = { critical: 0, important: 1, minor: 2 }; return a.sort((x, y) => o[x.severity] - o[y.severity]).map((x, n) => ({ ...x, n: n + 1 })); };
const hist = () => store.get('dc_history', []);
const settings = () => ({ save: true, ...store.get('dc_settings', {}) });
const readData = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function shrink(src, max, q) { const i = await loadImg(src), k = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement('canvas'); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(i, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', q); }
const go = (h) => { location.hash = h; };
const scoreColor = (s) => s >= 75 ? 'var(--ok)' : s >= 50 ? 'var(--imp)' : 'var(--crit)';
const scoreLabel = (s) => s >= 85 ? 'Excellent' : s >= 70 ? 'Good' : s >= 50 ? 'Fair' : s >= 30 ? 'Needs Work' : 'Poor';

/* ---------- paste support ---------- */
async function handlePaste(e) {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) {
        const ext = item.type.split('/')[1] || 'png';
        const namedFile = new File([file], `pasted-design.${ext}`, { type: item.type });
        pick(namedFile);
        return;
      }
    }
  }
}
document.addEventListener('paste', handlePaste);

async function pick(f) {
  S.err = '';
  if (!f) return;
  if (!TYPES.includes(f.type) && !f.type.startsWith('image/')) S.err = 'Unsupported file. Please choose a PNG, JPG, WEBP or PDF.';
  else if (!f.size) S.err = 'That file is empty.';
  else if (f.size > 10 * MB) S.err = 'That file is larger than 10 MB.';
  else if (f.type === 'application/pdf' && f.size > 4 * MB) S.err = 'PDFs are limited to about 4 MB. Export your design as PNG or JPG instead, or compress the PDF.';
  if (S.err) return render();
  try {
    const d = await readData(f);
    S.pdf = f.type === 'application/pdf'; S.file = { name: f.name, size: f.size }; S.demo = false;
    S.src = S.pdf ? d : await shrink(d, 1800, 0.85);
  } catch { S.err = 'We could not read that file. It may be corrupted.'; S.file = null; S.src = null; }
  render();
}

async function analyze() {
  S.busy = true; S.err = ''; S.stage = 0; render();
  const timer = setInterval(() => { S.stage = Math.min(S.stage + 1, 6); render(); }, 3000);
  const ctrl = new AbortController(), to = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal, body: JSON.stringify({ image: S.src }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Something went wrong while analyzing your design. Please try again.');
    S.result = j; S.demo = false; S.sel = null; S.teach = {};
    if (settings().save) saveHistory();
    S.busy = false; clearInterval(timer); go('analysis'); render();
  } catch (e) {
    S.err = e.name === 'AbortError' ? 'The analysis took too long. Try a smaller image or try again.' : (e instanceof TypeError ? 'Network problem. Check your connection and try again.' : e.message);
    S.busy = false;
  } finally { clearInterval(timer); clearTimeout(to); render(); }
}
async function saveHistory() {
  const thumb = S.pdf ? '' : await shrink(S.src, 320, 0.6), n = issues(S.result).length;
  const h = [{ id: Date.now(), name: S.file?.name || 'Design', date: new Date().toISOString(), score: S.result.overall.score, count: n, thumb, result: S.result }, ...hist()].slice(0, 30);
  while (h.length && !store.set('dc_history', h)) h.pop();
}

/* ---------- fix functionality ---------- */
async function fixIssue(issueIdx) {
  if (!S.result || !S.src) return;
  const is = issues(S.result);
  const issue = is[issueIdx];
  if (!issue) return;

  S.fixBusy = true; S.fixResult = null; S.fixIssue = issueIdx; render();

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 120000);

  try {
    const res = await fetch('/api/fix-design', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({ image: S.src, issues: [issue], fixAll: false })
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Could not generate fix instructions.');
    S.fixResult = j; S.fixBusy = false;
  } catch (e) {
    S.fixResult = { error: e.name === 'AbortError' ? 'Request timed out. Try again.' : e.message };
    S.fixBusy = false;
  } finally { clearTimeout(to); render(); }
}

async function fixAllIssues() {
  if (!S.result || !S.src) return;
  const is = issues(S.result);
  if (!is.length) return;

  S.fixBusy = true; S.fixResult = null; S.fixIssue = 'all'; render();

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 120000);

  try {
    const res = await fetch('/api/fix-design', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({ image: S.src, issues: is, fixAll: true })
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Could not generate fix instructions.');
    S.fixResult = j; S.fixBusy = false;
  } catch (e) {
    S.fixResult = { error: e.name === 'AbortError' ? 'Request timed out. Try again.' : e.message };
    S.fixBusy = false;
  } finally { clearTimeout(to); render(); }
}

function closeFix() {
  S.fixResult = null; S.fixIssue = null; render();
}

/* ---------- export helpers ---------- */
function generateShareText(r) {
  const is = issues(r);
  let txt = `DESIGNCOACH ANALYSIS\n${'='.repeat(40)}\n\n`;
  txt += `Design Type: ${r.design_type || 'Unknown'}\n`;
  txt += `Overall Score: ${r.overall.score}/100 (${scoreLabel(r.overall.score)})\n`;
  txt += `Summary: ${r.overall.summary}\n\n`;
  txt += `CATEGORY SCORES:\n`;
  for (const c of CATS) txt += `  ${c.charAt(0).toUpperCase() + c.slice(1)}: ${r.categories[c].score}/100\n`;
  if (r.accessibility) {
    txt += `\nACCESSIBILITY:\n`;
    txt += `  WCAG Rating: ${r.accessibility.overall_rating || 'N/A'}\n`;
    txt += `  Color Blindness Risk: ${r.accessibility.color_blindness_risk || 'Unknown'}\n`;
  }
  txt += `\nISSUES (${is.length}):\n`;
  is.forEach((i, idx) => { txt += `  ${idx + 1}. [${i.severity.toUpperCase()}] ${i.title}\n     ${i.description}\n     Fix: ${i.how_to_improve}\n\n`; });
  txt += `STRENGTHS:\n`;
  (r.strengths || []).forEach(s => { txt += `  + ${s}\n`; });
  txt += `\nRECOMMENDATIONS:\n`;
  (r.recommendations || []).forEach((s, i) => { txt += `  ${i + 1}. ${s}\n`; });
  if (r.design_suggestions?.color_palette?.length) txt += `\nSuggested Colors: ${r.design_suggestions.color_palette.join(', ')}\n`;
  if (r.design_suggestions?.layout_tip) txt += `Layout Tip: ${r.design_suggestions.layout_tip}\n`;
  return txt;
}
function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}
function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}

/* ---------- views ---------- */
function home() {
  if (S.busy) {
    const st = ['Detecting design type', 'Checking typography', 'Checking spacing & alignment', 'Checking color & contrast', 'Analyzing hierarchy & composition', 'Checking accessibility', 'Preparing feedback'];
    return `<div class="load card" role="status" aria-live="polite"><div class="spin"></div><h2 style="margin-top:0">Analyzing your design...</h2><ul style="padding:0">${st.map((s, i) => `<li class="${i < S.stage ? 'done' : i === S.stage ? 'on' : ''}">${i < S.stage ? '✓' : i === S.stage ? '●' : '○'} ${s}</li>`).join('')}</ul><p class="mut small">This may take 15-60 seconds depending on image size.</p></div>`;
  }
  const up = S.src ? `<div class="card prev">${S.pdf ? `<p class="mut" style="text-align:center">📄 PDF selected (preview not available)</p>` : `<img src="${S.src}" alt="Preview of your uploaded design">`}<p style="text-align:center;margin:0"><b>${esc(S.file.name)}</b> · <span class="mut">${(S.file.size / MB).toFixed(2)} MB</span></p><div class="row"><button class="pri" data-act="analyze">🔍 Analyze Design</button><label class="btn">Replace<input type="file" hidden accept=".png,.jpg,.jpeg,.webp,.pdf" data-file></label><button class="dng" data-act="remove">Remove</button></div></div>`
    : `<label class="drop" id="drop"><input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" data-file><b style="font-size:18px">Drag & drop your design here</b><p class="mut">PNG • JPG • WEBP • PDF · up to 10 MB</p><span class="btn pri">Choose a file</span></label>`;
  return `<section class="hero"><div class="eyebrow">DESIGNCOACH</div><h1>Design better. Learn why.</h1><p class="mut">Upload your design and get AI-powered feedback on typography, spacing, color, accessibility, and more.</p></section>
  ${up}
  <div class="paste-hint card" style="max-width:720px;margin:16px auto;text-align:center;background:var(--bg)"><p style="margin:0"><b>📋 Tip:</b> Copy any image and press <kbd>Ctrl+V</kbd> to paste it directly!</p></div>
  ${S.err ? `<p class="err" role="alert">${esc(S.err)}</p>` : ''}
  <div class="row"><button data-act="demo">🎨 Try a sample design</button></div>
  <p class="mut small" style="text-align:center">🔒 Your design is used only for analysis. It is not saved on our servers.</p>`;
}

function analysis() {
  const r = S.result; if (!r) return `<p class="hero">No analysis yet. <a href="#home">Analyze a design</a>.</p>`;
  const is = issues(r);
  const marks = is.filter((i) => i.location).map((i) => { const l = i.location; return `<div class="box ${i.severity}" style="left:${l.x}%;top:${l.y}%;width:${l.width}%;height:${l.height}%;${S.sel === i.n ? '' : 'opacity:.35'}"></div><button class="mk ${i.severity}" style="left:${l.x}%;top:${l.y}%" data-act="sel" data-n="${i.n}" aria-label="Issue ${i.n}: ${esc(i.title)}">${i.n}</button>`; }).join('');
  const cards = is.map((i, idx) => { const L = catLesson(i.cat), t = S.teach[i.n]; return `<div class="card issue ${i.severity} ${S.sel === i.n ? 'sel' : ''}" id="i${i.n}"><button style="all:unset;cursor:pointer;display:block;width:100%" data-act="sel" data-n="${i.n}"><span class="tag">${i.severity} · ${i.cat}${i.location ? '' : ' · no marker'}</span><h3>${i.n}. ${esc(i.title)}</h3></button><p style="margin:.3em 0">${esc(i.description)}</p><p class="small"><b>Why it matters:</b> ${esc(i.why_it_matters)}</p><p class="small"><b>How to improve:</b> ${esc(i.how_to_improve)}</p><p class="small mut">💡 ${esc(i.learning_tip)}</p><div class="issue-actions"><button data-act="teach" data-n="${i.n}" aria-expanded="${!!t}">📚 Teach Me</button><button class="fix-btn" data-act="fix-one" data-idx="${idx}">🔧 Fix It</button></div>${t ? `<div class="teach"><h3>${L.title}</h3><p class="small"><b>What is the principle?</b> ${esc(L.what)}</p><p class="small"><b>Why does it matter?</b> ${esc(L.why)}</p><p class="small"><b>How can I recognize it?</b> ${esc(L.spot)}</p><p class="small"><b>Quick tip:</b> ${esc(L.tip)}</p></div>` : ''}</div>`; }).join('');

  const typeBadge = r.design_type ? `<span class="badge">${esc(r.design_type)}</span> ${r.design_type_reason ? `<span class="mut small"> · ${esc(r.design_type_reason)}</span>` : ''}` : '';
  const critCount = is.filter(i => i.severity === 'critical').length;
  const impCount = is.filter(i => i.severity === 'important').length;
  const minCount = is.filter(i => i.severity === 'minor').length;
  const sc = scoreColor(r.overall.score);

  // Summary card
  const summaryCard = `<div class="card summary-card"><div class="summary-header"><div class="big" style="color:${sc}">${r.overall.score}</div><div><div class="mut small">Overall Score</div><div style="font-weight:600;color:${sc}">${scoreLabel(r.overall.score)}</div></div></div><p style="margin:12px 0 0">${esc(r.overall.summary)}</p>${typeBadge ? `<p style="margin:8px 0 0">${typeBadge}</p>` : ''}<div class="summary-stats"><div class="stat"><b style="color:var(--crit)">${critCount}</b><span class="small mut">Critical</span></div><div class="stat"><b style="color:var(--imp)">${impCount}</b><span class="small mut">Important</span></div><div class="stat"><b style="color:var(--min)">${minCount}</b><span class="small mut">Minor</span></div><div class="stat"><b>${is.length}</b><span class="small mut">Total Issues</span></div></div></div>`;

  // Accessibility section
  const acc = r.accessibility;
  const accSection = acc ? `<h2>♿ Accessibility</h2><div class="card"><div class="scores" style="grid-template-columns:repeat(2,1fr)"><div class="sc"><b style="font-size:28px">${esc(acc.overall_rating || 'N/A')}</b><span class="small mut">WCAG Rating</span></div><div class="sc"><b style="font-size:14px">${esc(acc.color_blindness_risk || 'Unknown')}</b><span class="small mut">Color Blind Risk</span></div></div>${acc.contrast_issues?.length ? `<p class="small" style="margin-top:12px"><b>⚠️ Contrast Issues:</b></p><ul class="clean">${acc.contrast_issues.map(i => `<li class="dng-item">${esc(i)}</li>`).join('')}</ul>` : ''}${acc.font_size_issues?.length ? `<p class="small"><b>📏 Font Size Issues:</b></p><ul class="clean">${acc.font_size_issues.map(i => `<li class="dng-item">${esc(i)}</li>`).join('')}</ul>` : ''}</div>` : '';

  // Color suggestions
  const suggestions = r.design_suggestions;
  const sugSection = suggestions ? `<h2>🎨 Suggestions</h2><div class="card">${suggestions.color_palette?.length ? `<p class="small"><b>Suggested Color Palette:</b></p><div class="color-palette">${suggestions.color_palette.map(c => `<div class="color-swatch" style="background:${esc(c)}" title="${esc(c)}"><span class="color-hex">${esc(c)}</span></div>`).join('')}</div>` : ''}${suggestions.layout_tip ? `<p class="small" style="margin-top:12px"><b>💡 Layout Tip:</b> ${esc(suggestions.layout_tip)}</p>` : ''}</div>` : '';

  return `<div class="dash"><div class="stage"><div class="card" style="text-align:center">${S.demo ? '<p><span class="badge">Demo Analysis</span> <span class="mut small">This is a built-in sample.</span></p>' : ''}<div class="wrap"><img src="${S.src}" alt="The analyzed design with numbered issue markers">${marks}</div>${S.pdf ? '<p class="mut small">Issue markers are not available for PDFs.</p>' : ''}</div></div>
<div>
${summaryCard}
<h3 style="margin-top:20px">Category Scores</h3><div class="card"><div class="scores">${CATS.map((c) => { const s = r.categories[c].score; return `<div class="sc"><b style="color:${scoreColor(s)}">${s}</b><span class="small mut">${c[0].toUpperCase() + c.slice(1)}</span></div>`; }).join('')}</div><p class="mut small">Scores reflect how closely a design follows specific principles, not artistic talent.</p></div>
${accSection}
<h2>Needs Attention</h2>${is.length ? `<div class="card" style="text-align:center;margin-bottom:16px"><button class="fix-btn fix-all-btn" data-act="fix-all">🔧 Fix All Issues (${is.length})</button><p class="mut small" style="margin:8px 0 0">AI will generate step-by-step fix instructions for all issues</p></div>` : ''}${cards || '<p class="card mut">No issues found. Nice work!</p>'}
<h2>What's Working</h2><div class="card"><ul class="clean">${r.strengths.map((s) => `<li class="ok"><span style="color:var(--ink)">${esc(s)}</span></li>`).join('') || '<li>—</li>'}</ul></div>
<h2>Recommended Improvements</h2><div class="card"><ol class="clean">${r.recommendations.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>
${sugSection}
<h2>Learn</h2><div class="row" style="justify-content:flex-start">${r.learning_topics.map((t) => { const l = KB.lessons.find((x) => x.title.toLowerCase() === t.toLowerCase()); return `<a class="btn" href="#learn${l ? ':' + l.id : ''}">${esc(t)}</a>`; }).join('')}</div>
<h2>Export & Share</h2><div class="card"><div class="row" style="justify-content:flex-start"><button data-act="export-txt">📄 Download Report</button><button data-act="export-json">📦 Download JSON</button><button data-act="share-analysis">📋 Copy Summary</button></div></div>
<p class="row" style="justify-content:flex-start;margin-top:24px"><a class="btn pri" href="#home" data-act="new">🔍 Analyze another</a></p></div></div>

${S.fixBusy ? `<div class="fix-modal"><div class="fix-modal-content card"><div class="spin" style="margin:0 auto 12px"></div><h2 style="text-align:center;margin:0">🎨 Generating Fixed Design...</h2><p class="mut" style="text-align:center">AI is fixing your design${S.fixIssue === 'all' ? ' (all issues)' : ''}. This may take 30-60 seconds.</p></div></div>` : ''}

${S.fixResult && S.fixResult.fixed_image ? `<div class="fix-modal"><div class="fix-modal-content card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h2 style="margin:0">✅ Fixed Design</h2><button data-act="close-fix" style="font-size:20px;padding:4px 12px">✕</button></div><div class="before-after"><div class="ba-panel"><h3>❌ Before</h3><div class="ba-img"><img src="${S.src}" alt="Original design"></div></div><div class="ba-panel"><h3>✅ After (Fixed)</h3><div class="ba-img"><img src="${S.fixResult.fixed_image}" alt="Fixed design"></div></div></div>${S.fixResult.description ? `<p class="mut small" style="margin-top:12px;text-align:center">${esc(S.fixResult.description)}</p>` : ''}<div class="row" style="margin-top:16px"><button class="pri" data-act="download-fixed">💾 Download Fixed Image</button><button data-act="analyze-fixed">🔍 Analyze Fixed Version</button><button data-act="close-fix">Close</button></div></div></div>` : ''}

${S.fixResult && S.fixResult.error ? `<div class="fix-modal"><div class="fix-modal-content card"><h2 style="color:var(--crit)">❌ Error</h2><p>${esc(S.fixResult.error)}</p><div class="row" style="margin-top:12px"><button data-act="close-fix">Close</button></div></div></div>` : ''}`;
}

function learn(id) {
  if (id === 'practice') return practice();
  if (id) { const l = KB.lessons.find((x) => x.id === id); if (l) return `<a href="#learn">← All lessons</a><div class="card" style="margin-top:12px;max-width:720px"><h1>${l.title}</h1>${[['What it is', l.what], ['Why it matters', l.why], ['How to spot it', l.spot], ['Common mistake', l.mistake], ['Good practice', l.good], ['Quick tip', l.tip], ['Exercise', l.ex]].map(([a, b]) => `<h3>${a}</h3><p style="margin-top:0">${esc(b)}</p>`).join('')}</div>`; }
  return `<h1>📚 Learn</h1><p class="mut">Beginner lessons on the fundamentals of good design.</p><div class="grid">${KB.lessons.map((l) => `<a class="card" style="text-decoration:none" href="#learn:${l.id}"><h3>${l.title}</h3><p class="mut small" style="margin:0">${esc(l.what)}</p></a>`).join('')}<a class="card" style="text-decoration:none;border-color:var(--acc)" href="#learn:practice"><h3>🧠 Practice Mode →</h3><p class="mut small" style="margin:0">Test yourself with ${KB.practice.length} questions.</p></a></div>`;
}

function practice() {
  const Q = KB.practice; if (S.q >= Q.length) return `<div class="card hero"><h1>🎉 Done!</h1><p>You answered all ${Q.length} questions.</p><button class="pri" data-act="restart">Practice again</button> <a class="btn" href="#learn">Back to lessons</a></div>`;
  const q = Q[S.q], a = S.pick !== null;
  const pct = Math.round((S.q / Q.length) * 100);
  return `<a href="#learn">← Lessons</a><div class="card" style="max-width:640px;margin-top:12px"><div style="background:var(--line);border-radius:99px;height:8px;margin-bottom:16px"><div style="background:var(--acc);height:100%;border-radius:99px;width:${pct}%;transition:width .3s"></div></div><p class="mut small">Question ${S.q + 1} of ${Q.length}</p><h2 style="margin-top:0">${esc(q.q)}</h2>${q.o.map((o, i) => `<button style="display:block;width:100%;text-align:left;margin-bottom:8px;${a && i === q.a ? 'border-color:var(--ok);background:rgba(21,128,61,.08)' : a && i === S.pick ? 'border-color:var(--crit);background:rgba(185,28,28,.08)' : ''}" data-act="ans" data-i="${i}" ${a ? 'disabled' : ''}>${esc(o)}</button>`).join('')}${a ? `<p role="status"><b class="${S.pick === q.a ? 'ok' : 'dng'}">${S.pick === q.a ? '✅ Correct!' : '❌ Not quite.'}</b> ${esc(q.why)}</p><button class="pri" data-act="next">Next →</button>` : ''}</div>`;
}

function history() {
  const h = hist();
  return `<h1>📋 History</h1><p class="mut">Saved on this device only. Original designs are never stored.</p>${h.length ? `<div class="grid">${h.map((x) => `<div class="card">${x.thumb ? `<img class="thumb" src="${x.thumb}" alt="Thumbnail of ${esc(x.name)}" loading="lazy">` : '<div class="thumb" style="display:grid;place-items:center">📄</div>'}<h3 style="margin-top:10px">${esc(x.name)}</h3><p class="mut small">${new Date(x.date).toLocaleDateString()} · <span style="color:${scoreColor(x.score)};font-weight:600">Score ${x.score}</span> · ${x.count} issue${x.count === 1 ? '' : 's'}</p><div class="row" style="justify-content:flex-start"><button data-act="open" data-id="${x.id}">Open</button><button class="dng" data-act="del" data-id="${x.id}">Delete</button></div></div>`).join('')}</div>` : '<p class="card">No analyses yet. <a href="#home">Analyze a design</a>.</p>'}`;
}

function settingsView() {
  return `<h1>⚙️ Settings</h1><div class="card" style="max-width:560px"><label><input type="checkbox" data-set="save" ${settings().save ? 'checked' : ''}> Save analyses to History on this device</label><p class="mut small">Your design is used only for analysis and is not stored on our servers.</p><button class="dng" data-act="clear">Delete all saved history</button></div>`;
}

/* ---------- router + events ---------- */
function render() {
  const [p, id] = (location.hash.slice(1) || 'home').split(':'), y = scrollY;
  document.querySelectorAll('nav a').forEach((a) => a.toggleAttribute('aria-current', a.hash.slice(1) === (p === 'analysis' ? 'home' : p)) || a.removeAttribute('aria-current'));
  document.querySelectorAll('nav a').forEach((a) => { if (a.hash.slice(1) === (p === 'analysis' ? 'home' : p)) a.setAttribute('aria-current', 'page'); });
  app.innerHTML = { home, analysis, learn: () => learn(id), history, settings: settingsView }[p]?.() ?? home();
  scrollTo(0, y);
}
addEventListener('hashchange', () => { scrollTo(0, 0); render(); });
document.addEventListener('change', (e) => { if (e.target.matches('[data-file]')) pick(e.target.files[0]); if (e.target.dataset.set) { store.set('dc_settings', { ...settings(), [e.target.dataset.set]: e.target.checked }); } });
['dragover', 'dragleave', 'drop'].forEach((t) => document.addEventListener(t, (e) => { const d = e.target.closest?.('#drop'); if (!d) return; e.preventDefault(); d.classList.toggle('over', t === 'dragover'); if (t === 'drop') pick(e.dataTransfer.files[0]); }));
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act, n = +b.dataset.n;
  if (a === 'analyze') analyze();
  else if (a === 'remove') { S.file = S.src = null; S.err = ''; render(); }
  else if (a === 'new') { S.file = S.src = null; S.result = null; }
  else if (a === 'demo') { S.src = 'data:image/svg+xml,' + encodeURIComponent(DEMO_SVG); S.result = DEMO; S.demo = true; S.pdf = false; S.sel = null; S.teach = {}; go('analysis'); }
  else if (a === 'sel') { S.sel = n; render(); document.getElementById('i' + n)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth', block: 'center' }); }
  else if (a === 'teach') { S.teach[n] = !S.teach[n]; render(); }
  else if (a === 'ans') { S.pick = +b.dataset.i; render(); }
  else if (a === 'next') { S.q++; S.pick = null; render(); }
  else if (a === 'restart') { S.q = 0; S.pick = null; render(); }
  else if (a === 'open') { const x = hist().find((h) => h.id === +b.dataset.id); if (x) { S.result = x.result; S.src = x.thumb; S.pdf = !x.thumb; S.demo = false; S.sel = null; S.teach = {}; go('analysis'); } }
  else if (a === 'del') { if (confirm('Delete this analysis?')) { store.set('dc_history', hist().filter((h) => h.id !== +b.dataset.id)); render(); } }
  else if (a === 'clear') { if (confirm('Delete all saved history?')) { store.set('dc_history', []); render(); } }
  else if (a === 'export-txt') { if (S.result) downloadText('designcoach-report.txt', generateShareText(S.result)); }
  else if (a === 'export-json') { if (S.result) downloadJSON('designcoach-analysis.json', S.result); }
  else if (a === 'share-analysis') {
    if (S.result) {
      navigator.clipboard.writeText(generateShareText(S.result)).then(() => {
        b.textContent = '✅ Copied!';
        setTimeout(() => { b.textContent = '📋 Copy Summary'; }, 2000);
      }).catch(() => downloadText('designcoach-report.txt', generateShareText(S.result)));
    }
  }
  else if (a === 'fix-one') { fixIssue(+b.dataset.idx); }
  else if (a === 'fix-all') { fixAllIssues(); }
  else if (a === 'close-fix') { closeFix(); }
  else if (a === 'download-fixed') {
    if (S.fixResult?.fixed_image) {
      const a2 = document.createElement('a'); a2.href = S.fixResult.fixed_image;
      a2.download = 'designcoach-fixed.png'; a2.click();
    }
  }
  else if (a === 'analyze-fixed') {
    if (S.fixResult?.fixed_image) {
      S.src = S.fixResult.fixed_image;
      S.file = { name: 'fixed-design.png', size: 0 };
      S.fixResult = null; S.fixIssue = null;
      S.result = null; S.sel = null; S.teach = {};
      render();
      analyze();
    }
  }
  else if (a === 'export-fix') {
    if (S.fixResult && S.fixResult.fixes) {
      let txt = 'DESIGNCOACH FIX GUIDE\n' + '='.repeat(40) + '\n\n';
      if (S.fixResult.overall_fix_plan) {
        txt += 'SUMMARY: ' + (S.fixResult.overall_fix_plan.summary || '') + '\n\n';
        if (S.fixResult.overall_fix_plan.quick_wins?.length) {
          txt += 'QUICK WINS:\n';
          S.fixResult.overall_fix_plan.quick_wins.forEach(w => { txt += '  - ' + w + '\n'; });
          txt += '\n';
        }
      }
      S.fixResult.fixes.forEach((f, i) => {
        txt += 'FIX #' + (i+1) + ': ' + (f.issue_title || '') + '\n';
        txt += 'Difficulty: ' + (f.difficulty || '?') + ' | Time: ' + (f.time_estimate || '?') + '\n\n';
        txt += 'Steps:\n';
        (f.steps || []).forEach((s, j) => { txt += '  ' + (j+1) + '. ' + s + '\n'; });
        if (f.css_changes) txt += '\nCode:\n' + f.css_changes + '\n';
        if (f.before_description) txt += '\nBefore: ' + f.before_description + '\n';
        if (f.after_description) txt += 'After: ' + f.after_description + '\n';
        txt += '\n' + '-'.repeat(40) + '\n\n';
      });
      downloadText('designcoach-fix-guide.txt', txt);
    }
  }
});
render();
