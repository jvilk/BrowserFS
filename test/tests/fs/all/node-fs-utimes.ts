import fs from '../../../../src/core/node_fs';
import * as path from 'path';
import common from '../../../harness/common';

describe('Utimes Tests', () => {
	let tests_ok: number;
	let tests_run: number;
	const rootFS = fs.getRootFS();
	const filename = path.join(common.fixturesDir, 'x.txt');

	beforeAll(() => {
		tests_ok = 0;
		tests_run = 0;
	});

	function stat_resource(resource: string | number) {
		if (typeof resource === 'string') {
			return fs.statSync(resource);
		} else {
			// ensure mtime has been written to disk
			fs.fsyncSync(resource);
			return fs.fstatSync(resource);
		}
	}

	function check_mtime(resource: string | number, mtime: Date | number) {
		const mtimeNo = fs._toUnixTimestamp(mtime);
		const stats = stat_resource(resource);
		const real_mtime = fs._toUnixTimestamp(stats.mtime);
		// check up to single-second precision
		// sub-second precision is OS and fs dependent
		return Math.floor(mtimeNo) === Math.floor(real_mtime);
	}

	function expect_errno(syscall: string, resource: string | number, err: NodeJS.ErrnoException, errno: string) {
		tests_run++;
		if (err) {
			//&& (err.code === errno || err.code === 'ENOSYS')) {
			tests_ok++;
		} else {
			console.error('FAILED:', arguments);
		}
	}

	function expect_ok(syscall: string, resource: string | number, err: NodeJS.ErrnoException, atime: Date | number, mtime: Date | number) {
		tests_run++;
		if ((!err && check_mtime(resource, mtime)) || err) {
			//&& err.code === 'ENOSYS') {
			tests_ok++;
		} else {
			console.error('FAILED:', arguments);
		}
	}

	function runTest(atime: Date | number, mtime: Date | number): Promise<void> {
		return new Promise(resolve => {
			let fd: number;
			//
			// test synchronized code paths, these functions throw on failure
			//
			function syncTests() {
				fs.utimesSync(filename, atime, mtime);
				expect_ok('utimesSync', filename, undefined, atime, mtime);

				// some systems don't have futimes
				// if there's an error, it should be ENOSYS
				try {
					fs.futimesSync(fd, atime, mtime);
					expect_ok('futimesSync', fd, undefined, atime, mtime);
				} catch (ex) {
					expect_errno('futimesSync', fd, ex, 'ENOSYS');
				}

				let err: NodeJS.ErrnoException;
				err = undefined;
				try {
					fs.utimesSync('foobarbaz', atime, mtime);
				} catch (ex) {
					err = ex;
				}
				expect_errno('utimesSync', 'foobarbaz', err, 'ENOENT');

				err = undefined;
				try {
					fs.futimesSync(-1, atime, mtime);
				} catch (ex) {
					err = ex;
				}
				expect_errno('futimesSync', -1, err, 'EBADF');
			}

			//
			// test async code paths  //
			fs.utimes(filename, atime, mtime, function (err) {
				expect_ok('utimes', filename, err, atime, mtime);

				fs.utimes('foobarbaz', atime, mtime, function (err) {
					expect_errno('utimes', 'foobarbaz', err, 'ENOENT');

					// don't close this fd
					fd = fs.openSync(filename, 'r');

					fs.futimes(fd, atime, mtime, function (err) {
						expect_ok('futimes', fd, err, atime, mtime);

						fs.futimes(-1, atime, mtime, function (err) {
							expect_errno('futimes', -1, err, 'EBADF');
							if (rootFS.supportsSynch()) {
								syncTests();
							}
							resolve();
						});
					});
				});
			});
		});
	}

	if (rootFS.supportsProps()) {
		const stats = fs.statSync(filename);
		test('Run Test 1', async () => {
			await runTest(new Date('1982/09/10 13:37:00'), new Date('1982/09/10 13:37:00'));
		});

		test('Run Test 2', async () => {
			await runTest(new Date(), new Date());
		});

		test('Run Test 3', async () => {
			await runTest(123456.789, 123456.789);
		});

		test('Run Test 4', async () => {
			await runTest(stats.mtime, stats.mtime);
		});

		afterAll(() => {
			expect(tests_ok).toBe(tests_run);
		});
	}
});
