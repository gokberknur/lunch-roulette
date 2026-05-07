import type { FeatureCollection, Feature, LineString } from 'geojson';

export type RouteResult = {
	geojson: FeatureCollection;
	distanceM: number;
	durationS: number;
};

export async function fetchWalkingRoute(
	from: { lat: number; lon: number },
	to: { lat: number; lon: number },
	signal?: AbortSignal
): Promise<RouteResult | null> {
	const url = `https://router.project-osrm.org/route/v1/foot/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
	const res = await fetch(url, { signal });
	if (!res.ok) return null;
	const data = (await res.json()) as {
		routes?: { geometry: LineString; distance: number; duration: number }[];
	};
	const route = data.routes?.[0];
	if (!route) return null;
	const feature: Feature<LineString> = {
		type: 'Feature',
		geometry: route.geometry,
		properties: {}
	};
	return {
		geojson: { type: 'FeatureCollection', features: [feature] },
		distanceM: route.distance,
		durationS: route.duration
	};
}

export function getCurrentPosition(timeoutMs = 10_000): Promise<{ lat: number; lon: number }> {
	return new Promise((resolve, reject) => {
		if (!('geolocation' in navigator)) {
			reject(new Error('Geolocation not supported'));
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
			(err) => reject(err),
			{ enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 }
		);
	});
}
