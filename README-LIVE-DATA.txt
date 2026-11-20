KING SPORTS — AUTOMATIC LIVE-DATA EDITION

WHAT THIS VERSION DOES
- Includes a Node.js backend that keeps provider API tokens on the server, not in browser JavaScript.
- Automatically fetches cricket fixtures and live scores from Sportmonks Cricket API.
- Loads a selected cricket match's roster from the provider's lineup data when the provider supplies it.
- Refreshes live scores approximately every 25 seconds while the website is open, and fixtures every 5 minutes.
- Shows unavailable states instead of making up live scores or treating a generic player pool as a confirmed XI.

ONE-TIME SETUP (a hosting account owner/adult may need to help)
1. Install Node.js 20 or newer on the server/hosting platform.
2. Copy .env.example to .env.
3. Get a Sportmonks Cricket API token from its provider and set SPORTMONKS_CRICKET_TOKEN in .env.
4. Get a football API key and set API_FOOTBALL_KEY in .env. This is separate from the cricket key.
5. Run `npm start` from this folder. Open http://localhost:3000 to test.
6. Deploy the whole folder to a Node.js-capable host. A static-only host/drop deployment cannot run server.js; use a Node-capable host or separate backend and configure the frontend API base URL if hosting them separately.
7. Keep .env private. Never commit it, share it, or paste API keys into public HTML. Rotate a key if it is accidentally exposed.

IMPORTANT COVERAGE LIMITS
- This is a real provider integration, but it cannot guarantee every tournament in the world. Provider coverage and live-update frequency depend on the subscription and rights.
- Cricket fixture endpoints return only the competitions and date ranges covered by the selected provider account. Squad/playing-XI fields can be empty until the provider publishes them.
- The backend has separate cricket and football adapters. Only these two sports are shown in the interface. Each provider key must be configured to enable its sport.
- Fantasy points/credits, accounts, cloud team saving, and leaderboard are still demo features. No wagers, entry fees, cash prizes, or cash redemption are supported; virtual coins have no cash value.
- No API token is included in this package.

FOOTBALL SETUP
1. Create an API-Football/API-Sports account and copy its API key.
2. Put it in the server .env file as API_FOOTBALL_KEY=your_key. Never place it in index.html.
3. The backend requests /fixtures for the next 14 days, /fixtures?live=all for live scores, and match lineups when available. Coverage varies by competition and plan.

SPORT SCOPE
KING SPORTS now displays only Cricket and Football. Other sports have been removed from the interface. Cricket and football provider keys are separate and both must be configured for both sports to work.
