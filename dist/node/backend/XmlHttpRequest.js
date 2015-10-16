var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var file_system = require('../core/file_system');
var file_index = require('../generic/file_index');
var buffer = require('../core/buffer');
var api_error = require('../core/api_error');
var file_flag = require('../core/file_flag');
var preload_file = require('../generic/preload_file');
var browserfs = require('../core/browserfs');
var xhr = require('../generic/xhr');
var Buffer = buffer.Buffer;
var ApiError = api_error.ApiError;
var ErrorCode = api_error.ErrorCode;
var FileFlag = file_flag.FileFlag;
var ActionType = file_flag.ActionType;
var XmlHttpRequest = (function (_super) {
    __extends(XmlHttpRequest, _super);
    function XmlHttpRequest(listing_url, prefix_url) {
        if (prefix_url === void 0) { prefix_url = ''; }
        _super.call(this);
        if (listing_url == null) {
            listing_url = 'index.json';
        }
        if (prefix_url.length > 0 && prefix_url.charAt(prefix_url.length - 1) !== '/') {
            prefix_url = prefix_url + '/';
        }
        this.prefix_url = prefix_url;
        var listing = this._requestFileSync(listing_url, 'json');
        if (listing == null) {
            throw new Error("Unable to find listing at URL: " + listing_url);
        }
        this._index = file_index.FileIndex.from_listing(listing);
    }
    XmlHttpRequest.prototype.empty = function () {
        this._index.fileIterator(function (file) {
            file.file_data = null;
        });
    };
    XmlHttpRequest.prototype.getXhrPath = function (filePath) {
        if (filePath.charAt(0) === '/') {
            filePath = filePath.slice(1);
        }
        return this.prefix_url + filePath;
    };
    XmlHttpRequest.prototype._requestFileSizeAsync = function (path, cb) {
        xhr.getFileSizeAsync(this.getXhrPath(path), cb);
    };
    XmlHttpRequest.prototype._requestFileSizeSync = function (path) {
        return xhr.getFileSizeSync(this.getXhrPath(path));
    };
    XmlHttpRequest.prototype._requestFileAsync = function (p, type, cb) {
        xhr.asyncDownloadFile(this.getXhrPath(p), type, cb);
    };
    XmlHttpRequest.prototype._requestFileSync = function (p, type) {
        return xhr.syncDownloadFile(this.getXhrPath(p), type);
    };
    XmlHttpRequest.prototype.getName = function () {
        return 'XmlHttpRequest';
    };
    XmlHttpRequest.isAvailable = function () {
        return typeof XMLHttpRequest !== "undefined" && XMLHttpRequest !== null;
    };
    XmlHttpRequest.prototype.diskSpace = function (path, cb) {
        cb(0, 0);
    };
    XmlHttpRequest.prototype.isReadOnly = function () {
        return true;
    };
    XmlHttpRequest.prototype.supportsLinks = function () {
        return false;
    };
    XmlHttpRequest.prototype.supportsProps = function () {
        return false;
    };
    XmlHttpRequest.prototype.supportsSynch = function () {
        return true;
    };
    XmlHttpRequest.prototype.preloadFile = function (path, buffer) {
        var inode = this._index.getInode(path);
        if (inode === null) {
            throw ApiError.ENOENT(path);
        }
        var stats = inode.getData();
        stats.size = buffer.length;
        stats.file_data = buffer;
    };
    XmlHttpRequest.prototype.stat = function (path, isLstat, cb) {
        var inode = this._index.getInode(path);
        if (inode === null) {
            return cb(ApiError.ENOENT(path));
        }
        var stats;
        if (inode.isFile()) {
            stats = inode.getData();
            if (stats.size < 0) {
                this._requestFileSizeAsync(path, function (e, size) {
                    if (e) {
                        return cb(e);
                    }
                    stats.size = size;
                    cb(null, stats.clone());
                });
            }
            else {
                cb(null, stats.clone());
            }
        }
        else {
            stats = inode.getStats();
            cb(null, stats);
        }
    };
    XmlHttpRequest.prototype.statSync = function (path, isLstat) {
        var inode = this._index.getInode(path);
        if (inode === null) {
            throw ApiError.ENOENT(path);
        }
        var stats;
        if (inode.isFile()) {
            stats = inode.getData();
            if (stats.size < 0) {
                stats.size = this._requestFileSizeSync(path);
            }
        }
        else {
            stats = inode.getStats();
        }
        return stats;
    };
    XmlHttpRequest.prototype.open = function (path, flags, mode, cb) {
        if (flags.isWriteable()) {
            return cb(new ApiError(ErrorCode.EPERM, path));
        }
        var _this = this;
        var inode = this._index.getInode(path);
        if (inode === null) {
            return cb(ApiError.ENOENT(path));
        }
        if (inode.isDir()) {
            return cb(ApiError.EISDIR(path));
        }
        var stats = inode.getData();
        switch (flags.pathExistsAction()) {
            case ActionType.THROW_EXCEPTION:
            case ActionType.TRUNCATE_FILE:
                return cb(ApiError.EEXIST(path));
            case ActionType.NOP:
                if (stats.file_data != null) {
                    return cb(null, new preload_file.NoSyncFile(_this, path, flags, stats.clone(), stats.file_data));
                }
                this._requestFileAsync(path, 'buffer', function (err, buffer) {
                    if (err) {
                        return cb(err);
                    }
                    stats.size = buffer.length;
                    stats.file_data = buffer;
                    return cb(null, new preload_file.NoSyncFile(_this, path, flags, stats.clone(), buffer));
                });
                break;
            default:
                return cb(new ApiError(ErrorCode.EINVAL, 'Invalid FileMode object.'));
        }
    };
    XmlHttpRequest.prototype.openSync = function (path, flags, mode) {
        if (flags.isWriteable()) {
            throw new ApiError(ErrorCode.EPERM, path);
        }
        var inode = this._index.getInode(path);
        if (inode === null) {
            throw ApiError.ENOENT(path);
        }
        if (inode.isDir()) {
            throw ApiError.EISDIR(path);
        }
        var stats = inode.getData();
        switch (flags.pathExistsAction()) {
            case ActionType.THROW_EXCEPTION:
            case ActionType.TRUNCATE_FILE:
                throw ApiError.EEXIST(path);
            case ActionType.NOP:
                if (stats.file_data != null) {
                    return new preload_file.NoSyncFile(this, path, flags, stats.clone(), stats.file_data);
                }
                var buffer = this._requestFileSync(path, 'buffer');
                stats.size = buffer.length;
                stats.file_data = buffer;
                return new preload_file.NoSyncFile(this, path, flags, stats.clone(), buffer);
            default:
                throw new ApiError(ErrorCode.EINVAL, 'Invalid FileMode object.');
        }
    };
    XmlHttpRequest.prototype.readdir = function (path, cb) {
        try {
            cb(null, this.readdirSync(path));
        }
        catch (e) {
            cb(e);
        }
    };
    XmlHttpRequest.prototype.readdirSync = function (path) {
        var inode = this._index.getInode(path);
        if (inode === null) {
            throw ApiError.ENOENT(path);
        }
        else if (inode.isFile()) {
            throw ApiError.ENOTDIR(path);
        }
        return inode.getListing();
    };
    XmlHttpRequest.prototype.readFile = function (fname, encoding, flag, cb) {
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
            var fdCast = fd;
            var fdBuff = fdCast.getBuffer();
            if (encoding === null) {
                if (fdBuff.length > 0) {
                    return cb(err, fdBuff.sliceCopy());
                }
                else {
                    return cb(err, new buffer.Buffer(0));
                }
            }
            try {
                cb(null, fdBuff.toString(encoding));
            }
            catch (e) {
                cb(e);
            }
        });
    };
    XmlHttpRequest.prototype.readFileSync = function (fname, encoding, flag) {
        var fd = this.openSync(fname, flag, 0x1a4);
        try {
            var fdCast = fd;
            var fdBuff = fdCast.getBuffer();
            if (encoding === null) {
                if (fdBuff.length > 0) {
                    return fdBuff.sliceCopy();
                }
                else {
                    return new buffer.Buffer(0);
                }
            }
            return fdBuff.toString(encoding);
        }
        finally {
            fd.closeSync();
        }
    };
    return XmlHttpRequest;
})(file_system.BaseFileSystem);
exports.XmlHttpRequest = XmlHttpRequest;
browserfs.registerFileSystem('XmlHttpRequest', XmlHttpRequest);
//# sourceMappingURL=XmlHttpRequest.js.map