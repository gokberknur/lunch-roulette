# Lunch Roulette

Mobile-first PWA that picks a lunch spot near the office.

- Office: WTC Stockholm (Klarabergsviadukten 70), 500 m radius.
- Restaurant data: [Overpass API](https://overpass-api.de/) (OpenStreetMap), no key required.
- Map: [MapLibre GL](https://maplibre.org/) + [MapTiler](https://www.maptiler.com/cloud/) tiles (free tier, OSM raster fallback in dev).
- Walking directions: [OpenRouteService](https://openrouteservice.org/) free tier.
- Live geolocation with "Find me" button (blue dot follows as you walk).
- Installable on iOS / Android / desktop.

## Setup

```bash
nvm use   # Node 24+
npm install
cp .env.example .env
# add a free MapTiler key + OpenRouteService key (or skip MapTiler for OSM raster fallback in dev)
npm run dev -- --host    # --host so you can open it on your phone
```

Open on phone via `http://<your-laptop-ip>:5173`.

## Stack

- SvelteKit (Svelte 5, runes mode)
- `maplibre-gl` v5 — renderer (OSS, no token required)
- OpenRouteService — walking-route API
- `@sveltejs/adapter-static` — deploys anywhere static (Netlify / Vercel / Cloudflare Pages / GitHub Pages)
- `@vite-pwa/sveltekit` — manifest + service worker + Workbox runtime caching for tiles & Overpass
- `opening_hours` — parses OSM `opening_hours` strings for the "Open now" filter

## Configuration

| File | What |
|---|---|
| `src/lib/config.ts` | Office lat/lon and search radius |
| `.env` | `PUBLIC_MAPTILER_KEY=…` ([sign up](https://www.maptiler.com/cloud/), free 100k tile loads/mo) |
|       | `PUBLIC_ORS_KEY=…` ([sign up](https://openrouteservice.org/dev/#/signup), free 2000 directions/day) |

To move the office, edit `OFFICE` in `src/lib/config.ts` and the cache will rebuild on next load (the localStorage cache key is scoped to lat/lon/radius).

## Scripts

```bash
npm run dev          # Vite dev server
npm run build        # Static build to /build
npm run preview      # Serve the built app
npm run test         # Vitest (lib/distance unit tests)
npm run check        # svelte-check
npm run lint         # Prettier + ESLint
npm run format       # Prettier --write
npm run icons        # Regenerate PNG PWA icons from static/icons/icon.svg
```

## Deploy

`npm run build` produces a fully static site in `build/`. Drop it on any static host. No server, no backend.

## Known limits

- Overpass occasionally rate-limits — the app falls back to the local cache (24 h TTL) and shows a notice.
- OSM coverage in central Stockholm is excellent; in less-mapped areas you may see fewer results.
- Without a MapTiler key, the dev fallback uses raw OSM tiles. **Don't ship that to production** — OSM's tile servers aren't for public app traffic. Get a free MapTiler key.
- OpenRouteService free tier is 2000 walking-route requests per day across the whole API key. Each "Show directions" click counts as one.
