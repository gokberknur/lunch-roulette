export type Amenity = 'restaurant' | 'cafe' | 'fast_food' | 'food_court';

export type Place = {
	id: string;
	name: string;
	lat: number;
	lon: number;
	amenity: Amenity;
	cuisine: string[];
	openingHours?: string;
	website?: string;
	phone?: string;
	distanceM: number;
	walkMin: number;
};
