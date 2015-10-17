var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var preload_file = require('../generic/preload_file');
var file_system = require('../core/file_system');
var api_error = require('../core/api_error');
var file_flag = require('../core/file_flag');
var node_fs_stats = require('../core/node_fs_stats');
var buffer = require('../core/buffer');
var browserfs = require('../core/browserfs');
var path = require('../core/node_path');
var global = require('../core/global');
var async = require('async');
var Buffer = buffer.Buffer;
var Stats = node_fs_stats.Stats;
var FileType = node_fs_stats.FileType;
var ApiError = api_error.ApiError;
var ErrorCode = api_error.ErrorCode;
var ActionType = file_flag.ActionType;
var _getFS = global.webkitRequestFileSystem || global.requestFileSystem || null;
function _requestQuota(type, size, success, errorCallback) {
    if (typeof navigator['webkitPersistentStorage'] !== 'undefined') {
        switch (type) {
            case global.PERSISTENT:
                navigator.webkitPersistentStorage.requestQuota(size, success, errorCallback);
                break;
            case global.TEMPORARY:
                navigator.webkitTemporaryStorage.requestQuota(size, success, errorCallback);
                break;
            default:
                errorCallback(new TypeError("Invalid storage type: " + type));
                break;
        }
    }
    else {
        global.webkitStorageInfo.requestQuota(type, size, success, errorCallback);
    }
}
function _toArray(list) {
    return Array.prototype.slice.call(list || [], 0);
}
var HTML5FSFile = (function (_super) {
    __extends(HTML5FSFile, _super);
    function HTML5FSFile(_fs, _path, _flag, _stat, contents) {
        _super.call(this, _fs, _path, _flag, _stat, contents);
    }
    HTML5FSFile.prototype.sync = function (cb) {
        var _this = this;
        if (this.isDirty()) {
            var opts = {
                create: false
            };
            var _fs = this._fs;
            var success = function (entry) {
                entry.createWriter(function (writer) {
                    var buffer = _this.getBuffer();
                    var blob = new Blob([buffer.toArrayBuffer()]);
                    var length = blob.size;
                    writer.onwriteend = function () {
                        writer.onwriteend = null;
                        writer.truncate(length);
                        _this.resetDirty();
                        cb();
                    };
                    writer.onerror = function (err) {
                        cb(_fs.convert(err));
                    };
                    writer.write(blob);
                });
            };
            var error = function (err) {
                cb(_fs.convert(err));
            };
            _fs.fs.root.getFile(this.getPath(), opts, success, error);
        }
        else {
            cb();
        }
    };
    HTML5FSFile.prototype.close = function (cb) {
        this.sync(cb);
    };
    return HTML5FSFile;
})(preload_file.PreloadFile);
exports.HTML5FSFile = HTML5FSFile;
var HTML5FS = (function (_super) {
    __extends(HTML5FS, _super);
    function HTML5FS(size, type) {
        _super.call(this);
        this.size = size != null ? size : 5;
        this.type = type != null ? type : global.PERSISTENT;
        var kb = 1024;
        var mb = kb * kb;
        this.size *= mb;
    }
    HTML5FS.prototype.getName = function () {
        return 'HTML5 FileSystem';
    };
    HTML5FS.isAvailable = function () {
        return _getFS != null;
    };
    HTML5FS.prototype.isReadOnly = function () {
        return false;
    };
    HTML5FS.prototype.supportsSymlinks = function () {
        return false;
    };
    HTML5FS.prototype.supportsProps = function () {
        return false;
    };
    HTML5FS.prototype.supportsSynch = function () {
        return false;
    };
    HTML5FS.prototype.convert = function (err, message) {
        if (message === void 0) { message = ""; }
        switch (err.name) {
            case 'QuotaExceededError':
                return new ApiError(ErrorCode.ENOSPC, message);
            case 'NotFoundError':
                return new ApiError(ErrorCode.ENOENT, message);
            case 'SecurityError':
                return new ApiError(ErrorCode.EACCES, message);
            case 'InvalidModificationError':
                return new ApiError(ErrorCode.EPERM, message);
            case 'SyntaxError':
            case 'TypeMismatchError':
                return new ApiError(ErrorCode.EINVAL, message);
            default:
                return new ApiError(ErrorCode.EINVAL, message);
        }
    };
    HTML5FS.prototype.convertErrorEvent = function (err, message) {
        if (message === void 0) { message = ""; }
        return new ApiError(ErrorCode.ENOENT, err.message + "; " + message);
    };
    HTML5FS.prototype.allocate = function (cb) {
        var _this = this;
        if (cb === void 0) { cb = function () { }; }
        var success = function (fs) {
            _this.fs = fs;
            cb();
        };
        var error = function (err) {
            cb(_this.convert(err));
        };
        if (this.type === global.PERSISTENT) {
            _requestQuota(this.type, this.size, function (granted) {
                _getFS(_this.type, granted, success, error);
            }, error);
        }
        else {
            _getFS(this.type, this.size, success, error);
        }
    };
    HTML5FS.prototype.empty = function (mainCb) {
        var _this = this;
        this._readdir('/', function (err, entries) {
            if (err) {
                console.error('Failed to empty FS');
                mainCb(err);
            }
            else {
                var finished = function (er) {
                    if (err) {
                        console.error("Failed to empty FS");
                        mainCb(err);
                    }
                    else {
                        mainCb();
                    }
                };
                var deleteEntry = function (entry, cb) {
                    var succ = function () {
                        cb();
                    };
                    var error = function (err) {
                        cb(_this.convert(err, entry.fullPath));
                    };
                    if (entry.isFile) {
                        entry.remove(succ, error);
                    }
                    else {
                        entry.removeRecursively(succ, error);
                    }
                };
                async.each(entries, deleteEntry, finished);
            }
        });
    };
    HTML5FS.prototype.rename = function (oldPath, newPath, cb) {
        var _this = this;
        var semaphore = 2, successCount = 0, root = this.fs.root, error = function (err) {
            if (--semaphore === 0) {
                cb(_this.convert(err, "Failed to rename " + oldPath + " to " + newPath + "."));
            }
        }, success = function (file) {
            if (++successCount === 2) {
                console.error("Something was identified as both a file and a directory. This should never happen.");
                return;
            }
            if (oldPath === newPath) {
                return cb();
            }
            root.getDirectory(path.dirname(newPath), {}, function (parentDir) {
                file.moveTo(parentDir, path.basename(newPath), function (entry) { cb(); }, function (err) {
                    if (file.isDirectory) {
                        _this.unlink(newPath, function (e) {
                            if (e) {
                                error(err);
                            }
                            else {
                                _this.rename(oldPath, newPath, cb);
                            }
                        });
                    }
                    else {
                        error(err);
                    }
                });
            }, error);
        };
        root.getFile(oldPath, {}, success, error);
        root.getDirectory(oldPath, {}, success, error);
    };
    HTML5FS.prototype.stat = function (path, isLstat, cb) {
        var _this = this;
        var opts = {
            create: false
        };
        var loadAsFile = function (entry) {
            var fileFromEntry = function (file) {
                var stat = new Stats(FileType.FILE, file.size);
                cb(null, stat);
            };
            entry.file(fileFromEntry, failedToLoad);
        };
        var loadAsDir = function (dir) {
            var size = 4096;
            var stat = new Stats(FileType.DIRECTORY, size);
            cb(null, stat);
        };
        var failedToLoad = function (err) {
            cb(_this.convert(err, path));
        };
        var failedToLoadAsFile = function () {
            _this.fs.root.getDirectory(path, opts, loadAsDir, failedToLoad);
        };
        this.fs.root.getFile(path, opts, loadAsFile, failedToLoadAsFile);
    };
    HTML5FS.prototype.open = function (path, flags, mode, cb) {
        var _this = this;
        var opts = {
            create: flags.pathNotExistsAction() === ActionType.CREATE_FILE,
            exclusive: flags.isExclusive()
        };
        var error = function (err) {
            cb(_this.convertErrorEvent(err, path));
        };
        var error2 = function (err) {
            cb(_this.convert(err, path));
        };
        var success = function (entry) {
            var success2 = function (file) {
                var reader = new FileReader();
                reader.onloadend = function (event) {
                    var bfs_file = _this._makeFile(path, flags, file, reader.result);
                    cb(null, bfs_file);
                };
                reader.onerror = error;
                reader.readAsArrayBuffer(file);
            };
            entry.file(success2, error2);
        };
        this.fs.root.getFile(path, opts, success, error);
    };
    HTML5FS.prototype._statType = function (stat) {
        return stat.isFile ? FileType.FILE : FileType.DIRECTORY;
    };
    HTML5FS.prototype._makeFile = function (path, flag, stat, data) {
        if (data === void 0) { data = new ArrayBuffer(0); }
        var stats = new Stats(FileType.FILE, stat.size);
        var buffer = new Buffer(data);
        return new HTML5FSFile(this, path, flag, stats, buffer);
    };
    HTML5FS.prototype._remove = function (path, cb, isFile) {
        var _this = this;
        var success = function (entry) {
            var succ = function () {
                cb();
            };
            var err = function (err) {
                cb(_this.convert(err, path));
            };
            entry.remove(succ, err);
        };
        var error = function (err) {
            cb(_this.convert(err, path));
        };
        var opts = {
            create: false
        };
        if (isFile) {
            this.fs.root.getFile(path, opts, success, error);
        }
        else {
            this.fs.root.getDirectory(path, opts, success, error);
        }
    };
    HTML5FS.prototype.unlink = function (path, cb) {
        this._remove(path, cb, true);
    };
    HTML5FS.prototype.rmdir = function (path, cb) {
        this._remove(path, cb, false);
    };
    HTML5FS.prototype.mkdir = function (path, mode, cb) {
        var _this = this;
        var opts = {
            create: true,
            exclusive: true
        };
        var success = function (dir) {
            cb();
        };
        var error = function (err) {
            cb(_this.convert(err, path));
        };
        this.fs.root.getDirectory(path, opts, success, error);
    };
    HTML5FS.prototype._readdir = function (path, cb) {
        var _this = this;
        this.fs.root.getDirectory(path, { create: false }, function (dirEntry) {
            var reader = dirEntry.createReader();
            var entries = [];
            var error = function (err) {
                cb(_this.convert(err, path));
            };
            var readEntries = function () {
                reader.readEntries((function (results) {
                    if (results.length) {
                        entries = entries.concat(_toArray(results));
                        readEntries();
                    }
                    else {
                        cb(null, entries);
                    }
                }), error);
            };
            readEntries();
        });
    };
    HTML5FS.prototype.readdir = function (path, cb) {
        this._readdir(path, function (e, entries) {
            if (e != null) {
                return cb(e);
            }
            var rv = [];
            for (var i = 0; i < entries.length; i++) {
                rv.push(entries[i].name);
            }
            cb(null, rv);
        });
    };
    return HTML5FS;
})(file_system.BaseFileSystem);
exports.HTML5FS = HTML5FS;
browserfs.registerFileSystem('HTML5FS', HTML5FS);
//# sourceMappingURL=html5fs.js.map