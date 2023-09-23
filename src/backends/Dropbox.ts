import PreloadFile from '../generic/preload_file';
import { BaseFileSystem, FileSystemMetadata, type FileSystem } from '../filesystem';
import { Stats, FileType } from '../stats';
import { ApiError, ErrorCode } from '../ApiError';
import { File, FileFlag } from '../file';
import { wait } from '../utils';
import type * as DropboxTypes from 'dropbox';
import { dirname } from 'path';
import { Cred } from '../cred';
import { Buffer } from 'buffer';
import type { BackendOptions } from './index';

/**
 * Dropbox paths do not begin with a /, they just begin with a folder at the root node.
 * Here, we strip the `/`.
 * @param p An absolute path
 */
function fixPath(p: string): string {
	if (p === '/') {
		return '';
	} else {
		return p;
	}
}

/**
 * HACK: Dropbox errors are FUBAR'd sometimes.
 * @url https://github.com/dropbox/dropbox-sdk-js/issues/146
 * @param e
 */
function extractError<T>(e: DropboxTypes.Error<T>): T {
	const obj = <any>e.error;
	if (obj['.tag']) {
		// Everything is OK.
		return obj;
	} else if (obj['error']) {
		// Terrible nested object bug.
		const obj2 = obj.error;
		if (obj2['.tag']) {
			return obj2;
		} else if (obj2['reason'] && obj2['reason']['.tag']) {
			return obj2.reason;
		} else {
			return obj2;
		}
	} else if (typeof obj === 'string') {
		// Might be a fucking JSON object error.
		try {
			const obj2 = JSON.parse(obj);
			if (obj2['error'] && obj2['error']['reason'] && obj2['error']['reason']['.tag']) {
				return obj2.error.reason;
			}
		} catch (e) {
			// Nope. Give up.
		}
	}
	return <any>obj;
}

/**
 * Returns a user-facing error message given an error.
 *
 * HACK: Dropbox error messages sometimes lack a `user_message` field.
 * Sometimes, they are even strings. Ugh.
 * @url https://github.com/dropbox/dropbox-sdk-js/issues/146
 * @url https://github.com/dropbox/dropbox-sdk-js/issues/145
 * @url https://github.com/dropbox/dropbox-sdk-js/issues/144
 * @param err An error.
 */
function getErrorMessage(err: DropboxTypes.Error<any>): string {
	if (err['user_message']) {
		return err.user_message.text;
	} else if (err['error_summary']) {
		return err.error_summary;
	} else if (typeof err.error === 'string') {
		return err.error;
	} else if (typeof err.error === 'object') {
		// DROPBOX BUG: Sometimes, error is a nested error.
		return getErrorMessage(err.error);
	} else {
		throw new Error(`Dropbox's servers gave us a garbage error message: ${JSON.stringify(err)}`);
	}
}

function convertLookupError(err: DropboxTypes.files.LookupError, p: string, msg: string): ApiError {
	switch (err['.tag']) {
		case 'malformed_path':
			return new ApiError(ErrorCode.EBADF, msg, p);
		case 'not_found':
			return ApiError.ENOENT(p);
		case 'not_file':
			return ApiError.EISDIR(p);
		case 'not_folder':
			return ApiError.ENOTDIR(p);
		case 'restricted_content':
			return ApiError.EPERM(p);
		case 'other':
		default:
			return new ApiError(ErrorCode.EIO, msg, p);
	}
}

function convertWriteError(err: DropboxTypes.files.WriteError, p: string, msg: string): ApiError {
	switch (err['.tag']) {
		case 'malformed_path':
		case 'disallowed_name':
			return new ApiError(ErrorCode.EBADF, msg, p);
		case 'conflict':
		case 'no_write_permission':
		case 'team_folder':
			return ApiError.EPERM(p);
		case 'insufficient_space':
			return new ApiError(ErrorCode.ENOSPC, msg);
		case 'other':
		default:
			return new ApiError(ErrorCode.EIO, msg, p);
	}
}

