/* eslint-disable @typescript-eslint/no-unused-vars */
// disable no-unused-vars since BaseFileSystem uses them a lot

import { ApiError, ErrorCode } from './ApiError';
import { Stats } from './stats';
import { File, FileFlag, ActionType } from './file';
import * as path from 'path';
import { Cred } from './cred';
import { Buffer } from 'buffer';

export type BFSOneArgCallback = (e?: ApiError) => unknown;
export type BFSCallback<T> = (e?: ApiError, rv?: T) => unknown;
export type BFSThreeArgCallback<T, U> = (e?: ApiError, arg1?: T, arg2?: U) => unknown;

export type FileContents = Buffer | string;

/**
 * Metadata about a FileSystem
 */
export interface FileSystemMetadata {
	/**
	 * The name of the FS
	 */
	name: string;

	/**
	 * Wheter the FS is readonly or not
	 */
	readonly: boolean;

	/**
	 * Does the FS support synchronous operations
	 */
	synchronous: boolean;

	/**
	 * Does the FS support properties
	 */
	supportsProperties: boolean;

	/**
	 * Does the FS support links
	 */
	supportsLinks: boolean;

	/**
	 * The total space
	 */
	totalSpace: number;

	/**
	 * The available space
	 */
	freeSpace: number;
}

/**
 * Interface for a filesystem. **All** BrowserFS FileSystems should implement
 * this interface.
 *
 * Below, we denote each API method as **Core**, **Supplemental**, or
 * **Optional**.
 *
 * ### Core Methods
 *
 * **Core** API methods *need* to be implemented for basic read/write
 * functionality.
 *
 * Note that read-only FileSystems can choose to not implement core methods
 * that mutate files or metadata. The default implementation will pass a
 * NOT_SUPPORTED error to the callback.
 *
 * ### Supplemental Methods
 *
 * **Supplemental** API methods do not need to be implemented by a filesystem.
 * The default implementation implements all of the supplemental API methods in
 * terms of the **core** API methods.
 *
 * Note that a file system may choose to implement supplemental methods for
 * efficiency reasons.
 *
 * The code for some supplemental methods was adapted directly from NodeJS's
 * fs.js source code.
 *
 * ### Optional Methods
 *
 * **Optional** API methods provide functionality that may not be available in
 * all filesystems. For example, all symlink/hardlink-related API methods fall
 * under this category.
 *
 * The default implementation will pass a NOT_SUPPORTED error to the callback.
 *
 * ### Argument Assumptions
 *
 * You can assume the following about arguments passed to each API method:
 *
 * * **Every path is an absolute path.** Meaning, `.`, `..`, and other items
 *   are resolved into an absolute form.
 * * **All arguments are present.** Any optional arguments at the Node API level
 *   have been passed in with their default values.
 * * **The callback will reset the stack depth.** When your filesystem calls the
 *   callback with the requested information, it will use `setImmediate` to
 *   reset the JavaScript stack depth before calling the user-supplied callback.
 */
export abstract class FileSystem {
	static readonly Name: string;

	abstract readonly metadata: FileSystemMetadata;

	constructor(options?: object) {
		// unused
	}

	abstract whenReady(): Promise<this>;

