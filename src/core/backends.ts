import { BFSCallback, FileSystem } from './file_system';
import { ApiError } from './api_error';
import { checkOptions } from './util';
import AsyncMirror from '../backend/AsyncMirror';
import Dropbox from '../backend/Dropbox';
import Emscripten from '../backend/Emscripten';
import FileSystemAccess from '../backend/FileSystemAccess';
import FolderAdapter from '../backend/FolderAdapter';
import InMemory from '../backend/InMemory';
import IndexedDB from '../backend/IndexedDB';
import LocalStorage from '../backend/LocalStorage';
import MountableFileSystem from '../backend/MountableFileSystem';
import OverlayFS from '../backend/OverlayFS';
import WorkerFS from '../backend/WorkerFS';
import HTTPRequest from '../backend/HTTPRequest';
import ZipFS from '../backend/ZipFS';
import IsoFS from '../backend/IsoFS';

/**
 * Describes a file system option.
 */
export interface BackendOption<T> {
	// The basic JavaScript type(s) for this option.
	type: string | string[];
	// Whether or not the option is optional (e.g., can be set to null or undefined).
	// Defaults to `false`.
	optional?: boolean;
	// Description of the option. Used in error messages and documentation.
	description: string;
	// A custom validation function to check if the option is valid.
	// Calls the callback with an error object on an error.
	// (Can call callback synchronously.)
	// Defaults to `(opt) => Promise<void>`.
	validator?(opt: T): Promise<void>;
}

/**
 * Describes all of the options available in a file system.
 */
export interface BackendOptions {
	[name: string]: BackendOption<unknown>;
}

/**
 * Contains typings for static functions on the file system constructor.
 */
export interface BackendConstructor<FS extends FileSystem = FileSystem> {
	/**
	 * **Core**: Name to identify this particular file system.
	 */
	Name: string;
	/**
	 * **Core**: Describes all of the options available for this file system.
	 */
	Options: BackendOptions;
	/**
	 * **Core**: Creates a file system of this given type with the given
	 * options, and returns the result in a callback.
	 */
	Create(options: object, cb: (e?: ApiError, fs?: FS) => unknown);
	/**
	 * **Core**: Creates a file system of this given type with the given
	 * options, and returns the result in a promise.
	 */
	CreateAsync(options: object): Promise<FileSystem>;
	/**
	 * **Core**: Returns 'true' if this filesystem is available in the current
	 * environment. For example, a `localStorage`-backed filesystem will return
	 * 'false' if the browser does not support that API.
	 *
	 * Defaults to 'false', as the FileSystem base class isn't usable alone.
	 */
	isAvailable(): boolean;
}

// Monkey-patch `Create` functions to check options before file system initialization.
for (const fsType of [
	AsyncMirror,
	Dropbox,
	Emscripten,
	FileSystemAccess,
	FolderAdapter,
	InMemory,
	IndexedDB,
	IsoFS,
	LocalStorage,
	MountableFileSystem,
	OverlayFS,
	WorkerFS,
	HTTPRequest,
	ZipFS,
] as BackendConstructor[]) {
	const create = fsType.Create;
	fsType.Create = function (opts?: object, cb?: BFSCallback<FileSystem>): void {
		const oneArg = typeof opts === 'function';
		const normalizedCb = oneArg ? opts : cb;
		const normalizedOpts = oneArg ? {} : opts;

		function wrappedCb(e?: ApiError): void {
			if (e) {
				normalizedCb(e);
			} else {
				create.call(fsType, normalizedOpts, normalizedCb);
			}
		}

		checkOptions(fsType, normalizedOpts)
			.then(() => wrappedCb())
			.catch(wrappedCb);
	};
}

export const backends: { [name: string]: BackendConstructor } = {
	AsyncMirror,
	Dropbox,
	Emscripten,
	FileSystemAccess,
	FolderAdapter,
	InMemory,
	IndexedDB,
	IsoFS,
	LocalStorage,
	MountableFileSystem,
	OverlayFS,
	WorkerFS,
	HTTPRequest,
	XmlHttpRequest: HTTPRequest,
	ZipFS,
};
