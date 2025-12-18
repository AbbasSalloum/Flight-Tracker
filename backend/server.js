import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import NodeCache from "node-cache";

dotenv.config();

const app = express();
app.use(cors());

const cache = new NodeCache({ stdTTL: Number(process.env.CACHE_SECONDS || 5) });

function toNum(v, name) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid ${name}`);
  return n;
}

// GET /api/airspace?lamin=43.5&lomin=-80&lamax=44&lomax=-79
app.get("/api/airspace", async (req, res) => {
  try {
    const lamin = toNum(req.query.lamin, "lamin");
    const lomin = toNum(req.query.lomin, "lomin");
    const lamax = toNum(req.query.lamax, "lamax");
    const lomax = toNum(req.query.lomax, "lomax");

    // Keep bbox reasonable (prevents accidental "world" queries)
    const area = Math.abs((lamax - lamin) * (lomax - lomin));
    if (area > 400) return res.status(400).json({ error: "BBox too large" });

    const key = `bbox:${lamin},${lomin},${lamax},${lomax}`;
    const cached = cache.get(key);
    if (cached) return res.json(cached);

    const url =
      `https://opensky-network.org/api/states/all` +
      `?lamin=${encodeURIComponent(lamin)}` +
      `&lomin=${encodeURIComponent(lomin)}` +
      `&lamax=${encodeURIComponent(lamax)}` +
      `&lomax=${encodeURIComponent(lomax)}`;

    const headers = {};
    // Optional: add Basic auth (helps with rate limits / access policies)
    if (process.env.OPENSKY_USERNAME && process.env.OPENSKY_PASSWORD) {
      const token = Buffer.from(
        `${process.env.OPENSKY_USERNAME}:${process.env.OPENSKY_PASSWORD}`
      ).toString("base64");
      headers.Authorization = `Basic ${token}`;
    }

    const r = await fetch(url, { headers });
    if (!r.ok) {
      const text = await r.text();
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
    res.status(400).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 8080, () => {
  console.log(`Backend running on port ${process.env.PORT || 8080}`);
});
