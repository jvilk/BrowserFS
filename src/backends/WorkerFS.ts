import { type FileSystem, BaseFileSystem, FileContents } from '../filesystem';
import { ApiError, ErrorCode } from '../ApiError';
import { File, FileFlag } from '../file';
import { default as Stats } from '../stats';
import Cred from '../cred';
import type { BackendOptions } from '.';

/**
 * @hidden
 */
declare const importScripts: (...path: string[]) => unknown;

/**
 * An RPC message
 */
interface RPCMessage {
	isBFS: true;
	id: number;
}

type _FSAsyncMethods = {
	[Method in keyof FileSystem]: Extract<FileSystem[Method], (...args: unknown[]) => Promise<unknown>>;
};

type _RPCFSRequests = {
	[Method in keyof _FSAsyncMethods]: { method: Method; args: Parameters<_FSAsyncMethods[Method]> };
};

type _RPCFSResponses = {
	[Method in keyof _FSAsyncMethods]: { method: Method; value: Awaited<ReturnType<_FSAsyncMethods[Method]>> };
};

interface RPCInitResponse {
	isReadOnly: boolean;
	supportsLinks: boolean;
	supportsProps: boolean;
}

/**
 * @see https://stackoverflow.com/a/60920767/17637456
 */
type RPCRequest = RPCMessage & (_RPCFSRequests[keyof _FSAsyncMethods] | { method: 'init'; args: [] } | { method: 'syncClose'; args: [string, File] });

type RPCResponse = RPCMessage & (_RPCFSResponses[keyof _FSAsyncMethods] | { method: 'init'; value: RPCInitResponse } | { method: 'syncClose'; value: null });

function isRPCMessage(arg: unknown): arg is RPCMessage {
	return typeof arg == 'object' && 'isBFS' in arg && !!arg.isBFS;
}

type _executor = Parameters<ConstructorParameters<typeof Promise>[0]>;
interface WorkerRequest {
	resolve: _executor[0];
	reject: _executor[1];
}

export interface WorkerFSOptions {
	// The target worker that you want to connect to, or the current worker if in a worker context.
	worker: Worker;
}

type _RPCExtractReturnValue<T extends RPCResponse['method']> = Promise<Extract<RPCResponse, { method: T }>['value']>;

/**
 * WorkerFS lets you access a BrowserFS instance that is running in a different
 * JavaScript context (e.g. access BrowserFS in one of your WebWorkers, or
 * access BrowserFS running on the main page from a WebWorker).
 *
 * For example, to have a WebWorker access files in the main browser thread,
 * do the following:
 *
 * MAIN BROWSER THREAD:
 *
 * ```javascript
 *   // Listen for remote file system requests.
 *   BrowserFS.Backend.WorkerFS.attachRemoteListener(webWorkerObject);
 * ```
 *
 * WEBWORKER THREAD:
 *
 * ```javascript
 *   // Set the remote file system as the root file system.
 *   BrowserFS.configure({ fs: "WorkerFS", options: { worker: self }}, function(e) {
 *     // Ready!
 *   });
 * ```
 *
 * Note that synchronous operations are not permitted on the WorkerFS, regardless
 * of the configuration option of the remote FS.
 */
export class WorkerFS extends BaseFileSystem implements FileSystem {
	public static readonly Name = 'WorkerFS';

	public static readonly Options: BackendOptions = {
		worker: {
			type: 'object',
			description: 'The target worker that you want to connect to, or the current worker if in a worker context.',
			validator: async (v: Worker): Promise<void> => {
				// Check for a `postMessage` function.
				if (typeof v?.postMessage != 'function') {
					throw new ApiError(ErrorCode.EINVAL, `option must be a Web Worker instance.`);
				}
			},
		},
	};

	public static async Create(opts: WorkerFSOptions): Promise<WorkerFS> {
		return new WorkerFS(opts.worker);
	}

	public static isAvailable(): boolean {
		return typeof importScripts !== 'undefined' || typeof Worker !== 'undefined';
	}

	private _worker: Worker;
	private _currentID: number = 0;
	private _requests: Map<number, WorkerRequest> = new Map();

	private _isInitialized: boolean = false;
	private _isReadOnly: boolean = false;
	private _supportLinks: boolean = false;
	private _supportProps: boolean = false;

