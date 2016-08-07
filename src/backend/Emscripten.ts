import file_system = require('../core/file_system');
import {default as Stats, FileType} from '../core/node_fs_stats';
import {FileFlag} from '../core/file_flag';
import {PreloadFile} from '../generic/preload_file';

export class EmscriptenFile extends PreloadFile<EmscriptenFileSystem> {
  constructor(_fs: EmscriptenFileSystem, _path: string, _flag: FileFlag, _stat: Stats, contents?: NodeBuffer) {
    super(_fs, _path, _flag, _stat, contents);
  }

  public syncSync(): void {
    if (this.isDirty()) {
      this._fs._syncSync(this.getPath(), this.getBuffer(), this.getStats());
      this.resetDirty();
    }
  }

  public closeSync(): void {
    this.syncSync();
  }
}

/**
 * A simple in-memory file system backed by an InMemoryStore.
 */
export default class EmscriptenFileSystem extends file_system.SynchronousFileSystem {
  private _FS: any;

  constructor(_FS: any) {
    super();
    this._FS = _FS;
  }

  public static isAvailable(): boolean { return true; }
  public getName(): string { return this._FS.DB_NAME(); }
  public isReadOnly(): boolean { return false; }
  public supportsSymlinks(): boolean { return true; }
  public supportsProps(): boolean { return true; }
  public supportsSynch(): boolean { return true; }

  public renameSync(oldPath: string, newPath: string): void {
    this._FS.rename(oldPath, newPath);
  }

  public statSync(p: string, isLstat: boolean): Stats {
    const stats = isLstat ? this._FS.lstat(p) : this._FS.stat(p);
    const item_type = this.modeToFileType(stats.mode);
    return new Stats(
      item_type,
      stats.size,
      stats.mode,
      stats.atime,
      stats.mtime,
      stats.ctime
    );
  }

  private modeToFileType(mode: number): FileType {
    if (this._FS.isDir(mode)) {
      return FileType.DIRECTORY;
    } else if (this._FS.isFile(mode)) {
      return FileType.FILE;
    } else if (this._FS.isLink(mode)) {
      return FileType.SYMLINK;
    }
  }

  /**
   * Opens the file at path p with the given flag. The file must exist.
   * @param p The path to open.
   * @param flag The flag to use when opening the file.
   * @return A File object corresponding to the opened file.
   */
  public openFileSync(p: string, flag: FileFlag): EmscriptenFile {
    const data = this._FS.readFile(p).buffer;
    const file = new EmscriptenFile(this, p, flag, this.statSync(p, false), data);
    return file;
  }

  /**
   * Create the file at path p with the given mode. Then, open it with the given
   * flag.
   */
  public createFileSync(p: string, flag: FileFlag, mode: number): EmscriptenFile {
    const data = new Uint8Array(0);
    const fsStream = this._FS.open(p, flag.getFlagString(), mode);
    this._FS.write(fsStream, data, 0, data.length, 0);
    this._FS.close(fsStream);
    const file = new EmscriptenFile(this, p, flag, this.statSync(p, false), new Buffer(0));
    return file;
  }

  public unlinkSync(p: string): void {
    this._FS.unlink(p);
  }

  public rmdirSync(p: string): void {
    this._FS.rmdir(p);
  }

  public mkdirSync(p: string, mode: number): void {
    this._FS.mkdir(p, mode);
  }

  public readdirSync(p: string): string[] {
    return this._FS.readdir(p);
  }

  public chmodSync(p: string, isLchmod: boolean, mode: number) {
    isLchmod ? this._FS.lchmod(p, mode) : this._FS.chmod(p, mode);
  }

  public chownSync(p: string, isLchown: boolean, uid: number, gid: number): void {
    isLchown ? this._FS.lchown(p, uid, gid) : this._FS.chown(p, uid, gid);
  }

  public symlinkSync(srcpath: string, dstpath: string, type: string): void {
    this._FS.symlink(srcpath, dstpath);
  }

  public readlinkSync(p: string): string {
    return this._FS.readlink(p);
  }

  public _syncSync(p: string, data: NodeBuffer, stats: Stats): void {
		const abuffer = new ArrayBuffer(data.length);
		const view = new Uint8Array(abuffer);
		let i = 0;
		while(i < data.length) {
			view[i] = data.readUInt8(i);
			i++;
    }
    this._FS.writeFile(p, view, {encoding: 'binary'});
    this.chmodSync(p, false, stats.mode);
    this.chownSync(p, false, stats.uid, stats.gid);
    this._FS.utime(p, stats.atime, stats.mtime);
  }
}
