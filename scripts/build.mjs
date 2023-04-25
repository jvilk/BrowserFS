import { build } from 'esbuild';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';

const options = {
	entryPoints: ['src/core/browserfs.ts'],
	target: ['es6'],
	platform: 'browser',
	globalName: 'BrowserFS',
	sourcemap: true,
	bundle: true,
	alias: { path: 'bfs-path', process: 'bfs-process' },
	plugins: [ NodeModulesPolyfillPlugin() ],
}

console.log('Building for browser, unminified...');
await build({
	...options,
	outfile: 'dist/browserfs.js',
});
console.log('Built for browser, unminified.');

console.log('Building for browser, minified...');
await build({
	...options,
	outfile: 'dist/browserfs.min.js',
	minify: true,	
});
console.log('Built for browser, minified.');

console.log('Building for ESM, unminified...');
await build({
	...options,
	outfile: 'dist/browserfs.mjs',
	format: 'esm',
});
console.log('Built for browser, unminified.');

console.log('Building for ESM, unminified...');
await build({
	...options,
	outfile: 'dist/browserfs.min.mjs',
	format: 'esm',
	minify: true,	
});
console.log('Built for browser, unminified.');
