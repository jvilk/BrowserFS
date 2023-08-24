import { backends, fs, configure, fixturesDir } from '../../../common';
import path from 'path';

import { promisify } from 'node:util';

describe.each(backends)('%s fs file reading', (name, options) => {
	const configured = configure({ fs: name, options });
	const filepath = path.join(fixturesDir, 'x.txt');
	const expected = 'xyz\n';
	const bufferAsync = Buffer.alloc(expected.length);
	const bufferSync = Buffer.alloc(expected.length);

	it('should read file asynchronously', async () => {
		await configured;
		const fd = await promisify<string, string, number>(fs.open)(filepath, 'r');
		const bytesRead = await promisify<number, Buffer, number, number, number, number>(fs.read)(fd, bufferAsync, 0, expected.length, 0);

		expect(bytesRead).toBe(expected.length);
		expect(bufferAsync.toString()).toBe(expected);
	});

	it('should read file synchronously', async () => {
		await configured;
		if (fs.getRootFS().supportsSynch()) {
			const fd = fs.openSync(filepath, 'r');
			const bytesRead = fs.readSync(fd, bufferSync, 0, expected.length, 0);

			expect(bufferSync.toString()).toBe(expected);
			expect(bytesRead).toBe(expected.length);
		}
	});
});
