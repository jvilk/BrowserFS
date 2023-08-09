import { backends, fs, configure, tmpDir, fixturesDir } from '../../../common';
import * as path from 'path';
import { promisify } from 'node:util';

describe.each(backends)('%s Symbolic Link Test', (name, options) => {
	const configured = configure({ fs: name, options });

	// test creating and reading symbolic link
	const linkData = path.join(fixturesDir, 'cycles/');
	const linkPath = path.join(tmpDir, 'cycles_link');

	const unlinkAsync = promisify(fs.unlink);
	const existsAsync = promisify(fs.existsSync);

	beforeAll(async () => {
		await configured;

		// Delete previously created link
		await unlinkAsync(linkPath);

		console.log('linkData: ' + linkData);
		console.log('linkPath: ' + linkPath);

		await promisify<string, string, string, void>(fs.symlink)(linkData, linkPath, 'junction');
		return;
	});

	it('should lstat symbolic link', async () => {
		await configured;
		if (fs.getRootFS().isReadOnly() || !fs.getRootFS().supportsLinks()) {
			return;
		}

		const stats = await promisify(fs.lstat)(linkPath);
		expect(stats.isSymbolicLink()).toBe(true);
	});

	it('should readlink symbolic link', async () => {
		await configured;
		if (fs.getRootFS().isReadOnly() || !fs.getRootFS().supportsLinks()) {
			return;
		}
		const destination = await promisify(fs.readlink)(linkPath);
		expect(destination).toBe(linkData);
	});

	it('should unlink symbolic link', async () => {
		await configured;
		if (fs.getRootFS().isReadOnly() || !fs.getRootFS().supportsLinks()) {
			return;
		}
		await unlinkAsync(linkPath);
		expect(await existsAsync(linkPath)).toBe(false);
		expect(await existsAsync(linkData)).toBe(true);
	});
});
