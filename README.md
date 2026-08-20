# Signal Terminal

Personal market dashboard: crypto movers, macro/market news, keyword-flagged signals,
and a Claude-powered "what's driving this" analysis panel.

## Deploy (GitHub + Netlify, ~10 min, free)

1. Create a GitHub repo and upload these 4 files (`index.html`, `netlify.toml`,
   `netlify/functions/analyze.js`, `README.md`) — either via GitHub's web "Add file → Upload files",
   or with git:
   ```
   git init
   git add .
   git commit -m "Signal Terminal"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/signal-terminal.git
   git push -u origin main
   ```
2. Go to https://app.netlify.com → "Add new site" → "Import an existing project" → connect GitHub →
   pick this repo. Leave build settings default (no build command needed) → Deploy.
3. In Netlify: Site settings → Environment variables → add
   `ANTHROPIC_API_KEY` = your key from https://console.anthropic.com/settings/keys
4. Trigger a redeploy (Deploys tab → Trigger deploy) so the function picks up the key.
5. Netlify gives you a live URL like `https://your-site.netlify.app`. Open it.

## Put it on your iPhone

1. Open your Netlify URL in **Safari**.
2. Tap the Share icon → **Add to Home Screen**.
3. Open it from the Home Screen icon → tap **Enable Alerts** → Allow.

Now it runs full-screen like an app and can send notifications while backgrounded.

## Notes

- Crypto data: CoinGecko public API, no key needed.
- News: pulled via a CORS-friendly proxy chain (allorigins, then rss2json as fallback) from
  CoinDesk, MarketWatch, CNBC, WSJ Markets.
- The Claude panel calls your own `/netlify/functions/analyze` endpoint — your API key never
  touches the browser.
- This tool surfaces factors and flags news — it does not give buy/sell recommendations.
