<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import maplibregl, { Map as MlMap, Marker, Popup, LngLatBounds } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { MAPTILER_KEY, OFFICE, RADIUS_M } from '$lib/config';
	import type { Place } from '$lib/types';
	import type { FeatureCollection } from 'geojson';
	import { openStatus } from '$lib/opening-hours';

	export type FindMeState = 'idle' | 'locating' | 'denied' | 'tracking';

	type Props = {
		places: Place[];
		selectedId: string | null;
		userLocation?: { lat: number; lon: number } | null;
		accuracy?: number | null;
		followUser?: boolean;
		route?: FeatureCollection | null;
		fitRoute?: boolean;
		findMeState?: FindMeState;
		onselect?: (id: string) => void;
		ondirections?: (id: string) => void;
		onfindme?: () => void;
		onuserpan?: () => void;
	};

	let {
		places,
		selectedId,
		userLocation = null,
		accuracy = null,
		followUser = false,
		route = null,
		fitRoute = false,
		findMeState = 'idle',
		onselect,
		ondirections,
		onfindme,
		onuserpan
	}: Props = $props();

	let container: HTMLDivElement;
	let map: MlMap | undefined;
	let markers = new Map<string, Marker>();
	let userMarker: Marker | undefined;
	let mapReady = $state(false);

	const styleUrl = MAPTILER_KEY
		? `https://api.maptiler.com/maps/positron/style.json?key=${MAPTILER_KEY}`
		: {
				version: 8 as const,
				sources: {
					carto: {
						type: 'raster' as const,
						tiles: [
							'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
							'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
							'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
							'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
						],
						tileSize: 256,
						attribution:
							'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'
					}
				},
				layers: [{ id: 'carto', type: 'raster' as const, source: 'carto' }]
			};

	function radiusPolygon(center: { lat: number; lon: number }, radiusM: number, steps = 64) {
		const coords: [number, number][] = [];
		const earth = 6_371_000;
		const lat = (center.lat * Math.PI) / 180;
		for (let i = 0; i <= steps; i++) {
			const bearing = (i / steps) * 2 * Math.PI;
			const dLat = (radiusM / earth) * Math.cos(bearing);
			const dLon = (radiusM / (earth * Math.cos(lat))) * Math.sin(bearing);
			coords.push([
				center.lon + (dLon * 180) / Math.PI,
				center.lat + (dLat * 180) / Math.PI
			]);
		}
		return {
			type: 'Feature' as const,
			geometry: { type: 'Polygon' as const, coordinates: [coords] },
			properties: {}
		};
	}

	const emptyRoute: FeatureCollection = { type: 'FeatureCollection', features: [] };
	const emptyAccuracy: FeatureCollection = { type: 'FeatureCollection', features: [] };

	onMount(() => {
		map = new maplibregl.Map({
			container,
			style: styleUrl,
			center: [OFFICE.lon, OFFICE.lat],
			zoom: 16,
			attributionControl: { compact: true }
		});

		map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

		map.on('dragstart', (e) => {
			// only react to user-initiated drags (not programmatic flyTo/fitBounds)
			if (e.originalEvent) onuserpan?.();
		});

		map.on('load', () => {
			if (!map) return;
			map.addSource('radius', { type: 'geojson', data: radiusPolygon(OFFICE, RADIUS_M) });
			map.addLayer({
				id: 'radius-fill',
				type: 'fill',
				source: 'radius',
				paint: { 'fill-color': '#ff6b35', 'fill-opacity': 0.08 }
			});
			map.addLayer({
				id: 'radius-line',
				type: 'line',
				source: 'radius',
				paint: { 'line-color': '#ff6b35', 'line-width': 1.5, 'line-dasharray': [2, 2] }
			});

			map.addSource('accuracy', { type: 'geojson', data: emptyAccuracy });
			map.addLayer({
				id: 'accuracy-fill',
				type: 'fill',
				source: 'accuracy',
				paint: { 'fill-color': '#1e90ff', 'fill-opacity': 0.12 }
			});
			map.addLayer({
				id: 'accuracy-line',
				type: 'line',
				source: 'accuracy',
				paint: { 'line-color': '#1e90ff', 'line-width': 1, 'line-opacity': 0.5 }
			});

			map.addSource('route', { type: 'geojson', data: emptyRoute });
			map.addLayer({
				id: 'route-casing',
				type: 'line',
				source: 'route',
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: { 'line-color': '#0f1115', 'line-width': 8, 'line-opacity': 0.6 }
			});
			map.addLayer({
				id: 'route-line',
				type: 'line',
				source: 'route',
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: { 'line-color': '#ff6b35', 'line-width': 5 }
			});

			const officeEl = document.createElement('div');
			officeEl.className = 'office-pin';
			officeEl.textContent = '🏢';
			new maplibregl.Marker({ element: officeEl })
				.setLngLat([OFFICE.lon, OFFICE.lat])
				.setPopup(new Popup({ offset: 12 }).setText(OFFICE.name))
				.addTo(map);

			mapReady = true;
		});
	});

	onDestroy(() => {
		map?.remove();
	});

	function amenityEmoji(a: Place['amenity']): string {
		switch (a) {
			case 'fast_food':
				return '🍔';
			case 'food_court':
				return '🍱';
			default:
				return '🍽️';
		}
	}

	function buildPopupContent(place: Place, popup: Popup): HTMLElement {
		const root = document.createElement('div');
		root.className = 'place-popup';

		const status = openStatus(place.openingHours);
		const cuisine = place.cuisine.slice(0, 2).join(' · ');
		const statusLabel =
			status === 'open' ? '● Open' : status === 'closed' ? '● Closed' : '● Hours unknown';

		root.innerHTML = `
			<div class="popup-name"></div>
			<div class="popup-meta">
				<span class="popup-distance"></span>
				<span class="popup-walk"></span>
				<span class="popup-status popup-status-${status}"></span>
			</div>
			${cuisine ? '<div class="popup-cuisine"></div>' : ''}
		`;
		(root.querySelector('.popup-name') as HTMLElement).textContent = place.name;
		(root.querySelector('.popup-distance') as HTMLElement).textContent =
			`${Math.round(place.distanceM)} m`;
		(root.querySelector('.popup-walk') as HTMLElement).textContent = `🚶 ${place.walkMin} min`;
		(root.querySelector('.popup-status') as HTMLElement).textContent = statusLabel;
		const cuisineEl = root.querySelector('.popup-cuisine') as HTMLElement | null;
		if (cuisineEl) cuisineEl.textContent = cuisine;

		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'popup-directions';
		btn.textContent = '🧭 Show directions';
		btn.addEventListener('click', () => {
			popup.remove();
			ondirections?.(place.id);
		});
		root.appendChild(btn);

		return root;
	}

	$effect(() => {
		if (!map || !mapReady) return;

		const seen = new Set<string>();
		for (const p of places) {
			seen.add(p.id);
			let m = markers.get(p.id);
			if (!m) {
				const el = document.createElement('button');
				el.type = 'button';
				el.className = 'place-pin';
				el.setAttribute('aria-label', p.name);
				const inner = document.createElement('span');
				inner.className = 'place-pin-inner';
				inner.textContent = amenityEmoji(p.amenity);
				el.appendChild(inner);
				el.addEventListener('click', (e) => {
					e.stopPropagation();
					onselect?.(p.id);
				});
				const popup = new maplibregl.Popup({
					offset: 22,
					closeButton: false,
					maxWidth: '260px'
				});
				popup.setDOMContent(buildPopupContent(p, popup));
				m = new maplibregl.Marker({ element: el })
					.setLngLat([p.lon, p.lat])
					.setPopup(popup)
					.addTo(map);
				markers.set(p.id, m);
			}
		}
		for (const [id, m] of markers) {
			if (!seen.has(id)) {
				m.remove();
				markers.delete(id);
			}
		}
	});

	$effect(() => {
		for (const [id, m] of markers) {
			const el = m.getElement();
			el.classList.toggle('selected', id === selectedId);
		}
		if (selectedId && map && !fitRoute && !followUser) {
			const place = places.find((p) => p.id === selectedId);
			if (place) {
				map.flyTo({ center: [place.lon, place.lat], zoom: 17, duration: 600 });
			}
		}
	});

	$effect(() => {
		if (!map || !mapReady) return;
		if (userLocation) {
			if (!userMarker) {
				const el = document.createElement('div');
				el.className = 'user-pin';
				el.innerHTML = '<span class="user-dot"></span>';
				userMarker = new maplibregl.Marker({ element: el })
					.setLngLat([userLocation.lon, userLocation.lat])
					.addTo(map);
			} else {
				userMarker.setLngLat([userLocation.lon, userLocation.lat]);
			}
			if (followUser) {
				map.easeTo({ center: [userLocation.lon, userLocation.lat], duration: 500 });
			}
		} else if (userMarker) {
			userMarker.remove();
			userMarker = undefined;
		}
	});

	$effect(() => {
		if (!map || !mapReady) return;
		const src = map.getSource('accuracy') as maplibregl.GeoJSONSource | undefined;
		if (!src) return;
		if (userLocation && accuracy && accuracy > 0) {
			src.setData({
				type: 'FeatureCollection',
				features: [radiusPolygon(userLocation, accuracy, 32)]
			});
		} else {
			src.setData(emptyAccuracy);
		}
	});

	$effect(() => {
		if (!map || !mapReady) return;
		const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
		if (!src) return;
		src.setData(route ?? emptyRoute);

		if (fitRoute && route && route.features.length > 0) {
			const bounds = new LngLatBounds();
			for (const f of route.features) {
				if (f.geometry.type === 'LineString') {
					for (const c of f.geometry.coordinates) bounds.extend(c as [number, number]);
				}
			}
			if (!bounds.isEmpty()) {
				map.fitBounds(bounds, { padding: 60, maxZoom: 17, duration: 700 });
			}
		}
	});
