# DesignCoach — Design better. Learn why.

An AI design critique and learning tool. No build step: a static site (`public/`) plus one secure Netlify serverless function (`netlify/functions/`).

## Deploy to Netlify (no coding needed)
1. **Download** this project and unzip it.
2. **GitHub repository:** sign in at github.com → **New repository** → name it `designcoach` → Create.
3. **Upload:** on the empty repo page click **uploading an existing file**, drag in ALL the unzipped files and folders (keep the `public` and `netlify` folders), then **Commit changes**.
4. **Connect Netlify:** at netlify.com → **Add new site → Import an existing project → GitHub** → choose `designcoach`.
5. **Build command:** leave empty. 6. **Publish directory:** `public`. (`netlify.toml` already sets both, plus the functions folder.)
7. **API key:** Site configuration → **Environment variables** → Add `AI_API_KEY` = your Anthropic API key (console.anthropic.com). Optional: `AI_MODEL`.
8. Click **Deploy**.
9. **Updating later:** edit files on GitHub (pencil icon) and commit; Netlify redeploys automatically. Add design lessons in `public/knowledge.js`.

## Notes
- The key stays server-side; the browser only calls `/api/analyze`.
- Netlify functions have a time limit (10 s by default, up to 26 s). The default fast model `claude-haiku-4-5-20251001` is chosen for this; a slower model may time out.
- PDFs: analyzed by the AI, limited to ~4 MB (Netlify request limit); no preview or markers for PDFs.
- Swap AI provider by editing only `callModel()` in `netlify/functions/aiService.js`.
- Test locally (optional): `npx netlify-cli dev` with a `.env` file copied from `.env.example`.
