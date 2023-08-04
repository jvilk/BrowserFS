import { backends, fs, configure } from '../../../common';
import * as path from 'path';
import common from '../../../common';

describe.each(backends)('%s Read File Test', (name, options) => {
	const configured = configure({ fs: name, options });
	const fn = path.join(common.fixturesDir, 'empty.txt');
	const rootFS = fs.getRootFS();

	it('should read file asynchronously', async done => {
		await configured;
		fs.readFile(fn, (err: NodeJS.ErrnoException, data: Buffer) => {
			expect(data).toBeDefined();
			done();
		});
	});

	it('should read file with utf-8 encoding asynchronously', async done => {
		await configured;
		fs.readFile(fn, 'utf8', (err: NodeJS.ErrnoException, data: string) => {
			expect(data).toBe('');
			done();
		});
	});

	if (rootFS.supportsSynch()) {
		it('should read file synchronously', async () => {
			await configured;
			expect(fs.readFileSync(fn)).toBeDefined();
		});

		it('should read file with utf-8 encoding synchronously', async () => {
			await configured;
			expect(fs.readFileSync(fn, 'utf8')).toBe('');
		});
	}

	afterAll(() => {
		process.exitCode = 0;
	});
});
