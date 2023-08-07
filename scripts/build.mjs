import { build } from 'esbuild';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';

const common = {
	entryPoints: ['src/core/browserfs.ts'],
	target: ['es6'],
	platform: 'browser',
	globalName: 'BrowserFS',
	sourcemap: true,
	bundle: true,
	alias: { path: 'bfs-path', process: 'bfs-process' },
	plugins: [NodeModulesPolyfillPlugin()],
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
