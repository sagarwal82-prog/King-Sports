KING SPORTS — LIVE-DATA PREVIEW

This package now contains both the website and a Node.js backend. Do not deploy it as a static-only site if you want live data.

Quick local test
1. Install Node.js 20+.
2. Copy .env.example to .env and add your Sportmonks Cricket API token.
3. Open a terminal in this folder and run: npm start
4. Visit http://localhost:3000
5. Visit http://localhost:3000/api/health to check provider configuration.

Production hosting
- Choose a Node.js-capable host that can run `npm start` and set server environment variables.
- Upload this folder including server.js, package.json, index.html, assets/ and README-LIVE-DATA.txt.
- Add SPORTMONKS_CRICKET_TOKEN in the host's private environment-variable settings, not in index.html.
- Add API_FOOTBALL_KEY to enable football fixtures, live scores and match lineups.
- Configure a custom domain and HTTPS in the host dashboard. A parent/guardian should help with hosting accounts, domain registration, and any payments.

A static-only host such as drag-and-drop HTML hosting cannot execute this backend. Live data will remain unavailable until the backend is deployed and provider credentials are configured.

See README-LIVE-DATA.txt for refresh intervals and sport coverage limitations. API coverage is not universal; confirm that your provider plan includes the tournaments and lineup fields you want.

F1 DATA CONFIGURATION
- In Render Environment Variables, set KING_SPORTS_F1_API to the API.SH key.
- The backend sends it as the x-api-key header; do not put the key in index.html or GitHub.
- F1 overview requests are cached for 5 minutes to limit API calls. API.SH endpoints are charged in credits; check your account usage.
- This integration loads the schedule, driver list and constructor list. It does not provide car telemetry or guarantee live timing.
