import type { FeatureCollection } from 'geojson';
import { ORS_KEY } from './config';

export type RouteResult = {
	geojson: FeatureCollection;
	distanceM: number;
	durationS: number;
};

export type RouteError = 'no-key' | 'unauthorized' | 'rate-limited' | 'unavailable';

const ORS_URL = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';

type OrsRouteProperties = {
	summary?: { distance?: number; duration?: number };
};

export async function fetchWalkingRoute(
	from: { lat: number; lon: number },
	to: { lat: number; lon: number },
	signal?: AbortSignal
): Promise<RouteResult | RouteError> {
	if (!ORS_KEY) return 'no-key';

	let res: Response;
	try {
		res = await fetch(ORS_URL, {
			method: 'POST',
			signal,
			headers: {
				Authorization: ORS_KEY,
				'Content-Type': 'application/json',
				Accept: 'application/json, application/geo+json'
			},
			body: JSON.stringify({
				coordinates: [
					[from.lon, from.lat],
					[to.lon, to.lat]
				]
			})
		});
	} catch {
		return 'unavailable';
	}

	if (res.status === 401 || res.status === 403) return 'unauthorized';
	if (res.status === 429) return 'rate-limited';
	if (!res.ok) return 'unavailable';

	const data = (await res.json()) as FeatureCollection;
	const feature = data.features?.[0];
	if (!feature || feature.geometry.type !== 'LineString') return 'unavailable';

	const props = (feature.properties ?? {}) as OrsRouteProperties;
	const distanceM = props.summary?.distance ?? 0;
	const durationS = props.summary?.duration ?? 0;

	return {
		geojson: { type: 'FeatureCollection', features: [feature] },
		distanceM,
		durationS
	};
}

export type WatchedPosition = { lat: number; lon: number; accuracy: number };

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

export function watchPosition(
	onUpdate: (pos: WatchedPosition) => void,
	onError: (err: GeolocationPositionError) => void
): () => void {
	if (!('geolocation' in navigator)) {
		queueMicrotask(() =>
			onError({
				code: 2,
				message: 'Geolocation not supported',
				PERMISSION_DENIED: 1,
				POSITION_UNAVAILABLE: 2,
				TIMEOUT: 3
			} as GeolocationPositionError)
		);
		return () => {};
	}
	const id = navigator.geolocation.watchPosition(
		(pos) =>
			onUpdate({
				lat: pos.coords.latitude,
				lon: pos.coords.longitude,
				accuracy: pos.coords.accuracy
			}),
		onError,
		{ enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 }
	);
	return () => navigator.geolocation.clearWatch(id);
}
