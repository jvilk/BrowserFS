import { type FileSystem, SynchronousFileSystem, FileSystemMetadata } from '../filesystem';
import { ApiError, ErrorCode } from '../ApiError';
import { File, FileFlag } from '../file';
import { Stats } from '../stats';
import PreloadFile from '../generic/preload_file';
import * as path from 'path';
import { Cred } from '../cred';
import { CreateBackend, type BackendOptions } from './backend';

/**
 * @hidden
 */
interface AsyncOperation {
	apiMethod: string;
	arguments: any[];
}

/**
 * We define our own file to interpose on syncSync() for mirroring purposes.
 */
class MirrorFile extends PreloadFile<AsyncMirror> implements File {
	constructor(fs: AsyncMirror, path: string, flag: FileFlag, stat: Stats, data: Buffer) {
		super(fs, path, flag, stat, data);
	}

	public syncSync(): void {
		if (this.isDirty()) {
			this._fs._syncSync(this);
			this.resetDirty();
		}
	}

	public closeSync(): void {
		this.syncSync();
	}
}

export namespace AsyncMirror {
	/**
	 * Configuration options for the AsyncMirror file system.
	 */
	export interface Options {
		/**
		 * The synchronous file system to mirror the asynchronous file system to.
		 */
		sync: FileSystem;
		/**
		 * The asynchronous file system to mirror.
		 */
		async: FileSystem;
	}
}

/**
 * AsyncMirrorFS mirrors a synchronous filesystem into an asynchronous filesystem
 * by:
 *
 * * Performing operations over the in-memory copy, while asynchronously pipelining them
 *   to the backing store.
 * * During application loading, the contents of the async file system can be reloaded into
 *   the synchronous store, if desired.
 *
 * The two stores will be kept in sync. The most common use-case is to pair a synchronous
 * in-memory filesystem with an asynchronous backing store.
 *
 * Example: Mirroring an IndexedDB file system to an in memory file system. Now, you can use
 * IndexedDB synchronously.
 *
 * ```javascript
 * BrowserFS.configure({
 *   fs: "AsyncMirror",
 *   options: {
 *     sync: { fs: "InMemory" },
 *     async: { fs: "IndexedDB" }
 *   }
 * }, function(e) {
 *   // BrowserFS is initialized and ready-to-use!
 * });
 * ```
 *
 * Or, alternatively:
 *
 * ```javascript
 * BrowserFS.Backend.IndexedDB.Create(function(e, idbfs) {
 *   BrowserFS.Backend.InMemory.Create(function(e, inMemory) {
 *     BrowserFS.Backend.AsyncMirror({
 *       sync: inMemory, async: idbfs
 *     }, function(e, mirrored) {
 *       BrowserFS.initialize(mirrored);
 *     });
 *   });
 * });
 * ```
 */
export class AsyncMirror extends SynchronousFileSystem {
	public static readonly Name = 'AsyncMirror';

	public static Create = CreateBackend.bind(this);

	public static readonly Options: BackendOptions = {
		sync: {
			type: 'object',
			description: 'The synchronous file system to mirror the asynchronous file system to.',
			validator: async (v: FileSystem): Promise<void> => {
				if (!v?.metadata.synchronous) {
					throw new ApiError(ErrorCode.EINVAL, `'sync' option must be a file system that supports synchronous operations`);
				}
			},
		},
		async: {
			type: 'object',
			description: 'The asynchronous file system to mirror.',
		},
	};

	public static isAvailable(): boolean {
		return true;
	}

	/**
	 * Queue of pending asynchronous operations.
	 */
	private _queue: AsyncOperation[] = [];
	private _queueRunning: boolean = false;
	private _sync: FileSystem;
	private _async: FileSystem;
	private _isInitialized: boolean = false;
	private _initializeCallbacks: ((e?: ApiError) => void)[] = [];

	/**
	 *
	 * Mirrors the synchronous file system into the asynchronous file system.
	 *
	 * @param sync The synchronous file system to mirror the asynchronous file system to.
	 * @param async The asynchronous file system to mirror.
	 */
	constructor({ sync, async }: AsyncMirror.Options) {
		super();
		this._sync = sync;
		this._async = async;
		this._ready = this._initialize();
	}

	public get metadata(): FileSystemMetadata {
		return {
			...super.metadata,
			name: AsyncMirror.Name,
			synchronous: true,
			supportsProperties: this._sync.metadata.supportsProperties && this._async.metadata.supportsProperties,
		};
	}

