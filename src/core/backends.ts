import type { BFSCallback, FileSystem } from './file_system';
import { checkOptions } from './util';
import { AsyncMirror } from '../backend/AsyncMirror';
import { DropboxFileSystem as Dropbox } from '../backend/Dropbox';
import { EmscriptenFileSystem as Emscripten } from '../backend/Emscripten';
import { FileSystemAccessFileSystem as FileSystemAccess } from '../backend/FileSystemAccess';
import { FolderAdapter } from '../backend/FolderAdapter';
import { InMemoryFileSystem as InMemory } from '../backend/InMemory';
import { IndexedDBFileSystem as IndexedDB } from '../backend/IndexedDB';
import { LocalStorageFileSystem as LocalStorage } from '../backend/LocalStorage';
import { MountableFileSystem } from '../backend/MountableFileSystem';
import { OverlayFS } from '../backend/OverlayFS';
import { WorkerFS } from '../backend/WorkerFS';
import { HTTPRequest } from '../backend/HTTPRequest';
import { ZipFS } from '../backend/ZipFS';
import { IsoFS } from '../backend/IsoFS';

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
 * Contains typings for static functions on the internal backend constructors.
 */
interface InternalBackendConstructor<FS extends FileSystem = FileSystem> {
	/**
	 * **Core**: Name to identify this backend.
	 */
	Name: string;

	/**
	 * **Core**: Describes all of the options available for this backend.
	 */
	Options: BackendOptions;

	/**
	 * **Core**: Creates backend of this given type with the given
	 * options, and returns the result in a promise.
	 */
	Create(options: object): Promise<FS>;

	/**
	 * **Core**: Returns 'true' if this backend is available in the current
	 * environment. For example, a `localStorage`-backed filesystem will return
	 * 'false' if the browser does not support that API.
	 *
	 * Defaults to 'false', as the FileSystem base class isn't usable alone.
	 */
	isAvailable(): boolean;
}

/**
 * Contains typings for static functions on the backend constructor.
 */
export interface BackendConstructor<FS extends FileSystem = FileSystem> {
	/**
	 * **Core**: Name to identify this backend.
	 */
	Name: string;

	/**
	 * **Core**: Describes all of the options available for this backend.
	 */
	Options: BackendOptions;

	/**
	 * **Core**: Creates backend of this given type with the given
	 * options, and either returns the result in a promise or callback.
	 */
	Create(): Promise<FS>;
	Create(options: object): Promise<FS>;
	Create(cb: BFSCallback<FS>): void;
	Create(options: object, cb: BFSCallback<FS>): void;
	Create(options: object, cb?: BFSCallback<FS>): Promise<FS> | void;

	/**
	 * **Core**: Returns 'true' if this backend is available in the current
	 * environment. For example, a `localStorage`-backed filesystem will return
	 * 'false' if the browser does not support that API.
	 *
	 * Defaults to 'false', as the FileSystem base class isn't usable alone.
	 */
	isAvailable(): boolean;
}

type UnwrapInternalCreate<T> = T extends { Create: (...args: unknown[]) => Promise<infer U> } ? U : never;
const _backends = {
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
const backends = _backends as { [K in keyof typeof _backends]: InternalBackendConstructor } as {
	[K in keyof typeof _backends]: BackendConstructor<UnwrapInternalCreate<(typeof _backends)[K]>>;
};

// Monkey-patch `Create` functions to check options before file system initialization and add `Create`.
for (const backend of Object.values(backends) as BackendConstructor[]) {
	/* eslint-disable no-inner-declarations */
	const __create = backend.Create;
	async function _create(options: object) {
		await checkOptions(backend, options);
		return __create.call(backend, options);
	}

	function create(): Promise<FileSystem>;
	function create(opts: object): Promise<FileSystem>;
	function create(cb: BFSCallback<FileSystem>): void;
	function create(opts: object, cb: BFSCallback<FileSystem>): void;
	function create(opts?: object, cb?: BFSCallback<FileSystem>): Promise<FileSystem> | void {
		const oneArg = typeof opts === 'function';
		const normalizedCb = oneArg ? opts : cb;
		const normalizedOpts = oneArg ? {} : opts;

		// Promise
		if (typeof normalizedCb != 'function') {
			return _create(normalizedOpts);
		}

		// Callback
		_create(normalizedOpts)
			.then(fs => normalizedCb(null, fs))
			.catch(err => normalizedCb(err));
	}

	backend.Create = create;

	/* eslint-enable no-inner-declarations */
}

export { backends };
