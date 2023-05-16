import fs from '../../../../src/core/node_fs';
import * as path from 'path';
import common from '../../../harness/common';

describe('File System Tests', () => {
	let rootFS = fs.getRootFS();

	test('Cannot open a directory (synchronous)', () => {
		let hasThrown = false;
		if (rootFS.supportsSynch()) {
			try {
				fs.openSync(common.fixturesDir, 'r');
			} catch (e) {
				hasThrown = true;
				expect(e.code).toBe('EISDIR');
			}
			expect(hasThrown).toBeTruthy();
		}
	});

	test('Cannot open a directory (asynchronous)', done => {
		fs.open(common.fixturesDir, 'r', (err, fd) => {
			expect(err).toBeTruthy();
			expect(err.code).toBe('EISDIR');
			done();
		});
	});

	if (!rootFS.isReadOnly()) {
		test('Cannot open an existing file exclusively (synchronous)', () => {
			let hasThrown = false;
			if (rootFS.supportsSynch()) {
				try {
					fs.openSync(common.fixturesDir, 'wx');
				} catch (e) {
					hasThrown = true;
					expect(e.code === 'EISDIR' || e.code === 'EEXIST').toBeTruthy();
				}
				expect(hasThrown).toBeTruthy();

				hasThrown = false;
				try {
					fs.openSync(path.join(common.fixturesDir, 'a.js'), 'wx');
				} catch (e) {
					hasThrown = true;
					expect(e.code).toBe('EEXIST');
				}
				expect(hasThrown).toBeTruthy();
			}
		});

		test('Cannot open an existing file exclusively (asynchronous)', done => {
			fs.open(common.fixturesDir, 'wx', (err, fd) => {
				expect(err).toBeTruthy();
				expect(err.code === 'EISDIR' || err.code === 'EEXIST').toBeTruthy();
				done();
			});

			fs.open(path.join(common.fixturesDir, 'a.js'), 'wx', (err, fd) => {
				expect(err).toBeTruthy();
				expect(err.code).toBe('EEXIST');
				done();
			});
		});
	} else {
		test('Cannot write to a read-only file system (synchronous)', () => {
			if (rootFS.supportsSynch()) {
				['a', 'w'].forEach(mode => {
					let hasThrown = false;
					try {
						fs.openSync(path.join(common.fixturesDir, 'a.js'), mode);
					} catch (e) {
						hasThrown = true;
						expect(e.code).toBe('EPERM');
					}
					expect(hasThrown).toBeTruthy();
				});
			}
		});

		test('Cannot write to a read-only file system (asynchronous)', done => {
			const testModes = ['a', 'w'];
			let count = 0;

			const checkDone = () => {
				count++;
				if (count === testModes.length) {
					done();
				}
			};

			testModes.forEach(mode => {
				fs.open(path.join(common.fixturesDir, 'a.js'), mode, (err, fd) => {
					expect(err).toBeTruthy();
					expect(err.code).toBe('EPERM');
					checkDone();
				});
			});
		});
	}
});
