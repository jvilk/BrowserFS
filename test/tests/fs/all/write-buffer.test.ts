import { backends, fs, configure } from '../../../common';
import * as path from 'path';
import common from '../../../common';

describe.each(backends)('%s File Writing', (name, options) => {
	const configured = configure({ fs: name, options });
	it('should write content to a file', async done => {
		await configured;
		if (!fs.getRootFS().isReadOnly()) {
			const filename = path.join(common.tmpDir, 'write.txt');
			const expected = Buffer.from('hello');
			let openCalled = 0;
			let writeCalled = 0;

			fs.open(filename, 'w', 0o644, (err, fd) => {
				openCalled++;
				if (err) throw err;

				fs.write(fd, expected, 0, expected.length, null, (err, written) => {
					writeCalled++;
					if (err) throw err;

					expect(expected.length).toBe(written);

					fs.close(fd, err => {
						if (err) throw err;

						fs.readFile(filename, 'utf8', (err, found) => {
							expect(expected.toString()).toBe(found);

							fs.unlink(filename, err => {
								if (err) throw err;

								expect(openCalled).toBe(1);
								expect(writeCalled).toBe(1);

								done();
							});
						});
					});
				});
			});
		}
	});
});
