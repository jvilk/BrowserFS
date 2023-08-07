import { backends, fs, configure } from '../../../common';
import * as path from 'path';
import common from '../../../common';
import { promisify } from 'node:util';

describe.each(backends)('%s File Writing', (name, options) => {
	const configured = configure({ fs: name, options });

	it('should write content to a file', async () => {
		await configured;

		if (!fs.getRootFS().isReadOnly()) {
			const filename = path.join(common.tmpDir, 'write.txt');
			const expected = Buffer.from('hello');
			let openCalled = 0;
			let writeCalled = 0;

			const fd = await promisify<string, string, number, number>(fs.open)(filename, 'w', 0o644);
			openCalled++;

			const written = await promisify<number, Buffer, number, number, number | null, number>(fs.write)(fd, expected, 0, expected.length, null);
			writeCalled++;

			expect(expected.length).toBe(written);

			await promisify(fs.close)(fd);

			const found = await promisify<string, string, string>(fs.readFile)(filename, 'utf8');
			expect(expected.toString()).toBe(found);

			await promisify(fs.unlink)(filename);

			expect(openCalled).toBe(1);
			expect(writeCalled).toBe(1);
		}
	});
});
