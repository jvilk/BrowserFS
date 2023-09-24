import { build } from 'esbuild';
import { polyfillNode } from 'esbuild-plugin-polyfill-node';

const common = {
	entryPoints: ['src/index.ts'],
	target: ['es6'],
	globalName: 'BrowserFS',
	sourcemap: true,
	keepNames: true,
	bundle: true,
	alias: { process: 'bfs-process', path: 'path' },
	plugins: [polyfillNode()],
};

const configs = {
	'browser, unminified': { outfile: 'dist/browserfs.js', platform: 'browser' },
	'browser, minified': { outfile: 'dist/browserfs.min.js', platform: 'browser', minify: true },
	'ESM, unminified': { outfile: 'dist/browserfs.mjs', platform: 'neutral', format: 'esm' },
	'ESM, minified': { outfile: 'dist/browserfs.min.mjs', platform: 'neutral', format: 'esm', minify: true },
	'node, unminified': { outfile: 'dist/browserfs.cjs', platform: 'node', format: 'cjs', alias: {}, plugins: [] },
	'node, minified': { outfile: 'dist/browserfs.min.cjs', platform: 'node', format: 'cjs', minify: true, alias: {}, plugins: [] },
};

for (const [name, config] of Object.entries(configs)) {
	console.log(`Building for ${name}...`);
	await build({ ...common, ...config });
	console.log(`Built for ${name}.`);
}
