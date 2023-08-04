import { backends, fs, configure } from '../../../common';
import * as path from 'path';
import common from '../../../common';

describe.each(backends)('%s fs.fileSync', (name, options) => {
	const configured = configure({ fs: name, options });
	const file = path.join(common.fixturesDir, 'a.js');
	const rootFS = fs.getRootFS();

	if (!rootFS.isReadOnly()) {
		let fd: number;
		let successes = 0;

		beforeAll(done => {
			fs.open(file, 'a', 0o777, (err, fileDescriptor) => {
				if (err) throw err;
				fd = fileDescriptor;
				done();
			});
		});

		if (rootFS.supportsSynch()) {
			it('should synchronize file data changes (sync)', async () => {
				await configured;
				fs.fdatasyncSync(fd);
				successes++;
				fs.fsyncSync(fd);
				successes++;
			});
		}

		it('should synchronize file data changes (async)', async done => {
			await configured;
			fs.fdatasync(fd, err => {
				if (err) throw err;
				successes++;
				fs.fsync(fd, err => {
					if (err) throw err;
					successes++;
					done();
				});
			});
		});

		afterAll(done => {
			fs.close(fd, err => {
				if (err) throw err;
				done();
			});
		});

		it('should have correct number of successes', async () => {
			await configured;
			if (rootFS.supportsSynch()) {
				expect(successes).toBe(4);
			} else {
				expect(successes).toBe(2);
			}
		});
	}
});
