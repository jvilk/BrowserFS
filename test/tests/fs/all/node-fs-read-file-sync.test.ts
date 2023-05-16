import fs from '../../../../src/core/node_fs';
import path from 'path';
import common from '../../../harness/common';

describe('fs file reading', () => {
	const rootFS = fs.getRootFS();
	const filepath = path.join(common.fixturesDir, 'elipses.txt');

	if (rootFS.supportsSynch()) {
		it('should read file synchronously and verify the content', () => {
			const content = fs.readFileSync(filepath, 'utf8');

			for (let i = 0; i < content.length; i++) {
				expect(content[i]).toBe('\u2026');
			}

			expect(content.length).toBe(10000);
		});
	}
});
