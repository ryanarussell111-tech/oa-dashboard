# OA Intelligence Dashboard

Online-arbitrage sourcing dashboard: imports Tactical Arbitrage and SellerAmp
results, grades leads against Keepa data, and pushes qualifying finds to Discord.

## Configuration

All credentials live in the environment and are read **server-side only**.
Copy `.env.example` to `.env` and fill it in:

```bash
cp .env.example .env
```

| Variable | Used by | Purpose |
| --- | --- | --- |
| `KEEPA_API_KEY` | `keepa.js` | Keepa product API lookups |
| `DISCORD_WEBHOOK` | `server.js` | Lead alerts and scan summaries |
| `TA_EMAIL` / `TA_PASSWORD` | `server.js` | Twice-daily Tactical Arbitrage auto-scan |
| `PORT` | `server.js` | API server port (default 4000) |

`.env` is gitignored. Never commit it.

> **Do not add a `REACT_APP_` prefix to any of these.** Create React App inlines
> every `REACT_APP_*` variable into the JavaScript bundle at build time, which
> would publish the value to anyone who opens the site. Secrets must stay on the
> server and be reached through the API endpoints below.

## Running

The browser app and the API server run as two processes in development:

```bash
node server.js    # API + auto-scan on :4000
npm start         # React dev server on :3000, proxied to :4000
```

In production `server.js` serves the built frontend, so one process covers both:

```bash
npm run build
node server.js
```

## API

The frontend never talks to third-party APIs directly — it calls these, and the
server attaches the credentials.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/keepa/lookup` | `{ asin }` → dashboard-shaped Keepa data for one ASIN |
| `POST /api/alert` | `{ product }` → posts a lead alert to Discord if it qualifies |
| `POST /api/grade-asins` | `{ asins: [...] }` → bulk grade a list of ASINs |

`/api/alert` re-applies the qualifying rules (grade A/A+, ROI ≥ 40%, Amazon
presence ≤ 30%) server-side rather than trusting the caller.

## Tests

```bash
npm test
```

Alongside the render test, the suite scans `src/` and fails if a Discord webhook
URL, a direct Keepa API call, or a long key-like literal is reintroduced into
client code.
