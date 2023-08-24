import { backends, fs, configure, tmpDir, fixturesDir } from '../../../common';
import * as path from 'path';

import { promisify } from 'node:util';

describe.each(backends)('%s File Reading', (name, options) => {
	const configured = configure({ fs: name, options });

	it('Read a file and check its binary bytes (asynchronous)', async () => {
		await configured;
		const buff = await promisify<string, Buffer>(fs.readFile)(path.join(fixturesDir, 'elipses.txt'));
		expect(buff.readUInt16LE(0)).toBe(32994);
	});

	it('Read a file and check its binary bytes (synchronous)', () => {
		if (fs.getRootFS().supportsSynch()) {
			const buff = fs.readFileSync(path.join(fixturesDir, 'elipses.txt'));
			expect(buff.readUInt16LE(0)).toBe(32994);
		}
	});
});
