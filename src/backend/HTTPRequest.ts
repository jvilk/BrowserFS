import { BaseFileSystem, FileSystem, BFSCallback, FileSystemOptions } from '../core/file_system';
import { ApiError, ErrorCode } from '../core/api_error';
import { FileFlag, ActionType } from '../core/file_flag';
import { copyingSlice } from '../core/util';
import { File } from '../core/file';
import { default as Stats, FilePerm } from '../core/stats';
import { NoSyncFile } from '../generic/preload_file';
import { fetchIsAvailable, fetchFile, fetchFileSize } from '../generic/fetch';
import { FileIndex, isFileInode, isDirInode } from '../generic/file_index';
import Cred from '../core/cred';
import type { Buffer } from 'buffer';

/**
 * Configuration options for a HTTPRequest file system.
 */
export interface HTTPRequestOptions {
	// URL to a file index as a JSON file or the file index object itself, generated with the make_http_index script.
	// Defaults to `index.json`.
	index?: string | object;
	// Used as the URL prefix for fetched files.
	// Default: Fetch files relative to the index.
	baseUrl?: string;
	// Whether to prefer XmlHttpRequest or fetch for async operations if both are available.
	// Default: false
	preferXHR?: boolean;
}

function syncNotAvailableError(): never {
	throw new ApiError(ErrorCode.ENOTSUP, `Synchronous HTTP download methods are not available in this environment.`);
}

/**
 * A simple filesystem backed by HTTP downloads. You must create a directory listing using the
 * `make_http_index` tool provided by BrowserFS.
 *
 * If you install BrowserFS globally with `npm i -g browserfs`, you can generate a listing by
 * running `make_http_index` in your terminal in the directory you would like to index:
 *
 * ```
 * make_http_index > index.json
 * ```
 *
 * Listings objects look like the following:
 *
 * ```json
 * {
 *   "home": {
 *     "jvilk": {
 *       "someFile.txt": null,
 *       "someDir": {
 *         // Empty directory
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * *This example has the folder `/home/jvilk` with subfile `someFile.txt` and subfolder `someDir`.*
 */
export default class HTTPRequest extends BaseFileSystem implements FileSystem {
	public static readonly Name = 'HTTPRequest';

	public static readonly Options: FileSystemOptions = {
		index: {
			type: ['string', 'object'],
			optional: true,
			description: 'URL to a file index as a JSON file or the file index object itself, generated with the make_http_index script. Defaults to `index.json`.',
		},
		baseUrl: {
			type: 'string',
			optional: true,
			description: 'Used as the URL prefix for fetched files. Default: Fetch files relative to the index.',
		},
		preferXHR: {
			type: 'boolean',
			optional: true,
			description: 'Whether to prefer XmlHttpRequest or fetch for async operations if both are available. Default: false',
		},
	};

	/**
	 * Construct an HTTPRequest file system backend with the given options.
	 */
	public static Create(opts: HTTPRequestOptions, cb: BFSCallback<HTTPRequest>): void {
		this.CreateAsync(opts).then(fs => cb(null, fs)).catch(cb);
	}

	public static async CreateAsync(opts: HTTPRequestOptions): Promise<HTTPRequest> {
		if (!opts.index) {
			opts.index = 'index.json';
		}

		if(typeof opts.index != 'string'){
			return new HTTPRequest(opts.index, opts.baseUrl);
		}

		const data = await fetchFile(opts.index, 'json');
		return new HTTPRequest(data, opts.baseUrl);
	}

	public static isAvailable(): boolean {
		return fetchIsAvailable;
	}

	public readonly prefixUrl: string;
	private _index: FileIndex<{}>;
	private _requestFileInternal: typeof fetchFile;
	private _requestFileSizeInternal: typeof fetchFileSize;

	private constructor(index: object, prefixUrl: string = '') {
		super();
		// prefix_url must end in a directory separator.
		if (prefixUrl.length > 0 && prefixUrl.charAt(prefixUrl.length - 1) !== '/') {
			prefixUrl = prefixUrl + '/';
		}
		this.prefixUrl = prefixUrl;
		this._index = FileIndex.fromListing(index);

			this._requestFileInternal = fetchFile;
			this._requestFileSizeInternal = fetchFileSize;

	}

	public empty(): void {
		this._index.fileIterator(function (file: Stats) {
			file.fileData = null;
		});
	}

	public getName(): string {
		return HTTPRequest.Name;
	}

	public diskSpace(path: string, cb: (total: number, free: number) => void): void {
		// Read-only file system. We could calculate the total space, but that's not
		// important right now.
		cb(0, 0);
	}

	public isReadOnly(): boolean {
		return true;
	}

	public supportsLinks(): boolean {
		return false;
	}

	public supportsProps(): boolean {
		return false;
	}