	/**
	 * Constructs a new WorkerFS instance that connects with BrowserFS running on
	 * the specified worker.
	 */
	private constructor(worker: Worker) {
		super();
		this._worker = worker;
		this._worker.onmessage = (event: MessageEvent) => {
			if (!isRPCMessage(event.data)) {
				return;
			}
			const { id, method, value } = event.data as RPCResponse;

			if (method === 'init') {
				this._isReadOnly = value.isReadOnly;
				this._supportLinks = value.supportsLinks;
				this._supportProps = value.supportsProps;
				this._isInitialized = true;
				return;
			}

			const { resolve, reject } = this._requests.get(id);
			this._requests.delete(id);
			if (value instanceof Error || value instanceof ApiError) {
				reject(value);
				return;
			}
			resolve(value);
		};
	}

	public getName(): string {
		return WorkerFS.Name;
	}

	public isReadOnly(): boolean {
		return this._isReadOnly;
	}
	public supportsSynch(): boolean {
		return false;
	}
	public supportsLinks(): boolean {
		return this._supportLinks;
	}

	public supportsProps(): boolean {
		return this._supportProps;
	}

	private async _rpc<T extends RPCRequest['method']>(method: T, ...args: Extract<RPCRequest, { method: T }>['args']): _RPCExtractReturnValue<T> {
		return new Promise((resolve, reject) => {
			const id = this._currentID++;
			this._requests.set(id, { resolve, reject });
			this._worker.postMessage({
				isBFS: true,
				id,
				method,
				args,
			} as RPCRequest);
		});
	}

	public rename(oldPath: string, newPath: string, cred: Cred): Promise<void> {
		return this._rpc('rename', oldPath, newPath, cred);
	}
	public stat(p: string, isLstat: boolean, cred: Cred): Promise<Stats> {
		return this._rpc('stat', p, isLstat, cred);
	}
	public open(p: string, flag: FileFlag, mode: number, cred: Cred): Promise<File> {
		return this._rpc('open', p, flag, mode, cred);
	}
	public unlink(p: string, cred: Cred): Promise<void> {
		return this._rpc('unlink', p, cred);
	}
	public rmdir(p: string, cred: Cred): Promise<void> {
		return this._rpc('rmdir', p, cred);
	}
	public mkdir(p: string, mode: number, cred: Cred): Promise<void> {
		return this._rpc('mkdir', p, mode, cred);
	}
	public readdir(p: string, cred: Cred): Promise<string[]> {
		return this._rpc('readdir', p, cred);
	}
	public exists(p: string, cred: Cred): Promise<boolean> {
		return this._rpc('exists', p, cred);
	}
	public realpath(p: string, cache: { [path: string]: string }, cred: Cred): Promise<string> {
		return this._rpc('realpath', p, cache, cred);
	}
	public truncate(p: string, len: number, cred: Cred): Promise<void> {
		return this._rpc('truncate', p, len, cred);
	}
	public readFile(fname: string, encoding: BufferEncoding, flag: FileFlag, cred: Cred): Promise<FileContents> {
		return this._rpc('readFile', fname, encoding, flag, cred);
	}
	public writeFile(fname: string, data: FileContents, encoding: BufferEncoding, flag: FileFlag, mode: number, cred: Cred): Promise<void> {
		return this._rpc('writeFile', fname, data, encoding, flag, mode, cred);
	}
	public appendFile(fname: string, data: FileContents, encoding: BufferEncoding, flag: FileFlag, mode: number, cred: Cred): Promise<void> {
		return this._rpc('appendFile', fname, data, encoding, flag, mode, cred);
	}
	public chmod(p: string, isLchmod: boolean, mode: number, cred: Cred): Promise<void> {
		return this._rpc('chmod', p, isLchmod, mode, cred);
	}
	public chown(p: string, isLchown: boolean, new_uid: number, new_gid: number, cred: Cred): Promise<void> {
		return this._rpc('chown', p, isLchown, new_uid, new_gid, cred);
	}
	public utimes(p: string, atime: Date, mtime: Date, cred: Cred): Promise<void> {
		return this._rpc('utimes', p, atime, mtime, cred);
	}
	public link(srcpath: string, dstpath: string, cred: Cred): Promise<void> {
		return this._rpc('link', srcpath, dstpath, cred);
	}
	public symlink(srcpath: string, dstpath: string, type: string, cred: Cred): Promise<void> {
		return this._rpc('symlink', srcpath, dstpath, type, cred);
	}
	public readlink(p: string, cred: Cred): Promise<string> {
		return this._rpc('readlink', p, cred);
	}

	public syncClose(method: string, fd: File): Promise<void> {
		return this._rpc('syncClose', method, fd);
	}
}
