import type { ReadStream, WriteStream, FSWatcher } from 'node:fs';
import { ApiError, ErrorCode } from '../ApiError';

import * as constants from './constants';
export { constants };

import { FileFlag } from '../file';
import { normalizePath, normalizeMode, getFdForFile, normalizeOptions, fd2file, fdMap, normalizeTime, cred, nop, assertRoot } from './shared';
import { FileContents } from '../filesystem';
import { Stats } from '../stats';

// fs.promises

/**
 * Renames a file
 * @param oldPath
 * @param newPath
 */
export async function rename(oldPath: string, newPath: string): Promise<void> {
	return assertRoot().rename(normalizePath(oldPath), normalizePath(newPath), cred);
}

/**
 * Test whether or not the given path exists by checking with the file system.
 * @param path
 */
export async function exists(path: string): Promise<boolean> {
	try {
		return assertRoot().exists(normalizePath(path), cred);
	} catch (e) {
		return false;
	}
}

/**
 * `stat`.
 * @param path
 * @returns Stats
 */
export async function stat(path: string): Promise<Stats> {
	const fs = assertRoot();
	const p = await fs.realpath(normalizePath(path), cred);
	return fs.stat(p, cred);
}

/**
 * `lstat`.
 * `lstat()` is identical to `stat()`, except that if path is a symbolic link,
 * then the link itself is stat-ed, not the file that it refers to.
 * @param path
 * @return [BrowserFS.node.fs.Stats]
 */
export async function lstat(path: string): Promise<Stats> {
	return assertRoot().stat(normalizePath(path), cred);
}

// FILE-ONLY METHODS

/**
 * `truncate`.
 * @param path
 * @param len
 */
export async function truncate(path: string, len: number = 0): Promise<void> {
	if (len < 0) {
		throw new ApiError(ErrorCode.EINVAL);
	}
	return assertRoot().truncate(normalizePath(path), len, cred);
}

/**
 * `unlink`.
 * @param path
 */
export async function unlink(path: string): Promise<void> {
	return assertRoot().unlink(normalizePath(path), cred);
}

/**
 * file open.
 * @see http://www.manpagez.com/man/2/open/
 * @param path
 * @param flags
 * @param mode defaults to `0644`
 */
export async function open(path: string, flag: string, mode: number | string = 0o644): Promise<number> {
	const file = await assertRoot().open(normalizePath(path), FileFlag.getFileFlag(flag), normalizeMode(mode, 0o644), cred);
	return getFdForFile(file);
}

/**
 * Synchronously reads the entire contents of a file.
 * @param filename
 * @param options
 * @option options [String] encoding The string encoding for the file contents. Defaults to `null`.
 * @option options [String] flag Defaults to `'r'`.
 * @return [String | BrowserFS.node.Buffer]
 */
