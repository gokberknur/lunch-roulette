import { haversineMeters, walkMinutes } from './distance';
import type { Amenity, Place } from './types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const AMENITIES: Amenity[] = ['restaurant', 'fast_food', 'food_court'];

type OverpassElement = {
	type: 'node' | 'way' | 'relation';
	id: number;
	lat?: number;
	lon?: number;
	center?: { lat: number; lon: number };
	tags?: Record<string, string>;
};

type OverpassResponse = { elements: OverpassElement[] };

type Cached = { fetchedAt: number; places: Place[] };

type Center = { lat: number; lon: number };

function cacheKey(center: Center, radiusM: number): string {
	return `lunch-roulette:places:v2:${center.lat.toFixed(4)},${center.lon.toFixed(4)}:${radiusM}`;
}

function buildQuery(center: Center, radiusM: number): string {
	const filter = AMENITIES.join('|');
	return `[out:json][timeout:25];
(
  node["amenity"~"^(${filter})$"](around:${radiusM},${center.lat},${center.lon});
  way["amenity"~"^(${filter})$"](around:${radiusM},${center.lat},${center.lon});
);
out center tags;`;
}

function normalize(elements: OverpassElement[], center: Center): Place[] {
	const places: Place[] = [];
	for (const el of elements) {
		const tags = el.tags ?? {};
		const name = tags.name?.trim();
		if (!name) continue;

		const amenity = tags.amenity as Amenity | undefined;
		if (!amenity || !AMENITIES.includes(amenity)) continue;

		const lat = el.lat ?? el.center?.lat;
		const lon = el.lon ?? el.center?.lon;
		if (lat === undefined || lon === undefined) continue;

		const distanceM = haversineMeters(center, { lat, lon });

		places.push({
			id: `${el.type}/${el.id}`,
			name,
			lat,
			lon,
			amenity,
			cuisine: tags.cuisine
				? tags.cuisine
						.split(';')
						.map((c) => c.trim())
						.filter(Boolean)
				: [],
			openingHours: tags.opening_hours,
			website: tags.website ?? tags['contact:website'],
			phone: tags.phone ?? tags['contact:phone'],
			distanceM,
			walkMin: walkMinutes(distanceM)
		});
	}
	places.sort((a, b) => a.distanceM - b.distanceM);
	return places;
}

function readCache(key: string): Cached | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		return JSON.parse(raw) as Cached;
	} catch {
		return null;
	}
}

function writeCache(key: string, places: Place[]): void {
	if (typeof localStorage === 'undefined') return;
	try {
		const payload: Cached = { fetchedAt: Date.now(), places };
		localStorage.setItem(key, JSON.stringify(payload));
	} catch {
		// quota or disabled — fine to ignore
	}
}

export type FetchResult = {
	places: Place[];
	source: 'network' | 'cache' | 'stale-cache';
	fetchedAt: number;
};

export async function fetchPlaces(center: Center, radiusM: number): Promise<FetchResult> {
	const key = cacheKey(center, radiusM);
	const cached = readCache(key);
	const fresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;
	if (cached && fresh) {
		return { places: cached.places, source: 'cache', fetchedAt: cached.fetchedAt };
	}

	try {
		const res = await fetch(OVERPASS_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: 'data=' + encodeURIComponent(buildQuery(center, radiusM))
		});
		if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
		const data = (await res.json()) as OverpassResponse;
		const places = normalize(data.elements, center);
		writeCache(key, places);
		return { places, source: 'network', fetchedAt: Date.now() };
	} catch (err) {
		if (cached) {
			return { places: cached.places, source: 'stale-cache', fetchedAt: cached.fetchedAt };
		}
		throw err;
	}
}
