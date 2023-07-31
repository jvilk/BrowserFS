import { BFSCallback, BaseFileSystem, FileSystem, BackendOptions } from '../core/file_system';
import { ApiError, ErrorCode } from '../core/api_error';
import { FileFlag } from '../core/file_flag';
import { buffer2ArrayBuffer, emptyBuffer } from '../core/util';
import { File, BaseFile } from '../core/file';
import { default as Stats } from '../core/stats';
import PreloadFile from '../generic/preload_file';
import fs from '../core/node_fs';
import Cred from '../core/cred';
import { Buffer } from 'buffer';

/**
 * @hidden
 */
declare const importScripts: Function;

/**
 * @hidden
 */
interface BrowserFSMessage {
	browserfsMessage: boolean;
}

/**
 * @hidden
 */
enum SpecialArgType {
	// Callback
	CB,
	// File descriptor
	FD,
	// API error
	API_ERROR,
	// Stats object
	STATS,
	// Initial probe for file system information.
	PROBE,
	// FileFlag object.
	FILEFLAG,
	// Buffer object.
	BUFFER,
	// Generic Error object.
	ERROR,
}

/**
 * @hidden
 */
interface SpecialArgument {
	type: SpecialArgType;
}

/**
 * @hidden
 */
type APIArgument = SpecialArgument | string | number;

/**
 * @hidden
 */
interface ProbeResponse extends SpecialArgument {
	isReadOnly: boolean;
	supportsLinks: boolean;
	supportsProps: boolean;
}

/**
 * @hidden
 */
interface PendingRequest {
	resolve: (data: APIResponse) => unknown;
	reject: (err: APIResponse) => unknown;
}

/**
 * @hidden
 */
interface CallbackArgument extends SpecialArgument {
	// The callback ID.
	id: number;
}

/**
 * Converts callback arguments into CallbackArgument objects, and back
 * again.
 * @hidden
 */
class CallbackArgumentConverter {
	private _requests: Map<number, Function> = new Map();
	private _nextId: number = 0;

	public toRemoteArg(cb: Function): CallbackArgument {
		const id = this._nextId++;
		this._requests.set(id, cb);
		return {
			type: SpecialArgType.CB,
			id,
		};
	}

	public toLocalArg(id: number): Function {
		const cb = this._requests.get(id);
		this._requests.delete(id);
		return cb;
	}
}

/**
 * @hidden
 */
interface FileDescriptorArgument extends SpecialArgument {
	// The file descriptor's id on the remote side.
	id: number;
	// The entire file's data, as an array buffer.
	data: ArrayBuffer | SharedArrayBuffer;
	// The file's stat object, as an array buffer.
	stat: ArrayBuffer | SharedArrayBuffer;
	// The path to the file.
	path: string;
	// The flag of the open file descriptor.
	flag: string;
}

/**
 * @hidden
 */
class FileDescriptorArgumentConverter {
	private _fileDescriptors: { [id: number]: File } = {};
	private _nextId: number = 0;

	public async toRemoteArg(fd: File, p: string, flag: FileFlag): Promise<FileDescriptorArgument> {
		const id = this._nextId++;
		this._fileDescriptors[id] = fd;

		// Extract needed information asynchronously.
		const stats = await fd.stat(),
			stat = bufferToTransferrableObject(stats!.toBuffer());
		// If it's a readable flag, we need to grab contents.
		if (flag.isReadable()) {
			const buff = Buffer.alloc(stats.size);
			await fd.read(buff, 0, stat.byteLength, 0);
			const data = bufferToTransferrableObject(buff);
			return {
				type: SpecialArgType.FD,
				id: id,
				data: data,
				stat: stat,
				path: p,
				flag: flag.getFlagString(),
			};
		} else {
			// File is not readable, which means writing to it will append or
			// truncate/replace existing contents. Return an empty arraybuffer.
			return {
				type: SpecialArgType.FD,
				id: id,
				data: new ArrayBuffer(0),
				stat: stat,
				path: p,
				flag: flag.getFlagString(),
			};
		}
	}

