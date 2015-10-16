import file_system = require('../core/file_system');
import buffer = require('../core/buffer');
import api_error = require('../core/api_error');
import file_flag = require('../core/file_flag');
import util = require('../core/util');
import file = require('../core/file');
import node_fs_stats = require('../core/node_fs_stats');
import preload_file = require('../generic/preload_file');
import browserfs = require('../core/browserfs');
import path = require('../core/node_path');
import ApiError = api_error.ApiError;
import Buffer = buffer.Buffer;
import ErrorCode = api_error.ErrorCode;

var deletionLogPath = '/.deletedFiles.log';

/**
 * Given a read-only mode, makes it writable.
 */
function makeModeWritable(mode: number): number {
  return 0x92 | mode;
}

/**
 * Overlays a RO file to make it writable.
 */
class OverlayFile extends preload_file.PreloadFile<OverlayFS> implements file.File {
  constructor(fs: OverlayFS, path: string, flag: file_flag.FileFlag, stats: node_fs_stats.Stats, data: Buffer) {
    super(fs, path, flag, stats, data);
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
 * OverlayFS makes a read-only filesystem writable by storing writes on a second,
 * writable file system. Deletes are persisted via metadata stored on the writable
 * file system.
 *
 * Currently only works for two synchronous file systems.
 */
class OverlayFS extends file_system.SynchronousFileSystem implements file_system.FileSystem {
  private _writable: file_system.FileSystem;
  private _readable: file_system.FileSystem;
  private _isInitialized: boolean = false;
  private _deletedFiles: {[path: string]: boolean} = {};
  private _deleteLog: file.File = null;

  constructor(writable: file_system.FileSystem, readable: file_system.FileSystem) {
    super();
    this._writable = writable;
    this._readable = readable;
    if (this._writable.isReadOnly()) {
      throw new ApiError(ErrorCode.EINVAL, "Writable file system must be writable.");
    }
    if (!this._writable.supportsSynch() || !this._readable.supportsSynch()) {
      throw new ApiError(ErrorCode.EINVAL, "OverlayFS currently only operates on synchronous file systems.");
    }
  }

  public getOverlayedFileSystems(): { readable: file_system.FileSystem; writable: file_system.FileSystem; } {
    return {
      readable: this._readable,
      writable: this._writable
    };
  }

  /**
   * With the given path, create the needed parent directories on the writable storage
   * should they not exist. Use modes from the read-only storage.
   */
  private createParentDirectories(p: string): void {
    var parent = path.dirname(p), toCreate: string[] = [];
    while (!this._writable.existsSync(parent)) {
      toCreate.push(parent);
      parent = path.dirname(parent);
    }
    toCreate = toCreate.reverse();

    toCreate.forEach((p: string) => {
      this._writable.mkdirSync(p, this.statSync(p, false).mode);
    });
  }

  public static isAvailable(): boolean {
    return true;
  }

  public _syncSync(file: preload_file.PreloadFile<any>): void {
    this.createParentDirectories(file.getPath());
    this._writable.writeFileSync(file.getPath(), file.getBuffer(), null, file_flag.FileFlag.getFileFlag('w'), file.getStats().mode);
  }

  public getName() {
    return "OverlayFS";
  }

  /**
   * Called once to load up metadata stored on the writable file system.
   */
  public initialize(cb: (err?: ApiError) => void): void {
    if (!this._isInitialized) {
      // Read deletion log, process into metadata.
      this._writable.readFile(deletionLogPath, 'utf8',
        file_flag.FileFlag.getFileFlag('r'), (err: ApiError, data?: string) => {
        if (err) {
          // ENOENT === Newly-instantiated file system, and thus empty log.
          if (err.type !== ErrorCode.ENOENT) {
            return cb(err);
          }
        } else {
          data.split('\n').forEach((path: string) => {
            // If the log entry begins w/ 'd', it's a deletion. Otherwise, it's
            // an undeletion.
            // TODO: Clean up log during initialization phase.
            this._deletedFiles[path.slice(1)] = path.slice(0, 1) === 'd';
          });
        }
        // Open up the deletion log for appending.
        this._writable.open(deletionLogPath, file_flag.FileFlag.getFileFlag('a'),
          0x1a4, (err: ApiError, fd?: file.File) => {
          if (err) {
            cb(err);
          } else {
            this._deleteLog = fd;
            cb();
          }
        });
      });
    } else {
      cb();
    }
  }

  public isReadOnly(): boolean { return false; }
  public supportsSynch(): boolean { return true; }
  public supportsLinks(): boolean { return false; }
  public supportsProps(): boolean { return this._readable.supportsProps() && this._writable.supportsProps(); }

  private deletePath(p: string): void {
    this._deletedFiles[p] = true;
    var buff = new Buffer("d" + p + "\n");
    this._deleteLog.writeSync(buff, 0, buff.length, null);
    this._deleteLog.syncSync();
  }

  private undeletePath(p: string): void {
    if (this._deletedFiles[p]) {
      this._deletedFiles[p] = false;
      var buff = new Buffer("u" + p);
      this._deleteLog.writeSync(buff, 0, buff.length, null);
      this._deleteLog.syncSync();
    }
  }

  public renameSync(oldPath: string, newPath: string): void {
    // Write newPath using oldPath's contents, delete oldPath.
    var oldStats = this.statSync(oldPath, false);
    if (oldStats.isDirectory()) {
      // Optimization: Don't bother moving if old === new.
      if (oldPath === newPath) {
        return;
      }

      var mode = 0x1ff;
      if (this.existsSync(newPath)) {
        var stats = this.statSync(newPath, false),
          mode = stats.mode;
        if (stats.isDirectory()) {
          if (this.readdirSync(newPath).length > 0) {
            throw new ApiError(ErrorCode.ENOTEMPTY, `Path ${newPath} not empty.`);
          }
        } else {
          throw new ApiError(ErrorCode.ENOTDIR, `Path ${newPath} is a file.`);
        }
      }

      // Take care of writable first. Move any files there, or create an empty directory
      // if it doesn't exist.
      if (this._writable.existsSync(oldPath)) {
        this._writable.renameSync(oldPath, newPath);
      } else if (!this._writable.existsSync(newPath)) {
        this._writable.mkdirSync(newPath, mode);
      }

      // Need to move *every file/folder* currently stored on readable to its new location
      // on writable.
      if (this._readable.existsSync(oldPath)) {
        this._readable.readdirSync(oldPath).forEach((name) => {
          // Recursion! Should work for any nested files / folders.
          this.renameSync(path.resolve(oldPath, name), path.resolve(newPath, name));
        });
      }
    } else {
      if (this.existsSync(newPath) && this.statSync(newPath, false).isDirectory()) {
        throw new ApiError(ErrorCode.EISDIR, `Path ${newPath} is a directory.`);
      }

      this.writeFileSync(newPath,
        this.readFileSync(oldPath, null, file_flag.FileFlag.getFileFlag('r')), null,
        file_flag.FileFlag.getFileFlag('w'), oldStats.mode);
    }

    if (oldPath !== newPath && this.existsSync(oldPath)) {
      this.unlinkSync(oldPath);
    }
  }
  public statSync(p: string, isLstat: boolean): node_fs_stats.Stats {
    try {
      return this._writable.statSync(p, isLstat);
    } catch (e) {
      if (this._deletedFiles[p]) {
        throw new ApiError(ErrorCode.ENOENT, `Path ${p} does not exist.`);
      }
      var oldStat = this._readable.statSync(p, isLstat).clone();
      // Make the oldStat's mode writable. Preserve the topmost part of the
      // mode, which specifies if it is a file or a directory.
      oldStat.mode = makeModeWritable(oldStat.mode);
      return oldStat;
    }
  }
  public openSync(p: string, flag: file_flag.FileFlag, mode: number): file.File {
    if (this.existsSync(p)) {
      switch (flag.pathExistsAction()) {
        case file_flag.ActionType.TRUNCATE_FILE:
          this.createParentDirectories(p);
          return this._writable.openSync(p, flag, mode);
        case file_flag.ActionType.NOP:
          if (this._writable.existsSync(p)) {
            return this._writable.openSync(p, flag, mode);
          } else {
            // Create an OverlayFile.
            var stats = this._readable.statSync(p, false).clone();
            stats.mode = mode;
            return new OverlayFile(this, p, flag, stats, this._readable.readFileSync(p, null, file_flag.FileFlag.getFileFlag('r')));
          }
        default:
          throw new ApiError(ErrorCode.EEXIST, `Path ${p} exists.`);
      }
    } else {
      switch(flag.pathNotExistsAction()) {
        case file_flag.ActionType.CREATE_FILE:
          this.createParentDirectories(p);
          return this._writable.openSync(p, flag, mode);
        default:
          throw new ApiError(ErrorCode.ENOENT, `Path ${p} does not exist.`);
      }
    }
  }
  public unlinkSync(p: string): void {
    if (this.existsSync(p)) {
      if (this._writable.existsSync(p)) {
        this._writable.unlinkSync(p);
      }

      // Does it still exist?
      if (this.existsSync(p)) {
        // Add to delete log.
        this.deletePath(p);
      }
    } else {
      throw new ApiError(ErrorCode.ENOENT, `Path ${p} does not exist.`);
    }
  }
  public rmdirSync(p: string): void {
    if (this.existsSync(p)) {
      if (this._writable.existsSync(p)) {
        this._writable.rmdirSync(p);
      }
      if (this.existsSync(p)) {
        // Check if directory is empty.
        if (this.readdirSync(p).length > 0) {
          throw new ApiError(ErrorCode.ENOTEMPTY, `Directory ${p} is not empty.`);
        } else {
          this.deletePath(p);
        }
      }
    } else {
      throw new ApiError(ErrorCode.ENOENT, `Path ${p} does not exist.`);
    }
  }
  public mkdirSync(p: string, mode: number): void {
    if (this.existsSync(p)) {
      throw new ApiError(ErrorCode.EEXIST, `Path ${p} already exists.`);
    } else {
      // The below will throw should any of the parent directories fail to exist
      // on _writable.
      this.createParentDirectories(p);
      this._writable.mkdirSync(p, mode);
    }
  }
  public readdirSync(p: string): string[] {
    var dirStats = this.statSync(p, false);
    if (!dirStats.isDirectory()) {
      throw new ApiError(ErrorCode.ENOTDIR, `Path ${p} is not a directory.`);
    }

    // Readdir in both, merge, check delete log on each file, return.
    var contents: string[] = [];
    try {
      contents = contents.concat(this._writable.readdirSync(p));
    } catch (e) {
    }
    try {
      contents = contents.concat(this._readable.readdirSync(p));
    } catch (e) {
    }
    var seenMap: {[name: string]: boolean} = {};
    return contents.filter((fileP: string) => {
      var result = seenMap[fileP] === undefined && this._deletedFiles[p + "/" + fileP] !== true;
      seenMap[fileP] = true;
      return result;
    });
  }
  public existsSync(p: string): boolean {
    return this._writable.existsSync(p) || (this._readable.existsSync(p) && this._deletedFiles[p] !== true);
  }
  public chmodSync(p: string, isLchmod: boolean, mode: number): void {
    this.operateOnWritable(p, () => {
      this._writable.chmodSync(p, isLchmod, mode);
    });
  }
  public chownSync(p: string, isLchown: boolean, uid: number, gid: number): void {
    this.operateOnWritable(p, () => {
      this._writable.chownSync(p, isLchown, uid, gid);
    });
  }
  public utimesSync(p: string, atime: Date, mtime: Date): void {
    this.operateOnWritable(p, () => {
      this._writable.utimesSync(p, atime, mtime);
    });
  }

  /**
   * Helper function:
   * - Ensures p is on writable before proceeding. Throws an error if it doesn't exist.
   * - Calls f to perform operation on writable.
   */
  private operateOnWritable(p: string, f: () => void): void {
    if (this.existsSync(p)) {
      if (!this._writable.existsSync(p)) {
        // File is on readable storage. Copy to writable storage before
        // changing its mode.
        this.copyToWritable(p);
      }
      f();
    } else {
      throw new ApiError(ErrorCode.ENOENT, `Path ${p} does not exist.`);
    }
  }

  /**
   * Copy from readable to writable storage.
   * PRECONDITION: File does not exist on writable storage.
   */
  private copyToWritable(p: string): void {
    var pStats = this.statSync(p, false);
    if (pStats.isDirectory()) {
      this._writable.mkdirSync(p, pStats.mode);
    } else {
      this.writeFileSync(p,
        this._readable.readFileSync(p, null, file_flag.FileFlag.getFileFlag('r')), null,
        file_flag.FileFlag.getFileFlag('w'), this.statSync(p, false).mode);
    }
  }
}

browserfs.registerFileSystem('OverlayFS', OverlayFS);

export = OverlayFS;
