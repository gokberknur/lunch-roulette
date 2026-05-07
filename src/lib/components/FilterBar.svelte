<script lang="ts">
	type Props = {
		cuisines: string[];
		selectedCuisines: Set<string>;
		openNowOnly: boolean;
		count: number;
		total: number;
		ontoggleCuisine: (c: string) => void;
		onclearCuisines: () => void;
		ontoggleOpenNow: () => void;
	};

	let {
		cuisines,
		selectedCuisines,
		openNowOnly,
		count,
		total,
		ontoggleCuisine,
		onclearCuisines,
		ontoggleOpenNow
	}: Props = $props();
</script>

<div class="bar">
	<div class="counts">
		<strong>{count}</strong>
		<span>of {total} spot{total === 1 ? '' : 's'}</span>
		<button
			class="open-now"
			class:active={openNowOnly}
			type="button"
			onclick={ontoggleOpenNow}
			aria-pressed={openNowOnly}
		>
			Open now
		</button>
	</div>

	{#if cuisines.length > 0}
		<div class="chips" role="group" aria-label="Filter by cuisine">
			{#each cuisines as cuisine (cuisine)}
				<button
					class="chip"
					class:active={selectedCuisines.has(cuisine)}
					type="button"
					onclick={() => ontoggleCuisine(cuisine)}
				>
					{cuisine}
				</button>
			{/each}
			{#if selectedCuisines.size > 0}
				<button class="chip clear" type="button" onclick={onclearCuisines}>Clear</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.bar {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.counts {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.85rem;
		color: var(--muted, #a0a4ad);
	}
	.counts strong {
		color: var(--on-surface, #f5f5f5);
		font-size: 1rem;
	}
	.open-now {
		margin-left: auto;
		background: transparent;
		color: var(--muted, #a0a4ad);
		border: 1px solid #2a2f38;
		border-radius: 999px;
		padding: 4px 12px;
		font-size: 0.8rem;
		cursor: pointer;
		font: inherit;
	}
	.open-now.active {
		background: #4ade80;
		color: #0f1115;
		border-color: #4ade80;
		font-weight: 600;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		max-height: 80px;
		overflow-y: auto;
	}
	.chip {
		background: #232831;
		color: var(--on-surface, #f5f5f5);
		border: 1px solid transparent;
		border-radius: 999px;
		padding: 4px 10px;
		font-size: 0.8rem;
		text-transform: capitalize;
		cursor: pointer;
		font: inherit;
	}
	.chip.active {
		background: #ff6b35;
		color: #0f1115;
		font-weight: 600;
	}
	.chip.clear {
		background: transparent;
		border-color: #2a2f38;
		color: var(--muted, #a0a4ad);
	}
</style>
