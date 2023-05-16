import fs from '../../../../src/core/node_fs';
import path from 'path';
import common from '../../../harness/common';

describe('fs file reading', () => {
	const filepath = path.join(common.fixturesDir, 'x.txt');
	const expected = 'xyz\n';
	const bufferAsync = Buffer.alloc(expected.length);
	const bufferSync = Buffer.alloc(expected.length);
	let readCalled = 0;
	const rootFS = fs.getRootFS();

	it('should read file asynchronously', done => {
		fs.open(filepath, 'r', (err, fd) => {
			if (err) throw err;

			fs.read(fd, bufferAsync, 0, expected.length, 0, (err, bytesRead) => {
				readCalled++;

				expect(bytesRead).toBe(expected.length);
				expect(bufferAsync.toString()).toBe(expected);
				done();
			});
		});
	});

	if (rootFS.supportsSynch()) {
		it('should read file synchronously', () => {
			const fd = fs.openSync(filepath, 'r');
			const bytesRead = fs.readSync(fd, bufferSync, 0, expected.length, 0);

			expect(bufferSync.toString()).toBe(expected);
			expect(bytesRead).toBe(expected.length);
		});
	}

	afterAll(() => {
		expect(readCalled).toBe(1);
	});
});
