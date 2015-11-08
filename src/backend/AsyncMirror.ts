import file_system = require('../core/file_system');
import {ApiError, ErrorCode} from '../core/api_error';
import file_flag = require('../core/file_flag');
import file = require('../core/file');
import Stats from '../core/node_fs_stats';
import preload_file = require('../generic/preload_file');

interface IAsyncOperation {
	apiMethod: string;
	arguments: any[];
}

/**
 * We define our own file to interpose on syncSync() for mirroring purposes.
 */
class MirrorFile extends preload_file.PreloadFile<AsyncMirror> implements file.File {
  constructor(fs: AsyncMirror, path: string, flag: file_flag.FileFlag, stat: Stats, data: Buffer) {
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

/**
 * AsyncMirrorFS mirrors a synchronous filesystem into an asynchronous filesystem
 * by:
 * * Performing operations over the in-memory copy, while asynchronously pipelining them
 *   to the backing store.
 * * During application loading, the contents of the async file system can be reloaded into
 *   the synchronous store, if desired.
 * The two stores will be kept in sync. The most common use-case is to pair a synchronous
 * in-memory filesystem with an asynchronous backing store.
 */
export default class AsyncMirror extends file_system.SynchronousFileSystem implements file_system.FileSystem {
  /**
   * Queue of pending asynchronous operations.
   */
  private _queue: IAsyncOperation[] = [];
  private _queueRunning: boolean = false;
  private _sync: file_system.FileSystem;
  private _async: file_system.FileSystem;
  private _isInitialized: boolean = false;
  constructor(sync: file_system.FileSystem, async: file_system.FileSystem) {
    super();
    this._sync = sync;
    this._async = async;
    if (!sync.supportsSynch()) {
      throw new Error("Expected synchronous storage.");
    }
    if (async.supportsSynch()) {
      throw new Error("Expected asynchronous storage.");
    }
  }

  public getName(): string {
	 	return "AsyncMirror";
  }

  public static isAvailable(): boolean {
    return true;
  }

  public _syncSync(fd: preload_file.PreloadFile<any>) {
    this._sync.writeFileSync(fd.getPath(), fd.getBuffer(), null, file_flag.FileFlag.getFileFlag('w'), fd.getStats().mode);
    this.enqueueOp({
      apiMethod: 'writeFile',
      arguments: [fd.getPath(), fd.getBuffer(), null, fd.getFlag(), fd.getStats().mode]
    });
  }

  /**
   * Called once to load up files from async storage into sync storage.
   */
  public initialize(finalCb: (err?: ApiError) => void): void {
    if (!this._isInitialized) {
      var copyDirectory = (p: string, mode: number, cb: (err?: ApiError) => void) => {
        if (p !== '/') {
          this._sync.mkdirSync(p, mode);
        }
        this._async.readdir(p, (err, files) => {
          if (err) {
            cb(err);
          } else {
            var i = 0;
            function copyNextFile(err?: ApiError) {
              if (err) {
                cb(err);
              } else if (i < files.length) {
                copyItem(`${p}/${files[i]}`, copyNextFile);
                i++;
              } else {
                cb();
              }
            }
            copyNextFile();
          }
        });
      }, copyFile = (p: string, mode: number, cb: (err?: ApiError) => void) => {
        this._async.readFile(p, null, file_flag.FileFlag.getFileFlag('r'), (err, data) => {
          if (err) {
            cb(err);
          } else {
            try {
              this._sync.writeFileSync(p, data, null, file_flag.FileFlag.getFileFlag('w'), mode);
            } catch (e) {
              err = e;
            } finally {
              cb(err);
            }
          }
        });
      }, copyItem = (p: string, cb: (err?: ApiError) => void) => {
        this._async.stat(p, false, (err, stats) => {
          if (err) {
            cb(err);
          } else if (stats.isDirectory()) {
            copyDirectory(p, stats.mode, cb);
          } else {
            copyFile(p, stats.mode, cb);
          }
        });
      };
      copyDirectory('/', 0, (err?: ApiError) => {
        if (err) {
          finalCb(err);
        } else {
          this._isInitialized = true;
          finalCb();
        }
      });
    } else {
      finalCb();
    }
  }

  public isReadOnly(): boolean { return false; }
  public supportsSynch(): boolean { return true; }
  public supportsLinks(): boolean { return false; }
  public supportsProps(): boolean { return this._sync.supportsProps() && this._async.supportsProps(); }

  private enqueueOp(op: IAsyncOperation) {
    this._queue.push(op);
    if (!this._queueRunning) {
      this._queueRunning = true;
      var doNextOp = (err?: ApiError) => {
        if (err) {
          console.error(`WARNING: File system has desynchronized. Received following error: ${err}\n$`);
        }
        if (this._queue.length > 0) {
          var op = this._queue.shift(),
            args = op.arguments;
          args.push(doNextOp);
          (<Function> (<any> this._async)[op.apiMethod]).apply(this._async, args);
        } else {
          this._queueRunning = false;
        }
      };
      doNextOp();
    }
  }

  public renameSync(oldPath: string, newPath: string): void {
    this._sync.renameSync(oldPath, newPath);
    this.enqueueOp({
      apiMethod: 'rename',
      arguments: [oldPath, newPath]
    });
  }
  public statSync(p: string, isLstat: boolean): Stats {
    return this._sync.statSync(p, isLstat);
  }
  public openSync(p: string, flag: file_flag.FileFlag, mode: number): file.File {
    // Sanity check: Is this open/close permitted?
    var fd = this._sync.openSync(p, flag, mode);
    fd.closeSync();
    return new MirrorFile(this, p, flag, this._sync.statSync(p, false), this._sync.readFileSync(p, null, file_flag.FileFlag.getFileFlag('r')));
  }
  public unlinkSync(p: string): void {
    this._sync.unlinkSync(p);
    this.enqueueOp({
      apiMethod: 'unlink',
      arguments: [p]
    });
  }
  public rmdirSync(p: string): void {
    this._sync.rmdirSync(p);
    this.enqueueOp({
      apiMethod: 'rmdir',
      arguments: [p]
    });
  }
  public mkdirSync(p: string, mode: number): void {
    this._sync.mkdirSync(p, mode);
    this.enqueueOp({
      apiMethod: 'mkdir',
      arguments: [p, mode]
    });
  }
  public readdirSync(p: string): string[] {
    return this._sync.readdirSync(p);
  }
  public existsSync(p: string): boolean {
    return this._sync.existsSync(p);
  }
  public chmodSync(p: string, isLchmod: boolean, mode: number): void {
    this._sync.chmodSync(p, isLchmod, mode);
    this.enqueueOp({
      apiMethod: 'chmod',
      arguments: [p, isLchmod, mode]
    });
  }
  public chownSync(p: string, isLchown: boolean, uid: number, gid: number): void {
    this._sync.chownSync(p, isLchown, uid, gid);
    this.enqueueOp({
      apiMethod: 'chown',
      arguments: [p, isLchown, uid, gid]
    });
  }
  public utimesSync(p: string, atime: Date, mtime: Date): void {
    this._sync.utimesSync(p, atime, mtime);
    this.enqueueOp({
      apiMethod: 'utimes',
      arguments: [p, atime, mtime]
    });
  }
}
