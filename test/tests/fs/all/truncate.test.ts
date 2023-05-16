import { fs } from '../../../common';

describe('File Truncation', () => {
	test('Truncate file', () => {
		const file = '/truncateFile.txt';

		fs.writeFile(file, Buffer.from('123456789'), (e: NodeJS.ErrnoException | null) => {
			expect(e).toBeNull();

			fs.truncate(file, 9, (e: NodeJS.ErrnoException | null) => {
				expect(e).toBeNull();

				fs.readFile(file, (e: NodeJS.ErrnoException | null, data: Buffer) => {
					expect(e).toBeNull();
					expect(data.length).toBe(9);
					expect(data.toString()).toBe('123456789');

					fs.truncate(file, 10, (e: NodeJS.ErrnoException | null) => {
						expect(e).toBeNull();

						fs.readFile(file, (e: NodeJS.ErrnoException | null, data: Buffer) => {
							expect(e).toBeNull();
							expect(data.length).toBe(10);
							expect(data.toString()).toBe('123456789\u0000');

							fs.truncate(file, -1, (e: NodeJS.ErrnoException | null) => {
								expect(e).not.toBeNull();

								fs.truncate(file, 0, (e: NodeJS.ErrnoException | null) => {
									expect(e).toBeNull();

									fs.readFile(file, (e: NodeJS.ErrnoException | null, data: Buffer) => {
										expect(e).toBeNull();
										expect(data.toString()).toBe('');
									});
								});
							});
						});
					});
				});
			});
		});
	});
});
