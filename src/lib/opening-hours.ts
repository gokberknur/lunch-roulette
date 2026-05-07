import OpeningHours from 'opening_hours';

export type OpenStatus = 'open' | 'closed' | 'unknown';

export function openStatus(spec: string | undefined, now: Date = new Date()): OpenStatus {
	if (!spec) return 'unknown';
	try {
		const oh = new OpeningHours(spec);
		return oh.getState(now) ? 'open' : 'closed';
	} catch {
		return 'unknown';
	}
}