	public async applyFdAPIRequest(request: APIRequest): Promise<void> {
		const fdArg = <FileDescriptorArgument>request.args[0];
		const fd = await this._applyFdChanges(fdArg);
		// Apply method on now-changed file descriptor.
		await fd[request.method]();
		if (request.method === 'close') {
			delete this._fileDescriptors[fdArg.id];
		}
	}

	private async _applyFdChanges(remoteFd: FileDescriptorArgument): Promise<File> {
		const fd = this._fileDescriptors[remoteFd.id],
			data = transferrableObjectToBuffer(remoteFd.data),
			remoteStats = Stats.fromBuffer(transferrableObjectToBuffer(remoteFd.stat)),
			flag = FileFlag.getFileFlag(remoteFd.flag);
		if (!flag.isWriteable()) {
			return fd;
		}
		// Appendable: Write to end of file.
		// Writeable: Replace entire contents of file.
		await fd.write(data, 0, data.length, flag.isAppendable() ? fd.getPos()! : 0);

		// If writeable & not appendable, we need to ensure file contents are
		// identical to those from the remote FD. Thus, we truncate to the
		// length of the remote file.
		if (!flag.isAppendable()) {
			await fd.truncate(data.length);
		}

		// Check if mode changed.
		const stats = await fd.stat();
		if (stats.mode !== remoteStats.mode) {
			await fd.chmod(remoteStats.mode);
		}
		return fd;
	}
}

/**
 * @hidden
 */
interface APIErrorArgument extends SpecialArgument {
	// The error object, as an array buffer.
	errorData: ArrayBuffer | SharedArrayBuffer;
}

/**
 * @hidden
 */
function apiErrorLocal2Remote(e: ApiError): APIErrorArgument {
	return {
		type: SpecialArgType.API_ERROR,
		errorData: bufferToTransferrableObject(e.writeToBuffer()),
	};
}

/**
 * @hidden
 */
function apiErrorRemote2Local(e: APIErrorArgument): ApiError {
	return ApiError.fromBuffer(transferrableObjectToBuffer(e.errorData));
}

/**
 * @hidden
 */
interface ErrorArgument extends SpecialArgument {
	// The name of the error (e.g. 'TypeError').
	name: string;
	// The message associated with the error.
	message: string;
	// The stack associated with the error.
	stack: string;
}

/**
 * @hidden
 */
function errorLocal2Remote(e: Error): ErrorArgument {
	return {
		type: SpecialArgType.ERROR,
		name: e.name,
		message: e.message,
		stack: e.stack!,
	};
}

/**
 * @hidden
 */
function errorRemote2Local(e: ErrorArgument): Error {
	let cnstr: {
		new (msg: string): Error;
	} = globalThis[e.name];
	if (typeof cnstr !== 'function') {
		cnstr = Error;
	}
	const err = new cnstr(e.message);
	err.stack = e.stack;
	return err;
}

/**
 * @hidden
 */
interface StatsArgument extends SpecialArgument {
	// The stats object as an array buffer.
	statsData: ArrayBuffer | SharedArrayBuffer;
}

/**
 * @hidden
 */
function statsLocal2Remote(stats: Stats): StatsArgument {
	return {
		type: SpecialArgType.STATS,
		statsData: bufferToTransferrableObject(stats.toBuffer()),
	};
}

/**
 * @hidden
 */
function statsRemote2Local(stats: StatsArgument): Stats {
	return Stats.fromBuffer(transferrableObjectToBuffer(stats.statsData));
}

/**
 * @hidden
 */
interface FileFlagArgument extends SpecialArgument {
	flagStr: string;
}

/**
 * @hidden
 */
function fileFlagLocal2Remote(flag: FileFlag): FileFlagArgument {
	return {
		type: SpecialArgType.FILEFLAG,
		flagStr: flag.getFlagString(),
	};
}

/**
 * @hidden
 */
function fileFlagRemote2Local(remoteFlag: FileFlagArgument): FileFlag {
	return FileFlag.getFileFlag(remoteFlag.flagStr);
}

/**
 * @hidden
 */
