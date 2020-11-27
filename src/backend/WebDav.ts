import {BaseFileSystem, BFSCallback, BFSOneArgCallback, FileSystem, FileSystemOptions} from "../core/file_system";
import {xhrIsAvailable} from "../generic/xhr";
import {fetchIsAvailable} from "../generic/fetch";
import Stats, {FileType} from "../core/node_fs_stats";
import {ApiError, ErrorCode} from "../core/api_error";
import {FileFlag} from "../core/file_flag";
import PreloadFile from "../generic/preload_file";
import {File} from '../core/file';

const webdav = require("webdav");

export interface WebDavOptions {
  // Used as the URL prefix for fetched files.
  // Default: Fetch files relative to the index.
  baseUrl?: string;
}

export default class WebDav extends BaseFileSystem implements FileSystem {
  public static readonly Name = "WebDav";
  public static readonly Options: FileSystemOptions = {
    baseUrl: {
      type: "string",
      optional: true,
      description: "Used as the URL prefix for fetched files. Default: Fetch files relative to the index."
    }
  };

  public static Create(opts: WebDavOptions, cb: BFSCallback<WebDav>): void {
    cb(null, new WebDav(opts.baseUrl));

  }

  public static isAvailable(): boolean {
    return xhrIsAvailable || fetchIsAvailable;
  }

  public readonly prefixUrl: string;
  public client: any;

  private _open: Map<string, WebDavFile>;

  private constructor(prefixUrl: string = '') {
    super();
    // prefix_url must end in a directory separator.
    if (prefixUrl.length > 0 && prefixUrl.charAt(prefixUrl.length - 1) !== '/') {
      prefixUrl = prefixUrl + '/';
    }
    this.prefixUrl = prefixUrl;
    this._open = new Map();
    this.client = webdav.createClient(
      "http://localhost/fs",
    );

  }

  public getName(): string {
    return WebDav.Name;
  }

  public isReadOnly(): boolean {
    return false;
  }

  public supportsLinks(): boolean {
    return false;
  }

  public supportsProps(): boolean {
    return false;
  }

  public supportsSynch(): boolean {
    // Synchronous operations are only available via the XHR interface for now.
    return false;
  }

  public stat(path: string, isLstat: boolean, cb: BFSCallback<Stats>): void {

    interface Stat {
      filename: string;
      basename: string;
      lastmod: string;
      size: number;
      type: "file" | "directory";
      mime?: string;
      etag?: string;
      props?: any;
    }

    this.client.stat(path)
      .then((stat: Stat) => {
          const lastModTime = new Date(stat.lastmod).getTime();
          const stats = new Stats(
            (stat.type === "file" ? FileType.FILE : FileType.DIRECTORY),
            stat.size,
            0o777,
            lastModTime,
            lastModTime,
            lastModTime,
            lastModTime
          );
          cb(null, stats);
        }, (error: { response: { status: number } }) => {
          if (error.response.status === 404) {
            cb(ApiError.ENOENT(path));
          }
        }
      );
  }

  public rename(oldPath: string, newPath: string, cb: BFSOneArgCallback): void {
    this.client.moveFile(oldPath, newPath).then(() => {
      const file = this._open.get(oldPath);
      if (file) {
        this._open.delete(oldPath);
        this._open.set(newPath, file);
        file.setPath(newPath);
      }
      cb(null);
    }, (error: { response: { status: number } }) => {
      if (error.response.status === 404) {
        cb(ApiError.ENOENT(oldPath));
      }
    });
  }

  public open(p: string, flag: FileFlag, mode: number, cb: BFSCallback<File>): void {
    this.stat(p, false, (err, stats: Stats | undefined) => {
      if (err) {
        return cb(err);
      }
      if (!stats) {
        return cb(new ApiError(ErrorCode.EIO));
      }
      this.client.getFileContents(p).then((arr: ArrayBuffer) => {
        const file = new WebDavFile(this, p, flag, stats, Buffer.from(arr));
        this._open.set(p, file);
        cb(null, file);
      }, (err: Error) => {
        // TODO more cases for error handling
        cb(new ApiError(ErrorCode.EIO, err.message));
      });
    });
  }

  public _closeFile(file: WebDavFile) {
    this._open.delete(file.getPath());
  }

  public readdir(p: string, cb: (e: (ApiError | null | undefined), rv?: string[]) => any): void {
    interface Listing {
      basename: string;
      etag: string;
      filename: string;
      lastmod: string;
      mime: string;
      size: number;
      type: "file" | "directory";
    }

    // TODO implement no error handling
    this.client.getDirectoryContents(p).then((listing: Array<Listing>) => {
      const contents = [];
      for (const i of listing) {
        contents.push(i.basename);
      }
      cb(null, contents);
    });
  }

  public mkdir(p: string, mode: number, cb: (e?: (ApiError | null)) => any): void {
    this.client.createDirectory(p).then(() => {
      cb();
    }, (err: Error) => {
      cb(new ApiError(ErrorCode.EIO, err.message));
    });
  }

  public exists(p: string, cb: (exists: boolean) => void): void {
    this.stat(p, false, (err, stat) => {
      if (stat) {
        cb(true);
      } else {
        cb(false);
      }
    });
  }
}

class WebDavFile extends PreloadFile<WebDav> implements File {
  protected _fs: WebDav;
  protected _path: string;
  protected _stat: Stats;
  protected _flag: FileFlag;
  protected _buffer: Buffer;
  protected _dirty: boolean = false;

  constructor(_fs: WebDav, _path: string, _flag: FileFlag, _stat: Stats, contents?: Buffer) {
    super(_fs, _path, _flag, _stat, contents);
  }

  public setPath(path: string): void {
    this._path = path;
  }

  public sync(cb: (e?: (ApiError | null)) => any): void {
    if (this._dirty) {
      this._fs.client.putFileContents(this._path, this._buffer).then(() => {
        cb(null);
      }, (err: ApiError) => {
        cb(new ApiError(ErrorCode.EIO, err.message));
      });
    }
  }

  public close(cb: BFSOneArgCallback): void {
    this.sync(cb);
    this._fs._closeFile(this);
  }
}
