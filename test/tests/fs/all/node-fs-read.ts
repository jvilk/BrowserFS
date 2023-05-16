import fs from '../../../../src/core/node_fs';
import * as path from 'path';
import common from '../../../harness/common';

describe('File Read Test', () => {
	let filepath: string;
	let expected: string;
	let rootFS: any;

	beforeEach(() => {
		filepath = path.join(common.fixturesDir, 'x.txt');
		expected = 'xyz\n';
		rootFS = fs.getRootFS();
	});

	it('should read file asynchronously', done => {
		fs.open(filepath, 'r', (err: NodeJS.ErrnoException, fd: number) => {
			if (err) throw err;

			const buffer = Buffer.alloc(expected.length);
			fs.read(fd, buffer, 0, expected.length, 0, (err: NodeJS.ErrnoException, bytesRead: number) => {
				expect(err).toBeNull();
				expect(buffer.toString()).toEqual(expected);
				expect(bytesRead).toEqual(expected.length);
				done();
			});
		});
	});

	if (rootFS.supportsSynch()) {
		it('should read file synchronously', () => {
			const fd = fs.openSync(filepath, 'r');
			const buffer = Buffer.alloc(expected.length);
			const bytesRead = fs.readSync(fd, buffer, 0, expected.length, 0);

			expect(buffer.toString()).toEqual(expected);
			expect(bytesRead).toEqual(expected.length);
		});
	}

	afterAll(() => {
		process.exitCode = 0;
	});
});
