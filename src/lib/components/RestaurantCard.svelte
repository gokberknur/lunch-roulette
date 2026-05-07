<script lang="ts">
	import type { Place } from '$lib/types';
	import { openStatus } from '$lib/opening-hours';

	type Props = {
		place: Place;
		selected?: boolean;
		onclick?: () => void;
	};

	let { place, selected = false, onclick }: Props = $props();

	const status = $derived(openStatus(place.openingHours));
	const cuisineLabel = $derived(place.cuisine.slice(0, 2).join(' · '));
</script>

<button class="card" class:selected type="button" {onclick}>
	<div class="row-1">
		<span class="name">{place.name}</span>
		<span class="distance">{Math.round(place.distanceM)} m</span>
	</div>
	<div class="row-2">
		{#if cuisineLabel}
			<span class="cuisine">{cuisineLabel}</span>
		{:else}
			<span class="cuisine muted">{place.amenity.replace('_', ' ')}</span>
		{/if}
		<span class="walk">🚶 {place.walkMin} min</span>
		<span class="status status-{status}">
			{#if status === 'open'}● Open{:else if status === 'closed'}● Closed{:else}● Hours unknown{/if}
		</span>
	</div>
</button>

<style>
	.card {
		display: block;
		width: 100%;
		text-align: left;
		background: var(--surface, #1a1d24);
		color: var(--on-surface, #f5f5f5);
		border: 1px solid transparent;
		border-radius: 12px;
		padding: 12px 14px;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background 0.15s;
		font: inherit;
	}
	.card:hover {
		border-color: rgba(255, 107, 53, 0.5);
	}
	.card.selected {
		border-color: #ff6b35;
		background: #232831;
	}
	.row-1 {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 4px;
	}
	.name {
		font-weight: 600;
		font-size: 1rem;
	}
	.distance {
		font-size: 0.8rem;
		color: var(--muted, #a0a4ad);
		flex-shrink: 0;
	}
	.row-2 {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		font-size: 0.8rem;
		color: var(--muted, #a0a4ad);
	}
	.cuisine {
		text-transform: capitalize;
	}
	.muted {
		opacity: 0.7;
	}
	.status-open {
		color: #4ade80;
	}
	.status-closed {
		color: #f87171;
	}
	.status-unknown {
		color: var(--muted, #a0a4ad);
	}
</style>
