import Mutex from './mutex';
import { DiskSpaceCB, FileContents, FileSystem } from '../core/filesystem';
import { FileFlag } from '../core/file';
import { default as Stats } from '../core/stats';
import { File } from '../core/file';
import Cred from '../core/cred';

/**
 * This class serializes access to an underlying async filesystem.
 * For example, on an OverlayFS instance with an async lower
 * directory operations like rename and rmdir may involve multiple
 * requests involving both the upper and lower filesystems -- they
 * are not executed in a single atomic step.  OverlayFS uses this
 * LockedFS to avoid having to reason about the correctness of
 * multiple requests interleaving.
 */
export default class LockedFS<T extends FileSystem> implements FileSystem {
	private _fs: T;
	private _mu: Mutex;

	constructor(fs: T) {
		this._fs = fs;
		this._mu = new Mutex();
	}

	public getName(): string {
		return 'LockedFS<' + this._fs.getName() + '>';
	}

	public getFSUnlocked(): T {
		return this._fs;
	}

	public diskSpace(p: string, cb: DiskSpaceCB): void {
		// FIXME: should this lock?
		this._fs.diskSpace(p, cb);
	}

	public isReadOnly(): boolean {
		return this._fs.isReadOnly();
	}

	public supportsLinks(): boolean {
		return this._fs.supportsLinks();
	}

	public supportsProps(): boolean {
		return this._fs.supportsProps();
	}

	public supportsSynch(): boolean {
		return this._fs.supportsSynch();
	}

	public async rename(oldPath: string, newPath: string, cred: Cred): Promise<void> {
		await this._mu.lock();
		await this._fs.rename(oldPath, newPath, cred);
		this._mu.unlock();
	}

	public renameSync(oldPath: string, newPath: string, cred: Cred): void {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.renameSync(oldPath, newPath, cred);
	}

	public async stat(p: string, isLstat: boolean, cred: Cred): Promise<Stats> {
		await this._mu.lock();
		const stats = await this._fs.stat(p, isLstat, cred);
		this._mu.unlock();
		return stats;
	}

	public statSync(p: string, isLstat: boolean, cred: Cred): Stats {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.statSync(p, isLstat, cred);
	}

	public async access(p: string, mode: number, cred: Cred): Promise<void> {
		await this._mu.lock();
		await this._fs.access(p, mode, cred);
		this._mu.unlock();
	}

	public accessSync(p: string, mode: number, cred: Cred): void {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.accessSync(p, mode, cred);
	}

	public async open(p: string, flag: FileFlag, mode: number, cred: Cred): Promise<File> {
		await this._mu.lock();
		const fd = await this._fs.open(p, flag, mode, cred);
		this._mu.unlock();
		return fd;
	}

	public openSync(p: string, flag: FileFlag, mode: number, cred: Cred): File {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.openSync(p, flag, mode, cred);
	}

	public async unlink(p: string, cred: Cred): Promise<void> {
		await this._mu.lock();
		await this._fs.unlink(p, cred);
		this._mu.unlock();
	}

	public unlinkSync(p: string, cred: Cred): void {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.unlinkSync(p, cred);
	}

	public async rmdir(p: string, cred: Cred): Promise<void> {
		await this._mu.lock();
		await this._fs.rmdir(p, cred);
		this._mu.unlock();
	}

	public rmdirSync(p: string, cred: Cred): void {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.rmdirSync(p, cred);
	}

	public async mkdir(p: string, mode: number, cred: Cred): Promise<void> {
		await this._mu.lock();
		await this._fs.mkdir(p, mode, cred);
		this._mu.unlock();
	}

	public mkdirSync(p: string, mode: number, cred: Cred): void {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.mkdirSync(p, mode, cred);
	}

	public async readdir(p: string, cred: Cred): Promise<string[]> {
		await this._mu.lock();
		const files = await this._fs.readdir(p, cred);
		this._mu.unlock();
		return files;
	}

	public readdirSync(p: string, cred: Cred): string[] {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.readdirSync(p, cred);
	}

	public async exists(p: string, cred: Cred): Promise<boolean> {
		await this._mu.lock();
		const exists = await this._fs.exists(p, cred);
		this._mu.unlock();
		return exists;
	}

	public existsSync(p: string, cred: Cred): boolean {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.existsSync(p, cred);
	}

