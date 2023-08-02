import { fs } from '../../../common';
import * as path from 'path';
import common from '../../../common';

describe('Symbolic Link Test', () => {
	let completed = 0;
	const expected_tests = 4;

	// test creating and reading symbolic link
	const linkData = path.join(common.fixturesDir, 'cycles/');
	const linkPath = path.join(common.tmpDir, 'cycles_link');

	const rootFS = fs.getRootFS();
	if (!(rootFS.isReadOnly() || !rootFS.supportsLinks())) {
		beforeAll(done => {
			// Delete previously created link
			fs.unlink(linkPath, err => {
				if (err) throw err;
				console.log('linkData: ' + linkData);
				console.log('linkPath: ' + linkPath);

				fs.symlink(linkData, linkPath, 'junction', err => {
					if (err) throw err;
					completed++;
					done();
				});
			});
		});

		it('should lstat symbolic link', done => {
			fs.lstat(linkPath, (err, stats) => {
				if (err) throw err;
				expect(stats.isSymbolicLink()).toBe(true);
				completed++;
				done();
			});
		});

		it('should readlink symbolic link', done => {
			fs.readlink(linkPath, (err, destination) => {
				if (err) throw err;
				expect(destination).toBe(linkData);
				completed++;
				done();
			});
		});

		it('should unlink symbolic link', done => {
			fs.unlink(linkPath, err => {
				if (err) throw err;
				expect(fs.existsSync(linkPath)).toBe(false);
				expect(fs.existsSync(linkData)).toBe(true);
				completed++;
				done();
			});
		});

		afterAll(() => {
			expect(completed).toBe(expected_tests);
			process.exitCode = 0;
		});
	}
});
