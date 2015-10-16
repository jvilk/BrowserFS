var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var file_system = require('../core/file_system');
var file_flag = require('../core/file_flag');
var preload_file = require('../generic/preload_file');
var browserfs = require('../core/browserfs');
var MirrorFile = (function (_super) {
    __extends(MirrorFile, _super);
    function MirrorFile(fs, path, flag, stat, data) {
        _super.call(this, fs, path, flag, stat, data);
    }
    MirrorFile.prototype.syncSync = function () {
        if (this.isDirty()) {
            this._fs._syncSync(this);
            this.resetDirty();
        }
    };
    MirrorFile.prototype.closeSync = function () {
        this.syncSync();
    };
    return MirrorFile;
})(preload_file.PreloadFile);
var AsyncMirrorFS = (function (_super) {
    __extends(AsyncMirrorFS, _super);
    function AsyncMirrorFS(sync, async) {
        _super.call(this);
        this._queue = [];
        this._queueRunning = false;
        this._isInitialized = false;
        this._sync = sync;
        this._async = async;
        if (!sync.supportsSynch()) {
            throw new Error("Expected synchronous storage.");
        }
        if (async.supportsSynch()) {
            throw new Error("Expected asynchronous storage.");
        }
    }
    AsyncMirrorFS.prototype.getName = function () {
        return "AsyncMirror";
    };
    AsyncMirrorFS.isAvailable = function () {
        return true;
    };
    AsyncMirrorFS.prototype._syncSync = function (fd) {
        this._sync.writeFileSync(fd.getPath(), fd.getBuffer(), null, file_flag.FileFlag.getFileFlag('w'), fd.getStats().mode);
        this.enqueueOp({
            apiMethod: 'writeFile',
            arguments: [fd.getPath(), fd.getBuffer(), null, fd.getFlag(), fd.getStats().mode]
        });
    };
    AsyncMirrorFS.prototype.initialize = function (finalCb) {
        var _this = this;
        if (!this._isInitialized) {
            var copyDirectory = function (p, mode, cb) {
                if (p !== '/') {
                    _this._sync.mkdirSync(p, mode);
                }
                _this._async.readdir(p, function (err, files) {
                    if (err) {
                        cb(err);
                    }
                    else {
                        var i = 0;
                        function copyNextFile(err) {
                            if (err) {
                                cb(err);
                            }
                            else if (i < files.length) {
                                copyItem(p + "/" + files[i], copyNextFile);
                                i++;
                            }
                            else {
                                cb();
                            }
                        }
                        copyNextFile();
                    }
                });
            }, copyFile = function (p, mode, cb) {
                _this._async.readFile(p, null, file_flag.FileFlag.getFileFlag('r'), function (err, data) {
                    if (err) {
                        cb(err);
                    }
                    else {
                        try {
                            _this._sync.writeFileSync(p, data, null, file_flag.FileFlag.getFileFlag('w'), mode);
                        }
                        catch (e) {
                            err = e;
                        }
                        finally {
                            cb(err);
                        }
                    }
                });
            }, copyItem = function (p, cb) {
                _this._async.stat(p, false, function (err, stats) {
                    if (err) {
                        cb(err);
                    }
                    else if (stats.isDirectory()) {
                        copyDirectory(p, stats.mode, cb);
                    }
                    else {
                        copyFile(p, stats.mode, cb);
                    }
                });
            };
            copyDirectory('/', 0, function (err) {
                if (err) {
                    finalCb(err);
                }
                else {
                    _this._isInitialized = true;
                    finalCb();
                }
            });
        }
        else {
            finalCb();
        }
    };
    AsyncMirrorFS.prototype.isReadOnly = function () { return false; };
    AsyncMirrorFS.prototype.supportsSynch = function () { return true; };
    AsyncMirrorFS.prototype.supportsLinks = function () { return false; };
    AsyncMirrorFS.prototype.supportsProps = function () { return this._sync.supportsProps() && this._async.supportsProps(); };
    AsyncMirrorFS.prototype.enqueueOp = function (op) {
        var _this = this;
        this._queue.push(op);
        if (!this._queueRunning) {
            this._queueRunning = true;
            var doNextOp = function (err) {
                if (err) {
                    console.error("WARNING: File system has desynchronized. Received following error: " + err + "\n$");
                }
                if (_this._queue.length > 0) {
                    var op = _this._queue.shift(), args = op.arguments;
                    args.push(doNextOp);
                    _this._async[op.apiMethod].apply(_this._async, args);
                }
                else {
                    _this._queueRunning = false;
                }
            };
            doNextOp();
        }
    };
    AsyncMirrorFS.prototype.renameSync = function (oldPath, newPath) {
        this._sync.renameSync(oldPath, newPath);
        this.enqueueOp({
            apiMethod: 'rename',
            arguments: [oldPath, newPath]
        });
    };
    AsyncMirrorFS.prototype.statSync = function (p, isLstat) {
        return this._sync.statSync(p, isLstat);
    };
    AsyncMirrorFS.prototype.openSync = function (p, flag, mode) {
        var fd = this._sync.openSync(p, flag, mode);
        fd.closeSync();
        return new MirrorFile(this, p, flag, this._sync.statSync(p, false), this._sync.readFileSync(p, null, file_flag.FileFlag.getFileFlag('r')));
    };
    AsyncMirrorFS.prototype.unlinkSync = function (p) {
        this._sync.unlinkSync(p);
        this.enqueueOp({
            apiMethod: 'unlink',
            arguments: [p]
        });
    };
    AsyncMirrorFS.prototype.rmdirSync = function (p) {
        this._sync.rmdirSync(p);
        this.enqueueOp({
            apiMethod: 'rmdir',
            arguments: [p]
        });
    };
    AsyncMirrorFS.prototype.mkdirSync = function (p, mode) {
        this._sync.mkdirSync(p, mode);
        this.enqueueOp({
            apiMethod: 'mkdir',
            arguments: [p, mode]
        });
    };
    AsyncMirrorFS.prototype.readdirSync = function (p) {
        return this._sync.readdirSync(p);
    };
    AsyncMirrorFS.prototype.existsSync = function (p) {
        return this._sync.existsSync(p);
    };
    AsyncMirrorFS.prototype.chmodSync = function (p, isLchmod, mode) {
        this._sync.chmodSync(p, isLchmod, mode);
        this.enqueueOp({
            apiMethod: 'chmod',
            arguments: [p, isLchmod, mode]
        });
    };
    AsyncMirrorFS.prototype.chownSync = function (p, isLchown, uid, gid) {
        this._sync.chownSync(p, isLchown, uid, gid);
        this.enqueueOp({
            apiMethod: 'chown',
            arguments: [p, isLchown, uid, gid]
        });
    };
    AsyncMirrorFS.prototype.utimesSync = function (p, atime, mtime) {
        this._sync.utimesSync(p, atime, mtime);
        this.enqueueOp({
            apiMethod: 'utimes',
            arguments: [p, atime, mtime]
        });
    };
    return AsyncMirrorFS;
})(file_system.SynchronousFileSystem);
browserfs.registerFileSystem('AsyncMirrorFS', AsyncMirrorFS);
module.exports = AsyncMirrorFS;
//# sourceMappingURL=async_mirror.js.map