	// File or directory operations
	/**
	 * Asynchronous access.
	 */
	abstract access(p: string, mode: number, cred: Cred): Promise<void>;
	/**
	 * Synchronous access.
	 */
	abstract accessSync(p: string, mode: number, cred: Cred): void;
	/**
	 * Asynchronous rename. No arguments other than a possible exception
	 * are given to the completion callback.
	 */
	abstract rename(oldPath: string, newPath: string, cred: Cred): Promise<void>;
	/**
	 * Synchronous rename.
	 */
	abstract renameSync(oldPath: string, newPath: string, cred: Cred): void;
	/**
	 * Asynchronous `stat`.
	 */
	abstract stat(p: string, cred: Cred): Promise<Stats>;
	/**
	 * Synchronous `stat`.
	 */
	abstract statSync(p: string, cred: Cred): Stats;
	// File operations
	/**
	 * Asynchronous file open.
	 * @see http://www.manpagez.com/man/2/open/
	 * @param flags Handles the complexity of the various file
	 *   modes. See its API for more details.
	 * @param mode Mode to use to open the file. Can be ignored if the
	 *   filesystem doesn't support permissions.
	 */
	abstract open(p: string, flag: FileFlag, mode: number, cred: Cred): Promise<File>;
	/**
	 * Synchronous file open.
	 * @see http://www.manpagez.com/man/2/open/
	 * @param flags Handles the complexity of the various file
	 *   modes. See its API for more details.
	 * @param mode Mode to use to open the file. Can be ignored if the
	 *   filesystem doesn't support permissions.
	 */
	abstract openSync(p: string, flag: FileFlag, mode: number, cred: Cred): File;
	/**
	 * Asynchronous `unlink`.
	 */
	abstract unlink(p: string, cred: Cred): Promise<void>;
	/**
	 * Synchronous `unlink`.
	 */
	abstract unlinkSync(p: string, cred: Cred): void;
	// Directory operations
	/**
	 * Asynchronous `rmdir`.
	 */
	abstract rmdir(p: string, cred: Cred): Promise<void>;
	/**
	 * Synchronous `rmdir`.
	 */
	abstract rmdirSync(p: string, cred: Cred): void;
	/**
	 * Asynchronous `mkdir`.
	 * @param mode Mode to make the directory using. Can be ignored if
	 *   the filesystem doesn't support permissions.
	 */
	abstract mkdir(p: string, mode: number, cred: Cred): Promise<void>;
	/**
	 * Synchronous `mkdir`.
	 * @param mode Mode to make the directory using. Can be ignored if
	 *   the filesystem doesn't support permissions.
	 */
	abstract mkdirSync(p: string, mode: number, cred: Cred): void;
	/**
	 * Asynchronous `readdir`. Reads the contents of a directory.
	 *
	 * The callback gets two arguments `(err, files)` where `files` is an array of
	 * the names of the files in the directory excluding `'.'` and `'..'`.
	 */
	abstract readdir(p: string, cred: Cred): Promise<string[]>;
	/**
	 * Synchronous `readdir`. Reads the contents of a directory.
	 */
	abstract readdirSync(p: string, cred: Cred): string[];
	// **SUPPLEMENTAL INTERFACE METHODS**
	// File or directory operations
	/**
	 * Test whether or not the given path exists by checking with
	 * the file system. Then call the callback argument with either true or false.
	 */
	abstract exists(p: string, cred: Cred): Promise<boolean>;
	/**
	 * Test whether or not the given path exists by checking with
	 * the file system.
	 */
	abstract existsSync(p: string, cred: Cred): boolean;
	/**
	 * Asynchronous `realpath`. The callback gets two arguments
	 * `(err, resolvedPath)`.
	 *
	 * Note that the Node API will resolve `path` to an absolute path.
	 * @param cache An object literal of mapped paths that can be used to
	 *   force a specific path resolution or avoid additional `fs.stat` calls for
	 *   known real paths. If not supplied by the user, it'll be an empty object.
	 */
	abstract realpath(p: string, cred: Cred): Promise<string>;
	/**
	 * Synchronous `realpath`.
	 *
	 * Note that the Node API will resolve `path` to an absolute path.
	 * @param cache An object literal of mapped paths that can be used to
	 *   force a specific path resolution or avoid additional `fs.stat` calls for
	 *   known real paths. If not supplied by the user, it'll be an empty object.
	 */
	abstract realpathSync(p: string, cred: Cred): string;
	// File operations
	/**
	 * Asynchronous `truncate`.
	 */
	abstract truncate(p: string, len: number, cred: Cred): Promise<void>;
	/**
	 * Synchronous `truncate`.
	 */
	abstract truncateSync(p: string, len: number, cred: Cred): void;
	/**
	 * Asynchronously reads the entire contents of a file.
	 * @param encoding If non-null, the file's contents should be decoded
	 *   into a string using that encoding. Otherwise, if encoding is null, fetch
	 *   the file's contents as a Buffer.
	 * If no encoding is specified, then the raw buffer is returned.
	 */
	abstract readFile(fname: string, encoding: BufferEncoding | null, flag: FileFlag, cred: Cred): Promise<FileContents>;
	/**
	 * Synchronously reads the entire contents of a file.
	 * @param encoding If non-null, the file's contents should be decoded
	 *   into a string using that encoding. Otherwise, if encoding is null, fetch
	 *   the file's contents as a Buffer.
	 */
	abstract readFileSync(fname: string, encoding: BufferEncoding | null, flag: FileFlag, cred: Cred): FileContents;
	/**
	 * Asynchronously writes data to a file, replacing the file
	 * if it already exists.
	 *
	 * The encoding option is ignored if data is a buffer.
	 */
	abstract writeFile(fname: string, data: FileContents, encoding: BufferEncoding | null, flag: FileFlag, mode: number, cred: Cred): Promise<void>;
	/**
	 * Synchronously writes data to a file, replacing the file
	 * if it already exists.
	 *
	 * The encoding option is ignored if data is a buffer.
	 */
	abstract writeFileSync(fname: string, data: FileContents, encoding: BufferEncoding | null, flag: FileFlag, mode: number, cred: Cred): void;
	/**
	 * Asynchronously append data to a file, creating the file if
	 * it not yet exists.
	 */
	abstract appendFile(fname: string, data: FileContents, encoding: BufferEncoding | null, flag: FileFlag, mode: number, cred: Cred): Promise<void>;
	/**
	 * Synchronously append data to a file, creating the file if
	 * it not yet exists.
	 */
	abstract appendFileSync(fname: string, data: FileContents, encoding: BufferEncoding | null, flag: FileFlag, mode: number, cred: Cred): void;
	// **OPTIONAL INTERFACE METHODS**
	// Property operations
	// This isn't always possible on some filesystem types (e.g. Dropbox).
	/**
	 * Asynchronous `chmod`.
	 */
	abstract chmod(p: string, mode: number, cred: Cred): Promise<void>;
	/**
	 * Synchronous `chmod`.
	 */
	abstract chmodSync(p: string, mode: number, cred: Cred): void;
	/**
	 * Asynchronous `chown`.
	 */
	abstract chown(p: string, new_uid: number, new_gid: number, cred: Cred): Promise<void>;
	/**
	 * Synchronous `chown`.
	 */
	abstract chownSync(p: string, new_uid: number, new_gid: number, cred: Cred): void;
	/**
	 * Change file timestamps of the file referenced by the supplied
	 * path.
	 */
	abstract utimes(p: string, atime: Date, mtime: Date, cred: Cred): Promise<void>;
	/**
	 * Change file timestamps of the file referenced by the supplied
	 * path.
	 */
	abstract utimesSync(p: string, atime: Date, mtime: Date, cred: Cred): void;
	// Symlink operations
	// Symlinks aren't always supported.
	/**
	 * Asynchronous `link`.
	 */
	abstract link(srcpath: string, dstpath: string, cred: Cred): Promise<void>;
	/**
	 * Synchronous `link`.
	 */
	abstract linkSync(srcpath: string, dstpath: string, cred: Cred): void;
	/**
	 * Asynchronous `symlink`.
	 * @param type can be either `'dir'` or `'file'`
	 */
	abstract symlink(srcpath: string, dstpath: string, type: string, cred: Cred): Promise<void>;
	/**
	 * Synchronous `symlink`.
	 * @param type can be either `'dir'` or `'file'`
	 */
	abstract symlinkSync(srcpath: string, dstpath: string, type: string, cred: Cred): void;
	/**
	 * Asynchronous readlink.
	 */
	abstract readlink(p: string, cred: Cred): Promise<string>;
	/**
	 * Synchronous readlink.
	 */
	abstract readlinkSync(p: string, cred: Cred): string;
}

