import { backends, fs, configure } from '../../../common';
import * as path from 'path';
import common from '../../../common';
import { promisify } from 'node:util';

describe.each(backends)('%s Directory Reading', (name, options) => {
	const configured = configure({ fs: name, options });

	it('Cannot call readdir on a file (synchronous)', () => {
		let wasThrown = false;
		if (fs.getRootFS().supportsSynch()) {
			try {
				fs.readdirSync(path.join(common.fixturesDir, 'a.js'));
			} catch (e) {
				wasThrown = true;
				expect(e.code).toBe('ENOTDIR');
			}
			expect(wasThrown).toBeTruthy();
		}
	});

	it('Cannot call readdir on a non-existent directory (synchronous)', () => {
		let wasThrown = false;
		if (fs.getRootFS().supportsSynch()) {
			try {
				fs.readdirSync('/does/not/exist');
			} catch (e) {
				wasThrown = true;
				expect(e.code).toBe('ENOENT');
			}
			expect(wasThrown).toBeTruthy();
		}
	});

	it('Cannot call readdir on a file (asynchronous)', async () => {
		await configured;
		try {
			await promisify(fs.readdir)(path.join(common.fixturesDir, 'a.js'));
		} catch (err) {
			expect(err).toBeTruthy();
			expect(err.code).toBe('ENOTDIR');
		}
	});

	it('Cannot call readdir on a non-existent directory (asynchronous)', async () => {
		await configured;
		try {
			await promisify(fs.readdir)('/does/not/exist');
		} catch (err) {
			expect(err).toBeTruthy();
			expect(err.code).toBe('ENOENT');
		}
	});
});
