import { backends, fs } from '../../../common';
import * as path from 'path';
import common from '../../../common';

describe.each(backends)('%s File Stat Test', () => {
	let got_error = false;
	let success_count = 0;
	const existing_dir = common.fixturesDir;
	const existing_file = path.join(common.fixturesDir, 'x.txt');

	it('should handle empty file path', done => {
		fs.stat('', (err, stats) => {
			expect(err).toBeTruthy();
			success_count++;
			done();
		});
	});

	it('should stat existing directory', done => {
		fs.stat(existing_dir, (err, stats) => {
			if (err) {
				got_error = true;
			} else {
				expect(stats.mtime).toBeInstanceOf(Date);
				success_count++;
			}
			done();
		});
	});

	it('should lstat existing directory', done => {
		fs.lstat(existing_dir, (err, stats) => {
			if (err) {
				got_error = true;
			} else {
				expect(stats.mtime).toBeInstanceOf(Date);
				success_count++;
			}
			done();
		});
	});

	it('should fstat existing file', done => {
		fs.open(existing_file, 'r', undefined, (err, fd) => {
			expect(err).toBeNull();
			expect(fd).toBeTruthy();

			fs.fstat(fd, (err, stats) => {
				if (err) {
					got_error = true;
				} else {
					expect(stats.mtime).toBeInstanceOf(Date);
					success_count++;
					fs.close(fd, () => {
						done();
					});
				}
			});
		});
	});

	if (fs.getRootFS().supportsSynch()) {
		it('should fstatSync existing file', done => {
			fs.open(existing_file, 'r', undefined, (err, fd) => {
				let stats;
				try {
					stats = fs.fstatSync(fd);
				} catch (e) {
					got_error = true;
				}
				if (stats) {
					expect(stats.mtime).toBeInstanceOf(Date);
					success_count++;
				}
				fs.close(fd, () => {
					done();
				});
			});
		});
	}

	it('should stat existing file', done => {
		fs.stat(existing_file, (err, s) => {
			if (err) {
				got_error = true;
			} else {
				success_count++;
				expect(s.isDirectory()).toBe(false);
				expect(s.isFile()).toBe(true);
				expect(s.isSocket()).toBe(false);
				//expect(s.isBlockDevice()).toBe(false);
				expect(s.isCharacterDevice()).toBe(false);
				expect(s.isFIFO()).toBe(false);
				expect(s.isSymbolicLink()).toBe(false);
				expect(s.mtime).toBeInstanceOf(Date);
			}
			done();
		});
	});

	afterAll(() => {
		let expected_success = 5;
		if (fs.getRootFS().supportsSynch()) expected_success++;
		expect(success_count).toBe(expected_success);
		expect(got_error).toBe(false);
		process.exitCode = 0;
	});
});
