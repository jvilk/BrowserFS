import Stats from '../core/node_fs_stats';
import {File} from '../core/file';
import {FileFlag} from '../core/file_flag';
import {FileSystem, BFSCallback, BFSOneArgCallback, FileSystemOptions} from '../core/file_system';
// import * as path from 'path';
// import {ApiError} from '../core/api_error';

/**
 * Configuration options for a Middleware file system.
 */
export interface MiddlewareOptions {
  // The file system to wrap.
  wrapped: FileSystem;
  beforeRead?: Function;
  afterRead?: Function;
  beforeWrite?: Function;
  afterWrite?: Function;
  readTransformer?: Function; // (this, fname, enc, etc) => you implement
  writeTransformer?: Function; // (this, fname, enc, etc) => you implement
}

function noop(args: any, cb?: BFSOneArgCallback): void {
  if (cb) {
    cb(null);
  }
}

/**
 * The Middleware file system wraps a file system, and intercepts all reads and writes
 * so you can modify their behavior.
 *
 * Example: Given a file system `foo`...
 *
 * ```javascript
 * const BrowserFS = require('.')
 * BrowserFS.configure({
 *   fs: "Middleware",
 *   options: {
 *     wrapped: {
 *       fs: "InMemory",
 *       options: {}
 *     },
 *     beforeWrite: ({data}) => console.log('about to write ' + data),
 *     afterWrite: ({fname}) => console.log('just wrote ' + fname),
 *     beforeRead: ({fname}) => console.log('about to read ' + fname),
 *     afterRead: ({data}) => console.log('just read ' + data),
 *   }
 * }, (err) => {
 *   if (err) throw err;
 *   const fs = BrowserFS.BFSRequire('fs')
 *   fs.writeFileSync('hello', 'hello world', 'utf8');
 *   fs.readFileSync('hello', 'utf8');
 * })
 *
 * //// Should print to console the following:
 * // about to write hello world
 * // just wrote /hello
 * // about to read /hello
 * // just read hello world
 * ```
 *
 */
export default class Middleware implements FileSystem {
  public static readonly Name = "Middleware";

  public static readonly Options: FileSystemOptions = {
    wrapped: {
      type: "object",
      description: "The file system to wrap",
      optional: false
    },
    beforeRead: {
      type: "function",
      description: "Called before a file is read.",
      optional: true
    },
    afterRead: {
      type: "function",
      description: "Called after a file is read.",
      optional: true
    },
    beforeWrite: {
      type: "function",
      description: "Called before a file is written.",
      optional: true
    },
    afterWrite: {
      type: "function",
      description: "Called after a file is written.",
      optional: true
    },
    readTransformer: {
      type: "function",
      description: "Intercept and handle all reads manually.",
      optional: true
    },
    writeTransformer: {
      type: "function",
      description: "Intercept and handle all write manually.",
      optional: true
    },
  };

  /**
   * Creates a Middleware instance with the given options.
   */
  public static Create(opts: MiddlewareOptions, cb: BFSCallback<Middleware>): void {
    try {
      const fs = new Middleware(
        opts.wrapped,
        opts.beforeRead || noop,
        opts.afterRead || noop,
        opts.beforeWrite || noop,
        opts.afterWrite || noop,
        opts.readTransformer || noop,
        opts.writeTransformer || noop
      );
      cb(undefined, fs);
    } catch (e) {
      cb(e);
    }
  }
  public static isAvailable(): boolean {
    return true;
  }

  public _wrapped: FileSystem;
  private _beforeRead: Function;
  private _afterRead: Function;
  private _beforeWrite: Function;
  private _afterWrite: Function;
  private _readTransformer: Function;
  private _writeTransformer: Function;
  // private _create: Function;
  // private _delete: Function;
  // private _mkdir: Function;
  // private _rmdir: Function;

  private constructor(
    wrapped: FileSystem,
    beforeRead: Function,
    afterRead: Function,
    beforeWrite: Function,
    afterWrite: Function,
    readTransformer: Function,
    writeTransformer: Function
  ) {
    this._wrapped = wrapped;
    this._beforeRead = beforeRead;
    this._afterRead = afterRead;
    this._beforeWrite = beforeWrite;
    this._afterWrite = afterWrite;
    this._readTransformer = readTransformer;
    this._writeTransformer = writeTransformer;
  }

