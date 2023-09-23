import { backends, fs, configure, tmpDir, fixturesDir } from '../../common';
import * as path from 'path';

import { promisify } from 'node:util';

describe.each(backends)('%s Link and Symlink Test', (name, options) => {
	const configured = configure({ fs: name, options });
	const readFileAsync = promisify<string, string, string>(fs.readFile);

	it('should create and read symbolic link', async () => {
		await configured;
		if (fs.getMount('/').metadata.supportsLinks) {
			const linkData = path.join(fixturesDir, '/cycles/root.js');
			const linkPath = path.join(tmpDir, 'symlink1.js');

			// Delete previously created link
			try {
				await promisify(fs.unlink)(linkPath);
			} catch (e) {}

			await promisify(fs.symlink)(linkData, linkPath);
			console.log('symlink done');

			const destination = await promisify(fs.readlink)(linkPath);
			expect(destination).toBe(linkData);
		}
	});

	it('should create and read hard link', async () => {
		await configured;
		if (fs.getMount('/').metadata.supportsLinks) {
			const srcPath = path.join(fixturesDir, 'cycles', 'root.js');
			const dstPath = path.join(tmpDir, 'link1.js');

			// Delete previously created link
			try {
				await promisify(fs.unlink)(dstPath);
			} catch (e) {}

			await promisify(fs.link)(srcPath, dstPath);
			console.log('hard link done');

			const srcContent = await readFileAsync(srcPath, 'utf8');
			const dstContent = await readFileAsync(dstPath, 'utf8');
			expect(srcContent).toBe(dstContent);
		}
	});
});

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
		if (fs.getMount('/').metadata.readonly || !fs.getMount('/').metadata.supportsLinks) {
			return;
		}

		const stats = await promisify(fs.lstat)(linkPath);
		expect(stats.isSymbolicLink()).toBe(true);
	});

	it('should readlink symbolic link', async () => {
		await configured;
		if (fs.getMount('/').metadata.readonly || !fs.getMount('/').metadata.supportsLinks) {
			return;
		}
		const destination = await promisify(fs.readlink)(linkPath);
		expect(destination).toBe(linkData);
	});

	it('should unlink symbolic link', async () => {
		await configured;
		if (fs.getMount('/').metadata.readonly || !fs.getMount('/').metadata.supportsLinks) {
			return;
		}
		await unlinkAsync(linkPath);
		expect(await existsAsync(linkPath)).toBe(false);
		expect(await existsAsync(linkData)).toBe(true);
	});
});