async function deleteFiles(client: DropboxTypes.Dropbox, p: string): Promise<void> {
	const arg: DropboxTypes.files.DeleteArg = {
		path: fixPath(p),
	};
	try {
		await client.filesDeleteV2(arg);
	} catch (e) {
		const err = extractError(e as DropboxTypes.Error<DropboxTypes.files.DeleteError>);
		switch (err['.tag']) {
			case 'path_lookup':
				throw convertLookupError((<DropboxTypes.files.DeleteErrorPathLookup>err).path_lookup, p, getErrorMessage(e));
			case 'path_write':
				throw convertWriteError((<DropboxTypes.files.DeleteErrorPathWrite>err).path_write, p, getErrorMessage(e));
			case 'too_many_write_operations':
				await wait(500);
				await deleteFiles(client, p);
				break;
			case 'other':
			default:
				throw new ApiError(ErrorCode.EIO, getErrorMessage(e), p);
		}
	}
}

export class DropboxFile extends PreloadFile<DropboxFileSystem> implements File {
	constructor(_fs: DropboxFileSystem, _path: string, _flag: FileFlag, _stat: Stats, contents?: Buffer) {
		super(_fs, _path, _flag, _stat, contents);
	}

	public async sync(): Promise<void> {
		await this._fs._syncFile(this.getPath(), this.getBuffer());
	}

	public async close(): Promise<void> {
		await this.sync();
	}
}

/**
 * Options for the Dropbox file system.
 */
export interface DropboxFileSystemOptions {
	// An *authenticated* Dropbox client from the 2.x JS SDK.
	client: DropboxTypes.Dropbox;
}

/**
 * A read/write file system backed by Dropbox cloud storage.
 *
 * Uses the Dropbox V2 API, and the 2.x JS SDK.
 */
export class DropboxFileSystem extends BaseFileSystem implements FileSystem {
	public static readonly Name = 'DropboxV2';

	public static readonly Options: BackendOptions = {
		client: {
			type: 'object',
			description: 'An *authenticated* Dropbox client. Must be from the 2.5.x JS SDK.',
		},
	};

	/**
	 * Asynchronously creates a new DropboxFileSystem instance with the given options.
	 * Must be given an *authenticated* Dropbox client from 2.x JS SDK.
	 */
	public static async Create(opts: DropboxFileSystemOptions): Promise<DropboxFileSystem> {
		return new DropboxFileSystem(opts.client);
	}

	public static isAvailable(): boolean {
		// Checks if the Dropbox library is loaded.
		return typeof globalThis.Dropbox !== 'undefined';
	}

	private _client: DropboxTypes.Dropbox;

	private constructor(client: DropboxTypes.Dropbox) {
		super();
		this._client = client;
	}

	public get metadata(): FileSystemMetadata {
		return { ...super.metadata, name: DropboxFileSystem.Name };
	}

	/**
	 * Deletes *everything* in the file system. Mainly intended for unit testing!
	 * @param mainCb Called when operation completes.
	 */
	public async empty(): Promise<void> {
		const paths = await this.readdir('/', Cred.Root);
		for (const path of paths) {
			await deleteFiles(this._client, path);
		}
	}

	public async rename(oldPath: string, newPath: string, cred: Cred): Promise<void> {
		// Dropbox doesn't let you rename things over existing things, but POSIX does.
		// So, we need to see if newPath exists...
		const rename = async () => {
			const relocationArg: DropboxTypes.files.RelocationArg = {
				from_path: fixPath(oldPath),
				to_path: fixPath(newPath),
			};
			try {
				await this._client.filesMoveV2(relocationArg);
			} catch (e) {
				const err = extractError(e as DropboxTypes.Error<DropboxTypes.files.RelocationError>);
				switch (err['.tag']) {
					case 'from_lookup':
						throw convertLookupError((<DropboxTypes.files.RelocationErrorFromLookup>err).from_lookup, oldPath, getErrorMessage(e));
					case 'from_write':
						throw convertWriteError((<DropboxTypes.files.RelocationErrorFromWrite>err).from_write, oldPath, getErrorMessage(e));
					case 'to':
						throw convertWriteError((<DropboxTypes.files.RelocationErrorTo>err).to, newPath, getErrorMessage(e));
					case 'cant_copy_shared_folder':
					case 'cant_nest_shared_folder':
						throw new ApiError(ErrorCode.EPERM, getErrorMessage(e), oldPath);
					case 'cant_move_folder_into_itself':
					case 'duplicated_or_nested_paths':
						throw new ApiError(ErrorCode.EBADF, getErrorMessage(e), oldPath);
					case 'too_many_files':
						throw new ApiError(ErrorCode.ENOSPC, getErrorMessage(e), oldPath);
					case 'other':
					default:
						throw new ApiError(ErrorCode.EIO, getErrorMessage(e), oldPath);
				}
			}
		};
		try {
			const stats = await this.stat(newPath, cred);

			if (stats.isDirectory()) {
				throw ApiError.EISDIR(newPath);
			}

			await this.unlink(newPath, cred);
			rename();
		} catch (e) {
			if (oldPath === newPath) {
				throw ApiError.ENOENT(newPath);
			}
			rename();
		}
	}

