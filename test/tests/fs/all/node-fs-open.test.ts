import fs from '../../../../src/core/node_fs';
import path from 'path';
import common from '../../../harness/common';

describe('fs file opening', () => {
	const filename = path.join(common.fixturesDir, 'a.js');

	it('should throw ENOENT when opening non-existent file (sync)', () => {
		let caughtException = false;
		const rootFS = fs.getRootFS();
		if (rootFS.supportsSynch()) {
			try {
				fs.openSync('/path/to/file/that/does/not/exist', 'r');
			} catch (e) {
				expect(e.code).toBe('ENOENT');
				caughtException = true;
			}
			expect(caughtException).toBeTruthy();
		}
	});

	it('should throw ENOENT when opening non-existent file (async)', done => {
		fs.open('/path/to/file/that/does/not/exist', 'r', err => {
			expect(err).not.toBeNull();
			expect(err.code).toBe('ENOENT');
			done();
		});
	});

	it('should open file with mode "r"', done => {
		fs.open(filename, 'r', (err, fd) => {
			if (err) throw err;
			expect(fd).toBeTruthy();
			done();
		});
	});

	it('should open file with mode "rs"', done => {
		fs.open(filename, 'rs', (err, fd) => {
			if (err) throw err;
			expect(fd).toBeTruthy();
			done();
		});
	});
});