	public _syncSync(fd: PreloadFile<AsyncMirror>) {
		const stats = fd.getStats();
		this._sync.writeFileSync(fd.getPath(), fd.getBuffer(), null, FileFlag.getFileFlag('w'), stats.mode, stats.getCred(0, 0));
		this.enqueueOp({
			apiMethod: 'writeFile',
			arguments: [fd.getPath(), fd.getBuffer(), null, fd.getFlag(), stats.mode, stats.getCred(0, 0)],
		});
	}

	public renameSync(oldPath: string, newPath: string, cred: Cred): void {
		this._sync.renameSync(oldPath, newPath, cred);
		this.enqueueOp({
			apiMethod: 'rename',
			arguments: [oldPath, newPath, cred],
		});
	}

	public statSync(p: string, cred: Cred): Stats {
		return this._sync.statSync(p, cred);
	}

	public openSync(p: string, flag: FileFlag, mode: number, cred: Cred): File {
		// Sanity check: Is this open/close permitted?
		const fd = this._sync.openSync(p, flag, mode, cred);
		fd.closeSync();
		return new MirrorFile(this, p, flag, this._sync.statSync(p, cred), <Buffer>this._sync.readFileSync(p, null, FileFlag.getFileFlag('r'), cred));
	}

	public unlinkSync(p: string, cred: Cred): void {
		this._sync.unlinkSync(p, cred);
		this.enqueueOp({
			apiMethod: 'unlink',
			arguments: [p, cred],
		});
	}

	public rmdirSync(p: string, cred: Cred): void {
		this._sync.rmdirSync(p, cred);
		this.enqueueOp({
			apiMethod: 'rmdir',
			arguments: [p, cred],
		});
	}

	public mkdirSync(p: string, mode: number, cred: Cred): void {
		this._sync.mkdirSync(p, mode, cred);
		this.enqueueOp({
			apiMethod: 'mkdir',
			arguments: [p, mode, cred],
		});
	}

	public readdirSync(p: string, cred: Cred): string[] {
		return this._sync.readdirSync(p, cred);
	}

	public existsSync(p: string, cred: Cred): boolean {
		return this._sync.existsSync(p, cred);
	}

	public chmodSync(p: string, mode: number, cred: Cred): void {
		this._sync.chmodSync(p, mode, cred);
		this.enqueueOp({
			apiMethod: 'chmod',
			arguments: [p, mode, cred],
		});
	}

	public chownSync(p: string, new_uid: number, new_gid: number, cred: Cred): void {
		this._sync.chownSync(p, new_uid, new_gid, cred);
		this.enqueueOp({
			apiMethod: 'chown',
			arguments: [p, new_uid, new_gid, cred],
		});
	}

	public utimesSync(p: string, atime: Date, mtime: Date, cred: Cred): void {
		this._sync.utimesSync(p, atime, mtime, cred);
		this.enqueueOp({
			apiMethod: 'utimes',
			arguments: [p, atime, mtime, cred],
		});
	}

	/**
	 * Called once to load up files from async storage into sync storage.
	 */
	private async _initialize(): Promise<this> {
		if (!this._isInitialized) {
			// First call triggers initialization, the rest wait.
			const copyDirectory = async (p: string, mode: number): Promise<void> => {
					if (p !== '/') {
						const stats = await this._async.stat(p, Cred.Root);
						this._sync.mkdirSync(p, mode, stats.getCred());
					}
					const files = await this._async.readdir(p, Cred.Root);
					for (const file of files) {
						await copyItem(path.join(p, file));
					}
				},
				copyFile = async (p: string, mode: number): Promise<void> => {
					const data = await this._async.readFile(p, null, FileFlag.getFileFlag('r'), Cred.Root);
					this._sync.writeFileSync(p, data, null, FileFlag.getFileFlag('w'), mode, Cred.Root);
				},
				copyItem = async (p: string): Promise<void> => {
					const stats = await this._async.stat(p, Cred.Root);
					if (stats.isDirectory()) {
						await copyDirectory(p, stats.mode);
					} else {
						await copyFile(p, stats.mode);
					}
				};
			try {
				await copyDirectory('/', 0);
				this._isInitialized = true;
			} catch (e) {
				this._isInitialized = false;
				throw e;
			}
		}
		return this;
	}

	private enqueueOp(op: AsyncOperation) {
		this._queue.push(op);
		if (!this._queueRunning) {
			this._queueRunning = true;
			const doNextOp = (err?: ApiError) => {
				if (err) {
					throw new Error(`WARNING: File system has desynchronized. Received following error: ${err}\n$`);
				}
				if (this._queue.length > 0) {
					const op = this._queue.shift()!;
					op.arguments.push(doNextOp);
					(<Function>this._async[op.apiMethod]).apply(this._async, op.arguments);
				} else {
					this._queueRunning = false;
				}
			};
			doNextOp();
		}
	}
}