	/**
	 * @todo parse time fields
	 */
	public async stat(path: string, cred: Cred): Promise<Stats> {
		if (path === '/') {
			// Dropbox doesn't support querying the root directory.
			return new Stats(FileType.DIRECTORY, 4096);
		}
		const arg: DropboxTypes.files.GetMetadataArg = {
			path: fixPath(path),
		};

		try {
			const ref = await this._client.filesGetMetadata(arg);
			switch (ref['.tag']) {
				case 'file':
					const fileMetadata = <DropboxTypes.files.FileMetadata>ref;
					return new Stats(FileType.FILE, fileMetadata.size);
				case 'folder':
					return new Stats(FileType.DIRECTORY, 4096);
				case 'deleted':
					throw ApiError.ENOENT(path);
				default:
					throw new ApiError(ErrorCode.EINVAL, 'Invalid file type', path);
			}
		} catch (e) {
			const err = extractError(e as DropboxTypes.Error<DropboxTypes.files.GetMetadataError>);
			switch (err['.tag']) {
				case 'path':
					throw convertLookupError(err.path, path, getErrorMessage(e));
				default:
					throw new ApiError(ErrorCode.EIO, getErrorMessage(e), path);
			}
		}
	}

	public async openFile(path: string, flags: FileFlag, cred: Cred): Promise<File> {
		const downloadArg: DropboxTypes.files.DownloadArg = {
			path: fixPath(path),
		};

		try {
			const res = (await this._client.filesDownload(downloadArg)) as any;
			const data = await res.fileBlob.arrayBuffer();
			return new DropboxFile(this, path, flags, new Stats(FileType.FILE, data.byteLength), Buffer.from(data));
		} catch (e) {
			const err = extractError(e as DropboxTypes.Error<DropboxTypes.files.DownloadError>);
			switch (err['.tag']) {
				case 'path':
					const dpError = <DropboxTypes.files.DownloadErrorPath>err;
					throw convertLookupError(dpError.path, path, getErrorMessage(e));
				case 'other':
				default:
					throw new ApiError(ErrorCode.EIO, getErrorMessage(e), path);
			}
		}
	}

	public async createFile(p: string, flags: FileFlag, mode: number, cred: Cred): Promise<File> {
		const fileData = Buffer.alloc(0),
			contents = new Blob([fileData], { type: 'octet/stream' });
		const commitInfo: DropboxTypes.files.CommitInfo = {
			contents,
			path: fixPath(p),
		};
		try {
			const meta = await this._client.filesUpload(commitInfo);
			return new DropboxFile(this, p, flags, new Stats(FileType.FILE, meta.size, 0o644, Date.now(), Date.parse(meta.server_modified)), fileData);
		} catch (e) {
			const err = extractError(e as DropboxTypes.Error<DropboxTypes.files.UploadError>);
			// HACK: Casting to 'any' since tag can be 'too_many_write_operations'.
			switch (<string>err['.tag']) {
				case 'path':
					const upError = <DropboxTypes.files.UploadErrorPath>err;
					throw convertWriteError((upError as any).path.reason, p, getErrorMessage(e));
				case 'too_many_write_operations':
					// Retry in (500, 800) ms.
					await wait(500);
					await this.createFile(p, flags, mode, cred);
					break;
				case 'other':
				default:
					throw new ApiError(ErrorCode.EIO, getErrorMessage(e), p);
			}
		}
	}

