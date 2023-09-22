import { File, FileFlag } from './file';
import { ApiError, ErrorCode } from './ApiError';
import { FileSystem, BFSOneArgCallback, BFSCallback, BFSThreeArgCallback } from './filesystem';
import * as path from 'path';
import { default as Stats, FilePerm } from './stats';
import { Buffer } from 'buffer';
import Cred from './cred';

import type { ReadStream, WriteStream, FSWatcher } from 'node:fs';

export * as constants from './constants';

/**
 * Wraps a callback function, ensuring it is invoked through setTimeout with a delay of 0.
 * @hidden
 */
function wrapCb<T extends (...args: unknown[]) => unknown>(cb: T): T {
	if (typeof cb !== 'function') {
		throw new Error('Callback must be a function.');
	}

	return function (...args) {
		setTimeout(() => cb(...args), 0);
	} as T;
}

/**
 * Wrapped the async function for use with callbacks
 * @hidden
 */
function wrap<T extends (...args: unknown[]) => unknown, P>(promise: Promise<P>, cb: T) {
	try {
		promise.then(val => cb(null, val)).catch(err => cb(err));
	} catch (err) {
		cb(err);
	}
}

/**
 * @hidden
 */
function assertRoot(fs?: FileSystem | null): FileSystem {
	if (fs) {
		return fs;
	}
	throw new ApiError(ErrorCode.EIO, `Initialize BrowserFS with a file system using BrowserFS.initialize(filesystem)`);
}

function normalizeMode(mode: number | string | null | undefined, def: number): number {
	switch (typeof mode) {
		case 'number':
			// (path, flag, mode, cb?)
			return mode;
		case 'string':
			// (path, flag, modeString, cb?)
			const trueMode = parseInt(mode, 8);
			if (!isNaN(trueMode)) {
				return trueMode;
			}
			// Invalid string.
			return def;
		default:
			return def;
	}
}

function normalizeTime(time: number | Date): Date {
	if (time instanceof Date) {
		return time;
	}

	if (typeof time === 'number') {
		return new Date(time * 1000);
	}

	throw new ApiError(ErrorCode.EINVAL, `Invalid time.`);
}

function normalizePath(p: string): string {
	// Node doesn't allow null characters in paths.
	if (p.indexOf('\u0000') >= 0) {
		throw new ApiError(ErrorCode.EINVAL, 'Path must be a string without null bytes.');
	}
	if (p === '') {
		throw new ApiError(ErrorCode.EINVAL, 'Path must not be empty.');
	}
	return path.resolve(p);
}

function normalizeOptions(options: any, defEnc: string | null, defFlag: string, defMode: number | null): { encoding: BufferEncoding; flag: string; mode: number } {
	// typeof null === 'object' so special-case handing is needed.
	switch (options === null ? 'null' : typeof options) {
		case 'object':
			return {
				encoding: typeof options['encoding'] !== 'undefined' ? options['encoding'] : defEnc,
				flag: typeof options['flag'] !== 'undefined' ? options['flag'] : defFlag,
				mode: normalizeMode(options['mode'], defMode!),
			};
		case 'string':
			return {
				encoding: options,
				flag: defFlag,
				mode: defMode!,
			};
		case 'null':
		case 'undefined':
		case 'function':
			return {
				encoding: defEnc! as BufferEncoding,
				flag: defFlag,
				mode: defMode!,
			};
		default:
			throw new TypeError(`"options" must be a string or an object, got ${typeof options} instead.`);
	}
}

/**
 * The default callback is a NOP.
 */
function nopCb() {
	// NOP.
}

/**
 * The node frontend to all filesystems.
 * This layer handles:
 *
 * * Sanity checking inputs.
 * * Normalizing paths.
 * * Resetting stack depth for asynchronous operations which may not go through
 *   the browser by wrapping all input callbacks using `setImmediate`.
 * * Performing the requested operation through the filesystem or the file
 *   descriptor, as appropriate.
 * * Handling optional arguments and setting default arguments.
 * @see http://nodejs.org/api/fs.html
 */

export { Stats };

export const F_OK: number = 0;
export const R_OK: number = 4;
export const W_OK: number = 2;
export const X_OK: number = 1;

let root: FileSystem;
let cred: Cred;
const fdMap: Map<number, File> = new Map();
let nextFd = 100;

/**
 * Initializes the FS Modules with the given filesystem
 * @param rootFS the root filesystem of the FS
 * @param _cred the credentials used for interacting with the FS
 * @returns
 */
export function initialize(rootFS: FileSystem, _cred: Cred): FileSystem {
	if (!(<any>rootFS).constructor.isAvailable()) {
		throw new ApiError(ErrorCode.EINVAL, 'Tried to instantiate BrowserFS with an unavailable file system.');
	}
	cred = _cred;
	return (root = rootFS);
}

