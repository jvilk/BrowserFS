import { ApiError, ErrorCode } from '../ApiError';
import { FileFlag } from '../file';
import { FileContents, FileSystem } from '../filesystem';
import { Stats } from '../stats';
import type { symlink, ReadSyncOptions } from 'fs';
import { normalizePath, cred, getFdForFile, normalizeMode, normalizeOptions, fdMap, fd2file, normalizeTime, resolveFS, fixError } from './shared';

function doOp<F extends keyof FileSystem, FN extends FileSystem[F]>(fn: F, resolveSymlinks: boolean, ...[path, ...args]: Parameters<FN>): ReturnType<FN> {
	const { fs, path: resolvedPath } = resolveFS(resolveSymlinks ? realpathSync(path) : path);
	try {
		// @ts-expect-error 2556 (since ...args is not correctly picked up as being a tuple)
		return fs[fn](resolvedPath, ...args) as Promise<ReturnType<FN>>;
	} catch (e) {
		throw fixError(e, { [resolvedPath]: path });
	}
}

/**
 * Synchronous rename.
 * @param oldPath
 * @param newPath
 */
export function renameSync(oldPath: string, newPath: string): void {
	oldPath = normalizePath(oldPath);
	newPath = normalizePath(newPath);
	const _old = resolveFS(oldPath);
	const _new = resolveFS(newPath);
	const paths = { [_old.path]: oldPath, [_new.path]: newPath };
	try {
		if (_old === _new) {
			return _old.fs.renameSync(_old.path, _new.path, cred);
		}

		const data = readFileSync(oldPath);
		writeFileSync(newPath, data);
		unlinkSync(oldPath);
	} catch (e) {
		throw fixError(e, paths);
	}
}

/**
 * Test whether or not the given path exists by checking with the file system.
 * @param path
 */
