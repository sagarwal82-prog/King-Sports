/** KING SPORTS data backend. Node.js 20+, no third-party packages required. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
loadEnv(path.join(__dirname, '.env'));
const PORT = Number(process.env.PORT || 3000);
const CRICKET_TOKEN = process.env.SPORTMONKS_CRICKET_TOKEN;
const FOOTBALL_TOKEN = process.env.SPORTMONKS_FOOTBALL_TOKEN;
const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
const cache = new Map();
const CACHE_MS = 25_000;

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': process.env.ALLOW_ORIGIN || '*' });
  res.end(JSON.stringify(obj));
}
async function cached(key, ttl, fn) {
  const prior = cache.get(key);
  if (prior && Date.now() - prior.at < ttl) return prior.value;
  const value = await fn(); cache.set(key, { at: Date.now(), value }); return value;
}
async function fetchJson(url, headers = {}) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(url, { headers, signal: controller.signal });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.message || body.error || `Provider returned HTTP ${r.status}`);
    return body;
  } finally { clearTimeout(timer); }
}
function includeQuery() { return 'include=localteam,visitorteam,runs,venue,league,season'; }
function normFixture(m) {
  const home = m.localteam?.name || m.localteam?.data?.name || m.home_team?.name || 'Home team';
  const away = m.visitorteam?.name || m.visitorteam?.data?.name || m.away_team?.name || 'Away team';
  const date = m.starting_at || m.start_date || m.date || null;
  const scores = Array.isArray(m.runs) ? m.runs.map(r => ({ team_id: r.team_id, score: r.score ?? r.scoreboard ?? null, wickets: r.wickets ?? null, overs: r.overs ?? null })) : [];
  return { id: String(m.id), providerId: m.id, date, time: date ? new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST' : 'Time TBA', format: m.type || m.format || m.league?.name || m.league?.data?.name || 'Cricket', home, away, venue: m.venue?.name || m.venue?.data?.name || 'Venue TBA', status: m.status || (m.live ? 'Live' : 'Scheduled'), scores, source: 'Sportmonks Cricket API', live: Boolean(m.live), league: m.league?.name || m.league?.data?.name || '' };
}
async function cricket(pathAndQuery) {
  if (!CRICKET_TOKEN) throw new Error('Cricket provider not configured. Add SPORTMONKS_CRICKET_TOKEN to server .env.');
  const separator = pathAndQuery.includes('?') ? '&' : '?';
  const url = `https://cricket.sportmonks.com/api/v2.0${pathAndQuery}${separator}api_token=${encodeURIComponent(CRICKET_TOKEN)}`;
  return fetchJson(url);
}
async function football(pathAndQuery) {
  if (!FOOTBALL_TOKEN) {
    throw new Error('Football provider not configured. Add SPORTMONKS_FOOTBALL_TOKEN to Render Environment.');
  }

  const url = `https://api.sportmonks.com/v3/football${pathAndQuery}`;
  const payload = await fetchJson(url, {
    'Authorization': FOOTBALL_TOKEN
  });

  if (payload.errors && Object.keys(payload.errors).length) {
    throw new Error(JSON.stringify(payload.errors));
  }

  if (payload.message && !payload.data) {
    throw new Error(payload.message);
  }

  return payload;
}
async function footballData(pathAndQuery) {
  if (!FOOTBALL_DATA_TOKEN) {
    throw new Error('Football-data.org token not configured in Render.');
  }

  const url = `https://api.football-data.org/v4${pathAndQuery}`;

  return fetchJson(url, {
    'X-Auth-Token': FOOTBALL_DATA_TOKEN
  });
}
function normFootball(m) {
  const participants = Array.isArray(m.participants)
    ? m.participants
    : [];

  const homePart =
    participants.find(
      p => (p.meta?.location || '').toLowerCase() === 'home'
    ) || participants[0];

  const awayPart =
    participants.find(
      p => (p.meta?.location || '').toLowerCase() === 'away'
    ) || participants[1];

  const scores = Array.isArray(m.scores) ? m.scores : [];

  function goalFor(part) {
    if (!part) return null;

    const score =
      scores.find(x =>
        String(x.participant_id) === String(part.id) &&
        /CURRENT|FT|2ND_HALF|1ST_HALF|LIVE/i.test(
          String(x.description || '')
        )
      ) ||
      scores.find(
        x => String(x.participant_id) === String(part.id)
      );

    return score?.score?.goals ?? score?.score ?? null;
  }

  const homeGoals = goalFor(homePart);
  const awayGoals = goalFor(awayPart);

  const date = m.starting_at || null;
  const state = m.state || {};

  const status =
    state.name ||
    state.short_name ||
    state.developer_name ||
    (m.result_info ? 'Finished' : 'Scheduled');

  const live =
    /LIVE|IN PLAY|1ST HALF|2ND HALF|HALF TIME|EXTRA TIME/i.test(status);

  return {
    id: String(m.id),
    providerId: m.id,
    date,

    time: date
      ? new Date(
          date.replace(' ', 'T') +
          (/[zZ]|[+-]\d\d:\d\d$/.test(date) ? '' : 'Z')
        ).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Kolkata'
        }) + ' IST'
      : 'Time TBA',

    home: homePart?.name || homePart?.short_code || 'Home team',
    away: awayPart?.name || awayPart?.short_code || 'Away team',

    venue: m.venue?.name || m.venue?.data?.name || 'Venue TBA',
    league: m.league?.name || m.league?.data?.name || 'Football',

    status,
    elapsed: '',

    score:
      homeGoals != null || awayGoals != null
        ? `${homeGoals ?? 0} - ${awayGoals ?? 0}`
        : '',

    source: 'Sportmonks Football API',
    live
  };
}

function normFootballData(m) {
  const homeGoals = m.score?.fullTime?.home;
  const awayGoals = m.score?.fullTime?.away;
  const status = m.status || 'SCHEDULED';

  return {
    id: String(m.id),
    providerId: m.id,
    date: m.utcDate || null,

    time: m.utcDate
      ? new Date(m.utcDate).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Kolkata'
        }) + ' IST'
      : 'Time TBA',

    home: m.homeTeam?.name || 'Home team',
    away: m.awayTeam?.name || 'Away team',
    venue: m.venue || 'Venue TBA',
    league: m.competition?.name || 'Football',

    status,
    elapsed: '',

    score:
      homeGoals != null || awayGoals != null
        ? `${homeGoals ?? 0} - ${awayGoals ?? 0}`
        : '',

    source: 'football-data.org',
    live: ['IN_PLAY', 'PAUSED', 'LIVE'].includes(status)
  };
}

async function route(req, res) {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }); return res.end(); }
  if (u.pathname === '/api/health') return json(res, 200, { ok: true, providerConfigured: Boolean(CRICKET_TOKEN), providers: { cricket: CRICKET_TOKEN ? 'configured' : 'needs_api_key', sportmonksFootball: FOOTBALL_TOKEN ? 'configured' : 'needs_api_key', footballData: FOOTBALL_DATA_TOKEN ? 'configured' : 'needs_api_key', football: (FOOTBALL_TOKEN || FOOTBALL_DATA_TOKEN) ? 'configured' : 'needs_api_key' }, refreshSeconds: 25 });
  if (u.pathname === '/api/fixtures') {
    try {
      const data = await cached('fixtures', CACHE_MS, async () => {
        const now = new Date(); const from = new Date(now.getTime() - 2 * 864e5).toISOString().slice(0, 10); const to = new Date(now.getTime() + 45 * 864e5).toISOString().slice(0, 10);
        const payload = await cricket(`/fixtures?filter[starts_between]=${from},${to}&${includeQuery()}`);
        return (payload.data || []).map(normFixture).sort((a,b) => String(a.date).localeCompare(String(b.date)));
      });
      return json(res, 200, { source: 'Sportmonks Cricket API', updatedAt: new Date().toISOString(), data });
    } catch (e) { return json(res, 503, { error: e.message, data: [], updatedAt: null }); }
  }
  if (u.pathname === '/api/live') {
    try {
      const data = await cached('live', 10_000, async () => {
        const payload = await cricket(`/livescores?${includeQuery()}`);
        return (payload.data || []).map(normFixture);
      });
      return json(res, 200, { source: 'Sportmonks Cricket API', updatedAt: new Date().toISOString(), data });
    } catch (e) { return json(res, 503, { error: e.message, data: [], updatedAt: null }); }
  }
  const match = u.pathname.match(/^\/api\/fixture\/([^/]+)$/);
  if (match) {
    try {
      const id = encodeURIComponent(match[1]);
      const payload = await cached(`fixture:${id}`, CACHE_MS, () => cricket(`/fixtures/${id}?include=localteam,visitorteam,runs,batting,bowling,lineup,venue,league,season`));
      const m = payload.data || {};
      const roster = (m.lineup || []).map(p => ({ id: p.id, name: p.fullname || p.full_name || p.name, team: p.team?.name || p.team?.data?.name || '', role: p.position?.name || p.role || 'Player', captain: Boolean(p.lineup?.captain || p.captain), wicketkeeper: Boolean(p.lineup?.wicketkeeper || p.wicketkeeper) }));
      return json(res, 200, { source: 'Sportmonks Cricket API', data: { ...normFixture(m), roster, batting: m.batting || [], bowling: m.bowling || [], rawStatus: m.status } });
    } catch (e) { return json(res, 503, { error: e.message }); }
  }

if (u.pathname === '/api/football/fixtures') {
  try {
    const data = await cached('football-fixtures-combined', 300_000, async () => {
      const now = new Date();
      const from = new Date(now.getTime() - 2 * 864e5).toISOString().slice(0, 10);
      const to = new Date(now.getTime() + 14 * 864e5).toISOString().slice(0, 10);

      let sportmonksMatches = [];
      let extraMatches = [];

      try {
        const payload = await football(
          `/fixtures/between/${from}/${to}?include=participants;scores;league;state;venue`
        );
        sportmonksMatches = (payload.data || []).map(normFootball);
      } catch (e) {
        console.error('Sportmonks fixtures:', e.message);
      }

      try {
        const [pl, cl] = await Promise.all([
          footballData(`/competitions/PL/matches?dateFrom=${from}&dateTo=${to}`),
          footballData(`/competitions/CL/matches?dateFrom=${from}&dateTo=${to}`)
        ]);

        extraMatches = [
          ...(pl.matches || []),
          ...(cl.matches || [])
        ].map(normFootballData);
      } catch (e) {
        console.error('football-data.org fixtures:', e.message);
      }

      const combined = [...sportmonksMatches, ...extraMatches];

      const unique = [...new Map(
        combined.map(match => [
          `${match.home}-${match.away}-${match.date}`,
          match
        ])
      ).values()];

      return unique.sort((a, b) =>
        String(a.date).localeCompare(String(b.date))
      );
    });

    return json(res, 200, {
      source: 'Sportmonks + football-data.org',
      updatedAt: new Date().toISOString(),
      data
    });
  } catch (e) {
    return json(res, 503, {
      error: e.message,
      data: [],
      updatedAt: null
    });
  }
}

  if (u.pathname === '/api/football/live') {
    try {
      const data=await cached('football-live',15_000,async()=>{const payload=await football('/fixtures?live=all');return (payload.response||[]).map(normFootball);});
      return json(res,200,{source:'Sportmonks Football API',updatedAt:new Date().toISOString(),data});
    } catch(e) { return json(res,503,{error:e.message,data:[],updatedAt:null}); }
  }

const footballMatch = u.pathname.match(/^\/api\/football\/fixture\/([^/]+)$/);

if (footballMatch) {
  try {
    const payload = await cached(
      `football-fixture:${footballMatch[1]}`,
      60_000,
      () => football(
        `/fixtures/${encodeURIComponent(footballMatch[1])}?include=participants;lineups.player;lineups.position`
      )
    );

    const m = payload.data;

    if (!m) {
      return json(res, 404, {
        error: 'Football fixture not found or not covered by Sportmonks.'
      });
    }

    const participants = m.participants || [];
    const allLineups = m.lineups || [];

    const lineups = participants.map(team => ({
      team: team.name || 'Team',
      formation: '',
      players: allLineups
        .filter(player => player.team_id === team.id)
        .map(player => ({
          name:
            player.player?.display_name ||
            player.player?.name ||
            player.player_name ||
            'Player',
          number: player.jersey_number ?? '',
          position: player.position?.name || '',
          type:
            player.type_id === 11
              ? 'Starting XI'
              : player.type_id === 12
                ? 'Substitute'
                : 'Squad'
        }))
    }));

    return json(res, 200, {
      source: 'Sportmonks Football API',
      updatedAt: new Date().toISOString(),
      data: {
        id: String(m.id),
        lineups
      }
    });

  } catch (e) {
    return json(res, 503, { error: e.message });
  }
}

  // Static files
  const safePath = decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname);
  const filePath = path.resolve(__dirname, `.${safePath}`);
  if (!filePath.startsWith(path.resolve(__dirname) + path.sep) && filePath !== path.resolve(__dirname, 'index.html')) return json(res, 403, { error: 'Forbidden' });
  fs.readFile(filePath, (err, data) => {
    if (err) return json(res, 404, { error: 'Not found' });
    const ext = path.extname(filePath); const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.png' ? 'image/png' : ext === '.css' ? 'text/css' : ext === '.js' ? 'text/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400' }); res.end(data);
  });
}
http.createServer((req,res) => route(req,res).catch(e => json(res, 500, { error: 'Internal server error', detail: e.message }))).listen(PORT, () => console.log(`KING SPORTS server running at http://localhost:${PORT}`));
