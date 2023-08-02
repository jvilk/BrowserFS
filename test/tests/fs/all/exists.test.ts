import { fs } from '../../../common';
import * as path from 'path';
import common from '../../../common';

describe('fs.exists', () => {
	let exists: boolean;
	let doesNotExist: boolean;
	const f = path.join(common.fixturesDir, 'x.txt');

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

	it('should return true for an existing file', () => {
		expect(exists).toBe(true);
	});

	it('should return false for a non-existent file', () => {
		expect(doesNotExist).toBe(false);
	});

	if (fs.getRootFS().supportsSynch()) {
		it('should have sync methods that behave the same', () => {
			expect(fs.existsSync(f)).toBe(true);
			expect(fs.existsSync(f + '-NO')).toBe(false);
		});
	}
});
