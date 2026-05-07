<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import maplibregl, { Map as MlMap, Marker, Popup } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { MAPTILER_KEY, OFFICE, RADIUS_M } from '$lib/config';
	import type { Place } from '$lib/types';

	type Props = {
		places: Place[];
		selectedId: string | null;
		onselect?: (id: string) => void;
	};

	let { places, selectedId, onselect }: Props = $props();

	let container: HTMLDivElement;
	let map: MlMap | undefined;
	let markers = new Map<string, Marker>();
	let mapReady = $state(false);

	const styleUrl = MAPTILER_KEY
		? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
		: // Fallback OSM raster tiles — not for production but renders without a key.
			{
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
		if (selectedId && map) {
			const place = places.find((p) => p.id === selectedId);
			if (place) {
				map.flyTo({ center: [place.lon, place.lat], zoom: 17, duration: 600 });
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
</style>
