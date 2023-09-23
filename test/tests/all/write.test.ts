import { backends, fs, configure, tmpDir, fixturesDir } from '../../common';
import * as path from 'path';

import { promisify } from 'node:util';

const open = promisify<string, string, number, number>(fs.open);
const write = promisify<number, string, number, string, number>(fs.write);
const close = promisify(fs.close);
const readFile = promisify<string, string, string>(fs.readFile);
const unlink = promisify(fs.unlink);

describe.each(backends)('%s fs.write', (name, options) => {
	const configured = configure({ fs: name, options });
	it('should write file with specified content asynchronously', async () => {
		await configured;
		if (fs.getMount('/').metadata.readonly) {
			return;
		}

		const fn = path.join(tmpDir, 'write.txt');
		const fn2 = path.join(tmpDir, 'write2.txt');
		const expected = 'ümlaut.';

		const fd = await open(fn, 'w', 0o644);
		await write(fd, '', 0, 'utf8');
		const written = await write(fd, expected, 0, 'utf8');
		expect(written).toBe(Buffer.byteLength(expected));
		await close(fd);

		const data = await readFile(fn, 'utf8');
		expect(data).toBe(expected);

		await unlink(fn);
		const fd2 = await open(fn2, 'w', 0o644);
		await write(fd2, '', 0, 'utf8');
		const written2 = await write(fd2, expected, 0, 'utf8');
		expect(written2).toBe(Buffer.byteLength(expected));
		await close(fd2);

		const data2 = await readFile(fn2, 'utf8');
		expect(data2).toBe(expected);

		await unlink(fn2);
	});

	it('should write a buffer to a file asynchronously', async () => {
		await configured;
		if (fs.getMount('/').metadata.readonly) {
			return;
		}

		const filename = path.join(tmpDir, 'write.txt');
		const expected = Buffer.from('hello');

		const fd = await promisify<string, string, number, number>(fs.open)(filename, 'w', 0o644);

		const written = await promisify<number, Buffer, number, number, number | null, number>(fs.write)(fd, expected, 0, expected.length, null);

		expect(expected.length).toBe(written);

		await promisify(fs.close)(fd);

		const found = await promisify<string, string, string>(fs.readFile)(filename, 'utf8');
		expect(expected.toString()).toBe(found);

		await promisify(fs.unlink)(filename);
	});
});
