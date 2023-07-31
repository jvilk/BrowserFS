/**
 * Grab bag of utility functions used across the code.
 */
import { FileSystem, BackendConstructor } from './file_system';
import { ErrorCode, ApiError } from './api_error';
import levenshtein from './levenshtein';
import * as path from 'path';
import Cred from './cred';
import { Buffer } from 'buffer';

export function deprecationMessage(print: boolean, fsName: string, opts: any): void {
	if (print) {
		// tslint:disable-next-line:no-console
		console.warn(
			`[${fsName}] Direct file system constructor usage is deprecated for this file system, and will be removed in the next major version. Please use the '${fsName}.Create(${JSON.stringify(
				opts
			)}, callback)' method instead. See https://github.com/jvilk/BrowserFS/issues/176 for more details.`
		);
		// tslint:enable-next-line:no-console
	}
}

/**
 * Checks for any IE version, including IE11 which removed MSIE from the
 * userAgent string.
 * @hidden
 */
export const isIE: boolean =
	typeof globalThis.navigator !== 'undefined' &&
	!!(/(msie) ([\w.]+)/.exec(globalThis.navigator.userAgent.toLowerCase()) || globalThis.navigator.userAgent.indexOf('Trident') !== -1);

/**
 * Check if we're in a web worker.
 * @hidden
 */
export const isWebWorker: boolean = typeof globalThis.window === 'undefined';

/**
 * Throws an exception. Called on code paths that should be impossible.
 * @hidden
 */
export function fail() {
	throw new Error('BFS has reached an impossible code path; please file a bug.');
}

/**
 * Synchronous recursive makedir.
 * @hidden
 */
export function mkdirpSync(p: string, mode: number, cred: Cred, fs: FileSystem): void {
	if (!fs.existsSync(p, cred)) {
		mkdirpSync(path.dirname(p), mode, cred, fs);
		fs.mkdirSync(p, mode, cred);
	}
}

/**
 * Converts a buffer into an array buffer. Attempts to do so in a
 * zero-copy manner, e.g. the array references the same memory.
 * @hidden
 */
export function buffer2ArrayBuffer(buff: Buffer): ArrayBuffer | SharedArrayBuffer {
	const u8 = buff,
		u8offset = u8.byteOffset,
		u8Len = u8.byteLength;
	if (u8offset === 0 && u8Len === u8.buffer.byteLength) {
		return u8.buffer;
	} else {
		return u8.buffer.slice(u8offset, u8offset + u8Len);
	}
}

/**
 * Copies a slice of the given buffer
 * @hidden
 */
export function copyingSlice(buff: Buffer, start: number = 0, end = buff.length): Buffer {
	if (start < 0 || end < 0 || end > buff.length || start > end) {
		throw new TypeError(`Invalid slice bounds on buffer of length ${buff.length}: [${start}, ${end}]`);
	}
	if (buff.length === 0) {
		// Avoid s0 corner case in ArrayBuffer case.
		return emptyBuffer();
	} else {
		return buff.subarray(start, end);
	}
}

/**
 * @hidden
 */
let emptyBuff: Buffer | null = null;
/**
 * Returns an empty buffer.
 * @hidden
 */
export function emptyBuffer(): Buffer {
	if (emptyBuff) {
		return emptyBuff;
	}
	return (emptyBuff = Buffer.alloc(0));
}

/**
 * Option validator for a Buffer file system option.
 * @hidden
 */
export async function bufferValidator(v: object): Promise<void> {
	if (!Buffer.isBuffer(v)) {
		throw new ApiError(ErrorCode.EINVAL, 'option must be a Buffer.');
	}
}

/**
 * Checks that the given options object is valid for the file system options.
 * @hidden
 */
export async function checkOptions(fsType: BackendConstructor, opts: any): Promise<void> {
	const optsInfo = fsType.Options;
	const fsName = fsType.Name;

	let pendingValidators = 0;
	let callbackCalled = false;
	let loopEnded = false;

	// Check for required options.
	for (const optName in optsInfo) {
		if (Object.prototype.hasOwnProperty.call(optsInfo, optName)) {
			const opt = optsInfo[optName];
			const providedValue = opts && opts[optName];

			if (providedValue === undefined || providedValue === null) {
				if (!opt.optional) {
					// Required option, not provided.
					// Any incorrect options provided? Which ones are close to the provided one?
					// (edit distance 5 === close)
					const incorrectOptions = Object.keys(opts)
						.filter(o => !(o in optsInfo))
						.map((a: string) => {
							return { str: a, distance: levenshtein(optName, a) };
						})
						.filter(o => o.distance < 5)
						.sort((a, b) => a.distance - b.distance);
					// Validators may be synchronous.
					if (callbackCalled) {
						return;
					}
					callbackCalled = true;
					throw new ApiError(
						ErrorCode.EINVAL,
						`[${fsName}] Required option '${optName}' not provided.${
							incorrectOptions.length > 0 ? ` You provided unrecognized option '${incorrectOptions[0].str}'; perhaps you meant to type '${optName}'.` : ''
						}\nOption description: ${opt.description}`
					);
				}
				// Else: Optional option, not provided. That is OK.
			} else {
				// Option provided! Check type.
				let typeMatches = false;
				if (Array.isArray(opt.type)) {
					typeMatches = opt.type.indexOf(typeof providedValue) !== -1;
				} else {
					typeMatches = typeof providedValue === opt.type;
				}
				if (!typeMatches) {
					// Validators may be synchronous.
					if (callbackCalled) {
						return;
					}
					callbackCalled = true;
					throw new ApiError(
						ErrorCode.EINVAL,
						`[${fsName}] Value provided for option ${optName} is not the proper type. Expected ${
							Array.isArray(opt.type) ? `one of {${opt.type.join(', ')}}` : opt.type
						}, but received ${typeof providedValue}\nOption description: ${opt.description}`
					);
				} else if (opt.validator) {
					pendingValidators++;
					try {
						await opt.validator(providedValue);
					} catch (e) {
						if (!callbackCalled) {
							if (e) {
								callbackCalled = true;
								throw e;
							}
							pendingValidators--;
							if (pendingValidators === 0 && loopEnded) {
								return;
							}
						}
					}
				}
				// Otherwise: All good!
			}
		}
	}
	loopEnded = true;
	if (pendingValidators === 0 && !callbackCalled) {
		return;
	}
}

/** Waits n ms.  */
export function wait(ms: number): Promise<void> {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}

/**
 * Converts a callback into a promise. Assumes last parameter is the callback
 * @todo Look at changing resolve value from cbArgs[0] to include other callback arguments?
 */
export function toPromise(fn: (...fnArgs: unknown[]) => unknown) {
	return function (...args: unknown[]): Promise<unknown> {
		return new Promise((resolve, reject) => {
			args.push((e: ApiError, ...cbArgs: unknown[]) => {
				if (e) {
					reject(e);
				} else {
					resolve(cbArgs[0]);
				}
			});
			fn(...args);
		});
	};
}
