import fs from '../../../../src/core/node_fs';
import * as path from 'path';
import common from '../../../harness/common';

describe('Read and Unlink File Test', () => {
	if (!fs.getRootFS().isReadOnly()) {
		const dirName = path.resolve(common.fixturesDir, 'test-readfile-unlink');
		const fileName = path.resolve(dirName, 'test.bin');

		const buf = Buffer.alloc(512);
		buf.fill(42);

		beforeAll(done => {
			fs.mkdir(dirName, (err: NodeJS.ErrnoException) => {
				if (err) throw err;
				fs.writeFile(fileName, buf, err => {
					if (err) throw err;
					done();
				});
			});
		});

		it('should read file and verify its content', done => {
			fs.readFile(fileName, (err, data) => {
				expect(err).toBeNull();
				expect(data.length).toBe(buf.length);
				expect(data[0]).toBe(42);
				done();
			});
		});

		it('should unlink file and remove directory', done => {
			fs.unlink(fileName, err => {
				if (err) throw err;
				fs.rmdir(dirName, err => {
					if (err) throw err;
					done();
				});
			});
		});
	}

	afterAll(() => {
		process.exitCode = 0;
	});
});
