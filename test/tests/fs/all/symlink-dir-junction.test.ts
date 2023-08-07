import { backends, fs, configure } from '../../../common';
import * as path from 'path';
import common from '../../../common';
import { promisify } from 'node:util';

describe.each(backends)('%s Symbolic Link Test', (name, options) => {
	const configured = configure({ fs: name, options });
	let completed = 0;
	const expected_tests = 4;

	// test creating and reading symbolic link
	const linkData = path.join(common.fixturesDir, 'cycles/');
	const linkPath = path.join(common.tmpDir, 'cycles_link');

	const unlinkAsync = promisify(fs.unlink);
	const existsAsync = promisify(fs.existsSync);

	beforeAll(async () => {
		await configured;

		// Delete previously created link
		await unlinkAsync(linkPath);

		console.log('linkData: ' + linkData);
		console.log('linkPath: ' + linkPath);

		await promisify<string, string, string, void>(fs.symlink)(linkData, linkPath, 'junction');
		completed++;
	});

	it('should lstat symbolic link', async () => {
		await configured;
		if (fs.getRootFS().isReadOnly() || !fs.getRootFS().supportsLinks()) {
			return;
		}

		const stats = await promisify(fs.lstat)(linkPath);
		expect(stats.isSymbolicLink()).toBe(true);
		completed++;
	});

	it('should readlink symbolic link', async () => {
		await configured;
		if (fs.getRootFS().isReadOnly() || !fs.getRootFS().supportsLinks()) {
			return;
		}
		const destination = await promisify(fs.readlink)(linkPath);
		expect(destination).toBe(linkData);
		completed++;
	});

	it('should unlink symbolic link', async () => {
		await configured;
		if (fs.getRootFS().isReadOnly() || !fs.getRootFS().supportsLinks()) {
			return;
		}
		await unlinkAsync(linkPath);
		expect(await existsAsync(linkPath)).toBe(false);
		expect(await existsAsync(linkData)).toBe(true);
		completed++;
	});

	afterAll(() => {
		expect(completed).toBe(expected_tests);
		process.exitCode = 0;
	});
});
