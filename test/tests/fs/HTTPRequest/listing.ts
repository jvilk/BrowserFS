import { fs } from '../../../common';
import * as BrowserFS from '../../../../src/core/browserfs';

type Listing = { [name: string]: Listing | null };

describe('HTTPDownloadFS', () => {
	let oldRootFS: BrowserFS.FileSystem;

	beforeAll(() => {
		oldRootFS = fs.getRootFS();
	});

	afterAll(() => {
		BrowserFS.initialize(oldRootFS);
	});

	test('File System Operations', () => {
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

		return new Promise<void>(resolve => {
			BrowserFS.Backend.XmlHttpRequest.Create(
				{
					index: listing,
					baseUrl: '/',
				},
				(e, newXFS) => {
					BrowserFS.initialize(newXFS);

					const t1text = 'Invariant fail: Can query folder that contains items and a mount point.';
					const expectedTestListing = ['README.md', 'src', 'test'];
					const testListing = fs.readdirSync('/').sort();
					expect(testListing).toEqual(expectedTestListing);

					fs.readdir('/', (err: NodeJS.ErrnoException | null, files: string[]) => {
						expect(err).toBeNull();
						expect(files.sort()).toEqual(expectedTestListing);

						fs.stat('/test/fixtures/static/49chars.txt', (err, stats) => {
							expect(err).toBeNull();
							expect(stats.isFile()).toBe(true);
							expect(stats.isDirectory()).toBe(false);
							// NOTE: Size is 50 in Windows due to line endings.
							expect(stats.size).toBeGreaterThanOrEqual(49);
							expect(stats.size).toBeLessThanOrEqual(50);
						});

						fs.stat('/src/backend', (err, stats) => {
							expect(err).toBeNull();
							expect(stats.isDirectory()).toBe(true);
							expect(stats.isFile()).toBe(false);
						});

						fs.stat('/src/not-existing-name', (err, stats) => {
							expect(err).toBeTruthy();
						});

						resolve();
					});
				}
			);
		});
	});

	test('Maintains XHR file system for backwards compatibility', () => {
		expect(BrowserFS.Backend.XmlHttpRequest).toBe(BrowserFS.Backend.HTTPRequest);
	});
});
