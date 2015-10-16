var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var file_system = require('../core/file_system');
var in_memory = require('./in_memory');
var api_error = require('../core/api_error');
var fs = require('../core/node_fs');
var browserfs = require('../core/browserfs');
var ApiError = api_error.ApiError;
var ErrorCode = api_error.ErrorCode;
var MountableFileSystem = (function (_super) {
    __extends(MountableFileSystem, _super);
    function MountableFileSystem() {
        _super.call(this);
        this.mntMap = {};
        this.rootFs = new in_memory.InMemoryFileSystem();
    }
    MountableFileSystem.prototype.mount = function (mnt_pt, fs) {
        if (this.mntMap[mnt_pt]) {
            throw new ApiError(ErrorCode.EINVAL, "Mount point " + mnt_pt + " is already taken.");
        }
        this.rootFs.mkdirSync(mnt_pt, 0x1ff);
        this.mntMap[mnt_pt] = fs;
    };
    MountableFileSystem.prototype.umount = function (mnt_pt) {
        if (!this.mntMap[mnt_pt]) {
            throw new ApiError(ErrorCode.EINVAL, "Mount point " + mnt_pt + " is already unmounted.");
        }
        delete this.mntMap[mnt_pt];
        this.rootFs.rmdirSync(mnt_pt);
    };
    MountableFileSystem.prototype._get_fs = function (path) {
        for (var mnt_pt in this.mntMap) {
            var fs = this.mntMap[mnt_pt];
            if (path.indexOf(mnt_pt) === 0) {
                path = path.substr(mnt_pt.length > 1 ? mnt_pt.length : 0);
                if (path === '') {
                    path = '/';
                }
                return { fs: fs, path: path };
            }
        }
        return { fs: this.rootFs, path: path };
    };
    MountableFileSystem.prototype.getName = function () {
        return 'MountableFileSystem';
    };
    MountableFileSystem.isAvailable = function () {
        return true;
    };
    MountableFileSystem.prototype.diskSpace = function (path, cb) {
        cb(0, 0);
    };
    MountableFileSystem.prototype.isReadOnly = function () {
        return false;
    };
    MountableFileSystem.prototype.supportsLinks = function () {
        return false;
    };
    MountableFileSystem.prototype.supportsProps = function () {
        return false;
    };
    MountableFileSystem.prototype.supportsSynch = function () {
        return true;
    };
    MountableFileSystem.prototype.standardizeError = function (err, path, realPath) {
        var index;
        if (-1 !== (index = err.message.indexOf(path))) {
            err.message = err.message.substr(0, index) + realPath + err.message.substr(index + path.length);
        }
        return err;
    };
    MountableFileSystem.prototype.rename = function (oldPath, newPath, cb) {
        var fs1_rv = this._get_fs(oldPath);
        var fs2_rv = this._get_fs(newPath);
        if (fs1_rv.fs === fs2_rv.fs) {
            var _this = this;
            return fs1_rv.fs.rename(fs1_rv.path, fs2_rv.path, function (e) {
                if (e)
                    _this.standardizeError(_this.standardizeError(e, fs1_rv.path, oldPath), fs2_rv.path, newPath);
                cb(e);
            });
        }
        return fs.readFile(oldPath, function (err, data) {
            if (err) {
                return cb(err);
            }
            fs.writeFile(newPath, data, function (err) {
                if (err) {
                    return cb(err);
                }
                fs.unlink(oldPath, cb);
            });
        });
    };
    MountableFileSystem.prototype.renameSync = function (oldPath, newPath) {
        var fs1_rv = this._get_fs(oldPath);
        var fs2_rv = this._get_fs(newPath);
        if (fs1_rv.fs === fs2_rv.fs) {
            try {
                return fs1_rv.fs.renameSync(fs1_rv.path, fs2_rv.path);
            }
            catch (e) {
                this.standardizeError(this.standardizeError(e, fs1_rv.path, oldPath), fs2_rv.path, newPath);
                throw e;
            }
        }
        var data = fs.readFileSync(oldPath);
        fs.writeFileSync(newPath, data);
        return fs.unlinkSync(oldPath);
    };
    return MountableFileSystem;
})(file_system.BaseFileSystem);
exports.MountableFileSystem = MountableFileSystem;
function defineFcn(name, isSync, numArgs) {
    if (isSync) {
        return function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i - 0] = arguments[_i];
            }
            var path = args[0];
            var rv = this._get_fs(path);
            args[0] = rv.path;
            try {
                return rv.fs[name].apply(rv.fs, args);
            }
            catch (e) {
                this.standardizeError(e, rv.path, path);
                throw e;
            }
        };
    }
    else {
        return function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i - 0] = arguments[_i];
            }
            var path = args[0];
            var rv = this._get_fs(path);
            args[0] = rv.path;
            if (typeof args[args.length - 1] === 'function') {
                var cb = args[args.length - 1];
                var _this = this;
                args[args.length - 1] = function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i - 0] = arguments[_i];
                    }
                    if (args.length > 0 && args[0] instanceof api_error.ApiError) {
                        _this.standardizeError(args[0], rv.path, path);
                    }
                    cb.apply(null, args);
                };
            }
            return rv.fs[name].apply(rv.fs, args);
        };
    }
}
var fsCmdMap = [
    ['readdir', 'exists', 'unlink', 'rmdir', 'readlink'],
    ['stat', 'mkdir', 'realpath', 'truncate'],
    ['open', 'readFile', 'chmod', 'utimes'],
    ['chown'],
    ['writeFile', 'appendFile']];
for (var i = 0; i < fsCmdMap.length; i++) {
    var cmds = fsCmdMap[i];
    for (var j = 0; j < cmds.length; j++) {
        var fnName = cmds[j];
        MountableFileSystem.prototype[fnName] = defineFcn(fnName, false, i + 1);
        MountableFileSystem.prototype[fnName + 'Sync'] = defineFcn(fnName + 'Sync', true, i + 1);
    }
}
browserfs.registerFileSystem('MountableFileSystem', MountableFileSystem);
//# sourceMappingURL=mountable_file_system.js.map