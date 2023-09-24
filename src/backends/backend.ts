import type { BFSCallback, FileSystem } from '../filesystem';
import { checkOptions } from '../utils';

/**
 * Describes a file system option.
 */
export interface BackendOption<T> {
	/**
	 * The basic JavaScript type(s) for this option.
	 */
	type: string | string[];

	/**
	 * Whether or not the option is optional (e.g., can be set to null or undefined).
	 * Defaults to `false`.
	 */
	optional?: boolean;

	/**
	 * Description of the option. Used in error messages and documentation.
	 */
	description: string;

	/**
	 * A custom validation function to check if the option is valid.
	 * Resolves if valid and rejects if not.
	 */
	validator?(opt: T): Promise<void>;
}

/**
 * Describes all of the options available in a file system.
 */
export interface BackendOptions {
	[name: string]: BackendOption<unknown>;
}

/**
 * Contains types for static functions on a backend.
 */
export interface BaseBackendConstructor<FS extends typeof FileSystem = typeof FileSystem> {
	new (...params: ConstructorParameters<FS>): InstanceType<FS>;

	/**
	 * A name to identify the backend.
	 */
	Name: string;

	/**
	 * Describes all of the options available for this backend.
	 */
	Options: BackendOptions;

	/**
	 * Whether the backend is available in the current environment.
	 * It supports checking synchronously and asynchronously
	 * Sync:
	 * Returns 'true' if this backend is available in the current
	 * environment. For example, a `localStorage`-backed filesystem will return
	 * 'false' if the browser does not support that API.
	 *
	 * Defaults to 'false', as the FileSystem base class isn't usable alone.
	 */
	isAvailable(): boolean;
}

/**
 * Contains types for static functions on a backend.
 */
export interface BackendConstructor<FS extends typeof FileSystem = typeof FileSystem> extends BaseBackendConstructor<FS> {
	/**
	 * Creates backend of this given type with the given
	 * options, and either returns the result in a promise or callback.
	 */
	Create(): Promise<InstanceType<FS>>;
	Create(options: object): Promise<InstanceType<FS>>;
	Create(cb: BFSCallback<InstanceType<FS>>): void;
	Create(options: object, cb: BFSCallback<InstanceType<FS>>): void;
	Create(options: object, cb?: BFSCallback<InstanceType<FS>>): Promise<InstanceType<FS>> | void;
}

export function CreateBackend<FS extends BaseBackendConstructor>(this: FS): Promise<InstanceType<FS>>;
export function CreateBackend<FS extends BaseBackendConstructor>(this: FS, options: BackendOptions): Promise<InstanceType<FS>>;
export function CreateBackend<FS extends BaseBackendConstructor>(this: FS, cb: BFSCallback<InstanceType<FS>>): void;
export function CreateBackend<FS extends BaseBackendConstructor>(this: FS, options: BackendOptions, cb: BFSCallback<InstanceType<FS>>): void;
export function CreateBackend<FS extends BaseBackendConstructor>(
	this: FS,
	options?: BackendOptions | BFSCallback<InstanceType<FS>>,
	cb?: BFSCallback<InstanceType<FS>>
): Promise<InstanceType<FS>> | void {
	cb = typeof options === 'function' ? options : cb;

	checkOptions(this, options);

	const fs = new this(typeof options === 'function' ? {} : options) as InstanceType<FS>;

	// Promise
	if (typeof cb != 'function') {
		return fs.whenReady();
	}

	// Callback
	fs.whenReady()
		.then(fs => cb(null, fs))
		.catch(err => cb(err));
}
