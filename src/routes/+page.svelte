<script lang="ts">
	import MapView from '$lib/components/Map.svelte';
	import RestaurantList from '$lib/components/RestaurantList.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import PickForUs from '$lib/components/PickForUs.svelte';
	import { fetchPlaces, type FetchResult } from '$lib/overpass';
	import { openStatus } from '$lib/opening-hours';
	import { OFFICE, RADIUS_M } from '$lib/config';
	import { onMount } from 'svelte';

	let result = $state<FetchResult | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let selectedCuisines = $state(new Set<string>());
	let openNowOnly = $state(false);
	let selectedId = $state<string | null>(null);
	let sheetExpanded = $state(false);

	onMount(async () => {
		try {
			result = await fetchPlaces();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load restaurants';
		} finally {
			loading = false;
		}
	});

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
		const next = new Set(selectedCuisines);
		if (next.has(c)) next.delete(c);
		else next.add(c);
		selectedCuisines = next;
	}

	function clearCuisines() {
		selectedCuisines = new Set();
	}

	function toggleOpenNow() {
		openNowOnly = !openNowOnly;
	}

	function selectPlace(id: string) {
		selectedId = id;
		sheetExpanded = true;
	}
</script>

<div class="app">
	<div class="map-wrap">
		<MapView places={filtered} {selectedId} onselect={selectPlace} />
	</div>

	<aside class="sheet" class:expanded={sheetExpanded}>
		<button
			class="sheet-handle"
			type="button"
			onclick={() => (sheetExpanded = !sheetExpanded)}
			aria-label={sheetExpanded ? 'Collapse list' : 'Expand list'}
		>
			<span class="grip"></span>
		</button>

		<header class="sheet-header">
			<div class="title">
				<span class="dot"></span>
				<span>{OFFICE.name}</span>
				<span class="radius">· {RADIUS_M} m</span>
			</div>
			<PickForUs places={filtered} onpick={selectPlace} />
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
	}

	.sheet {
		background: var(--surface);
		border-top-left-radius: 20px;
		border-top-right-radius: 20px;
		box-shadow: 0 -8px 28px rgba(0, 0, 0, 0.4);
		display: flex;
		flex-direction: column;
		max-height: 38vh;
		transition: max-height 0.3s ease;
		overflow: hidden;
	}
	.sheet.expanded {
		max-height: 80vh;
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

	/* Desktop: side-by-side layout */
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
