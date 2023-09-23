// Utilities and shared data

import { posix as path } from 'path';
import { ApiError, ErrorCode } from '../ApiError';
import { Cred } from '../cred';
import { BaseFileSystem, FileSystem } from '../filesystem';
import { File } from '../file';
import { mkdirpSync } from '../utils';
import { InternalBackendConstructor } from '../backends';

/**
 * converts Date or number to a fractional UNIX timestamp
 * Grabbed from NodeJS sources (lib/fs.js)
 */
export function toUnixTimestamp(time: Date | number): number {
	if (typeof time === 'number') {
		return time;
	} else if (time instanceof Date) {
		return time.getTime() / 1000;
	}
	throw new Error('Cannot parse time: ' + time);
}

export function normalizeMode(mode: unknown, def: number): number {
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

export function normalizeTime(time: number | Date): Date {
	if (time instanceof Date) {
		return time;
	}

	if (typeof time === 'number') {
		return new Date(time * 1000);
	}

	throw new ApiError(ErrorCode.EINVAL, `Invalid time.`);
}

export function normalizePath(p: string): string {
	// Node doesn't allow null characters in paths.
	if (p.indexOf('\u0000') >= 0) {
		throw new ApiError(ErrorCode.EINVAL, 'Path must be a string without null bytes.');
	}
	if (p === '') {
		throw new ApiError(ErrorCode.EINVAL, 'Path must not be empty.');
	}
	return path.resolve(p);
}

export function normalizeOptions(options: any, defEnc: string | null, defFlag: string, defMode: number | null): { encoding: BufferEncoding; flag: string; mode: number } {
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

export function nop() {
	// do nothing
}

// credentials
export let cred: Cred;
export function setCred(val: Cred): void {
	cred = val;
}

// descriptors
export const fdMap: Map<number, File> = new Map();
let nextFd = 100;
export function getFdForFile(file: File): number {
	const fd = nextFd++;
	fdMap.set(fd, file);
	return fd;
}
export function fd2file(fd: number): File {
	if (!fdMap.has(fd)) {
		throw new ApiError(ErrorCode.EBADF, 'Invalid file descriptor.');
	}
	return fdMap.get(fd);
}

// mounting
export const mounts: Map<string, FileSystem> = new Map();

export function getRootFS(): FileSystem | null {
	return mounts.get('/');
}

/**
 * Mounts the file system at the given mount point.
 */
export function mount(mountPoint: string, fs: FileSystem): void {
	if (mountPoint[0] !== '/') {
		mountPoint = `/${mountPoint}`;
	}
	mountPoint = path.resolve(mountPoint);
	if (mounts.has(mountPoint)) {
		throw new ApiError(ErrorCode.EINVAL, 'Mount point ' + mountPoint + ' is already in use.');
	}
	mkdirpSync(mountPoint, 0o777, cred, getRootFS());
	mounts.set(mountPoint, fs);
}

export function umount(mountPoint: string): void {
	if (mountPoint[0] !== '/') {
		mountPoint = `/${mountPoint}`;
	}
	mountPoint = path.resolve(mountPoint);
	if (!mounts.has(mountPoint)) {
		throw new ApiError(ErrorCode.EINVAL, 'Mount point ' + mountPoint + ' is already unmounted.');
	}
	mounts.delete(mountPoint);

	while (mountPoint !== '/') {
		if (getRootFS().readdirSync(mountPoint, cred).length === 0) {
			getRootFS().rmdirSync(mountPoint, cred);
			mountPoint = path.dirname(mountPoint);
		} else {
			break;
		}
	}
}

/**
 * Gets the internal FileSystem for the path, then returns it along with the path relative to the FS' root
 */
export function resolveFS(path: string): { fs: FileSystem; path: string; mountPoint: string } {
	const sortedMounts = [...mounts].sort((a, b) => (a[0].length > b[0].length ? -1 : 1)); // decending order of the string length
	for (const [mountPoint, fs] of sortedMounts) {
		// We know path is normalized, so it would be a substring of the mount point.
		if (mountPoint.length <= path.length && path.indexOf(mountPoint) == 0) {
			path = path.slice(mountPoint.length); // Resolve the path relative to the mount point
			if (path === '') {
				path = '/';
			}
			return { fs, path, mountPoint };
		}
	}

	throw new ApiError(ErrorCode.EIO, 'BrowserFS not initialized with a file system');
}

/**
 * Reverse maps the paths in text from the mounted FileSystem to the global path
 */
export function fixPaths(text: string, paths: { [from: string]: string }): string {
	for (const [from, to] of Object.entries(paths)) {
		text = text.replaceAll(from, to);
	}
	return text;
}

export function fixError<E extends Error>(e: E, paths: { [from: string]: string }): E {
	e.stack = fixPaths(e.stack, paths);
	e.message = fixPaths(e.message, paths);
	return e;
}

export interface MountMapping {
	[point: string]: FileSystem;
}

export function initialize(mountMapping: MountMapping): void {
	if (!mountMapping['/']) {
		throw new ApiError(ErrorCode.EINVAL, 'BrowserFS must be initialized with a root filesystem.');
	}
	for (const [point, fs] of Object.entries(mountMapping)) {
		const FS = fs.constructor as unknown as InternalBackendConstructor;
		if (!FS.isAvailable()) {
			throw new ApiError(ErrorCode.EINVAL, `Can not mount "${point}" since the filesystem is unavailable.`);
		}

		mounts.set(point, fs);
	}
}
