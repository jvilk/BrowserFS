import { type FileSystem, BaseFileSystem } from '../filesystem';
import { InMemoryFileSystem } from './InMemory';
import { ApiError, ErrorCode } from '../ApiError';
import fs from '../node_fs';
import * as path from 'path';
import { mkdirpSync, toPromise } from '../utils';
import Cred from '../cred';
import type { BackendOptions } from '.';

/**
 * Configuration options for the MountableFileSystem backend.
 */
export interface MountableFileSystemOptions {
	// Locations of mount points. Can be empty.
	[mountPoint: string]: FileSystem;
}

/**
 * The MountableFileSystem allows you to mount multiple backend types or
 * multiple instantiations of the same backend into a single file system tree.
 * The file systems do not need to know about each other; all interactions are
 * automatically facilitated through this interface.
 *
 * For example, if a file system is mounted at /mnt/blah, and a request came in
 * for /mnt/blah/foo.txt, the file system would see a request for /foo.txt.
 *
 * You can mount file systems when you configure the file system:
 * ```javascript
 * BrowserFS.configure({
 *   fs: "MountableFileSystem",
 *   options: {
 *     '/data': { fs: 'HTTPRequest', options: { index: "http://mysite.com/files/index.json" } },
 *     '/home': { fs: 'LocalStorage' }
 *   }
 * }, function(e) {
 *
 * });
 * ```
 *
 * For advanced users, you can also mount file systems *after* MFS is constructed:
 * ```javascript
 * BrowserFS.Backend.HTTPRequest.Create({
 *   index: "http://mysite.com/files/index.json"
 * }, function(e, xhrfs) {
 *   BrowserFS.Backend.MountableFileSystem.Create({
 *     '/data': xhrfs
 *   }, function(e, mfs) {
 *     BrowserFS.initialize(mfs);
 *
 *     // Added after-the-fact...
 *     BrowserFS.Backend.LocalStorage.Create(function(e, lsfs) {
 *       mfs.mount('/home', lsfs);
 *     });
 *   });
 * });
 * ```
 *
 * Since MountableFileSystem simply proxies requests to mounted file systems, it supports all of the operations that the mounted file systems support.
 *
 * With no mounted file systems, `MountableFileSystem` acts as a simple `InMemory` filesystem.
 */
export class MountableFileSystem extends BaseFileSystem implements FileSystem {
	public static readonly Name = 'MountableFileSystem';

	public static readonly Options: BackendOptions = {};

	public static async Create(opts: MountableFileSystemOptions): Promise<MountableFileSystem> {
		const imfs = await InMemoryFileSystem.Create({});
		const fs = new MountableFileSystem(imfs);
		for (const mountPoint of Object.keys(opts)) {
			fs.mount(mountPoint, opts[mountPoint]);
		}
		return fs;
	}

	public static isAvailable(): boolean {
		return true;
	}

	private mntMap: { [path: string]: FileSystem };
	// Contains the list of mount points in mntMap, sorted by string length in decreasing order.
	// Ensures that we scan the most specific mount points for a match first, which lets us
	// nest mount points.
	private mountList: string[] = [];
	private rootFs: FileSystem;

	/**
	 * Creates a new, empty MountableFileSystem.
	 */
	private constructor(rootFs: FileSystem) {
		super();
		this.mntMap = {};
		this.rootFs = rootFs;
	}

	/**
	 * Mounts the file system at the given mount point.
	 */
	public mount(mountPoint: string, fs: FileSystem, cred: Cred = Cred.Root): void {
		if (mountPoint[0] !== '/') {
			mountPoint = `/${mountPoint}`;
		}
		mountPoint = path.resolve(mountPoint);
		if (this.mntMap[mountPoint]) {
			throw new ApiError(ErrorCode.EINVAL, 'Mount point ' + mountPoint + ' is already in use.');
		}
		mkdirpSync(mountPoint, 0x1ff, cred, this.rootFs);
		this.mntMap[mountPoint] = fs;
		this.mountList.push(mountPoint);
		this.mountList = this.mountList.sort((a, b) => b.length - a.length);
	}

	public umount(mountPoint: string, cred: Cred = Cred.Root): void {
		if (mountPoint[0] !== '/') {
			mountPoint = `/${mountPoint}`;
		}
		mountPoint = path.resolve(mountPoint);
		if (!this.mntMap[mountPoint]) {
			throw new ApiError(ErrorCode.EINVAL, 'Mount point ' + mountPoint + ' is already unmounted.');
		}
		delete this.mntMap[mountPoint];
		this.mountList.splice(this.mountList.indexOf(mountPoint), 1);

		while (mountPoint !== '/') {
			if (this.rootFs.readdirSync(mountPoint, cred).length === 0) {
				this.rootFs.rmdirSync(mountPoint, cred);
				mountPoint = path.dirname(mountPoint);
			} else {
				break;
			}
		}
	}

