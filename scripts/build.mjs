import { build } from 'esbuild';
import { polyfillNode } from 'esbuild-plugin-polyfill-node';

const common = {
	entryPoints: ['src/core/browserfs.ts'],
	target: ['es6'],
	platform: 'browser',
	globalName: 'BrowserFS',
	sourcemap: true,
	bundle: true,
	alias: { process: 'bfs-process', path: 'path' },
	plugins: [polyfillNode()],
};

const configs = {
	'browser, unminified': { outfile: 'dist/browserfs.js' },
	'browser, minified': { outfile: 'dist/browserfs.min.js', minify: true },
	'ESM, unminified': { outfile: 'dist/browserfs.mjs', format: 'esm' },
	'ESM, minified': { outfile: 'dist/browserfs.min.mjs', format: 'esm', minify: true },
	node: { outfile: 'dist/browserfs.cjs', platform: 'node', format: 'cjs', minify: true, alias: {}, plugins: [] },
};

for (const [name, config] of Object.entries(configs)) {
	console.log(`Building for ${name}...`);
	await build({ ...common, ...config });
	console.log(`Built for ${name}.`);
}
