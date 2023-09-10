/// <reference lib="dom" />
import { basename, dirname, join } from 'path';
import { ApiError, ErrorCode } from '../core/ApiError';
import Cred from '../core/cred';
import { File, FileFlag } from '../core/file';
import { BaseFileSystem, type FileSystem } from '../core/filesystem';
import { default as Stats, FileType } from '../core/stats';
import PreloadFile from '../generic/preload_file';
import { Buffer } from 'buffer';
import type { BackendOptions } from '../core/backends';

interface FileSystemAccessFileSystemOptions {
	handle: FileSystemDirectoryHandle;
}

const handleError = (path = '', error: Error) => {
	if (error.name === 'NotFoundError') {
		throw ApiError.ENOENT(path);
	}

	throw error as ApiError;
};

export class FileSystemAccessFile extends PreloadFile<FileSystemAccessFileSystem> implements File {
	constructor(_fs: FileSystemAccessFileSystem, _path: string, _flag: FileFlag, _stat: Stats, contents?: Buffer) {
		super(_fs, _path, _flag, _stat, contents);
	}

	public async sync(): Promise<void> {
		if (this.isDirty()) {
			await this._fs._sync(this.getPath(), this.getBuffer(), this.getStats(), Cred.Root);
			this.resetDirty();
		}
	}

	public async close(): Promise<void> {
		await this.sync();
	}
}

export class FileSystemAccessFileSystem extends BaseFileSystem implements FileSystem {
	public static readonly Name = 'FileSystemAccess';

	public static readonly Options: BackendOptions = {};

	public static async Create({ handle }: FileSystemAccessFileSystemOptions): Promise<FileSystemAccessFileSystem> {
		return new FileSystemAccessFileSystem(handle);
	}

	public static isAvailable(): boolean {
		return typeof FileSystemHandle === 'function';
	}

	private _handles: { [path: string]: FileSystemHandle };

	private constructor(handle: FileSystemDirectoryHandle) {
		super();
		this._handles = { '/': handle };
	}

	public getName(): string {
		return FileSystemAccessFileSystem.Name;
	}

	public isReadOnly(): boolean {
		return false;
	}

	public supportsSymlinks(): boolean {
		return false;
	}

	public supportsProps(): boolean {
		return false;
	}

	public supportsSynch(): boolean {
		return false;
	}

	public async _sync(p: string, data: Buffer, stats: Stats, cred: Cred): Promise<void> {
		const currentStats = await this.stat(p, false, cred);
		if (stats.mtime !== currentStats!.mtime) {
			await this.writeFile(p, data, null, FileFlag.getFileFlag('w'), currentStats!.mode, cred);
		}
	}

	public async rename(oldPath: string, newPath: string, cred: Cred): Promise<void> {
		try {
			const handle = await this.getHandle(oldPath);
			if (handle instanceof FileSystemDirectoryHandle) {
				const files = await this.readdir(oldPath, cred);

				await this.mkdir(newPath, 'wx', cred);
				if (files.length === 0) {
					await this.unlink(oldPath, cred);
				} else {
					for (const file of files) {
						await this.rename(join(oldPath, file), join(newPath, file), cred);
						await this.unlink(oldPath, cred);
					}
				}
			}
			if (handle instanceof FileSystemFileHandle) {
				const oldFile = await handle.getFile(),
					destFolder = await this.getHandle(dirname(newPath));
				if (destFolder instanceof FileSystemDirectoryHandle) {
					const newFile = await destFolder.getFileHandle(basename(newPath), { create: true });
					const writable = await newFile.createWritable();
					const buffer = await oldFile.arrayBuffer();
					await writable.write(buffer);

					writable.close();
					await this.unlink(oldPath, cred);
				}
			}
		} catch (err) {
			handleError(oldPath, err);
		}
	}

	public async writeFile(fname: string, data: any, encoding: string | null, flag: FileFlag, mode: number, cred: Cred, createFile?: boolean): Promise<void> {
		const handle = await this.getHandle(dirname(fname));
		if (handle instanceof FileSystemDirectoryHandle) {
			const file = await handle.getFileHandle(basename(fname), { create: true });
			const writable = await file.createWritable();
			await writable.write(data);
			await writable.close();
			//return createFile ? this.newFile(fname, flag, data) : undefined;
		}
	}

