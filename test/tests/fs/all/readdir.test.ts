import fs from '../../../../src/core/node_fs';
import * as path from 'path';
import common from '../../../harness/common';

describe('Directory Reading', () => {
	test('Cannot call readdir on a file (synchronous)', () => {
		const rootFS = fs.getRootFS();
		let wasThrown = false;
		if (rootFS.supportsSynch()) {
			try {
				fs.readdirSync(path.join(common.fixturesDir, 'a.js'));
			} catch (e) {
				wasThrown = true;
				expect(e.code).toBe('ENOTDIR');
			}
			expect(wasThrown).toBeTruthy();
		}
	});

	test('Cannot call readdir on a non-existent directory (synchronous)', () => {
		const rootFS = fs.getRootFS();
		let wasThrown = false;
		if (rootFS.supportsSynch()) {
			try {
				fs.readdirSync('/does/not/exist');
			} catch (e) {
				wasThrown = true;
				expect(e.code).toBe('ENOENT');
			}
			expect(wasThrown).toBeTruthy();
		}
	});

	test('Cannot call readdir on a file (asynchronous)', done => {
		fs.readdir(path.join(common.fixturesDir, 'a.js'), (err, files) => {
			expect(err).toBeTruthy();
			expect(err.code).toBe('ENOTDIR');
			done();
		});
	});

	test('Cannot call readdir on a non-existent directory (asynchronous)', done => {
		fs.readdir('/does/not/exist', (err, files) => {
			expect(err).toBeTruthy();
			expect(err.code).toBe('ENOENT');
			done();
		});
	});
});