/**
 * converts Date or number to a fractional UNIX timestamp
 * Grabbed from NodeJS sources (lib/fs.js)
 */
export function _toUnixTimestamp(time: Date | number): number {
	if (typeof time === 'number') {
		return time;
	} else if (time instanceof Date) {
		return time.getTime() / 1000;
	}
	throw new Error('Cannot parse time: ' + time);
}

/**
 * Grab the FileSystem instance that backs this API.
 * @return [BrowserFS.FileSystem | null] Returns null if the file system has
 *   not been initialized.
 */
export function getRootFS(): FileSystem | null {
	if (root) {
		return root;
	} else {
		return null;
	}
}

function getFdForFile(file: File): number {
	const fd = nextFd++;
	fdMap.set(fd, file);
	return fd;
}

function fd2file(fd: number): File {
	if (!fdMap.has(fd)) {
		throw new ApiError(ErrorCode.EBADF, 'Invalid file descriptor.');
	}
	return fdMap.get(fd);
}

// Combaibility

/**
 * Asynchronous rename. No arguments other than a possible exception are given
 * to the completion callback.
 * @param oldPath
 * @param newPath
 * @param callback
 */
export function rename(oldPath: string, newPath: string, cb: BFSOneArgCallback = nopCb): void {
	const newCb = wrapCb(cb);
	try {
		return wrap(assertRoot(root).rename(normalizePath(oldPath), normalizePath(newPath), cred), newCb);
	} catch (e) {
		newCb(e);
	}
}

/**
 * Synchronous rename.
 * @param oldPath
 * @param newPath
 */
export function renameSync(oldPath: string, newPath: string): void {
	assertRoot(root).renameSync(normalizePath(oldPath), normalizePath(newPath), cred);
}

/**
 * Test whether or not the given path exists by checking with the file system.
 * Then call the callback argument with either true or false.
 * @example Sample invocation
 *   fs.exists('/etc/passwd', function (exists) {
 *     util.debug(exists ? "it's there" : "no passwd!");
 *   });
 * @param path
 * @param callback
 */
export function exists(path: string, cb: (exists: boolean) => any = nopCb): void {
	const newCb = wrapCb(cb);
	try {
		return wrap(assertRoot(root).exists(normalizePath(path), cred), newCb);
	} catch (e) {
		// Doesn't return an error. If something bad happens, we assume it just
		// doesn't exist.
		return newCb(false);
	}
}

/**
 * Test whether or not the given path exists by checking with the file system.
 * @param path
 * @return [boolean]
 */
export function existsSync(path: string): boolean {
	try {
		return assertRoot(root).existsSync(normalizePath(path), cred);
	} catch (e) {
		// Doesn't return an error. If something bad happens, we assume it just
		// doesn't exist.
		return false;
	}
}

/**
 * Asynchronous `stat`.
 * @param path
 * @param callback
 */
export function stat(path: string, cb: BFSCallback<Stats> = nopCb): void {
	const newCb = wrapCb(cb);
	try {
		return wrap(assertRoot(root).stat(normalizePath(path), false, cred), newCb);
	} catch (e) {
		newCb(e);
		return;
	}
}

/**
 * Synchronous `stat`.
 * @param path
 * @return [BrowserFS.node.fs.Stats]
 */
export function statSync(path: string): Stats {
	return assertRoot(root).statSync(normalizePath(path), false, cred);
}

/**
 * Asynchronous `lstat`.
 * `lstat()` is identical to `stat()`, except that if path is a symbolic link,
 * then the link itself is stat-ed, not the file that it refers to.
 * @param path
 * @param callback
 */
export function lstat(path: string, cb: BFSCallback<Stats> = nopCb): void {
	const newCb = wrapCb(cb);
	try {
		return wrap(assertRoot(root).stat(normalizePath(path), true, cred), newCb);
	} catch (e) {
		newCb(e);
		return;
	}
}

/**
 * Synchronous `lstat`.
 * `lstat()` is identical to `stat()`, except that if path is a symbolic link,
 * then the link itself is stat-ed, not the file that it refers to.
 * @param path
 * @return [BrowserFS.node.fs.Stats]
 */
export function lstatSync(path: string): Stats {
	return assertRoot(root).statSync(normalizePath(path), true, cred);
}

// FILE-ONLY METHODS

/**
 * Asynchronous `truncate`.
 * @param path
 * @param len
 * @param callback
 */
export function truncate(path: string, cb?: BFSOneArgCallback): void;
export function truncate(path: string, len: number, cb?: BFSOneArgCallback): void;
export function truncate(path: string, arg2: any = 0, cb: BFSOneArgCallback = nopCb): void {
	let len = 0;
	if (typeof arg2 === 'function') {
		cb = arg2;
	} else if (typeof arg2 === 'number') {
		len = arg2;
	}

	const newCb = wrapCb(cb);
	try {
		if (len < 0) {
			throw new ApiError(ErrorCode.EINVAL);
		}
		return wrap(assertRoot(root).truncate(normalizePath(path), len, cred), newCb);
	} catch (e) {
		newCb(e);
		return;
	}
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
	return assertRoot(root).truncateSync(normalizePath(path), len, cred);
}

