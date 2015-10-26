var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var file_system = require('../core/file_system');
var buffer_1 = require('../core/buffer');
var api_error_1 = require('../core/api_error');
var file_flag_1 = require('../core/file_flag');
var preload_file = require('../generic/preload_file');
var path = require('../core/node_path');
var deletionLogPath = '/.deletedFiles.log';
function makeModeWritable(mode) {
    return 0x92 | mode;
}
var OverlayFile = (function (_super) {
    __extends(OverlayFile, _super);
    function OverlayFile(fs, path, flag, stats, data) {
        _super.call(this, fs, path, flag, stats, data);
    }
    OverlayFile.prototype.syncSync = function () {
        if (this.isDirty()) {
            this._fs._syncSync(this);
            this.resetDirty();
        }
    };
    OverlayFile.prototype.closeSync = function () {
        this.syncSync();
    };
    return OverlayFile;
})(preload_file.PreloadFile);
var OverlayFS = (function (_super) {
    __extends(OverlayFS, _super);
    function OverlayFS(writable, readable) {
        _super.call(this);
        this._isInitialized = false;
        this._deletedFiles = {};
        this._deleteLog = null;
        this._writable = writable;
        this._readable = readable;
        if (this._writable.isReadOnly()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Writable file system must be writable.");
        }
        if (!this._writable.supportsSynch() || !this._readable.supportsSynch()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "OverlayFS currently only operates on synchronous file systems.");
        }
    }
    OverlayFS.prototype.getOverlayedFileSystems = function () {
        return {
            readable: this._readable,
            writable: this._writable
        };
    };
    OverlayFS.prototype.createParentDirectories = function (p) {
        var _this = this;
        var parent = path.dirname(p), toCreate = [];
        while (!this._writable.existsSync(parent)) {
            toCreate.push(parent);
            parent = path.dirname(parent);
        }
        toCreate = toCreate.reverse();
        toCreate.forEach(function (p) {
            _this._writable.mkdirSync(p, _this.statSync(p, false).mode);
        });
    };
    OverlayFS.isAvailable = function () {
        return true;
    };
    OverlayFS.prototype._syncSync = function (file) {
        this.createParentDirectories(file.getPath());
        this._writable.writeFileSync(file.getPath(), file.getBuffer(), null, file_flag_1.FileFlag.getFileFlag('w'), file.getStats().mode);
    };
    OverlayFS.prototype.getName = function () {
        return "OverlayFS";
    };
    OverlayFS.prototype.initialize = function (cb) {
        var _this = this;
        if (!this._isInitialized) {
            this._writable.readFile(deletionLogPath, 'utf8', file_flag_1.FileFlag.getFileFlag('r'), function (err, data) {
                if (err) {
                    if (err.type !== api_error_1.ErrorCode.ENOENT) {
                        return cb(err);
                    }
                }
                else {
                    data.split('\n').forEach(function (path) {
                        _this._deletedFiles[path.slice(1)] = path.slice(0, 1) === 'd';
                    });
                }
                _this._writable.open(deletionLogPath, file_flag_1.FileFlag.getFileFlag('a'), 0x1a4, function (err, fd) {
                    if (err) {
                        cb(err);
                    }
                    else {
                        _this._deleteLog = fd;
                        cb();
                    }
                });
            });
        }
        else {
            cb();
        }
    };
    OverlayFS.prototype.isReadOnly = function () { return false; };
    OverlayFS.prototype.supportsSynch = function () { return true; };
    OverlayFS.prototype.supportsLinks = function () { return false; };
    OverlayFS.prototype.supportsProps = function () { return this._readable.supportsProps() && this._writable.supportsProps(); };
    OverlayFS.prototype.deletePath = function (p) {
        this._deletedFiles[p] = true;
        var buff = new buffer_1.Buffer("d" + p + "\n");
        this._deleteLog.writeSync(buff, 0, buff.length, null);
        this._deleteLog.syncSync();
    };
    OverlayFS.prototype.undeletePath = function (p) {
        if (this._deletedFiles[p]) {
            this._deletedFiles[p] = false;
            var buff = new buffer_1.Buffer("u" + p);
            this._deleteLog.writeSync(buff, 0, buff.length, null);
            this._deleteLog.syncSync();
        }
    };
    OverlayFS.prototype.renameSync = function (oldPath, newPath) {
        var _this = this;
        var oldStats = this.statSync(oldPath, false);
        if (oldStats.isDirectory()) {
            if (oldPath === newPath) {
                return;
            }
            var mode = 0x1ff;
            if (this.existsSync(newPath)) {
                var stats = this.statSync(newPath, false), mode = stats.mode;
                if (stats.isDirectory()) {
                    if (this.readdirSync(newPath).length > 0) {
                        throw api_error_1.ApiError.ENOTEMPTY(newPath);
                    }
                }
                else {
                    throw api_error_1.ApiError.ENOTDIR(newPath);
                }
            }
            if (this._writable.existsSync(oldPath)) {
                this._writable.renameSync(oldPath, newPath);
            }
            else if (!this._writable.existsSync(newPath)) {
                this._writable.mkdirSync(newPath, mode);
            }
            if (this._readable.existsSync(oldPath)) {
                this._readable.readdirSync(oldPath).forEach(function (name) {
                    _this.renameSync(path.resolve(oldPath, name), path.resolve(newPath, name));
                });
            }
        }
        else {
            if (this.existsSync(newPath) && this.statSync(newPath, false).isDirectory()) {
                throw api_error_1.ApiError.EISDIR(newPath);
            }
            this.writeFileSync(newPath, this.readFileSync(oldPath, null, file_flag_1.FileFlag.getFileFlag('r')), null, file_flag_1.FileFlag.getFileFlag('w'), oldStats.mode);
        }
        if (oldPath !== newPath && this.existsSync(oldPath)) {
            this.unlinkSync(oldPath);
        }
    };
    OverlayFS.prototype.statSync = function (p, isLstat) {
        try {
            return this._writable.statSync(p, isLstat);
        }
        catch (e) {
            if (this._deletedFiles[p]) {
                throw api_error_1.ApiError.ENOENT(p);
            }
            var oldStat = this._readable.statSync(p, isLstat).clone();
            oldStat.mode = makeModeWritable(oldStat.mode);
            return oldStat;
        }
    };
    OverlayFS.prototype.openSync = function (p, flag, mode) {
        if (this.existsSync(p)) {
            switch (flag.pathExistsAction()) {
                case file_flag_1.ActionType.TRUNCATE_FILE:
                    this.createParentDirectories(p);
                    return this._writable.openSync(p, flag, mode);
                case file_flag_1.ActionType.NOP:
                    if (this._writable.existsSync(p)) {
                        return this._writable.openSync(p, flag, mode);
                    }
                    else {
                        var stats = this._readable.statSync(p, false).clone();
                        stats.mode = mode;
                        return new OverlayFile(this, p, flag, stats, this._readable.readFileSync(p, null, file_flag_1.FileFlag.getFileFlag('r')));
                    }
                default:
                    throw api_error_1.ApiError.EEXIST(p);
            }
        }
        else {
            switch (flag.pathNotExistsAction()) {
                case file_flag_1.ActionType.CREATE_FILE:
                    this.createParentDirectories(p);
                    return this._writable.openSync(p, flag, mode);
                default:
                    throw api_error_1.ApiError.ENOENT(p);
            }
        }
    };
    OverlayFS.prototype.unlinkSync = function (p) {
        if (this.existsSync(p)) {
            if (this._writable.existsSync(p)) {
                this._writable.unlinkSync(p);
            }
            if (this.existsSync(p)) {
                this.deletePath(p);
            }
        }
        else {
            throw api_error_1.ApiError.ENOENT(p);
        }
    };
    OverlayFS.prototype.rmdirSync = function (p) {
        if (this.existsSync(p)) {
            if (this._writable.existsSync(p)) {
                this._writable.rmdirSync(p);
            }
            if (this.existsSync(p)) {
                if (this.readdirSync(p).length > 0) {
                    throw api_error_1.ApiError.ENOTEMPTY(p);
                }
                else {
                    this.deletePath(p);
                }
            }
        }
        else {
            throw api_error_1.ApiError.ENOENT(p);
        }
    };
    OverlayFS.prototype.mkdirSync = function (p, mode) {
        if (this.existsSync(p)) {
            throw api_error_1.ApiError.EEXIST(p);
        }
        else {
            this.createParentDirectories(p);
            this._writable.mkdirSync(p, mode);
        }
    };
    OverlayFS.prototype.readdirSync = function (p) {
        var _this = this;
        var dirStats = this.statSync(p, false);
        if (!dirStats.isDirectory()) {
            throw api_error_1.ApiError.ENOTDIR(p);
        }
        var contents = [];
        try {
            contents = contents.concat(this._writable.readdirSync(p));
        }
        catch (e) {
        }
        try {
            contents = contents.concat(this._readable.readdirSync(p));
        }
        catch (e) {
        }
        var seenMap = {};
        return contents.filter(function (fileP) {
            var result = seenMap[fileP] === undefined && _this._deletedFiles[p + "/" + fileP] !== true;
            seenMap[fileP] = true;
            return result;
        });
    };
    OverlayFS.prototype.existsSync = function (p) {
        return this._writable.existsSync(p) || (this._readable.existsSync(p) && this._deletedFiles[p] !== true);
    };
    OverlayFS.prototype.chmodSync = function (p, isLchmod, mode) {
        var _this = this;
        this.operateOnWritable(p, function () {
            _this._writable.chmodSync(p, isLchmod, mode);
        });
    };
    OverlayFS.prototype.chownSync = function (p, isLchown, uid, gid) {
        var _this = this;
        this.operateOnWritable(p, function () {
            _this._writable.chownSync(p, isLchown, uid, gid);
        });
    };
    OverlayFS.prototype.utimesSync = function (p, atime, mtime) {
        var _this = this;
        this.operateOnWritable(p, function () {
            _this._writable.utimesSync(p, atime, mtime);
        });
    };
    OverlayFS.prototype.operateOnWritable = function (p, f) {
        if (this.existsSync(p)) {
            if (!this._writable.existsSync(p)) {
                this.copyToWritable(p);
            }
            f();
        }
        else {
            throw api_error_1.ApiError.ENOENT(p);
        }
    };
    OverlayFS.prototype.copyToWritable = function (p) {
        var pStats = this.statSync(p, false);
        if (pStats.isDirectory()) {
            this._writable.mkdirSync(p, pStats.mode);
        }
        else {
            this.writeFileSync(p, this._readable.readFileSync(p, null, file_flag_1.FileFlag.getFileFlag('r')), null, file_flag_1.FileFlag.getFileFlag('w'), this.statSync(p, false).mode);
        }
    };
    return OverlayFS;
})(file_system.SynchronousFileSystem);
exports.__esModule = true;
exports["default"] = OverlayFS;
//# sourceMappingURL=OverlayFS.js.map