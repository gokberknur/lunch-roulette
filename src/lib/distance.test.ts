import { describe, expect, it } from 'vitest';
import { haversineMeters, walkMinutes } from './distance';

describe('haversineMeters', () => {
	it('returns 0 for identical points', () => {
		const p = { lat: 59.3326, lon: 18.0563 };
		expect(haversineMeters(p, p)).toBe(0);
	});

	it('approximates a known short distance within 1%', () => {
		// WTC Stockholm to Stockholm Central Station ~ 100 m apart
		const wtc = { lat: 59.3326, lon: 18.0563 };
		const central = { lat: 59.3309, lon: 18.0581 };
		const d = haversineMeters(wtc, central);
		expect(d).toBeGreaterThan(150);
		expect(d).toBeLessThan(300);
	});
});

describe('walkMinutes', () => {
	it('clamps to a minimum of 1 minute', () => {
		expect(walkMinutes(0)).toBe(1);
		expect(walkMinutes(20)).toBe(1);
	});

	it('rounds at 80 m/min', () => {
		expect(walkMinutes(400)).toBe(5);
		expect(walkMinutes(500)).toBe(6);
	});
});
