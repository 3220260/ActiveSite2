# ActiveSite2

Static site for `synetairismos-astynomikon.gr`.

- Production hosting runs on GitHub Pages via the custom domain in `CNAME`.
- The chatbot stays external and is embedded from `https://ver-bot.vercel.app`.
- There is no server-side runtime in this repo; weather and other UI data load client-side.
- `npm run build` regenerates `assets/css/tailwind.css` and updates `assets/site-version.json`.
- `npm run check` is read-only and validates HTML, browser JS syntax, Tailwind compilation, and asset references without modifying tracked files.
