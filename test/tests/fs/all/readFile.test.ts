import { backends, fs, configure, tmpDir, fixturesDir } from '../../../common';
import * as path from 'path';

import { promisify } from 'node:util';

describe.each(backends)('%s File Reading', (name, options) => {
	const configured = configure({ fs: name, options });
	it('Cannot read a file with an invalid encoding (synchronous)', async () => {
		await configured;

		let wasThrown = false;
		if (fs.getRootFS().supportsSynch()) {
			try {
				fs.readFileSync(path.join(fixturesDir, 'a.js'), 'wrongencoding');
			} catch (e) {
				wasThrown = true;
			}
			expect(wasThrown).toBeTruthy();
		}
	});

	it('Cannot read a file with an invalid encoding (asynchronous)', async () => {
		await configured;
		expect(await promisify<string, string>(fs.readFile)(path.join(fixturesDir, 'a.js'), 'wrongencoding')).toThrow();
	});

	it('Reading past the end of a file should not be an error', async () => {
		await configured;
		const fd = await promisify<string, string, number>(fs.open)(path.join(fixturesDir, 'a.js'), 'r');
		const buffData = Buffer.alloc(10);
		const bytesRead = await promisify(fs.read)(fd, buffData, 0, 10, 10000);
		expect(bytesRead).toBe(0);
	});
});
