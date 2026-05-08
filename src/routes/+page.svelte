<script lang="ts">
	import MapView from '$lib/components/Map.svelte';
	import RestaurantList from '$lib/components/RestaurantList.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import PickForUs from '$lib/components/PickForUs.svelte';
	import { fetchPlaces, type FetchResult } from '$lib/overpass';
	import { openStatus } from '$lib/opening-hours';
	import { OFFICE, RADIUS_M } from '$lib/config';
	import { fetchWalkingRoute, watchPosition, type WatchedPosition } from '$lib/route';
	import type { FindMeState } from '$lib/components/Map.svelte';
	import type { FeatureCollection } from 'geojson';
	import { onDestroy, onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';

	let result = $state<FetchResult | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const selectedCuisines = new SvelteSet<string>();
	let openNowOnly = $state(false);
	let selectedId = $state<string | null>(null);
	let sheetExpanded = $state(false);
	let sheetHidden = $state(false);

	let userPosition = $state<WatchedPosition | null>(null);
	let followUser = $state(false);
	let findMeState = $state<FindMeState>('idle');
	let stopWatch: (() => void) | null = null;

	let route = $state<FeatureCollection | null>(null);
	let routeMeta = $state<{ distanceM: number; durationS: number } | null>(null);
	let routeLoading = $state(false);
	let routeError = $state<string | null>(null);
	let fitRoute = $state(false);

	onMount(async () => {
		try {
			result = await fetchPlaces();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load restaurants';
		} finally {
			loading = false;
		}
	});

	function stopFindMe() {
		stopWatch?.();
		stopWatch = null;
		followUser = false;
		if (findMeState === 'tracking') findMeState = 'idle';
	}

	function handleFindMe() {
		if (findMeState === 'tracking') {
			// already watching: just resume follow + recentre (Map.svelte handles the pan)
			followUser = true;
			return;
		}
		findMeState = 'locating';
		stopWatch = watchPosition(
			(pos) => {
				userPosition = pos;
				findMeState = 'tracking';
				followUser = true;
			},
			(err) => {
				if (err.code === err.PERMISSION_DENIED) {
					findMeState = 'denied';
				} else {
					findMeState = 'idle';
				}
				stopWatch?.();
				stopWatch = null;
			}
		);
	}

	function handleUserPan() {
		if (followUser) followUser = false;
	}

	function onVisibilityChange() {
		if (document.visibilityState === 'hidden') stopFindMe();
	}

	$effect(() => {
		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => document.removeEventListener('visibilitychange', onVisibilityChange);
	});

	onDestroy(stopFindMe);

	const places = $derived(result?.places ?? []);

	const cuisines = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const p of places) {
			for (const c of p.cuisine) counts.set(c, (counts.get(c) ?? 0) + 1);
		}
		return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
	});

	const filtered = $derived.by(() => {
		const now = new Date();
		return places.filter((p) => {
			if (selectedCuisines.size > 0) {
				if (!p.cuisine.some((c) => selectedCuisines.has(c))) return false;
			}
			if (openNowOnly && openStatus(p.openingHours, now) !== 'open') return false;
			return true;
		});
	});

	function toggleCuisine(c: string) {
		if (selectedCuisines.has(c)) selectedCuisines.delete(c);
		else selectedCuisines.add(c);
	}

	function clearCuisines() {
		selectedCuisines.clear();
	}

	function toggleOpenNow() {
		openNowOnly = !openNowOnly;
	}

	function selectPlace(id: string) {
		selectedId = id;
		fitRoute = false;
		clearRoute();
	}

	function clearRoute() {
		route = null;
		routeMeta = null;
		routeError = null;
	}

	async function showDirections(id: string) {
		const place = places.find((p) => p.id === id);
		if (!place) return;
		selectedId = id;
		sheetHidden = true;
		sheetExpanded = false;
		fitRoute = true;
		routeError = null;
		routeLoading = true;
		clearRoute();

		let from: { lat: number; lon: number };
		if (userPosition) {
			from = { lat: userPosition.lat, lon: userPosition.lon };
		} else {
			from = OFFICE;
			routeError = 'Tap "Find me" to route from your location — showing route from the office.';
		}

		const r = await fetchWalkingRoute(from, { lat: place.lat, lon: place.lon });
		routeLoading = false;

		if (typeof r === 'string') {
			const messages: Record<typeof r, string> = {
				'no-key': 'Walking directions unavailable — PUBLIC_ORS_KEY is not set.',
				unauthorized: 'Walking directions unavailable — invalid OpenRouteService key.',
				'rate-limited': 'Hit the daily directions limit — try again tomorrow.',
				unavailable: 'Routing service unavailable.'
			};
			routeError = (routeError ? routeError + ' ' : '') + messages[r];
			return;
		}

		route = r.geojson;
		routeMeta = { distanceM: r.distanceM, durationS: r.durationS };
	}

	function clearDirections() {
		clearRoute();
		fitRoute = false;
		sheetHidden = false;
	}

	const selectedPlace = $derived(selectedId ? places.find((p) => p.id === selectedId) : null);

	const externalDirectionsUrl = $derived.by(() => {
		if (!selectedPlace) return '';
		const { lat, lon } = selectedPlace;
		return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;
	});
