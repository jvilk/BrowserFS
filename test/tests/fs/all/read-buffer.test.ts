import { backends, fs, configure } from '../../../common';
import path from 'path';
import common from '../../../common';
import { promisify } from 'node:util';

describe.each(backends)('%s fs file reading', (name, options) => {
	const configured = configure({ fs: name, options });
	const filepath = path.join(common.fixturesDir, 'x.txt');
	const expected = 'xyz\n';
	const bufferAsync = Buffer.alloc(expected.length);
	const bufferSync = Buffer.alloc(expected.length);
	let readCalled = 0;
	const rootFS = fs.getRootFS();
	const openAsync = promisify<string, string, number>(fs.open);
	const readAsync = promisify<number, Buffer, number, number, number, number>(fs.read);
	const readSync = fs.getRootFS().supportsSynch() ? promisify(fs.readSync) : null;

	it('should read file asynchronously', async () => {
		await configured;
		const fd = await openAsync(filepath, 'r');
		const bytesRead = await readAsync(fd, bufferAsync, 0, expected.length, 0);
		readCalled++;

		expect(bytesRead).toBe(expected.length);
		expect(bufferAsync.toString()).toBe(expected);
	});

	if (fs.getRootFS().supportsSynch()) {
		it('should read file synchronously', async () => {
			await configured;
			const fd = await openAsync(filepath, 'r');
			const bytesRead = await readSync(fd, bufferSync, 0, expected.length, 0);

			expect(bufferSync.toString()).toBe(expected);
			expect(bytesRead).toBe(expected.length);
		});
	}

	afterAll(() => {
		expect(readCalled).toBe(1);
	});
});
