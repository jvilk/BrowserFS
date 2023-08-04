import { backends, fs, configure } from '../../../common';
import * as path from 'path';
import common from '../../../common';
import type { BFSOneArgCallback } from '../../../../src/core/file_system';

describe.each(backends)('%s Truncate Tests', (name, options) => {
	const configured = configure({ fs: name, options });
	let filename: string;
	const data = Buffer.alloc(1024 * 16, 'x');
	let success: number;

	beforeAll(() => {
		const tmp = common.tmpDir;
		filename = path.resolve(tmp, 'truncate-file.txt');
	});

	beforeEach(() => {
		success = 0;
	});

	afterEach(() => {
		fs.unlinkSync(filename);
	});

	const testTruncate = (cb: Function) => {
		fs.writeFile(filename, data, er => {
			if (er) return cb(er);
			fs.stat(filename, (er, stat) => {
				if (er) return cb(er);
				expect(stat.size).toBe(1024 * 16);

				fs.truncate(filename, 1024, er => {
					if (er) return cb(er);
					fs.stat(filename, (er, stat) => {
						if (er) return cb(er);
						expect(stat.size).toBe(1024);

						fs.truncate(filename, er => {
							if (er) return cb(er);
							fs.stat(filename, (er, stat) => {
								if (er) return cb(er);
								expect(stat.size).toBe(0);
								cb();
							});
						});
					});
				});
			});
		});
	};

	const testFtruncate = (cb: BFSOneArgCallback) => {
		fs.writeFile(filename, data, er => {
			if (er) return cb(er);
			fs.stat(filename, (er, stat) => {
				if (er) return cb(er);
				expect(stat.size).toBe(1024 * 16);

				fs.open(filename, 'w', (er, fd) => {
					if (er) return cb(er);
					fs.ftruncate(fd, 1024, er => {
						if (er) return cb(er);
						// Force a sync.
						fs.fsync(fd, er => {
							if (er) return cb(er);
							fs.stat(filename, (er, stat) => {
								if (er) return cb(er);
								expect(stat.size).toBe(1024);

								fs.ftruncate(fd, er => {
									if (er) return cb(er);
									// Force a sync.
									fs.fsync(fd, er => {
										if (er) return cb(er);
										fs.stat(filename, (er, stat) => {
											if (er) return cb(er);
											expect(stat.size).toBe(0);
											fs.close(fd, cb);
										});
									});
								});
							});
						});
					});
				});
			});
		});
	};

	test('Truncate Sync', () => {
		const rootFS = fs.getRootFS();
		if (!rootFS.supportsSynch()) return;

		fs.writeFileSync(filename, data);
		let stat = fs.statSync(filename);
		expect(stat.size).toBe(1024 * 16);

		fs.truncateSync(filename, 1024);
		stat = fs.statSync(filename);
		expect(stat.size).toBe(1024);

		fs.truncateSync(filename);
		stat = fs.statSync(filename);
		expect(stat.size).toBe(0);

		fs.writeFileSync(filename, data);
		const fd = fs.openSync(filename, 'r+');
		stat = fs.statSync(filename);
		expect(stat.size).toBe(1024 * 16);

		// TODO: Uncomment the following lines once fs.ftruncateSync is supported.
		// fs.ftruncateSync(fd, 1024);
		// stat = fs.statSync(filename);
		// expect(stat.size).toBe(1024);

		// fs.ftruncateSync(fd);
		// stat = fs.statSync(filename);
		// expect(stat.size).toBe(0);

		fs.closeSync(fd);
	});

	test('Truncate Async', done => {
		const rootFS = fs.getRootFS();
		if (rootFS.isReadOnly() || !rootFS.supportsSynch()) {
			done();
			return;
		}

		success = 0;

		testTruncate((er: NodeJS.ErrnoException) => {
			if (er) throw er;
			success++;
			testFtruncate((er: NodeJS.ErrnoException) => {
				if (er) throw er;
				success++;
				expect(success).toBe(2);
				done();
			});
		});
	});
});