export async function readFile(filename: string, options?: { flag?: string }): Promise<Buffer>;
export async function readFile(filename: string, options: { encoding: string; flag?: string }): Promise<string>;
export async function readFile(filename: string, encoding: string): Promise<string>;
export async function readFile(filename: string, arg2: any = {}): Promise<Buffer | string> {
	const options = normalizeOptions(arg2, null, 'r', null);
	const flag = FileFlag.getFileFlag(options.flag);
	if (!flag.isReadable()) {
		throw new ApiError(ErrorCode.EINVAL, 'Flag passed to readFile must allow for reading.');
	}
	return assertRoot().readFile(normalizePath(filename), options.encoding, flag, cred);
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
export async function writeFile(filename: string, data: FileContents, options?: { encoding?: string; mode?: number | string; flag?: string }): Promise<void>;
export async function writeFile(filename: string, data: FileContents, encoding?: string): Promise<void>;
export async function writeFile(filename: string, data: FileContents, options?: { encoding?: string; mode?: number | string; flag?: string } | string): Promise<void>;
export async function writeFile(filename: string, data: FileContents, arg3?: { encoding?: string; mode?: number | string; flag?: string } | string): Promise<void> {
	const options = normalizeOptions(arg3, 'utf8', 'w', 0o644);
	const flag = FileFlag.getFileFlag(options.flag);
	if (!flag.isWriteable()) {
		throw new ApiError(ErrorCode.EINVAL, 'Flag passed to writeFile must allow for writing.');
	}
	return assertRoot().writeFile(normalizePath(filename), data, options.encoding, flag, options.mode, cred);
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
export async function appendFile(filename: string, data: FileContents, options?: { encoding?: string; mode?: number | string; flag?: string }): Promise<void>;
export async function appendFile(filename: string, data: FileContents, encoding?: string): Promise<void>;
export async function appendFile(filename: string, data: FileContents, arg3?: any): Promise<void> {
	const options = normalizeOptions(arg3, 'utf8', 'a', 0o644);
	const flag = FileFlag.getFileFlag(options.flag);
	if (!flag.isAppendable()) {
		throw new ApiError(ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.');
	}
	return assertRoot().appendFile(normalizePath(filename), data, options.encoding, flag, options.mode, cred);
}

// FILE DESCRIPTOR METHODS

/**
 * `fstat`.
 * `fstat()` is identical to `stat()`, except that the file to be stat-ed is
 * specified by the file descriptor `fd`.
 * @param fd
 * @return [BrowserFS.node.fs.Stats]
 */
export async function fstat(fd: number): Promise<Stats> {
	return fd2file(fd).stat();
}

/**
 * close.
 * @param fd
 */
export async function close(fd: number): Promise<void> {
	await fd2file(fd).close();
	fdMap.delete(fd);
	return;
}

/**
 * ftruncate.
 * @param fd
 * @param len
 */
export async function ftruncate(fd: number, len: number = 0): Promise<void> {
	const file = fd2file(fd);
	if (len < 0) {
		throw new ApiError(ErrorCode.EINVAL);
	}
	return file.truncate(len);
}

/**
 * fsync.
 * @param fd
 */
export async function fsync(fd: number): Promise<void> {
	return fd2file(fd).sync();
}

/**
 * fdatasync.
 * @param fd
 */
export async function fdatasync(fd: number): Promise<void> {
	return fd2file(fd).datasync();
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
export async function write(fd: number, buffer: Buffer, offset: number, length: number, position?: number): Promise<number>;
export async function write(fd: number, data: string, position?: number | null, encoding?: BufferEncoding): Promise<number>;
export async function write(fd: number, arg2: Buffer | string, arg3?: number, arg4?: BufferEncoding | number, arg5?: number): Promise<number> {
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
		length = arg4 as number;
		position = typeof arg5 === 'number' ? arg5 : null;
	}

	const file = fd2file(fd);
	if (position === undefined || position === null) {
		position = file.getPos()!;
	}
	return file.write(buffer, offset, length, position);
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
export async function read(fd: number, length: number, position: number, encoding: BufferEncoding): Promise<string>;
export async function read(fd: number, buffer: Buffer, offset: number, length: number, position: number): Promise<number>;
export async function read(fd: number, arg2: number | Buffer, arg3: number, arg4: BufferEncoding | number, arg5?: number): Promise<string | number | (string | number)[]> {
	let shenanigans = false;
	let buffer: Buffer,
		offset: number,
		length: number,
		position: number,
		encoding: BufferEncoding = 'utf8';
	if (typeof arg2 === 'number') {
		length = arg2;
		position = arg3;
		encoding = arg4 as BufferEncoding;
		offset = 0;
		buffer = Buffer.alloc(length);
		shenanigans = true;
	} else {
		buffer = arg2;
		offset = arg3;
		length = arg4 as number;
		position = arg5;
	}
	const file = fd2file(fd);
	if (position === undefined || position === null) {
		position = file.getPos()!;
	}

	const rv = await file.read(buffer, offset, length, position);
	if (!shenanigans) {
		return rv;
	} else {
		return [buffer.toString(encoding), rv];
	}
}

/**
 * `fchown`.
 * @param fd
 * @param uid
 * @param gid
 */
export async function fchown(fd: number, uid: number, gid: number): Promise<void> {
	return fd2file(fd).chown(uid, gid);
}

/**
 * `fchmod`.
 * @param fd
 * @param mode
 */
export async function fchmod(fd: number, mode: number | string): Promise<void> {
	const numMode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
	return fd2file(fd).chmod(numMode);
}

/**
 * Change the file timestamps of a file referenced by the supplied file
 * descriptor.
 * @param fd
 * @param atime
 * @param mtime
 */
export async function futimes(fd: number, atime: number | Date, mtime: number | Date): Promise<void> {
	return fd2file(fd).utimes(normalizeTime(atime), normalizeTime(mtime));
}

// DIRECTORY-ONLY METHODS

/**
 * `rmdir`.
 * @param path
 */
export async function rmdir(path: string): Promise<void> {
	path = normalizePath(path);
	return assertRoot().rmdir(path, cred);
}

/**
 * `mkdir`.
 * @param path
 * @param mode defaults to `0777`
 */
export async function mkdir(path: string, mode?: number | string): Promise<void> {
	return assertRoot().mkdir(normalizePath(path), normalizeMode(mode, 0o777), cred);
}

/**
 * `readdir`. Reads the contents of a directory.
 * @param path
 * @return [String[]]
 */
export async function readdir(path: string): Promise<string[]> {
	path = normalizePath(path);
	return assertRoot().readdir(path, cred);
}

// SYMLINK METHODS

/**
 * `link`.
 * @param srcpath
 * @param dstpath
 */
export async function link(srcpath: string, dstpath: string): Promise<void> {
	srcpath = normalizePath(srcpath);
	dstpath = normalizePath(dstpath);
	return assertRoot().link(srcpath, dstpath, cred);
}

/**
 * `symlink`.
 * @param srcpath
 * @param dstpath
 * @param type can be either `'dir'` or `'file'` (default is `'file'`)
 */
export async function symlink(srcpath: string, dstpath: string, type?: string): Promise<void> {
	if (!type) {
		type = 'file';
	} else if (type !== 'file' && type !== 'dir') {
		throw new ApiError(ErrorCode.EINVAL, 'Invalid type: ' + type);
	}
	srcpath = normalizePath(srcpath);
	dstpath = normalizePath(dstpath);
	return assertRoot().symlink(srcpath, dstpath, type, cred);
}

/**
 * readlink.
 * @param path
 * @return [String]
 */
export async function readlink(path: string): Promise<string> {
	path = normalizePath(path);
	return assertRoot().readlink(path, cred);
}

// PROPERTY OPERATIONS

/**
 * `chown`.
 * @param path
 * @param uid
 * @param gid
 */
export async function chown(path: string, uid: number, gid: number): Promise<void> {
	path = normalizePath(path);
	return assertRoot().chown(path, uid, gid, cred);
}

/**
 * `lchown`.
 * @param path
 * @param uid
 * @param gid
 */
export async function lchown(path: string, uid: number, gid: number): Promise<void> {
	path = normalizePath(path);
	return assertRoot().chown(path, uid, gid, cred);
}

/**
 * `chmod`.
 * @param path
 * @param mode
 */
export async function chmod(path: string, mode: string | number): Promise<void> {
	const numMode = normalizeMode(mode, -1);
	if (numMode < 0) {
		throw new ApiError(ErrorCode.EINVAL, `Invalid mode.`);
	}
	path = normalizePath(path);
	return assertRoot().chmod(path, numMode, cred);
}

/**
 * `lchmod`.
 * @param path
 * @param mode
 */
export async function lchmod(path: string, mode: number | string): Promise<void> {
	const numMode = normalizeMode(mode, -1);
	if (numMode < 1) {
		throw new ApiError(ErrorCode.EINVAL, `Invalid mode.`);
	}
	return assertRoot().chmod(normalizePath(path), numMode, cred);
}

/**
 * Change file timestamps of the file referenced by the supplied path.
 * @param path
 * @param atime
 * @param mtime
 */
export async function utimes(path: string, atime: number | Date, mtime: number | Date): Promise<void> {
	return assertRoot().utimes(normalizePath(path), normalizeTime(atime), normalizeTime(mtime), cred);
}

/**
 * Change file timestamps of the file referenced by the supplied path.
 * @param path
 * @param atime
 * @param mtime
 */
export async function lutimes(path: string, atime: number | Date, mtime: number | Date): Promise<void> {
	return assertRoot().utimes(normalizePath(path), normalizeTime(atime), normalizeTime(mtime), cred);
}

/**
 * `realpath`.
 * @param path
 * @param cache An object literal of mapped paths that can be used to
 *   force a specific path resolution or avoid additional `fs.stat` calls for
 *   known real paths.
 * @return [String]
 */
export async function realpath(path: string, cache: { [path: string]: string } = {}): Promise<string> {
	path = normalizePath(path);
	return assertRoot().realpath(path, cred);
}

export async function watchFile(filename: string, listener: (curr: Stats, prev: Stats) => void): Promise<void>;
export async function watchFile(filename: string, options: { persistent?: boolean; interval?: number }, listener: (curr: Stats, prev: Stats) => void): Promise<void>;
export async function watchFile(filename: string, arg2: any, listener: (curr: Stats, prev: Stats) => void = nop): Promise<void> {
	throw new ApiError(ErrorCode.ENOTSUP);
}

export async function unwatchFile(filename: string, listener: (curr: Stats, prev: Stats) => void = nop): Promise<void> {
	throw new ApiError(ErrorCode.ENOTSUP);
}

export async function watch(filename: string, listener?: (event: string, filename: string) => any): Promise<FSWatcher>;
export async function watch(filename: string, options: { persistent?: boolean }, listener?: (event: string, filename: string) => any): Promise<FSWatcher>;
export async function watch(filename: string, arg2: any, listener: (event: string, filename: string) => any = nop): Promise<FSWatcher> {
	throw new ApiError(ErrorCode.ENOTSUP);
}

/**
 * `access`.
 * @param path
 * @param mode
 */
export async function access(path: string, mode: number = 0o600): Promise<void> {
	path = normalizePath(path);
	return assertRoot().access(path, mode, cred);
}

export async function createReadStream(
	path: string,
	options?: {
		flags?: string;
		encoding?: string;
		fd?: number;
		mode?: number;
		autoClose?: boolean;
	}
): Promise<ReadStream> {
	throw new ApiError(ErrorCode.ENOTSUP);
}

export async function createWriteStream(
	path: string,
	options?: {
		flags?: string;
		encoding?: string;
		fd?: number;
		mode?: number;
	}
): Promise<WriteStream> {
	throw new ApiError(ErrorCode.ENOTSUP);
}
