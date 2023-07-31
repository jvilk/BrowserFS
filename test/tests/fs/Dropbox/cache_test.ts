import { fs } from '../../../common';

describe('File System Cache', () => {
	test('Readdir and readFile cache', () => {
		return new Promise<void>(resolve => {
			fs.readdir('/', (err: NodeJS.ErrnoException | null, data: string[]) => {
				expect(err).toBeNull();
				const cachedData = data;

				fs.readdir('/', (err: NodeJS.ErrnoException | null, data2: string[]) => {
					expect(err).toBeNull();
					expect(data2).not.toBe(cachedData); // Dropbox cache should *copy* values from cache.

					const file = '/test/fixtures/files/node/a.js';
					fs.readFile(file, (err: NodeJS.ErrnoException | null, data: Buffer) => {
						expect(err).toBeNull();
						const cachedData = data;

						fs.readFile(file, (err: NodeJS.ErrnoException | null, data2: Buffer) => {
							expect(err).toBeNull();
							expect(data2).not.toBe(cachedData); // Dropbox cache should *copy* values from cache.

							resolve();
						});
					});
				});
			});
		});
	});

	test('Write and readFile cache', () => {
		const data = Buffer.from('Hello, I am a dumb test file', 'utf8');

		return new Promise<void>(resolve => {
			fs.writeFile('/cache_test_file.txt', data, (err: NodeJS.ErrnoException | null) => {
				expect(err).toBeNull();

				fs.readFile('/cache_test_file.txt', (err: NodeJS.ErrnoException | null, data2: Buffer) => {
					expect(err).toBeNull();
					expect(data2).not.toBe(data); // Cache should copy data *into* cache.

					resolve();
				});
			});
		});
	});
});
