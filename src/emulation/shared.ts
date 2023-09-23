// Utilities and shared data

import * as path from 'path';
import { ApiError, ErrorCode } from '../ApiError';
import { Cred } from '../cred';
import { FileSystem } from '../filesystem';
import { File } from '../file';

export let cred: Cred;
export function setCred(val: Cred): void {
	cred = val;
}

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

export let root: FileSystem;
export function assertRoot(): FileSystem {
	if (!root) {
		throw new ApiError(ErrorCode.EIO, `Initialize BrowserFS with a file system using BrowserFS.initialize(filesystem)`);
	}

	return root;
}

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
