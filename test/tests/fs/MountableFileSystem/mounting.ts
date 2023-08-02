import { fs } from '../../../common';
import * as BrowserFS from '../../../../src/core/browserfs';

describe('MountableFileSystem Mount/Unmount', () => {
	let oldmfs: BrowserFS.FileSystem;

	beforeAll(() => {
		oldmfs = fs.getRootFS();
	});

	afterAll(() => {
		BrowserFS.initialize(oldmfs);
	});

	test('Mount and Unmount Features', async () => {
		const rootForMfs = await new Promise<BrowserFS.FileSystem | undefined>(resolve => {
			BrowserFS.Backend.InMemory.Create({}, (e, root) => {
				resolve(root);
			});
		});

		if (!rootForMfs) {
			throw new Error('Could not create rootForMfs.');
		}

		BrowserFS.initialize(rootForMfs);
		fs.mkdirSync('/home');
		fs.mkdirSync('/home/anotherFolder');
		const newmfs = await new Promise<BrowserFS.Backend.MountableFileSystem | undefined>(resolve => {
			BrowserFS.Backend.MountableFileSystem.Create({}, (e, newmfs) => {
				resolve(newmfs);
			});
		});

		if (!newmfs) {
			throw new Error('Could not create newmfs.');
		}

		// double mount, for funsies.
		newmfs.mount('/root', rootForMfs);
		// second mount is subdir of subdirectory that already exists in mount point.
		// also stresses our recursive mkdir code.
		newmfs.mount('/root/home/secondRoot', rootForMfs);
		newmfs.mount('/root/anotherRoot', rootForMfs);
		BrowserFS.initialize(newmfs);

		const realPathSyncResult = fs.realpathSync('/root/anotherRoot');
		expect(realPathSyncResult).toBe('/root/anotherRoot');

		fs.realpath('/root/anotherRoot', (err, p) => {
			expect(p).toBe('/root/anotherRoot');
		});

		expect(fs.readdirSync('/')[0]).toBe('root');

		const expectedHomeListing = ['anotherFolder', 'secondRoot'];
		const homeListing = fs.readdirSync('/root/home').sort();

		// Can query folder that contains items and a mount point.
		expect(homeListing).toEqual(expectedHomeListing);

		return new Promise<void>(resolve => {
			fs.readdir('/root/home', (err, files) => {
				expect(err).toBeNull();
				expect(files.sort()).toEqual(expectedHomeListing);

				// Cannot delete a mount point.
				expect(() => fs.rmdirSync('/root/home/secondRoot')).toThrow();

				fs.rmdir('/root/home/secondRoot', err => {
					expect(err).toBeTruthy();
					expect(fs.statSync('/root/home').isDirectory()).toBe(true);

					// Cannot move a mount point.
					expect(() => fs.renameSync('/root/home/secondRoot', '/root/home/anotherFolder')).toThrow();

					fs.rename('/root/home/secondRoot', '/root/home/anotherFolder', err => {
						expect(err).toBeTruthy();

						fs.rmdirSync('/root/home/anotherFolder');

						// Cannot remove parent of mount point, even if empty in owning FS.
						expect(() => fs.rmdirSync('/root/home')).toThrow();

						fs.rmdir('/root/home', err => {
							expect(err).toBeTruthy();

							expect(fs.readdirSync('/root').sort()).toEqual(['anotherRoot', 'home']);

							return new Promise<void>(resolve => {
								BrowserFS.Backend.InMemory.Create({}, (e, newRoot) => {
									if (!newRoot) {
										throw new Error('Could not create newRoot.');
									}
									// Let's confuse things and mount something in '/'.
									newmfs.mount('/', newRoot);
									fs.mkdirSync('/home2');
									expect(fs.existsSync('/home2')).toBe(true);
									expect(newmfs.existsSync('/home2')).toBe(true);
									expect(fs.existsSync('/root')).toBe(true);
									newmfs.umount('/');
									expect(fs.existsSync('/home2')).toBe(false);
									resolve();
								});
							});
						});
					});
				});
				resolve();
			});
		});
	});
});
