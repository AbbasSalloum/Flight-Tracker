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
const FLIGHT_SUMMARY_CACHE_SECONDS = Number(process.env.FLIGHT_SUMMARY_CACHE_SECONDS || 120);
const flightSummaryCache = new NodeCache({ stdTTL: FLIGHT_SUMMARY_CACHE_SECONDS });
const FLIGHT_LOOKBACK_SECONDS = Number(process.env.FLIGHT_LOOKBACK_SECONDS || 6 * 3600);
const AIRPORT_LOOKUP_SECONDS = Number(process.env.AIRPORT_LOOKUP_SECONDS || 3 * 3600);
const MAX_AIRPORT_WINDOW = 48 * 3600;

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

function buildBasicAuthHeaders() {
  const user = process.env.OPENSKY_USERNAME;
  const pass = process.env.OPENSKY_PASSWORD;
  if (!user || !pass) return {};
  const token = Buffer.from(`${user}:${pass}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

function normalizeAirportCode(code) {
  const trimmed = (code || "").trim().toUpperCase();
  return trimmed || null;
}

function buildAirportDetails(code, time, fallbackAirport = null) {
  const normalizedCode = normalizeAirportCode(code || fallbackAirport?.code);
  const described = normalizedCode ? describeAirport(normalizedCode) : null;
  const source = described || fallbackAirport;
  if (!normalizedCode && !source) return null;
  return {
    code: normalizedCode || source?.code || null,
    name: source?.name || null,
    city: source?.city || null,
    country: source?.country || null,
    time: time || null
  };
}

async function findAirportFlight(type, airportCode, icao24, referenceTime = null) {
  const normalizedCode = normalizeAirportCode(airportCode);
  const targetIcao = (icao24 || "").trim().toLowerCase();
  if (!normalizedCode || !targetIcao) return null;

  const now = Math.floor(Date.now() / 1000);
  let end = referenceTime ? referenceTime + AIRPORT_LOOKUP_SECONDS : now;
  let begin = referenceTime ? Math.max(referenceTime - AIRPORT_LOOKUP_SECONDS, 0) : Math.max(end - AIRPORT_LOOKUP_SECONDS, 0);
  if (end - begin > MAX_AIRPORT_WINDOW) {
    end = begin + MAX_AIRPORT_WINDOW;
  }

  const endpoint = type === "arrival" ? "flights/arrival" : "flights/departure";
  const url =
    `https://opensky-network.org/api/${endpoint}` +
    `?airport=${encodeURIComponent(normalizedCode)}` +
    `&begin=${begin}` +
    `&end=${end}`;

  try {
    const headers = buildBasicAuthHeaders();
    const response = await fetch(url, { headers });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      const text = await response.text();
      log(`[Flights] ${type} lookup error ${response.status}: ${text}`);
      return null;
    }

    const flights = await response.json();
    if (!Array.isArray(flights)) return null;
    return flights.find(
      (flight) => typeof flight?.icao24 === "string" && flight.icao24.toLowerCase() === targetIcao
    );
  } catch (err) {
    log(`[Flights] ${type} lookup failed:`, err.message);
    return null;
  }
}

