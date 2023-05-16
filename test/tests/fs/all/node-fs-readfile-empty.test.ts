import fs from '../../../../src/core/node_fs';
import * as path from 'path';
import common from '../../../harness/common';

describe('Read File Test', () => {
	const fn = path.join(common.fixturesDir, 'empty.txt');
	const rootFS = fs.getRootFS();

	it('should read file asynchronously', done => {
		fs.readFile(fn, (err: NodeJS.ErrnoException, data: Buffer) => {
			expect(data).toBeDefined();
			done();
		});
	});

	it('should read file with utf-8 encoding asynchronously', done => {
		fs.readFile(fn, 'utf8', (err: NodeJS.ErrnoException, data: string) => {
			expect(data).toBe('');
			done();
		});
	});

	if (rootFS.supportsSynch()) {
		it('should read file synchronously', () => {
			expect(fs.readFileSync(fn)).toBeDefined();
		});

		it('should read file with utf-8 encoding synchronously', () => {
			expect(fs.readFileSync(fn, 'utf8')).toBe('');
		});
	}

	afterAll(() => {
		process.exitCode = 0;
	});
});
