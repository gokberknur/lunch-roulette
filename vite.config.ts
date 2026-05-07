import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			injectRegister: 'auto',
			manifest: {
				name: 'Lunch Roulette',
				short_name: 'Lunch',
				description: 'Pick a lunch spot near the office.',
				theme_color: '#ff6b35',
				background_color: '#0f1115',
				display: 'standalone',
				id: '/lunch/',
				start_url: '/lunch/',
				scope: '/lunch/',
				icons: [
					{ src: '/lunch/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/lunch/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
					{
						src: '/lunch/icons/icon-maskable-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2}'],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/api\.maptiler\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'maptiler-tiles',
							expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
							cacheableResponse: { statuses: [0, 200] }
						}
					},
					{
						urlPattern: /^https:\/\/overpass-api\.de\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'overpass-api',
							networkTimeoutSeconds: 10,
							expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 }
						}
					}
				]
			},
			devOptions: { enabled: false }
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