	public async realpath(p: string, cache: { [path: string]: string }, cred: Cred): Promise<string> {
		await this._mu.lock();
		const resolvedPath = await this._fs.realpath(p, cache, cred);
		this._mu.unlock();
		return resolvedPath;
	}

	public realpathSync(p: string, cache: { [path: string]: string }, cred: Cred): string {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.realpathSync(p, cache, cred);
	}

	public async truncate(p: string, len: number, cred: Cred): Promise<void> {
		await this._mu.lock();
		await this._fs.truncate(p, len, cred);
		this._mu.unlock();
	}

	public truncateSync(p: string, len: number, cred: Cred): void {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.truncateSync(p, len, cred);
	}

	public async readFile(fname: string, encoding: BufferEncoding, flag: FileFlag, cred: Cred): Promise<FileContents> {
		await this._mu.lock();
		const data = await this._fs.readFile(fname, encoding, flag, cred);
		this._mu.unlock();
		return data;
	}

	public readFileSync(fname: string, encoding: BufferEncoding, flag: FileFlag, cred: Cred): FileContents {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.readFileSync(fname, encoding, flag, cred);
	}

	public async writeFile(fname: string, data: FileContents, encoding: BufferEncoding, flag: FileFlag, mode: number, cred: Cred): Promise<void> {
		await this._mu.lock();
		await this._fs.writeFile(fname, data, encoding, flag, mode, cred);
		this._mu.unlock();
	}

	public writeFileSync(fname: string, data: FileContents, encoding: BufferEncoding, flag: FileFlag, mode: number, cred: Cred): void {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.writeFileSync(fname, data, encoding, flag, mode, cred);
	}

	public async appendFile(fname: string, data: FileContents, encoding: BufferEncoding, flag: FileFlag, mode: number, cred: Cred): Promise<void> {
		await this._mu.lock();
		await this._fs.appendFile(fname, data, encoding, flag, mode, cred);
		this._mu.unlock();
	}

	public appendFileSync(fname: string, data: FileContents, encoding: BufferEncoding, flag: FileFlag, mode: number, cred: Cred): void {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.appendFileSync(fname, data, encoding, flag, mode, cred);
	}

	public async chmod(p: string, isLchmod: boolean, mode: number, cred: Cred): Promise<void> {
		await this._mu.lock();
		await this._fs.chmod(p, isLchmod, mode, cred);
		this._mu.unlock();
	}

	public chmodSync(p: string, isLchmod: boolean, mode: number, cred: Cred): void {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.chmodSync(p, isLchmod, mode, cred);
	}

	public async chown(p: string, isLchown: boolean, new_uid: number, new_gid: number, cred: Cred): Promise<void> {
		await this._mu.lock();
		await this._fs.chown(p, isLchown, new_uid, new_gid, cred);
		this._mu.unlock();
	}

	public chownSync(p: string, isLchown: boolean, new_uid: number, new_gid: number, cred: Cred): void {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.chownSync(p, isLchown, new_uid, new_gid, cred);
	}

	public async utimes(p: string, atime: Date, mtime: Date, cred: Cred): Promise<void> {
		await this._mu.lock();
		await this._fs.utimes(p, atime, mtime, cred);
		this._mu.unlock();
	}

	public utimesSync(p: string, atime: Date, mtime: Date, cred: Cred): void {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.utimesSync(p, atime, mtime, cred);
	}

	public async link(srcpath: string, dstpath: string, cred: Cred): Promise<void> {
		await this._mu.lock();
		await this._fs.link(srcpath, dstpath, cred);
		this._mu.unlock();
	}

	public linkSync(srcpath: string, dstpath: string, cred: Cred): void {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.linkSync(srcpath, dstpath, cred);
	}

	public async symlink(srcpath: string, dstpath: string, type: string, cred: Cred): Promise<void> {
		await this._mu.lock();
		await this._fs.symlink(srcpath, dstpath, type, cred);
		this._mu.unlock();
	}

	public symlinkSync(srcpath: string, dstpath: string, type: string, cred: Cred): void {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.symlinkSync(srcpath, dstpath, type, cred);
	}

	public async readlink(p: string, cred: Cred): Promise<string> {
		await this._mu.lock();
		const linkString = await this._fs.readlink(p, cred);
		this._mu.unlock();
		return linkString;
	}

	public readlinkSync(p: string, cred: Cred): string {
		if (this._mu.isLocked()) {
			throw new Error('invalid sync call');
		}
		return this._fs.readlinkSync(p, cred);
	}
}
