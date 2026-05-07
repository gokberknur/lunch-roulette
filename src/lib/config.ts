export const OFFICE = {
	name: 'WTC Stockholm',
	lat: 59.3326,
	lon: 18.0563
} as const;

export const RADIUS_M = 500;

import { env } from '$env/dynamic/public';

export const MAPTILER_KEY = env.PUBLIC_MAPTILER_KEY ?? '';
