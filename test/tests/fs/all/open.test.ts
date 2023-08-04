import { backends, fs, configure } from '../../../common';
import path from 'path';
import common from '../../../common';

describe.each(backends)('%s fs file opening', (name, options) => {
	const configured = configure({ fs: name, options });
	const filename = path.join(common.fixturesDir, 'a.js');

	it('should throw ENOENT when opening non-existent file (sync)', async () => {
		await configured;
		let caughtException = false;
		const rootFS = fs.getRootFS();
		if (rootFS.supportsSynch()) {
			try {
				fs.openSync('/path/to/file/that/does/not/exist', 'r');
			} catch (e) {
				expect(e.code).toBe('ENOENT');
				caughtException = true;
			}
			expect(caughtException).toBeTruthy();
		}
	});

	it('should throw ENOENT when opening non-existent file (async)', async done => {
		await configured;
		fs.open('/path/to/file/that/does/not/exist', 'r', err => {
			expect(err).not.toBeNull();
			expect(err.code).toBe('ENOENT');
			done();
		});
	});

	it('should open file with mode "r"', async done => {
		await configured;
		fs.open(filename, 'r', (err, fd) => {
			if (err) throw err;
			expect(fd).toBeTruthy();
			done();
		});
	});

	it('should open file with mode "rs"', async done => {
		await configured;
		fs.open(filename, 'rs', (err, fd) => {
			if (err) throw err;
			expect(fd).toBeTruthy();
			done();
		});
	});
});