	public async createFile(p: string, flag: FileFlag, mode: number, cred: Cred): Promise<File> {
		await this.writeFile(p, Buffer.alloc(0), null, flag, mode, cred, true);
		return this.openFile(p, flag, cred);
	}

	public async stat(path: string, isLstat: boolean, cred: Cred): Promise<Stats> {
		const handle = await this.getHandle(path);
		if (!handle) {
			throw ApiError.FileError(ErrorCode.EINVAL, path);
		}
		if (handle instanceof FileSystemDirectoryHandle) {
			return new Stats(FileType.DIRECTORY, 4096);
		}
		if (handle instanceof FileSystemFileHandle) {
			const { lastModified, size } = await handle.getFile();
			return new Stats(FileType.FILE, size, undefined, undefined, lastModified);
		}
	}

	public async exists(p: string, cred: Cred): Promise<boolean> {
		try {
			await this.getHandle(p);
			return true;
		} catch (e) {
			return false;
		}
	}

	public async openFile(path: string, flags: FileFlag, cred: Cred): Promise<File> {
		const handle = await this.getHandle(path);
		if (handle instanceof FileSystemFileHandle) {
			const file = await handle.getFile();
			const buffer = await file.arrayBuffer();
			return this.newFile(path, flags, buffer, file.size, file.lastModified);
		}
	}

	public async unlink(path: string, cred: Cred): Promise<void> {
		const handle = await this.getHandle(dirname(path));
		if (handle instanceof FileSystemDirectoryHandle) {
			try {
				await handle.removeEntry(basename(path), { recursive: true });
			} catch (e) {
				handleError(path, e);
			}
		}
	}

	public async rmdir(path: string, cred: Cred): Promise<void> {
		return this.unlink(path, cred);
	}

	public async mkdir(p: string, mode: any, cred: Cred): Promise<void> {
		const overwrite = mode && mode.flag && mode.flag.includes('w') && !mode.flag.includes('x');

		const existingHandle = await this.getHandle(p);
		if (existingHandle && !overwrite) {
			throw ApiError.EEXIST(p);
		}

		const handle = await this.getHandle(dirname(p));
		if (handle instanceof FileSystemDirectoryHandle) {
			await handle.getDirectoryHandle(basename(p), { create: true });
		}
	}

	public async readdir(path: string, cred: Cred): Promise<string[]> {
		const handle = await this.getHandle(path);
		if (handle instanceof FileSystemDirectoryHandle) {
			const _keys: string[] = [];
			for await (const key of handle.keys()) {
				_keys.push(join(path, key));
			}
			return _keys;
		}
	}

	private newFile(path: string, flag: FileFlag, data: ArrayBuffer, size?: number, lastModified?: number): File {
		return new FileSystemAccessFile(this, path, flag, new Stats(FileType.FILE, size || 0, undefined, undefined, lastModified || new Date().getTime()), Buffer.from(data));
	}

	private async getHandle(path: string): Promise<FileSystemHandle> {
		if (path === '/') {
			return this._handles['/'];
		}

		let walkedPath = '/';
		const [, ...pathParts] = path.split('/');
		const getHandleParts = async ([pathPart, ...remainingPathParts]: string[]) => {
			const walkingPath = join(walkedPath, pathPart);
			const continueWalk = (handle: FileSystemHandle) => {
				walkedPath = walkingPath;
				this._handles[walkedPath] = handle;

				if (remainingPathParts.length === 0) {
					return this._handles[path];
				}

				getHandleParts(remainingPathParts);
			};
			const handle = this._handles[walkedPath] as FileSystemDirectoryHandle;

			try {
				return await continueWalk(await handle.getDirectoryHandle(pathPart));
			} catch (error) {
				if (error.name === 'TypeMismatchError') {
					try {
						return await continueWalk(await handle.getFileHandle(pathPart));
					} catch (err) {
						handleError(walkingPath, err);
					}
				} else if (error.message === 'Name is not allowed.') {
					throw new ApiError(ErrorCode.ENOENT, error.message, walkingPath);
				} else {
					handleError(walkingPath, error);
				}
			}
		};

		getHandleParts(pathParts);
	}
}
