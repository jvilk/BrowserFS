import { SynchronousFileSystem } from '../filesystem';
import { Stats, FileType } from '../stats';
import { BaseFile, File, FileFlag } from '../file';
import { ApiError, ErrorCode, ErrorStrings } from '../ApiError';
import { EmscriptenFSNode } from '../generic/emscripten_fs';
import { Cred } from '../cred';
import { Buffer } from 'buffer';
import type { BackendOptions } from './index';

/**
 * @hidden
 */
interface EmscriptenError {
	node: EmscriptenFSNode;
	errno: number;
}

/**
 * @hidden
 */
function convertError(e: EmscriptenError, path: string = ''): ApiError {
	const errno = e.errno;
	let parent = e.node;
	const paths: string[] = [];
	while (parent) {
		paths.unshift(parent.name);
		if (parent === parent.parent) {
			break;
		}
		parent = parent.parent;
	}
	return new ApiError(errno, ErrorStrings[errno], paths.length > 0 ? '/' + paths.join('/') : path);
}

export class EmscriptenFile extends BaseFile implements File {
	constructor(private _fs: EmscriptenFileSystem, private _FS: any, private _path: string, private _stream: any) {
		super();
	}
	public getPos(): number | undefined {
		return undefined;
	}
	public async close(): Promise<void> {
		return this.closeSync();
	}
	public closeSync(): void {
		try {
			this._FS.close(this._stream);
		} catch (e) {
			throw convertError(e, this._path);
		}
	}
	public async stat(): Promise<Stats> {
		return this.statSync();
	}
	public statSync(): Stats {
		try {
			return this._fs.statSync(this._path, Cred.Root);
		} catch (e) {
			throw convertError(e, this._path);
		}
	}
	public async truncate(len: number): Promise<void> {
		return this.truncateSync(len);
	}
	public truncateSync(len: number): void {
		try {
			this._FS.ftruncate(this._stream.fd, len);
		} catch (e) {
			throw convertError(e, this._path);
		}
	}
	public async write(buffer: Buffer, offset: number, length: number, position: number): Promise<number> {
		return this.writeSync(buffer, offset, length, position);
	}
	public writeSync(buffer: Buffer, offset: number, length: number, position: number | null): number {
		try {
			// Emscripten is particular about what position is set to.
			const emPosition = position === null ? undefined : position;
			return this._FS.write(this._stream, buffer, offset, length, emPosition);
		} catch (e) {
			throw convertError(e, this._path);
		}
	}
	public async read(buffer: Buffer, offset: number, length: number, position: number): Promise<number> {
		return this.readSync(buffer, offset, length, position);
	}
	public readSync(buffer: Buffer, offset: number, length: number, position: number | null): number {
		try {
			// Emscripten is particular about what position is set to.
			const emPosition = position === null ? undefined : position;
			return this._FS.read(this._stream, buffer, offset, length, emPosition);
		} catch (e) {
			throw convertError(e, this._path);
		}
	}
	public async sync(): Promise<void> {
		this.syncSync();
	}
	public syncSync(): void {
		// NOP.
	}
	public async chown(uid: number, gid: number): Promise<void> {
		return this.chownSync(uid, gid);
	}
	public chownSync(uid: number, gid: number): void {
		try {
			this._FS.fchown(this._stream.fd, uid, gid);
		} catch (e) {
			throw convertError(e, this._path);
		}
	}
	public async chmod(mode: number): Promise<void> {
		return this.chmodSync(mode);
	}
	public chmodSync(mode: number): void {
		try {
			this._FS.fchmod(this._stream.fd, mode);
		} catch (e) {
			throw convertError(e, this._path);
		}
	}
	public async utimes(atime: Date, mtime: Date): Promise<void> {
		return this.utimesSync(atime, mtime);
	}
	public utimesSync(atime: Date, mtime: Date): void {
		this._fs.utimesSync(this._path, atime, mtime, Cred.Root);
	}
}

/**
 * Configuration options for Emscripten file systems.
 */
export interface EmscriptenFileSystemOptions {
	// The Emscripten file system to use (`FS`)
	FS: any;
}

/**
 * Mounts an Emscripten file system into the BrowserFS file system.
 */
export class EmscriptenFileSystem extends SynchronousFileSystem {
	public static readonly Name = 'EmscriptenFileSystem';

	public static readonly Options: BackendOptions = {
		FS: {
			type: 'object',
			description: 'The Emscripten file system to use (the `FS` variable)',
		},
	};

	public static async Create(opts: EmscriptenFileSystemOptions): Promise<EmscriptenFileSystem> {
		return new EmscriptenFileSystem(opts.FS);
	}

	public static isAvailable(): boolean {
		return true;
	}

