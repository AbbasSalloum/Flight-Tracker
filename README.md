## Flight Tracker

Flight Tracker lets you explore live aircraft from the OpenSky Network on an interactive Leaflet map.  
Click a plane to view its latest track, departure and arrival airports, and key telemetry.

---

### 1. Prerequisites

- **Node.js 20+** (LTS recommended) with npm
- An OpenSky Network account for authenticated API access (set `OPENSKY_USERNAME`/`OPENSKY_PASSWORD`, or OAuth credentials if you have them)

---

### 2. Clone the repository

```bash
git clone <REPO_URL> flight-tracker
cd flight-tracker
```

---

### 3. Backend setup (`/backend`)

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Configure environment (create `.env`):
   ```dotenv
   PORT=8080

   # OpenSky account credentials (Basic auth)
   OPENSKY_USERNAME=your_username
   OPENSKY_PASSWORD=your_password

   # Optional: OAuth client for higher limits
   # OPENSKY_CLIENT_ID=...
   # OPENSKY_CLIENT_SECRET=...
   ```
3. Start the API server:
   ```bash
   npm run dev
   ```
   The backend exposes `/api/airspace`, `/api/flight/summary`, `/api/flight/track`, and `/api/routes/:callsign`, proxying the OpenSky APIs and enriching them with local airport metadata.

---

### 4. Frontend setup (`/frontend`)

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Create a `.env` if you need to override the backend URL (default assumes `http://localhost:8080`):
   ```dotenv
   VITE_API_BASE=http://localhost:8080
   ```
3. Run the Vite dev server:
   ```bash
   npm run dev
   ```
   Visit the printed URL (usually `http://localhost:5173`) to open the map UI.

To build for production run `npm run build` in `frontend` and serve the `dist` directory with any static host.

---

### 5. Using the app

1. Pan/zoom the map to set the area of interest. The frontend requests `/api/airspace` every few seconds to refresh aircraft in view.
2. Click an aircraft marker to open the side panel:
   - Displays callsign, altitude, speed, heading, squawk, etc.
   - Shows the most recent track polyline.
   - Fetches `/api/flight/summary` to display the inferred departure and arrival airports and their timestamps.
3. Use your OpenSky credentials with sufficient quota for live data; unauthenticated requests are rate-limited heavily.

---

### 6. Troubleshooting

- **No aircraft shown**: make sure the backend is running on `8080` and your OpenSky credentials are correct.
- **Missing departure/arrival info**: OpenSky sometimes returns empty results; the backend already falls back to airport-based lookups, but very recent flights may need more time before they appear.
- **Production deploy**: run `npm run build` in both `backend` and `frontend`, deploy the backend (Express app) to your host, and serve the frontend build output with any static host or behind the same server/proxy.

Feel free to extend the README with more environment-specific steps if you deploy to cloud infrastructure or package the app differently.
