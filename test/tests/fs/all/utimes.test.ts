import { backends, fs, configure, fixturesDir } from '../../../common';
import * as path from 'path';

import { promisify } from 'node:util';

describe.each(backends)('%s Utimes Tests', (name, options) => {
	const configured = configure({ fs: name, options });

	const filename = path.join(fixturesDir, 'x.txt');

	function expect_errno(syscall: string, resource: string | number, err: NodeJS.ErrnoException, errno: string) {
		expect(err.code).toEqual(errno);
	}

	function expect_ok(syscall: string, resource: string | number, atime: Date | number, mtime: Date | number) {
		const expected_mtime = fs._toUnixTimestamp(mtime);
		const stats = typeof resource == 'string' ? fs.statSync(resource) : (fs.fsyncSync(resource), fs.fstatSync(resource));
		const real_mtime = fs._toUnixTimestamp(stats.mtime);
		// check up to single-second precision
		// sub-second precision is OS and fs dependent
		expect(Math.floor(expected_mtime)).toEqual(Math.floor(real_mtime));
	}

	async function runTest(atime: Date | number, mtime: Date | number): Promise<void> {
		await configured;

		await promisify(fs.utimes)(filename, atime, mtime);
		expect_ok('utimes', filename, atime, mtime);

		await promisify(fs.utimes)('foobarbaz', atime, mtime).catch(err => {
			expect_errno('utimes', 'foobarbaz', err, 'ENOENT');
		});

		// don't close this fd
		const fd = await promisify<string, string, number>(fs.open)(filename, 'r');

		await promisify(fs.futimes)(fd, atime, mtime);
		expect_ok('futimes', fd, atime, mtime);

		await promisify(fs.futimes)(-1, atime, mtime).catch(err => {
			expect_errno('futimes', -1, err, 'EBADF');
		});

		if (!fs.getRootFS().supportsSynch()) {
			return;
		}

		fs.utimesSync(filename, atime, mtime);
		expect_ok('utimesSync', filename, atime, mtime);

		// some systems don't have futimes
		// if there's an error, it should be ENOSYS
		try {
			fs.futimesSync(fd, atime, mtime);
			expect_ok('futimesSync', fd, atime, mtime);
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

	it('utimes should work', async () => {
		await configured;
		if (!fs.getRootFS().supportsProps()) {
			return;
		}
		await runTest(new Date('1982/09/10 13:37:00'), new Date('1982/09/10 13:37:00'));
		await runTest(new Date(), new Date());
		await runTest(123456.789, 123456.789);
		const stats = fs.statSync(filename);
		await runTest(stats.mtime, stats.mtime);
	});
});