interface BufferArgument extends SpecialArgument {
	data: ArrayBuffer | SharedArrayBuffer;
}

/**
 * @hidden
 */
function bufferToTransferrableObject(buff: Buffer): ArrayBuffer | SharedArrayBuffer {
	return buffer2ArrayBuffer(buff);
}

/**
 * @hidden
 */
function transferrableObjectToBuffer(buff: ArrayBuffer | SharedArrayBuffer): Buffer {
	return Buffer.from(buff);
}

/**
 * @hidden
 */
function bufferLocal2Remote(buff: Buffer): BufferArgument {
	return {
		type: SpecialArgType.BUFFER,
		data: bufferToTransferrableObject(buff),
	};
}

/**
 * @hidden
 */
function bufferRemote2Local(buffArg: BufferArgument): Buffer {
	return transferrableObjectToBuffer(buffArg.data);
}

/**
 * @hidden
 */
interface APIRequest extends BrowserFSMessage {
	method: string;
	args: Array<number | string | SpecialArgument>;
}

/**
 * @hidden
 */
function isAPIRequest(data: any): data is APIRequest {
	return data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'browserfsMessage') && data['browserfsMessage'];
}

/**
 * @hidden
 */
interface APIResponse extends BrowserFSMessage {
	id: number;
	args: APIArgument[];
}

/**
 * @hidden
 */
function isAPIResponse(data: any): data is APIResponse {
	return data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'browserfsMessage') && data['browserfsMessage'];
}

/**
 * Represents a remote file in a different worker/thread.
 */
class WorkerFile extends PreloadFile<WorkerFS> {
	private _remoteFdId: number;

	constructor(_fs: WorkerFS, _path: string, _flag: FileFlag, _stat: Stats, remoteFdId: number, contents?: Buffer) {
		super(_fs, _path, _flag, _stat, contents);
		this._remoteFdId = remoteFdId;
	}

	public getRemoteFdId() {
		return this._remoteFdId;
	}

	/**
	 * @hidden
	 */
	public toRemoteArg(): FileDescriptorArgument {
		return {
			type: SpecialArgType.FD,
			id: this._remoteFdId,
			data: bufferToTransferrableObject(this.getBuffer()),
			stat: bufferToTransferrableObject(this.getStats().toBuffer()),
			path: this.getPath(),
			flag: this.getFlag().getFlagString(),
		};
	}

	public async sync(): Promise<void> {
		return this._syncClose('sync');
	}

	public async close(): Promise<void> {
		return this._syncClose('close');
	}

	private async _syncClose(type: string): Promise<void> {
		if (this.isDirty()) {
			await (<WorkerFS>this._fs).syncClose(type, this);
			this.resetDirty();
		}
	}
}

export interface WorkerFSOptions {
	// The target worker that you want to connect to, or the current worker if in a worker context.
	worker: Worker;
}

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
 *   BrowserFS.FileSystem.WorkerFS.attachRemoteListener(webWorkerObject);
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
export default class WorkerFS extends BaseFileSystem implements FileSystem {
	public static readonly Name = 'WorkerFS';

	public static readonly Options: BackendOptions = {
		worker: {
			type: 'object',
			description: 'The target worker that you want to connect to, or the current worker if in a worker context.',
			validator: async (v: Worker): Promise<void> => {
				// Check for a `postMessage` function.
				if (!v?.postMessage) {
					throw new ApiError(ErrorCode.EINVAL, `option must be a Web Worker instance.`);
				}
			},
		},
	};

	public static Create(opts: WorkerFSOptions, cb: BFSCallback<WorkerFS>): void {
		this.CreateAsync(opts)
			.then(fs => cb(null, fs))
			.catch(cb);
	}

	public static async CreateAsync(opts: WorkerFSOptions): Promise<WorkerFS> {
		const fs = new WorkerFS(opts.worker);
		await fs._initialize();
		return fs;
	}

	public static isAvailable(): boolean {
		return typeof importScripts !== 'undefined' || typeof Worker !== 'undefined';
	}

