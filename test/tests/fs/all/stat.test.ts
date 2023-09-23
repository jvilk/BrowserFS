import { backends, fs, configure, fixturesDir } from '../../../common';
import * as path from 'path';
import { promisify } from 'node:util';

describe.each(backends)('%s File Stat Test', (name, options) => {
	const configured = configure({ fs: name, options });
	const existing_dir = fixturesDir;
	const existing_file = path.join(fixturesDir, 'x.txt');

	it('should handle empty file path', async () => {
		await configured;
		try {
			await promisify(fs.stat)('');
		} catch (err) {
			expect(err).toBeTruthy();
		}
	});

	it('should stat existing directory', async () => {
		await configured;
		const stats = await promisify(fs.stat)(existing_dir);
		expect(stats.mtime).toBeInstanceOf(Date);
	});

	it('should lstat existing directory', async () => {
		await configured;
		const stats = await promisify(fs.lstat)(existing_dir);
		expect(stats.mtime).toBeInstanceOf(Date);
	});

	it('should fstat existing file', async () => {
		await configured;
		const fd = await promisify<string, string, number>(fs.open)(existing_file, 'r');
		expect(fd).toBeTruthy();

		const stats = await promisify(fs.fstat)(fd);
		expect(stats.mtime).toBeInstanceOf(Date);
		await promisify(fs.close)(fd);
	});

	if (fs.getMount('/').metadata.synchronous) {
		it('should fstatSync existing file', async () => {
			await configured;
			const fd = await promisify<string, string, number>(fs.open)(existing_file, 'r');
			const stats = fs.fstatSync(fd);
			expect(stats.mtime).toBeInstanceOf(Date);
			await promisify(fs.close)(fd);
		});
	}

	it('should stat existing file', async () => {
		await configured;
		const s = await promisify(fs.stat)(existing_file);
		expect(s.isDirectory()).toBe(false);
		expect(s.isFile()).toBe(true);
		expect(s.isSocket()).toBe(false);
		//expect(s.isBlockDevice()).toBe(false);
		expect(s.isCharacterDevice()).toBe(false);
		expect(s.isFIFO()).toBe(false);
		expect(s.isSymbolicLink()).toBe(false);
		expect(s.mtime).toBeInstanceOf(Date);
	});
});
