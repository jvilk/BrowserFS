import { fs } from '../../common';
import * as BrowserFS from '../../../src';
import { promisify } from 'node:util';

type Listing = { [name: string]: Listing | null };

describe('HTTPDownloadFS', () => {
	let oldRootFS: BrowserFS.FileSystem;

	beforeAll(() => {
		oldRootFS = fs.getMount('/');
	});

	afterAll(() => {
		BrowserFS.initialize({ '/': oldRootFS });
	});

	it('File System Operations', async () => {
		const listing: Listing = {
			'README.md': null,
			test: {
				fixtures: {
					static: {
						'49chars.txt': null,
					},
				},
			},
			src: {
				'README.md': null,
				backend: { 'AsyncMirror.ts': null, 'XmlHttpRequest.ts': null, 'ZipFS.ts': null },
				'main.ts': null,
			},
		};

		const newXFS = await BrowserFS.backends.HTTPRequest.Create({
			index: listing,
			baseUrl: '/',
		});

		BrowserFS.initialize({ '/': newXFS });

		const expectedTestListing = ['README.md', 'src', 'test'];
		const testListing = fs.readdirSync('/').sort();
		expect(testListing).toEqual(expectedTestListing);

		const readdirAsync = promisify(fs.readdir);
		const files = await readdirAsync('/');
		expect(files.sort()).toEqual(expectedTestListing);

		const statAsync = promisify(fs.stat);
		const stats = await statAsync('/test/fixtures/static/49chars.txt');
		expect(stats.isFile()).toBe(true);
		expect(stats.isDirectory()).toBe(false);
		expect(stats.size).toBeGreaterThanOrEqual(49);
		expect(stats.size).toBeLessThanOrEqual(50);

		const backendStats = await statAsync('/src/backend');
		expect(backendStats.isDirectory()).toBe(true);
		expect(backendStats.isFile()).toBe(false);

		let statError = null;
		try {
			await statAsync('/src/not-existing-name');
		} catch (error) {
			statError = error;
		}
		expect(statError).toBeTruthy();
	});
});
