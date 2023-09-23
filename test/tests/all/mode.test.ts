import { backends, fs, configure } from '../../common';
import * as path from 'path';
import { promisify } from 'node:util';

describe.each(backends)('%s PermissionsTest', (name, options) => {
	const configured = configure({ fs: name, options });
	const testFileContents = Buffer.from('this is a test file, plz ignore.');

	function is_writable(mode: number) {
		return (mode & 146) > 0;
	}

	function is_readable(mode: number) {
		return (mode & 0x124) > 0;
	}

	function is_executable(mode: number) {
		return (mode & 0x49) > 0;
	}

	async function process_file(p: string, fileMode: number): Promise<void> {
		const readFileAsync = promisify(fs.readFile);
		const openAsync = promisify<string, string, number>(fs.open);
		const closeAsync = promisify(fs.close);

		try {
			const data = await readFileAsync(p);
			// Invariant 2: We can only read a file if we have read permissions on the file.
			expect(is_readable(fileMode)).toBe(true);
		} catch (err) {
			if (err.code === 'EPERM') {
				// Invariant 2: We can only read a file if we have read permissions on the file.
				expect(is_readable(fileMode)).toBe(false);
			} else {
				throw err;
			}
		}

		try {
			const fd = await openAsync(p, 'a');
			// Invariant 3: We can only write to a file if we have write permissions on the file.
			expect(is_writable(fileMode)).toBe(true);
			await closeAsync(fd);
		} catch (err) {
			if (err.code === 'EPERM') {
				// Invariant 3: We can only write to a file if we have write permissions on the file.
				expect(is_writable(fileMode)).toBe(false);
			} else {
				throw err;
			}
		}
	}

	async function process_directory(p: string, dirMode: number): Promise<void> {
		const readdirAsync = promisify(fs.readdir);
		const writeFileAsync = promisify<string, Buffer, void>(fs.writeFile);
		const unlinkAsync = promisify(fs.unlink);

		try {
			const dirs = await readdirAsync(p);
			// Invariant 2: We can only readdir if we have read permissions on the directory.
			expect(is_readable(dirMode)).toBe(true);

			const promises = dirs.map(async dir => {
				const itemPath = path.resolve(p, dir);
				await process_item(itemPath, dirMode);
			});

			await Promise.all(promises);

			// Try to write a file into the directory.
			const testFile = path.resolve(p, '__test_file_plz_ignore.txt');
			await writeFileAsync(testFile, testFileContents);
			// Clean up.
			await unlinkAsync(testFile);
		} catch (err) {
			if (err.code === 'EPERM') {
				// Invariant 2: We can only readdir if we have read permissions on the directory.
				expect(is_readable(dirMode)).toBe(false);
				// Invariant 3: We can only write to a new file if we have write permissions in the directory.
				expect(is_writable(dirMode)).toBe(false);
			} else {
				throw err;
			}
		}
	}

	async function process_item(p: string, parentMode: number): Promise<void> {
		const statAsync = promisify(fs.stat);

		const isReadOnly = fs.getMount('/').metadata.readonly;

		try {
			const stat = await statAsync(p);
			// Invariant 4: Ensure we have execute permissions on parent directory.
			expect(is_executable(parentMode)).toBe(true);

			if (isReadOnly) {
				// Invariant 1: RO FS do not support write permissions.
				expect(is_writable(stat.mode)).toBe(false);
			}

			// Invariant 4: Ensure we have execute permissions on parent directory.
			expect(is_executable(parentMode)).toBe(true);

			if (stat.isDirectory()) {
				await process_directory(p, stat.mode);
			} else {
				await process_file(p, stat.mode);
			}
		} catch (err) {
			if (err.code === 'EPERM') {
				// Invariant 4: Ensure we do not have execute permissions on parent directory.
				expect(is_executable(parentMode)).toBe(false);
			} else {
				throw err;
			}
		}
	}

	it('should satisfy the permissions invariants', async () => {
		await configured;
		await process_item('/', 0o777);
	});
});
