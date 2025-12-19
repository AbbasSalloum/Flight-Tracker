import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import NodeCache from "node-cache";

dotenv.config();

const app = express();
app.use(cors());

const cache = new NodeCache({ stdTTL: Number(process.env.CACHE_SECONDS || 5) });

function log(...args) {
  console.log(new Date().toISOString(), "-", ...args);
}

const DEFAULT_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const TOKEN_URLS = process.env.OPENSKY_TOKEN_URL
  ? [process.env.OPENSKY_TOKEN_URL]
  : [DEFAULT_TOKEN_URL];
let cachedOAuthToken = null;
let oauthTokenExpiresAt = 0;

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
    const accessToken = await getOAuthToken();
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

app.listen(process.env.PORT || 8080, () => {
  log(`Backend running on port ${process.env.PORT || 8080}`);
});
