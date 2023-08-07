import { backends, fs, configure } from '../../../common';
import * as path from 'path';
import common from '../../../common';
import { promisify } from 'node:util';

const openAsync = promisify<string, string, number, number>(fs.open);
const writeAsync = promisify<number, string, number, string, number>(fs.write);
const closeAsync = promisify(fs.close);
const readFileAsync = promisify<string, string, string>(fs.readFile);
const unlinkAsync = promisify(fs.unlink);

describe.each(backends)('%s Asynchronous File Writing', (name, options) => {
	const configured = configure({ fs: name, options });
	it('should write file asynchronously with specified content', async () => {
		await configured;
		if (fs.getRootFS().isReadOnly()) {
			return;
		}

		const fn = path.join(common.tmpDir, 'write.txt');
		const fn2 = path.join(common.tmpDir, 'write2.txt');
		const expected = 'ümlaut.';

		const fd = await openAsync(fn, 'w', 0o644);
		await writeAsync(fd, '', 0, 'utf8');
		const written = await writeAsync(fd, expected, 0, 'utf8');
		expect(written).toBe(Buffer.byteLength(expected));
		await closeAsync(fd);

		const data = await readFileAsync(fn, 'utf8');
		expect(data).toBe(expected);

		await unlinkAsync(fn);
		const fd2 = await openAsync(fn2, 'w', 0o644);
		await writeAsync(fd2, '', 0, 'utf8');
		const written2 = await writeAsync(fd2, expected, 0, 'utf8');
		expect(written2).toBe(Buffer.byteLength(expected));
		await closeAsync(fd2);

		const data2 = await readFileAsync(fn2, 'utf8');
		expect(data2).toBe(expected);

		await unlinkAsync(fn2);
	});
});
