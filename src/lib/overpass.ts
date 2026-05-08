import { OFFICE, RADIUS_M } from './config';
import { haversineMeters, walkMinutes } from './distance';
import type { Amenity, Place } from './types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CACHE_KEY = `lunch-roulette:places:v2:${OFFICE.lat},${OFFICE.lon}:${RADIUS_M}`;
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

function buildQuery(): string {
	const filter = AMENITIES.join('|');
	return `[out:json][timeout:25];
(
  node["amenity"~"^(${filter})$"](around:${RADIUS_M},${OFFICE.lat},${OFFICE.lon});
  way["amenity"~"^(${filter})$"](around:${RADIUS_M},${OFFICE.lat},${OFFICE.lon});
);
out center tags;`;
}

function normalize(elements: OverpassElement[]): Place[] {
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

		const distanceM = haversineMeters(OFFICE, { lat, lon });

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

function readCache(): Cached | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as Cached;
	} catch {
		return null;
	}
}

function writeCache(places: Place[]): void {
	if (typeof localStorage === 'undefined') return;
	try {
		const payload: Cached = { fetchedAt: Date.now(), places };
		localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
	} catch {
		// quota or disabled — fine to ignore
	}
}

export type FetchResult = {
	places: Place[];
	source: 'network' | 'cache' | 'stale-cache';
	fetchedAt: number;
};

export async function fetchPlaces(): Promise<FetchResult> {
	const cached = readCache();
	const fresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;
	if (cached && fresh) {
		return { places: cached.places, source: 'cache', fetchedAt: cached.fetchedAt };
	}

	try {
		const res = await fetch(OVERPASS_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: 'data=' + encodeURIComponent(buildQuery())
		});
		if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
		const data = (await res.json()) as OverpassResponse;
		const places = normalize(data.elements);
		writeCache(places);
		return { places, source: 'network', fetchedAt: Date.now() };
	} catch (err) {
		if (cached) {
			return { places: cached.places, source: 'stale-cache', fetchedAt: cached.fetchedAt };
		}
		throw err;
	}
}
