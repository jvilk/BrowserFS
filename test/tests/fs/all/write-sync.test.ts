import { backends, fs, configure } from '../../../common';
import * as path from 'path';
import common from '../../../common';

describe.each(backends)('%s File Writing Synchronously', (name, options) => {
	const configured = configure({ fs: name, options });
	it('should write file synchronously with specified content', async () => {
		await configured;
		const rootFS = fs.getRootFS();
		if (rootFS.isReadOnly() || !rootFS.supportsSynch()) {
			return;
		}

		const fn = path.join(common.tmpDir, 'write.txt');
		const foo = 'foo';
		const fd = fs.openSync(fn, 'w');

		let written = fs.writeSync(fd, '');
		expect(written).toBe(0);

		fs.writeSync(fd, foo);

		const bar = 'bár';
		written = fs.writeSync(fd, Buffer.from(bar), 0, Buffer.byteLength(bar));
		expect(written).toBeGreaterThan(3);

		fs.closeSync(fd);

		expect(fs.readFileSync(fn).toString()).toBe('foobár');
	});
});
