import { backends, fs, configure, tmpDir, fixturesDir } from '../../../common';
import * as path from 'path';

import { promisify } from 'node:util';

describe.each(backends)('%s File Read Test', (name, options) => {
	const configured = configure({ fs: name, options });
	let filepath: string;
	let expected: string;
	let rootFS: any;

	beforeEach(() => {
		filepath = path.join(fixturesDir, 'x.txt');
		expected = 'xyz\n';
		rootFS = fs.getRootFS();
	});

	it('should read file asynchronously', async () => {
		await configured;
		const fd = await promisify<string, string, number>(fs.open)(filepath, 'r');
		const buffer = Buffer.alloc(expected.length);
		const bytesRead = await promisify(fs.read)(fd, buffer, 0, expected.length, 0);

		expect(buffer.toString()).toEqual(expected);
		expect(bytesRead).toEqual(expected.length);
	});

	if (fs.getRootFS().supportsSynch()) {
		it('should read file synchronously', async () => {
			await configured;
			const fd = fs.openSync(filepath, 'r');
			const buffer = Buffer.alloc(expected.length);
			const bytesRead = await promisify(fs.readSync)(fd, buffer, 0, expected.length, 0);

			expect(buffer.toString()).toEqual(expected);
			expect(bytesRead).toEqual(expected.length);
		});
	}

	afterAll(() => {
		process.exitCode = 0;
	});
});
