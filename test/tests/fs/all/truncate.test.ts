import { backends, fs, configure, tmpDir, fixturesDir } from '../../../common';
import * as path from 'path';

import { promisify } from 'node:util';

describe.each(backends)('%s Truncate Tests', (name, options) => {
	const configured = configure({ fs: name, options });
	let filename: string;
	const data = Buffer.alloc(1024 * 16, 'x');
	let success: number;

	beforeAll(() => {
		const tmp = tmpDir;
		filename = path.resolve(tmp, 'truncate-file.txt');
	});

	beforeEach(() => {
		success = 0;
	});

	afterEach(async () => {
		await promisify(fs.unlink)(filename);
	});

	it('Truncate Sync', () => {
		if (!fs.getRootFS().supportsSynch()) return;

		fs.writeFileSync(filename, data);
		expect(fs.statSync(filename).size).toBe(1024 * 16);

		fs.truncateSync(filename, 1024);
		expect(fs.statSync(filename).size).toBe(1024);

		fs.truncateSync(filename);
		expect(fs.statSync(filename).size).toBe(0);

		fs.writeFileSync(filename, data);
		expect(fs.statSync(filename).size).toBe(1024 * 16);

		/* once fs.ftruncateSync is supported.
		const fd = fs.openSync(filename, 'r+');
		fs.ftruncateSync(fd, 1024);
		stat = fs.statSync(filename);
		expect(stat.size).toBe(1024);

		fs.ftruncateSync(fd);
		stat = fs.statSync(filename);
		expect(stat.size).toBe(0);
		
		fs.closeSync(fd);
		*/
	});

	it('Truncate Async', async () => {
		await configured;

		if (fs.getRootFS().isReadOnly() || !fs.getRootFS().supportsSynch()) {
			return;
		}

		const stat = promisify(fs.stat);

		await promisify<string, Buffer, void>(fs.writeFile)(filename, data);
		expect((await stat(filename)).size).toBe(1024 * 16);

		await promisify<string, number, void>(fs.truncate)(filename, 1024);
		expect((await stat(filename)).size).toBe(1024);

		await promisify(fs.truncate)(filename);
		expect((await stat(filename)).size).toBe(0);

		await promisify<string, Buffer, void>(fs.writeFile)(filename, data);
		expect((await stat(filename)).size).toBe(1024 * 16);

		const fd = await promisify<string, string, number>(fs.open)(filename, 'w');

		await promisify<number, number, void>(fs.ftruncate)(fd, 1024);
		await promisify(fs.fsync)(fd);
		expect((await stat(filename)).size).toBe(1024);

		await promisify(fs.ftruncate)(fd);
		await promisify(fs.fsync)(fd);
		expect((await stat(filename)).size).toBe(0);

		await promisify(fs.close)(fd);
	});
});
