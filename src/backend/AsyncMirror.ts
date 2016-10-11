import {FileSystem, SynchronousFileSystem} from '../core/file_system';
import {ApiError, ErrorCode} from '../core/api_error';
import {FileFlag} from '../core/file_flag';
import {File} from '../core/file';
import Stats from '../core/node_fs_stats';
import PreloadFile from '../generic/preload_file';
import * as path from 'path';

interface IAsyncOperation {
  apiMethod: string;
  arguments: any[];
}

/**
 * We define our own file to interpose on syncSync() for mirroring purposes.
 */
class MirrorFile extends PreloadFile<AsyncMirror> implements File {
  constructor(fs: AsyncMirror, path: string, flag: FileFlag, stat: Stats, data: Buffer) {
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
export default class AsyncMirror extends SynchronousFileSystem implements FileSystem {
  public static isAvailable(): boolean {
    return true;
  }

  /**
   * Queue of pending asynchronous operations.
   */
  private _queue: IAsyncOperation[] = [];
  private _queueRunning: boolean = false;
  private _sync: FileSystem;
  private _async: FileSystem;
  private _isInitialized: boolean = false;
  private _initializeCallbacks: ((e?: ApiError) => void)[] = [];
  constructor(sync: FileSystem, async: FileSystem) {
    super();
    this._sync = sync;
    this._async = async;
    if (!sync.supportsSynch()) {
      throw new Error("The first argument to AsyncMirror needs to be a synchronous file system.");
    }
  }

  public getName(): string {
    return "AsyncMirror";
  }

  public _syncSync(fd: PreloadFile<any>) {
    this._sync.writeFileSync(fd.getPath(), fd.getBuffer(), null, FileFlag.getFileFlag('w'), fd.getStats().mode);
    this.enqueueOp({
      apiMethod: 'writeFile',
      arguments: [fd.getPath(), fd.getBuffer(), null, fd.getFlag(), fd.getStats().mode]
    });
  }

  /**
   * Called once to load up files from async storage into sync storage.
   */
  public initialize(userCb: (err?: ApiError) => void): void {
    const callbacks = this._initializeCallbacks;

    const end = (e?: ApiError): void => {
      this._isInitialized = !e;
      this._initializeCallbacks = [];
      callbacks.forEach((cb) => cb(e));
    };

    if (!this._isInitialized) {
      // First call triggers initialization, the rest wait.
      if (callbacks.push(userCb) === 1) {
        const copyDirectory = (p: string, mode: number, cb: (err?: ApiError) => void) => {
          if (p !== '/') {
            this._sync.mkdirSync(p, mode);
          }
          this._async.readdir(p, (err, files) => {
            let i = 0;
            // NOTE: This function must not be in a lexically nested statement,
            // such as an if or while statement. Safari refuses to run the
            // script since it is undefined behavior.
            function copyNextFile(err?: ApiError) {
              if (err) {
                cb(err);
              } else if (i < files.length) {
                copyItem(path.join(p, files[i]), copyNextFile);
                i++;
              } else {
                cb();
              }
            }
            if (err) {
              cb(err);
            } else {
              copyNextFile();
            }
          });
        }, copyFile = (p: string, mode: number, cb: (err?: ApiError) => void) => {
          this._async.readFile(p, null, FileFlag.getFileFlag('r'), (err, data) => {
            if (err) {
              cb(err);
            } else {
              try {
                this._sync.writeFileSync(p, data, null, FileFlag.getFileFlag('w'), mode);
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
        copyDirectory('/', 0, end);
      }
    } else {
      userCb();
    }
  }

  public isReadOnly(): boolean { return false; }
  public supportsSynch(): boolean { return true; }
  public supportsLinks(): boolean { return false; }
  public supportsProps(): boolean { return this._sync.supportsProps() && this._async.supportsProps(); }

  public renameSync(oldPath: string, newPath: string): void {
    this.checkInitialized();
    this._sync.renameSync(oldPath, newPath);
    this.enqueueOp({
      apiMethod: 'rename',
      arguments: [oldPath, newPath]
    });
  }

  public statSync(p: string, isLstat: boolean): Stats {
    this.checkInitialized();
    return this._sync.statSync(p, isLstat);
  }

  public openSync(p: string, flag: FileFlag, mode: number): File {
    this.checkInitialized();
    // Sanity check: Is this open/close permitted?
    let fd = this._sync.openSync(p, flag, mode);
    fd.closeSync();
    return new MirrorFile(this, p, flag, this._sync.statSync(p, false), this._sync.readFileSync(p, null, FileFlag.getFileFlag('r')));
  }

  public unlinkSync(p: string): void {
    this.checkInitialized();
    this._sync.unlinkSync(p);
    this.enqueueOp({
      apiMethod: 'unlink',
      arguments: [p]
    });
  }

  public rmdirSync(p: string): void {
    this.checkInitialized();
    this._sync.rmdirSync(p);
    this.enqueueOp({
      apiMethod: 'rmdir',
      arguments: [p]
    });
  }

  public mkdirSync(p: string, mode: number): void {
    this.checkInitialized();
    this._sync.mkdirSync(p, mode);
    this.enqueueOp({
      apiMethod: 'mkdir',
      arguments: [p, mode]
    });
  }

  public readdirSync(p: string): string[] {
    this.checkInitialized();
    return this._sync.readdirSync(p);
  }

  public existsSync(p: string): boolean {
    this.checkInitialized();
    return this._sync.existsSync(p);
  }

  public chmodSync(p: string, isLchmod: boolean, mode: number): void {
    this.checkInitialized();
    this._sync.chmodSync(p, isLchmod, mode);
    this.enqueueOp({
      apiMethod: 'chmod',
      arguments: [p, isLchmod, mode]
    });
  }

  public chownSync(p: string, isLchown: boolean, uid: number, gid: number): void {
    this.checkInitialized();
    this._sync.chownSync(p, isLchown, uid, gid);
    this.enqueueOp({
      apiMethod: 'chown',
      arguments: [p, isLchown, uid, gid]
    });
  }

  public utimesSync(p: string, atime: Date, mtime: Date): void {
    this.checkInitialized();
    this._sync.utimesSync(p, atime, mtime);
    this.enqueueOp({
      apiMethod: 'utimes',
      arguments: [p, atime, mtime]
    });
  }

  private checkInitialized(): void {
    if (!this._isInitialized) {
      throw new ApiError(ErrorCode.EPERM, "AsyncMirrorFS is not initialized. Please initialize AsyncMirrorFS using its initialize() method before using it.");
    }
  }

  private enqueueOp(op: IAsyncOperation) {
    this._queue.push(op);
    if (!this._queueRunning) {
      this._queueRunning = true;
      let doNextOp = (err?: ApiError) => {
        if (err) {
          console.error(`WARNING: File system has desynchronized. Received following error: ${err}\n$`);
        }
        if (this._queue.length > 0) {
          let op = this._queue.shift(),
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
}