	/**
	 * Attaches a listener to the remote worker for file system requests.
	 */
	public static attachRemoteListener(worker: Worker) {
		const fdConverter = new FileDescriptorArgumentConverter();

		async function argLocal2Remote(arg: any, requestArgs: any[]) {
			if (typeof arg != 'object') {
				return arg;
			}
			if (arg instanceof Stats) {
				return statsLocal2Remote(arg);
			} else if (arg instanceof ApiError) {
				return apiErrorLocal2Remote(arg);
			} else if (arg instanceof BaseFile) {
				// Pass in p and flags from original request.
				return await fdConverter.toRemoteArg(<File>arg, requestArgs[0], requestArgs[1]);
			} else if (arg instanceof FileFlag) {
				return fileFlagLocal2Remote(arg);
			} else if (arg instanceof Buffer) {
				return bufferLocal2Remote(arg);
			} else if (arg instanceof Error) {
				return errorLocal2Remote(arg);
			} else {
				return arg;
			}
		}

		function argRemote2Local(arg: string | number | SpecialArgument, fixedRequestArgs: any[]): any {
			if (!arg || typeof arg != 'object' || typeof arg?.type != 'number') {
				return arg;
			}
			switch (arg.type) {
				case SpecialArgType.CB:
					const cbId = (<CallbackArgument>arg).id;
					return async function (...args) {
						const fixedArgs = new Array(args.length);

						for (let i = 0; i < args.length; i++) {
							try {
								fixedArgs[i] = await argLocal2Remote(arg, fixedRequestArgs);
							} catch (err) {
								worker.postMessage({
									browserfsMessage: true,
									cbId,
									args: [apiErrorLocal2Remote(err)],
								});
								return;
							}
						}

						worker.postMessage({
							browserfsMessage: true,
							cbId,
							args: fixedArgs,
						});
					};
				case SpecialArgType.API_ERROR:
					return apiErrorRemote2Local(<APIErrorArgument>arg);
				case SpecialArgType.STATS:
					return statsRemote2Local(<StatsArgument>arg);
				case SpecialArgType.FILEFLAG:
					return fileFlagRemote2Local(<FileFlagArgument>arg);
				case SpecialArgType.BUFFER:
					return bufferRemote2Local(<BufferArgument>arg);
				case SpecialArgType.ERROR:
					return errorRemote2Local(<ErrorArgument>arg);
				default:
					// No idea what this is.
					return arg;
			}
		}

		worker.addEventListener('message', async (e: MessageEvent) => {
			if (isAPIRequest(e.data)) {
				const args = e.data.args,
					fixedArgs = new Array<any>(args.length),
					rootFs = fs.getRootFS();

				switch (e.data.method) {
					case 'close':
					case 'sync':
						// File descriptor-relative methods.
						let err;
						try {
							await fdConverter.applyFdAPIRequest(e.data);
						} catch (e) {
							err = e;
						} finally {
							worker.postMessage({
								browserfsMessage: true,
								cbId: (<CallbackArgument>args[1]).id,
								args: err ? [apiErrorLocal2Remote(err)] : [],
							});
						}
						break;
					case 'probe':
						worker.postMessage({
							browserfsMessage: true,
							cbId: (<CallbackArgument>args[1]).id,
							args: [
								{
									type: SpecialArgType.PROBE,
									isReadOnly: rootFs.isReadOnly(),
									supportsLinks: rootFs.supportsLinks(),
									supportsProps: rootFs.supportsProps(),
								},
							],
						});
						break;
					default:
						// File system methods.
						for (let i = 0; i < args.length; i++) {
							fixedArgs[i] = argRemote2Local(args[i], fixedArgs);
						}
						fs.getRootFS()[e.data.method](...fixedArgs);
						break;
				}
			}
		});
	}

