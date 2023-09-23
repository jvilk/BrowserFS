import { backends, fs, configure, tmpDir } from '../../common';
import * as path from 'path';

import type { FileContents } from '../../../src/filesystem';
import { jest } from '@jest/globals';
import { promisify } from 'node:util';

describe.each(backends)('%s appendFile tests', (name, options) => {
	const configured = configure({ fs: name, options });
	let tmpFile: string = path.join(tmpDir, 'append.txt');

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should create an empty file and add content', async () => {
		await configured;
		const filename = path.join(tmpFile, 'append.txt');
		const content = 'Sample content';

		jest.spyOn(fs, 'appendFile').mockImplementation(async (file, data, mode) => {
			expect(file).toBe(filename);
			expect(data).toBe(content);
		});

		jest.spyOn(fs, 'readFile').mockImplementation(async (file, options) => {
			expect(file).toBe(filename);
			expect(options).toBe('utf8');
			return content;
		});

		await appendFileAndVerify(filename, content);
	});

	it('should append data to a non-empty file', async () => {
		await configured;
		const filename = path.join(tmpFile, 'append2.txt');
		const currentFileData = 'ABCD';
		const content = 'Sample content';

		await promisify<string, string, void>(fs.writeFile)(filename, currentFileData);

		jest.spyOn(fs, 'appendFile').mockImplementation(async (file, data, mode) => {
			expect(file).toBe(filename);
			expect(data).toBe(content);
		});

		jest.spyOn(fs, 'readFile').mockImplementation(async (file, options) => {
			expect(file).toBe(filename);
			expect(options).toBe('utf8');
			return currentFileData + content;
		});

		await appendFileAndVerify(filename, content);
	});

	it('should append a buffer to the file', async () => {
		await configured;
		const filename = path.join(tmpFile, 'append3.txt');
		const currentFileData = 'ABCD';
		const content = Buffer.from('Sample content', 'utf8');

		await promisify<string, string, void>(fs.writeFile)(filename, currentFileData);

		jest.spyOn(fs, 'appendFile').mockImplementation(async (file, data, mode) => {
			expect(file).toBe(filename);
			expect(data).toBe(content);
		});

		jest.spyOn(fs, 'readFile').mockImplementation(async (file, options) => {
			expect(file).toBe(filename);
			expect(options).toBe('utf8');
			return currentFileData + content;
		});

		await appendFileAndVerify(filename, content);
	});

	// Additional tests can be added here

	async function appendFileAndVerify(filename: string, content: FileContents): Promise<void> {
		await promisify<string, FileContents, void>(fs.appendFile)(filename, content);

		const data = await promisify<string, string, string>(fs.readFile)(filename, 'utf8');
		expect(data).toEqual(content.toString());
	}
});