async function buildFlightRecordFromRoute(icao24, routeData) {
  if (!routeData) return null;
  const record = {
    icao24,
    callsign: routeData.callsign || null,
    estDepartureAirport: routeData.from || null,
    estArrivalAirport: routeData.to || null,
    firstSeen: null,
    lastSeen: null
  };

  const departure = routeData.from
    ? await findAirportFlight("departure", routeData.from, icao24)
    : null;
  const arrival = routeData.to ? await findAirportFlight("arrival", routeData.to, icao24) : null;

  if (departure) {
    record.estDepartureAirport = departure.estDepartureAirport || record.estDepartureAirport;
    record.estArrivalAirport = record.estArrivalAirport || departure.estArrivalAirport || null;
    record.firstSeen = departure.firstSeen || record.firstSeen;
    record.lastSeen = departure.lastSeen || record.lastSeen;
  }

  if (arrival) {
    record.estArrivalAirport = arrival.estArrivalAirport || record.estArrivalAirport;
    record.firstSeen = record.firstSeen || arrival.firstSeen || null;
    record.lastSeen = arrival.lastSeen || record.lastSeen;
  }

  return record;
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
    const callsignHint = req.query.callsign;
    if (!icao24) {
      return res.status(400).json({ error: "icao24 required" });
    }

    log("[Flights] Summary lookup for", icao24);
    const cacheKey = (icao24 || "").trim().toLowerCase();
    if (cacheKey) {
      const cached = flightSummaryCache.get(cacheKey);
      if (cached !== undefined) {
        log("[Flights] summary cache hit for", icao24);
        return res.json(cached);
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const begin = now - FLIGHT_LOOKBACK_SECONDS;

    const url =
      `https://opensky-network.org/api/flights/aircraft` +
      `?icao24=${encodeURIComponent(icao24)}` +
      `&begin=${begin}&end=${now}`;

    const headers = buildBasicAuthHeaders();

    let summaryFlight = null;
    let summarySource = "aircraft";
    let response = await fetch(url, { headers });
    if (!response.ok) {
      const text = await response.text();
      log("[Flights] summary error", response.status, text);
    } else {
      const flights = await response.json();
      if (Array.isArray(flights) && flights.length) {
        summaryFlight = flights[flights.length - 1];
      }
    }

    const callsign = (summaryFlight?.callsign || callsignHint || "").trim().toUpperCase();
    let routeInfo = null;
    if (callsign) {
      try {
        routeInfo = await fetchRouteForCallsign(callsign);
      } catch (err) {
        log("[Flights] route lookup failed:", err.message);
      }
    }

    if (!summaryFlight) {
      summaryFlight = await buildFlightRecordFromRoute(icao24, routeInfo);
      if (summaryFlight) summarySource = "route";
    }

    if (!summaryFlight) {
      log("[Flights] summary miss for", icao24);
      if (cacheKey) flightSummaryCache.set(cacheKey, null);
      return res.json(null);
    }

    let departureCode = normalizeAirportCode(summaryFlight.estDepartureAirport);
    let arrivalCode = normalizeAirportCode(summaryFlight.estArrivalAirport);
    let departureTime = summaryFlight.firstSeen || null;
    let arrivalTime = summaryFlight.lastSeen || null;

    if (!departureCode && routeInfo?.from) {
      const departure = await findAirportFlight(
        "departure",
        routeInfo.from,
        icao24,
        summaryFlight.firstSeen || null
      );
      if (departure) {
        departureCode = routeInfo.from;
        departureTime = departure.firstSeen || departureTime;
        arrivalCode = arrivalCode || departure.estArrivalAirport || routeInfo.to || null;
        arrivalTime = arrivalTime || departure.lastSeen || null;
        if (summarySource === "aircraft") summarySource = "enriched";
      }
    }

    if (!arrivalCode && routeInfo?.to) {
      const arrival = await findAirportFlight(
        "arrival",
        routeInfo.to,
        icao24,
        summaryFlight.lastSeen || null
      );
      if (arrival) {
        arrivalCode = routeInfo.to;
        arrivalTime = arrival.lastSeen || arrivalTime;
        departureCode = departureCode || arrival.estDepartureAirport || routeInfo.from || null;
        departureTime = departureTime || arrival.firstSeen || null;
        if (summarySource === "aircraft") summarySource = "enriched";
      }
    }

    const payload = {
      icao24: summaryFlight.icao24,
      callsign: callsign || summaryFlight.callsign || null,
      fromAirport: departureCode,
      toAirport: arrivalCode,
      firstSeen: departureTime,
      lastSeen: arrivalTime,
      route: routeInfo?.route || null,
      source: summarySource
    };

    payload.departure = buildAirportDetails(departureCode, departureTime, routeInfo?.fromAirport);
    payload.arrival = buildAirportDetails(arrivalCode, arrivalTime, routeInfo?.toAirport);

    if (cacheKey) flightSummaryCache.set(cacheKey, payload);
    res.json(payload);

    log(
      "[Flights] summary hit",
      icao24,
      "route",
      departureCode || "???",
      "->",
      arrivalCode || "???"
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/flight/track?icao24=abcd12
app.get("/api/flight/track", async (req, res) => {
  try {
    const { icao24 } = req.query;
    if (!icao24) {
      return res.status(400).json({ error: "icao24 required" });
    }

    const url = `https://opensky-network.org/api/tracks/all?icao24=${encodeURIComponent(icao24)}`;
    const headers = buildBasicAuthHeaders();

    const r = await fetch(url, { headers });
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).send(text);
    }

    const data = await r.json();

    // Track format: [time, lat, lon, alt, track]
    const path = (data.path || [])
      .filter((p) => Number.isFinite(p[1]) && Number.isFinite(p[2]))
      .map((p) => [p[1], p[2]]);

    res.json({
      icao24,
      callsign: data.callsign,
      startTime: data.startTime,
      endTime: data.endTime,
      path
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

function parsePort(raw) {
  if (raw === undefined) {
    return { port: 8080, envDefined: false };
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    log(`[Server] Invalid PORT "${raw}", falling back to 8080`);
    return { port: 8080, envDefined: false };
  }
  return { port: parsed, envDefined: true };
}

function startServer(port, { allowRetry } = { allowRetry: false }) {
  const server = app.listen(port, () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    log(`Backend running on port ${actualPort}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      if (!allowRetry) {
        log(`[Server] Port ${port} is already in use. Stop the other process or set PORT to a different value.`);
        process.exit(1);
      }
      log(`[Server] Port ${port} is busy. Trying a random open port...`);
      startServer(0, { allowRetry: false });
      return;
    }

    log("[Server] Failed to start:", err.message);
    process.exit(1);
  });
}

const { port: desiredPort, envDefined } = parsePort(process.env.PORT);
startServer(desiredPort, { allowRetry: !envDefined });