	private _worker: Worker;
	private _pendingRequestID: number = 0;
	private _pendingRequests: Map<number, PendingRequest> = new Map();

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
		this._worker.addEventListener('message', (e: MessageEvent) => {
			if (isAPIResponse(e.data)) {
				if (!this._pendingRequests.has(e.data.id)) {
					throw new ApiError(ErrorCode.EIO, `WorkerFS sent a response for a request that did not exist (request #${e.data.id})`);
				}
				const req = this._pendingRequests.get(e.data.id);
				this._pendingRequests.delete(e.data.id);
				req.resolve(e.data);
			}
		});
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
	public readFile(fname: string, encoding: string, flag: FileFlag, cred: Cred): Promise<Buffer> {
		return this._rpc('readFile', fname, encoding, flag, cred);
	}
	public writeFile(fname: string, data: any, encoding: string, flag: FileFlag, mode: number, cred: Cred): Promise<void> {
		return this._rpc('writeFile', fname, data, encoding, flag, mode, cred);
	}
	public appendFile(fname: string, data: any, encoding: string, flag: FileFlag, mode: number, cred: Cred): Promise<void> {
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
		return this._rpc(method, fd);
	}

	private post(request: APIRequest): Promise<APIResponse> {
		this._worker.postMessage(request);

		return new Promise((resolve, reject) => {
			this._pendingRequests.set(this._pendingRequestID++, { resolve, reject });
		});
	}

	private async _rpc(method: string, ...args: any[]): Promise<any> {
		const response = await this.post({
			browserfsMessage: true,
			method,
			args: args.map(arg => this._argLocal2Remote(arg)),
		});
		return response.args.map(arg => this._argRemote2Local(arg));
	}

	/**
	 * Called once both local and remote sides are set up.
	 */
	private async _initialize(): Promise<void> {
		if (this._isInitialized) {
			return;
		}
		const probeResponse = await this._rpc('probe', emptyBuffer());
		this._isInitialized = true;
		this._isReadOnly = probeResponse.isReadOnly;
		this._supportLinks = probeResponse.supportsLinks;
		this._supportProps = probeResponse.supportsProps;
	}

	private _argRemote2Local(arg: any): any {
		if (!arg) {
			return arg;
		}
		switch (typeof arg) {
			case 'object':
				if (typeof arg['type'] === 'number') {
					const specialArg = <SpecialArgument>arg;
					switch (specialArg.type) {
						case SpecialArgType.API_ERROR:
							return apiErrorRemote2Local(<APIErrorArgument>specialArg);
						case SpecialArgType.FD:
							const fdArg = <FileDescriptorArgument>specialArg;
							return new WorkerFile(
								this,
								fdArg.path,
								FileFlag.getFileFlag(fdArg.flag),
								Stats.fromBuffer(transferrableObjectToBuffer(fdArg.stat)),
								fdArg.id,
								transferrableObjectToBuffer(fdArg.data)
							);
						case SpecialArgType.STATS:
							return statsRemote2Local(<StatsArgument>specialArg);
						case SpecialArgType.FILEFLAG:
							return fileFlagRemote2Local(<FileFlagArgument>specialArg);
						case SpecialArgType.BUFFER:
							return bufferRemote2Local(<BufferArgument>specialArg);
						case SpecialArgType.ERROR:
							return errorRemote2Local(<ErrorArgument>specialArg);
						default:
							return arg;
					}
				} else {
					return arg;
				}
			default:
				return arg;
		}
	}

	/**
	 * Converts a local argument into a remote argument. Public so WorkerFile objects can call it.
	 */
	private _argLocal2Remote(arg: any): any {
		if (!arg) {
			return arg;
		}
		switch (typeof arg) {
			case 'object':
				if (arg instanceof Stats) {
					return statsLocal2Remote(arg);
				} else if (arg instanceof ApiError) {
					return apiErrorLocal2Remote(arg);
				} else if (arg instanceof WorkerFile) {
					return (<WorkerFile>arg).toRemoteArg();
				} else if (arg instanceof FileFlag) {
					return fileFlagLocal2Remote(arg);
				} else if (arg instanceof Buffer) {
					return bufferLocal2Remote(arg);
				} else if (arg instanceof Error) {
					return errorLocal2Remote(arg);
				} else {
					return 'Unknown argument';
				}
			default:
				return arg;
		}
	}
}
