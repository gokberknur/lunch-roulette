<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<meta name="description" content="Pick a lunch spot near the office." />
</svelte:head>

{@render children()}