  public getName(): string { return this._wrapped.getName(); }
  public diskSpace(p: string, cb: (total: number, free: number) => any): void {
    return this._wrapped.diskSpace(p, cb);
  }
  public isReadOnly(): boolean { return this._wrapped.isReadOnly(); }
  public supportsLinks(): boolean { return this._wrapped.supportsProps(); }
  public supportsProps(): boolean { return this._wrapped.supportsProps(); }
  public supportsSynch(): boolean { return this._wrapped.supportsSynch(); }
  public rename(oldPath: string, newPath: string, cb: BFSOneArgCallback): void {
    return this._wrapped.rename(oldPath, newPath, cb);
  }
  public renameSync(oldPath: string, newPath: string): void {
    return this._wrapped.renameSync(oldPath, newPath);
  }
  public stat(p: string, isLstat: boolean | null, cb: BFSCallback<Stats>): void {
    return this._wrapped.stat(p, isLstat, cb);
  }
  public statSync(p: string, isLstat: boolean | null): Stats {
    return this._wrapped.statSync(p, isLstat);
  }
  public open(p: string, flag: FileFlag, mode: number, cb: BFSCallback<File>): void {
    return this._wrapped.open(p, flag, mode, cb);
  }
  public openSync(p: string, flag: FileFlag, mode: number): File {
    return this._wrapped.openSync(p, flag, mode);
  }
  public unlink(p: string, cb: BFSOneArgCallback): void {
    return this._wrapped.unlink(p, cb);
  }
  public unlinkSync(p: string): void {
    return this._wrapped.unlinkSync(p);
  }
  public rmdir(p: string, cb: BFSOneArgCallback): void {
    return this._wrapped.rmdir(p, cb);
  }
  public rmdirSync(p: string): void {
    return this._wrapped.rmdirSync(p);
  }
  public mkdir(p: string, mode: number, cb: BFSOneArgCallback): void {
    return this._wrapped.mkdir(p, mode, cb);
  }
  public mkdirSync(p: string, mode: number): void {
    return this._wrapped.mkdirSync(p, mode);
  }
  public readdir(p: string, cb: BFSCallback<string[]>): void {
    return this._wrapped.readdir(p, cb);
  }
  public readdirSync(p: string): string[] {
    return this._wrapped.readdirSync(p);
  }
  public exists(p: string, cb: (exists: boolean) => void): void {
    return this._wrapped.exists(p, cb);
  }
  public existsSync(p: string): boolean {
    return this._wrapped.existsSync(p);
  }
  public realpath(p: string, cache: {[path: string]: string}, cb: BFSCallback<string>): void {
    return this._wrapped.realpath(p, cache, cb);
  }
  public realpathSync(p: string, cache: {[path: string]: string}): string {
    return this._wrapped.realpathSync(p, cache);
  }
  public truncate(p: string, len: number, cb: BFSOneArgCallback): void {
    return this._wrapped.truncate(p, len, cb);
  }
  public truncateSync(p: string, len: number): void {
    return this._wrapped.truncateSync(p, len);
  }
  public readFile(fname: string, encoding: string | null, flag: FileFlag, cb: BFSCallback<string | Buffer>): void {
    return this._wrapped.readFile(fname, encoding, flag, cb);
  }
  public readFileSync(fname: string, encoding: string | null, flag: FileFlag): any {
    this._beforeRead({fname, encoding, flag});
    const data = this._wrapped.readFileSync(fname, encoding, flag);
    this._afterRead({fname, encoding, flag, data});
    return data;
  }
  public writeFile(fname: string, data: any, encoding: string | null, flag: FileFlag, mode: number, cb: BFSOneArgCallback): void {
    return this._wrapped.writeFile(fname, data, encoding, flag, mode, cb);
  }
  public writeFileSync(fname: string, data: string | Buffer, encoding: string | null, flag: FileFlag, mode: number): void {
    this._beforeWrite({fname, data, encoding, flag, mode});
    this._wrapped.writeFileSync(fname, data, encoding, flag, mode);
    this._afterWrite({fname, data, encoding, flag, mode});
    return;
  }
  public appendFile(fname: string, data: string | Buffer, encoding: string | null, flag: FileFlag, mode: number, cb: BFSOneArgCallback): void {
    return this._wrapped.appendFile(fname, data, encoding, flag, mode, cb);
  }
  public appendFileSync(fname: string, data: string | Buffer, encoding: string | null, flag: FileFlag, mode: number): void {
    return this._wrapped.appendFileSync(fname, data, encoding, flag, mode);
  }
  public chmod(p: string, isLchmod: boolean, mode: number, cb: BFSOneArgCallback): void {
    return this._wrapped.chmod(p, isLchmod, mode, cb);
  }
  public chmodSync(p: string, isLchmod: boolean, mode: number): void {
    return this._wrapped.chmodSync(p, isLchmod, mode);
  }
  public chown(p: string, isLchown: boolean, uid: number, gid: number, cb: BFSOneArgCallback): void {
    return this._wrapped.chown(p, isLchown, uid, gid, cb);
  }
  public chownSync(p: string, isLchown: boolean, uid: number, gid: number): void {
    return this._wrapped.chownSync(p, isLchown, uid, gid);
  }
  public utimes(p: string, atime: Date, mtime: Date, cb: BFSOneArgCallback): void {
    return this._wrapped.utimes(p, atime, mtime, cb);
  }
  public utimesSync(p: string, atime: Date, mtime: Date): void {
    return this._wrapped.utimesSync(p, atime, mtime);
  }
  public link(srcpath: string, dstpath: string, cb: BFSOneArgCallback): void {
    return this._wrapped.link(srcpath, dstpath, cb);
  }
  public linkSync(srcpath: string, dstpath: string): void {
    return this._wrapped.linkSync(srcpath, dstpath);
  }
  public symlink(srcpath: string, dstpath: string, type: string, cb: BFSOneArgCallback): void {
    return this._wrapped.symlink(srcpath, dstpath, type, cb);
  }
  public symlinkSync(srcpath: string, dstpath: string, type: string): void {
    return this._wrapped.symlinkSync(srcpath, dstpath, type);
  }
  public readlink(p: string, cb: BFSCallback<string>): void {
    return this._wrapped.readlink(p, cb);
  }
  public readlinkSync(p: string): string {
    return this._wrapped.readlinkSync(p);
  }
}
