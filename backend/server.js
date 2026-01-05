import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import NodeCache from "node-cache";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AIRPORTS_FILE = process.env.AIRPORTS_FILE || path.join(__dirname, "data/airports.json");
const ROUTE_CACHE_FILE = process.env.ROUTE_CACHE_FILE || path.join(__dirname, "data/route-cache.json");
const ROUTE_CACHE_SECONDS = Number(process.env.ROUTE_CACHE_SECONDS || 600);

const cache = new NodeCache({ stdTTL: Number(process.env.CACHE_SECONDS || 5) });
const routeCache = new NodeCache({
  stdTTL: ROUTE_CACHE_SECONDS
});
let routeCacheStore = {};

function log(...args) {
  console.log(new Date().toISOString(), "-", ...args);
}

const airports = loadAirports();
loadRouteCacheFromDisk();

const DEFAULT_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const TOKEN_URLS = process.env.OPENSKY_TOKEN_URL
  ? [process.env.OPENSKY_TOKEN_URL]
  : [DEFAULT_TOKEN_URL];
let cachedOAuthToken = null;
let oauthTokenExpiresAt = 0;
const ROUTES_URL = process.env.OPENSKY_ROUTES_URL || "https://opensky-network.org/api/routes";
const ROUTE_MISS = "__no_route__";

async function getOAuthToken() {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    log("[OpenSky] Missing OPENSKY_CLIENT_ID/SECRET; skipping OAuth token request");
    return null;
  }

  const now = Date.now();
  if (cachedOAuthToken && now < oauthTokenExpiresAt) return cachedOAuthToken;

  const params = {
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret
  };
  if (process.env.OPENSKY_SCOPE) params.scope = process.env.OPENSKY_SCOPE;

  let lastError = null;

  for (const tokenUrl of TOKEN_URLS) {
    log("[OpenSky] Requesting OAuth token from", tokenUrl);
    try {
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams(params)
      });

      if (!response.ok) {
        const text = await response.text();
        const err = new Error(`OpenSky token error ${response.status}: ${text}`);
        err.status = response.status >= 500 ? 502 : response.status;
        throw err;
      }

      const data = await response.json();
      if (!data.access_token) {
        const err = new Error("OpenSky token response missing access_token");
        err.status = 502;
        throw err;
      }

      const expiresIn = Number(data.expires_in) || 300;
      cachedOAuthToken = data.access_token;
      oauthTokenExpiresAt = now + Math.max(expiresIn - 30, 1) * 1000;
      log("[OpenSky] Obtained OAuth token; expires in", expiresIn, "seconds");
      return cachedOAuthToken;
    } catch (err) {
      log("[OpenSky] Token request failed:", err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("Unable to fetch OpenSky token");
}

function toNum(v, name) {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    const err = new Error(`Invalid ${name}`);
    err.status = 400;
    throw err;
  }
  return n;
}

function loadAirports() {
  try {
    const raw = fs.readFileSync(AIRPORTS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    log("[Airports] Loaded", Object.keys(parsed).length, "entries");
    return parsed;
  } catch (err) {
    log("[Airports] Failed to load data:", err.message);
    return {};
  }
}

function describeAirport(code) {
  const ident = (code || "").trim().toUpperCase();
  if (!ident) return null;
  const data = airports[ident];
  return {
    code: ident,
    name: data?.name || null,
    city: data?.city || null,
    country: data?.country || null
  };
}

function setRouteCacheValue(key, value) {
  routeCache.set(key, value, ROUTE_CACHE_SECONDS);
  routeCacheStore[key] = {
    value,
    expiresAt: Date.now() + ROUTE_CACHE_SECONDS * 1000
  };
  persistRouteCacheStore();
}

function persistRouteCacheStore() {
  try {
    fs.mkdirSync(path.dirname(ROUTE_CACHE_FILE), { recursive: true });
    fs.writeFileSync(ROUTE_CACHE_FILE, JSON.stringify(routeCacheStore));
  } catch (err) {
    log("[Routes] Failed to persist cache:", err.message);
  }
}

function loadRouteCacheFromDisk() {
  try {
    if (!fs.existsSync(ROUTE_CACHE_FILE)) return;
    const raw = fs.readFileSync(ROUTE_CACHE_FILE, "utf-8");
    const data = JSON.parse(raw);
    const now = Date.now();
    let restored = 0;
    for (const [key, entry] of Object.entries(data)) {
      if (!entry || typeof entry !== "object") continue;
      const expiresAt = Number(entry.expiresAt);
      if (!expiresAt || expiresAt <= now) continue;
      const ttlSeconds = Math.floor((expiresAt - now) / 1000);
      if (ttlSeconds <= 0) continue;
      routeCache.set(key, entry.value, ttlSeconds);
      routeCacheStore[key] = { value: entry.value, expiresAt };
      restored += 1;
    }
    if (restored) {
      log("[Routes] Restored", restored, "cached routes from disk");
    }
  } catch (err) {
    log("[Routes] Failed to restore cached routes:", err.message);
    routeCacheStore = {};
  }
}

async function fetchRouteForCallsign(callsign) {
  const trimmed = (callsign || "").trim().toUpperCase();
  if (!trimmed) return null;

  const key = `route:${trimmed}`;
  const cached = routeCache.get(key);
  if (cached) {
    if (cached === ROUTE_MISS) return null;
    return cached;
  }

  const url = `${ROUTES_URL}?callsign=${encodeURIComponent(trimmed)}`;
  log("[Routes] Fetching route for", trimmed);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      const error = new Error(`Routes error ${response.status}: ${text}`);
      error.status = response.status >= 500 ? 502 : response.status;
      throw error;
    }

    const data = await response.json();
    const route = Array.isArray(data?.route)
      ? data.route.filter((code) => typeof code === "string" && code.trim().length > 0)
      : [];

    if (!route.length) {
      setRouteCacheValue(key, ROUTE_MISS);
      return null;
    }

    const fromCode = route[0] || null;
    const toCode = route[route.length - 1] || null;
    const payload = {
      callsign: trimmed,
      route,
      from: fromCode,
      to: toCode,
      fromAirport: describeAirport(fromCode),
      toAirport: describeAirport(toCode)
    };
    setRouteCacheValue(key, payload);
    return payload;
  } catch (err) {
    log("[Routes] Request failed:", err.message);
    throw err;
  }
}

