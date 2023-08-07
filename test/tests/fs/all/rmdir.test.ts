import { backends, fs, configure } from '../../../common';
import { promisify } from 'node:util';

describe.each(backends)('%s Directory Removal', (name, options) => {
	const configured = configure({ fs: name, options });

	it('Cannot remove non-empty directories', async () => {
		await configured;

		const createDir = promisify(fs.mkdir);
		const removeDir = promisify(fs.rmdir);

		await createDir('/rmdirTest');

		await createDir('/rmdirTest/rmdirTest2');

		try {
			await removeDir('/rmdirTest');
		} catch (err) {
			expect(err).not.toBeNull();
			expect(err.code).toBe('ENOTEMPTY');
		}
	});
});
