const EARTH_RADIUS_M = 6_371_000;
const WALK_M_PER_MIN = 80;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineMeters(
	a: { lat: number; lon: number },
	b: { lat: number; lon: number }
): number {
	const dLat = toRad(b.lat - a.lat);
	const dLon = toRad(b.lon - a.lon);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);

	const h =
		Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function walkMinutes(distanceM: number): number {
	return Math.max(1, Math.round(distanceM / WALK_M_PER_MIN));
}
