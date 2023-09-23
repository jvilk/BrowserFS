import { ApiError, ErrorCode } from '../ApiError';
import { FileFlag } from '../file';
import { Stats } from '../stats';
import { assertRoot, normalizePath, cred, getFdForFile, normalizeMode, normalizeOptions, fdMap, fd2file, normalizeTime } from './shared';

/**
 * Synchronous rename.
 * @param oldPath
 * @param newPath
 */
export function renameSync(oldPath: string, newPath: string): void {
	assertRoot().renameSync(normalizePath(oldPath), normalizePath(newPath), cred);
}

/**
 * Test whether or not the given path exists by checking with the file system.
 * @param path
 */
export function existsSync(path: string): boolean {
	try {
		return assertRoot().existsSync(normalizePath(path), cred);
	} catch (e) {
		return false;
	}
}

/**
 * Synchronous `stat`.
 * @param path
 * @returns Stats
 */
export function statSync(path: string): Stats {
	const fs = assertRoot();
	const p = fs.realpathSync(normalizePath(path), cred);
	return fs.statSync(p, cred);
}

/**
 * Synchronous `lstat`.
 * `lstat()` is identical to `stat()`, except that if path is a symbolic link,
 * then the link itself is stat-ed, not the file that it refers to.
 * @param path
 * @return [BrowserFS.node.fs.Stats]
 */
export function lstatSync(path: string): Stats {
	return assertRoot().statSync(normalizePath(path), cred);
}

/**
 * Synchronous `truncate`.
 * @param path
 * @param len
 */
export function truncateSync(path: string, len: number = 0): void {
	if (len < 0) {
		throw new ApiError(ErrorCode.EINVAL);
	}
	return assertRoot().truncateSync(normalizePath(path), len, cred);
}

/**
 * Synchronous `unlink`.
 * @param path
 */
export function unlinkSync(path: string): void {
	return assertRoot().unlinkSync(normalizePath(path), cred);
}

/**
 * Synchronous file open.
 * @see http://www.manpagez.com/man/2/open/
 * @param path
 * @param flags
 * @param mode defaults to `0644`
 * @return [BrowserFS.File]
 */
export function openSync(path: string, flag: string, mode: number | string = 0o644): number {
	return getFdForFile(assertRoot().openSync(normalizePath(path), FileFlag.getFileFlag(flag), normalizeMode(mode, 0o644), cred));
}

/**
 * Synchronously reads the entire contents of a file.
 * @param filename
 * @param options
 * @option options [String] encoding The string encoding for the file contents. Defaults to `null`.
 * @option options [String] flag Defaults to `'r'`.
 * @return [String | BrowserFS.node.Buffer]
 */
export function readFileSync(filename: string, options?: { flag?: string }): Buffer;
export function readFileSync(filename: string, options: { encoding: string; flag?: string }): string;
export function readFileSync(filename: string, encoding: string): string;
export function readFileSync(filename: string, arg2: any = {}): any {
	const options = normalizeOptions(arg2, null, 'r', null);
	const flag = FileFlag.getFileFlag(options.flag);
	if (!flag.isReadable()) {
		throw new ApiError(ErrorCode.EINVAL, 'Flag passed to readFile must allow for reading.');
	}
	return assertRoot().readFileSync(normalizePath(filename), options.encoding, flag, cred);
}

/**
 * Synchronously writes data to a file, replacing the file if it already
 * exists.
 *
 * The encoding option is ignored if data is a buffer.
 * @param filename
 * @param data
 * @param options
 * @option options [String] encoding Defaults to `'utf8'`.
 * @option options [Number] mode Defaults to `0644`.
 * @option options [String] flag Defaults to `'w'`.
 */
export function writeFileSync(filename: string, data: any, options?: { encoding?: string; mode?: number | string; flag?: string }): void;
export function writeFileSync(filename: string, data: any, encoding?: string): void;
export function writeFileSync(filename: string, data: any, arg3?: any): void {
	const options = normalizeOptions(arg3, 'utf8', 'w', 0o644);
	const flag = FileFlag.getFileFlag(options.flag);
	if (!flag.isWriteable()) {
		throw new ApiError(ErrorCode.EINVAL, 'Flag passed to writeFile must allow for writing.');
	}
	return assertRoot().writeFileSync(normalizePath(filename), data, options.encoding, flag, options.mode, cred);
}

/**
 * Asynchronously append data to a file, creating the file if it not yet
 * exists.
 *
 * @example Usage example
 *   fs.appendFile('message.txt', 'data to append', function (err) {
 *     if (err) throw err;
 *     console.log('The "data to append" was appended to file!');
 *   });
 * @param filename
 * @param data
 * @param options
 * @option options [String] encoding Defaults to `'utf8'`.
 * @option options [Number] mode Defaults to `0644`.
 * @option options [String] flag Defaults to `'a'`.
 */
