import { backends, fs, configure, tmpDir, fixturesDir } from '../../../common';
import * as path from 'path';

describe.each(backends)('%s fs.exists', (name, options) => {
	const configured = configure({ fs: name, options });
	let exists: boolean;
	let doesNotExist: boolean;
	const f = path.join(fixturesDir, 'x.txt');

	beforeAll(() => {
		return new Promise<void>(resolve => {
			fs.exists(f, y => {
				exists = y;
				resolve();
			});
		});
	});

	beforeAll(() => {
		return new Promise<void>(resolve => {
			fs.exists(f + '-NO', y => {
				doesNotExist = y;
				resolve();
			});
		});
	});

	it('should return true for an existing file', async () => {
		await configured;
		expect(exists).toBe(true);
	});

	it('should return false for a non-existent file', async () => {
		await configured;
		expect(doesNotExist).toBe(false);
	});

	if (fs.getRootFS().supportsSynch()) {
		it('should have sync methods that behave the same', async () => {
			await configured;
			expect(fs.existsSync(f)).toBe(true);
			expect(fs.existsSync(f + '-NO')).toBe(false);
		});
	}
});
