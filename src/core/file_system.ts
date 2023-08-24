/* eslint-disable @typescript-eslint/no-unused-vars */
// disable no-unused-vars since BaseFileSystem uses them a lot

import { ApiError, ErrorCode } from './api_error';
import Stats from './stats';
import { File } from './file';
import { FileFlag, ActionType } from './file_flag';
import * as path from 'path';
import { fail } from './util';
import Cred from './cred';
import { Buffer } from 'buffer';

export type BFSOneArgCallback = (e?: ApiError | null) => unknown;
export type BFSCallback<T> = (e: ApiError | null | undefined, rv?: T) => unknown;
export type BFSThreeArgCallback<T, U> = (e: ApiError | null | undefined, arg1?: T, arg2?: U) => unknown;

export type FileContents = Buffer | string;

export type DiskSpaceCB = (total: number, free: number) => unknown;

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
export interface FileSystem {
	/**
	 * **Optional**: Returns the name of the file system.
	 */
	getName(): string;
	/**
	 * **Optional**: Passes the following information to the callback:
	 *
	 * * Total number of bytes available on this file system.
	 * * number of free bytes available on this file system.
	 *
	 * @todo This info is not available through the Node API. Perhaps we could do a
	 *   polyfill of diskspace.js, or add a new Node API function.
	 * @param path The path to the location that is being queried. Only
	 *   useful for filesystems that support mount points.
	 */
	diskSpace(p: string, cb: DiskSpaceCB): void;
	/**
	 * **Core**: Is this filesystem read-only?
	 * @return True if this FileSystem is inherently read-only.
	 */
	isReadOnly(): boolean;
	/**
	 * **Core**: Does the filesystem support optional symlink/hardlink-related
	 *   commands?
	 * @return True if the FileSystem supports the optional
	 *   symlink/hardlink-related commands.
	 */
	supportsLinks(): boolean;
	/**
	 * **Core**: Does the filesystem support optional property-related commands?
	 * @return True if the FileSystem supports the optional
	 *   property-related commands (permissions, utimes, etc).
	 */
	supportsProps(): boolean;
	/**
	 * **Core**: Does the filesystem support the optional synchronous interface?
	 * @return True if the FileSystem supports synchronous operations.
	 */
	supportsSynch(): boolean;
	// **CORE API METHODS**
	// File or directory operations
	/**
	 * **Core**: Asynchronous access.
	 */
	access(p: string, mode: number, cred: Cred): Promise<void>;
	/**
	 * **Core**: Synchronous access.
	 */
	accessSync(p: string, mode: number, cred: Cred): void;
	/**
	 * **Core**: Asynchronous rename. No arguments other than a possible exception
	 * are given to the completion callback.
	 */
	rename(oldPath: string, newPath: string, cred: Cred): Promise<void>;
	/**
	 * **Core**: Synchronous rename.
	 */
	renameSync(oldPath: string, newPath: string, cred: Cred): void;
	/**
	 * **Core**: Asynchronous `stat` or `lstat`.
	 * @param isLstat True if this is `lstat`, false if this is regular
	 *   `stat`.
	 */
	stat(p: string, isLstat: boolean | null, cred: Cred): Promise<Stats>;
	/**
	 * **Core**: Synchronous `stat` or `lstat`.
	 * @param isLstat True if this is `lstat`, false if this is regular
	 *   `stat`.
	 */
	statSync(p: string, isLstat: boolean | null, cred: Cred): Stats;
	// File operations
	/**
	 * **Core**: Asynchronous file open.
	 * @see http://www.manpagez.com/man/2/open/
	 * @param flags Handles the complexity of the various file
	 *   modes. See its API for more details.
	 * @param mode Mode to use to open the file. Can be ignored if the
	 *   filesystem doesn't support permissions.
	 */
	open(p: string, flag: FileFlag, mode: number, cred: Cred): Promise<File>;
	/**
	 * **Core**: Synchronous file open.
	 * @see http://www.manpagez.com/man/2/open/
	 * @param flags Handles the complexity of the various file
	 *   modes. See its API for more details.
	 * @param mode Mode to use to open the file. Can be ignored if the
	 *   filesystem doesn't support permissions.
	 */
	openSync(p: string, flag: FileFlag, mode: number, cred: Cred): File;
	/**
	 * **Core**: Asynchronous `unlink`.
	 */
	unlink(p: string, cred: Cred): Promise<void>;
	/**
	 * **Core**: Synchronous `unlink`.
	 */
	unlinkSync(p: string, cred: Cred): void;
	// Directory operations
	/**
	 * **Core**: Asynchronous `rmdir`.
	 */
	rmdir(p: string, cred: Cred): Promise<void>;
	/**
	 * **Core**: Synchronous `rmdir`.
	 */
	rmdirSync(p: string, cred: Cred): void;
	/**
	 * **Core**: Asynchronous `mkdir`.
	 * @param mode Mode to make the directory using. Can be ignored if
	 *   the filesystem doesn't support permissions.
	 */
	mkdir(p: string, mode: number, cred: Cred): Promise<void>;
	/**
	 * **Core**: Synchronous `mkdir`.
	 * @param mode Mode to make the directory using. Can be ignored if
	 *   the filesystem doesn't support permissions.
	 */
	mkdirSync(p: string, mode: number, cred: Cred): void;
	/**
	 * **Core**: Asynchronous `readdir`. Reads the contents of a directory.
	 *
	 * The callback gets two arguments `(err, files)` where `files` is an array of
	 * the names of the files in the directory excluding `'.'` and `'..'`.
	 */
	readdir(p: string, cred: Cred): Promise<string[]>;
	/**
	 * **Core**: Synchronous `readdir`. Reads the contents of a directory.
	 */
	readdirSync(p: string, cred: Cred): string[];
	// **SUPPLEMENTAL INTERFACE METHODS**
	// File or directory operations
	/**
	 * **Supplemental**: Test whether or not the given path exists by checking with
	 * the file system. Then call the callback argument with either true or false.
	 */
	exists(p: string, cred: Cred): Promise<boolean>;
	/**
	 * **Supplemental**: Test whether or not the given path exists by checking with
	 * the file system.
	 */
	existsSync(p: string, cred: Cred): boolean;
	/**
	 * **Supplemental**: Asynchronous `realpath`. The callback gets two arguments
	 * `(err, resolvedPath)`.
	 *
	 * Note that the Node API will resolve `path` to an absolute path.
	 * @param cache An object literal of mapped paths that can be used to
	 *   force a specific path resolution or avoid additional `fs.stat` calls for
	 *   known real paths. If not supplied by the user, it'll be an empty object.
	 */
	realpath(p: string, cache: { [path: string]: string }, cred: Cred): Promise<string>;
	/**
	 * **Supplemental**: Synchronous `realpath`.
	 *
	 * Note that the Node API will resolve `path` to an absolute path.
	 * @param cache An object literal of mapped paths that can be used to
	 *   force a specific path resolution or avoid additional `fs.stat` calls for
	 *   known real paths. If not supplied by the user, it'll be an empty object.
	 */
	realpathSync(p: string, cache: { [path: string]: string }, cred: Cred): string;
	// File operations
	/**
	 * **Supplemental**: Asynchronous `truncate`.
	 */
	truncate(p: string, len: number, cred: Cred): Promise<void>;
	/**
	 * **Supplemental**: Synchronous `truncate`.
	 */
	truncateSync(p: string, len: number, cred: Cred): void;
	/**
	 * **Supplemental**: Asynchronously reads the entire contents of a file.
	 * @param encoding If non-null, the file's contents should be decoded
	 *   into a string using that encoding. Otherwise, if encoding is null, fetch
	 *   the file's contents as a Buffer.
	 * If no encoding is specified, then the raw buffer is returned.
	 */
	readFile(fname: string, encoding: BufferEncoding | null, flag: FileFlag, cred: Cred): Promise<FileContents>;
	/**
	 * **Supplemental**: Synchronously reads the entire contents of a file.
	 * @param encoding If non-null, the file's contents should be decoded
	 *   into a string using that encoding. Otherwise, if encoding is null, fetch
	 *   the file's contents as a Buffer.
	 */
	readFileSync(fname: string, encoding: BufferEncoding | null, flag: FileFlag, cred: Cred): FileContents;
	/**
	 * **Supplemental**: Asynchronously writes data to a file, replacing the file
	 * if it already exists.
	 *
	 * The encoding option is ignored if data is a buffer.
	 */
	writeFile(fname: string, data: FileContents, encoding: BufferEncoding | null, flag: FileFlag, mode: number, cred: Cred): Promise<void>;
	/**
	 * **Supplemental**: Synchronously writes data to a file, replacing the file
	 * if it already exists.
	 *
	 * The encoding option is ignored if data is a buffer.
	 */
	writeFileSync(fname: string, data: FileContents, encoding: BufferEncoding | null, flag: FileFlag, mode: number, cred: Cred): void;
	/**
	 * **Supplemental**: Asynchronously append data to a file, creating the file if
	 * it not yet exists.
	 */
	appendFile(fname: string, data: FileContents, encoding: BufferEncoding | null, flag: FileFlag, mode: number, cred: Cred): Promise<void>;
	/**
	 * **Supplemental**: Synchronously append data to a file, creating the file if
	 * it not yet exists.
	 */
	appendFileSync(fname: string, data: FileContents, encoding: BufferEncoding | null, flag: FileFlag, mode: number, cred: Cred): void;
	// **OPTIONAL INTERFACE METHODS**
	// Property operations
	// This isn't always possible on some filesystem types (e.g. Dropbox).
	/**
	 * **Optional**: Asynchronous `chmod` or `lchmod`.
	 * @param isLchmod `True` if `lchmod`, false if `chmod`. Has no
	 *   bearing on result if links aren't supported.
	 */
	chmod(p: string, isLchmod: boolean, mode: number, cred: Cred): Promise<void>;
	/**
	 * **Optional**: Synchronous `chmod` or `lchmod`.
	 * @param isLchmod `True` if `lchmod`, false if `chmod`. Has no
	 *   bearing on result if links aren't supported.
	 */
	chmodSync(p: string, isLchmod: boolean, mode: number, cred: Cred): void;
	/**
	 * **Optional**: Asynchronous `chown` or `lchown`.
	 * @param isLchown `True` if `lchown`, false if `chown`. Has no
	 *   bearing on result if links aren't supported.
	 */
	chown(p: string, isLchown: boolean, new_uid: number, new_gid: number, cred: Cred): Promise<void>;
	/**
	 * **Optional**: Synchronous `chown` or `lchown`.
	 * @param isLchown `True` if `lchown`, false if `chown`. Has no
	 *   bearing on result if links aren't supported.
	 */
	chownSync(p: string, isLchown: boolean, new_uid: number, new_gid: number, cred: Cred): void;
	/**
	 * **Optional**: Change file timestamps of the file referenced by the supplied
	 * path.
	 */
	utimes(p: string, atime: Date, mtime: Date, cred: Cred): Promise<void>;
	/**
	 * **Optional**: Change file timestamps of the file referenced by the supplied
	 * path.
	 */
	utimesSync(p: string, atime: Date, mtime: Date, cred: Cred): void;
	// Symlink operations
	// Symlinks aren't always supported.
	/**
	 * **Optional**: Asynchronous `link`.
	 */
	link(srcpath: string, dstpath: string, cred: Cred): Promise<void>;
	/**
	 * **Optional**: Synchronous `link`.
	 */
	linkSync(srcpath: string, dstpath: string, cred: Cred): void;
	/**
	 * **Optional**: Asynchronous `symlink`.
	 * @param type can be either `'dir'` or `'file'`
	 */
	symlink(srcpath: string, dstpath: string, type: string, cred: Cred): Promise<void>;
	/**
	 * **Optional**: Synchronous `symlink`.
	 * @param type can be either `'dir'` or `'file'`
	 */
	symlinkSync(srcpath: string, dstpath: string, type: string, cred: Cred): void;
	/**
	 * **Optional**: Asynchronous readlink.
	 */
	readlink(p: string, cred: Cred): Promise<string>;
	/**
	 * **Optional**: Synchronous readlink.
	 */
	readlinkSync(p: string, cred: Cred): string;
}