export function existsSync(path: string): boolean {
	try {
		return doOp('existsSync', false, path, cred);
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
	return doOp('statSync', true, path, cred);
}

/**
 * Synchronous `lstat`.
 * `lstat()` is identical to `stat()`, except that if path is a symbolic link,
 * then the link itself is stat-ed, not the file that it refers to.
 * @param path
 * @return [BrowserFS.node.fs.Stats]
 */
export function lstatSync(path: string): Stats {
	return doOp('statSync', false, path, cred);
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
	return doOp('truncateSync', true, path, len, cred);
}

/**
 * Synchronous `unlink`.
 * @param path
 */
export function unlinkSync(path: string): void {
	return doOp('unlinkSync', false, path, cred);
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
	const file = doOp('openSync', true, path, FileFlag.getFileFlag(flag), normalizeMode(mode, 0o644), cred);
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
export function readFileSync(filename: string, options?: { flag?: string }): Buffer;
export function readFileSync(filename: string, options: { encoding: string; flag?: string }): string;
export function readFileSync(filename: string, encoding: string): string;
export function readFileSync(filename: string, arg2: { encoding: string; flag?: string } | { flag?: string } | string = {}): FileContents {
	const options = normalizeOptions(arg2, null, 'r', null);
	const flag = FileFlag.getFileFlag(options.flag);
	if (!flag.isReadable()) {
		throw new ApiError(ErrorCode.EINVAL, 'Flag passed to readFile must allow for reading.');
	}
	return doOp('readFileSync', true, filename, options.encoding, flag, cred);
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
export function writeFileSync(filename: string, data: FileContents, options?: { encoding?: string; mode?: number | string; flag?: string }): void;
export function writeFileSync(filename: string, data: FileContents, encoding?: string): void;
export function writeFileSync(filename: string, data: FileContents, arg3?: { encoding?: string; mode?: number | string; flag?: string } | string): void {
	const options = normalizeOptions(arg3, 'utf8', 'w', 0o644);
	const flag = FileFlag.getFileFlag(options.flag);
	if (!flag.isWriteable()) {
		throw new ApiError(ErrorCode.EINVAL, 'Flag passed to writeFile must allow for writing.');
	}
	return doOp('writeFileSync', true, filename, data, options.encoding, flag, options.mode, cred);
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
export function appendFileSync(filename: string, data: FileContents, options?: { encoding?: string; mode?: number | string; flag?: string }): void;
export function appendFileSync(filename: string, data: FileContents, encoding?: string): void;
export function appendFileSync(filename: string, data: FileContents, arg3?: { encoding?: string; mode?: number | string; flag?: string } | string): void {
	const options = normalizeOptions(arg3, 'utf8', 'a', 0o644);
	const flag = FileFlag.getFileFlag(options.flag);
	if (!flag.isAppendable()) {
		throw new ApiError(ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.');
	}
	return doOp('appendFileSync', true, filename, data, options.encoding, flag, options.mode, cred);
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
export function writeSync(fd: number, arg2: Buffer | string, arg3?: number, arg4?: BufferEncoding | number, arg5?: number): number {
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
 */
export function readSync(fd: number, buffer: Buffer, opts?: ReadSyncOptions): number;
export function readSync(fd: number, buffer: Buffer, offset: number, length: number, position?: number): number;
export function readSync(fd: number, buffer: Buffer, opts?: ReadSyncOptions | number, length?: number, position?: number): number {
	const file = fd2file(fd);
	let offset = opts as number;
	if (typeof opts == 'object') {
		({ offset, length, position } = opts);
	}

	if (isNaN(+position)) {
		position = file.getPos()!;
	}

	return file.readSync(buffer, offset, length, position);
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
	return doOp('rmdirSync', true, path, cred);
}

/**
 * Synchronous `mkdir`.
 * @param path
 * @param mode defaults to `0777`
 */
export function mkdirSync(path: string, mode?: number | string): void {
	doOp('mkdirSync', true, path, normalizeMode(mode, 0o777), cred);
}

/**
 * Synchronous `readdir`. Reads the contents of a directory.
 * @param path
 * @return [String[]]
 */
export function readdirSync(path: string): string[] {
	return doOp('readdirSync', true, path, cred);
}

// SYMLINK METHODS

/**
 * Synchronous `link`.
 * @param srcpath
 * @param dstpath
 */
export function linkSync(srcpath: string, dstpath: string): void {
	dstpath = normalizePath(dstpath);
	return doOp('linkSync', false, srcpath, dstpath, cred);
}

/**
 * Synchronous `symlink`.
 * @param srcpath
 * @param dstpath
 * @param type can be either `'dir'` or `'file'` (default is `'file'`)
 */
export function symlinkSync(srcpath: string, dstpath: string, type?: symlink.Type): void {
	if (!['file', 'dir', 'junction'].includes(type)) {
		throw new ApiError(ErrorCode.EINVAL, 'Invalid type: ' + type);
	}
	dstpath = normalizePath(dstpath);
	return doOp('symlinkSync', false, srcpath, dstpath, type, cred);
}

/**
 * Synchronous readlink.
 * @param path
 * @return [String]
 */
export function readlinkSync(path: string): string {
	return doOp('readlinkSync', false, path, cred);
}

// PROPERTY OPERATIONS

/**
 * Synchronous `chown`.
 * @param path
 * @param uid
 * @param gid
 */
export function chownSync(path: string, uid: number, gid: number): void {
	doOp('chownSync', true, path, uid, gid, cred);
}

/**
 * Synchronous `lchown`.
 * @param path
 * @param uid
 * @param gid
 */
export function lchownSync(path: string, uid: number, gid: number): void {
	doOp('chownSync', false, path, uid, gid, cred);
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
	doOp('chmodSync', true, path, numMode, cred);
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
	doOp('chmodSync', false, path, numMode, cred);
}

/**
 * Change file timestamps of the file referenced by the supplied path.
 * @param path
 * @param atime
 * @param mtime
 */
export function utimesSync(path: string, atime: number | Date, mtime: number | Date): void {
	doOp('utimesSync', true, path, normalizeTime(atime), normalizeTime(mtime), cred);
}

/**
 * Change file timestamps of the file referenced by the supplied path.
 * @param path
 * @param atime
 * @param mtime
 */
export function lutimesSync(path: string, atime: number | Date, mtime: number | Date): void {
	doOp('utimesSync', false, path, normalizeTime(atime), normalizeTime(mtime), cred);
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
	const { fs, path: resolvedPath, mountPoint } = resolveFS(path);
	try {
		const stats = fs.statSync(resolvedPath, cred);
		if (!stats.isSymbolicLink()) {
			return path;
		}
		const dst = mountPoint + normalizePath(fs.readlinkSync(resolvedPath, cred));
		return realpathSync(dst);
	} catch (e) {
		throw fixError(e, { [resolvedPath]: path });
	}
}

/**
 * Synchronous `access`.
 * @param path
 * @param mode
 */
export function accessSync(path: string, mode: number = 0o600): void {
	return doOp('accessSync', true, path, mode, cred);
}
