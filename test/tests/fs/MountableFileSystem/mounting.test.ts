import { fs, configure } from '../../../common';
import * as BrowserFS from '../../../../src/core/browserfs';
import Cred from '../../../../src/core/cred';
import { promisify } from 'node:util';
import type { MountableFileSystem } from '../../../../src/core/backends';

describe('MountableFileSystem Mount/Unmount', () => {
	let mfs: MountableFileSystem;

	beforeAll(async () => {
		mfs = (await configure({ fs: 'MountableFileSystem' })) as MountableFileSystem;
	});

	it('Mount and Unmount Features', async () => {
		const rootForMfs = await BrowserFS.backends.InMemory.Create({});

		if (!rootForMfs) {
			throw new Error('Could not create rootForMfs.');
		}

		BrowserFS.initialize(rootForMfs);
		fs.mkdirSync('/home');
		fs.mkdirSync('/home/anotherFolder');

		await mfs.mount('/root', rootForMfs);
		await mfs.mount('/root/home/secondRoot', rootForMfs);
		await mfs.mount('/root/anotherRoot', rootForMfs);

		expect(fs.realpathSync('/root/anotherRoot')).toBe('/root/anotherRoot');
		expect(await promisify(fs.realpath)('/root/anotherRoot')).toBe('/root/anotherRoot');
		expect(fs.readdirSync('/')[0]).toBe('root');

		const expectedHomeListing = ['anotherFolder', 'secondRoot'];
		expect(fs.readdirSync('/root/home').sort()).toEqual(expectedHomeListing);

		const files = await promisify(fs.readdir)('/root/home');
		expect(files.sort()).toEqual(expectedHomeListing);

		expect(fs.rmdirSync('/root/home/secondRoot')).toThrow();

		await expect(promisify(fs.rmdir)('/root/home/secondRoot')).rejects.toThrow();

		expect(fs.statSync('/root/home').isDirectory()).toBe(true);

		expect(fs.renameSync('/root/home/secondRoot', '/root/home/anotherFolder')).toThrow();

		await expect(promisify(fs.rename)('/root/home/secondRoot', '/root/home/anotherFolder')).rejects.toThrow();

		fs.rmdirSync('/root/home/anotherFolder');

		expect(fs.rmdirSync('/root/home')).toThrow();

		await expect(promisify(fs.rmdir)('/root/home')).rejects.toThrow();

		expect(fs.readdirSync('/root').sort()).toEqual(['anotherRoot', 'home']);

		const newRoot = await BrowserFS.backends.InMemory.Create({});
		if (!newRoot) {
			throw new Error('Could not create newRoot.');
		}

		await mfs.mount('/', newRoot);
		fs.mkdirSync('/home2');
		expect(fs.existsSync('/home2')).toBe(true);
		expect(mfs.existsSync('/home2', Cred.Root)).toBe(true);
		expect(fs.existsSync('/root')).toBe(true);
		mfs.umount('/');
		expect(fs.existsSync('/home2')).toBe(false);
	});
});
