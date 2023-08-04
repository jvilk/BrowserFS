import { backends, fs, configure } from '../../../common';
import * as path from 'path';
import common from '../../../common';

describe.each(backends)('%s fs.writeFile', (name, options) => {
	const configured = configure({ fs: name, options });
	if (!fs.getRootFS().isReadOnly()) {
		const fileNameLen = Math.max(260 - common.tmpDir.length - 1, 1);
		const fileName = path.join(common.tmpDir, new Array(fileNameLen + 1).join('x'));
		const fullPath = path.resolve(fileName);

		it('should write file and verify its size', async done => {
			await configured;
			fs.writeFile(fullPath, 'ok', err => {
				if (err) throw err;

				fs.stat(fullPath, (err, stats) => {
					if (err) throw err;
					expect(stats.size).toBe(2);
					done();
				});
			});
		});

		afterAll(done => {
			fs.unlink(fullPath, err => {
				if (err) throw err;
				done();
			});
		});
	}
});