	/**
	 * Delete a file
	 */
	public async unlink(path: string, cred: Cred): Promise<void> {
		// Must be a file. Check first.
		const stats = await this.stat(path, cred);
		if (stats.isDirectory()) {
			throw ApiError.EISDIR(path);
		}
		await deleteFiles(this._client, path);
	}

	/**
	 * Delete a directory
	 */
	public async rmdir(path: string, cred: Cred): Promise<void> {
		const paths = await this.readdir(path, cred);
		if (paths.length > 0) {
			throw ApiError.ENOTEMPTY(path);
		}
		await deleteFiles(this._client, path);
	}

	/**
	 * Create a directory
	 */
	public async mkdir(p: string, mode: number, cred: Cred): Promise<void> {
		// Dropbox's create_folder is recursive. Check if parent exists.
		const parent = dirname(p);
		const stats = await this.stat(parent, cred);
		if (stats && !stats.isDirectory()) {
			throw ApiError.ENOTDIR(parent);
		}
		const arg: DropboxTypes.files.CreateFolderArg = {
			path: fixPath(p),
		};
		try {
			await this._client.filesCreateFolderV2(arg);
		} catch (e) {
			const err = extractError(e as DropboxTypes.Error<DropboxTypes.files.CreateFolderError>);
			if (<string>err['.tag'] === 'too_many_write_operations') {
				// Retry in a bit.
				await wait(500);
				await this.mkdir(p, mode, cred);
			} else {
				throw convertWriteError(err.path, p, getErrorMessage(e));
			}
		}
	}

	/**
	 * Get the names of the files in a directory
	 */
	public async readdir(path: string, cred: Cred): Promise<string[]> {
		const arg: DropboxTypes.files.ListFolderArg = {
			path: fixPath(path),
		};
		try {
			const res = await this._client.filesListFolder(arg);
			return await _readdir(this._client, res, path, []);
		} catch (e) {
			throw convertListFolderError(e as DropboxTypes.Error<DropboxTypes.files.ListFolderError>, path);
		}
	}

	/**
	 * @internal
	 * Syncs file to Dropbox.
	 */
	public async _syncFile(p: string, d: Buffer): Promise<void> {
		const blob = new Blob([d], { type: 'octet/stream' });
		const arg: DropboxTypes.files.CommitInfo = {
			contents: blob,
			path: fixPath(p),
			mode: {
				'.tag': 'overwrite',
			},
		};
		try {
			await this._client.filesUpload(arg);
		} catch (e) {
			const err = extractError(e as DropboxTypes.Error<DropboxTypes.files.UploadError>);
			switch (<string>err['.tag']) {
				case 'path':
					const upError = <DropboxTypes.files.UploadErrorPath>err;
					throw convertWriteError((upError as any).path.reason, p, getErrorMessage(e));
				case 'too_many_write_operations':
					await wait(500);
					await this._syncFile(p, d);
					break;
				case 'other':
				default:
					throw new ApiError(ErrorCode.EIO, getErrorMessage(e), p);
			}
		}
	}
}

function convertListFolderError(e: DropboxTypes.Error<DropboxTypes.files.ListFolderError>, path: string): ApiError {
	const err = extractError(e);
	switch (err['.tag']) {
		case 'path':
			const pathError = <DropboxTypes.files.ListFolderErrorPath>err;
			return convertLookupError(pathError.path, path, getErrorMessage(e));
		case 'other':
		default:
			return new ApiError(ErrorCode.EIO, getErrorMessage(e), path);
	}
}

async function _readdir(res, client, path: string, previousEntries: string[]): Promise<string[]> {
	try {
		const newEntries = <string[]>res.entries.map(e => e.path_display).filter(p => !!p);
		const entries = previousEntries.concat(newEntries);
		if (!res.has_more) {
			return entries;
		}
		const arg: DropboxTypes.files.ListFolderContinueArg = {
			cursor: res.cursor,
		};
		await client.filesListFolderContinue(arg);
		return await _readdir(client, res, path, entries);
	} catch (e) {
		throw convertListFolderError(e as DropboxTypes.Error<DropboxTypes.files.ListFolderError>, path);
	}
}
