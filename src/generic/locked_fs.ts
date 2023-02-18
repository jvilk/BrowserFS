import Mutex from './mutex';
import {FileSystem, BFSOneArgCallback, BFSCallback} from '../core/file_system';
import {ApiError} from '../core/api_error';
import {FileFlag} from '../core/file_flag';
import {default as Stats} from '../core/node_fs_stats';
import {File} from '../core/file';
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
    return 'LockedFS<' + this._fs.getName()  + '>';
  }

  public getFSUnlocked(): T {
    return this._fs;
  }

  public diskSpace(p: string, cb: (total: number, free: number) => any): void {
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

  public rename(oldPath: string, newPath: string, cred: Cred, cb: BFSOneArgCallback): void {
    this._mu.lock(() => {
      this._fs.rename(oldPath, newPath, cred, (err?: ApiError) => {
        this._mu.unlock();
        cb(err);
      });
    });
  }

  public renameSync(oldPath: string, newPath: string, cred: Cred): void {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.renameSync(oldPath, newPath, cred);
  }

  public stat(p: string, isLstat: boolean, cred: Cred, cb: BFSCallback<Stats>): void {
    this._mu.lock(() => {
      this._fs.stat(p, isLstat, cred, (err?: ApiError, stat?: Stats) => {
        this._mu.unlock();
        cb(err, stat);
      });
    });
  }

  public statSync(p: string, isLstat: boolean, cred: Cred): Stats {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.statSync(p, isLstat, cred);
  }

  public access(p: string, mode: number, cred: Cred, cb: BFSOneArgCallback): void {
    this._mu.lock(() => {
      this._fs.access(p, mode, cred, (err?: ApiError) => {
        this._mu.unlock();
        cb(err);
      });
    });
  }

  public accessSync(p: string, mode: number, cred: Cred): void {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.accessSync(p, mode, cred);
  }

  public open(p: string, flag: FileFlag, mode: number, cred: Cred, cb: BFSCallback<File>): void {
    this._mu.lock(() => {
      this._fs.open(p, flag, mode, cred, (err?: ApiError, fd?: File) => {
        this._mu.unlock();
        cb(err, fd);
      });
    });
  }

  public openSync(p: string, flag: FileFlag, mode: number, cred: Cred): File {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.openSync(p, flag, mode, cred);
  }

  public unlink(p: string, cred: Cred, cb: BFSOneArgCallback): void {
    this._mu.lock(() => {
      this._fs.unlink(p, cred, (err?: ApiError) => {
        this._mu.unlock();
        cb(err);
      });
    });
  }

  public unlinkSync(p: string, cred: Cred): void {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.unlinkSync(p, cred);
  }

  public rmdir(p: string, cred: Cred, cb: BFSOneArgCallback): void {
    this._mu.lock(() => {
      this._fs.rmdir(p, cred, (err?: ApiError) => {
        this._mu.unlock();
        cb(err);
      });
    });
  }

  public rmdirSync(p: string, cred: Cred): void {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.rmdirSync(p, cred);
  }

  public mkdir(p: string, mode: number, cred: Cred, cb: BFSOneArgCallback): void {
    this._mu.lock(() => {
      this._fs.mkdir(p, mode, cred, (err?: ApiError) => {
        this._mu.unlock();
        cb(err);
      });
    });
  }

  public mkdirSync(p: string, mode: number, cred: Cred): void {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.mkdirSync(p, mode, cred);
  }

  public readdir(p: string, cred: Cred, cb: BFSCallback<string[]>): void {
    this._mu.lock(() => {
      this._fs.readdir(p, cred, (err?: ApiError, files?: string[]) => {
        this._mu.unlock();
        cb(err, files);
      });
    });
  }

  public readdirSync(p: string, cred: Cred): string[] {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.readdirSync(p, cred);
  }

  public exists(p: string, cred: Cred, cb: (exists: boolean) => void): void {
    this._mu.lock(() => {
      this._fs.exists(p, cred, (exists: boolean) => {
        this._mu.unlock();
        cb(exists);
      });
    });
  }

  public existsSync(p: string, cred: Cred): boolean {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.existsSync(p, cred);
  }

  public realpath(p: string, cache: {[path: string]: string}, cred: Cred, cb: BFSCallback<string>): void {
    this._mu.lock(() => {
      this._fs.realpath(p, cache, cred, (err?: ApiError, resolvedPath?: string) => {
        this._mu.unlock();
        cb(err, resolvedPath);
      });
    });
  }

  public realpathSync(p: string, cache: {[path: string]: string}, cred: Cred): string {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.realpathSync(p, cache, cred);
  }

  public truncate(p: string, len: number, cred: Cred, cb: BFSOneArgCallback): void {
    this._mu.lock(() => {
      this._fs.truncate(p, len, cred, (err?: ApiError) => {
        this._mu.unlock();
        cb(err);
      });
    });
  }

  public truncateSync(p: string, len: number, cred: Cred): void {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.truncateSync(p, len, cred);
  }

  public readFile(fname: string, encoding: string, flag: FileFlag, cred: Cred, cb: BFSCallback<string | Buffer>): void {
    this._mu.lock(() => {
      this._fs.readFile(fname, encoding, flag, cred, (err?: ApiError, data?: any) => {
        this._mu.unlock();
        cb(err, data);
      });
    });
  }

  public readFileSync(fname: string, encoding: string, flag: FileFlag, cred: Cred): any {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.readFileSync(fname, encoding, flag, cred);
  }

  public writeFile(fname: string, data: any, encoding: string, flag: FileFlag, mode: number, cred: Cred, cb: BFSOneArgCallback): void {
    this._mu.lock(() => {
      this._fs.writeFile(fname, data, encoding, flag, mode, cred, (err?: ApiError) => {
        this._mu.unlock();
        cb(err);
      });
    });
  }

  public writeFileSync(fname: string, data: any, encoding: string, flag: FileFlag, mode: number, cred: Cred): void {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.writeFileSync(fname, data, encoding, flag, mode, cred);
  }

  public appendFile(fname: string, data: any, encoding: string, flag: FileFlag, mode: number, cred: Cred, cb: BFSOneArgCallback): void {
    this._mu.lock(() => {
      this._fs.appendFile(fname, data, encoding, flag, mode, cred, (err?: ApiError) => {
        this._mu.unlock();
        cb(err);
      });
    });
  }

  public appendFileSync(fname: string, data: any, encoding: string, flag: FileFlag, mode: number, cred: Cred): void {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.appendFileSync(fname, data, encoding, flag, mode, cred);
  }

  public chmod(p: string, isLchmod: boolean, mode: number, cred: Cred, cb: BFSOneArgCallback): void {
    this._mu.lock(() => {
      this._fs.chmod(p, isLchmod, mode, cred, (err?: ApiError) => {
        this._mu.unlock();
        cb(err);
      });
    });
  }

  public chmodSync(p: string, isLchmod: boolean, mode: number, cred: Cred): void {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.chmodSync(p, isLchmod, mode, cred);
  }

  public chown(p: string, isLchown: boolean, new_uid: number, new_gid: number, cred: Cred, cb: BFSOneArgCallback): void {
    this._mu.lock(() => {
      this._fs.chown(p, isLchown, new_uid, new_gid, cred, (err?: ApiError) => {
        this._mu.unlock();
        cb(err);
      });
    });
  }

  public chownSync(p: string, isLchown: boolean, new_uid: number, new_gid: number, cred: Cred): void {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.chownSync(p, isLchown, new_uid, new_gid, cred);
  }

  public utimes(p: string, atime: Date, mtime: Date, cred: Cred, cb: BFSOneArgCallback): void {
    this._mu.lock(() => {
      this._fs.utimes(p, atime, mtime, cred, (err?: ApiError) => {
        this._mu.unlock();
        cb(err);
      });
    });
  }

  public utimesSync(p: string, atime: Date, mtime: Date, cred: Cred): void {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.utimesSync(p, atime, mtime, cred);
  }

  public link(srcpath: string, dstpath: string, cred: Cred, cb: BFSOneArgCallback): void {
    this._mu.lock(() => {
      this._fs.link(srcpath, dstpath, cred, (err?: ApiError) => {
        this._mu.unlock();
        cb(err);
      });
    });
  }

  public linkSync(srcpath: string, dstpath: string, cred: Cred): void {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.linkSync(srcpath, dstpath, cred);
  }

  public symlink(srcpath: string, dstpath: string, type: string, cred: Cred, cb: BFSOneArgCallback): void {
    this._mu.lock(() => {
      this._fs.symlink(srcpath, dstpath, type, cred, (err?: ApiError) => {
        this._mu.unlock();
        cb(err);
      });
    });
  }

  public symlinkSync(srcpath: string, dstpath: string, type: string, cred: Cred): void {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.symlinkSync(srcpath, dstpath, type, cred);
  }

  public readlink(p: string, cred: Cred, cb: BFSCallback<string>): void {
    this._mu.lock(() => {
      this._fs.readlink(p, cred, (err?: ApiError, linkString?: string) => {
        this._mu.unlock();
        cb(err, linkString);
      });
    });
  }

  public readlinkSync(p: string, cred: Cred): string {
    if (this._mu.isLocked()) {
      throw new Error('invalid sync call');
    }
    return this._fs.readlinkSync(p, cred);
  }
}
