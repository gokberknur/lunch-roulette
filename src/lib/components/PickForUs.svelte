<script lang="ts">
	import type { Place } from '$lib/types';

	type Props = {
		places: Place[];
		onpick: (id: string) => void;
	};

	let { places, onpick }: Props = $props();

	let picked = $state<Place | null>(null);
	let spinning = $state(false);

	function spin() {
		if (places.length === 0) return;
		spinning = true;
		picked = null;

		const total = 900;
		const start = performance.now();
		const tick = (now: number) => {
			const elapsed = now - start;
			const candidate = places[Math.floor(Math.random() * places.length)];
			picked = candidate;
			if (elapsed < total) {
				setTimeout(() => requestAnimationFrame(tick), 60 + elapsed / 10);
			} else {
				spinning = false;
				if (picked) onpick(picked.id);
			}
		};
		requestAnimationFrame(tick);
	}

	function close() {
		picked = null;
	}

	const canPick = $derived(places.length > 0);
</script>

<button class="spin" type="button" onclick={spin} disabled={!canPick || spinning}>
	{spinning ? 'Spinning…' : '🎲 Pick for us'}
</button>

{#if picked && !spinning}
	<div
		class="modal-backdrop"
		onclick={close}
		onkeydown={(e) => e.key === 'Escape' && close()}
		role="presentation"
	>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="pick-name"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			tabindex="-1"
		>
			<div class="result-label">Today you eat at…</div>
			<h2 id="pick-name" class="name">{picked.name}</h2>
			<div class="meta">
				<span>{Math.round(picked.distanceM)} m · 🚶 {picked.walkMin} min</span>
				{#if picked.cuisine.length > 0}
					<span class="cuisine">{picked.cuisine.slice(0, 3).join(' · ')}</span>
				{/if}
			</div>
			<div class="actions">
				<a
					class="btn-primary"
					href="https://www.openstreetmap.org/?mlat={picked.lat}&mlon={picked.lon}#map=19/{picked.lat}/{picked.lon}"
					target="_blank"
					rel="noopener"
				>
					Open in map
				</a>
				<button class="btn-ghost" type="button" onclick={spin}>Spin again</button>
				<button class="btn-ghost" type="button" onclick={close}>Close</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.spin {
		display: block;
		width: 100%;
		background: #ff6b35;
		color: #0f1115;
		border: none;
		border-radius: 12px;
		padding: 14px;
		font-size: 1.05rem;
		font-weight: 700;
		cursor: pointer;
		font-family: inherit;
		transition:
			transform 0.1s,
			background 0.15s;
	}
	.spin:hover:not(:disabled) {
		background: #ff8054;
	}
	.spin:active:not(:disabled) {
		transform: scale(0.98);
	}
	.spin:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: grid;
		place-items: center;
		padding: 16px;
		z-index: 1000;
		animation: fade-in 0.15s ease-out;
	}
	.modal {
		background: var(--surface, #1a1d24);
		color: var(--on-surface, #f5f5f5);
		border-radius: 16px;
		padding: 24px;
		max-width: 420px;
		width: 100%;
		text-align: center;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
		animation: pop-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.result-label {
		font-size: 0.85rem;
		color: var(--muted, #a0a4ad);
		margin-bottom: 6px;
	}
	.name {
		margin: 0 0 12px;
		font-size: 1.5rem;
		font-weight: 700;
	}
	.meta {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.9rem;
		color: var(--muted, #a0a4ad);
		margin-bottom: 20px;
	}
	.cuisine {
		text-transform: capitalize;
	}
	.actions {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.btn-primary,
	.btn-ghost {
		padding: 12px;
		border-radius: 10px;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		text-decoration: none;
		text-align: center;
	}
	.btn-primary {
		background: #ff6b35;
		color: #0f1115;
		border: none;
	}
	.btn-ghost {
		background: transparent;
		color: var(--on-surface, #f5f5f5);
		border: 1px solid #2a2f38;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes pop-in {
		from {
			opacity: 0;
			transform: scale(0.9);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
