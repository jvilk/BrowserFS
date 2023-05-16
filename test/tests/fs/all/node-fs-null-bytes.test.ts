import { fs } from '../../../common';

describe('fs path validation', () => {
	const rootFS = fs.getRootFS();

	function check(asyncFn: Function, syncFn: Function, ...args: any[]): void {
		const expected = /Path must be a string without null bytes./;
		const argsSync = args.slice();
		const argsAsync = args.concat(function (er: NodeJS.ErrnoException) {
			expect(er && er.message.match(expected)).toBeTruthy();
		});

		if (rootFS.supportsSynch() && syncFn) {
			it(`should throw an error for invalid path (sync)`, () => {
				expect(() => {
					syncFn.apply(null, argsSync);
				}).toThrow(expected);
			});
		}

		if (asyncFn) {
			it(`should throw an error for invalid path (async)`, done => {
				asyncFn.apply(null, argsAsync);
				done();
			});
		}
	}

	check(fs.appendFile, fs.appendFileSync, 'foo\u0000bar');
	check(fs.lstat, fs.lstatSync, 'foo\u0000bar');
	check(fs.mkdir, fs.mkdirSync, 'foo\u0000bar', '0755');
	check(fs.open, fs.openSync, 'foo\u0000bar', 'r');
	check(fs.readFile, fs.readFileSync, 'foo\u0000bar');
	check(fs.readdir, fs.readdirSync, 'foo\u0000bar');
	check(fs.realpath, fs.realpathSync, 'foo\u0000bar');
	check(fs.rename, fs.renameSync, 'foo\u0000bar', 'foobar');
	check(fs.rename, fs.renameSync, 'foobar', 'foo\u0000bar');
	check(fs.rmdir, fs.rmdirSync, 'foo\u0000bar');
	check(fs.stat, fs.statSync, 'foo\u0000bar');
	check(fs.truncate, fs.truncateSync, 'foo\u0000bar');
	check(fs.unlink, fs.unlinkSync, 'foo\u0000bar');
	check(fs.writeFile, fs.writeFileSync, 'foo\u0000bar');

	if (rootFS.supportsLinks()) {
		check(fs.link, fs.linkSync, 'foo\u0000bar', 'foobar');
		check(fs.link, fs.linkSync, 'foobar', 'foo\u0000bar');
		check(fs.readlink, fs.readlinkSync, 'foo\u0000bar');
		check(fs.symlink, fs.symlinkSync, 'foo\u0000bar', 'foobar');
		check(fs.symlink, fs.symlinkSync, 'foobar', 'foo\u0000bar');
	}

	if (rootFS.supportsProps()) {
		check(fs.chmod, fs.chmodSync, 'foo\u0000bar', '0644');
		check(fs.chown, fs.chownSync, 'foo\u0000bar', 12, 34);
		check(fs.utimes, fs.utimesSync, 'foo\u0000bar', 0, 0);
	}

	it('should return false for non-existing path', done => {
		fs.exists('foo\u0000bar', exists => {
			expect(exists).toBeFalsy();
			done();
		});
	});

	if (rootFS.supportsSynch()) {
		it('should return false for non-existing path (sync)', () => {
			expect(fs.existsSync('foo\u0000bar')).toBeFalsy();
		});
	}
});
