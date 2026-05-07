<script lang="ts">
	import RestaurantCard from './RestaurantCard.svelte';
	import type { Place } from '$lib/types';

	type Props = {
		places: Place[];
		selectedId: string | null;
		onselect?: (id: string) => void;
	};

	let { places, selectedId, onselect }: Props = $props();
</script>

<ul class="list">
	{#each places as place (place.id)}
		<li>
			<RestaurantCard
				{place}
				selected={place.id === selectedId}
				onclick={() => onselect?.(place.id)}
			/>
		</li>
	{:else}
		<li class="empty">No restaurants match the current filters.</li>
	{/each}
</ul>

<style>
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.empty {
		text-align: center;
		color: var(--muted, #a0a4ad);
		padding: 24px 12px;
		font-size: 0.9rem;
	}
</style>
