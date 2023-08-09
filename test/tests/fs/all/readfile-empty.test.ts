import { backends, fs, configure, tmpDir, fixturesDir } from '../../../common';
import * as path from 'path';

import { promisify } from 'node:util';

describe.each(backends)('%s Read File Test', (name, options) => {
	const configured = configure({ fs: name, options });
	const fn = path.join(fixturesDir, 'empty.txt');

	it('should read file asynchronously', async () => {
		await configured;
		const data: Buffer = await promisify<string, Buffer>(fs.readFile)(fn);
		expect(data).toBeDefined();
	});

	it('should read file with utf-8 encoding asynchronously', async () => {
		await configured;
		const data: string = await promisify<string, string, string>(fs.readFile)(fn, 'utf8');
		expect(data).toBe('');
	});

	if (fs.getRootFS().supportsSynch()) {
		it('should read file synchronously', async () => {
			await configured;
			const data: Buffer = fs.readFileSync(fn);
			expect(data).toBeDefined();
		});

		it('should read file with utf-8 encoding synchronously', async () => {
			await configured;
			const data: string = fs.readFileSync(fn, 'utf8');
			expect(data).toBe('');
		});
	}

	afterAll(() => {
		process.exitCode = 0;
	});
});
