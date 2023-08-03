import { fs, createMockStats, backends } from '../../../common';
import * as path from 'path';
import common from '../../../common';
import { jest } from '@jest/globals';

const isWindows = process.platform === 'win32';
describe.each(backends)('%s chmod tests', () => {
	const fixturesDir = common.fixturesDir;
	const tmpDir = common.tmpDir;

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should change file mode using chmod', async () => {
		const file1 = path.join(fixturesDir, 'a.js');
		const modeAsync = 0o777;
		const modeSync = 0o644;

		jest.spyOn(fs, 'chmod').mockImplementation((path, mode, callback) => {
			expect(path).toBe(file1);
			expect(mode).toBe(modeAsync.toString(8));
			callback(null);
		});

		jest.spyOn(fs, 'chmodSync').mockImplementation((path, mode) => {
			expect(path).toBe(file1);
			expect(mode).toBe(modeSync);
		});

		jest.spyOn(fs, 'statSync').mockReturnValue(createMockStats(isWindows ? modeAsync & 0o777 : modeAsync));

		await changeFileMode(file1, modeAsync, modeSync);
	});

	it('should change file mode using fchmod', async () => {
		const file2 = path.join(fixturesDir, 'a1.js');
		const modeAsync = 0o777;
		const modeSync = 0o644;

		jest.spyOn(fs, 'open').mockImplementation((path, flags, mode, callback) => {
			expect(path).toBe(file2);
			expect(flags).toBe('a');
			callback(null, 123);
		});

		jest.spyOn(fs, 'fchmod').mockImplementation((fd, mode, callback) => {
			expect(fd).toBe(123);
			expect(mode).toBe(modeAsync.toString(8));
			callback(null);
		});

		jest.spyOn(fs, 'fchmodSync').mockImplementation((fd, mode) => {
			expect(fd).toBe(123);
			expect(mode).toBe(modeSync);
		});

		jest.spyOn(fs, 'fstatSync').mockReturnValue(createMockStats(isWindows ? modeAsync & 0o777 : modeAsync));

		await changeFileMode(file2, modeAsync, modeSync);
	});

	it('should change symbolic link mode using lchmod', async () => {
		const link = path.join(tmpDir, 'symbolic-link');
		const file2 = path.join(fixturesDir, 'a1.js');
		const modeAsync = 0o777;
		const modeSync = 0o644;

		jest.spyOn(fs, 'unlinkSync').mockImplementation(path => {
			expect(path).toBe(link);
		});

		jest.spyOn(fs, 'symlinkSync').mockImplementation((target, path) => {
			expect(target).toBe(file2);
			expect(path).toBe(link);
		});

		jest.spyOn(fs, 'lchmod').mockImplementation((path, mode, callback) => {
			expect(path).toBe(link);
			expect(mode).toBe(modeAsync);
			callback(null);
		});

		jest.spyOn(fs, 'lchmodSync').mockImplementation((path, mode) => {
			expect(path).toBe(link);
			expect(mode).toBe(modeSync);
		});

		jest.spyOn(fs, 'lstatSync').mockReturnValue(createMockStats(isWindows ? modeAsync & 0o777 : modeAsync));

		await changeSymbolicLinkMode(link, file2, modeAsync, modeSync);
	});
});

function changeFileMode(file: string, modeAsync: number, modeSync: number): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		fs.chmod(file, modeAsync.toString(8), err => {
			if (err) {
				reject(err);
			} else {
				expect(fs.statSync(file).mode & 0o777).toBe(isWindows ? modeAsync & 0o777 : modeAsync);
				fs.chmodSync(file, modeSync);
				expect(fs.statSync(file).mode & 0o777).toBe(isWindows ? modeSync & 0o777 : modeSync);
				resolve();
			}
		});
	});
}

function changeSymbolicLinkMode(link: string, target: string, modeAsync: number, modeSync: number): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		fs.lchmod(link, modeAsync, err => {
			if (err) {
				reject(err);
			} else {
				expect(fs.lstatSync(link).mode & 0o777).toBe(isWindows ? modeAsync & 0o777 : modeAsync);
				fs.lchmodSync(link, modeSync);
				expect(fs.lstatSync(link).mode & 0o777).toBe(isWindows ? modeSync & 0o777 : modeSync);
				resolve();
			}
		});
	});
}