</script>

<div class="app" class:sheet-hidden={sheetHidden}>
	<div class="map-wrap">
		<MapView
			places={filtered}
			{selectedId}
			userLocation={userPosition ? { lat: userPosition.lat, lon: userPosition.lon } : null}
			accuracy={userPosition?.accuracy ?? null}
			{followUser}
			{route}
			{fitRoute}
			{findMeState}
			onselect={selectPlace}
			ondirections={showDirections}
			onfindme={handleFindMe}
			onuserpan={handleUserPan}
		/>

		{#if sheetHidden}
			<button
				class="floating-show"
				type="button"
				onclick={() => (sheetHidden = false)}
				aria-label="Show panel"
			>
				☰ Panel
			</button>
		{/if}

		{#if route || routeLoading || routeError}
			<div class="directions-banner" role="status">
				{#if routeLoading}
					<span>Finding route…</span>
				{:else if routeMeta && selectedPlace}
					<div class="route-info">
						<strong>{selectedPlace.name}</strong>
						<span>
							{Math.round(routeMeta.distanceM)} m ·
							🚶 {Math.max(1, Math.round(routeMeta.durationS / 60))} min
						</span>
					</div>
					<div class="route-actions">
						<a class="ext-link" href={externalDirectionsUrl} target="_blank" rel="noopener">
							Open in Google Maps ↗
						</a>
						<button type="button" class="banner-close" onclick={clearDirections}>Close</button>
					</div>
				{:else if routeError}
					<span class="error">{routeError}</span>
					<button type="button" class="banner-close" onclick={clearDirections}>Close</button>
				{/if}
			</div>
		{/if}
	</div>

	<aside class="sheet" class:expanded={sheetExpanded} class:hidden={sheetHidden}>
		<div class="sheet-controls">
			<button
				class="sheet-handle"
				type="button"
				onclick={() => (sheetExpanded = !sheetExpanded)}
				aria-label={sheetExpanded ? 'Collapse list' : 'Expand list'}
			>
				<span class="grip"></span>
			</button>
			<button
				class="hide-btn"
				type="button"
				onclick={() => (sheetHidden = true)}
				aria-label="Hide panel"
				title="Hide panel"
			>
				✕
			</button>
		</div>

		<header class="sheet-header">
			<div class="title">
				<span class="dot"></span>
				<span>{OFFICE.name}</span>
				<span class="radius">· {RADIUS_M} m</span>
			</div>
			<PickForUs places={filtered} onpick={selectPlace} ondirections={showDirections} />
		</header>

		<div class="sheet-body">
			{#if loading}
				<p class="status">Loading restaurants…</p>
			{:else if error}
				<p class="status error">⚠️ {error}</p>
			{:else}
				<FilterBar
					{cuisines}
					{selectedCuisines}
					{openNowOnly}
					count={filtered.length}
					total={places.length}
					ontoggleCuisine={toggleCuisine}
					onclearCuisines={clearCuisines}
					ontoggleOpenNow={toggleOpenNow}
				/>

				{#if result?.source === 'stale-cache'}
					<p class="notice">Showing cached results — couldn't reach Overpass.</p>
				{/if}

				<RestaurantList places={filtered} {selectedId} onselect={selectPlace} />
			{/if}
		</div>
	</aside>
</div>

<style>
	.app {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
	}

	.map-wrap {
		flex: 1;
		min-height: 0;
		position: relative;
	}

	.floating-show {
		position: absolute;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--surface);
		color: var(--on-surface);
		border: 1px solid #2a2f38;
		border-radius: 999px;
		padding: 10px 18px;
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		font-family: inherit;
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
		z-index: 10;
	}
	.floating-show:hover {
		background: #232730;
	}

	.directions-banner {
		position: absolute;
		left: 12px;
		right: 12px;
		top: 12px;
		background: var(--surface);
		color: var(--on-surface);
		border-radius: 12px;
		padding: 12px 14px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
		z-index: 10;
		flex-wrap: wrap;
		font-size: 0.9rem;
	}
	.directions-banner .route-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.directions-banner strong {
		font-size: 0.95rem;
	}
	.directions-banner .route-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.directions-banner .ext-link {
		color: var(--accent);
		text-decoration: none;
		font-weight: 600;
	}
	.directions-banner .banner-close {
		background: transparent;
		border: 1px solid #2a2f38;
		color: var(--on-surface);
		border-radius: 8px;
		padding: 6px 10px;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.85rem;
	}
	.directions-banner .error {
		color: #f87171;
	}

	.sheet {
		background: var(--surface);
		border-top-left-radius: 20px;
		border-top-right-radius: 20px;
		box-shadow: 0 -8px 28px rgba(0, 0, 0, 0.4);
		display: flex;
		flex-direction: column;
		max-height: 38vh;
		transition: max-height 0.3s ease, transform 0.3s ease, opacity 0.3s ease;
		overflow: hidden;
	}
	.sheet.expanded {
		max-height: 80vh;
	}
	.sheet.hidden {
		transform: translateY(110%);
		opacity: 0;
		pointer-events: none;
	}

	.sheet-controls {
		position: relative;
		display: grid;
		place-items: center;
		padding: 4px 0;
	}
	.sheet-handle {
		background: transparent;
		border: none;
		padding: 8px 0 4px;
		cursor: pointer;
		display: grid;
		place-items: center;
	}
	.grip {
		width: 40px;
		height: 4px;
		border-radius: 2px;
		background: #3a3f4a;
	}
	.hide-btn {
		position: absolute;
		right: 8px;
		top: 4px;
		background: transparent;
		border: none;
		color: var(--muted);
		font-size: 1rem;
		cursor: pointer;
		padding: 6px 10px;
		border-radius: 8px;
	}
	.hide-btn:hover {
		color: var(--on-surface);
		background: rgba(255, 255, 255, 0.05);
	}

	.sheet-header {
		padding: 0 16px 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.title .dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
	}
	.title .radius {
		opacity: 0.7;
	}

	.sheet-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0 16px 24px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		-webkit-overflow-scrolling: touch;
	}

	.status {
		text-align: center;
		color: var(--muted);
		padding: 16px;
	}
	.status.error {
		color: #f87171;
	}
	.notice {
		font-size: 0.8rem;
		color: var(--muted);
		background: rgba(255, 235, 59, 0.08);
		border: 1px solid rgba(255, 235, 59, 0.2);
		padding: 8px 12px;
		border-radius: 8px;
		margin: 0;
	}

	@media (min-width: 900px) {
		.app {
			flex-direction: row-reverse;
		}
		.map-wrap {
			flex: 1;
		}
		.sheet {
			width: 420px;
			max-height: none;
			height: 100%;
			border-radius: 0;
			box-shadow: 8px 0 28px rgba(0, 0, 0, 0.4);
			transition: transform 0.3s ease, opacity 0.3s ease;
		}
		.sheet.hidden {
			transform: translateX(110%);
		}
		.sheet-handle {
			display: none;
		}
		.sheet-header {
			padding: 20px 20px 12px;
		}
		.sheet-body {
			padding: 0 20px 20px;
		}
	}
</style>
