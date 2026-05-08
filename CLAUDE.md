# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev -- --host    # Vite dev server (--host so a phone on the LAN can hit it)
npm run build            # Static build to /build (adapter-static)
npm run preview          # Serve the built app
npm run check            # svelte-kit sync + svelte-check (type check)
npm run lint             # prettier --check + eslint
npm run format           # prettier --write
npm run test             # vitest --run (one-shot)
npm run test:unit        # vitest watch mode
npx vitest run src/lib/distance.test.ts   # single test file
npm run icons            # Regenerate PWA PNG icons from static/icons/icon.svg (uses sharp)
```

Node 24+ is required (see `.nvmrc`). Copy `.env.example` to `.env`. Set `PUBLIC_MAPTILER_KEY` for production map tiles (without it, MapLibre falls back to raw OSM raster — fine for dev, **not for production**). Set `PUBLIC_ORS_KEY` for walking directions (without it, "Show directions" returns a `'no-key'` error). Both have free tiers — see `.env.example` for signup links.

## Architecture

Static-only SvelteKit PWA. There is **no backend** — all data comes from third-party public APIs at runtime, cached in `localStorage` and the service worker.

**Deployed under a base path of `/lunch`** (`svelte.config.js` → `kit.paths.base`). All app routes, manifest URLs (`start_url`, `scope`, `id`), and icon paths are scoped to `/lunch/`. When adding new asset URLs or service worker scopes, keep this prefix in mind.

**Svelte 5 runes mode is forced project-wide** (`svelte.config.js` `compilerOptions.runes`). Use `$state`, `$derived`, `$derived.by`, `$effect` — not stores or `$:` reactive statements. Component props go through `$props()`.

### Data flow

1. `src/lib/overpass.ts` — `fetchPlaces()` is the single entry point. It POSTs an Overpass QL query (built from `OFFICE` lat/lon + `RADIUS_M` in `src/lib/config.ts`) to `overpass-api.de`, normalizes nodes/ways into `Place` objects, sorts by distance, and writes a `localStorage` cache with a 24h TTL. The cache key is **scoped to the office coords + radius** so changing `OFFICE` invalidates the cache automatically. On network failure with a cached payload, returns `source: 'stale-cache'` so the UI can show a notice.
2. `src/lib/opening-hours.ts` — wraps the `opening_hours` package; returns `'open' | 'closed' | 'unknown'` (the third for missing/unparseable specs). The "Open now" filter excludes `'closed'` only — `'unknown'` items pass through.
3. `src/lib/route.ts` — `fetchWalkingRoute()` POSTs to OpenRouteService (`api.openrouteservice.org/v2/directions/foot-walking/geojson`) with `PUBLIC_ORS_KEY` in the `Authorization` header and returns a `RouteResult` (GeoJSON + distance + duration) **or a string error code** (`'no-key' | 'unauthorized' | 'rate-limited' | 'unavailable'`) — callers must `typeof r === 'string'` switch. `watchPosition()` is the live-location helper used by the "Find me" UX (returns an unsubscribe). `getCurrentPosition()` is kept as a one-shot fallback. Show-directions does **not** auto-prompt for permission — the "Find me" button is the explicit consent surface.
4. `src/lib/distance.ts` — pure haversine + a fixed walking-pace estimator (`WALK_M_PER_MIN = 80`).

### UI shape

`src/routes/+page.svelte` is the single page. It owns all state (places, filters, selection, route, sheet visibility, live geolocation) and passes data + callbacks down to leaf components in `src/lib/components/` (`Map.svelte`, `RestaurantList.svelte`, `FilterBar.svelte`, `PickForUs.svelte`, `RestaurantCard.svelte`). The bottom sheet is mobile-first; at `min-width: 900px` it becomes a side panel via CSS only. `MapView` is a MapLibre GL wrapper — when adding map state, prefer passing props (`places`, `selectedId`, `userLocation`, `accuracy`, `followUser`, `route`, `fitRoute`, `findMeState`) over reaching into the map instance from the parent. The "Find me" button + live-tracking lifecycle (start watch on click, stop on `visibilitychange === hidden` and `onDestroy`) lives in `+page.svelte` — `Map.svelte` only renders. Place markers use a two-element pattern (`.place-pin` outer button held by MapLibre's positioning transform, `.place-pin-inner` for visual state) so CSS transitions on the inner element don't lag MapLibre's per-frame translate during pan.

### PWA / caching

`vite.config.ts` configures `@vite-pwa/sveltekit` with two Workbox runtime cache rules:

- MapTiler tiles: `CacheFirst`, 7d, 500 entries.
- Overpass API: `NetworkFirst`, 10s timeout, 24h, 20 entries.

The Overpass cache is **layered**: Workbox handles HTTP-level caching, while `overpass.ts` keeps its own `localStorage` cache for the parsed `Place[]` (faster than re-parsing and survives if the SW is unregistered). Don't collapse these into one — they serve different purposes.

### Map tiles

`MAPTILER_KEY` and `ORS_KEY` are read via `$env/dynamic/public` so the build doesn't bake them in. If `MAPTILER_KEY` is empty, `Map.svelte` falls back to raw OSM raster tiles — fine for dev, treat the key as required for any deployed environment.

## Tooling for Claude Code

This repo vendors the official Svelte AI skills under `.claude/skills/` (`svelte-code-writer`, `svelte-core-bestpractices`) and exposes the Svelte docs/autofixer MCP server via `.mcp.json` (`https://mcp.svelte.dev/mcp`). When editing `.svelte` / `.svelte.ts` / `.svelte.js` files, load these skills and prefer the MCP's `list-sections` / `get-documentation` / `svelte-autofixer` over training-data recall — Svelte 5 syntax (runes, snippets, `@attach`) is recent and easy to get wrong otherwise. Skills are vendored from `sveltejs/ai-tools`; re-sync per `.claude/skills/README.md`.

## Conventions

- Tabs for indentation, single quotes, no semicolons missing — see `.prettierrc`.
- Test files live next to the code they test (`distance.test.ts` next to `distance.ts`); Vitest's `server` project picks up `src/**/*.{test,spec}.{js,ts}` and excludes `*.svelte.test.ts`.
- Imports from `$lib/*` resolve to `src/lib/*` (SvelteKit alias).
