import { fs, createMockStats, backends, configure, tmpDir, fixturesDir } from '../../common';
import * as path from 'path';

import { jest } from '@jest/globals';
import { promisify } from 'node:util';

const isWindows = process.platform === 'win32';

describe.each(backends)('%s chmod tests', (name, options) => {
	const configured = configure({ fs: name, options });

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should change file mode using chmod', async () => {
		await configured;
		const file1 = path.join(fixturesDir, 'a.js');
		const modeAsync = 0o777;
		const modeSync = 0o644;

		jest.spyOn(fs, 'chmod').mockImplementation(async (path, mode) => {
			expect(path).toBe(file1);
			expect(mode).toBe(modeAsync.toString(8));
		});

		jest.spyOn(fs, 'chmodSync').mockImplementation((path, mode) => {
			expect(path).toBe(file1);
			expect(mode).toBe(modeSync);
		});

		jest.spyOn(fs, 'statSync').mockReturnValue(createMockStats(isWindows ? modeAsync & 0o777 : modeAsync));

		await changeFileMode(file1, modeAsync, modeSync);
	});

	it('should change file mode using fchmod', async () => {
		await configured;
		const file2 = path.join(fixturesDir, 'a1.js');
		const modeAsync = 0o777;
		const modeSync = 0o644;

		jest.spyOn(fs, 'open').mockImplementation(async (path, flags, mode) => {
			expect(path).toBe(file2);
			expect(flags).toBe('a');
			return 123;
		});

		jest.spyOn(fs, 'fchmod').mockImplementation(async (fd, mode) => {
			expect(fd).toBe(123);
			expect(mode).toBe(modeAsync.toString(8));
		});

		jest.spyOn(fs, 'fchmodSync').mockImplementation((fd, mode) => {
			expect(fd).toBe(123);
			expect(mode).toBe(modeSync);
		});

		jest.spyOn(fs, 'fstatSync').mockReturnValue(createMockStats(isWindows ? modeAsync & 0o777 : modeAsync));

		await changeFileMode(file2, modeAsync, modeSync);
	});

	it('should change symbolic link mode using lchmod', async () => {
		await configured;
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

		jest.spyOn(fs, 'lchmod').mockImplementation(async (path, mode) => {
			expect(path).toBe(link);
			expect(mode).toBe(modeAsync);
		});

		jest.spyOn(fs, 'lchmodSync').mockImplementation((path, mode) => {
			expect(path).toBe(link);
			expect(mode).toBe(modeSync);
		});

		jest.spyOn(fs, 'lstatSync').mockReturnValue(createMockStats(isWindows ? modeAsync & 0o777 : modeAsync));

		await changeSymbolicLinkMode(link, file2, modeAsync, modeSync);
	});
});

async function changeFileMode(file: string, modeAsync: number, modeSync: number): Promise<void> {
	await promisify(fs.chmod)(file, modeAsync.toString(8));

	const statAsync = promisify(fs.stat);
	const statResult = await statAsync(file);
	expect(statResult.mode & 0o777).toBe(isWindows ? modeAsync & 0o777 : modeAsync);

	fs.chmodSync(file, modeSync);
	const statSyncResult = fs.statSync(file);
	expect(statSyncResult.mode & 0o777).toBe(isWindows ? modeSync & 0o777 : modeSync);
}

async function changeSymbolicLinkMode(link: string, target: string, modeAsync: number, modeSync: number): Promise<void> {
	await promisify(fs.unlink)(link);
	await promisify(fs.symlink)(target, link);

	await promisify(fs.lchmod)(link, modeAsync);
	const lstatAsync = promisify(fs.lstat);
	const lstatResult = await lstatAsync(link);
	expect(lstatResult.mode & 0o777).toBe(isWindows ? modeAsync & 0o777 : modeAsync);

	fs.lchmodSync(link, modeSync);
	const lstatSyncResult = fs.lstatSync(link);
	expect(lstatSyncResult.mode & 0o777).toBe(isWindows ? modeSync & 0o777 : modeSync);
}
