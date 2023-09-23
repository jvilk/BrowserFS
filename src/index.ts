/**
 * BrowserFS's main module. This is exposed in the browser via the BrowserFS global.
 */

import * as buffer from 'buffer';
import fs from './emulation/fs';
import * as path from 'path';
import { FileSystem, type BFSOneArgCallback, type BFSCallback, BaseFileSystem } from './filesystem';
import EmscriptenFS from './generic/emscripten_fs';
import { backends } from './backends';
import * as BFSUtils from './utils';
import { ErrorCode, ApiError } from './ApiError';
import { Cred } from './cred';
import * as process from 'process';
import type { BackendConstructor } from './backends';
import { type MountMapping, setCred } from './emulation/shared';

if (process && (<any>process)['initializeTTYs']) {
	(<any>process)['initializeTTYs']();
}

/**
 * Installs BFSRequire as global `require`, a Node Buffer polyfill as the global `Buffer` variable,
 * and a Node process polyfill as the global `process` variable.
 */
export function install(obj: any) {
	obj.Buffer = Buffer;
	obj.process = process;
	const oldRequire = obj.require ? obj.require : null;
	// Monkey-patch require for Node-style code.
	obj.require = function (arg: string) {
		const rv = BFSRequire(arg);
		if (!rv) {
			return oldRequire.apply(null, Array.prototype.slice.call(arguments, 0));
		} else {
			return rv;
		}
	};
}

/**
 * @hidden
 */
export function registerFileSystem(name: string, fs: BackendConstructor) {
	backends[name] = fs;
}

/**
 * Polyfill for CommonJS `require()`. For example, can call `BFSRequire('fs')` to get a 'fs' module polyfill.
 */
export function BFSRequire(module: 'fs'): typeof fs;
export function BFSRequire(module: 'path'): typeof path;
export function BFSRequire(module: 'buffer'): typeof buffer;
export function BFSRequire(module: 'process'): typeof process;
export function BFSRequire(module: 'bfs_utils'): typeof BFSUtils;
export function BFSRequire(module: string): BackendConstructor;
export function BFSRequire(module: string): any {
	switch (module) {
		case 'fs':
			return fs;
		case 'path':
			return path;
		case 'buffer':
			// The 'buffer' module has 'Buffer' as a property.
			return buffer;
		case 'process':
			return process;
		case 'bfs_utils':
		case 'bfs-utils':
			return BFSUtils;
		default:
			return backends[module];
	}
}

/**
 * Initializes BrowserFS with the given root file system.
 */
export function initialize(mounts: { [point: string]: FileSystem }, uid: number = 0, gid: number = 0) {
	setCred(new Cred(uid, gid, uid, gid, uid, gid));
	return fs.initialize(mounts);
}

export interface ConfigMapping {
	[mountPoint: string]: FileSystem | FileSystemConfiguration | keyof typeof backends;
}

export type Configuration = FileSystem | FileSystemConfiguration | ConfigMapping;

async function _configure(config: Configuration): Promise<void> {
	if ('fs' in config || config instanceof FileSystem) {
		// single FS
		config = { '/': config } as ConfigMapping;
	}
	for (let [point, value] of Object.entries(config)) {
		point = point.toString(); // so linting stops complaining that point should be declared with const, which can't be done since value is assigned to

		if (value instanceof FileSystem) {
			continue;
		}

		if (typeof value == 'string') {
			value = { fs: value };
		}

		config[point] = await getFileSystem(value);
	}
	return initialize(config as MountMapping);
}

/**
 * Creates a file system with the given configuration, and initializes BrowserFS with it.
 * See the FileSystemConfiguration type for more info on the configuration object.
 */
export function configure(config: FileSystemConfiguration): Promise<void>;
export function configure(config: FileSystemConfiguration, cb: BFSOneArgCallback): void;
export function configure(config: FileSystemConfiguration, cb?: BFSOneArgCallback): Promise<void> | void {
	// Promise version
	if (typeof cb != 'function') {
		return _configure(config);
	}

	// Callback version
	_configure(config)
		.then(() => cb())
		.catch(err => cb(err));
	return;
}

/**
 * Asynchronously creates a file system with the given configuration, and initializes BrowserFS with it.
 * See the FileSystemConfiguration type for more info on the configuration object.
 * Note: unlike configure, the .then is provided with the file system
 */

/**
 * Specifies a file system backend type and its options.
 *
 * Individual options can recursively contain FileSystemConfiguration objects for
 * option values that require file systems.
 *
 * For example, to mirror Dropbox to LocalStorage with AsyncMirror, use the following
 * object:
 *
 * ```javascript
 * var config = {
 *   fs: "AsyncMirror",
 *   options: {
 *     sync: {fs: "LocalStorage"},
 *     async: {fs: "Dropbox", options: {client: anAuthenticatedDropboxSDKClient }}
 *   }
 * };
 * ```
 *
 * The option object for each file system corresponds to that file system's option object passed to its `Create()` method.
 */
export interface FileSystemConfiguration {
	fs: string;
	options?: object;
}

async function _getFileSystem({ fs: fsName, options = {} }: FileSystemConfiguration): Promise<FileSystem> {
	if (!fsName) {
		throw new ApiError(ErrorCode.EPERM, 'Missing "fs" property on configuration object.');
	}

	if (typeof options !== 'object' || options === null) {
		throw new ApiError(ErrorCode.EINVAL, 'Invalid "options" property on configuration object.');
	}

	const props = Object.keys(options).filter(k => k != 'fs');

	for (const prop of props) {
		const opt = options[prop];
		if (opt === null || typeof opt !== 'object' || !('fs' in opt)) {
			continue;
		}

		const fs = await _getFileSystem(opt);
		options[prop] = fs;
	}

	const fsc = <BackendConstructor | undefined>(<any>backends)[fsName];
	if (!fsc) {
		throw new ApiError(ErrorCode.EPERM, `File system ${fsName} is not available in BrowserFS.`);
	} else {
		return fsc.Create(options);
	}
}

/**
 * Retrieve a file system with the given configuration. Will return a promise if invoked without a callback
 * @param config A FileSystemConfiguration object. See FileSystemConfiguration for details.
 * @param cb Called when the file system is constructed, or when an error occurs.
 */
export function getFileSystem(config: FileSystemConfiguration): Promise<FileSystem>;
export function getFileSystem(config: FileSystemConfiguration, cb: BFSCallback<FileSystem>): void;
export function getFileSystem(config: FileSystemConfiguration, cb?: BFSCallback<FileSystem>): Promise<FileSystem> | void {
	// Promise version
	if (typeof cb != 'function') {
		return _getFileSystem(config);
	}

	// Callback version
	_getFileSystem(config)
		.then(fs => cb(null, fs))
		.catch(err => cb(err));
	return;
}

export * from './backends';
export * from './ApiError';
export * from './generic/key_value_filesystem';
export * from './inode';
export { fs, EmscriptenFS, FileSystem, BaseFileSystem };
export default fs;
