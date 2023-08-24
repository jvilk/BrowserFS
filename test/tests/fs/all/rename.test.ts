import { backends, fs, configure } from '../../../common';
import * as path from 'path';
import { promisify } from 'node:util';

describe.each(backends)('%s File and Directory Rename Tests', (name, options) => {
	const configured = configure({ fs: name, options });
	let rootFS;
	let isReadOnly;

	beforeAll(() => {
		rootFS = fs.getRootFS();
		isReadOnly = fs.getRootFS().isReadOnly();
	});

	if (isReadOnly) {
		return;
	}

	/**
	 * Creates the following directory structure within the given dir:
	 * - _rename_me
	 *   - lol.txt
	 * - file.dat
	 */
	async function populate_directory(dir) {
		const dir1 = path.resolve(dir, '_rename_me');
		const file1 = path.resolve(dir, 'file.dat');
		const file2 = path.resolve(dir1, 'lol.txt');

		await promisify(fs.mkdir)(dir1);
		await promisify<string, Buffer, void>(fs.writeFile)(file1, Buffer.from('filedata'));
		await promisify<string, Buffer, void>(fs.writeFile)(file2, Buffer.from('lololol'));
	}

	/**
	 * Check that the directory structure created in populate_directory remains.
	 */
	async function check_directory(dir) {
		const dir1 = path.resolve(dir, '_rename_me');
		const file1 = path.resolve(dir, 'file.dat');
		const file2 = path.resolve(dir1, 'lol.txt');

		const contents = await promisify(fs.readdir)(dir);
		expect(contents.length).toBe(2);

		const contentsDir1 = await promisify(fs.readdir)(dir1);
		expect(contentsDir1.length).toBe(1);

		const existsFile1 = await promisify(fs.exists)(file1);
		expect(existsFile1).toBe(true);

		const existsFile2 = await promisify(fs.exists)(file2);
		expect(existsFile2).toBe(true);
	}

	it('Directory Rename', async () => {
		await configured;
		const oldDir = '/rename_test';
		const newDir = '/rename_test2';

		await promisify(fs.mkdir)(oldDir);

		await populate_directory(oldDir);

		await promisify(fs.rename)(oldDir, oldDir);

		await check_directory(oldDir);

		await promisify(fs.mkdir)(newDir);
		await promisify(fs.rmdir)(newDir);
		await promisify(fs.rename)(oldDir, newDir);

		await check_directory(newDir);

		const exists = await promisify(fs.exists)(oldDir);
		expect(exists).toBe(false);

		await promisify(fs.mkdir)(oldDir);
		await populate_directory(oldDir);
		await promisify(fs.rename)(oldDir, path.resolve(newDir, 'newDir'));
	});

	it('File Rename', async () => {
		await configured;
		const fileDir = '/rename_file_test';
		const file1 = path.resolve(fileDir, 'fun.js');
		const file2 = path.resolve(fileDir, 'fun2.js');

		await promisify(fs.mkdir)(fileDir);
		await promisify<string, Buffer, void>(fs.writeFile)(file1, Buffer.from('while(1) alert("Hey! Listen!");'));
		await promisify(fs.rename)(file1, file1);
		await promisify(fs.rename)(file1, file2);

		await promisify<string, Buffer, void>(fs.writeFile)(file1, Buffer.from('hey'));
		await promisify(fs.rename)(file1, file2);

		const contents = await promisify(fs.readFile)(file2);
		expect(contents.toString()).toBe('hey');

		const exists = await promisify(fs.exists)(file1);
		expect(exists).toBe(false);
	});

	it('File to Directory and Directory to File Rename', async () => {
		await configured;
		const dir = '/rename_filedir_test';
		const file = '/rename_filedir_test.txt';

		await promisify(fs.mkdir)(dir);
		await promisify<string, Buffer, void>(fs.writeFile)(file, Buffer.from('file contents go here'));

		try {
			await promisify(fs.rename)(file, dir);
		} catch (e) {
			// Some *native* file systems throw EISDIR, others throw EPERM.... accept both.
			expect(e.code === 'EISDIR' || e.code === 'EPERM').toBe(true);
		}

		// JV: Removing test for now. I noticed that you can do that in Node v0.12 on Mac,
		// but it might be FS independent.
		/*fs.rename(dir, file, function (e) {
		  if (e == null) {
			throw new Error("Failed invariant: Cannot rename a directory over a file.");
		  } else {
			assert(e.code === 'ENOTDIR');
		  }
		});*/
	});

	it('Cannot Rename a Directory Inside Itself', async () => {
		await configured;
		const renDir1 = '/renamedir_1';
		const renDir2 = '/renamedir_1/lol';

		await promisify(fs.mkdir)(renDir1);

		try {
			await promisify(fs.rename)(renDir1, renDir2);
		} catch (e) {
			expect(e.code).toBe('EBUSY');
		}
	});
});