/**
 * Basic filesystem class. Most filesystems should extend this class, as it
 * provides default implementations for a handful of methods.
 */
export class BaseFileSystem extends FileSystem {
	static readonly Name: string = this.name;

	protected _ready: Promise<this> = Promise.resolve(this);

	public constructor(options?: { [key: string]: unknown }) {
		super();
	}

	public get metadata(): FileSystemMetadata {
		return {
			name: this.constructor.name,
			readonly: false,
			synchronous: false,
			supportsProperties: false,
			supportsLinks: false,
			totalSpace: 0,
			freeSpace: 0,
		};
	}

	public whenReady(): Promise<this> {
		return this._ready;
	}

	/**
	 * Opens the file at path p with the given flag. The file must exist.
	 * @param p The path to open.
	 * @param flag The flag to use when opening the file.
	 */
	public async openFile(p: string, flag: FileFlag, cred: Cred): Promise<File> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	/**
	 * Create the file at path p with the given mode. Then, open it with the given
	 * flag.
	 */
	public async createFile(p: string, flag: FileFlag, mode: number, cred: Cred): Promise<File> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public async open(p: string, flag: FileFlag, mode: number, cred: Cred): Promise<File> {
		try {
			const stats = await this.stat(p, cred);
			switch (flag.pathExistsAction()) {
				case ActionType.THROW_EXCEPTION:
					throw ApiError.EEXIST(p);
				case ActionType.TRUNCATE_FILE:
					// NOTE: In a previous implementation, we deleted the file and
					// re-created it. However, this created a race condition if another
					// asynchronous request was trying to read the file, as the file
					// would not exist for a small period of time.
					const fd = await this.openFile(p, flag, cred);
					if (!fd) throw new Error('BFS has reached an impossible code path; please file a bug.');

					await fd.truncate(0);
					await fd.sync();
					return fd;
				case ActionType.NOP:
					return this.openFile(p, flag, cred);
				default:
					throw new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.');
			}
			// File exists.
		} catch (e) {
			// File does not exist.
			switch (flag.pathNotExistsAction()) {
				case ActionType.CREATE_FILE:
					// Ensure parent exists.
					const parentStats = await this.stat(path.dirname(p), cred);
					if (parentStats && !parentStats.isDirectory()) {
						throw ApiError.ENOTDIR(path.dirname(p));
					}
					return this.createFile(p, flag, mode, cred);
				case ActionType.THROW_EXCEPTION:
					throw ApiError.ENOENT(p);
				default:
					throw new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.');
			}
		}
	}
	public async access(p: string, mode: number, cred: Cred): Promise<void> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public accessSync(p: string, mode: number, cred: Cred): void {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public async rename(oldPath: string, newPath: string, cred: Cred): Promise<void> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public renameSync(oldPath: string, newPath: string, cred: Cred): void {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public async stat(p: string, cred: Cred): Promise<Stats> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public statSync(p: string, cred: Cred): Stats {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	/**
	 * Opens the file at path p with the given flag. The file must exist.
	 * @param p The path to open.
	 * @param flag The flag to use when opening the file.
	 * @return A File object corresponding to the opened file.
	 */
	public openFileSync(p: string, flag: FileFlag, cred: Cred): File {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	/**
	 * Create the file at path p with the given mode. Then, open it with the given
	 * flag.
	 */
	public createFileSync(p: string, flag: FileFlag, mode: number, cred: Cred): File {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public openSync(p: string, flag: FileFlag, mode: number, cred: Cred): File {
		// Check if the path exists, and is a file.
		let stats: Stats;
		try {
			stats = this.statSync(p, cred);
		} catch (e) {
			// File does not exist.
			switch (flag.pathNotExistsAction()) {
				case ActionType.CREATE_FILE:
					// Ensure parent exists.
					const parentStats = this.statSync(path.dirname(p), cred);
					if (!parentStats.isDirectory()) {
						throw ApiError.ENOTDIR(path.dirname(p));
					}
					return this.createFileSync(p, flag, mode, cred);
				case ActionType.THROW_EXCEPTION:
					throw ApiError.ENOENT(p);
				default:
					throw new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.');
			}
		}
		if (!stats.hasAccess(mode, cred)) {
			throw ApiError.EACCES(p);
		}

		// File exists.
		switch (flag.pathExistsAction()) {
			case ActionType.THROW_EXCEPTION:
				throw ApiError.EEXIST(p);
			case ActionType.TRUNCATE_FILE:
				// Delete file.
				this.unlinkSync(p, cred);
				// Create file. Use the same mode as the old file.
				// Node itself modifies the ctime when this occurs, so this action
				// will preserve that behavior if the underlying file system
				// supports those properties.
				return this.createFileSync(p, flag, stats.mode, cred);
			case ActionType.NOP:
				return this.openFileSync(p, flag, cred);
			default:
				throw new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.');
		}
	}
	public async unlink(p: string, cred: Cred): Promise<void> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public unlinkSync(p: string, cred: Cred): void {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public async rmdir(p: string, cred: Cred): Promise<void> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public rmdirSync(p: string, cred: Cred): void {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public async mkdir(p: string, mode: number, cred: Cred): Promise<void> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public mkdirSync(p: string, mode: number, cred: Cred): void {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public async readdir(p: string, cred: Cred): Promise<string[]> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public readdirSync(p: string, cred: Cred): string[] {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public async exists(p: string, cred: Cred): Promise<boolean> {
		try {
			await this.stat(p, cred);
			return true;
		} catch (e) {
			return false;
		}
	}
	public existsSync(p: string, cred: Cred): boolean {
		try {
			this.statSync(p, cred);
			return true;
		} catch (e) {
			return false;
		}
	}
	public async realpath(p: string, cred: Cred): Promise<string> {
		if (this.metadata.supportsLinks) {
			// The path could contain symlinks. Split up the path,
			// resolve any symlinks, return the resolved string.
			const splitPath = p.split(path.sep);
			// TODO: Simpler to just pass through file, find sep and such.
			for (let i = 0; i < splitPath.length; i++) {
				const addPaths = splitPath.slice(0, i + 1);
				splitPath[i] = path.join(...addPaths);
			}
			return splitPath.join(path.sep);
		} else {
			// No symlinks. We just need to verify that it exists.
			if (!(await this.exists(p, cred))) {
				throw ApiError.ENOENT(p);
			}
			return p;
		}
	}
	public realpathSync(p: string, cred: Cred): string {
		if (this.metadata.supportsLinks) {
			// The path could contain symlinks. Split up the path,
			// resolve any symlinks, return the resolved string.
			const splitPath = p.split(path.sep);
			// TODO: Simpler to just pass through file, find sep and such.
			for (let i = 0; i < splitPath.length; i++) {
				const addPaths = splitPath.slice(0, i + 1);
				splitPath[i] = path.join(...addPaths);
			}
			return splitPath.join(path.sep);
		} else {
			// No symlinks. We just need to verify that it exists.
			if (this.existsSync(p, cred)) {
				return p;
			} else {
				throw ApiError.ENOENT(p);
			}
		}
	}
	public async truncate(p: string, len: number, cred: Cred): Promise<void> {
		const fd = await this.open(p, FileFlag.getFileFlag('r+'), 0o644, cred);
		try {
			await fd.truncate(len);
		} finally {
			await fd.close();
		}
	}
	public truncateSync(p: string, len: number, cred: Cred): void {
		const fd = this.openSync(p, FileFlag.getFileFlag('r+'), 0o644, cred);
		// Need to safely close FD, regardless of whether or not truncate succeeds.
		try {
			fd.truncateSync(len);
		} finally {
			fd.closeSync();
		}
	}
	public async readFile(fname: string, encoding: BufferEncoding | null, flag: FileFlag, cred: Cred): Promise<FileContents> {
		// Get file.
		const fd = await this.open(fname, flag, 0o644, cred);
		try {
			const stat = await fd.stat();
			// Allocate buffer.
			const buf = Buffer.alloc(stat.size);
			await fd.read(buf, 0, stat.size, 0);
			await fd.close();
			if (encoding === null) {
				return buf;
			}
			return buf.toString(encoding);
		} finally {
			await fd.close();
		}
	}
	public readFileSync(fname: string, encoding: BufferEncoding | null, flag: FileFlag, cred: Cred): FileContents {
		// Get file.
		const fd = this.openSync(fname, flag, 0o644, cred);
		try {
			const stat = fd.statSync();
			// Allocate buffer.
			const buf = Buffer.alloc(stat.size);
			fd.readSync(buf, 0, stat.size, 0);
			fd.closeSync();
			if (encoding === null) {
				return buf;
			}
			return buf.toString(encoding);
		} finally {
			fd.closeSync();
		}
	}
	public async writeFile(fname: string, data: FileContents, encoding: BufferEncoding | null, flag: FileFlag, mode: number, cred: Cred): Promise<void> {
		// Get file.
		const fd = await this.open(fname, flag, mode, cred);
		try {
			if (typeof data === 'string') {
				data = Buffer.from(data, encoding!);
			}
			// Write into file.
			await fd.write(data, 0, data.length, 0);
		} finally {
			await fd.close();
		}
	}
	public writeFileSync(fname: string, data: FileContents, encoding: BufferEncoding | null, flag: FileFlag, mode: number, cred: Cred): void {
		// Get file.
		const fd = this.openSync(fname, flag, mode, cred);
		try {
			if (typeof data === 'string') {
				data = Buffer.from(data, encoding!);
			}
			// Write into file.
			fd.writeSync(data, 0, data.length, 0);
		} finally {
			fd.closeSync();
		}
	}
	public async appendFile(fname: string, data: FileContents, encoding: BufferEncoding | null, flag: FileFlag, mode: number, cred: Cred): Promise<void> {
		const fd = await this.open(fname, flag, mode, cred);
		try {
			if (typeof data === 'string') {
				data = Buffer.from(data, encoding!);
			}
			await fd.write(data, 0, data.length, null);
		} finally {
			await fd.close();
		}
	}
	public appendFileSync(fname: string, data: FileContents, encoding: BufferEncoding | null, flag: FileFlag, mode: number, cred: Cred): void {
		const fd = this.openSync(fname, flag, mode, cred);
		try {
			if (typeof data === 'string') {
				data = Buffer.from(data, encoding!);
			}
			fd.writeSync(data, 0, data.length, null);
		} finally {
			fd.closeSync();
		}
	}
	public async chmod(p: string, mode: number, cred: Cred): Promise<void> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public chmodSync(p: string, mode: number, cred: Cred) {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public async chown(p: string, new_uid: number, new_gid: number, cred: Cred): Promise<void> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public chownSync(p: string, new_uid: number, new_gid: number, cred: Cred): void {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public async utimes(p: string, atime: Date, mtime: Date, cred: Cred): Promise<void> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public utimesSync(p: string, atime: Date, mtime: Date, cred: Cred): void {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public async link(srcpath: string, dstpath: string, cred: Cred): Promise<void> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public linkSync(srcpath: string, dstpath: string, cred: Cred): void {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public async symlink(srcpath: string, dstpath: string, type: string, cred: Cred): Promise<void> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public symlinkSync(srcpath: string, dstpath: string, type: string, cred: Cred): void {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public async readlink(p: string, cred: Cred): Promise<string> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public readlinkSync(p: string, cred: Cred): string {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
}

/**
 * Implements the asynchronous API in terms of the synchronous API.
 */
export class SynchronousFileSystem extends BaseFileSystem {
	public get metadata(): FileSystemMetadata {
		return { ...super.metadata, synchronous: true };
	}

	public async access(p: string, mode: number, cred: Cred): Promise<void> {
		return this.accessSync(p, mode, cred);
	}

	public async rename(oldPath: string, newPath: string, cred: Cred): Promise<void> {
		return this.renameSync(oldPath, newPath, cred);
	}

	public async stat(p: string | null, cred: Cred): Promise<Stats> {
		return this.statSync(p, cred);
	}

	public async open(p: string, flags: FileFlag, mode: number, cred: Cred): Promise<File> {
		return this.openSync(p, flags, mode, cred);
	}

	public async unlink(p: string, cred: Cred): Promise<void> {
		return this.unlinkSync(p, cred);
	}

	public async rmdir(p: string, cred: Cred): Promise<void> {
		return this.rmdirSync(p, cred);
	}

	public async mkdir(p: string, mode: number, cred: Cred): Promise<void> {
		return this.mkdirSync(p, mode, cred);
	}

	public async readdir(p: string, cred: Cred): Promise<string[]> {
		return this.readdirSync(p, cred);
	}

	public async chmod(p: string, mode: number, cred: Cred): Promise<void> {
		return this.chmodSync(p, mode, cred);
	}

	public async chown(p: string, new_uid: number, new_gid: number, cred: Cred): Promise<void> {
		return this.chownSync(p, new_uid, new_gid, cred);
	}

	public async utimes(p: string, atime: Date, mtime: Date, cred: Cred): Promise<void> {
		return this.utimesSync(p, atime, mtime, cred);
	}

	public async link(srcpath: string, dstpath: string, cred: Cred): Promise<void> {
		return this.linkSync(srcpath, dstpath, cred);
	}

	public async symlink(srcpath: string, dstpath: string, type: string, cred: Cred): Promise<void> {
		return this.symlinkSync(srcpath, dstpath, type, cred);
	}

	public async readlink(p: string, cred: Cred): Promise<string> {
		return this.readlinkSync(p, cred);
	}
}