	private _FS: any;

	private constructor(_FS: any) {
		super();
		this._FS = _FS;
	}
	public getName(): string {
		return this._FS.DB_NAME();
	}
	public isReadOnly(): boolean {
		return false;
	}
	public supportsLinks(): boolean {
		return true;
	}
	public supportsProps(): boolean {
		return true;
	}
	public supportsSynch(): boolean {
		return true;
	}

	public renameSync(oldPath: string, newPath: string, cred: Cred): void {
		try {
			this._FS.rename(oldPath, newPath);
		} catch (e) {
			if (e.errno === ErrorCode.ENOENT) {
				throw convertError(e, this.existsSync(oldPath, cred) ? newPath : oldPath);
			} else {
				throw convertError(e);
			}
		}
	}

	public statSync(p: string, cred: Cred): Stats {
		try {
			const stats = this._FS.stat(p);
			const itemType = this.modeToFileType(stats.mode);
			return new Stats(itemType, stats.size, stats.mode, stats.atime.getTime(), stats.mtime.getTime(), stats.ctime.getTime());
		} catch (e) {
			throw convertError(e, p);
		}
	}

	public openSync(p: string, flag: FileFlag, mode: number, cred: Cred): EmscriptenFile {
		try {
			const stream = this._FS.open(p, flag.getFlagString(), mode);
			return new EmscriptenFile(this, this._FS, p, stream);
		} catch (e) {
			throw convertError(e, p);
		}
	}

	public unlinkSync(p: string, cred: Cred): void {
		try {
			this._FS.unlink(p);
		} catch (e) {
			throw convertError(e, p);
		}
	}

	public rmdirSync(p: string, cred: Cred): void {
		try {
			this._FS.rmdir(p);
		} catch (e) {
			throw convertError(e, p);
		}
	}

	public mkdirSync(p: string, mode: number, cred: Cred): void {
		try {
			this._FS.mkdir(p, mode);
		} catch (e) {
			throw convertError(e, p);
		}
	}

	public readdirSync(p: string, cred: Cred): string[] {
		try {
			// Emscripten returns items for '.' and '..'. Node does not.
			return this._FS.readdir(p).filter((p: string) => p !== '.' && p !== '..');
		} catch (e) {
			throw convertError(e, p);
		}
	}

	public truncateSync(p: string, len: number, cred: Cred): void {
		try {
			this._FS.truncate(p, len);
		} catch (e) {
			throw convertError(e, p);
		}
	}

	public readFileSync(p: string, encoding: BufferEncoding, flag: FileFlag, cred: Cred): any {
		try {
			const data: Uint8Array = this._FS.readFile(p, { flags: flag.getFlagString() });
			const buff = Buffer.from(data);
			if (encoding) {
				return buff.toString(encoding);
			} else {
				return buff;
			}
		} catch (e) {
			throw convertError(e, p);
		}
	}

	public writeFileSync(p: string, data: any, encoding: BufferEncoding, flag: FileFlag, mode: number, cred: Cred): void {
		try {
			if (encoding) {
				data = Buffer.from(data, encoding);
			}
			this._FS.writeFile(p, data, { flags: flag.getFlagString(), encoding: 'binary' });
			this._FS.chmod(p, mode);
		} catch (e) {
			throw convertError(e, p);
		}
	}

	public chmodSync(p: string, mode: number, cred: Cred) {
		try {
			this._FS.chmod(p, mode);
		} catch (e) {
			throw convertError(e, p);
		}
	}

	public chownSync(p: string, new_uid: number, new_gid: number, cred: Cred): void {
		try {
			this._FS.chown(p, new_uid, new_gid);
		} catch (e) {
			throw convertError(e, p);
		}
	}

	public symlinkSync(srcpath: string, dstpath: string, type: string, cred: Cred): void {
		try {
			this._FS.symlink(srcpath, dstpath);
		} catch (e) {
			throw convertError(e);
		}
	}

	public readlinkSync(p: string, cred: Cred): string {
		try {
			return this._FS.readlink(p);
		} catch (e) {
			throw convertError(e, p);
		}
	}

	public utimesSync(p: string, atime: Date, mtime: Date, cred: Cred): void {
		try {
			this._FS.utime(p, atime.getTime(), mtime.getTime());
		} catch (e) {
			throw convertError(e, p);
		}
	}

	private modeToFileType(mode: number): FileType {
		if (this._FS.isDir(mode)) {
			return FileType.DIRECTORY;
		} else if (this._FS.isFile(mode)) {
			return FileType.FILE;
		} else if (this._FS.isLink(mode)) {
			return FileType.SYMLINK;
		} else {
			throw ApiError.EPERM(`Invalid mode: ${mode}`);
		}
	}
}
