import fs from '../../../../src/core/node_fs';
import * as path from 'path';
import common from '../../../harness/common';

describe('fs.fileSync', () => {
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
			it('should synchronize file data changes (sync)', () => {
				fs.fdatasyncSync(fd);
				successes++;
				fs.fsyncSync(fd);
				successes++;
			});
		}

		it('should synchronize file data changes (async)', done => {
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

		it('should have correct number of successes', () => {
			if (rootFS.supportsSynch()) {
				expect(successes).toBe(4);
			} else {
				expect(successes).toBe(2);
			}
		});
	}
});
