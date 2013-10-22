import file_system = require('../core/file_system');
import in_memory = require('in_memory');
import api_error = require('../core/api_error');
import node_fs = require('../core/node_fs');

var ApiError = api_error.ApiError;
var ErrorType = api_error.ErrorType;
var fs = node_fs.fs;
export class MountableFileSystem extends file_system.FileSystem {
  private mntMap: {[path: string]: file_system.FileSystem};
  private rootFs: file_system.FileSystem;
  constructor() {
    super();
    this.mntMap = {};
    this.rootFs = new in_memory.InMemory();
  }

  public mount(mnt_pt: string, fs: file_system.FileSystem): void {
    if (this.mntMap[mnt_pt]) {
      throw new ApiError(ErrorType.INVALID_PARAM, "Mount point " + mnt_pt + " is already taken.");
    }
    this.rootFs.mkdirSync(mnt_pt, 0x1ff);
    this.mntMap[mnt_pt] = fs;
  }

  public umount(mnt_pt: string): void {
    if (!this.mntMap[mnt_pt]) {
      throw new ApiError(ErrorType.INVALID_PARAM, "Mount point " + mnt_pt + " is already unmounted.");
    }
    delete this.mntMap[mnt_pt];
    this.rootFs.rmdirSync(mnt_pt);
  }

  public _get_fs(path: string): {fs: file_system.FileSystem; path: string} {
    for (var mnt_pt in this.mntMap) {
      var fs = this.mntMap[mnt_pt];
      if (path.indexOf(mnt_pt) === 0) {
        path = path.substr(mnt_pt.length > 1 ? mnt_pt.length : 0);
        if (path === '') {
          path = '/';
        }
        return {fs: fs, path: path};
      }
    }
    return {fs: this.rootFs, path: path};
  }

  public getName(): string {
    return 'MountableFileSystem';
  }

  public static isAvailable(): boolean {
    return true;
  }

  public diskSpace(path: string, cb: (total: number, free: number) => void): void {
    cb(0, 0);
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
    return true;
  }

  public rename(oldPath: string, newPath: string, cb: (e?: api_error.ApiError) => void): void {
    var fs1_rv = this._get_fs(oldPath);
    var fs2_rv = this._get_fs(newPath);
    if (fs1_rv.fs === fs2_rv.fs) {
      return fs1_rv.fs.rename(fs1_rv.path, fs2_rv.path, cb);
    }
    return fs.readFile(oldPath, function(err, data) {
      if (err) {
        return cb(err);
      }
      fs.writeFile(newPath, data, function(err) {
        if (err) {
          return cb(err);
        }
        fs.unlink(oldPath, cb);
      });
    });
  }

  public renameSync(oldPath: string, newPath: string): void {
    var fs1_rv = this._get_fs(oldPath);
    var fs2_rv = this._get_fs(newPath);
    if (fs1_rv.fs === fs2_rv.fs) {
      return fs1_rv.fs.renameSync(fs1_rv.path, fs2_rv.path);
    }
    var data = fs.readFileSync(oldPath);
    fs.writeFileSync(newPath, data);
    return fs.unlinkSync(oldPath);
  }
}

function defineFcn(name: string, isSync: boolean, numArgs: number): (...args: any[]) => any {
  return function(...args: any[]) {
    var rv = this._get_fs(args[0]);
    args[0] = rv.path;
    return rv.fs[name].apply(rv.fs, args);
  };
}

var fsCmdMap = [['readdir', 'exists', 'unlink', 'rmdir', 'readlink'], ['stat', 'mkdir', 'realpath', 'truncate'], ['open', 'readFile', 'chmod', 'utimes'], ['chown'], ['writeFile', 'appendFile']];

for (var i = 0; i < fsCmdMap.length; i++) {
  var cmds = fsCmdMap[i];
  for (var j = 0; j < cmds.length; j++) {
    var fnName = cmds[j];
    MountableFileSystem.prototype[fnName] = defineFcn(fnName, false, i + 1);
    MountableFileSystem.prototype[fnName + 'Sync'] = defineFcn(fnName + 'Sync', true, i + 1);
  }
}
