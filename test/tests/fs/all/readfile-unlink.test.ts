import { backends, fs, configure } from '../../../common';
import * as path from 'path';
import common from '../../../common';
import { promisify } from 'node:util';

describe.each(backends)('%s Read and Unlink File Test', (name, options) => {
	const configured = configure({ fs: name, options });
	if (!fs.getRootFS().isReadOnly()) {
		const dirName = path.resolve(common.fixturesDir, 'test-readfile-unlink');
		const fileName = path.resolve(dirName, 'test.bin');

		const buf = Buffer.alloc(512);
		buf.fill(42);

		beforeAll(async () => {
			await configured;
			await promisify(fs.mkdir)(dirName);
			await promisify<string, Buffer, void>(fs.writeFile)(fileName, buf);
		});

		it('should read file and verify its content', async () => {
			await configured;
			const data: Buffer = await promisify<string, Buffer>(fs.readFile)(fileName);
			expect(data.length).toBe(buf.length);
			expect(data[0]).toBe(42);
		});

		it('should unlink file and remove directory', async () => {
			await configured;
			await promisify(fs.unlink)(fileName);
			await promisify(fs.rmdir)(dirName);
		});
	}

	afterAll(() => {
		process.exitCode = 0;
	});
});