</script>

<div class="map" bind:this={container}></div>

<button
	class="find-me"
	class:active={findMeState === 'tracking' && followUser}
	class:denied={findMeState === 'denied'}
	type="button"
	onclick={() => onfindme?.()}
	disabled={findMeState === 'denied' || findMeState === 'locating'}
	aria-label={findMeState === 'tracking' ? 'Recentre on me' : 'Find me'}
	title={findMeState === 'denied' ? 'Location permission denied' : 'Find me'}
>
	{#if findMeState === 'locating'}⌛{:else}◎{/if}
</button>

<style>
	.map {
		width: 100%;
		height: 100%;
	}

	.find-me {
		position: absolute;
		left: 12px;
		bottom: 16px;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--surface, #1a1d24);
		color: var(--on-surface, #f5f5f5);
		border: 1px solid #2a2f38;
		font-size: 1.2rem;
		font-family: inherit;
		cursor: pointer;
		display: grid;
		place-items: center;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		transition:
			background 0.15s,
			color 0.15s,
			border-color 0.15s;
		z-index: 10;
	}
	.find-me:hover:not(:disabled) {
		background: #232730;
	}
	.find-me.active {
		background: #1e90ff;
		color: white;
		border-color: #1e90ff;
	}
	.find-me.denied {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.find-me:disabled {
		opacity: 0.5;
		cursor: wait;
	}

	:global(.office-pin) {
		font-size: 22px;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
		cursor: default;
	}

	:global(.place-pin) {
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: inherit;
	}
	:global(.place-pin-inner) {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		font-size: 22px;
		background: white;
		border: 2px solid #ff6b35;
		border-radius: 50%;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
		transition:
			transform 0.15s,
			border-color 0.15s,
			background 0.15s;
	}
	:global(.place-pin:hover .place-pin-inner) {
		transform: scale(1.1);
	}
	:global(.place-pin.selected .place-pin-inner) {
		transform: scale(1.25);
		border-color: #0f1115;
		background: #ffeb3b;
	}

	:global(.user-pin) {
		width: 22px;
		height: 22px;
		display: grid;
		place-items: center;
	}
	:global(.user-pin .user-dot) {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #1e90ff;
		border: 3px solid white;
		box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.25);
	}

	:global(.maplibregl-popup-content) {
		background: var(--surface, #1a1d24);
		color: var(--on-surface, #f5f5f5);
		border-radius: 12px;
		padding: 12px 14px;
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
	}
	:global(.maplibregl-popup-tip) {
		border-top-color: var(--surface, #1a1d24) !important;
		border-bottom-color: var(--surface, #1a1d24) !important;
	}
	:global(.place-popup .popup-name) {
		font-weight: 700;
		font-size: 1rem;
		margin-bottom: 6px;
	}
	:global(.place-popup .popup-meta) {
		display: flex;
		gap: 10px;
		font-size: 0.8rem;
		color: var(--muted, #a0a4ad);
		flex-wrap: wrap;
	}
	:global(.place-popup .popup-status-open) {
		color: #4ade80;
	}
	:global(.place-popup .popup-status-closed) {
		color: #f87171;
	}
	:global(.place-popup .popup-cuisine) {
		font-size: 0.8rem;
		color: var(--muted, #a0a4ad);
		text-transform: capitalize;
		margin-top: 4px;
	}
	:global(.place-popup .popup-directions) {
		display: block;
		width: 100%;
		margin-top: 10px;
		padding: 8px 12px;
		background: #ff6b35;
		color: #0f1115;
		border: none;
		border-radius: 8px;
		font-weight: 600;
		font-size: 0.9rem;
		font-family: inherit;
		cursor: pointer;
	}
	:global(.place-popup .popup-directions:hover) {
		background: #ff8054;
	}
</style>
