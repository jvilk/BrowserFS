import fs from '../../../../src/core/node_fs';

describe('File Writing', () => {
	test('Write and overwrite file', () => {
		const fileName = '/writeFileText.txt';

		fs.writeFile(fileName, Buffer.from('Hello!'), (err: NodeJS.ErrnoException | null) => {
			expect(err).toBeNull();

			fs.writeFile(fileName, Buffer.from('Hello 2!'), (err: NodeJS.ErrnoException | null) => {
				expect(err).toBeNull();

				fs.readFile(fileName, (err: NodeJS.ErrnoException | null, data: Buffer) => {
					expect(err).toBeNull();
					expect(data.toString('utf8')).toBe('Hello 2!');
				});
			});
		});
	});
});