	/**
	 * Returns the file system that the path points to.
	 */
	public _getFs(path: string): { fs: FileSystem; path: string; mountPoint: string } {
		const mountList = this.mountList,
			len = mountList.length;
		for (let i = 0; i < len; i++) {
			const mountPoint = mountList[i];
			// We know path is normalized, so it is a substring of the mount point.
			if (mountPoint.length <= path.length && path.indexOf(mountPoint) === 0) {
				path = path.substring(mountPoint.length > 1 ? mountPoint.length : 0);
				if (path === '') {
					path = '/';
				}
				return { fs: this.mntMap[mountPoint], path: path, mountPoint: mountPoint };
			}
		}
		// Query our root file system.
		return { fs: this.rootFs, path: path, mountPoint: '/' };
	}

	// Global information methods

	public getName(): string {
		return MountableFileSystem.Name;
	}

	public diskSpace(path: string, cb: (total: number, free: number) => void): void {
		cb(0, 0);
	}

	public isReadOnly(): boolean {
		return false;
	}

	public supportsLinks(): boolean {
		// I'm not ready for cross-FS links yet.
		return false;
	}

	public supportsProps(): boolean {
		return false;
	}

	public supportsSynch(): boolean {
		return true;
	}

	/**
	 * Fixes up error messages so they mention the mounted file location relative
	 * to the MFS root, not to the particular FS's root.
	 * Mutates the input error, and returns it.
	 */
	public standardizeError(err: ApiError, path: string, realPath: string): ApiError {
		const index = err.message.indexOf(path);
		if (index !== -1) {
			err.message = err.message.substring(0, index) + realPath + err.message.substring(index + path.length);
			err.path = realPath;
		}
		return err;
	}

	// The following methods involve multiple file systems, and thus have custom
	// logic.
	// Note that we go through the Node API to use its robust default argument
	// processing.

	public async rename(oldPath: string, newPath: string, cred: Cred): Promise<void> {
		// Scenario 1: old and new are on same FS.
		const fs1rv = this._getFs(oldPath);
		const fs2rv = this._getFs(newPath);
		if (fs1rv.fs === fs2rv.fs) {
			try {
				return fs1rv.fs.rename(fs1rv.path, fs2rv.path, cred);
			} catch (e) {
				throw this.standardizeError(this.standardizeError(e, fs1rv.path, oldPath), fs2rv.path, newPath);
			}
		}

		// Scenario 2: Different file systems.
		// Read old file, write new file, delete old file.
		const data = await toPromise(fs.readFile)(oldPath);
		await toPromise(fs.writeFile)(newPath, data);
		await toPromise(fs.unlink)(oldPath);
	}

	public renameSync(oldPath: string, newPath: string, cred: Cred): void {
		// Scenario 1: old and new are on same FS.
		const fs1rv = this._getFs(oldPath);
		const fs2rv = this._getFs(newPath);
		if (fs1rv.fs === fs2rv.fs) {
			try {
				return fs1rv.fs.renameSync(fs1rv.path, fs2rv.path, cred);
			} catch (e) {
				this.standardizeError(this.standardizeError(e, fs1rv.path, oldPath), fs2rv.path, newPath);
				throw e;
			}
		}
		// Scenario 2: Different file systems.
		const data = fs.readFileSync(oldPath);
		fs.writeFileSync(newPath, data);
		return fs.unlinkSync(oldPath);
	}

	public readdirSync(p: string, cred: Cred): string[] {
		const fsInfo = this._getFs(p);

		// If null, rootfs did not have the directory
		// (or the target FS is the root fs).
		let rv: string[] | null = null;
		// Mount points are all defined in the root FS.
		// Ensure that we list those, too.
		if (fsInfo.fs !== this.rootFs) {
			try {
				rv = this.rootFs.readdirSync(p, cred);
			} catch (e) {
				// Ignore.
			}
		}

		try {
			const rv2 = fsInfo.fs.readdirSync(fsInfo.path, cred);
			if (rv === null) {
				return rv2;
			} else {
				// Filter out duplicates.
				return rv2.concat(rv.filter(val => rv2.indexOf(val) === -1));
			}
		} catch (e) {
			if (rv === null) {
				throw this.standardizeError(e, fsInfo.path, p);
			} else {
				// The root FS had something.
				return rv;
			}
		}
	}