/**
 * Asynchronous `unlink`.
 * @param path
 * @param callback
 */
export function unlink(path: string, cb: BFSOneArgCallback = nopCb): void {
	const newCb = wrapCb(cb);
	try {
		return wrap(assertRoot(root).unlink(normalizePath(path), cred), newCb);
	} catch (e) {
		newCb(e);
		return;
	}
}

/**
 * Synchronous `unlink`.
 * @param path
 */
export function unlinkSync(path: string): void {
	return assertRoot(root).unlinkSync(normalizePath(path), cred);
}

/**
 * Asynchronous file open.
 * Exclusive mode ensures that path is newly created.
 *
 * `flags` can be:
 *
 * * `'r'` - Open file for reading. An exception occurs if the file does not exist.
 * * `'r+'` - Open file for reading and writing. An exception occurs if the file does not exist.
 * * `'rs'` - Open file for reading in synchronous mode. Instructs the filesystem to not cache writes.
 * * `'rs+'` - Open file for reading and writing, and opens the file in synchronous mode.
 * * `'w'` - Open file for writing. The file is created (if it does not exist) or truncated (if it exists).
 * * `'wx'` - Like 'w' but opens the file in exclusive mode.
 * * `'w+'` - Open file for reading and writing. The file is created (if it does not exist) or truncated (if it exists).
 * * `'wx+'` - Like 'w+' but opens the file in exclusive mode.
 * * `'a'` - Open file for appending. The file is created if it does not exist.
 * * `'ax'` - Like 'a' but opens the file in exclusive mode.
 * * `'a+'` - Open file for reading and appending. The file is created if it does not exist.
 * * `'ax+'` - Like 'a+' but opens the file in exclusive mode.
 *
 * @see http://www.manpagez.com/man/2/open/
 * @param path
 * @param flags
 * @param mode defaults to `0644`
 * @param callback
 */
export function open(path: string, flag: string, cb?: BFSCallback<number>): void;
export function open(path: string, flag: string, mode: number | string, cb?: BFSCallback<number>): void;
export function open(path: string, flag: string, arg2?: any, cb: BFSCallback<number> = nopCb): void {
	const mode = normalizeMode(arg2, 0x1a4);
	cb = typeof arg2 === 'function' ? arg2 : cb;
	const newCb = wrapCb(cb);
	try {
		wrap(assertRoot(root).open(normalizePath(path), FileFlag.getFileFlag(flag), mode, cred), (e: ApiError, file?: File) => {
			if (file) {
				newCb(e, getFdForFile(file));
			} else {
				newCb(e);
			}
		});
	} catch (e) {
		newCb(e);
	}
}

/**
 * Synchronous file open.
 * @see http://www.manpagez.com/man/2/open/
 * @param path
 * @param flags
 * @param mode defaults to `0644`
 * @return [BrowserFS.File]
 */
export function openSync(path: string, flag: string, mode: number | string = 0x1a4): number {
	return getFdForFile(assertRoot(root).openSync(normalizePath(path), FileFlag.getFileFlag(flag), normalizeMode(mode, 0x1a4), cred));
}

/**
 * Asynchronously reads the entire contents of a file.
 * @example Usage example
 *   fs.readFile('/etc/passwd', function (err, data) {
 *     if (err) throw err;
 *     console.log(data);
 *   });
 * @param filename
 * @param options
 * @option options [String] encoding The string encoding for the file contents. Defaults to `null`.
 * @option options [String] flag Defaults to `'r'`.
 * @param callback If no encoding is specified, then the raw buffer is returned.
 */
export function readFile(filename: string, cb: BFSCallback<Buffer>): void;
export function readFile(filename: string, options: { flag?: string }, callback?: BFSCallback<Buffer>): void;
export function readFile(filename: string, options: { encoding: string; flag?: string }, callback?: BFSCallback<string>): void;
export function readFile(filename: string, encoding: string, cb: BFSCallback<string>): void;
export function readFile(filename: string, arg2: any = {}, cb: BFSCallback<any> = nopCb) {
	const options = normalizeOptions(arg2, null, 'r', null);
	cb = typeof arg2 === 'function' ? arg2 : cb;
	const newCb = wrapCb(cb);
	try {
		const flag = FileFlag.getFileFlag(options['flag']);
		if (!flag.isReadable()) {
			return newCb(new ApiError(ErrorCode.EINVAL, 'Flag passed to readFile must allow for reading.'));
		}
		return wrap(assertRoot(root).readFile(normalizePath(filename), options.encoding, flag, cred), newCb);
	} catch (e) {
		newCb(e);
		return;
	}
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
	return assertRoot(root).readFileSync(normalizePath(filename), options.encoding, flag, cred);
}