export interface FileSystemConstructor {
	new (): FileSystem;
}

/**
 * Basic filesystem class. Most filesystems should extend this class, as it
 * provides default implementations for a handful of methods.
 */
export class BaseFileSystem implements FileSystem {
	getName() {
		return 'BaseFileSystem';
	}

	isReadOnly() {
		return false;
	}

	supportsProps() {
		return false;
	}

	supportsSynch() {
		return false;
	}

	public supportsLinks(): boolean {
		return false;
	}

	public diskSpace(p: string, cb: DiskSpaceCB): void {
		cb(0, 0);
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
			const stats = await this.stat(p, false, cred);
			switch (flag.pathExistsAction()) {
				case ActionType.THROW_EXCEPTION:
					throw ApiError.EEXIST(p);
				case ActionType.TRUNCATE_FILE:
					// NOTE: In a previous implementation, we deleted the file and
					// re-created it. However, this created a race condition if another
					// asynchronous request was trying to read the file, as the file
					// would not exist for a small period of time.
					const fd = await this.openFile(p, flag, cred);
					if (!fd) fail();

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
					const parentStats = await this.stat(path.dirname(p), false, cred);
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
	public async stat(p: string, isLstat: boolean | null, cred: Cred): Promise<Stats> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public statSync(p: string, isLstat: boolean | null, cred: Cred): Stats {
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
			stats = this.statSync(p, false, cred);
		} catch (e) {
			// File does not exist.
			switch (flag.pathNotExistsAction()) {
				case ActionType.CREATE_FILE:
					// Ensure parent exists.
					const parentStats = this.statSync(path.dirname(p), false, cred);
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
			await this.stat(p, null, cred);
			return true;
		} catch (e) {
			return false;
		}
	}
	public existsSync(p: string, cred: Cred): boolean {
		try {
			this.statSync(p, true, cred);
			return true;
		} catch (e) {
			return false;
		}
	}
	public async realpath(p: string, cache: { [path: string]: string }, cred: Cred): Promise<string> {
		if (this.supportsLinks()) {
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
	public realpathSync(p: string, cache: { [path: string]: string }, cred: Cred): string {
		if (this.supportsLinks()) {
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
	public async chmod(p: string, isLchmod: boolean, mode: number, cred: Cred): Promise<void> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public chmodSync(p: string, isLchmod: boolean, mode: number, cred: Cred) {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public async chown(p: string, isLchown: boolean, new_uid: number, new_gid: number, cred: Cred): Promise<void> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public chownSync(p: string, isLchown: boolean, new_uid: number, new_gid: number, cred: Cred): void {
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
 * @class SynchronousFileSystem
 */
export class SynchronousFileSystem extends BaseFileSystem {
	public supportsSynch(): boolean {
		return true;
	}

	public async access(p: string, mode: number, cred: Cred): Promise<void> {
		return this.accessSync(p, mode, cred);
	}

	public async rename(oldPath: string, newPath: string, cred: Cred): Promise<void> {
		return this.renameSync(oldPath, newPath, cred);
	}

	public async stat(p: string, isLstat: boolean | null, cred: Cred): Promise<Stats> {
		return this.statSync(p, isLstat, cred);
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

	public async chmod(p: string, isLchmod: boolean, mode: number, cred: Cred): Promise<void> {
		return this.chmodSync(p, isLchmod, mode, cred);
	}

	public async chown(p: string, isLchown: boolean, new_uid: number, new_gid: number, cred: Cred): Promise<void> {
		return this.chownSync(p, isLchown, new_uid, new_gid, cred);
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
