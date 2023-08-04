import { backends, fs, configure } from '../../../common';
import * as path from 'path';
import common from '../../../common';

describe.each(backends)('%s File Reading', (name, options) => {
	const configured = configure({ fs: name, options });
	test('Read a file and check its binary bytes (asynchronous)', done => {
		fs.readFile(path.join(common.fixturesDir, 'elipses.txt'), (err, buff) => {
			if (err) throw err;
			expect(buff.readUInt16LE(0)).toBe(32994);
			done();
		});
	});

	test('Read a file and check its binary bytes (synchronous)', () => {
		const rootFS = fs.getRootFS();
		if (rootFS.supportsSynch()) {
			const buff = fs.readFileSync(path.join(common.fixturesDir, 'elipses.txt'));
			expect(buff.readUInt16LE(0)).toBe(32994);
		}
	});
});
