import { backends, fs, configure, tmpDir, fixturesDir } from '../../../common';
import * as path from 'path';
import { promisify } from 'node:util';

describe.each(backends)('%s File Reading', (name, options) => {
	const configured = configure({ fs: name, options });
	it('Cannot read a file with an invalid encoding (synchronous)', async () => {
		await configured;

		let wasThrown = false;
		if (!fs.getRootFS().supportsSynch()) {
			return;
		}

		try {
			fs.readFileSync(path.join(fixturesDir, 'a.js'), 'wrongencoding');
		} catch (e) {
			wasThrown = true;
		}
		expect(wasThrown).toBeTruthy();
	});

	it('Cannot read a file with an invalid encoding (asynchronous)', async () => {
		await configured;
		expect(await promisify<string, string>(fs.readFile)(path.join(fixturesDir, 'a.js'), 'wrongencoding')).toThrow();
	});

	it('Reading past the end of a file should not be an error', async () => {
		await configured;
		const fd = await promisify<string, string, number>(fs.open)(path.join(fixturesDir, 'a.js'), 'r');
		const buffData = Buffer.alloc(10);
		const bytesRead = await promisify(fs.read)(fd, buffData, 0, 10, 10000);
		expect(bytesRead).toBe(0);
	});
});


describe.each(backends)('%s Read and Unlink File Test', (name, options) => {
	const configured = configure({ fs: name, options });
	const dirName = path.resolve(fixturesDir, 'test-readfile-unlink');
	const fileName = path.resolve(dirName, 'test.bin');

	const buf = Buffer.alloc(512);
	buf.fill(42);

	beforeAll(async () => {
		await configured;
		await promisify(fs.mkdir)(dirName);
		await promisify<string, Buffer, void>(fs.writeFile)(fileName, buf);
	});

	it('should read file and verify its content', async () => {
		await configured;
		if (fs.getRootFS().isReadOnly()) {
			return;
		}
		const data: Buffer = await promisify<string, Buffer>(fs.readFile)(fileName);
		expect(data.length).toBe(buf.length);
		expect(data[0]).toBe(42);
	});

	it('should unlink file and remove directory', async () => {
		await configured;
		if (fs.getRootFS().isReadOnly()) {
			return;
		}
		await promisify(fs.unlink)(fileName);
		await promisify(fs.rmdir)(dirName);
	});
});

describe.each(backends)('%s Read File Test', (name, options) => {
	const configured = configure({ fs: name, options });
	const fn = path.join(fixturesDir, 'empty.txt');

	it('should read file asynchronously', async () => {
		await configured;
		const data: Buffer = await promisify<string, Buffer>(fs.readFile)(fn);
		expect(data).toBeDefined();
	});

	it('should read file with utf-8 encoding asynchronously', async () => {
		await configured;
		const data: string = await promisify<string, string, string>(fs.readFile)(fn, 'utf8');
		expect(data).toBe('');
	});

	if (fs.getRootFS().supportsSynch()) {
		it('should read file synchronously', async () => {
			await configured;
			const data: Buffer = fs.readFileSync(fn);
			expect(data).toBeDefined();
		});

		it('should read file with utf-8 encoding synchronously', async () => {
			await configured;
			const data: string = fs.readFileSync(fn, 'utf8');
			expect(data).toBe('');
		});
	}

});