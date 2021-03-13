import {BaseFileSystem, BFSCallback, BFSOneArgCallback, FileSystem, FileSystemOptions} from "../core/file_system";
import {xhrIsAvailable} from "../generic/xhr";
import {fetchIsAvailable} from "../generic/fetch";
import Stats, {FileType} from "../core/node_fs_stats";
import {ApiError, ErrorCode} from "../core/api_error";
import {ActionType, FileFlag} from "../core/file_flag";
import PreloadFile from "../generic/preload_file";
import {File} from '../core/file';

interface WebDAVClientError extends Error {
  status?: number;
}

const webdav = require("webdav");

export interface WebDavOptions {
  // Used as the URL prefix for fetched files.
  // Default: Fetch files relative to the index.
  prefixUrl?: string;
  authOptions?: {
    username?: string,
    password?: string,
    token?: {
      token_type: string,
      access_token: string
    }
    digest?: boolean
  };
}

export default class WebDav extends BaseFileSystem implements FileSystem {
  public static readonly Name = "WebDav";
  public static readonly Options: FileSystemOptions = {
    prefixUrl: {
      type: "string",
      optional: true,
      description: "Used as the URL prefix for fetched files. Default: Fetch files relative to the index."
    },
    authOptions: {
      type: "object",
      optional: true,
      description: "used to pass auth information to the underlying webdav-client."
    }
  };

  public static Create(opts: WebDavOptions, cb: BFSCallback<WebDav>): void {
    cb(null, new WebDav(opts.prefixUrl, opts.authOptions));

  }

  public static isAvailable(): boolean {
    return xhrIsAvailable || fetchIsAvailable;
  }

  public readonly prefixUrl: string;
  public client: any;

  private _open: Map<string, WebDavFile>;

