import { fs } from '../../../common';
import * as path from 'path';
import common from '../../../common';

describe('File Reading', () => {
	test('Cannot read a file with an invalid encoding (synchronous)', () => {
		const rootFS = fs.getRootFS();
		let wasThrown = false;
		if (rootFS.supportsSynch()) {
			try {
				fs.readFileSync(path.join(common.fixturesDir, 'a.js'), 'wrongencoding');
			} catch (e) {
				wasThrown = true;
			}
			expect(wasThrown).toBeTruthy();
		}
	});

	test('Cannot read a file with an invalid encoding (asynchronous)', done => {
		fs.readFile(path.join(common.fixturesDir, 'a.js'), 'wrongencoding', (err, data) => {
			expect(err).toBeTruthy();
			done();
		});
	});

	test('Reading past the end of a file should not be an error', done => {
		fs.open(path.join(common.fixturesDir, 'a.js'), 'r', (err, fd) => {
			expect(err).toBeFalsy();
			const buffData = Buffer.alloc(10);
			fs.read(fd, buffData, 0, 10, 10000, (err, bytesRead, buffer) => {
				expect(err).toBeFalsy();
				expect(bytesRead).toBe(0);
				expect(buffer).toBe(buffData);
				done();
			});
		});
	});
});
