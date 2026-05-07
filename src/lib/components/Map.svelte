<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import maplibregl, { Map as MlMap, Marker, Popup, LngLatBounds } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { MAPTILER_KEY, OFFICE, RADIUS_M } from '$lib/config';
	import type { Place } from '$lib/types';
	import type { FeatureCollection } from 'geojson';

	type Props = {
		places: Place[];
		selectedId: string | null;
		userLocation?: { lat: number; lon: number } | null;
		route?: FeatureCollection | null;
		fitRoute?: boolean;
		onselect?: (id: string) => void;
	};

	let {
		places,
		selectedId,
		userLocation = null,
		route = null,
		fitRoute = false,
		onselect
	}: Props = $props();

	let container: HTMLDivElement;
	let map: MlMap | undefined;
	let markers = new Map<string, Marker>();
	let userMarker: Marker | undefined;
	let mapReady = $state(false);

	const styleUrl = MAPTILER_KEY
		? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
		: {
				version: 8 as const,
				sources: {
					osm: {
						type: 'raster' as const,
						tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
						tileSize: 256,
						attribution: '© OpenStreetMap contributors'
					}
				},
				layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }]
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

	onMount(() => {
		map = new maplibregl.Map({
			container,
			style: styleUrl,
			center: [OFFICE.lon, OFFICE.lat],
			zoom: 16,
			attributionControl: { compact: true }
		});

		map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

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
			case 'cafe':
				return '☕';
			case 'fast_food':
				return '🍔';
			case 'food_court':
				return '🍱';
			default:
				return '🍽️';
		}
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
				el.textContent = amenityEmoji(p.amenity);
				el.setAttribute('aria-label', p.name);
				el.addEventListener('click', (e) => {
					e.stopPropagation();
					onselect?.(p.id);
				});
				m = new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map);
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
		if (selectedId && map && !fitRoute) {
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
		} else if (userMarker) {
			userMarker.remove();
			userMarker = undefined;
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

<style>
	.map {
		width: 100%;
		height: 100%;
	}

	:global(.office-pin) {
		font-size: 22px;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
		cursor: default;
	}

	:global(.place-pin) {
		font-size: 22px;
		background: white;
		border: 2px solid #ff6b35;
		border-radius: 50%;
		width: 36px;
		height: 36px;
		display: grid;
		place-items: center;
		cursor: pointer;
		padding: 0;
		transition:
			transform 0.15s,
			border-color 0.15s;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
	}
	:global(.place-pin:hover) {
		transform: scale(1.1);
	}
	:global(.place-pin.selected) {
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
</style>