export function appendFileSync(filename: string, data: any, options?: { encoding?: string; mode?: number | string; flag?: string }): void;
export function appendFileSync(filename: string, data: any, encoding?: string): void;
export function appendFileSync(filename: string, data: any, arg3?: any): void {
	const options = normalizeOptions(arg3, 'utf8', 'a', 0o644);
	const flag = FileFlag.getFileFlag(options.flag);
	if (!flag.isAppendable()) {
		throw new ApiError(ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.');
	}
	return assertRoot().appendFileSync(normalizePath(filename), data, options.encoding, flag, options.mode, cred);
}

/**
 * Synchronous `fstat`.
 * `fstat()` is identical to `stat()`, except that the file to be stat-ed is
 * specified by the file descriptor `fd`.
 * @param fd
 * @return [BrowserFS.node.fs.Stats]
 */
export function fstatSync(fd: number): Stats {
	return fd2file(fd).statSync();
}

/**
 * Synchronous close.
 * @param fd
 */
export function closeSync(fd: number): void {
	fd2file(fd).closeSync();
	fdMap.delete(fd);
}

/**
 * Synchronous ftruncate.
 * @param fd
 * @param len
 */
export function ftruncateSync(fd: number, len: number = 0): void {
	const file = fd2file(fd);
	if (len < 0) {
		throw new ApiError(ErrorCode.EINVAL);
	}
	file.truncateSync(len);
}

/**
 * Synchronous fsync.
 * @param fd
 */
export function fsyncSync(fd: number): void {
	fd2file(fd).syncSync();
}

/**
 * Synchronous fdatasync.
 * @param fd
 */
export function fdatasyncSync(fd: number): void {
	fd2file(fd).datasyncSync();
}

/**
 * Write buffer to the file specified by `fd`.
 * Note that it is unsafe to use fs.write multiple times on the same file
 * without waiting for it to return.
 * @param fd
 * @param buffer Buffer containing the data to write to
 *   the file.
 * @param offset Offset in the buffer to start reading data from.
 * @param length The amount of bytes to write to the file.
 * @param position Offset from the beginning of the file where this
 *   data should be written. If position is null, the data will be written at
 *   the current position.
 */
export function writeSync(fd: number, buffer: Buffer, offset: number, length: number, position?: number | null): number;
export function writeSync(fd: number, data: string, position?: number | null, encoding?: BufferEncoding): number;
export function writeSync(fd: number, arg2: any, arg3?: any, arg4?: any, arg5?: any): number {
	let buffer: Buffer,
		offset: number = 0,
		length: number,
		position: number | null;
	if (typeof arg2 === 'string') {
		// Signature 1: (fd, string, [position?, [encoding?]])
		position = typeof arg3 === 'number' ? arg3 : null;
		const encoding = (typeof arg4 === 'string' ? arg4 : 'utf8') as BufferEncoding;
		offset = 0;
		buffer = Buffer.from(arg2, encoding);
		length = buffer.length;
	} else {
		// Signature 2: (fd, buffer, offset, length, position?)
		buffer = arg2;
		offset = arg3;
		length = arg4;
		position = typeof arg5 === 'number' ? arg5 : null;
	}

	const file = fd2file(fd);
	if (position === undefined || position === null) {
		position = file.getPos()!;
	}
	return file.writeSync(buffer, offset, length, position);
}

/**
 * Read data from the file specified by `fd`.
 * @param fd
 * @param buffer The buffer that the data will be
 *   written to.
 * @param offset The offset within the buffer where writing will
 *   start.
 * @param length An integer specifying the number of bytes to read.
 * @param position An integer specifying where to begin reading from
 *   in the file. If position is null, data will be read from the current file
 *   position.
 * @return [Number]
 */
export function readSync(fd: number, length: number, position: number, encoding: BufferEncoding): string;
export function readSync(fd: number, buffer: Buffer, offset: number, length: number, position: number): number;
export function readSync(fd: number, arg2: any, arg3: any, arg4: any, arg5?: any): any {
	let shenanigans = false;
	let buffer: Buffer,
		offset: number,
		length: number,
		position: number,
		encoding: BufferEncoding = 'utf8';
	if (typeof arg2 === 'number') {
		length = arg2;
		position = arg3;
		encoding = arg4;
		offset = 0;
		buffer = Buffer.alloc(length);
		shenanigans = true;
	} else {
		buffer = arg2;
		offset = arg3;
		length = arg4;
		position = arg5;
	}
	const file = fd2file(fd);
	if (position === undefined || position === null) {
		position = file.getPos()!;
	}

	const rv = file.readSync(buffer, offset, length, position);
	if (!shenanigans) {
		return rv;
	} else {
		return [buffer.toString(encoding), rv];
	}
}

/**
 * Synchronous `fchown`.
 * @param fd
 * @param uid
 * @param gid
 */
export function fchownSync(fd: number, uid: number, gid: number): void {
	fd2file(fd).chownSync(uid, gid);
}

/**
 * Synchronous `fchmod`.
 * @param fd
 * @param mode
 */
export function fchmodSync(fd: number, mode: number | string): void {
	const numMode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
	fd2file(fd).chmodSync(numMode);
}

/**
 * Change the file timestamps of a file referenced by the supplied file
 * descriptor.
 * @param fd
 * @param atime
 * @param mtime
 */
export function futimesSync(fd: number, atime: number | Date, mtime: number | Date): void {
	fd2file(fd).utimesSync(normalizeTime(atime), normalizeTime(mtime));
}

// DIRECTORY-ONLY METHODS

/**
 * Synchronous `rmdir`.
 * @param path
 */
export function rmdirSync(path: string): void {
	path = normalizePath(path);
	return assertRoot().rmdirSync(path, cred);
}

/**
 * Synchronous `mkdir`.
 * @param path
 * @param mode defaults to `0777`
 */
export function mkdirSync(path: string, mode?: number | string): void {
	assertRoot().mkdirSync(normalizePath(path), normalizeMode(mode, 0o777), cred);
}

/**
 * Synchronous `readdir`. Reads the contents of a directory.
 * @param path
 * @return [String[]]
 */
export function readdirSync(path: string): string[] {
	path = normalizePath(path);
	return assertRoot().readdirSync(path, cred);
}

// SYMLINK METHODS

/**
 * Synchronous `link`.
 * @param srcpath
 * @param dstpath
 */
export function linkSync(srcpath: string, dstpath: string): void {
	srcpath = normalizePath(srcpath);
	dstpath = normalizePath(dstpath);
	return assertRoot().linkSync(srcpath, dstpath, cred);
}

/**
 * Synchronous `symlink`.
 * @param srcpath
 * @param dstpath
 * @param type can be either `'dir'` or `'file'` (default is `'file'`)
 */
export function symlinkSync(srcpath: string, dstpath: string, type?: string): void {
	if (!type) {
		type = 'file';
	} else if (type !== 'file' && type !== 'dir') {
		throw new ApiError(ErrorCode.EINVAL, 'Invalid type: ' + type);
	}
	srcpath = normalizePath(srcpath);
	dstpath = normalizePath(dstpath);
	return assertRoot().symlinkSync(srcpath, dstpath, type, cred);
}

/**
 * Synchronous readlink.
 * @param path
 * @return [String]
 */
export function readlinkSync(path: string): string {
	path = normalizePath(path);
	return assertRoot().readlinkSync(path, cred);
}

// PROPERTY OPERATIONS

/**
 * Synchronous `chown`.
 * @param path
 * @param uid
 * @param gid
 */
export function chownSync(path: string, uid: number, gid: number): void {
	path = normalizePath(path);
	assertRoot().chownSync(path, uid, gid, cred);
}

/**
 * Synchronous `lchown`.
 * @param path
 * @param uid
 * @param gid
 */
export function lchownSync(path: string, uid: number, gid: number): void {
	path = normalizePath(path);
	assertRoot().chownSync(path, uid, gid, cred);
}

/**
 * Synchronous `chmod`.
 * @param path
 * @param mode
 */
export function chmodSync(path: string, mode: string | number): void {
	const numMode = normalizeMode(mode, -1);
	if (numMode < 0) {
		throw new ApiError(ErrorCode.EINVAL, `Invalid mode.`);
	}
	path = normalizePath(path);
	assertRoot().chmodSync(path, numMode, cred);
}

/**
 * Synchronous `lchmod`.
 * @param path
 * @param mode
 */
export function lchmodSync(path: string, mode: number | string): void {
	const numMode = normalizeMode(mode, -1);
	if (numMode < 1) {
		throw new ApiError(ErrorCode.EINVAL, `Invalid mode.`);
	}
	assertRoot().chmodSync(normalizePath(path), numMode, cred);
}

/**
 * Change file timestamps of the file referenced by the supplied path.
 * @param path
 * @param atime
 * @param mtime
 */
export function utimesSync(path: string, atime: number | Date, mtime: number | Date): void {
	assertRoot().utimesSync(normalizePath(path), normalizeTime(atime), normalizeTime(mtime), cred);
}

/**
 * Change file timestamps of the file referenced by the supplied path.
 * @param path
 * @param atime
 * @param mtime
 */
export function lutimesSync(path: string, atime: number | Date, mtime: number | Date): void {
	assertRoot().utimesSync(normalizePath(path), normalizeTime(atime), normalizeTime(mtime), cred);
}

/**
 * Synchronous `realpath`.
 * @param path
 * @param cache An object literal of mapped paths that can be used to
 *   force a specific path resolution or avoid additional `fs.stat` calls for
 *   known real paths.
 * @return [String]
 */
export function realpathSync(path: string, cache: { [path: string]: string } = {}): string {
	path = normalizePath(path);
	return assertRoot().realpathSync(path, cred);
}

/**
 * Synchronous `access`.
 * @param path
 * @param mode
 */
export function accessSync(path: string, mode: number = 0o600): void {
	path = normalizePath(path);
	return assertRoot().accessSync(path, mode, cred);
}