	public async readdir(p: string, cred: Cred): Promise<string[]> {
		const fsInfo = this._getFs(p);
		try {
			let files = await fsInfo.fs.readdir(fsInfo.path, cred);
			if (fsInfo.fs !== this.rootFs) {
				const rv = this.rootFs.readdirSync(p, cred);
				if (files) {
					// Filter out duplicates.
					files = files.concat(rv.filter(val => files!.indexOf(val) === -1));
				} else {
					files = rv;
				}
			}

			return files;
		} catch (e) {
			throw this.standardizeError(e, fsInfo.path, p);
		}
	}

	public realpathSync(p: string, cache: { [path: string]: string }, cred: Cred): string {
		const fsInfo = this._getFs(p);

		try {
			const mountedPath = fsInfo.fs.realpathSync(fsInfo.path, {}, cred);
			// resolve is there to remove any trailing slash that may be present
			return path.resolve(path.join(fsInfo.mountPoint, mountedPath));
		} catch (e) {
			throw this.standardizeError(e, fsInfo.path, p);
		}
	}

	public async realpath(p: string, cache: { [path: string]: string }, cred: Cred): Promise<string> {
		const fsInfo = this._getFs(p);

		try {
			const rv = await fsInfo.fs.realpath(fsInfo.path, {}, cred);

			return path.resolve(path.join(fsInfo.mountPoint, rv!));
		} catch (e) {
			this.standardizeError(e, fsInfo.path, p);
		}
	}

	public rmdirSync(p: string, cred: Cred): void {
		const fsInfo = this._getFs(p);
		if (this._containsMountPt(p)) {
			throw ApiError.ENOTEMPTY(p);
		}
		try {
			fsInfo.fs.rmdirSync(fsInfo.path, cred);
		} catch (e) {
			throw this.standardizeError(e, fsInfo.path, p);
		}
	}

	public async rmdir(p: string, cred: Cred): Promise<void> {
		const fsInfo = this._getFs(p);
		if (this._containsMountPt(p)) {
			throw ApiError.ENOTEMPTY(p);
		}
		try {
			await fsInfo.fs.rmdir(fsInfo.path, cred);
		} catch (e) {
			throw this.standardizeError(e, fsInfo.path, p);
		}
	}

	/**
	 * Returns true if the given path contains a mount point.
	 */
	private _containsMountPt(p: string): boolean {
		const mountPoints = this.mountList,
			len = mountPoints.length;
		for (let i = 0; i < len; i++) {
			const pt = mountPoints[i];
			if (pt.length >= p.length && pt.slice(0, p.length) === p) {
				return true;
			}
		}
		return false;
	}
}

/**
 * Tricky: Define all of the functions that merely forward arguments to the
 * relevant file system, or return/throw an error.
 * Take advantage of the fact that the *first* argument is always the path, and
 * the *last* is the callback function (if async).
 * @todo Can use numArgs to make proxying more efficient.
 * @hidden
 */
function defineFcn(name: string, isSync: false): (...args: any[]) => Promise<any>;
function defineFcn(name: string, isSync: true): (...args: any[]) => any;
function defineFcn(name: string, isSync: boolean): (...args: any[]) => any | Promise<any> {
	if (isSync) {
		return function (this: MountableFileSystem, ...args: any[]) {
			const path = args[0];
			const rv = this._getFs(path);
			args[0] = rv.path;
			try {
				return (<any>rv.fs)[name](...args);
			} catch (e) {
				this.standardizeError(e, rv.path, path);
				throw e;
			}
		};
	} else {
		return function (this: MountableFileSystem, ...args: any[]) {
			const path = args[0];
			const rv = this._getFs(path);
			args[0] = rv.path;

			try {
				return (<FileSystem>rv.fs)[name](...args);
			} catch (e) {
				throw this.standardizeError(args[0], rv.path, path);
			}
		};
	}
}

/**
 * @hidden
 */
const fsCmds = ['exists', 'unlink', 'readlink', 'stat', 'mkdir', 'truncate', 'open', 'readFile', 'chmod', 'utimes', 'chown', 'writeFile', 'appendFile'];

for (const fn of fsCmds) {
	MountableFileSystem.prototype[fn] = defineFcn(fn, false);
	MountableFileSystem.prototype[fn + 'Sync'] = defineFcn(fn + 'Sync', true);
}
