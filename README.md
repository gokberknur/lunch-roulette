# Lunch Roulette

A tiny PWA that picks a lunch spot near the office. Mobile-first, installable, runs entirely on free services.

- 🍔 Filter by cuisine + "open now"
- 🎲 "Pick for us" if you can't decide
- 🧭 Walking directions
- 📍 Live "you are here" dot
- 🌐 Installable on iOS / Android / desktop

## Run it

```bash
npm install
cp .env.example .env    # keys are optional in dev
npm run dev -- --host
```

Then open `http://<your-laptop-ip>:5173/lunch` on your phone (same Wi-Fi).

## What's behind it (all free)

| Job                | Service                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Restaurant data    | [Overpass API](https://overpass-api.de/) (OpenStreetMap), no key                                                            |
| Map rendering      | [MapLibre GL](https://maplibre.org/), OSS                                                                                   |
| Map tiles          | [MapTiler](https://www.maptiler.com/cloud/) (free tier, 100k loads/mo); falls back to CartoDB Positron raster without a key |
| Walking directions | [OpenRouteService](https://openrouteservice.org/) (free tier, 2000 reqs/day)                                                |
| Live location      | `navigator.geolocation`                                                                                                     |

For production, grab a free MapTiler key (sharper vector tiles) and OpenRouteService key (directions need it). Both take a minute to sign up. Keys go in `.env`.

## Move the office

Edit `OFFICE` in `src/lib/config.ts`. The localStorage cache key is scoped to coords + radius, so it rebuilds automatically.

## Build & deploy

```bash
npm run build      # static site → /build
npm run preview
```

Drop the contents of `build/` on any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages). No backend.
