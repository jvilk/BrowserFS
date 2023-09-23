import { backends, fs, configure } from '../../../common';
import { promisify } from 'node:util';

describe.each(backends)('%s Directory Removal', (name, options) => {
	const configured = configure({ fs: name, options });

	it('Cannot remove non-empty directories', async () => {
		await configured;

		await promisify(fs.mkdir)('/rmdirTest');
		await promisify(fs.mkdir)('/rmdirTest/rmdirTest2');

		try {
			await promisify(fs.rmdir)('/rmdirTest');
		} catch (err) {
			expect(err).not.toBeNull();
			expect(err.code).toBe('ENOTEMPTY');
		}
	});
});