// GET /api/airspace?lamin=43.5&lomin=-80&lamax=44&lomax=-79
app.get("/api/airspace", async (req, res) => {
  try {
    const lamin = toNum(req.query.lamin, "lamin");
    const lomin = toNum(req.query.lomin, "lomin");
    const lamax = toNum(req.query.lamax, "lamax");
    const lomax = toNum(req.query.lomax, "lomax");
    log("[OpenSky] Incoming bbox", lamin, lomin, lamax, lomax);

    // Keep bbox reasonable (prevents accidental "world" queries)
    const area = Math.abs((lamax - lamin) * (lomax - lomin));
    if (area > 400) return res.status(400).json({ error: "BBox too large" });

    const key = `bbox:${lamin},${lomin},${lamax},${lomax}`;
    const cached = cache.get(key);
    if (cached) {
      log("[OpenSky] cache hit", key);
      return res.json(cached);
    }

    const url =
      `https://opensky-network.org/api/states/all` +
      `?lamin=${encodeURIComponent(lamin)}` +
      `&lomin=${encodeURIComponent(lomin)}` +
      `&lamax=${encodeURIComponent(lamax)}` +
      `&lomax=${encodeURIComponent(lomax)}`;

    const headers = {};
    let accessToken = null;
    try {
      accessToken = await getOAuthToken();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log("[OpenSky] Continuing without OAuth token:", message);
    }
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    } else if (process.env.OPENSKY_USERNAME && process.env.OPENSKY_PASSWORD) {
      const basicToken = Buffer.from(
        `${process.env.OPENSKY_USERNAME}:${process.env.OPENSKY_PASSWORD}`
      ).toString("base64");
      headers.Authorization = `Basic ${basicToken}`;
    }

    const r = await fetch(url, { headers });
    if (!r.ok) {
      const text = await r.text();
      log("[OpenSky] states/all error", r.status, text);
      return res.status(r.status).send(text);
    }
    const data = await r.json();

    // Normalize to an object array your frontend likes
    const aircraft = (data.states || [])
      .filter((s) => s && s.length >= 17)
      .map((s) => ({
        icao24: s[0],
        callsign: (s[1] || "").trim(),
        originCountry: s[2],
        timePosition: s[3],
        lastContact: s[4],
        lon: s[5],
        lat: s[6],
        baroAltitude: s[7],
        onGround: s[8],
        velocity: s[9],
        trueTrack: s[10],
        verticalRate: s[11],
        geoAltitude: s[13],
        squawk: s[14],
        spi: s[15],
        positionSource: s[16]
      }))
      .filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lon));

    const payload = { time: data.time, aircraft };
    cache.set(key, payload);

    res.json(payload);
  } catch (e) {
    const status = Number(e.status) || Number(e.statusCode) || 400;
    log("[OpenSky] Request failed:", e.message);
    res.status(status).json({ error: e.message });
  }
});

// GET /api/flight/summary?icao24=abcd12
app.get("/api/flight/summary", async (req, res) => {
  try {
    const { icao24 } = req.query;
    if (!icao24) {
      return res.status(400).json({ error: "icao24 required" });
    }

    const now = Math.floor(Date.now() / 1000);
    const begin = now - 6 * 3600; // last 6 hours

    const url =
      `https://opensky-network.org/api/flights/aircraft` +
      `?icao24=${encodeURIComponent(icao24)}` +
      `&begin=${begin}&end=${now}`;

    const headers = {};
    if (process.env.OPENSKY_USERNAME && process.env.OPENSKY_PASSWORD) {
      const basicToken = Buffer.from(
        `${process.env.OPENSKY_USERNAME}:${process.env.OPENSKY_PASSWORD}`
      ).toString("base64");
      headers.Authorization = `Basic ${basicToken}`;
    }

    const r = await fetch(url, { headers });
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).send(text);
    }

    const flights = await r.json();
    if (!flights.length) {
      return res.json(null);
    }

    // pick most recent flight
    const f = flights[flights.length - 1];

    res.json({
      icao24: f.icao24,
      callsign: (f.callsign || "").trim(),
      fromAirport: f.estDepartureAirport,
      toAirport: f.estArrivalAirport,
      firstSeen: f.firstSeen,
      lastSeen: f.lastSeen || null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/routes/:callsign", async (req, res) => {
  try {
    const callsign = req.params.callsign;
    if (!callsign || !callsign.trim()) {
      return res.status(400).json({ error: "Missing callsign" });
    }
    const route = await fetchRouteForCallsign(callsign);
    res.json({
      callsign: callsign.trim().toUpperCase(),
      from: route?.from || null,
      to: route?.to || null,
      route: route?.route || null,
      fromAirport: route?.fromAirport || (route?.from ? describeAirport(route.from) : null),
      toAirport: route?.toAirport || (route?.to ? describeAirport(route.to) : null)
    });
  } catch (err) {
    const status = Number(err.status) || Number(err.statusCode) || 502;
    res.status(status).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 8080, () => {
  log(`Backend running on port ${process.env.PORT || 8080}`);
});
