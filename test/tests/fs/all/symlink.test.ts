import { backends, fs, configure } from '../../../common';
import * as path from 'path';
import common from '../../../common';

describe.each(backends)('%s Link and Symlink Test', (name, options) => {
	const configured = configure({ fs: name, options });
	let completed = 0;
	const expected_tests = 2;
	const rootFS = fs.getRootFS();

	it('should create and read symbolic link', async done => {
		if (rootFS.supportsLinks()) {
			await configured;
			const linkData = path.join(common.fixturesDir, '/cycles/root.js');
			const linkPath = path.join(common.tmpDir, 'symlink1.js');

			// Delete previously created link
			try {
				fs.unlinkSync(linkPath);
			} catch (e) {}

			fs.symlink(linkData, linkPath, err => {
				if (err) throw err;
				console.log('symlink done');
				fs.readlink(linkPath, (err, destination) => {
					if (err) throw err;
					expect(destination).toBe(linkData);
					completed++;
					done();
				});
			});
		}
	});

	it('should create and read hard link', async done => {
		if (rootFS.supportsLinks()) {
			await configured;
			const srcPath = path.join(common.fixturesDir, 'cycles', 'root.js');
			const dstPath = path.join(common.tmpDir, 'link1.js');

			// Delete previously created link
			try {
				fs.unlinkSync(dstPath);
			} catch (e) {}

			fs.link(srcPath, dstPath, err => {
				if (err) throw err;
				console.log('hard link done');
				const srcContent = fs.readFileSync(srcPath, 'utf8');
				const dstContent = fs.readFileSync(dstPath, 'utf8');
				expect(srcContent).toBe(dstContent);
				completed++;
				done();
			});
		}
	});

	afterAll(() => {
		expect(completed).toBe(expected_tests);
		process.exitCode = 0;
	});
});
