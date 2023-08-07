import { backends, fs, configure } from '../../../common';
import * as path from 'path';
import common from '../../../common';
import { promisify } from 'node:util';

describe.each(backends)('%s File Stat Test', (name, options) => {
	const configured = configure({ fs: name, options });
	let got_error = false;
	let success_count = 0;
	const existing_dir = common.fixturesDir;
	const existing_file = path.join(common.fixturesDir, 'x.txt');

	it('should handle empty file path', async () => {
		await configured;
		try {
			await promisify(fs.stat)('');
		} catch (err) {
			expect(err).toBeTruthy();
			success_count++;
		}
	});

	it('should stat existing directory', async () => {
		await configured;
		try {
			const stats = await promisify(fs.stat)(existing_dir);
			expect(stats.mtime).toBeInstanceOf(Date);
			success_count++;
		} catch (err) {
			got_error = true;
		}
	});

	it('should lstat existing directory', async () => {
		await configured;
		try {
			const stats = await promisify(fs.lstat)(existing_dir);
			expect(stats.mtime).toBeInstanceOf(Date);
			success_count++;
		} catch (err) {
			got_error = true;
		}
	});

	it('should fstat existing file', async () => {
		await configured;
		const fd = await promisify<string, string, number>(fs.open)(existing_file, 'r');
		expect(fd).toBeTruthy();

		try {
			const stats = await promisify(fs.fstat)(fd);
			expect(stats.mtime).toBeInstanceOf(Date);
			success_count++;
		} catch (err) {
			got_error = true;
		} finally {
			await promisify(fs.close)(fd);
		}
	});

	if (fs.getRootFS().supportsSynch()) {
		it('should fstatSync existing file', async () => {
			await configured;
			const fd = await promisify<string, string, number>(fs.open)(existing_file, 'r');
			let stats;

			try {
				stats = fs.fstatSync(fd);
			} catch (e) {
				got_error = true;
			} finally {
				await promisify(fs.close)(fd);
			}

			if (stats) {
				expect(stats.mtime).toBeInstanceOf(Date);
				success_count++;
			}
		});
	}

	it('should stat existing file', async () => {
		await configured;
		try {
			const s = await promisify(fs.stat)(existing_file);
			success_count++;
			expect(s.isDirectory()).toBe(false);
			expect(s.isFile()).toBe(true);
			expect(s.isSocket()).toBe(false);
			//expect(s.isBlockDevice()).toBe(false);
			expect(s.isCharacterDevice()).toBe(false);
			expect(s.isFIFO()).toBe(false);
			expect(s.isSymbolicLink()).toBe(false);
			expect(s.mtime).toBeInstanceOf(Date);
		} catch (err) {
			got_error = true;
		}
	});

	afterAll(() => {
		let expected_success = 5;
		if (fs.getRootFS().supportsSynch()) expected_success++;
		expect(success_count).toBe(expected_success);
		expect(got_error).toBe(false);
		process.exitCode = 0;
	});
});
