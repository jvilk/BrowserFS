var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var api_error_1 = require('./api_error');
var file_flag_1 = require('./file_flag');
var path = require('path');
var BaseFileSystem = (function () {
    function BaseFileSystem() {
    }
    BaseFileSystem.prototype.supportsLinks = function () {
        return false;
    };
    BaseFileSystem.prototype.diskSpace = function (p, cb) {
        cb(0, 0);
    };
    BaseFileSystem.prototype.openFile = function (p, flag, cb) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.createFile = function (p, flag, mode, cb) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.open = function (p, flag, mode, cb) {
        var _this = this;
        var must_be_file = function (e, stats) {
            if (e) {
                switch (flag.pathNotExistsAction()) {
                    case file_flag_1.ActionType.CREATE_FILE:
                        return _this.stat(path.dirname(p), false, function (e, parentStats) {
                            if (e) {
                                cb(e);
                            }
                            else if (!parentStats.isDirectory()) {
                                cb(api_error_1.ApiError.ENOTDIR(path.dirname(p)));
                            }
                            else {
                                _this.createFile(p, flag, mode, cb);
                            }
                        });
                    case file_flag_1.ActionType.THROW_EXCEPTION:
                        return cb(api_error_1.ApiError.ENOENT(p));
                    default:
                        return cb(new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Invalid FileFlag object.'));
                }
            }
            else {
                if (stats.isDirectory()) {
                    return cb(api_error_1.ApiError.EISDIR(p));
                }
                switch (flag.pathExistsAction()) {
                    case file_flag_1.ActionType.THROW_EXCEPTION:
                        return cb(api_error_1.ApiError.EEXIST(p));
                    case file_flag_1.ActionType.TRUNCATE_FILE:
                        return _this.openFile(p, flag, function (e, fd) {
                            if (e) {
                                cb(e);
                            }
                            else {
                                fd.truncate(0, function () {
                                    fd.sync(function () {
                                        cb(null, fd);
                                    });
                                });
                            }
                        });
                    case file_flag_1.ActionType.NOP:
                        return _this.openFile(p, flag, cb);
                    default:
                        return cb(new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Invalid FileFlag object.'));
                }
            }
        };
        this.stat(p, false, must_be_file);
    };
    BaseFileSystem.prototype.rename = function (oldPath, newPath, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.renameSync = function (oldPath, newPath) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.stat = function (p, isLstat, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.statSync = function (p, isLstat) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.openFileSync = function (p, flag) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.createFileSync = function (p, flag, mode) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.openSync = function (p, flag, mode) {
        var stats;
        try {
            stats = this.statSync(p, false);
        }
        catch (e) {
            switch (flag.pathNotExistsAction()) {
                case file_flag_1.ActionType.CREATE_FILE:
                    var parentStats = this.statSync(path.dirname(p), false);
                    if (!parentStats.isDirectory()) {
                        throw api_error_1.ApiError.ENOTDIR(path.dirname(p));
                    }
                    return this.createFileSync(p, flag, mode);
                case file_flag_1.ActionType.THROW_EXCEPTION:
                    throw api_error_1.ApiError.ENOENT(p);
                default:
                    throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Invalid FileFlag object.');
            }
        }
        if (stats.isDirectory()) {
            throw api_error_1.ApiError.EISDIR(p);
        }
        switch (flag.pathExistsAction()) {
            case file_flag_1.ActionType.THROW_EXCEPTION:
                throw api_error_1.ApiError.EEXIST(p);
            case file_flag_1.ActionType.TRUNCATE_FILE:
                this.unlinkSync(p);
                return this.createFileSync(p, flag, stats.mode);
            case file_flag_1.ActionType.NOP:
                return this.openFileSync(p, flag);
            default:
                throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Invalid FileFlag object.');
        }
    };
    BaseFileSystem.prototype.unlink = function (p, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.unlinkSync = function (p) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.rmdir = function (p, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.rmdirSync = function (p) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.mkdir = function (p, mode, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.mkdirSync = function (p, mode) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.readdir = function (p, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.readdirSync = function (p) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.exists = function (p, cb) {
        this.stat(p, null, function (err) {
            cb(err == null);
        });
    };
    BaseFileSystem.prototype.existsSync = function (p) {
        try {
            this.statSync(p, true);
            return true;
        }
        catch (e) {
            return false;
        }
    };
    BaseFileSystem.prototype.realpath = function (p, cache, cb) {
        if (this.supportsLinks()) {
            var splitPath = p.split(path.sep);
            for (var i = 0; i < splitPath.length; i++) {
                var addPaths = splitPath.slice(0, i + 1);
                splitPath[i] = path.join.apply(null, addPaths);
            }
        }
        else {
            this.exists(p, function (doesExist) {
                if (doesExist) {
                    cb(null, p);
                }
                else {
                    cb(api_error_1.ApiError.ENOENT(p));
                }
            });
        }
    };
    BaseFileSystem.prototype.realpathSync = function (p, cache) {
        if (this.supportsLinks()) {
            var splitPath = p.split(path.sep);
            for (var i = 0; i < splitPath.length; i++) {
                var addPaths = splitPath.slice(0, i + 1);
                splitPath[i] = path.join.apply(null, addPaths);
            }
        }
        else {
            if (this.existsSync(p)) {
                return p;
            }
            else {
                throw api_error_1.ApiError.ENOENT(p);
            }
        }
    };
    BaseFileSystem.prototype.truncate = function (p, len, cb) {
        this.open(p, file_flag_1.FileFlag.getFileFlag('r+'), 0x1a4, (function (er, fd) {
            if (er) {
                return cb(er);
            }
            fd.truncate(len, (function (er) {
                fd.close((function (er2) {
                    cb(er || er2);
                }));
            }));
        }));
    };
    BaseFileSystem.prototype.truncateSync = function (p, len) {
        var fd = this.openSync(p, file_flag_1.FileFlag.getFileFlag('r+'), 0x1a4);
        try {
            fd.truncateSync(len);
        }
        catch (e) {
            throw e;
        }
        finally {
            fd.closeSync();
        }
    };
    BaseFileSystem.prototype.readFile = function (fname, encoding, flag, cb) {
        var oldCb = cb;
        this.open(fname, flag, 0x1a4, function (err, fd) {
            if (err) {
                return cb(err);
            }
            cb = function (err, arg) {
                fd.close(function (err2) {
                    if (err == null) {
                        err = err2;
                    }
                    return oldCb(err, arg);
                });
            };
            fd.stat(function (err, stat) {
                if (err != null) {
                    return cb(err);
                }
                var buf = new Buffer(stat.size);
                fd.read(buf, 0, stat.size, 0, function (err) {
                    if (err != null) {
                        return cb(err);
                    }
                    else if (encoding === null) {
                        return cb(err, buf);
                    }
                    try {
                        cb(null, buf.toString(encoding));
                    }
                    catch (e) {
                        cb(e);
                    }
                });
            });
        });
    };
    BaseFileSystem.prototype.readFileSync = function (fname, encoding, flag) {
        var fd = this.openSync(fname, flag, 0x1a4);
        try {
            var stat = fd.statSync();
            var buf = new Buffer(stat.size);
            fd.readSync(buf, 0, stat.size, 0);
            fd.closeSync();
            if (encoding === null) {
                return buf;
            }
            return buf.toString(encoding);
        }
        finally {
            fd.closeSync();
        }
    };
    BaseFileSystem.prototype.writeFile = function (fname, data, encoding, flag, mode, cb) {
        var oldCb = cb;
        this.open(fname, flag, 0x1a4, function (err, fd) {
            if (err != null) {
                return cb(err);
            }
            cb = function (err) {
                fd.close(function (err2) {
                    oldCb(err != null ? err : err2);
                });
            };
            try {
                if (typeof data === 'string') {
                    data = new Buffer(data, encoding);
                }
            }
            catch (e) {
                return cb(e);
            }
            fd.write(data, 0, data.length, 0, cb);
        });
    };
    BaseFileSystem.prototype.writeFileSync = function (fname, data, encoding, flag, mode) {
        var fd = this.openSync(fname, flag, mode);
        try {
            if (typeof data === 'string') {
                data = new Buffer(data, encoding);
            }
            fd.writeSync(data, 0, data.length, 0);
        }
        finally {
            fd.closeSync();
        }
    };
    BaseFileSystem.prototype.appendFile = function (fname, data, encoding, flag, mode, cb) {
        var oldCb = cb;
        this.open(fname, flag, mode, function (err, fd) {
            if (err != null) {
                return cb(err);
            }
            cb = function (err) {
                fd.close(function (err2) {
                    oldCb(err != null ? err : err2);
                });
            };
            if (typeof data === 'string') {
                data = new Buffer(data, encoding);
            }
            fd.write(data, 0, data.length, null, cb);
        });
    };
    BaseFileSystem.prototype.appendFileSync = function (fname, data, encoding, flag, mode) {
        var fd = this.openSync(fname, flag, mode);
        try {
            if (typeof data === 'string') {
                data = new Buffer(data, encoding);
            }
            fd.writeSync(data, 0, data.length, null);
        }
        finally {
            fd.closeSync();
        }
    };
    BaseFileSystem.prototype.chmod = function (p, isLchmod, mode, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.chmodSync = function (p, isLchmod, mode) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.chown = function (p, isLchown, uid, gid, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.chownSync = function (p, isLchown, uid, gid) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.utimes = function (p, atime, mtime, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.utimesSync = function (p, atime, mtime) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.link = function (srcpath, dstpath, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.linkSync = function (srcpath, dstpath) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.symlink = function (srcpath, dstpath, type, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.symlinkSync = function (srcpath, dstpath, type) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    BaseFileSystem.prototype.readlink = function (p, cb) {
        cb(new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP));
    };
    BaseFileSystem.prototype.readlinkSync = function (p) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    return BaseFileSystem;
})();
exports.BaseFileSystem = BaseFileSystem;
var SynchronousFileSystem = (function (_super) {
    __extends(SynchronousFileSystem, _super);
    function SynchronousFileSystem() {
        _super.apply(this, arguments);
    }
    SynchronousFileSystem.prototype.supportsSynch = function () {
        return true;
    };
    SynchronousFileSystem.prototype.rename = function (oldPath, newPath, cb) {
        try {
            this.renameSync(oldPath, newPath);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.stat = function (p, isLstat, cb) {
        try {
            cb(null, this.statSync(p, isLstat));
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.open = function (p, flags, mode, cb) {
        try {
            cb(null, this.openSync(p, flags, mode));
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.unlink = function (p, cb) {
        try {
            this.unlinkSync(p);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.rmdir = function (p, cb) {
        try {
            this.rmdirSync(p);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.mkdir = function (p, mode, cb) {
        try {
            this.mkdirSync(p, mode);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.readdir = function (p, cb) {
        try {
            cb(null, this.readdirSync(p));
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.chmod = function (p, isLchmod, mode, cb) {
        try {
            this.chmodSync(p, isLchmod, mode);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.chown = function (p, isLchown, uid, gid, cb) {
        try {
            this.chownSync(p, isLchown, uid, gid);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.utimes = function (p, atime, mtime, cb) {
        try {
            this.utimesSync(p, atime, mtime);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.link = function (srcpath, dstpath, cb) {
        try {
            this.linkSync(srcpath, dstpath);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.symlink = function (srcpath, dstpath, type, cb) {
        try {
            this.symlinkSync(srcpath, dstpath, type);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    SynchronousFileSystem.prototype.readlink = function (p, cb) {
        try {
            cb(null, this.readlinkSync(p));
        }
        catch (e) {
            cb(e);
        }
    };
    return SynchronousFileSystem;
})(BaseFileSystem);
exports.SynchronousFileSystem = SynchronousFileSystem;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmlsZV9zeXN0ZW0uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29yZS9maWxlX3N5c3RlbS50cyJdLCJuYW1lcyI6WyJCYXNlRmlsZVN5c3RlbSIsIkJhc2VGaWxlU3lzdGVtLmNvbnN0cnVjdG9yIiwiQmFzZUZpbGVTeXN0ZW0uc3VwcG9ydHNMaW5rcyIsIkJhc2VGaWxlU3lzdGVtLmRpc2tTcGFjZSIsIkJhc2VGaWxlU3lzdGVtLm9wZW5GaWxlIiwiQmFzZUZpbGVTeXN0ZW0uY3JlYXRlRmlsZSIsIkJhc2VGaWxlU3lzdGVtLm9wZW4iLCJCYXNlRmlsZVN5c3RlbS5yZW5hbWUiLCJCYXNlRmlsZVN5c3RlbS5yZW5hbWVTeW5jIiwiQmFzZUZpbGVTeXN0ZW0uc3RhdCIsIkJhc2VGaWxlU3lzdGVtLnN0YXRTeW5jIiwiQmFzZUZpbGVTeXN0ZW0ub3BlbkZpbGVTeW5jIiwiQmFzZUZpbGVTeXN0ZW0uY3JlYXRlRmlsZVN5bmMiLCJCYXNlRmlsZVN5c3RlbS5vcGVuU3luYyIsIkJhc2VGaWxlU3lzdGVtLnVubGluayIsIkJhc2VGaWxlU3lzdGVtLnVubGlua1N5bmMiLCJCYXNlRmlsZVN5c3RlbS5ybWRpciIsIkJhc2VGaWxlU3lzdGVtLnJtZGlyU3luYyIsIkJhc2VGaWxlU3lzdGVtLm1rZGlyIiwiQmFzZUZpbGVTeXN0ZW0ubWtkaXJTeW5jIiwiQmFzZUZpbGVTeXN0ZW0ucmVhZGRpciIsIkJhc2VGaWxlU3lzdGVtLnJlYWRkaXJTeW5jIiwiQmFzZUZpbGVTeXN0ZW0uZXhpc3RzIiwiQmFzZUZpbGVTeXN0ZW0uZXhpc3RzU3luYyIsIkJhc2VGaWxlU3lzdGVtLnJlYWxwYXRoIiwiQmFzZUZpbGVTeXN0ZW0ucmVhbHBhdGhTeW5jIiwiQmFzZUZpbGVTeXN0ZW0udHJ1bmNhdGUiLCJCYXNlRmlsZVN5c3RlbS50cnVuY2F0ZVN5bmMiLCJCYXNlRmlsZVN5c3RlbS5yZWFkRmlsZSIsIkJhc2VGaWxlU3lzdGVtLnJlYWRGaWxlU3luYyIsIkJhc2VGaWxlU3lzdGVtLndyaXRlRmlsZSIsIkJhc2VGaWxlU3lzdGVtLndyaXRlRmlsZVN5bmMiLCJCYXNlRmlsZVN5c3RlbS5hcHBlbmRGaWxlIiwiQmFzZUZpbGVTeXN0ZW0uYXBwZW5kRmlsZVN5bmMiLCJCYXNlRmlsZVN5c3RlbS5jaG1vZCIsIkJhc2VGaWxlU3lzdGVtLmNobW9kU3luYyIsIkJhc2VGaWxlU3lzdGVtLmNob3duIiwiQmFzZUZpbGVTeXN0ZW0uY2hvd25TeW5jIiwiQmFzZUZpbGVTeXN0ZW0udXRpbWVzIiwiQmFzZUZpbGVTeXN0ZW0udXRpbWVzU3luYyIsIkJhc2VGaWxlU3lzdGVtLmxpbmsiLCJCYXNlRmlsZVN5c3RlbS5saW5rU3luYyIsIkJhc2VGaWxlU3lzdGVtLnN5bWxpbmsiLCJCYXNlRmlsZVN5c3RlbS5zeW1saW5rU3luYyIsIkJhc2VGaWxlU3lzdGVtLnJlYWRsaW5rIiwiQmFzZUZpbGVTeXN0ZW0ucmVhZGxpbmtTeW5jIiwiU3luY2hyb25vdXNGaWxlU3lzdGVtIiwiU3luY2hyb25vdXNGaWxlU3lzdGVtLmNvbnN0cnVjdG9yIiwiU3luY2hyb25vdXNGaWxlU3lzdGVtLnN1cHBvcnRzU3luY2giLCJTeW5jaHJvbm91c0ZpbGVTeXN0ZW0ucmVuYW1lIiwiU3luY2hyb25vdXNGaWxlU3lzdGVtLnN0YXQiLCJTeW5jaHJvbm91c0ZpbGVTeXN0ZW0ub3BlbiIsIlN5bmNocm9ub3VzRmlsZVN5c3RlbS51bmxpbmsiLCJTeW5jaHJvbm91c0ZpbGVTeXN0ZW0ucm1kaXIiLCJTeW5jaHJvbm91c0ZpbGVTeXN0ZW0ubWtkaXIiLCJTeW5jaHJvbm91c0ZpbGVTeXN0ZW0ucmVhZGRpciIsIlN5bmNocm9ub3VzRmlsZVN5c3RlbS5jaG1vZCIsIlN5bmNocm9ub3VzRmlsZVN5c3RlbS5jaG93biIsIlN5bmNocm9ub3VzRmlsZVN5c3RlbS51dGltZXMiLCJTeW5jaHJvbm91c0ZpbGVTeXN0ZW0ubGluayIsIlN5bmNocm9ub3VzRmlsZVN5c3RlbS5zeW1saW5rIiwiU3luY2hy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RUEsSUFBSUEsQ0FBQ0EsUUFBUUEsQ0FBQ0EsQ0FBQ0EsRUFBRUEsT0FBT0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDdENBLENBQUVBO1FBQUFBLEtBQUtBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1lBQ1hBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1FBQ1JBLENBQUNBO0lBQ0hBLENBQUNBO0lBRU1KLG9DQUFJQSxHQUFYQSxVQUFZQSxDQUFTQSxFQUFFQSxLQUFlQSxFQUFFQSxJQUFZQSxFQUFFQSxFQUFZQTtRQUNoRUssSUFBSUEsQ0FBQ0E7WUFDSEEsRUFBRUEsQ0FBQ0EsSUFBSUEsRUFBRUEsSUFBSUEsQ0FBQ0EsUUFBUUEsQ0FBQ0EsQ0FBQ0EsRUFBRUEsS0FBS0EsRUFBRUEsSUFBSUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDMUNBLENBQUVBO1FBQUFBLEtBQUtBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1lBQ1hBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1FBQ1JBLENBQUNBO0lBQ0hBLENBQUNBO0lBRU1MLHNDQUFNQSxHQUFiQSxVQUFjQSxDQUFTQSxFQUFFQSxFQUFZQTtRQUNuQ00sSUFBSUEsQ0FBQ0E7WUFDSEEsSUFBSUEsQ0FBQ0EsVUFBVUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFDbkJBLEVBQUVBLEVBQUVBLENBQUNBO1FBQ1BBLENBQUVBO1FBQUFBLEtBQUtBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1lBQ1hBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1FBQ1JBLENBQUNBO0lBQ0hBLENBQUNBO0lBRU1OLHFDQUFLQSxHQUFaQSxVQUFhQSxDQUFTQSxFQUFFQSxFQUFZQTtRQUNsQ08sSUFBSUEsQ0FBQ0E7WUFDSEEsSUFBSUEsQ0FBQ0EsU0FBU0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFDbEJBLEVBQUVBLEVBQUVBLENBQUNBO1FBQ1BBLENBQUVBO1FBQUFBLEtBQUtBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1lBQ1hBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1FBQ1JBLENBQUNBO0lBQ0hBLENBQUNBO0lBRU1QLHFDQUFLQSxHQUFaQSxVQUFhQSxDQUFTQSxFQUFFQSxJQUFZQSxFQUFFQSxFQUFZQTtRQUNoRFEsSUFBSUEsQ0FBQ0E7WUFDSEEsSUFBSUEsQ0FBQ0EsU0FBU0EsQ0FBQ0EsQ0FBQ0EsRUFBRUEsSUFBSUEsQ0FBQ0EsQ0FBQ0E7WUFDeEJBLEVBQUVBLEVBQUVBLENBQUNBO1FBQ1BBLENBQUVBO1FBQUFBLEtBQUtBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1lBQ1hBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1FBQ1JBLENBQUNBO0lBQ0hBLENBQUNBO0lBRU1SLHVDQUFPQSxHQUFkQSxVQUFlQSxDQUFTQSxFQUFFQSxFQUFZQTtRQUNwQ1MsSUFBSUEsQ0FBQ0E7WUFDSEEsRUFBRUEsQ0FBQ0EsSUFBSUEsRUFBRUEsSUFBSUEsQ0FBQ0EsV0FBV0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDaENBLENBQUVBO1FBQUFBLEtBQUtBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1lBQ1hBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1FBQ1JBLENBQUNBO0lBQ0hBLENBQUNBO0lBRU1ULHFDQUFLQSxHQUFaQSxVQUFhQSxDQUFTQSxFQUFFQSxRQUFpQkEsRUFBRUEsSUFBWUEsRUFBRUEsRUFBWUE7UUFDbkVVLElBQUlBLENBQUNBO1lBQ0hBLElBQUlBLENBQUNBLFNBQVNBLENBQUNBLENBQUNBLEVBQUVBLFFBQVFBLEVBQUVBLElBQUlBLENBQUNBLENBQUNBO1lBQ2xDQSxFQUFFQSxFQUFFQSxDQUFDQTtRQUNQQSxDQUFFQTtRQUFBQSxLQUFLQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQTtZQUNYQSxFQUFFQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQTtRQUNSQSxDQUFDQTtJQUNIQSxDQUFDQTtJQUVNVixxQ0FBS0EsR0FBWkEsVUFBYUEsQ0FBU0EsRUFBRUEsUUFBaUJBLEVBQUVBLEdBQVdBLEVBQUVBLEdBQVdBLEVBQUVBLEVBQVlBO1FBQy9FVyxJQUFJQSxDQUFDQTtZQUNIQSxJQUFJQSxDQUFDQSxTQUFTQSxDQUFDQSxDQUFDQSxFQUFFQSxRQUFRQSxFQUFFQSxHQUFHQSxFQUFFQSxHQUFHQSxDQUFDQSxDQUFDQTtZQUN0Q0EsRUFBRUEsRUFBRUEsQ0FBQ0E7UUFDUEEsQ0FBRUE7UUFBQUEsS0FBS0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFDWEEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDUkEsQ0FBQ0E7SUFDSEEsQ0FBQ0E7SUFFTVgsc0NBQU1BLEdBQWJBLFVBQWNBLENBQVNBLEVBQUVBLEtBQVdBLEVBQUVBLEtBQVdBLEVBQUVBLEVBQVlBO1FBQzdEWSxJQUFJQSxDQUFDQTtZQUNIQSxJQUFJQSxDQUFDQSxVQUFVQSxDQUFDQSxDQUFDQSxFQUFFQSxLQUFLQSxFQUFFQSxLQUFLQSxDQUFDQSxDQUFDQTtZQUNqQ0EsRUFBRUEsRUFBRUEsQ0FBQ0E7UUFDUEEsQ0FBRUE7UUFBQUEsS0FBS0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFDWEEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDUkEsQ0FBQ0E7SUFDSEEsQ0FBQ0E7SUFFTVosb0NBQUlBLEdBQVhBLFVBQVlBLE9BQWVBLEVBQUVBLE9BQWVBLEVBQUVBLEVBQVlBO1FBQ3hEYSxJQUFJQSxDQUFDQTtZQUNIQSxJQUFJQSxDQUFDQSxRQUFRQSxDQUFDQSxPQUFPQSxFQUFFQSxPQUFPQSxDQUFDQSxDQUFDQTtZQUNoQ0EsRUFBRUEsRUFBRUEsQ0FBQ0E7UUFDUEEsQ0FBRUE7UUFBQUEsS0FBS0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFDWEEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDUkEsQ0FBQ0E7SUFDSEEsQ0FBQ0E7SUFFTWIsdUNBQU9BLEdBQWRBLFVBQWVBLE9BQWVBLEVBQUVBLE9BQWVBLEVBQUVBLElBQVlBLEVBQUVBLEVBQVlBO1FBQ3pFYyxJQUFJQSxDQUFDQTtZQUNIQSxJQUFJQSxDQUFDQSxXQUFXQSxDQUFDQSxPQUFPQSxFQUFFQSxPQUFPQSxFQUFFQSxJQUFJQSxDQUFDQSxDQUFDQTtZQUN6Q0EsRUFBRUEsRUFBRUEsQ0FBQ0E7UUFDUEEsQ0FBRUE7UUFBQUEsS0FBS0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFDWEEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDUkEsQ0FBQ0E7SUFDSEEsQ0FBQ0E7SUFFTWQsd0NBQVFBLEdBQWZBLFVBQWdCQSxDQUFTQSxFQUFFQSxFQUFZQTtRQUNyQ2UsSUFBSUEsQ0FBQ0E7WUFDSEEsRUFBRUEsQ0FBQ0EsSUFBSUEsRUFBRUEsSUFBSUEsQ0FBQ0EsWUFBWUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDakNBLENBQUVBO1FBQUFBLEtBQUtBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1lBQ1hBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1FBQ1JBLENBQUNBO0lBQ0hBLENBQUNBO0lBQ0hmLDRCQUFDQTtBQUFEQSxDQUFDQSxBQXJIRCxFQUEyQyxjQUFjLEVBcUh4RDtBQXJIWSw2QkFBcUIsd0JBcUhqQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtBcGlFcnJvciwgRXJyb3JDb2RlfSBmcm9tICcuL2FwaV9lcnJvcic7XG5pbXBvcnQge1N0YXRzfSBmcm9tICcuL25vZGVfZnNfc3RhdHMnO1xuaW1wb3J0IGZpbGUgPSByZXF1aXJlKCcuL2ZpbGUnKTtcbmltcG9ydCB7RmlsZUZsYWcsIEFjdGlvblR5cGV9IGZyb20gJy4vZmlsZV9mbGFnJztcbmltcG9ydCBwYXRoID0gcmVxdWlyZSgncGF0aCcpO1xuXG4vKipcbiAqIEludGVyZmFjZSBmb3IgYSBmaWxlc3lzdGVtLiAqKkFsbCoqIEJyb3dzZXJGUyBGaWxlU3lzdGVtcyBzaG91bGQgaW1wbGVtZW50XG4gKiB0aGlzIGludGVyZmFjZS5cbiAqXG4gKiBCZWxvdywgd2UgZGVub3RlIGVhY2ggQVBJIG1ldGhvZCBhcyAqKkNvcmUqKiwgKipTdXBwbGVtZW50YWwqKiwgb3JcbiAqICoqT3B0aW9uYWwqKi5cbiAqXG4gKiAjIyMgQ29yZSBNZXRob2RzXG4gKlxuICogKipDb3JlKiogQVBJIG1ldGhvZHMgKm5lZWQqIHRvIGJlIGltcGxlbWVudGVkIGZvciBiYXNpYyByZWFkL3dyaXRlXG4gKiBmdW5jdGlvbmFsaXR5LlxuICpcbiAqIE5vdGUgdGhhdCByZWFkLW9ubHkgRmlsZVN5c3RlbXMgY2FuIGNob29zZSB0byBub3QgaW1wbGVtZW50IGNvcmUgbWV0aG9kc1xuICogdGhhdCBtdXRhdGUgZmlsZXMgb3IgbWV0YWRhdGEuIFRoZSBkZWZhdWx0IGltcGxlbWVudGF0aW9uIHdpbGwgcGFzcyBhXG4gKiBOT1RfU1VQUE9SVEVEIGVycm9yIHRvIHRoZSBjYWxsYmFjay5cbiAqXG4gKiAjIyMgU3VwcGxlbWVudGFsIE1ldGhvZHNcbiAqXG4gKiAqKlN1cHBsZW1lbnRhbCoqIEFQSSBtZXRob2RzIGRvIG5vdCBuZWVkIHRvIGJlIGltcGxlbWVudGVkIGJ5IGEgZmlsZXN5c3RlbS5cbiAqIFRoZSBkZWZhdWx0IGltcGxlbWVudGF0aW9uIGltcGxlbWVudHMgYWxsIG9mIHRoZSBzdXBwbGVtZW50YWwgQVBJIG1ldGhvZHMgaW5cbiAqIHRlcm1zIG9mIHRoZSAqKmNvcmUqKiBBUEkgbWV0aG9kcy5cbiAqXG4gKiBOb3RlIHRoYXQgYSBmaWxlIHN5c3RlbSBtYXkgY2hvb3NlIHRvIGltcGxlbWVudCBzdXBwbGVtZW50YWwgbWV0aG9kcyBmb3JcbiAqIGVmZmljaWVuY3kgcmVhc29ucy5cbiAqXG4gKiBUaGUgY29kZSBmb3Igc29tZSBzdXBwbGVtZW50YWwgbWV0aG9kcyB3YXMgYWRhcHRlZCBkaXJlY3RseSBmcm9tIE5vZGVKUydzXG4gKiBmcy5qcyBzb3VyY2UgY29kZS5cbiAqXG4gKiAjIyMgT3B0aW9uYWwgTWV0aG9kc1xuICpcbiAqICoqT3B0aW9uYWwqKiBBUEkgbWV0aG9kcyBwcm92aWRlIGZ1bmN0aW9uYWxpdHkgdGhhdCBtYXkgbm90IGJlIGF2YWlsYWJsZSBpblxuICogYWxsIGZpbGVzeXN0ZW1zLiBGb3IgZXhhbXBsZSwgYWxsIHN5bWxpbmsvaGFyZGxpbmstcmVsYXRlZCBBUEkgbWV0aG9kcyBmYWxsXG4gKiB1bmRlciB0aGlzIGNhdGVnb3J5LlxuICpcbiAqIFRoZSBkZWZhdWx0IGltcGxlbWVudGF0aW9uIHdpbGwgcGFzcyBhIE5PVF9TVVBQT1JURUQgZXJyb3IgdG8gdGhlIGNhbGxiYWNrLlxuICpcbiAqICMjIyBBcmd1bWVudCBBc3N1bXB0aW9uc1xuICpcbiAqIFlvdSBjYW4gYXNzdW1lIHRoZSBmb2xsb3dpbmcgYWJvdXQgYXJndW1lbnRzIHBhc3NlZCB0byBlYWNoIEFQSSBtZXRob2Q6XG4gKlxuICogKiAqKkV2ZXJ5IHBhdGggaXMgYW4gYWJzb2x1dGUgcGF0aC4qKiBNZWFuaW5nLCBgLmAsIGAuLmAsIGFuZCBvdGhlciBpdGVtc1xuICogICBhcmUgcmVzb2x2ZWQgaW50byBhbiBhYnNvbHV0ZSBmb3JtLlxuICogKiAqKkFsbCBhcmd1bWVudHMgYXJlIHByZXNlbnQuKiogQW55IG9wdGlvbmFsIGFyZ3VtZW50cyBhdCB0aGUgTm9kZSBBUEkgbGV2ZWxcbiAqICAgaGF2ZSBiZWVuIHBhc3NlZCBpbiB3aXRoIHRoZWlyIGRlZmF1bHQgdmFsdWVzLlxuICogKiAqKlRoZSBjYWxsYmFjayB3aWxsIHJlc2V0IHRoZSBzdGFjayBkZXB0aC4qKiBXaGVuIHlvdXIgZmlsZXN5c3RlbSBjYWxscyB0aGVcbiAqICAgY2FsbGJhY2sgd2l0aCB0aGUgcmVxdWVzdGVkIGluZm9ybWF0aW9uLCBpdCB3aWxsIHVzZSBgc2V0SW1tZWRpYXRlYCB0b1xuICogICByZXNldCB0aGUgSmF2YVNjcmlwdCBzdGFjayBkZXB0aCBiZWZvcmUgY2FsbGluZyB0aGUgdXNlci1zdXBwbGllZCBjYWxsYmFjay5cbiAqIEBjbGFzcyBGaWxlU3lzdGVtXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRmlsZVN5c3RlbSB7XG4gIC8qKlxuICAgKiAqKk9wdGlvbmFsKio6IFJldHVybnMgdGhlIG5hbWUgb2YgdGhlIGZpbGUgc3lzdGVtLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jZ2V0TmFtZVxuICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAqL1xuICBnZXROYW1lKCk6IHN0cmluZztcbiAgLyoqXG4gICAqICoqT3B0aW9uYWwqKjogUGFzc2VzIHRoZSBmb2xsb3dpbmcgaW5mb3JtYXRpb24gdG8gdGhlIGNhbGxiYWNrOlxuICAgKlxuICAgKiAqIFRvdGFsIG51bWJlciBvZiBieXRlcyBhdmFpbGFibGUgb24gdGhpcyBmaWxlIHN5c3RlbS5cbiAgICogKiBudW1iZXIgb2YgZnJlZSBieXRlcyBhdmFpbGFibGUgb24gdGhpcyBmaWxlIHN5c3RlbS5cbiAgICpcbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI2Rpc2tTcGFjZVxuICAgKiBAdG9kbyBUaGlzIGluZm8gaXMgbm90IGF2YWlsYWJsZSB0aHJvdWdoIHRoZSBOb2RlIEFQSS4gUGVyaGFwcyB3ZSBjb3VsZCBkbyBhXG4gICAqICAgcG9seWZpbGwgb2YgZGlza3NwYWNlLmpzLCBvciBhZGQgYSBuZXcgTm9kZSBBUEkgZnVuY3Rpb24uXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoIFRoZSBwYXRoIHRvIHRoZSBsb2NhdGlvbiB0aGF0IGlzIGJlaW5nIHF1ZXJpZWQuIE9ubHlcbiAgICogICB1c2VmdWwgZm9yIGZpbGVzeXN0ZW1zIHRoYXQgc3VwcG9ydCBtb3VudCBwb2ludHMuXG4gICAqIEBwYXJhbSB7RmlsZVN5c3RlbX5kaXNrU3BhY2VDYWxsYmFja30gY2JcbiAgICovXG4gIGRpc2tTcGFjZShwOiBzdHJpbmcsIGNiOiAodG90YWw6IG51bWJlciwgZnJlZTogbnVtYmVyKSA9PiBhbnkpOiB2b2lkO1xuICAvKipcbiAgICogKipDb3JlKio6IElzIHRoaXMgZmlsZXN5c3RlbSByZWFkLW9ubHk/XG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNpc1JlYWRPbmx5XG4gICAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgdGhpcyBGaWxlU3lzdGVtIGlzIGluaGVyZW50bHkgcmVhZC1vbmx5LlxuICAgKi9cbiAgaXNSZWFkT25seSgpOiBib29sZWFuO1xuICAvKipcbiAgICogKipDb3JlKio6IERvZXMgdGhlIGZpbGVzeXN0ZW0gc3VwcG9ydCBvcHRpb25hbCBzeW1saW5rL2hhcmRsaW5rLXJlbGF0ZWRcbiAgICogICBjb21tYW5kcz9cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3N1cHBvcnRzTGlua3NcbiAgICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgRmlsZVN5c3RlbSBzdXBwb3J0cyB0aGUgb3B0aW9uYWxcbiAgICogICBzeW1saW5rL2hhcmRsaW5rLXJlbGF0ZWQgY29tbWFuZHMuXG4gICAqL1xuICBzdXBwb3J0c0xpbmtzKCk6IGJvb2xlYW47XG4gIC8qKlxuICAgKiAqKkNvcmUqKjogRG9lcyB0aGUgZmlsZXN5c3RlbSBzdXBwb3J0IG9wdGlvbmFsIHByb3BlcnR5LXJlbGF0ZWQgY29tbWFuZHM/XG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNzdXBwb3J0c1Byb3BzXG4gICAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgdGhlIEZpbGVTeXN0ZW0gc3VwcG9ydHMgdGhlIG9wdGlvbmFsXG4gICAqICAgcHJvcGVydHktcmVsYXRlZCBjb21tYW5kcyAocGVybWlzc2lvbnMsIHV0aW1lcywgZXRjKS5cbiAgICovXG4gIHN1cHBvcnRzUHJvcHMoKTogYm9vbGVhbjtcbiAgLyoqXG4gICAqICoqQ29yZSoqOiBEb2VzIHRoZSBmaWxlc3lzdGVtIHN1cHBvcnQgdGhlIG9wdGlvbmFsIHN5bmNocm9ub3VzIGludGVyZmFjZT9cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3N1cHBvcnRzU3luY2hcbiAgICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgRmlsZVN5c3RlbSBzdXBwb3J0cyBzeW5jaHJvbm91cyBvcGVyYXRpb25zLlxuICAgKi9cbiAgc3VwcG9ydHNTeW5jaCgpOiBib29sZWFuO1xuICAvLyAqKkNPUkUgQVBJIE1FVEhPRFMqKlxuICAvLyBGaWxlIG9yIGRpcmVjdG9yeSBvcGVyYXRpb25zXG4gIC8qKlxuICAgKiAqKkNvcmUqKjogQXN5bmNocm9ub3VzIHJlbmFtZS4gTm8gYXJndW1lbnRzIG90aGVyIHRoYW4gYSBwb3NzaWJsZSBleGNlcHRpb25cbiAgICogYXJlIGdpdmVuIHRvIHRoZSBjb21wbGV0aW9uIGNhbGxiYWNrLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jcmVuYW1lXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBvbGRQYXRoXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBuZXdQYXRoXG4gICAqIEBwYXJhbSB7RmlsZVN5c3RlbX5ub2RlQ2FsbGJhY2t9IGNiXG4gICAqL1xuICByZW5hbWUob2xkUGF0aDogc3RyaW5nLCBuZXdQYXRoOiBzdHJpbmcsIGNiOiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICAvKipcbiAgICogKipDb3JlKio6IFN5bmNocm9ub3VzIHJlbmFtZS5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3JlbmFtZVN5bmNcbiAgICogQHBhcmFtIHtzdHJpbmd9IG9sZFBhdGhcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5ld1BhdGhcbiAgICovXG4gIHJlbmFtZVN5bmMob2xkUGF0aDogc3RyaW5nLCBuZXdQYXRoOiBzdHJpbmcpOiB2b2lkO1xuICAvKipcbiAgICogKipDb3JlKio6IEFzeW5jaHJvbm91cyBgc3RhdGAgb3IgYGxzdGF0YC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3N0YXRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhcbiAgICogQHBhcmFtIHtib29sZWFufSBpc0xzdGF0IFRydWUgaWYgdGhpcyBpcyBgbHN0YXRgLCBmYWxzZSBpZiB0aGlzIGlzIHJlZ3VsYXJcbiAgICogICBgc3RhdGAuXG4gICAqIEBwYXJhbSB7RmlsZVN5c3RlbX5ub2RlU3RhdHNDYWxsYmFja30gY2JcbiAgICovXG4gIHN0YXQocDogc3RyaW5nLCBpc0xzdGF0OiBib29sZWFuLCBjYjogKGVycjogQXBpRXJyb3IsIHN0YXQ/OiBTdGF0cykgPT4gdm9pZCk6IHZvaWQ7XG4gIC8qKlxuICAgKiAqKkNvcmUqKjogU3luY2hyb25vdXMgYHN0YXRgIG9yIGBsc3RhdGAuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNzdGF0U3luY1xuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IGlzTHN0YXQgVHJ1ZSBpZiB0aGlzIGlzIGBsc3RhdGAsIGZhbHNlIGlmIHRoaXMgaXMgcmVndWxhclxuICAgKiAgIGBzdGF0YC5cbiAgICogQHJldHVybiB7QnJvd3NlckZTLm5vZGUuZnMuU3RhdHN9XG4gICAqL1xuICBzdGF0U3luYyhwOiBzdHJpbmcsIGlzTHN0YXQ6IGJvb2xlYW4pOiBTdGF0cztcbiAgLy8gRmlsZSBvcGVyYXRpb25zXG4gIC8qKlxuICAgKiAqKkNvcmUqKjogQXN5bmNocm9ub3VzIGZpbGUgb3Blbi5cbiAgICogQHNlZSBodHRwOi8vd3d3Lm1hbnBhZ2V6LmNvbS9tYW4vMi9vcGVuL1xuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jb3BlblxuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKiBAcGFyYW0ge0Jyb3dzZXJGUy5GaWxlTW9kZX0gZmxhZ3MgSGFuZGxlcyB0aGUgY29tcGxleGl0eSBvZiB0aGUgdmFyaW91cyBmaWxlXG4gICAqICAgbW9kZXMuIFNlZSBpdHMgQVBJIGZvciBtb3JlIGRldGFpbHMuXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBtb2RlIE1vZGUgdG8gdXNlIHRvIG9wZW4gdGhlIGZpbGUuIENhbiBiZSBpZ25vcmVkIGlmIHRoZVxuICAgKiAgIGZpbGVzeXN0ZW0gZG9lc24ndCBzdXBwb3J0IHBlcm1pc3Npb25zLlxuICAgKiBAcGFyYW0ge0ZpbGVTeXN0ZW1+ZmlsZUNhbGxiYWNrfSBjYlxuICAgKi9cbiAgb3BlbihwOiBzdHJpbmcsIGZsYWc6RmlsZUZsYWcsIG1vZGU6IG51bWJlciwgY2I6IChlcnI6IEFwaUVycm9yLCBmZD86IGZpbGUuRmlsZSkgPT4gYW55KTogdm9pZDtcbiAgLyoqXG4gICAqICoqQ29yZSoqOiBTeW5jaHJvbm91cyBmaWxlIG9wZW4uXG4gICAqIEBzZWUgaHR0cDovL3d3dy5tYW5wYWdlei5jb20vbWFuLzIvb3Blbi9cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI29wZW5TeW5jXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEBwYXJhbSB7QnJvd3NlckZTLkZpbGVNb2RlfSBmbGFncyBIYW5kbGVzIHRoZSBjb21wbGV4aXR5IG9mIHRoZSB2YXJpb3VzIGZpbGVcbiAgICogICBtb2Rlcy4gU2VlIGl0cyBBUEkgZm9yIG1vcmUgZGV0YWlscy5cbiAgICogQHBhcmFtIHtudW1iZXJ9IG1vZGUgTW9kZSB0byB1c2UgdG8gb3BlbiB0aGUgZmlsZS4gQ2FuIGJlIGlnbm9yZWQgaWYgdGhlXG4gICAqICAgZmlsZXN5c3RlbSBkb2Vzbid0IHN1cHBvcnQgcGVybWlzc2lvbnMuXG4gICAqIEByZXR1cm4ge0Jyb3dzZXJGUy5GaWxlfVxuICAgKi9cbiAgb3BlblN5bmMocDogc3RyaW5nLCBmbGFnOiBGaWxlRmxhZywgbW9kZTogbnVtYmVyKTogZmlsZS5GaWxlO1xuICAvKipcbiAgICogKipDb3JlKio6IEFzeW5jaHJvbm91cyBgdW5saW5rYC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3VubGlua1xuICAgKiBAcGFyYW0gW3N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW0ZpbGVTeXN0ZW1+bm9kZUNhbGxiYWNrXSBjYlxuICAgKi9cbiAgdW5saW5rKHA6IHN0cmluZywgY2I6IEZ1bmN0aW9uKTogdm9pZDtcbiAgLyoqXG4gICAqICoqQ29yZSoqOiBTeW5jaHJvbm91cyBgdW5saW5rYC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3VubGlua1N5bmNcbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhcbiAgICovXG4gIHVubGlua1N5bmMocDogc3RyaW5nKTogdm9pZDtcbiAgLy8gRGlyZWN0b3J5IG9wZXJhdGlvbnNcbiAgLyoqXG4gICAqICoqQ29yZSoqOiBBc3luY2hyb25vdXMgYHJtZGlyYC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3JtZGlyXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEBwYXJhbSB7RmlsZVN5c3RlbX5ub2RlQ2FsbGJhY2t9IGNiXG4gICAqL1xuICBybWRpcihwOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQ7XG4gIC8qKlxuICAgKiAqKkNvcmUqKjogU3luY2hyb25vdXMgYHJtZGlyYC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3JtZGlyU3luY1xuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKi9cbiAgcm1kaXJTeW5jKHA6IHN0cmluZyk6IHZvaWQ7XG4gIC8qKlxuICAgKiAqKkNvcmUqKjogQXN5bmNocm9ub3VzIGBta2RpcmAuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNta2RpclxuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKiBAcGFyYW0ge251bWJlcj99IG1vZGUgTW9kZSB0byBtYWtlIHRoZSBkaXJlY3RvcnkgdXNpbmcuIENhbiBiZSBpZ25vcmVkIGlmXG4gICAqICAgdGhlIGZpbGVzeXN0ZW0gZG9lc24ndCBzdXBwb3J0IHBlcm1pc3Npb25zLlxuICAgKiBAcGFyYW0ge0ZpbGVTeXN0ZW1+bm9kZUNhbGxiYWNrfSBjYlxuICAgKi9cbiAgbWtkaXIocDogc3RyaW5nLCBtb2RlOiBudW1iZXIsIGNiOiBGdW5jdGlvbik6IHZvaWQ7XG4gIC8qKlxuICAgKiAqKkNvcmUqKjogU3luY2hyb25vdXMgYG1rZGlyYC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI21rZGlyU3luY1xuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKiBAcGFyYW0ge251bWJlcn0gbW9kZSBNb2RlIHRvIG1ha2UgdGhlIGRpcmVjdG9yeSB1c2luZy4gQ2FuIGJlIGlnbm9yZWQgaWZcbiAgICogICB0aGUgZmlsZXN5c3RlbSBkb2Vzbid0IHN1cHBvcnQgcGVybWlzc2lvbnMuXG4gICAqL1xuICBta2RpclN5bmMocDogc3RyaW5nLCBtb2RlOiBudW1iZXIpOiB2b2lkO1xuICAvKipcbiAgICogKipDb3JlKio6IEFzeW5jaHJvbm91cyBgcmVhZGRpcmAuIFJlYWRzIHRoZSBjb250ZW50cyBvZiBhIGRpcmVjdG9yeS5cbiAgICpcbiAgICogVGhlIGNhbGxiYWNrIGdldHMgdHdvIGFyZ3VtZW50cyBgKGVyciwgZmlsZXMpYCB3aGVyZSBgZmlsZXNgIGlzIGFuIGFycmF5IG9mXG4gICAqIHRoZSBuYW1lcyBvZiB0aGUgZmlsZXMgaW4gdGhlIGRpcmVjdG9yeSBleGNsdWRpbmcgYCcuJ2AgYW5kIGAnLi4nYC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3JlYWRkaXJcbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhcbiAgICogQHBhcmFtIHtGaWxlU3lzdGVtfnJlYWRkaXJDYWxsYmFja30gY2JcbiAgICovXG4gIHJlYWRkaXIocDogc3RyaW5nLCBjYjogKGVycjogQXBpRXJyb3IsIGZpbGVzPzogc3RyaW5nW10pID0+IHZvaWQpOiB2b2lkO1xuICAvKipcbiAgICogKipDb3JlKio6IFN5bmNocm9ub3VzIGByZWFkZGlyYC4gUmVhZHMgdGhlIGNvbnRlbnRzIG9mIGEgZGlyZWN0b3J5LlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jcmVhZGRpclN5bmNcbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhcbiAgICogQHJldHVybiB7c3RyaW5nW119XG4gICAqL1xuICByZWFkZGlyU3luYyhwOiBzdHJpbmcpOiBzdHJpbmdbXTtcbiAgLy8gKipTVVBQTEVNRU5UQUwgSU5URVJGQUNFIE1FVEhPRFMqKlxuICAvLyBGaWxlIG9yIGRpcmVjdG9yeSBvcGVyYXRpb25zXG4gIC8qKlxuICAgKiAqKlN1cHBsZW1lbnRhbCoqOiBUZXN0IHdoZXRoZXIgb3Igbm90IHRoZSBnaXZlbiBwYXRoIGV4aXN0cyBieSBjaGVja2luZyB3aXRoXG4gICAqIHRoZSBmaWxlIHN5c3RlbS4gVGhlbiBjYWxsIHRoZSBjYWxsYmFjayBhcmd1bWVudCB3aXRoIGVpdGhlciB0cnVlIG9yIGZhbHNlLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jZXhpc3RzXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEBwYXJhbSB7RmlsZVN5c3RlbX5leGlzdHNDYWxsYmFja30gY2JcbiAgICovXG4gIGV4aXN0cyhwOiBzdHJpbmcsIGNiOiAoZXhpc3RzOiBib29sZWFuKSA9PiB2b2lkKTogdm9pZDtcbiAgLyoqXG4gICAqICoqU3VwcGxlbWVudGFsKio6IFRlc3Qgd2hldGhlciBvciBub3QgdGhlIGdpdmVuIHBhdGggZXhpc3RzIGJ5IGNoZWNraW5nIHdpdGhcbiAgICogdGhlIGZpbGUgc3lzdGVtLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jZXhpc3RzU3luY1xuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgKi9cbiAgZXhpc3RzU3luYyhwOiBzdHJpbmcpOiBib29sZWFuO1xuICAvKipcbiAgICogKipTdXBwbGVtZW50YWwqKjogQXN5bmNocm9ub3VzIGByZWFscGF0aGAuIFRoZSBjYWxsYmFjayBnZXRzIHR3byBhcmd1bWVudHNcbiAgICogYChlcnIsIHJlc29sdmVkUGF0aClgLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhlIE5vZGUgQVBJIHdpbGwgcmVzb2x2ZSBgcGF0aGAgdG8gYW4gYWJzb2x1dGUgcGF0aC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3JlYWxwYXRoXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBjYWNoZSBBbiBvYmplY3QgbGl0ZXJhbCBvZiBtYXBwZWQgcGF0aHMgdGhhdCBjYW4gYmUgdXNlZCB0b1xuICAgKiAgIGZvcmNlIGEgc3BlY2lmaWMgcGF0aCByZXNvbHV0aW9uIG9yIGF2b2lkIGFkZGl0aW9uYWwgYGZzLnN0YXRgIGNhbGxzIGZvclxuICAgKiAgIGtub3duIHJlYWwgcGF0aHMuIElmIG5vdCBzdXBwbGllZCBieSB0aGUgdXNlciwgaXQnbGwgYmUgYW4gZW1wdHkgb2JqZWN0LlxuICAgKiBAcGFyYW0ge0ZpbGVTeXN0ZW1+cGF0aENhbGxiYWNrfSBjYlxuICAgKi9cbiAgcmVhbHBhdGgocDogc3RyaW5nLCBjYWNoZToge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9LCBjYjogKGVycjogQXBpRXJyb3IsIHJlc29sdmVkUGF0aD86IHN0cmluZykgPT4gYW55KTogdm9pZDtcbiAgLyoqXG4gICAqICoqU3VwcGxlbWVudGFsKio6IFN5bmNocm9ub3VzIGByZWFscGF0aGAuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGUgTm9kZSBBUEkgd2lsbCByZXNvbHZlIGBwYXRoYCB0byBhbiBhYnNvbHV0ZSBwYXRoLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jcmVhbHBhdGhTeW5jXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBjYWNoZSBBbiBvYmplY3QgbGl0ZXJhbCBvZiBtYXBwZWQgcGF0aHMgdGhhdCBjYW4gYmUgdXNlZCB0b1xuICAgKiAgIGZvcmNlIGEgc3BlY2lmaWMgcGF0aCByZXNvbHV0aW9uIG9yIGF2b2lkIGFkZGl0aW9uYWwgYGZzLnN0YXRgIGNhbGxzIGZvclxuICAgKiAgIGtub3duIHJlYWwgcGF0aHMuIElmIG5vdCBzdXBwbGllZCBieSB0aGUgdXNlciwgaXQnbGwgYmUgYW4gZW1wdHkgb2JqZWN0LlxuICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAqL1xuICByZWFscGF0aFN5bmMocDogc3RyaW5nLCBjYWNoZToge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9KTogc3RyaW5nO1xuICAvLyBGaWxlIG9wZXJhdGlvbnNcbiAgLyoqXG4gICAqXG4gICAqICoqU3VwcGxlbWVudGFsKio6IEFzeW5jaHJvbm91cyBgdHJ1bmNhdGVgLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jdHJ1bmNhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhcbiAgICogQHBhcmFtIHtudW1iZXJ9IGxlblxuICAgKiBAcGFyYW0ge0ZpbGVTeXN0ZW1+bm9kZUNhbGxiYWNrfSBjYlxuICAgKi9cbiAgdHJ1bmNhdGUocDogc3RyaW5nLCBsZW46IG51bWJlciwgY2I6IEZ1bmN0aW9uKTogdm9pZDtcbiAgLyoqXG4gICAqICoqU3VwcGxlbWVudGFsKio6IFN5bmNocm9ub3VzIGB0cnVuY2F0ZWAuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSN0cnVuY2F0ZVN5bmNcbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhcbiAgICogQHBhcmFtIHtudW1iZXJ9IGxlblxuICAgKi9cbiAgdHJ1bmNhdGVTeW5jKHA6IHN0cmluZywgbGVuOiBudW1iZXIpOiB2b2lkO1xuICAvKipcbiAgICogKipTdXBwbGVtZW50YWwqKjogQXN5bmNocm9ub3VzbHkgcmVhZHMgdGhlIGVudGlyZSBjb250ZW50cyBvZiBhIGZpbGUuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNyZWFkRmlsZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gZmlsZW5hbWVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGVuY29kaW5nIElmIG5vbi1udWxsLCB0aGUgZmlsZSdzIGNvbnRlbnRzIHNob3VsZCBiZSBkZWNvZGVkXG4gICAqICAgaW50byBhIHN0cmluZyB1c2luZyB0aGF0IGVuY29kaW5nLiBPdGhlcndpc2UsIGlmIGVuY29kaW5nIGlzIG51bGwsIGZldGNoXG4gICAqICAgdGhlIGZpbGUncyBjb250ZW50cyBhcyBhIEJ1ZmZlci5cbiAgICogQHBhcmFtIHtCcm93c2VyRlMuRmlsZU1vZGV9IGZsYWdcbiAgICogQHBhcmFtIHtGaWxlU3lzdGVtfnJlYWRDYWxsYmFja30gY2IgSWYgbm8gZW5jb2RpbmcgaXMgc3BlY2lmaWVkLCB0aGVuIHRoZVxuICAgKiAgIHJhdyBidWZmZXIgaXMgcmV0dXJuZWQuXG4gICAqL1xuICByZWFkRmlsZShmbmFtZTogc3RyaW5nLCBlbmNvZGluZzogc3RyaW5nLCBmbGFnOiBGaWxlRmxhZywgY2I6IChlcnI6IEFwaUVycm9yLCBkYXRhPzogYW55KSA9PiB2b2lkKTogdm9pZDtcbiAgLyoqXG4gICAqICoqU3VwcGxlbWVudGFsKio6IFN5bmNocm9ub3VzbHkgcmVhZHMgdGhlIGVudGlyZSBjb250ZW50cyBvZiBhIGZpbGUuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSNyZWFkRmlsZVN5bmNcbiAgICogQHBhcmFtIHtzdHJpbmd9IGZpbGVuYW1lXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBlbmNvZGluZyBJZiBub24tbnVsbCwgdGhlIGZpbGUncyBjb250ZW50cyBzaG91bGQgYmUgZGVjb2RlZFxuICAgKiAgIGludG8gYSBzdHJpbmcgdXNpbmcgdGhhdCBlbmNvZGluZy4gT3RoZXJ3aXNlLCBpZiBlbmNvZGluZyBpcyBudWxsLCBmZXRjaFxuICAgKiAgIHRoZSBmaWxlJ3MgY29udGVudHMgYXMgYSBCdWZmZXIuXG4gICAqIEBwYXJhbSB7QnJvd3NlckZTLkZpbGVNb2RlfSBmbGFnXG4gICAqIEByZXR1cm4geyhzdHJpbmd8QnJvd3NlckZTLkJ1ZmZlcil9XG4gICAqL1xuICByZWFkRmlsZVN5bmMoZm5hbWU6IHN0cmluZywgZW5jb2Rpbmc6IHN0cmluZywgZmxhZzogRmlsZUZsYWcpOiBhbnk7XG4gIC8qKlxuICAgKiAqKlN1cHBsZW1lbnRhbCoqOiBBc3luY2hyb25vdXNseSB3cml0ZXMgZGF0YSB0byBhIGZpbGUsIHJlcGxhY2luZyB0aGUgZmlsZVxuICAgKiBpZiBpdCBhbHJlYWR5IGV4aXN0cy5cbiAgICpcbiAgICogVGhlIGVuY29kaW5nIG9wdGlvbiBpcyBpZ25vcmVkIGlmIGRhdGEgaXMgYSBidWZmZXIuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSN3cml0ZUZpbGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGZpbGVuYW1lXG4gICAqIEBwYXJhbSB7KHN0cmluZyB8IEJyb3dzZXJGUy5ub2RlLkJ1ZmZlcil9IGRhdGFcbiAgICogQHBhcmFtIHtzdHJpbmd9IGVuY29kaW5nXG4gICAqIEBwYXJhbSB7QnJvd3NlckZTLkZpbGVNb2RlfSBmbGFnXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBtb2RlXG4gICAqIEBwYXJhbSB7RmlsZVN5c3RlbX5ub2RlQ2FsbGJhY2t9IGNiXG4gICAqL1xuICB3cml0ZUZpbGUoZm5hbWU6IHN0cmluZywgZGF0YTogYW55LCBlbmNvZGluZzogc3RyaW5nLCBmbGFnOiBGaWxlRmxhZywgbW9kZTogbnVtYmVyLCBjYjogKGVycjogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICAvKipcbiAgICogKipTdXBwbGVtZW50YWwqKjogU3luY2hyb25vdXNseSB3cml0ZXMgZGF0YSB0byBhIGZpbGUsIHJlcGxhY2luZyB0aGUgZmlsZVxuICAgKiBpZiBpdCBhbHJlYWR5IGV4aXN0cy5cbiAgICpcbiAgICogVGhlIGVuY29kaW5nIG9wdGlvbiBpcyBpZ25vcmVkIGlmIGRhdGEgaXMgYSBidWZmZXIuXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSN3cml0ZUZpbGVTeW5jXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBmaWxlbmFtZVxuICAgKiBAcGFyYW0geyhzdHJpbmcgfCBCcm93c2VyRlMubm9kZS5CdWZmZXIpfSBkYXRhXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBlbmNvZGluZ1xuICAgKiBAcGFyYW0ge0Jyb3dzZXJGUy5GaWxlTW9kZX0gZmxhZ1xuICAgKiBAcGFyYW0ge251bWJlcn0gbW9kZVxuICAgKi9cbiAgd3JpdGVGaWxlU3luYyhmbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGVuY29kaW5nOiBzdHJpbmcsIGZsYWc6IEZpbGVGbGFnLCBtb2RlOiBudW1iZXIpOiB2b2lkO1xuICAvKipcbiAgICogKipTdXBwbGVtZW50YWwqKjogQXN5bmNocm9ub3VzbHkgYXBwZW5kIGRhdGEgdG8gYSBmaWxlLCBjcmVhdGluZyB0aGUgZmlsZSBpZlxuICAgKiBpdCBub3QgeWV0IGV4aXN0cy5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI2FwcGVuZEZpbGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGZpbGVuYW1lXG4gICAqIEBwYXJhbSB7KHN0cmluZyB8IEJyb3dzZXJGUy5ub2RlLkJ1ZmZlcil9IGRhdGFcbiAgICogQHBhcmFtIHtzdHJpbmd9IGVuY29kaW5nXG4gICAqIEBwYXJhbSB7QnJvd3NlckZTLkZpbGVNb2RlfSBmbGFnXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBtb2RlXG4gICAqIEBwYXJhbSB7RmlsZVN5c3RlbX5ub2RlQ2FsbGJhY2t9IGNiXG4gICAqL1xuICBhcHBlbmRGaWxlKGZuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgZW5jb2Rpbmc6IHN0cmluZywgZmxhZzogRmlsZUZsYWcsIG1vZGU6IG51bWJlciwgY2I6IChlcnI6IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgLyoqXG4gICAqICoqU3VwcGxlbWVudGFsKio6IFN5bmNocm9ub3VzbHkgYXBwZW5kIGRhdGEgdG8gYSBmaWxlLCBjcmVhdGluZyB0aGUgZmlsZSBpZlxuICAgKiBpdCBub3QgeWV0IGV4aXN0cy5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI2FwcGVuZEZpbGVTeW5jXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBmaWxlbmFtZVxuICAgKiBAcGFyYW0geyhzdHJpbmcgfCBCcm93c2VyRlMubm9kZS5CdWZmZXIpfSBkYXRhXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBlbmNvZGluZ1xuICAgKiBAcGFyYW0ge0Jyb3dzZXJGUy5GaWxlTW9kZX0gZmxhZ1xuICAgKiBAcGFyYW0ge251bWJlcn0gbW9kZVxuICAgKi9cbiAgYXBwZW5kRmlsZVN5bmMoZm5hbWU6IHN0cmluZywgZGF0YTogYW55LCBlbmNvZGluZzogc3RyaW5nLCBmbGFnOiBGaWxlRmxhZywgbW9kZTogbnVtYmVyKTogdm9pZDtcbiAgLy8gKipPUFRJT05BTCBJTlRFUkZBQ0UgTUVUSE9EUyoqXG4gIC8vIFByb3BlcnR5IG9wZXJhdGlvbnNcbiAgLy8gVGhpcyBpc24ndCBhbHdheXMgcG9zc2libGUgb24gc29tZSBmaWxlc3lzdGVtIHR5cGVzIChlLmcuIERyb3Bib3gpLlxuICAvKipcbiAgICogKipPcHRpb25hbCoqOiBBc3luY2hyb25vdXMgYGNobW9kYCBvciBgbGNobW9kYC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI2NobW9kXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNMY2htb2QgYFRydWVgIGlmIGBsY2htb2RgLCBmYWxzZSBpZiBgY2htb2RgLiBIYXMgbm9cbiAgICogICBiZWFyaW5nIG9uIHJlc3VsdCBpZiBsaW5rcyBhcmVuJ3Qgc3VwcG9ydGVkLlxuICAgKiBAcGFyYW0ge251bWJlcn0gbW9kZVxuICAgKiBAcGFyYW0ge0ZpbGVTeXN0ZW1+bm9kZUNhbGxiYWNrfSBjYlxuICAgKi9cbiAgY2htb2QocDogc3RyaW5nLCBpc0xjaG1vZDogYm9vbGVhbiwgbW9kZTogbnVtYmVyLCBjYjogRnVuY3Rpb24pOiB2b2lkO1xuICAvKipcbiAgICogKipPcHRpb25hbCoqOiBTeW5jaHJvbm91cyBgY2htb2RgIG9yIGBsY2htb2RgLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jY2htb2RTeW5jXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNMY2htb2QgYFRydWVgIGlmIGBsY2htb2RgLCBmYWxzZSBpZiBgY2htb2RgLiBIYXMgbm9cbiAgICogICBiZWFyaW5nIG9uIHJlc3VsdCBpZiBsaW5rcyBhcmVuJ3Qgc3VwcG9ydGVkLlxuICAgKiBAcGFyYW0ge251bWJlcn0gbW9kZVxuICAgKi9cbiAgY2htb2RTeW5jKHA6IHN0cmluZywgaXNMY2htb2Q6IGJvb2xlYW4sIG1vZGU6IG51bWJlcik6IHZvaWQ7XG4gIC8qKlxuICAgKiAqKk9wdGlvbmFsKio6IEFzeW5jaHJvbm91cyBgY2hvd25gIG9yIGBsY2hvd25gLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jY2hvd25cbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhcbiAgICogQHBhcmFtIHtib29sZWFufSBpc0xjaG93biBgVHJ1ZWAgaWYgYGxjaG93bmAsIGZhbHNlIGlmIGBjaG93bmAuIEhhcyBub1xuICAgKiAgIGJlYXJpbmcgb24gcmVzdWx0IGlmIGxpbmtzIGFyZW4ndCBzdXBwb3J0ZWQuXG4gICAqIEBwYXJhbSB7bnVtYmVyfSB1aWRcbiAgICogQHBhcmFtIHtudW1iZXJ9IGdpZFxuICAgKiBAcGFyYW0ge0ZpbGVTeXN0ZW1+bm9kZUNhbGxiYWNrfSBjYlxuICAgKi9cbiAgY2hvd24ocDogc3RyaW5nLCBpc0xjaG93bjogYm9vbGVhbiwgdWlkOiBudW1iZXIsIGdpZDogbnVtYmVyLCBjYjogRnVuY3Rpb24pOiB2b2lkO1xuICAvKipcbiAgICogKipPcHRpb25hbCoqOiBTeW5jaHJvbm91cyBgY2hvd25gIG9yIGBsY2hvd25gLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jY2hvd25TeW5jXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNMY2hvd24gYFRydWVgIGlmIGBsY2hvd25gLCBmYWxzZSBpZiBgY2hvd25gLiBIYXMgbm9cbiAgICogICBiZWFyaW5nIG9uIHJlc3VsdCBpZiBsaW5rcyBhcmVuJ3Qgc3VwcG9ydGVkLlxuICAgKiBAcGFyYW0ge251bWJlcn0gdWlkXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBnaWRcbiAgICovXG4gIGNob3duU3luYyhwOiBzdHJpbmcsIGlzTGNob3duOiBib29sZWFuLCB1aWQ6IG51bWJlciwgZ2lkOiBudW1iZXIpOiB2b2lkO1xuICAvKipcbiAgICogKipPcHRpb25hbCoqOiBDaGFuZ2UgZmlsZSB0aW1lc3RhbXBzIG9mIHRoZSBmaWxlIHJlZmVyZW5jZWQgYnkgdGhlIHN1cHBsaWVkXG4gICAqIHBhdGguXG4gICAqIEBtZXRob2QgRmlsZVN5c3RlbSN1dGltZXNcbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhcbiAgICogQHBhcmFtIHtEYXRlfSBhdGltZVxuICAgKiBAcGFyYW0ge0RhdGV9IG10aW1lXG4gICAqIEBwYXJhbSB7RmlsZVN5c3RlbX5ub2RlQ2FsbGJhY2t9IGNiXG4gICAqL1xuICB1dGltZXMocDogc3RyaW5nLCBhdGltZTogRGF0ZSwgbXRpbWU6IERhdGUsIGNiOiBGdW5jdGlvbik6IHZvaWQ7XG4gIC8qKlxuICAgKiAqKk9wdGlvbmFsKio6IENoYW5nZSBmaWxlIHRpbWVzdGFtcHMgb2YgdGhlIGZpbGUgcmVmZXJlbmNlZCBieSB0aGUgc3VwcGxpZWRcbiAgICogcGF0aC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3V0aW1lc1N5bmNcbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhcbiAgICogQHBhcmFtIHtEYXRlfSBhdGltZVxuICAgKiBAcGFyYW0ge0RhdGV9IG10aW1lXG4gICAqL1xuICB1dGltZXNTeW5jKHA6IHN0cmluZywgYXRpbWU6IERhdGUsIG10aW1lOiBEYXRlKTogdm9pZDtcbiAgLy8gU3ltbGluayBvcGVyYXRpb25zXG4gIC8vIFN5bWxpbmtzIGFyZW4ndCBhbHdheXMgc3VwcG9ydGVkLlxuICAvKipcbiAgICogKipPcHRpb25hbCoqOiBBc3luY2hyb25vdXMgYGxpbmtgLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jbGlua1xuICAgKiBAcGFyYW0ge3N0cmluZ30gc3JjcGF0aFxuICAgKiBAcGFyYW0ge3N0cmluZ30gZHN0cGF0aFxuICAgKiBAcGFyYW0ge0ZpbGVTeXN0ZW1+bm9kZUNhbGxiYWNrfSBjYlxuICAgKi9cbiAgbGluayhzcmNwYXRoOiBzdHJpbmcsIGRzdHBhdGg6IHN0cmluZywgY2I6IEZ1bmN0aW9uKTogdm9pZDtcbiAgLyoqXG4gICAqICoqT3B0aW9uYWwqKjogU3luY2hyb25vdXMgYGxpbmtgLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jbGlua1N5bmNcbiAgICogQHBhcmFtIHtzdHJpbmd9IHNyY3BhdGhcbiAgICogQHBhcmFtIHtzdHJpbmd9IGRzdHBhdGhcbiAgICovXG4gIGxpbmtTeW5jKHNyY3BhdGg6IHN0cmluZywgZHN0cGF0aDogc3RyaW5nKTogdm9pZDtcbiAgLyoqXG4gICAqICoqT3B0aW9uYWwqKjogQXN5bmNocm9ub3VzIGBzeW1saW5rYC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3N5bWxpbmtcbiAgICogQHBhcmFtIHtzdHJpbmd9IHNyY3BhdGhcbiAgICogQHBhcmFtIHtzdHJpbmd9IGRzdHBhdGhcbiAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgY2FuIGJlIGVpdGhlciBgJ2RpcidgIG9yIGAnZmlsZSdgXG4gICAqIEBwYXJhbSB7RmlsZVN5c3RlbX5ub2RlQ2FsbGJhY2t9IGNiXG4gICAqL1xuICBzeW1saW5rKHNyY3BhdGg6IHN0cmluZywgZHN0cGF0aDogc3RyaW5nLCB0eXBlOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQ7XG4gIC8qKlxuICAgKiAqKk9wdGlvbmFsKio6IFN5bmNocm9ub3VzIGBzeW1saW5rYC5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3N5bWxpbmtTeW5jXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBzcmNwYXRoXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBkc3RwYXRoXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIGNhbiBiZSBlaXRoZXIgYCdkaXInYCBvciBgJ2ZpbGUnYFxuICAgKi9cbiAgc3ltbGlua1N5bmMoc3JjcGF0aDogc3RyaW5nLCBkc3RwYXRoOiBzdHJpbmcsIHR5cGU6IHN0cmluZyk6IHZvaWQ7XG4gIC8qKlxuICAgKiAqKk9wdGlvbmFsKio6IEFzeW5jaHJvbm91cyByZWFkbGluay5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtI3JlYWRsaW5rXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEBwYXJhbSB7RmlsZVN5c3RlbX5wYXRoQ2FsbGJhY2t9IGNhbGxiYWNrXG4gICAqL1xuICByZWFkbGluayhwOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQ7XG4gIC8qKlxuICAgKiAqKk9wdGlvbmFsKio6IFN5bmNocm9ub3VzIHJlYWRsaW5rLlxuICAgKiBAbWV0aG9kIEZpbGVTeXN0ZW0jcmVhZGxpbmtTeW5jXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqL1xuICByZWFkbGlua1N5bmMocDogc3RyaW5nKTogc3RyaW5nO1xufVxuXG4vKipcbiAqIENvbnRhaW5zIHR5cGluZ3MgZm9yIHN0YXRpYyBmdW5jdGlvbnMgb24gdGhlIGZpbGUgc3lzdGVtIGNvbnN0cnVjdG9yLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEZpbGVTeXN0ZW1Db25zdHJ1Y3RvciB7XG4gIC8qKlxuICAgKiAqKkNvcmUqKjogUmV0dXJucyAndHJ1ZScgaWYgdGhpcyBmaWxlc3lzdGVtIGlzIGF2YWlsYWJsZSBpbiB0aGUgY3VycmVudFxuICAgKiBlbnZpcm9ubWVudC4gRm9yIGV4YW1wbGUsIGEgYGxvY2FsU3RvcmFnZWAtYmFja2VkIGZpbGVzeXN0ZW0gd2lsbCByZXR1cm5cbiAgICogJ2ZhbHNlJyBpZiB0aGUgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IHRoYXQgQVBJLlxuICAgKlxuICAgKiBEZWZhdWx0cyB0byAnZmFsc2UnLCBhcyB0aGUgRmlsZVN5c3RlbSBiYXNlIGNsYXNzIGlzbid0IHVzYWJsZSBhbG9uZS5cbiAgICogQG1ldGhvZCBGaWxlU3lzdGVtLmlzQXZhaWxhYmxlXG4gICAqIEByZXR1cm4ge2Jvb2xlYW59XG4gICAqL1xuICBpc0F2YWlsYWJsZSgpOiBib29sZWFuO1xufVxuXG4vKipcbiAqIEJhc2ljIGZpbGVzeXN0ZW0gY2xhc3MuIE1vc3QgZmlsZXN5c3RlbXMgc2hvdWxkIGV4dGVuZCB0aGlzIGNsYXNzLCBhcyBpdFxuICogcHJvdmlkZXMgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbnMgZm9yIGEgaGFuZGZ1bCBvZiBtZXRob2RzLlxuICovXG5leHBvcnQgY2xhc3MgQmFzZUZpbGVTeXN0ZW0ge1xuICBwdWJsaWMgc3VwcG9ydHNMaW5rcygpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcHVibGljIGRpc2tTcGFjZShwOiBzdHJpbmcsIGNiOiAodG90YWw6IG51bWJlciwgZnJlZTogbnVtYmVyKSA9PiBhbnkpOiB2b2lkIHtcbiAgICBjYigwLCAwKTtcbiAgfVxuICAvKipcbiAgICogT3BlbnMgdGhlIGZpbGUgYXQgcGF0aCBwIHdpdGggdGhlIGdpdmVuIGZsYWcuIFRoZSBmaWxlIG11c3QgZXhpc3QuXG4gICAqIEBwYXJhbSBwIFRoZSBwYXRoIHRvIG9wZW4uXG4gICAqIEBwYXJhbSBmbGFnIFRoZSBmbGFnIHRvIHVzZSB3aGVuIG9wZW5pbmcgdGhlIGZpbGUuXG4gICAqL1xuICBwdWJsaWMgb3BlbkZpbGUocDogc3RyaW5nLCBmbGFnOiBGaWxlRmxhZywgY2I6IChlOiBBcGlFcnJvciwgZmlsZT86IGZpbGUuRmlsZSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCk7XG4gIH1cbiAgLyoqXG4gICAqIENyZWF0ZSB0aGUgZmlsZSBhdCBwYXRoIHAgd2l0aCB0aGUgZ2l2ZW4gbW9kZS4gVGhlbiwgb3BlbiBpdCB3aXRoIHRoZSBnaXZlblxuICAgKiBmbGFnLlxuICAgKi9cbiAgcHVibGljIGNyZWF0ZUZpbGUocDogc3RyaW5nLCBmbGFnOiBGaWxlRmxhZywgbW9kZTogbnVtYmVyLCBjYjogKGU6IEFwaUVycm9yLCBmaWxlPzogZmlsZS5GaWxlKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxuICBwdWJsaWMgb3BlbihwOiBzdHJpbmcsIGZsYWc6RmlsZUZsYWcsIG1vZGU6IG51bWJlciwgY2I6IChlcnI6IEFwaUVycm9yLCBmZD86IGZpbGUuQmFzZUZpbGUpID0+IGFueSk6IHZvaWQge1xuICAgIHZhciBtdXN0X2JlX2ZpbGUgPSAoZTogQXBpRXJyb3IsIHN0YXRzPzogU3RhdHMpOiB2b2lkID0+IHtcbiAgICAgIGlmIChlKSB7XG4gICAgICAgIC8vIEZpbGUgZG9lcyBub3QgZXhpc3QuXG4gICAgICAgIHN3aXRjaCAoZmxhZy5wYXRoTm90RXhpc3RzQWN0aW9uKCkpIHtcbiAgICAgICAgICBjYXNlIEFjdGlvblR5cGUuQ1JFQVRFX0ZJTEU6XG4gICAgICAgICAgICAvLyBFbnN1cmUgcGFyZW50IGV4aXN0cy5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLnN0YXQocGF0aC5kaXJuYW1lKHApLCBmYWxzZSwgKGU6IEFwaUVycm9yLCBwYXJlbnRTdGF0cz86IFN0YXRzKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChlKSB7XG4gICAgICAgICAgICAgICAgY2IoZSk7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoIXBhcmVudFN0YXRzLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICBjYihBcGlFcnJvci5FTk9URElSKHBhdGguZGlybmFtZShwKSkpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuY3JlYXRlRmlsZShwLCBmbGFnLCBtb2RlLCBjYik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIGNhc2UgQWN0aW9uVHlwZS5USFJPV19FWENFUFRJT046XG4gICAgICAgICAgICByZXR1cm4gY2IoQXBpRXJyb3IuRU5PRU5UKHApKTtcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgcmV0dXJuIGNiKG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnSW52YWxpZCBGaWxlRmxhZyBvYmplY3QuJykpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBGaWxlIGV4aXN0cy5cbiAgICAgICAgaWYgKHN0YXRzLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICByZXR1cm4gY2IoQXBpRXJyb3IuRUlTRElSKHApKTtcbiAgICAgICAgfVxuICAgICAgICBzd2l0Y2ggKGZsYWcucGF0aEV4aXN0c0FjdGlvbigpKSB7XG4gICAgICAgICAgY2FzZSBBY3Rpb25UeXBlLlRIUk9XX0VYQ0VQVElPTjpcbiAgICAgICAgICAgIHJldHVybiBjYihBcGlFcnJvci5FRVhJU1QocCkpO1xuICAgICAgICAgIGNhc2UgQWN0aW9uVHlwZS5UUlVOQ0FURV9GSUxFOlxuICAgICAgICAgICAgLy8gTk9URTogSW4gYSBwcmV2aW91cyBpbXBsZW1lbnRhdGlvbiwgd2UgZGVsZXRlZCB0aGUgZmlsZSBhbmRcbiAgICAgICAgICAgIC8vIHJlLWNyZWF0ZWQgaXQuIEhvd2V2ZXIsIHRoaXMgY3JlYXRlZCBhIHJhY2UgY29uZGl0aW9uIGlmIGFub3RoZXJcbiAgICAgICAgICAgIC8vIGFzeW5jaHJvbm91cyByZXF1ZXN0IHdhcyB0cnlpbmcgdG8gcmVhZCB0aGUgZmlsZSwgYXMgdGhlIGZpbGVcbiAgICAgICAgICAgIC8vIHdvdWxkIG5vdCBleGlzdCBmb3IgYSBzbWFsbCBwZXJpb2Qgb2YgdGltZS5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLm9wZW5GaWxlKHAsIGZsYWcsIChlOiBBcGlFcnJvciwgZmQ/OiBmaWxlLkZpbGUpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgaWYgKGUpIHtcbiAgICAgICAgICAgICAgICBjYihlKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmZC50cnVuY2F0ZSgwLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICBmZC5zeW5jKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY2IobnVsbCwgZmQpO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIGNhc2UgQWN0aW9uVHlwZS5OT1A6XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5vcGVuRmlsZShwLCBmbGFnLCBjYik7XG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBjYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgJ0ludmFsaWQgRmlsZUZsYWcgb2JqZWN0LicpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gICAgdGhpcy5zdGF0KHAsIGZhbHNlLCBtdXN0X2JlX2ZpbGUpO1xuICB9XG4gIHB1YmxpYyByZW5hbWUob2xkUGF0aDogc3RyaW5nLCBuZXdQYXRoOiBzdHJpbmcsIGNiOiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBjYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApKTtcbiAgfVxuICBwdWJsaWMgcmVuYW1lU3luYyhvbGRQYXRoOiBzdHJpbmcsIG5ld1BhdGg6IHN0cmluZyk6IHZvaWQge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCk7XG4gIH1cbiAgcHVibGljIHN0YXQocDogc3RyaW5nLCBpc0xzdGF0OiBib29sZWFuLCBjYjogKGVycjogQXBpRXJyb3IsIHN0YXQ/OiBTdGF0cykgPT4gdm9pZCk6IHZvaWQge1xuICAgIGNiKG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCkpO1xuICB9XG4gIHB1YmxpYyBzdGF0U3luYyhwOiBzdHJpbmcsIGlzTHN0YXQ6IGJvb2xlYW4pOiBTdGF0cyB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxuICAvKipcbiAgICogT3BlbnMgdGhlIGZpbGUgYXQgcGF0aCBwIHdpdGggdGhlIGdpdmVuIGZsYWcuIFRoZSBmaWxlIG11c3QgZXhpc3QuXG4gICAqIEBwYXJhbSBwIFRoZSBwYXRoIHRvIG9wZW4uXG4gICAqIEBwYXJhbSBmbGFnIFRoZSBmbGFnIHRvIHVzZSB3aGVuIG9wZW5pbmcgdGhlIGZpbGUuXG4gICAqIEByZXR1cm4gQSBGaWxlIG9iamVjdCBjb3JyZXNwb25kaW5nIHRvIHRoZSBvcGVuZWQgZmlsZS5cbiAgICovXG4gIHB1YmxpYyBvcGVuRmlsZVN5bmMocDogc3RyaW5nLCBmbGFnOiBGaWxlRmxhZyk6IGZpbGUuRmlsZSB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxuICAvKipcbiAgICogQ3JlYXRlIHRoZSBmaWxlIGF0IHBhdGggcCB3aXRoIHRoZSBnaXZlbiBtb2RlLiBUaGVuLCBvcGVuIGl0IHdpdGggdGhlIGdpdmVuXG4gICAqIGZsYWcuXG4gICAqL1xuICBwdWJsaWMgY3JlYXRlRmlsZVN5bmMocDogc3RyaW5nLCBmbGFnOiBGaWxlRmxhZywgbW9kZTogbnVtYmVyKTogZmlsZS5GaWxlIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xuICB9XG4gIHB1YmxpYyBvcGVuU3luYyhwOiBzdHJpbmcsIGZsYWc6IEZpbGVGbGFnLCBtb2RlOiBudW1iZXIpOiBmaWxlLkZpbGUge1xuICAgIC8vIENoZWNrIGlmIHRoZSBwYXRoIGV4aXN0cywgYW5kIGlzIGEgZmlsZS5cbiAgICB2YXIgc3RhdHM6IFN0YXRzO1xuICAgIHRyeSB7XG4gICAgICBzdGF0cyA9IHRoaXMuc3RhdFN5bmMocCwgZmFsc2UpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIEZpbGUgZG9lcyBub3QgZXhpc3QuXG4gICAgICBzd2l0Y2ggKGZsYWcucGF0aE5vdEV4aXN0c0FjdGlvbigpKSB7XG4gICAgICAgIGNhc2UgQWN0aW9uVHlwZS5DUkVBVEVfRklMRTpcbiAgICAgICAgICAvLyBFbnN1cmUgcGFyZW50IGV4aXN0cy5cbiAgICAgICAgICB2YXIgcGFyZW50U3RhdHMgPSB0aGlzLnN0YXRTeW5jKHBhdGguZGlybmFtZShwKSwgZmFsc2UpO1xuICAgICAgICAgIGlmICghcGFyZW50U3RhdHMuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgICAgdGhyb3cgQXBpRXJyb3IuRU5PVERJUihwYXRoLmRpcm5hbWUocCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVGaWxlU3luYyhwLCBmbGFnLCBtb2RlKTtcbiAgICAgICAgY2FzZSBBY3Rpb25UeXBlLlRIUk9XX0VYQ0VQVElPTjpcbiAgICAgICAgICB0aHJvdyBBcGlFcnJvci5FTk9FTlQocCk7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsICdJbnZhbGlkIEZpbGVGbGFnIG9iamVjdC4nKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBGaWxlIGV4aXN0cy5cbiAgICBpZiAoc3RhdHMuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRUlTRElSKHApO1xuICAgIH1cbiAgICBzd2l0Y2ggKGZsYWcucGF0aEV4aXN0c0FjdGlvbigpKSB7XG4gICAgICBjYXNlIEFjdGlvblR5cGUuVEhST1dfRVhDRVBUSU9OOlxuICAgICAgICB0aHJvdyBBcGlFcnJvci5FRVhJU1QocCk7XG4gICAgICBjYXNlIEFjdGlvblR5cGUuVFJVTkNBVEVfRklMRTpcbiAgICAgICAgLy8gRGVsZXRlIGZpbGUuXG4gICAgICAgIHRoaXMudW5saW5rU3luYyhwKTtcbiAgICAgICAgLy8gQ3JlYXRlIGZpbGUuIFVzZSB0aGUgc2FtZSBtb2RlIGFzIHRoZSBvbGQgZmlsZS5cbiAgICAgICAgLy8gTm9kZSBpdHNlbGYgbW9kaWZpZXMgdGhlIGN0aW1lIHdoZW4gdGhpcyBvY2N1cnMsIHNvIHRoaXMgYWN0aW9uXG4gICAgICAgIC8vIHdpbGwgcHJlc2VydmUgdGhhdCBiZWhhdmlvciBpZiB0aGUgdW5kZXJseWluZyBmaWxlIHN5c3RlbVxuICAgICAgICAvLyBzdXBwb3J0cyB0aG9zZSBwcm9wZXJ0aWVzLlxuICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVGaWxlU3luYyhwLCBmbGFnLCBzdGF0cy5tb2RlKTtcbiAgICAgIGNhc2UgQWN0aW9uVHlwZS5OT1A6XG4gICAgICAgIHJldHVybiB0aGlzLm9wZW5GaWxlU3luYyhwLCBmbGFnKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnSW52YWxpZCBGaWxlRmxhZyBvYmplY3QuJyk7XG4gICAgfVxuICB9XG4gIHB1YmxpYyB1bmxpbmsocDogc3RyaW5nLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICBjYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApKTtcbiAgfVxuICBwdWJsaWMgdW5saW5rU3luYyhwOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xuICB9XG4gIHB1YmxpYyBybWRpcihwOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIGNiKG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCkpO1xuICB9XG4gIHB1YmxpYyBybWRpclN5bmMocDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxuICBwdWJsaWMgbWtkaXIocDogc3RyaW5nLCBtb2RlOiBudW1iZXIsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIGNiKG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCkpO1xuICB9XG4gIHB1YmxpYyBta2RpclN5bmMocDogc3RyaW5nLCBtb2RlOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xuICB9XG4gIHB1YmxpYyByZWFkZGlyKHA6IHN0cmluZywgY2I6IChlcnI6IEFwaUVycm9yLCBmaWxlcz86IHN0cmluZ1tdKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgY2IobmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKSk7XG4gIH1cbiAgcHVibGljIHJlYWRkaXJTeW5jKHA6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xuICB9XG4gIHB1YmxpYyBleGlzdHMocDogc3RyaW5nLCBjYjogKGV4aXN0czogYm9vbGVhbikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuc3RhdChwLCBudWxsLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgIGNiKGVyciA9PSBudWxsKTtcbiAgICB9KTtcbiAgfVxuICBwdWJsaWMgZXhpc3RzU3luYyhwOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICB0cnkge1xuICAgICAgdGhpcy5zdGF0U3luYyhwLCB0cnVlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcHVibGljIHJlYWxwYXRoKHA6IHN0cmluZywgY2FjaGU6IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSwgY2I6IChlcnI6IEFwaUVycm9yLCByZXNvbHZlZFBhdGg/OiBzdHJpbmcpID0+IGFueSk6IHZvaWQge1xuICAgIGlmICh0aGlzLnN1cHBvcnRzTGlua3MoKSkge1xuICAgICAgLy8gVGhlIHBhdGggY291bGQgY29udGFpbiBzeW1saW5rcy4gU3BsaXQgdXAgdGhlIHBhdGgsXG4gICAgICAvLyByZXNvbHZlIGFueSBzeW1saW5rcywgcmV0dXJuIHRoZSByZXNvbHZlZCBzdHJpbmcuXG4gICAgICB2YXIgc3BsaXRQYXRoID0gcC5zcGxpdChwYXRoLnNlcCk7XG4gICAgICAvLyBUT0RPOiBTaW1wbGVyIHRvIGp1c3QgcGFzcyB0aHJvdWdoIGZpbGUsIGZpbmQgc2VwIGFuZCBzdWNoLlxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzcGxpdFBhdGgubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGFkZFBhdGhzID0gc3BsaXRQYXRoLnNsaWNlKDAsIGkgKyAxKTtcbiAgICAgICAgc3BsaXRQYXRoW2ldID0gcGF0aC5qb2luLmFwcGx5KG51bGwsIGFkZFBhdGhzKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm8gc3ltbGlua3MuIFdlIGp1c3QgbmVlZCB0byB2ZXJpZnkgdGhhdCBpdCBleGlzdHMuXG4gICAgICB0aGlzLmV4aXN0cyhwLCBmdW5jdGlvbihkb2VzRXhpc3QpIHtcbiAgICAgICAgaWYgKGRvZXNFeGlzdCkge1xuICAgICAgICAgIGNiKG51bGwsIHApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNiKEFwaUVycm9yLkVOT0VOVChwKSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBwdWJsaWMgcmVhbHBhdGhTeW5jKHA6IHN0cmluZywgY2FjaGU6IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuc3VwcG9ydHNMaW5rcygpKSB7XG4gICAgICAvLyBUaGUgcGF0aCBjb3VsZCBjb250YWluIHN5bWxpbmtzLiBTcGxpdCB1cCB0aGUgcGF0aCxcbiAgICAgIC8vIHJlc29sdmUgYW55IHN5bWxpbmtzLCByZXR1cm4gdGhlIHJlc29sdmVkIHN0cmluZy5cbiAgICAgIHZhciBzcGxpdFBhdGggPSBwLnNwbGl0KHBhdGguc2VwKTtcbiAgICAgIC8vIFRPRE86IFNpbXBsZXIgdG8ganVzdCBwYXNzIHRocm91Z2ggZmlsZSwgZmluZCBzZXAgYW5kIHN1Y2guXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNwbGl0UGF0aC5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgYWRkUGF0aHMgPSBzcGxpdFBhdGguc2xpY2UoMCwgaSArIDEpO1xuICAgICAgICBzcGxpdFBhdGhbaV0gPSBwYXRoLmpvaW4uYXBwbHkobnVsbCwgYWRkUGF0aHMpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBObyBzeW1saW5rcy4gV2UganVzdCBuZWVkIHRvIHZlcmlmeSB0aGF0IGl0IGV4aXN0cy5cbiAgICAgIGlmICh0aGlzLmV4aXN0c1N5bmMocCkpIHtcbiAgICAgICAgcmV0dXJuIHA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBBcGlFcnJvci5FTk9FTlQocCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHB1YmxpYyB0cnVuY2F0ZShwOiBzdHJpbmcsIGxlbjogbnVtYmVyLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0aGlzLm9wZW4ocCwgRmlsZUZsYWcuZ2V0RmlsZUZsYWcoJ3IrJyksIDB4MWE0LCAoZnVuY3Rpb24oZXI6IEFwaUVycm9yLCBmZD86IGZpbGUuRmlsZSkge1xuICAgICAgaWYgKGVyKSB7XG4gICAgICAgIHJldHVybiBjYihlcik7XG4gICAgICB9XG4gICAgICBmZC50cnVuY2F0ZShsZW4sIChmdW5jdGlvbihlcjogYW55KSB7XG4gICAgICAgIGZkLmNsb3NlKChmdW5jdGlvbihlcjI6IGFueSkge1xuICAgICAgICAgIGNiKGVyIHx8IGVyMik7XG4gICAgICAgIH0pKTtcbiAgICAgIH0pKTtcbiAgICB9KSk7XG4gIH1cbiAgcHVibGljIHRydW5jYXRlU3luYyhwOiBzdHJpbmcsIGxlbjogbnVtYmVyKTogdm9pZCB7XG4gICAgdmFyIGZkID0gdGhpcy5vcGVuU3luYyhwLCBGaWxlRmxhZy5nZXRGaWxlRmxhZygncisnKSwgMHgxYTQpO1xuICAgIC8vIE5lZWQgdG8gc2FmZWx5IGNsb3NlIEZELCByZWdhcmRsZXNzIG9mIHdoZXRoZXIgb3Igbm90IHRydW5jYXRlIHN1Y2NlZWRzLlxuICAgIHRyeSB7XG4gICAgICBmZC50cnVuY2F0ZVN5bmMobGVuKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aHJvdyBlO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBmZC5jbG9zZVN5bmMoKTtcbiAgICB9XG4gIH1cbiAgcHVibGljIHJlYWRGaWxlKGZuYW1lOiBzdHJpbmcsIGVuY29kaW5nOiBzdHJpbmcsIGZsYWc6IEZpbGVGbGFnLCBjYjogKGVycjogQXBpRXJyb3IsIGRhdGE/OiBhbnkpID0+IHZvaWQpOiB2b2lkIHtcbiAgICAvLyBXcmFwIGNiIGluIGZpbGUgY2xvc2luZyBjb2RlLlxuICAgIHZhciBvbGRDYiA9IGNiO1xuICAgIC8vIEdldCBmaWxlLlxuICAgIHRoaXMub3BlbihmbmFtZSwgZmxhZywgMHgxYTQsIGZ1bmN0aW9uKGVycjogQXBpRXJyb3IsIGZkPzogZmlsZS5GaWxlKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIHJldHVybiBjYihlcnIpO1xuICAgICAgfVxuICAgICAgY2IgPSBmdW5jdGlvbihlcnI6IEFwaUVycm9yLCBhcmc/OiBmaWxlLkZpbGUpIHtcbiAgICAgICAgZmQuY2xvc2UoZnVuY3Rpb24oZXJyMjogYW55KSB7XG4gICAgICAgICAgaWYgKGVyciA9PSBudWxsKSB7XG4gICAgICAgICAgICBlcnIgPSBlcnIyO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gb2xkQ2IoZXJyLCBhcmcpO1xuICAgICAgICB9KTtcbiAgICAgIH07XG4gICAgICBmZC5zdGF0KGZ1bmN0aW9uKGVycjogQXBpRXJyb3IsIHN0YXQ/OiBTdGF0cykge1xuICAgICAgICBpZiAoZXJyICE9IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBBbGxvY2F0ZSBidWZmZXIuXG4gICAgICAgIHZhciBidWYgPSBuZXcgQnVmZmVyKHN0YXQuc2l6ZSk7XG4gICAgICAgIGZkLnJlYWQoYnVmLCAwLCBzdGF0LnNpemUsIDAsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIGlmIChlcnIgIT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIGNiKGVycik7XG4gICAgICAgICAgfSBlbHNlIGlmIChlbmNvZGluZyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIGNiKGVyciwgYnVmKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNiKG51bGwsIGJ1Zi50b1N0cmluZyhlbmNvZGluZykpO1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNiKGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBwdWJsaWMgcmVhZEZpbGVTeW5jKGZuYW1lOiBzdHJpbmcsIGVuY29kaW5nOiBzdHJpbmcsIGZsYWc6IEZpbGVGbGFnKTogYW55IHtcbiAgICAvLyBHZXQgZmlsZS5cbiAgICB2YXIgZmQgPSB0aGlzLm9wZW5TeW5jKGZuYW1lLCBmbGFnLCAweDFhNCk7XG4gICAgdHJ5IHtcbiAgICAgIHZhciBzdGF0ID0gZmQuc3RhdFN5bmMoKTtcbiAgICAgIC8vIEFsbG9jYXRlIGJ1ZmZlci5cbiAgICAgIHZhciBidWYgPSBuZXcgQnVmZmVyKHN0YXQuc2l6ZSk7XG4gICAgICBmZC5yZWFkU3luYyhidWYsIDAsIHN0YXQuc2l6ZSwgMCk7XG4gICAgICBmZC5jbG9zZVN5bmMoKTtcbiAgICAgIGlmIChlbmNvZGluZyA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gYnVmO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGJ1Zi50b1N0cmluZyhlbmNvZGluZyk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGZkLmNsb3NlU3luYygpO1xuICAgIH1cbiAgfVxuICBwdWJsaWMgd3JpdGVGaWxlKGZuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgZW5jb2Rpbmc6IHN0cmluZywgZmxhZzogRmlsZUZsYWcsIG1vZGU6IG51bWJlciwgY2I6IChlcnI6IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgLy8gV3JhcCBjYiBpbiBmaWxlIGNsb3NpbmcgY29kZS5cbiAgICB2YXIgb2xkQ2IgPSBjYjtcbiAgICAvLyBHZXQgZmlsZS5cbiAgICB0aGlzLm9wZW4oZm5hbWUsIGZsYWcsIDB4MWE0LCBmdW5jdGlvbihlcnI6IEFwaUVycm9yLCBmZD86ZmlsZS5GaWxlKSB7XG4gICAgICBpZiAoZXJyICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGNiKGVycik7XG4gICAgICB9XG4gICAgICBjYiA9IGZ1bmN0aW9uKGVycjogQXBpRXJyb3IpIHtcbiAgICAgICAgZmQuY2xvc2UoZnVuY3Rpb24oZXJyMjogYW55KSB7XG4gICAgICAgICAgb2xkQ2IoZXJyICE9IG51bGwgPyBlcnIgOiBlcnIyKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuXG4gICAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgZGF0YSA9IG5ldyBCdWZmZXIoZGF0YSwgZW5jb2RpbmcpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBjYihlKTtcbiAgICAgIH1cbiAgICAgIC8vIFdyaXRlIGludG8gZmlsZS5cbiAgICAgIGZkLndyaXRlKGRhdGEsIDAsIGRhdGEubGVuZ3RoLCAwLCBjYik7XG4gICAgfSk7XG4gIH1cbiAgcHVibGljIHdyaXRlRmlsZVN5bmMoZm5hbWU6IHN0cmluZywgZGF0YTogYW55LCBlbmNvZGluZzogc3RyaW5nLCBmbGFnOiBGaWxlRmxhZywgbW9kZTogbnVtYmVyKTogdm9pZCB7XG4gICAgLy8gR2V0IGZpbGUuXG4gICAgdmFyIGZkID0gdGhpcy5vcGVuU3luYyhmbmFtZSwgZmxhZywgbW9kZSk7XG4gICAgdHJ5IHtcbiAgICAgIGlmICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgZGF0YSA9IG5ldyBCdWZmZXIoZGF0YSwgZW5jb2RpbmcpO1xuICAgICAgfVxuICAgICAgLy8gV3JpdGUgaW50byBmaWxlLlxuICAgICAgZmQud3JpdGVTeW5jKGRhdGEsIDAsIGRhdGEubGVuZ3RoLCAwKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgZmQuY2xvc2VTeW5jKCk7XG4gICAgfVxuICB9XG4gIHB1YmxpYyBhcHBlbmRGaWxlKGZuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgZW5jb2Rpbmc6IHN0cmluZywgZmxhZzogRmlsZUZsYWcsIG1vZGU6IG51bWJlciwgY2I6IChlcnI6IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgLy8gV3JhcCBjYiBpbiBmaWxlIGNsb3NpbmcgY29kZS5cbiAgICB2YXIgb2xkQ2IgPSBjYjtcbiAgICB0aGlzLm9wZW4oZm5hbWUsIGZsYWcsIG1vZGUsIGZ1bmN0aW9uKGVycjogQXBpRXJyb3IsIGZkPzogZmlsZS5GaWxlKSB7XG4gICAgICBpZiAoZXJyICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGNiKGVycik7XG4gICAgICB9XG4gICAgICBjYiA9IGZ1bmN0aW9uKGVycjogQXBpRXJyb3IpIHtcbiAgICAgICAgZmQuY2xvc2UoZnVuY3Rpb24oZXJyMjogYW55KSB7XG4gICAgICAgICAgb2xkQ2IoZXJyICE9IG51bGwgPyBlcnIgOiBlcnIyKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuICAgICAgICBkYXRhID0gbmV3IEJ1ZmZlcihkYXRhLCBlbmNvZGluZyk7XG4gICAgICB9XG4gICAgICBmZC53cml0ZShkYXRhLCAwLCBkYXRhLmxlbmd0aCwgbnVsbCwgY2IpO1xuICAgIH0pO1xuICB9XG4gIHB1YmxpYyBhcHBlbmRGaWxlU3luYyhmbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGVuY29kaW5nOiBzdHJpbmcsIGZsYWc6IEZpbGVGbGFnLCBtb2RlOiBudW1iZXIpOiB2b2lkIHtcbiAgICB2YXIgZmQgPSB0aGlzLm9wZW5TeW5jKGZuYW1lLCBmbGFnLCBtb2RlKTtcbiAgICB0cnkge1xuICAgICAgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuICAgICAgICBkYXRhID0gbmV3IEJ1ZmZlcihkYXRhLCBlbmNvZGluZyk7XG4gICAgICB9XG4gICAgICBmZC53cml0ZVN5bmMoZGF0YSwgMCwgZGF0YS5sZW5ndGgsIG51bGwpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBmZC5jbG9zZVN5bmMoKTtcbiAgICB9XG4gIH1cbiAgcHVibGljIGNobW9kKHA6IHN0cmluZywgaXNMY2htb2Q6IGJvb2xlYW4sIG1vZGU6IG51bWJlciwgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgY2IobmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKSk7XG4gIH1cbiAgcHVibGljIGNobW9kU3luYyhwOiBzdHJpbmcsIGlzTGNobW9kOiBib29sZWFuLCBtb2RlOiBudW1iZXIpIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xuICB9XG4gIHB1YmxpYyBjaG93bihwOiBzdHJpbmcsIGlzTGNob3duOiBib29sZWFuLCB1aWQ6IG51bWJlciwgZ2lkOiBudW1iZXIsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIGNiKG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCkpO1xuICB9XG4gIHB1YmxpYyBjaG93blN5bmMocDogc3RyaW5nLCBpc0xjaG93bjogYm9vbGVhbiwgdWlkOiBudW1iZXIsIGdpZDogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxuICBwdWJsaWMgdXRpbWVzKHA6IHN0cmluZywgYXRpbWU6IERhdGUsIG10aW1lOiBEYXRlLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICBjYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApKTtcbiAgfVxuICBwdWJsaWMgdXRpbWVzU3luYyhwOiBzdHJpbmcsIGF0aW1lOiBEYXRlLCBtdGltZTogRGF0ZSk6IHZvaWQge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCk7XG4gIH1cbiAgcHVibGljIGxpbmsoc3JjcGF0aDogc3RyaW5nLCBkc3RwYXRoOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIGNiKG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCkpO1xuICB9XG4gIHB1YmxpYyBsaW5rU3luYyhzcmNwYXRoOiBzdHJpbmcsIGRzdHBhdGg6IHN0cmluZyk6IHZvaWQge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCk7XG4gIH1cbiAgcHVibGljIHN5bWxpbmsoc3JjcGF0aDogc3RyaW5nLCBkc3RwYXRoOiBzdHJpbmcsIHR5cGU6IHN0cmluZywgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgY2IobmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKSk7XG4gIH1cbiAgcHVibGljIHN5bWxpbmtTeW5jKHNyY3BhdGg6IHN0cmluZywgZHN0cGF0aDogc3RyaW5nLCB0eXBlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xuICB9XG4gIHB1YmxpYyByZWFkbGluayhwOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIGNiKG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCkpO1xuICB9XG4gIHB1YmxpYyByZWFkbGlua1N5bmMocDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xuICB9XG59XG5cbi8qKlxuICogSW1wbGVtZW50cyB0aGUgYXN5bmNocm9ub3VzIEFQSSBpbiB0ZXJtcyBvZiB0aGUgc3luY2hyb25vdXMgQVBJLlxuICogQGNsYXNzIFN5bmNocm9ub3VzRmlsZVN5c3RlbVxuICovXG5leHBvcnQgY2xhc3MgU3luY2hyb25vdXNGaWxlU3lzdGVtIGV4dGVuZHMgQmFzZUZpbGVTeXN0ZW0ge1xuICBwdWJsaWMgc3VwcG9ydHNTeW5jaCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHB1YmxpYyByZW5hbWUob2xkUGF0aDogc3RyaW5nLCBuZXdQYXRoOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRyeSB7XG4gICAgICB0aGlzLnJlbmFtZVN5bmMob2xkUGF0aCwgbmV3UGF0aCk7XG4gICAgICBjYigpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNiKGUpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBzdGF0KHA6IHN0cmluZywgaXNMc3RhdDogYm9vbGVhbiwgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgdHJ5IHtcbiAgICAgIGNiKG51bGwsIHRoaXMuc3RhdFN5bmMocCwgaXNMc3RhdCkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNiKGUpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBvcGVuKHA6IHN0cmluZywgZmxhZ3M6IEZpbGVGbGFnLCBtb2RlOiBudW1iZXIsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRyeSB7XG4gICAgICBjYihudWxsLCB0aGlzLm9wZW5TeW5jKHAsIGZsYWdzLCBtb2RlKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY2IoZSk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHVubGluayhwOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRyeSB7XG4gICAgICB0aGlzLnVubGlua1N5bmMocCk7XG4gICAgICBjYigpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNiKGUpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBybWRpcihwOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRyeSB7XG4gICAgICB0aGlzLnJtZGlyU3luYyhwKTtcbiAgICAgIGNiKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY2IoZSk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIG1rZGlyKHA6IHN0cmluZywgbW9kZTogbnVtYmVyLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgdGhpcy5ta2RpclN5bmMocCwgbW9kZSk7XG4gICAgICBjYigpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNiKGUpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyByZWFkZGlyKHA6IHN0cmluZywgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgdHJ5IHtcbiAgICAgIGNiKG51bGwsIHRoaXMucmVhZGRpclN5bmMocCkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNiKGUpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBjaG1vZChwOiBzdHJpbmcsIGlzTGNobW9kOiBib29sZWFuLCBtb2RlOiBudW1iZXIsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRyeSB7XG4gICAgICB0aGlzLmNobW9kU3luYyhwLCBpc0xjaG1vZCwgbW9kZSk7XG4gICAgICBjYigpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNiKGUpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBjaG93bihwOiBzdHJpbmcsIGlzTGNob3duOiBib29sZWFuLCB1aWQ6IG51bWJlciwgZ2lkOiBudW1iZXIsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRyeSB7XG4gICAgICB0aGlzLmNob3duU3luYyhwLCBpc0xjaG93biwgdWlkLCBnaWQpO1xuICAgICAgY2IoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjYihlKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgdXRpbWVzKHA6IHN0cmluZywgYXRpbWU6IERhdGUsIG10aW1lOiBEYXRlLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgdGhpcy51dGltZXNTeW5jKHAsIGF0aW1lLCBtdGltZSk7XG4gICAgICBjYigpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNiKGUpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBsaW5rKHNyY3BhdGg6IHN0cmluZywgZHN0cGF0aDogc3RyaW5nLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgdGhpcy5saW5rU3luYyhzcmNwYXRoLCBkc3RwYXRoKTtcbiAgICAgIGNiKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY2IoZSk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHN5bWxpbmsoc3JjcGF0aDogc3RyaW5nLCBkc3RwYXRoOiBzdHJpbmcsIHR5cGU6IHN0cmluZywgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuc3ltbGlua1N5bmMoc3JjcGF0aCwgZHN0cGF0aCwgdHlwZSk7XG4gICAgICBjYigpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNiKGUpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyByZWFkbGluayhwOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRyeSB7XG4gICAgICBjYihudWxsLCB0aGlzLnJlYWRsaW5rU3luYyhwKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY2IoZSk7XG4gICAgfVxuICB9XG59XG4iXX0=