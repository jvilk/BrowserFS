import { backends, fs, configure, tmpDir, fixturesDir } from '../../../common';
import * as path from 'path';

import { promisify } from 'node:util';

describe.each(backends)('%s Link and Symlink Test', (name, options) => {
	const configured = configure({ fs: name, options });
	const readFileAsync = promisify<string, string, string>(fs.readFile);

	it('should create and read symbolic link', async () => {
		await configured;
		if (fs.getRootFS().supportsLinks()) {
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
		if (fs.getRootFS().supportsLinks()) {
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
