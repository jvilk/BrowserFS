import file_system = require('../core/file_system');
import buffer = require('../core/buffer');
import api_error = require('../core/api_error');
import file_flag = require('../core/file_flag');
import util = require('../core/util');
import file = require('../core/file');
import node_fs_stats = require('../core/node_fs_stats');
import preload_file = require('../generic/preload_file');
import browserfs = require('../core/browserfs');
import node_path = require('../core/node_path');
import path = node_path.path;

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
class OverlayFile extends preload_file.PreloadFile implements file.File {
  constructor(fs: OverlayFS, path: string, flag: file_flag.FileFlag, stats: node_fs_stats.Stats, data: Buffer) {
    super(fs, path, flag, stats, data);
  }

  public syncSync(): void {
    if (this.isDirty()) {
      (<OverlayFS> this._fs)._syncSync(this);
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
    console.log("Constructor.");
    this._writable = writable;
    this._readable = readable;
    if (this._writable.isReadOnly()) {
      throw new api_error.ApiError(api_error.ErrorCode.EINVAL, "Writable file system must be writable.");
    }    
    if (!this._writable.supportsSynch() || !this._readable.supportsSynch()) {
      throw new api_error.ApiError(api_error.ErrorCode.EINVAL, "OverlayFS currently only operates on synchronous file systems.");
    }
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
    
    toCreate.forEach((p: string) => {
      this._writable.mkdirSync(p, this.statSync(p, false).mode);
    });
  }
  
  public static isAvailable(): boolean {
    return true;
  }
  
  public _syncSync(file: preload_file.PreloadFile): void {
    console.log("_syncSync");
    this.createParentDirectories(file.getPath());
    this._writable.writeFileSync(file.getPath(), file.getBuffer(), null, file.getFlag(), file.getStats().mode);
  }
  
  public getName() {
    return "OverlayFS";
  }
  
  /**
   * Called once to load up metadata stored on the writable file system. 
   */
  public initialize(cb: (err?: api_error.ApiError) => void): void {
    console.log("Initialize.");
    if (!this._isInitialized) {
      // Read deletion log, process into metadata.
      this._writable.readFile(deletionLogPath, 'utf8',
        file_flag.FileFlag.getFileFlag('r'), (err: api_error.ApiError, data?: string) => {
        if (err) {
          // ENOENT === Newly-instantiated file system, and thus empty log.
          if (err.type !== api_error.ErrorCode.ENOENT) {
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
          0x1a4, (err: api_error.ApiError, fd?: file.File) => {
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
    console.log(`deletePath ${p}`);
    this._deletedFiles[p] = true;
    var buff = new Buffer("d" + p);
    this._deleteLog.writeSync(buff, 0, buff.length, null);
    this._deleteLog.syncSync();
  }
  
  private undeletePath(p: string): void {
    console.log(`undeletePath ${p}`);
    if (this._deletedFiles[p]) {
      this._deletedFiles[p] = false;
      var buff = new Buffer("u" + p);
      this._deleteLog.writeSync(buff, 0, buff.length, null);
      this._deleteLog.syncSync();
    }
  }

  public renameSync(oldPath: string, newPath: string): void {
    console.log(`renameSync ${oldPath} => ${newPath}`);
    if (this.existsSync(newPath)) {
      throw new api_error.ApiError(api_error.ErrorCode.EEXIST, `Path ${newPath} already exists.`);
    }
    // Write newPath using oldPath's contents, delete oldPath.
    var oldStats = this.statSync(oldPath, false);    
    this.writeFileSync(newPath,
      this.readFileSync(oldPath, null, file_flag.FileFlag.getFileFlag('r')), null,
      file_flag.FileFlag.getFileFlag('w'), oldStats.mode);
    this.unlinkSync(oldPath);
  }
  public statSync(p: string, isLstat: boolean): node_fs_stats.Stats {
    console.log(`statSync ${p}`);
    try {
      return this._writable.statSync(p, isLstat);
    } catch (e) {
      if (this._deletedFiles[p]) {
        throw new api_error.ApiError(api_error.ErrorCode.ENOENT, `Path ${p} does not exist.`);
      }
      var oldStat = this._readable.statSync(p, isLstat).clone();
      // Make the oldStat's mode writable. Preserve the topmost part of the
      // mode, which specifies if it is a file or a directory.
      oldStat.mode = makeModeWritable(oldStat.mode);
      return oldStat;
    }
  }
  public openSync(p: string, flag: file_flag.FileFlag, mode: number): file.File {
    console.log(`openSync ${p}`);
    if (this.existsSync(p)) {
      switch (flag.pathExistsAction()) {
        case file_flag.ActionType.TRUNCATE_FILE:
          this.createParentDirectories(p);
          return this._writable.openSync(p, flag, mode);
        case file_flag.ActionType.NOP:
          // Copy from readable first.
          if (this._readable.existsSync(p)) {
            this.copyToWritable(p);
          }
          return this._writable.openSync(p, flag, mode);
        default:
          throw new api_error.ApiError(api_error.ErrorCode.ENOENT, `Path ${p} does not exist.`);
      }
    } else {
      switch(flag.pathNotExistsAction()) {
        case file_flag.ActionType.CREATE_FILE:
          this.createParentDirectories(p);
          return this._writable.openSync(p, flag, mode);
        default:
          throw new api_error.ApiError(api_error.ErrorCode.EEXIST, `Path ${p} exists.`);
      }
    }
  }
  public unlinkSync(p: string): void {
    console.log(`unlinkSync ${p}`);
    if (this._writable.existsSync(p)) {
      this._writable.unlinkSync(p);
    }
    
    if (this.existsSync(p)) {
      // Add to delete log.
      this.deletePath(p);
    }
  }
  public rmdirSync(p: string): void {
    console.log(`rmdirSync ${p}`);
    if (this._writable.existsSync(p)) {
      this._writable.rmdirSync(p);
    }
    if (this.existsSync(p)) {
      // Check if directory is empty.
      if (this.readdirSync(p).length > 0) {
        throw new api_error.ApiError(api_error.ErrorCode.ENOTEMPTY, `Directory ${p} is not empty.`);
      } else {
        this.deletePath(p);
      }
    }
  }
  public mkdirSync(p: string, mode: number): void {
    console.log(`mkdirSync ${p}`);
    if (this.existsSync(p)) {
      throw new api_error.ApiError(api_error.ErrorCode.EEXIST, `Path ${p} already exists.`);
    } else {
      // The below will throw should any of the parent directories fail to exist
      // on _writable.
      this.createParentDirectories(p);
      this._writable.mkdirSync(p, mode);
    }
  }
  public readdirSync(p: string): string[] {
    console.log(`readdirSync ${p}`);
    var dirStats = this.statSync(p, false);
    if (!dirStats.isDirectory()) {
      throw new api_error.ApiError(api_error.ErrorCode.ENOTDIR, `Path ${p} is not a directory.`);
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
    return contents.filter((fileP: string) => this._deletedFiles[p + "/" + fileP] !== true);
  }
  public existsSync(p: string): boolean {
    console.log(`existsSync ${p}`);
    return this._writable.existsSync(p) || (this._readable.existsSync(p) && this._deletedFiles[p] !== true);
  }
  public chmodSync(p: string, isLchmod: boolean, mode: number): void {
    console.log(`chmodSync ${p}`);
    this.operateOnWritable(p, () => {
      this._writable.chmodSync(p, isLchmod, mode);
    });
  }
  public chownSync(p: string, isLchown: boolean, uid: number, gid: number): void {
    console.log(`chownSync ${p}`);
    this.operateOnWritable(p, () => {
      this._writable.chownSync(p, isLchown, uid, gid);
    });
  }
  public utimesSync(p: string, atime: Date, mtime: Date): void {
    console.log(`utimesSync ${p}`);
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
      throw new api_error.ApiError(api_error.ErrorCode.ENOENT, `Path ${p} does not exist.`);
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
      // No need to query the FS's directly. Use our write/read methods. Since the file
      // isn't on the writable storage, the read will hit the readable storage.
      this.writeFileSync(p,
        this.readFileSync(p, null, file_flag.FileFlag.getFileFlag('r')), null,
        file_flag.FileFlag.getFileFlag('w'), this.statSync(p, false).mode);
    }
  }
}

browserfs.registerFileSystem('IndexedDB', OverlayFS);

export = OverlayFS;
