import { fs } from '../../../common';

describe('Directory Removal', () => {
	test('Cannot remove non-empty directories', () => {
		fs.mkdir('/rmdirTest', (e: NodeJS.ErrnoException | null) => {
			expect(e).toBeNull();

			fs.mkdir('/rmdirTest/rmdirTest2', (e: NodeJS.ErrnoException | null) => {
				expect(e).toBeNull();

				fs.rmdir('/rmdirTest', (e: NodeJS.ErrnoException | null) => {
					expect(e).not.toBeNull();
					expect(e!.code).toBe('ENOTEMPTY');
				});
			});
		});
	});
});