/**
 * Asynchronously writes data to a file, replacing the file if it already
 * exists.
 *
 * The encoding option is ignored if data is a buffer.
 *
 * @example Usage example
 *   fs.writeFile('message.txt', 'Hello Node', function (err) {
 *     if (err) throw err;
 *     console.log('It\'s saved!');
 *   });
 * @param filename
 * @param data
 * @param options
 * @option options [String] encoding Defaults to `'utf8'`.
 * @option options [Number] mode Defaults to `0644`.
 * @option options [String] flag Defaults to `'w'`.
 * @param callback
 */
export function writeFile(filename: string, data: any, cb?: BFSOneArgCallback): void;
export function writeFile(filename: string, data: any, encoding?: string, cb?: BFSOneArgCallback): void;
export function writeFile(filename: string, data: any, options?: { encoding?: string; mode?: string | number; flag?: string }, cb?: BFSOneArgCallback): void;
export function writeFile(filename: string, data: any, arg3: any = {}, cb: BFSOneArgCallback = nopCb): void {
	const options = normalizeOptions(arg3, 'utf8', 'w', 0x1a4);
	cb = typeof arg3 === 'function' ? arg3 : cb;
	const newCb = wrapCb(cb);
	try {
		const flag = FileFlag.getFileFlag(options.flag);
		if (!flag.isWriteable()) {
			newCb(new ApiError(ErrorCode.EINVAL, 'Flag passed to writeFile must allow for writing.'));
			return;
		}
		return wrap(assertRoot(root).writeFile(normalizePath(filename), data, options.encoding, flag, options.mode, cred), newCb);
	} catch (e) {
		newCb(e);
		return;
	}
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
	const options = normalizeOptions(arg3, 'utf8', 'w', 0x1a4);
	const flag = FileFlag.getFileFlag(options.flag);
	if (!flag.isWriteable()) {
		throw new ApiError(ErrorCode.EINVAL, 'Flag passed to writeFile must allow for writing.');
	}
	return assertRoot(root).writeFileSync(normalizePath(filename), data, options.encoding, flag, options.mode, cred);
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
 * @param callback
 */
export function appendFile(filename: string, data: any, cb?: BFSOneArgCallback): void;
export function appendFile(filename: string, data: any, options?: { encoding?: string; mode?: number | string; flag?: string }, cb?: BFSOneArgCallback): void;
export function appendFile(filename: string, data: any, encoding?: string, cb?: BFSOneArgCallback): void;
export function appendFile(filename: string, data: any, arg3?: any, cb: BFSOneArgCallback = nopCb): void {
	const options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
	cb = typeof arg3 === 'function' ? arg3 : cb;
	const newCb = wrapCb(cb);
	try {
		const flag = FileFlag.getFileFlag(options.flag);
		if (!flag.isAppendable()) {
			newCb(new ApiError(ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.'));
			return;
		}
		wrap(assertRoot(root).appendFile(normalizePath(filename), data, options.encoding, flag, options.mode, cred), newCb);
	} catch (e) {
		newCb(e);
	}
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
	const options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
	const flag = FileFlag.getFileFlag(options.flag);
	if (!flag.isAppendable()) {
		throw new ApiError(ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.');
	}
	return assertRoot(root).appendFileSync(normalizePath(filename), data, options.encoding, flag, options.mode, cred);
}

// FILE DESCRIPTOR METHODS

/**
 * Asynchronous `fstat`.
 * `fstat()` is identical to `stat()`, except that the file to be stat-ed is
 * specified by the file descriptor `fd`.
 * @param fd
 * @param callback
 */
export function fstat(fd: number, cb: BFSCallback<Stats> = nopCb): void {
	const newCb = wrapCb(cb);
	try {
		const file = fd2file(fd);
		wrap(file.stat(), newCb);
	} catch (e) {
		newCb(e);
	}
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
 * Asynchronous close.
 * @param fd
 * @param callback
 */
export function close(fd: number, cb: BFSOneArgCallback = nopCb): void {
	const newCb = wrapCb(cb);
	try {
		wrap(fd2file(fd).close(), (e: ApiError) => {
			if (!e) {
				fdMap.delete(fd);
			}
			newCb(e);
		});
	} catch (e) {
		newCb(e);
	}
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
 * Asynchronous ftruncate.
 * @param fd
 * @param len
 * @param callback
 */
export function ftruncate(fd: number, cb?: BFSOneArgCallback): void;
export function ftruncate(fd: number, len?: number, cb?: BFSOneArgCallback): void;
export function ftruncate(fd: number, arg2?: any, cb: BFSOneArgCallback = nopCb): void {
	const length = typeof arg2 === 'number' ? arg2 : 0;
	cb = typeof arg2 === 'function' ? arg2 : cb;
	const newCb = wrapCb(cb);
	try {
		const file = fd2file(fd);
		if (length < 0) {
			throw new ApiError(ErrorCode.EINVAL);
		}
		wrap(file.truncate(length), newCb);
	} catch (e) {
		newCb(e);
	}
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
 * Asynchronous fsync.
 * @param fd
 * @param callback
 */
export function fsync(fd: number, cb: BFSOneArgCallback = nopCb): void {
	const newCb = wrapCb(cb);
	try {
		wrap(fd2file(fd).sync(), newCb);
	} catch (e) {
		newCb(e);
	}
}

/**
 * Synchronous fsync.
 * @param fd
 */
export function fsyncSync(fd: number): void {
	fd2file(fd).syncSync();
}

/**
 * Asynchronous fdatasync.
 * @param fd
 * @param callback
 */
export function fdatasync(fd: number, cb: BFSOneArgCallback = nopCb): void {
	const newCb = wrapCb(cb);
	try {
		wrap(fd2file(fd).datasync(), newCb);
	} catch (e) {
		newCb(e);
	}
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
 * without waiting for the callback.
 * @param fd
 * @param buffer Buffer containing the data to write to
 *   the file.
 * @param offset Offset in the buffer to start reading data from.
 * @param length The amount of bytes to write to the file.
 * @param position Offset from the beginning of the file where this
 *   data should be written. If position is null, the data will be written at
 *   the current position.
 * @param callback The number specifies the number of bytes written into the file.
 */
export function write(fd: number, buffer: Buffer, offset: number, length: number, cb?: BFSThreeArgCallback<number, Buffer>): void;
export function write(fd: number, buffer: Buffer, offset: number, length: number, position: number | null, cb?: BFSThreeArgCallback<number, Buffer>): void;
export function write(fd: number, data: any, cb?: BFSThreeArgCallback<number, string>): void;
export function write(fd: number, data: any, position: number | null, cb?: BFSThreeArgCallback<number, string>): void;
export function write(fd: number, data: any, position: number | null, encoding: BufferEncoding, cb?: BFSThreeArgCallback<number, string>): void;
export function write(fd: number, arg2: any, arg3?: any, arg4?: any, arg5?: any, cb: BFSThreeArgCallback<number, any> = nopCb): void {
	let buffer: Buffer,
		offset: number,
		length: number,
		position: number | null = null;
	if (typeof arg2 === 'string') {
		// Signature 1: (fd, string, [position?, [encoding?]], cb?)
		let encoding: BufferEncoding = 'utf8';
		switch (typeof arg3) {
			case 'function':
				// (fd, string, cb)
				cb = arg3;
				break;
			case 'number':
				// (fd, string, position, encoding?, cb?)
				position = arg3;
				encoding = (typeof arg4 === 'string' ? arg4 : 'utf8') as BufferEncoding;
				cb = typeof arg5 === 'function' ? arg5 : cb;
				break;
			default:
				// ...try to find the callback and get out of here!
				cb = typeof arg4 === 'function' ? arg4 : typeof arg5 === 'function' ? arg5 : cb;
				cb(new ApiError(ErrorCode.EINVAL, 'Invalid arguments.'));
				return;
		}
		buffer = Buffer.from(arg2, encoding);
		offset = 0;
		length = buffer.length;
	} else {
		// Signature 2: (fd, buffer, offset, length, position?, cb?)
		buffer = arg2;
		offset = arg3;
		length = arg4;
		position = typeof arg5 === 'number' ? arg5 : null;
		cb = typeof arg5 === 'function' ? arg5 : cb;
	}

	const newCb = wrapCb(cb);
	try {
		const file = fd2file(fd);
		if (position === undefined || position === null) {
			position = file.getPos()!;
		}
		wrap(file.write(buffer, offset, length, position), newCb);
	} catch (e) {
		newCb(e);
	}
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
 * @param buffer The buffer that the data will be
 *   written to.
 * @param offset The offset within the buffer where writing will
 *   start.
 * @param length An integer specifying the number of bytes to read.
 * @param position An integer specifying where to begin reading from
 *   in the file. If position is null, data will be read from the current file
 *   position.
 * @param callback The number is the number of bytes read
 */
export function read(fd: number, length: number, position: number | null, encoding: string, cb?: BFSThreeArgCallback<string, number>): void;
export function read(fd: number, buffer: Buffer, offset: number, length: number, position: number | null, cb?: BFSThreeArgCallback<number, Buffer>): void;
export function read(fd: number, arg2, arg3, arg4, arg5?, cb: BFSThreeArgCallback<string, number> | BFSThreeArgCallback<number, Buffer> = nopCb): void {
	let position: number | null, offset: number, length: number, buffer: Buffer, newCb: BFSThreeArgCallback<number, Buffer>;
	if (typeof arg2 === 'number') {
		// legacy interface
		// (fd, length, position, encoding, callback)
		length = arg2;
		position = arg3;
		const encoding = arg4;
		cb = typeof arg5 === 'function' ? arg5 : cb;
		offset = 0;
		buffer = Buffer.alloc(length);
		// Inefficient.
		// Wrap the cb so we shelter upper layers of the API from these
		// shenanigans.
		newCb = wrapCb((err?: ApiError | null, bytesRead?: number, buf?: Buffer) => {
			if (err) {
				return cb(err);
			}
			(cb as BFSThreeArgCallback<string, number>)(err, buf!.toString(encoding), bytesRead!);
		});
	} else {
		buffer = arg2;
		offset = arg3;
		length = arg4;
		position = arg5;
		newCb = wrapCb(cb as BFSThreeArgCallback<number, Buffer>);
	}

	try {
		const file = fd2file(fd);
		if (position === undefined || position === null) {
			position = file.getPos()!;
		}
		wrap(file.read(buffer, offset, length, position), newCb);
	} catch (e) {
		newCb(e);
	}
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
 * Asynchronous `fchown`.
 * @param fd
 * @param uid
 * @param gid
 * @param callback
 */
export function fchown(fd: number, uid: number, gid: number, callback: BFSOneArgCallback = nopCb): void {
	const newCb = wrapCb(callback);
	try {
		wrap(fd2file(fd).chown(uid, gid), newCb);
	} catch (e) {
		newCb(e);
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
 * Asynchronous `fchmod`.
 * @param fd
 * @param mode
 * @param callback
 */
export function fchmod(fd: number, mode: string | number, cb: BFSOneArgCallback): void {
	const newCb = wrapCb(cb);
	try {
		const numMode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
		wrap(fd2file(fd).chmod(numMode), newCb);
	} catch (e) {
		newCb(e);
	}
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
 * @param callback
 */
export function futimes(fd: number, atime: number | Date, mtime: number | Date, cb: BFSOneArgCallback = nopCb): void {
	const newCb = wrapCb(cb);
	try {
		const file = fd2file(fd);
		if (typeof atime === 'number') {
			atime = new Date(atime * 1000);
		}
		if (typeof mtime === 'number') {
			mtime = new Date(mtime * 1000);
		}
		wrap(file.utimes(atime, mtime), newCb);
	} catch (e) {
		newCb(e);
	}
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
 * Asynchronous `rmdir`.
 * @param path
 * @param callback
 */
export function rmdir(path: string, cb: BFSOneArgCallback = nopCb): void {
	const newCb = wrapCb(cb);
	try {
		path = normalizePath(path);
		wrap(assertRoot(root).rmdir(path, cred), newCb);
	} catch (e) {
		newCb(e);
	}
}

/**
 * Synchronous `rmdir`.
 * @param path
 */
export function rmdirSync(path: string): void {
	path = normalizePath(path);
	return assertRoot(root).rmdirSync(path, cred);
}

/**
 * Asynchronous `mkdir`.
 * @param path
 * @param mode defaults to `0777`
 * @param callback
 */
export function mkdir(path: string, mode?: any, cb: BFSOneArgCallback = nopCb): void {
	if (typeof mode === 'function') {
		cb = mode;
		mode = 0x1ff;
	}
	const newCb = wrapCb(cb);
	try {
		path = normalizePath(path);
		wrap(assertRoot(root).mkdir(path, mode, cred), newCb);
	} catch (e) {
		newCb(e);
	}
}

/**
 * Synchronous `mkdir`.
 * @param path
 * @param mode defaults to `0777`
 */
export function mkdirSync(path: string, mode?: number | string): void {
	assertRoot(root).mkdirSync(normalizePath(path), normalizeMode(mode, 0x1ff), cred);
}

/**
 * Asynchronous `readdir`. Reads the contents of a directory.
 * The callback gets two arguments `(err, files)` where `files` is an array of
 * the names of the files in the directory excluding `'.'` and `'..'`.
 * @param path
 * @param callback
 */
export function readdir(path: string, cb: BFSCallback<string[]> = nopCb): void {
	const newCb = <(err: ApiError, files?: string[]) => void>wrapCb(cb);
	try {
		path = normalizePath(path);
		wrap(assertRoot(root).readdir(path, cred), newCb);
	} catch (e) {
		newCb(e);
	}
}

/**
 * Synchronous `readdir`. Reads the contents of a directory.
 * @param path
 * @return [String[]]
 */
export function readdirSync(path: string): string[] {
	path = normalizePath(path);
	return assertRoot(root).readdirSync(path, cred);
}

// SYMLINK METHODS

/**
 * Asynchronous `link`.
 * @param srcpath
 * @param dstpath
 * @param callback
 */
export function link(srcpath: string, dstpath: string, cb: BFSOneArgCallback = nopCb): void {
	const newCb = wrapCb(cb);
	try {
		srcpath = normalizePath(srcpath);
		dstpath = normalizePath(dstpath);
		wrap(assertRoot(root).link(srcpath, dstpath, cred), newCb);
	} catch (e) {
		newCb(e);
	}
}

/**
 * Synchronous `link`.
 * @param srcpath
 * @param dstpath
 */
export function linkSync(srcpath: string, dstpath: string): void {
	srcpath = normalizePath(srcpath);
	dstpath = normalizePath(dstpath);
	return assertRoot(root).linkSync(srcpath, dstpath, cred);
}

/**
 * Asynchronous `symlink`.
 * @param srcpath
 * @param dstpath
 * @param type can be either `'dir'` or `'file'` (default is `'file'`)
 * @param callback
 */
export function symlink(srcpath: string, dstpath: string, cb?: BFSOneArgCallback): void;
export function symlink(srcpath: string, dstpath: string, type?: string, cb?: BFSOneArgCallback): void;
export function symlink(srcpath: string, dstpath: string, arg3?: any, cb: BFSOneArgCallback = nopCb): void {
	const type = typeof arg3 === 'string' ? arg3 : 'file';
	cb = typeof arg3 === 'function' ? arg3 : cb;
	const newCb = wrapCb(cb);
	try {
		if (type !== 'file' && type !== 'dir') {
			newCb(new ApiError(ErrorCode.EINVAL, 'Invalid type: ' + type));
			return;
		}
		srcpath = normalizePath(srcpath);
		dstpath = normalizePath(dstpath);
		wrap(assertRoot(root).symlink(srcpath, dstpath, type, cred), newCb);
	} catch (e) {
		newCb(e);
	}
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
	return assertRoot(root).symlinkSync(srcpath, dstpath, type, cred);
}

/**
 * Asynchronous readlink.
 * @param path
 * @param callback
 */
export function readlink(path: string, cb: BFSCallback<string> = nopCb): void {
	const newCb = wrapCb(cb);
	try {
		path = normalizePath(path);
		wrap(assertRoot(root).readlink(path, cred), newCb);
	} catch (e) {
		newCb(e);
	}
}

/**
 * Synchronous readlink.
 * @param path
 * @return [String]
 */
export function readlinkSync(path: string): string {
	path = normalizePath(path);
	return assertRoot(root).readlinkSync(path, cred);
}

// PROPERTY OPERATIONS

/**
 * Asynchronous `chown`.
 * @param path
 * @param uid
 * @param gid
 * @param callback
 */
export function chown(path: string, uid: number, gid: number, cb: BFSOneArgCallback = nopCb): void {
	const newCb = wrapCb(cb);
	try {
		path = normalizePath(path);
		wrap(assertRoot(root).chown(path, false, uid, gid, cred), newCb);
	} catch (e) {
		newCb(e);
	}
}

/**
 * Synchronous `chown`.
 * @param path
 * @param uid
 * @param gid
 */
export function chownSync(path: string, uid: number, gid: number): void {
	path = normalizePath(path);
	assertRoot(root).chownSync(path, false, uid, gid, cred);
}

/**
 * Asynchronous `lchown`.
 * @param path
 * @param uid
 * @param gid
 * @param callback
 */
export function lchown(path: string, uid: number, gid: number, cb: BFSOneArgCallback = nopCb): void {
	const newCb = wrapCb(cb);
	try {
		path = normalizePath(path);
		wrap(assertRoot(root).chown(path, true, uid, gid, cred), newCb);
	} catch (e) {
		newCb(e);
	}
}

/**
 * Synchronous `lchown`.
 * @param path
 * @param uid
 * @param gid
 */
export function lchownSync(path: string, uid: number, gid: number): void {
	path = normalizePath(path);
	assertRoot(root).chownSync(path, true, uid, gid, cred);
}

/**
 * Asynchronous `chmod`.
 * @param path
 * @param mode
 * @param callback
 */
export function chmod(path: string, mode: number | string, cb: BFSOneArgCallback = nopCb): void {
	const newCb = wrapCb(cb);
	try {
		const numMode = normalizeMode(mode, -1);
		if (numMode < 0) {
			throw new ApiError(ErrorCode.EINVAL, `Invalid mode.`);
		}
		wrap(assertRoot(root).chmod(normalizePath(path), false, numMode, cred), newCb);
	} catch (e) {
		newCb(e);
	}
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
	assertRoot(root).chmodSync(path, false, numMode, cred);
}

/**
 * Asynchronous `lchmod`.
 * @param path
 * @param mode
 * @param callback
 */
export function lchmod(path: string, mode: number | string, cb: BFSOneArgCallback = nopCb): void {
	const newCb = wrapCb(cb);
	try {
		const numMode = normalizeMode(mode, -1);
		if (numMode < 0) {
			throw new ApiError(ErrorCode.EINVAL, `Invalid mode.`);
		}
		wrap(assertRoot(root).chmod(normalizePath(path), true, numMode, cred), newCb);
	} catch (e) {
		newCb(e);
	}
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
	assertRoot(root).chmodSync(normalizePath(path), true, numMode, cred);
}

/**
 * Change file timestamps of the file referenced by the supplied path.
 * @param path
 * @param atime
 * @param mtime
 * @param callback
 */
export function utimes(path: string, atime: number | Date, mtime: number | Date, cb: BFSOneArgCallback = nopCb): void {
	const newCb = wrapCb(cb);
	try {
		wrap(assertRoot(root).utimes(normalizePath(path), normalizeTime(atime), normalizeTime(mtime), cred), newCb);
	} catch (e) {
		newCb(e);
	}
}

/**
 * Change file timestamps of the file referenced by the supplied path.
 * @param path
 * @param atime
 * @param mtime
 */
export function utimesSync(path: string, atime: number | Date, mtime: number | Date): void {
	assertRoot(root).utimesSync(normalizePath(path), normalizeTime(atime), normalizeTime(mtime), cred);
}

/**
 * Asynchronous `realpath`. The callback gets two arguments
 * `(err, resolvedPath)`. May use `process.cwd` to resolve relative paths.
 *
 * @example Usage example
 *   let cache = {'/etc':'/private/etc'};
 *   fs.realpath('/etc/passwd', cache, function (err, resolvedPath) {
 *     if (err) throw err;
 *     console.log(resolvedPath);
 *   });
 *
 * @param path
 * @param cache An object literal of mapped paths that can be used to
 *   force a specific path resolution or avoid additional `fs.stat` calls for
 *   known real paths.
 * @param callback
 */
export function realpath(path: string, cb?: BFSCallback<string>): void;
export function realpath(path: string, cache: { [path: string]: string }, cb: BFSCallback<string>): void;
export function realpath(path: string, arg2?: any, cb: BFSCallback<string> = nopCb): void {
	const cache = typeof arg2 === 'object' ? arg2 : {};
	cb = typeof arg2 === 'function' ? arg2 : nopCb;
	const newCb = <(err: ApiError, resolvedPath?: string) => any>wrapCb(cb);
	try {
		path = normalizePath(path);
		wrap(assertRoot(root).realpath(path, cache, cred), newCb);
	} catch (e) {
		newCb(e);
	}
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
	return assertRoot(root).realpathSync(path, cache, cred);
}

export function watchFile(filename: string, listener: (curr: Stats, prev: Stats) => void): void;
export function watchFile(filename: string, options: { persistent?: boolean; interval?: number }, listener: (curr: Stats, prev: Stats) => void): void;
export function watchFile(filename: string, arg2: any, listener: (curr: Stats, prev: Stats) => void = nopCb): void {
	throw new ApiError(ErrorCode.ENOTSUP);
}

export function unwatchFile(filename: string, listener: (curr: Stats, prev: Stats) => void = nopCb): void {
	throw new ApiError(ErrorCode.ENOTSUP);
}

export function watch(filename: string, listener?: (event: string, filename: string) => any): FSWatcher;
export function watch(filename: string, options: { persistent?: boolean }, listener?: (event: string, filename: string) => any): FSWatcher;
export function watch(filename: string, arg2: any, listener: (event: string, filename: string) => any = nopCb): FSWatcher {
	throw new ApiError(ErrorCode.ENOTSUP);
}

/**
 * Asynchronous `access`.
 * @param path
 * @param mode
 * @param callback
 */
export function access(path: string, callback: (err: ApiError) => void): void;
export function access(path: string, mode: number, callback: (err: ApiError) => void): void;
export function access(path: string, arg2: any, callback: (e: ApiError) => void = nopCb): void {
	const mode = typeof arg2 === 'number' ? arg2 : FilePerm.READ;
	callback = typeof arg2 === 'function' ? arg2 : nopCb;
	const newCb = wrapCb(callback) as (err: ApiError, resolvedPath?: string) => unknown;
	try {
		path = normalizePath(path);
		wrap(assertRoot(root).access(path, mode, cred), newCb);
	} catch (e) {
		newCb(e);
	}
}

/**
 * Synchronous `access`.
 * @param path
 * @param mode
 */
export function accessSync(path: string, mode: number = 0o600): void {
	path = normalizePath(path);
	return assertRoot(root).accessSync(path, mode, cred);
}

export function createReadStream(
	path: string,
	options?: {
		flags?: string;
		encoding?: string;
		fd?: number;
		mode?: number;
		autoClose?: boolean;
	}
): ReadStream {
	throw new ApiError(ErrorCode.ENOTSUP);
}

export function createWriteStream(
	path: string,
	options?: {
		flags?: string;
		encoding?: string;
		fd?: number;
		mode?: number;
	}
): WriteStream {
	throw new ApiError(ErrorCode.ENOTSUP);
}