  private constructor(prefixUrl: string = '', authOptions?: WebDavOptions["authOptions"]) {
    super();
    // prefix_url must end in a directory separator.
    if (prefixUrl.length > 0 && prefixUrl.charAt(prefixUrl.length - 1) !== '/') {
      prefixUrl = prefixUrl + '/';
    }
    this.prefixUrl = prefixUrl;
    this._open = new Map();
    this.client = webdav.createClient(
      this.prefixUrl,
      authOptions
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

        }, (error: WebDAVClientError) => {
          switch (error.status) {
            case 404:
              cb(ApiError.ENOENT(path));
              break;
            default:
              cb(new ApiError(ErrorCode.EIO));
          }
        }
      );
  }

  public rename(oldPath: string, newPath: string, cb: BFSOneArgCallback): void {
    if (oldPath === newPath) {
      return cb();
    }
    this.stat(newPath, false, (err, stats) => {
      if (err && err.errno === ErrorCode.ENOENT || stats && stats.isFile()) {
        this.client.moveFile(oldPath, newPath, {headers: {Overwrite: "T"}}).then(() => {
          const file = this._open.get(oldPath);
          if (file) {
            this._open.delete(oldPath);
            this._open.set(newPath, file);
            file.setPath(newPath);
          }
          cb(null);
        }, (error: WebDAVClientError) => {
          if (error.status === 404) {
            cb(ApiError.ENOENT(oldPath));
          } else {
            cb(new ApiError(ErrorCode.EIO, oldPath));
          }
        });
      } else {
        cb(ApiError.EISDIR(newPath));
      }
    });

  }

  public open(p: string, flag: FileFlag, mode: number, cb: BFSCallback<File>): void {
    this.stat(p, false, (err: ApiError, stats: Stats) => {
      if (err) {
        if (err.errno === ErrorCode.ENOENT) {
          if (flag.pathNotExistsAction() === ActionType.CREATE_FILE) {
            const file = new WebDavFile(this, p, flag, new Stats(FileType.FILE, 0));
            this._open.set(p, file);
            return cb(null, file);
          } else {
            return cb(err);
          }
        } else {
          return cb(err);
        }
      } else {
        if (stats.isDirectory()) {
          return cb(ApiError.EISDIR(p));
        }
        switch (flag.pathExistsAction()) {
          case ActionType.NOP:
            this.client.getFileContents(p).then((content: Uint8Array) => {
              const file = new WebDavFile(this, p, flag, stats, Buffer.from(content));
              this._open.set(p, file);
              return cb(null, file);
            }, (error: WebDAVClientError) => {
              switch (error.status) {
                case 404:
                  cb(ApiError.ENOENT(p));
                  break;
                case 405:
                  cb(ApiError.EISDIR(p));
                  break;
                default:
                  cb(new ApiError(ErrorCode.EIO));
              }
            });
            return;
          case ActionType.THROW_EXCEPTION:
            return cb(ApiError.EEXIST(p));
          case ActionType.TRUNCATE_FILE:
            const file = new WebDavFile(this, p, flag, stats, Buffer.from([]));
            stats.size = 0;
            stats.blksize = 1;
            this._open.set(p, file);
            return cb(null, file);
        }

      }
    });
  }

  public unlink(p: string, cb: (e?: (ApiError | null)) => any): void {
    this.client.deleteFile(p).then(() => {
      cb();
    }, (error: WebDAVClientError) => {
      switch (error.status) {
        case 404:
          cb(ApiError.ENOENT(p));
          break;
        default:
          cb(new ApiError(ErrorCode.EIO, "Failed Unlink with unknown status code" + error.status));
      }
    });
  }

  public rmdir(p: string, cb: (e?: (ApiError | null)) => any): void {
    this.readdir(p, (err, contents) => {
      if (err) {
        return cb(err);
      }
      if (contents && contents.length === 0) {
        this.client.deleteFile(p).then(() => {
          cb();
        }, (error: WebDAVClientError) => {
          switch (error.status) {
            case 200:
              return cb(null);
            case 404:
              return cb(ApiError.ENOENT(p));
            default:
              return cb(new ApiError(ErrorCode.EIO, p));
          }
        });
      } else {
        cb(ApiError.ENOTEMPTY(p));
      }
    });
  }

  /**
   * WebDav by default deletes in a recursive manner, why not take advantage of that
   * @param p
   * @param cb
   */
  public rmdirR(p: string, cb: (e?: (ApiError | null)) => any): void {
    this.client.deleteFile(p).then(() => {
      cb();
    }, (error: WebDAVClientError) => {
      switch (error.status) {
        case 404:
          cb(ApiError.ENOENT(p));
          break;
        default:
          cb(new ApiError(ErrorCode.EIO, "Failed Unlink with unknown status code" + error.status));
      }
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

    // getDirectoryContents can be called on a file and the result looks like a normal dir with a single file
    this.client.getDirectoryContents(p).then((listing: Array<Listing>) => {

      if (listing.length === 1 && listing[0].filename === p) { // we are looking at a file
        return cb(ApiError.ENOTDIR(p));
      }

      const contents = [];
      for (const i of listing) {
        contents.push(i.basename);
      }
      cb(null, contents);
    }, (err: WebDAVClientError) => {
      switch (err.status) {
        case 404:
          return cb(ApiError.ENOENT(p));
        default:
          cb(new ApiError(ErrorCode.EIO, err.message));
      }
    });
  }

  public mkdir(p: string, mode: number, cb: (e?: (ApiError | null)) => any): void {
    this.client.createDirectory(p).then(() => {
      cb(null);
    }, (err: WebDAVClientError) => {
      switch (err.status) {
        case 405:
          cb(ApiError.EEXIST(p));
          break;
        case 409:
          cb(ApiError.ENOENT(p));
          break;
        default:
          cb(new ApiError(ErrorCode.EIO, err.message));
      }
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
    } else {
      cb(null);
    }
  }

  public close(cb: BFSOneArgCallback): void {
    this.sync(cb);
    this._fs._closeFile(this);
  }
}