	/**
	 * Synchronous XHRs are deprecated.
	 * @returns false
	 */
	public supportsSynch(): boolean {
		return false;
	}

	/**
	 * Special HTTPFS function: Preload the given file into the index.
	 * @param [String] path
	 * @param [BrowserFS.Buffer] buffer
	 */
	public preloadFile(path: string, buffer: Buffer): void {
		const inode = this._index.getInode(path);
		if (isFileInode<Stats>(inode)) {
			if (inode === null) {
				throw ApiError.ENOENT(path);
			}
			const stats = inode.getData();
			stats.size = buffer.length;
			stats.fileData = buffer;
		} else {
			throw ApiError.EISDIR(path);
		}
	}

	public async stat(path: string, isLstat: boolean, cred: Cred): Promise<Stats> {
		const inode = this._index.getInode(path);
		if (inode === null) {
			throw ApiError.ENOENT(path);
		}
		if (!inode.toStats().hasAccess(FilePerm.READ, cred)) {
			throw ApiError.EACCES(path);
		}
		let stats: Stats;
		if (isFileInode<Stats>(inode)) {
			stats = inode.getData();
			// At this point, a non-opened file will still have default stats from the listing.
			if (stats.size < 0) {
				stats.size = await this._requestFileSize(path);
			}
		} else if (isDirInode(inode)) {
			stats = inode.getStats();
		} else {
			throw ApiError.FileError(ErrorCode.EINVAL, path);
		}
		return stats;
	}

	public async open(path: string, flags: FileFlag, mode: number, cred: Cred): Promise<File> {
		// INVARIANT: You can't write to files on this file system.
		if (flags.isWriteable()) {
			throw new ApiError(ErrorCode.EPERM, path);
		}
		// Check if the path exists, and is a file.
		const inode = this._index.getInode(path);
		if (inode === null) {
			throw ApiError.ENOENT(path);
		}
		if (!inode.toStats().hasAccess(flags.getMode(), cred)) {
			throw ApiError.EACCES(path);
		}
		if (isFileInode<Stats>(inode) || isDirInode<Stats>(inode)) {
			switch (flags.pathExistsAction()) {
				case ActionType.THROW_EXCEPTION:
				case ActionType.TRUNCATE_FILE:
					throw ApiError.EEXIST(path);
				case ActionType.NOP:
					if (isDirInode<Stats>(inode)) {
						const stats = inode.getStats();
						return new NoSyncFile(this, path, flags, stats, stats.fileData || undefined);
					}
					const stats = inode.getData();
					// Use existing file contents.
					// XXX: Uh, this maintains the previously-used flag.
					if (stats.fileData) {
						return new NoSyncFile(this, path, flags, Stats.clone(stats), stats.fileData);
					}
					// @todo be lazier about actually requesting the file
					const buffer = await this._requestFile(path, 'buffer');
					// we don't initially have file sizes
					stats.size = buffer.length;
					stats.fileData = buffer;
					return new NoSyncFile(this, path, flags, Stats.clone(stats), buffer);
				default:
					throw new ApiError(ErrorCode.EINVAL, 'Invalid FileMode object.');
			}
		} else {
			throw ApiError.EPERM(path);
		}
	}

	public async readdir(path: string, cred: Cred): Promise<string[]> {
		return this.readdirSync(path, cred);
	}

	/**
	 * We have the entire file as a buffer; optimize readFile.
	 */
	public async readFile(fname: string, encoding: BufferEncoding, flag: FileFlag, cred: Cred): Promise<string | Buffer> {
		// Get file.
		const fd = await this.open(fname, flag, 0o644, cred);
		try {
			const fdCast = <NoSyncFile<HTTPRequest>>fd;
			const fdBuff = <Buffer>fdCast.getBuffer();
			if (encoding === null) {
				return copyingSlice(fdBuff);
			}
			return fdBuff.toString(encoding);
		} finally {
			await fd.close();
		}
	}

	private _getHTTPPath(filePath: string): string {
		if (filePath.charAt(0) === '/') {
			filePath = filePath.slice(1);
		}
		return this.prefixUrl + filePath;
	}

	/**
	 * Asynchronously download the given file.
	 */
	private _requestFile(p: string, type: 'buffer'): Promise<Buffer>;
	private _requestFile(p: string, type: 'json'): Promise<any>;
	private _requestFile(p: string, type: string): Promise<string>;
	private _requestFile(p: string, type: string): Promise<any> {
		return this._requestFileInternal(this._getHTTPPath(p), type);
	}

	/**
	 * Only requests the HEAD content, for the file size.
	 */
	private _requestFileSize(path: string): Promise<number> {
		return this._requestFileSizeInternal(this._getHTTPPath(path));
	}

}
