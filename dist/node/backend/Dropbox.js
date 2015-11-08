var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var preload_file = require('../generic/preload_file');
var file_system = require('../core/file_system');
var node_fs_stats_1 = require('../core/node_fs_stats');
var api_error_1 = require('../core/api_error');
var async = require('async');
var path = require('path');
var util_1 = require('../core/util');
var errorCodeLookup = null;
function constructErrorCodeLookup() {
    if (errorCodeLookup !== null) {
        return;
    }
    errorCodeLookup = {};
    errorCodeLookup[Dropbox.ApiError.NETWORK_ERROR] = api_error_1.ErrorCode.EIO;
    errorCodeLookup[Dropbox.ApiError.INVALID_PARAM] = api_error_1.ErrorCode.EINVAL;
    errorCodeLookup[Dropbox.ApiError.INVALID_TOKEN] = api_error_1.ErrorCode.EPERM;
    errorCodeLookup[Dropbox.ApiError.OAUTH_ERROR] = api_error_1.ErrorCode.EPERM;
    errorCodeLookup[Dropbox.ApiError.NOT_FOUND] = api_error_1.ErrorCode.ENOENT;
    errorCodeLookup[Dropbox.ApiError.INVALID_METHOD] = api_error_1.ErrorCode.EINVAL;
    errorCodeLookup[Dropbox.ApiError.NOT_ACCEPTABLE] = api_error_1.ErrorCode.EINVAL;
    errorCodeLookup[Dropbox.ApiError.CONFLICT] = api_error_1.ErrorCode.EINVAL;
    errorCodeLookup[Dropbox.ApiError.RATE_LIMITED] = api_error_1.ErrorCode.EBUSY;
    errorCodeLookup[Dropbox.ApiError.SERVER_ERROR] = api_error_1.ErrorCode.EBUSY;
    errorCodeLookup[Dropbox.ApiError.OVER_QUOTA] = api_error_1.ErrorCode.ENOSPC;
}
function isFileInfo(cache) {
    return cache && cache.stat.isFile;
}
function isDirInfo(cache) {
    return cache && cache.stat.isFolder;
}
function isArrayBuffer(ab) {
    return ab === null || ab === undefined || (typeof (ab) === 'object' && typeof (ab['byteLength']) === 'number');
}
var CachedDropboxClient = (function () {
    function CachedDropboxClient(client) {
        this._cache = {};
        this._client = client;
    }
    CachedDropboxClient.prototype.getCachedInfo = function (p) {
        return this._cache[p.toLowerCase()];
    };
    CachedDropboxClient.prototype.putCachedInfo = function (p, cache) {
        this._cache[p.toLowerCase()] = cache;
    };
    CachedDropboxClient.prototype.deleteCachedInfo = function (p) {
        delete this._cache[p.toLowerCase()];
    };
    CachedDropboxClient.prototype.getCachedDirInfo = function (p) {
        var info = this.getCachedInfo(p);
        if (isDirInfo(info)) {
            return info;
        }
        else {
            return null;
        }
    };
    CachedDropboxClient.prototype.getCachedFileInfo = function (p) {
        var info = this.getCachedInfo(p);
        if (isFileInfo(info)) {
            return info;
        }
        else {
            return null;
        }
    };
    CachedDropboxClient.prototype.updateCachedDirInfo = function (p, stat, contents) {
        if (contents === void 0) { contents = null; }
        var cachedInfo = this.getCachedInfo(p);
        if (stat.contentHash !== null && (cachedInfo === undefined || cachedInfo.stat.contentHash !== stat.contentHash)) {
            this.putCachedInfo(p, {
                stat: stat,
                contents: contents
            });
        }
    };
    CachedDropboxClient.prototype.updateCachedFileInfo = function (p, stat, contents) {
        if (contents === void 0) { contents = null; }
        var cachedInfo = this.getCachedInfo(p);
        if (stat.versionTag !== null && (cachedInfo === undefined || cachedInfo.stat.versionTag !== stat.versionTag)) {
            this.putCachedInfo(p, {
                stat: stat,
                contents: contents
            });
        }
    };
    CachedDropboxClient.prototype.updateCachedInfo = function (p, stat, contents) {
        if (contents === void 0) { contents = null; }
        if (stat.isFile && isArrayBuffer(contents)) {
            this.updateCachedFileInfo(p, stat, contents);
        }
        else if (stat.isFolder && Array.isArray(contents)) {
            this.updateCachedDirInfo(p, stat, contents);
        }
    };
    CachedDropboxClient.prototype.readdir = function (p, cb) {
        var _this = this;
        var cacheInfo = this.getCachedDirInfo(p);
        this._wrap(function (interceptCb) {
            if (cacheInfo !== null && cacheInfo.contents) {
                _this._client.readdir(p, {
                    contentHash: cacheInfo.stat.contentHash
                }, interceptCb);
            }
            else {
                _this._client.readdir(p, interceptCb);
            }
        }, function (err, filenames, stat, folderEntries) {
            if (err) {
                if (err.status === Dropbox.ApiError.NO_CONTENT && cacheInfo !== null) {
                    cb(null, cacheInfo.contents.slice(0));
                }
                else {
                    cb(err);
                }
            }
            else {
                _this.updateCachedDirInfo(p, stat, filenames.slice(0));
                folderEntries.forEach(function (entry) {
                    _this.updateCachedInfo(path.join(p, entry.name), entry);
                });
                cb(null, filenames);
            }
        });
    };
    CachedDropboxClient.prototype.remove = function (p, cb) {
        var _this = this;
        this._wrap(function (interceptCb) {
            _this._client.remove(p, interceptCb);
        }, function (err, stat) {
            if (!err) {
                _this.updateCachedInfo(p, stat);
            }
            cb(err);
        });
    };
    CachedDropboxClient.prototype.move = function (src, dest, cb) {
        var _this = this;
        this._wrap(function (interceptCb) {
            _this._client.move(src, dest, interceptCb);
        }, function (err, stat) {
            if (!err) {
                _this.deleteCachedInfo(src);
                _this.updateCachedInfo(dest, stat);
            }
            cb(err);
        });
    };
    CachedDropboxClient.prototype.stat = function (p, cb) {
        var _this = this;
        this._wrap(function (interceptCb) {
            _this._client.stat(p, interceptCb);
        }, function (err, stat) {
            if (!err) {
                _this.updateCachedInfo(p, stat);
            }
            cb(err, stat);
        });
    };
    CachedDropboxClient.prototype.readFile = function (p, cb) {
        var _this = this;
        var cacheInfo = this.getCachedFileInfo(p);
        if (cacheInfo !== null && cacheInfo.contents !== null) {
            this.stat(p, function (error, stat) {
                if (error) {
                    cb(error);
                }
                else if (stat.contentHash === cacheInfo.stat.contentHash) {
                    cb(error, cacheInfo.contents.slice(0), cacheInfo.stat);
                }
                else {
                    _this.readFile(p, cb);
                }
            });
        }
        else {
            this._wrap(function (interceptCb) {
                _this._client.readFile(p, { arrayBuffer: true }, interceptCb);
            }, function (err, contents, stat) {
                if (!err) {
                    _this.updateCachedInfo(p, stat, contents.slice(0));
                }
                cb(err, contents, stat);
            });
        }
    };
    CachedDropboxClient.prototype.writeFile = function (p, contents, cb) {
        var _this = this;
        this._wrap(function (interceptCb) {
            _this._client.writeFile(p, contents, interceptCb);
        }, function (err, stat) {
            if (!err) {
                _this.updateCachedInfo(p, stat, contents.slice(0));
            }
            cb(err, stat);
        });
    };
    CachedDropboxClient.prototype.mkdir = function (p, cb) {
        var _this = this;
        this._wrap(function (interceptCb) {
            _this._client.mkdir(p, interceptCb);
        }, function (err, stat) {
            if (!err) {
                _this.updateCachedInfo(p, stat, []);
            }
            cb(err);
        });
    };
    CachedDropboxClient.prototype._wrap = function (performOp, cb) {
        var numRun = 0, interceptCb = function (error) {
            var timeoutDuration = 2;
            if (error && 3 > (++numRun)) {
                switch (error.status) {
                    case Dropbox.ApiError.SERVER_ERROR:
                    case Dropbox.ApiError.NETWORK_ERROR:
                    case Dropbox.ApiError.RATE_LIMITED:
                        setTimeout(function () {
                            performOp(interceptCb);
                        }, timeoutDuration * 1000);
                        break;
                    default:
                        cb.apply(null, arguments);
                        break;
                }
            }
            else {
                cb.apply(null, arguments);
            }
        };
        performOp(interceptCb);
    };
    return CachedDropboxClient;
})();
var DropboxFile = (function (_super) {
    __extends(DropboxFile, _super);
    function DropboxFile(_fs, _path, _flag, _stat, contents) {
        _super.call(this, _fs, _path, _flag, _stat, contents);
    }
    DropboxFile.prototype.sync = function (cb) {
        var _this = this;
        if (this.isDirty()) {
            var buffer = this.getBuffer(), arrayBuffer = util_1.buffer2ArrayBuffer(buffer);
            this._fs._writeFileStrict(this.getPath(), arrayBuffer, function (e) {
                if (!e) {
                    _this.resetDirty();
                }
                cb(e);
            });
        }
        else {
            cb();
        }
    };
    DropboxFile.prototype.close = function (cb) {
        this.sync(cb);
    };
    return DropboxFile;
})(preload_file.PreloadFile);
exports.DropboxFile = DropboxFile;
var DropboxFileSystem = (function (_super) {
    __extends(DropboxFileSystem, _super);
    function DropboxFileSystem(client) {
        _super.call(this);
        this._client = new CachedDropboxClient(client);
        constructErrorCodeLookup();
    }
    DropboxFileSystem.prototype.getName = function () {
        return 'Dropbox';
    };
    DropboxFileSystem.isAvailable = function () {
        return typeof Dropbox !== 'undefined';
    };
    DropboxFileSystem.prototype.isReadOnly = function () {
        return false;
    };
    DropboxFileSystem.prototype.supportsSymlinks = function () {
        return false;
    };
    DropboxFileSystem.prototype.supportsProps = function () {
        return false;
    };
    DropboxFileSystem.prototype.supportsSynch = function () {
        return false;
    };
    DropboxFileSystem.prototype.empty = function (mainCb) {
        var _this = this;
        this._client.readdir('/', function (error, files) {
            if (error) {
                mainCb(_this.convert(error, '/'));
            }
            else {
                var deleteFile = function (file, cb) {
                    var p = path.join('/', file);
                    _this._client.remove(p, function (err) {
                        cb(err ? _this.convert(err, p) : null);
                    });
                };
                var finished = function (err) {
                    if (err) {
                        mainCb(err);
                    }
                    else {
                        mainCb();
                    }
                };
                async.each(files, deleteFile, finished);
            }
        });
    };
    DropboxFileSystem.prototype.rename = function (oldPath, newPath, cb) {
        var _this = this;
        this._client.move(oldPath, newPath, function (error) {
            if (error) {
                _this._client.stat(newPath, function (error2, stat) {
                    if (error2 || stat.isFolder) {
                        var missingPath = error.response.error.indexOf(oldPath) > -1 ? oldPath : newPath;
                        cb(_this.convert(error, missingPath));
                    }
                    else {
                        _this._client.remove(newPath, function (error2) {
                            if (error2) {
                                cb(_this.convert(error2, newPath));
                            }
                            else {
                                _this.rename(oldPath, newPath, cb);
                            }
                        });
                    }
                });
            }
            else {
                cb();
            }
        });
    };
    DropboxFileSystem.prototype.stat = function (path, isLstat, cb) {
        var _this = this;
        this._client.stat(path, function (error, stat) {
            if (error) {
                cb(_this.convert(error, path));
            }
            else if ((stat != null) && stat.isRemoved) {
                cb(api_error_1.ApiError.FileError(api_error_1.ErrorCode.ENOENT, path));
            }
            else {
                var stats = new node_fs_stats_1.default(_this._statType(stat), stat.size);
                return cb(null, stats);
            }
        });
    };
    DropboxFileSystem.prototype.open = function (path, flags, mode, cb) {
        var _this = this;
        this._client.readFile(path, function (error, content, dbStat) {
            if (error) {
                if (flags.isReadable()) {
                    cb(_this.convert(error, path));
                }
                else {
                    switch (error.status) {
                        case Dropbox.ApiError.NOT_FOUND:
                            var ab = new ArrayBuffer(0);
                            return _this._writeFileStrict(path, ab, function (error2, stat) {
                                if (error2) {
                                    cb(error2);
                                }
                                else {
                                    var file = _this._makeFile(path, flags, stat, util_1.arrayBuffer2Buffer(ab));
                                    cb(null, file);
                                }
                            });
                        default:
                            return cb(_this.convert(error, path));
                    }
                }
            }
            else {
                var buffer;
                if (content === null) {
                    buffer = new Buffer(0);
                }
                else {
                    buffer = util_1.arrayBuffer2Buffer(content);
                }
                var file = _this._makeFile(path, flags, dbStat, buffer);
                return cb(null, file);
            }
        });
    };
    DropboxFileSystem.prototype._writeFileStrict = function (p, data, cb) {
        var _this = this;
        var parent = path.dirname(p);
        this.stat(parent, false, function (error, stat) {
            if (error) {
                cb(api_error_1.ApiError.FileError(api_error_1.ErrorCode.ENOENT, parent));
            }
            else {
                _this._client.writeFile(p, data, function (error2, stat) {
                    if (error2) {
                        cb(_this.convert(error2, p));
                    }
                    else {
                        cb(null, stat);
                    }
                });
            }
        });
    };
    DropboxFileSystem.prototype._statType = function (stat) {
        return stat.isFile ? node_fs_stats_1.FileType.FILE : node_fs_stats_1.FileType.DIRECTORY;
    };
    DropboxFileSystem.prototype._makeFile = function (path, flag, stat, buffer) {
        var type = this._statType(stat);
        var stats = new node_fs_stats_1.default(type, stat.size);
        return new DropboxFile(this, path, flag, stats, buffer);
    };
    DropboxFileSystem.prototype._remove = function (path, cb, isFile) {
        var _this = this;
        this._client.stat(path, function (error, stat) {
            if (error) {
                cb(_this.convert(error, path));
            }
            else {
                if (stat.isFile && !isFile) {
                    cb(api_error_1.ApiError.FileError(api_error_1.ErrorCode.ENOTDIR, path));
                }
                else if (!stat.isFile && isFile) {
                    cb(api_error_1.ApiError.FileError(api_error_1.ErrorCode.EISDIR, path));
                }
                else {
                    _this._client.remove(path, function (error) {
                        if (error) {
                            cb(_this.convert(error, path));
                        }
                        else {
                            cb(null);
                        }
                    });
                }
            }
        });
    };
    DropboxFileSystem.prototype.unlink = function (path, cb) {
        this._remove(path, cb, true);
    };
    DropboxFileSystem.prototype.rmdir = function (path, cb) {
        this._remove(path, cb, false);
    };
    DropboxFileSystem.prototype.mkdir = function (p, mode, cb) {
        var _this = this;
        var parent = path.dirname(p);
        this._client.stat(parent, function (error, stat) {
            if (error) {
                cb(_this.convert(error, parent));
            }
            else {
                _this._client.mkdir(p, function (error) {
                    if (error) {
                        cb(api_error_1.ApiError.FileError(api_error_1.ErrorCode.EEXIST, p));
                    }
                    else {
                        cb(null);
                    }
                });
            }
        });
    };
    DropboxFileSystem.prototype.readdir = function (path, cb) {
        var _this = this;
        this._client.readdir(path, function (error, files) {
            if (error) {
                return cb(_this.convert(error));
            }
            else {
                return cb(null, files);
            }
        });
    };
    DropboxFileSystem.prototype.convert = function (err, path) {
        if (path === void 0) { path = null; }
        var errorCode = errorCodeLookup[err.status];
        if (errorCode === undefined) {
            errorCode = api_error_1.ErrorCode.EIO;
        }
        if (path == null) {
            return new api_error_1.ApiError(errorCode);
        }
        else {
            return api_error_1.ApiError.FileError(errorCode, path);
        }
    };
    return DropboxFileSystem;
})(file_system.BaseFileSystem);
exports.__esModule = true;
exports["default"] = DropboxFileSystem;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRHJvcGJveC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9iYWNrZW5kL0Ryb3Bib3gudHMiXSwibmFtZXMiOlsiY29uc3RydWN0RXJyb3JDb2RlTG9va3VwIiwiaXNGaWxlSW5mbyIsImlzRGlySW5mbyIsImlzQXJyYXlCdWZmZXIiLCJDYWNoZWREcm9wYm94Q2xpZW50IiwiQ2FjaGVkRHJvcGJveENsaWVudC5jb25zdHJ1Y3RvciIsIkNhY2hlZERyb3Bib3hDbGllbnQuZ2V0Q2FjaGVkSW5mbyIsIkNhY2hlZERyb3Bib3hDbGllbnQucHV0Q2FjaGVkSW5mbyIsIkNhY2hlZERyb3Bib3hDbGllbnQuZGVsZXRlQ2FjaGVkSW5mbyIsIkNhY2hlZERyb3Bib3hDbGllbnQuZ2V0Q2FjaGVkRGlySW5mbyIsIkNhY2hlZERyb3Bib3hDbGllbnQuZ2V0Q2FjaGVkRmlsZUluZm8iLCJDYWNoZWREcm9wYm94Q2xpZW50LnVwZGF0ZUNhY2hlZERpckluZm8iLCJDYWNoZWREcm9wYm94Q2xpZW50LnVwZGF0ZUNhY2hlZEZpbGVJbmZvIiwiQ2FjaGVkRHJvcGJveENsaWVudC51cGRhdGVDYWNoZWRJbmZvIiwiQ2FjaGVkRHJvcGJveENsaWVudC5yZWFkZGlyIiwiQ2FjaGVkRHJvcGJveENsaWVudC5yZW1vdmUiLCJDYWNoZWREcm9wYm94Q2xpZW50Lm1vdmUiLCJDYWNoZWREcm9wYm94Q2xpZW50LnN0YXQiLCJDYWNoZWREcm9wYm94Q2xpZW50LnJlYWRGaWxlIiwiQ2FjaGVkRHJvcGJveENsaWVudC53cml0ZUZpbGUiLCJDYWNoZWREcm9wYm94Q2xpZW50Lm1rZGlyIiwiQ2FjaGVkRHJvcGJveENsaWVudC5fd3JhcCIsIkRyb3Bib3hGaWxlIiwiRHJvcGJveEZpbGUuY29uc3RydWN0b3IiLCJEcm9wYm94RmlsZS5zeW5jIiwiRHJvcGJveEZpbGUuY2xvc2UiLCJEcm9wYm94RmlsZVN5c3RlbSIsIkRyb3Bib3hGaWxlU3lzdGVtLmNvbnN0cnVjdG9yIiwiRHJvcGJveEZpbGVTeXN0ZW0uZ2V0TmFtZSIsIkRyb3Bib3hGaWxlU3lzdGVtLmlzQXZhaWxhYmxlIiwiRHJvcGJveEZpbGVTeXN0ZW0uaXNSZWFkT25seSIsIkRyb3Bib3hGaWxlU3lzdGVtLnN1cHBvcnRzU3ltbGlua3MiLCJEcm9wYm94RmlsZVN5c3RlbS5zdXBwb3J0c1Byb3BzIiwiRHJvcGJveEZpbGVTeXN0ZW0uc3VwcG9ydHNTeW5jaCIsIkRyb3Bib3hGaWxlU3lzdGVtLmVtcHR5IiwiRHJvcGJveEZpbGVTeXN0ZW0ucmVuYW1lIiwiRHJvcGJveEZpbGVTeXN0ZW0uc3RhdCIsIkRyb3Bib3hGaWxlU3lzdGVtLm9wZW4iLCJEcm9wYm94RmlsZVN5c3RlbS5fd3JpdGVGaWxlU3RyaWN0IiwiRHJvcGJveEZpbGVTeXN0ZW0uX3N0YXRUeXBlIiwiRHJvcGJveEZpbGVTeXN0ZW0uX21ha2VGaWxlIiwiRHJvcGJveEZpbGVTeXN0ZW0uX3JlbW92ZSIsIkRyb3Bib3hGaWxlU3lzdGVtLnVubGluayIsIkRyb3Bib3hGaWxlU3lzdGVtLnJtZGlyIiwiRHJvcGJveEZpbGVTeXN0ZW0ubWtkaXIiLCJEcm9wYm94RmlsZVN5c3RlbS5yZWFkZGlyIiwiRHJvcGJveEZpbGVTeXN0ZW0uY29udmVydCJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxJQUFPLFlBQVksV0FBVyx5QkFBeUIsQ0FBQyxDQUFDO0FBQ3pELElBQU8sV0FBVyxXQUFXLHFCQUFxQixDQUFDLENBQUM7QUFFcEQsOEJBQXlDLHVCQUF1QixDQUFDLENBQUE7QUFDakUsMEJBQWtDLG1CQUFtQixDQUFDLENBQUE7QUFFdEQsSUFBTyxLQUFLLFdBQVcsT0FBTyxDQUFDLENBQUM7QUFDaEMsSUFBTyxJQUFJLFdBQVcsTUFBTSxDQUFDLENBQUM7QUFDOUIscUJBQXFELGNBQWMsQ0FBQyxDQUFBO0FBRXBFLElBQUksZUFBZSxHQUE0QyxJQUFJLENBQUM7QUFFcEU7SUFDRUEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsZUFBZUEsS0FBS0EsSUFBSUEsQ0FB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LENBQUNBO1lBQ05BLE1BQU1BLENBQUNBLG9CQUFRQSxDQUFDQSxTQUFTQSxDQUFDQSxTQUFTQSxFQUFFQSxJQUFJQSxDQUFDQSxDQUFDQTtRQUM3Q0EsQ0FBQ0E7SUFDSEEsQ0FBQ0E7SUFDSHBCLHdCQUFDQTtBQUFEQSxDQUFDQSxBQTNSRCxFQUErQyxXQUFXLENBQUMsY0FBYyxFQTJSeEU7QUEzUkQ7c0NBMlJDLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcHJlbG9hZF9maWxlID0gcmVxdWlyZSgnLi4vZ2VuZXJpYy9wcmVsb2FkX2ZpbGUnKTtcbmltcG9ydCBmaWxlX3N5c3RlbSA9IHJlcXVpcmUoJy4uL2NvcmUvZmlsZV9zeXN0ZW0nKTtcbmltcG9ydCBmaWxlX2ZsYWcgPSByZXF1aXJlKCcuLi9jb3JlL2ZpbGVfZmxhZycpO1xuaW1wb3J0IHtkZWZhdWx0IGFzIFN0YXRzLCBGaWxlVHlwZX0gZnJvbSAnLi4vY29yZS9ub2RlX2ZzX3N0YXRzJztcbmltcG9ydCB7QXBpRXJyb3IsIEVycm9yQ29kZX0gZnJvbSAnLi4vY29yZS9hcGlfZXJyb3InO1xuaW1wb3J0IGZpbGUgPSByZXF1aXJlKCcuLi9jb3JlL2ZpbGUnKTtcbmltcG9ydCBhc3luYyA9IHJlcXVpcmUoJ2FzeW5jJyk7XG5pbXBvcnQgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKTtcbmltcG9ydCB7YXJyYXlCdWZmZXIyQnVmZmVyLCBidWZmZXIyQXJyYXlCdWZmZXJ9IGZyb20gJy4uL2NvcmUvdXRpbCc7XG5cbnZhciBlcnJvckNvZGVMb29rdXA6IHtbZHJvcGJveEVycm9yQ29kZTogbnVtYmVyXTogRXJyb3JDb2RlfSA9IG51bGw7XG4vLyBMYXppbHkgY29uc3RydWN0IGVycm9yIGNvZGUgbG9va3VwLCBzaW5jZSBEcm9wYm94SlMgbWlnaHQgYmUgbG9hZGVkICphZnRlciogQnJvd3NlckZTIChvciBub3QgYXQgYWxsISlcbmZ1bmN0aW9uIGNvbnN0cnVjdEVycm9yQ29kZUxvb2t1cCgpIHtcbiAgaWYgKGVycm9yQ29kZUxvb2t1cCAhPT0gbnVsbCkge1xuICAgIHJldHVybjtcbiAgfVxuICBlcnJvckNvZGVMb29rdXAgPSB7fTtcbiAgLy8gVGhpcyBpbmRpY2F0ZXMgYSBuZXR3b3JrIHRyYW5zbWlzc2lvbiBlcnJvciBvbiBtb2Rlcm4gYnJvd3NlcnMuIEludGVybmV0IEV4cGxvcmVyIG1pZ2h0IGNhdXNlIHRoaXMgY29kZSB0byBiZSByZXBvcnRlZCBvbiBzb21lIEFQSSBzZXJ2ZXIgZXJyb3JzLlxuICBlcnJvckNvZGVMb29rdXBbRHJvcGJveC5BcGlFcnJvci5ORVRXT1JLX0VSUk9SXSA9IEVycm9yQ29kZS5FSU87XG4gIC8vIFRoaXMgaGFwcGVucyB3aGVuIHRoZSBjb250ZW50SGFzaCBwYXJhbWV0ZXIgcGFzc2VkIHRvIGEgRHJvcGJveC5DbGllbnQjcmVhZGRpciBvciBEcm9wYm94LkNsaWVudCNzdGF0IG1hdGNoZXMgdGhlIG1vc3QgcmVjZW50IGNvbnRlbnQsIHNvIHRoZSBBUEkgY2FsbCByZXNwb25zZSBpcyBvbWl0dGVkLCB0byBzYXZlIGJhbmR3aWR0aC5cbiAgLy8gZXJyb3JDb2RlTG9va3VwW0Ryb3Bib3guQXBpRXJyb3IuTk9fQ09OVEVOVF07XG4gIC8vIFRoZSBlcnJvciBwcm9wZXJ0eSBvbiB7RHJvcGJveC5BcGlFcnJvciNyZXNwb25zZX0gc2hvdWxkIGluZGljYXRlIHdoaWNoIGlucHV0IHBhcmFtZXRlciBpcyBpbnZhbGlkIGFuZCB3aHkuXG4gIGVycm9yQ29kZUxvb2t1cFtEcm9wYm94LkFwaUVycm9yLklOVkFMSURfUEFSQU1dID0gRXJyb3JDb2RlLkVJTlZBTDtcbiAgLy8gVGhlIE9BdXRoIHRva2VuIHVzZWQgZm9yIHRoZSByZXF1ZXN0IHdpbGwgbmV2ZXIgYmVjb21lIHZhbGlkIGFnYWluLCBzbyB0aGUgdXNlciBzaG91bGQgYmUgcmUtYXV0aGVudGljYXRlZC5cbiAgZXJyb3JDb2RlTG9va3VwW0Ryb3Bib3guQXBpRXJyb3IuSU5WQUxJRF9UT0tFTl0gPSBFcnJvckNvZGUuRVBFUk07XG4gIC8vIFRoaXMgaW5kaWNhdGVzIGEgYnVnIGluIGRyb3Bib3guanMgYW5kIHNob3VsZCBuZXZlciBvY2N1ciB1bmRlciBub3JtYWwgY2lyY3Vtc3RhbmNlcy5cbiAgLy8gXiBBY3R1YWxseSwgdGhhdCdzIGZhbHNlLiBUaGlzIG9jY3VycyB3aGVuIHlvdSB0cnkgdG8gbW92ZSBmb2xkZXJzIHRvIHRoZW1zZWx2ZXMsIG9yIG1vdmUgYSBmaWxlIG92ZXIgYW5vdGhlciBmaWxlLlxuICBlcnJvckNvZGVMb29rdXBbRHJvcGJveC5BcGlFcnJvci5PQVVUSF9FUlJPUl0gPSBFcnJvckNvZGUuRVBFUk07XG4gIC8vIFRoaXMgaGFwcGVucyB3aGVuIHRyeWluZyB0byByZWFkIGZyb20gYSBub24tZXhpc3RpbmcgZmlsZSwgcmVhZGRpciBhIG5vbi1leGlzdGluZyBkaXJlY3RvcnksIHdyaXRlIGEgZmlsZSBpbnRvIGEgbm9uLWV4aXN0aW5nIGRpcmVjdG9yeSwgZXRjLlxuICBlcnJvckNvZGVMb29rdXBbRHJvcGJveC5BcGlFcnJvci5OT1RfRk9VTkRdID0gRXJyb3JDb2RlLkVOT0VOVDtcbiAgLy8gVGhpcyBpbmRpY2F0ZXMgYSBidWcgaW4gZHJvcGJveC5qcyBhbmQgc2hvdWxkIG5ldmVyIG9jY3VyIHVuZGVyIG5vcm1hbCBjaXJjdW1zdGFuY2VzLlxuICBlcnJvckNvZGVMb29rdXBbRHJvcGJveC5BcGlFcnJvci5JTlZBTElEX01FVEhPRF0gPSBFcnJvckNvZGUuRUlOVkFMO1xuICAvLyBUaGlzIGhhcHBlbnMgd2hlbiBhIERyb3Bib3guQ2xpZW50I3JlYWRkaXIgb3IgRHJvcGJveC5DbGllbnQjc3RhdCBjYWxsIHdvdWxkIHJldHVybiBtb3JlIHRoYW4gYSBtYXhpbXVtIGFtb3VudCBvZiBkaXJlY3RvcnkgZW50cmllcy5cbiAgZXJyb3JDb2RlTG9va3VwW0Ryb3Bib3guQXBpRXJyb3IuTk9UX0FDQ0VQVEFCTEVdID0gRXJyb3JDb2RlLkVJTlZBTDtcbiAgLy8gVGhpcyBpcyB1c2VkIGJ5IHNvbWUgYmFja2VuZCBtZXRob2RzIHRvIGluZGljYXRlIHRoYXQgdGhlIGNsaWVudCBuZWVkcyB0byBkb3dubG9hZCBzZXJ2ZXItc2lkZSBjaGFuZ2VzIGFuZCBwZXJmb3JtIGNvbmZsaWN0IHJlc29sdXRpb24uIFVuZGVyIG5vcm1hbCB1c2FnZSwgZXJyb3JzIHdpdGggdGhpcyBjb2RlIHNob3VsZCBuZXZlciBzdXJmYWNlIHRvIHRoZSBjb2RlIHVzaW5nIGRyb3Bib3guanMuXG4gIGVycm9yQ29kZUxvb2t1cFtEcm9wYm94LkFwaUVycm9yLkNPTkZMSUNUXSA9IEVycm9yQ29kZS5FSU5WQUw7XG4gIC8vIFN0YXR1cyB2YWx1ZSBpbmRpY2F0aW5nIHRoYXQgdGhlIGFwcGxpY2F0aW9uIGlzIG1ha2luZyB0b28gbWFueSByZXF1ZXN0cy5cbiAgZXJyb3JDb2RlTG9va3VwW0Ryb3Bib3guQXBpRXJyb3IuUkFURV9MSU1JVEVEXSA9IEVycm9yQ29kZS5FQlVTWTtcbiAgLy8gVGhlIHJlcXVlc3Qgc2hvdWxkIGJlIHJldHJpZWQgYWZ0ZXIgc29tZSB0aW1lLlxuICBlcnJvckNvZGVMb29rdXBbRHJvcGJveC5BcGlFcnJvci5TRVJWRVJfRVJST1JdID0gRXJyb3JDb2RlLkVCVVNZO1xuICAvLyBTdGF0dXMgdmFsdWUgaW5kaWNhdGluZyB0aGF0IHRoZSB1c2VyJ3MgRHJvcGJveCBpcyBvdmVyIGl0cyBzdG9yYWdlIHF1b3RhLlxuICBlcnJvckNvZGVMb29rdXBbRHJvcGJveC5BcGlFcnJvci5PVkVSX1FVT1RBXSA9IEVycm9yQ29kZS5FTk9TUEM7XG59XG5cbmludGVyZmFjZSBJQ2FjaGVkUGF0aEluZm8ge1xuICBzdGF0OiBEcm9wYm94LkZpbGUuU3RhdDtcbn1cblxuaW50ZXJmYWNlIElDYWNoZWRGaWxlSW5mbyBleHRlbmRzIElDYWNoZWRQYXRoSW5mbyB7XG4gIGNvbnRlbnRzOiBBcnJheUJ1ZmZlcjtcbn1cblxuZnVuY3Rpb24gaXNGaWxlSW5mbyhjYWNoZTogSUNhY2hlZFBhdGhJbmZvKTogY2FjaGUgaXMgSUNhY2hlZEZpbGVJbmZvIHtcbiAgcmV0dXJuIGNhY2hlICYmIGNhY2hlLnN0YXQuaXNGaWxlO1xufVxuXG5pbnRlcmZhY2UgSUNhY2hlZERpckluZm8gZXh0ZW5kcyBJQ2FjaGVkUGF0aEluZm8ge1xuICBjb250ZW50czogc3RyaW5nW107XG59XG5cbmZ1bmN0aW9uIGlzRGlySW5mbyhjYWNoZTogSUNhY2hlZFBhdGhJbmZvKTogY2FjaGUgaXMgSUNhY2hlZERpckluZm8ge1xuICByZXR1cm4gY2FjaGUgJiYgY2FjaGUuc3RhdC5pc0ZvbGRlcjtcbn1cblxuZnVuY3Rpb24gaXNBcnJheUJ1ZmZlcihhYjogYW55KTogYWIgaXMgQXJyYXlCdWZmZXIge1xuICAvLyBBY2NlcHQgbnVsbCAvIHVuZGVmaW5lZCwgdG9vLlxuICByZXR1cm4gYWIgPT09IG51bGwgfHwgYWIgPT09IHVuZGVmaW5lZCB8fCAodHlwZW9mKGFiKSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mKGFiWydieXRlTGVuZ3RoJ10pID09PSAnbnVtYmVyJyk7XG59XG5cbi8qKlxuICogV3JhcHMgYSBEcm9wYm94IGNsaWVudCBhbmQgY2FjaGVzIG9wZXJhdGlvbnMuXG4gKi9cbmNsYXNzIENhY2hlZERyb3Bib3hDbGllbnQge1xuICBwcml2YXRlIF9jYWNoZToge1twYXRoOiBzdHJpbmddOiBJQ2FjaGVkUGF0aEluZm99ID0ge307XG4gIHByaXZhdGUgX2NsaWVudDogRHJvcGJveC5DbGllbnQ7XG5cbiAgY29uc3RydWN0b3IoY2xpZW50OiBEcm9wYm94LkNsaWVudCkge1xuICAgIHRoaXMuX2NsaWVudCA9IGNsaWVudDtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0Q2FjaGVkSW5mbyhwOiBzdHJpbmcpOiBJQ2FjaGVkUGF0aEluZm8ge1xuICAgIHJldHVybiB0aGlzLl9jYWNoZVtwLnRvTG93ZXJDYXNlKCldO1xuICB9XG5cbiAgcHJpdmF0ZSBwdXRDYWNoZWRJbmZvKHA6IHN0cmluZywgY2FjaGU6IElDYWNoZWRQYXRoSW5mbyk6IHZvaWQge1xuICAgIHRoaXMuX2NhY2hlW3AudG9Mb3dlckNhc2UoKV0gPSBjYWNoZTtcbiAgfVxuXG4gIHByaXZhdGUgZGVsZXRlQ2FjaGVkSW5mbyhwOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGVbcC50b0xvd2VyQ2FzZSgpXTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0Q2FjaGVkRGlySW5mbyhwOiBzdHJpbmcpOiBJQ2FjaGVkRGlySW5mbyB7XG4gICAgdmFyIGluZm8gPSB0aGlzLmdldENhY2hlZEluZm8ocCk7XG4gICAgaWYgKGlzRGlySW5mbyhpbmZvKSkge1xuICAgICAgcmV0dXJuIGluZm87XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2V0Q2FjaGVkRmlsZUluZm8ocDogc3RyaW5nKTogSUNhY2hlZEZpbGVJbmZvIHtcbiAgICB2YXIgaW5mbyA9IHRoaXMuZ2V0Q2FjaGVkSW5mbyhwKTtcbiAgICBpZiAoaXNGaWxlSW5mbyhpbmZvKSkge1xuICAgICAgcmV0dXJuIGluZm87XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlQ2FjaGVkRGlySW5mbyhwOiBzdHJpbmcsIHN0YXQ6IERyb3Bib3guRmlsZS5TdGF0LCBjb250ZW50czogc3RyaW5nW10gPSBudWxsKTogdm9pZCB7XG4gICAgdmFyIGNhY2hlZEluZm8gPSB0aGlzLmdldENhY2hlZEluZm8ocCk7XG4gICAgLy8gRHJvcGJveCB1c2VzIHRoZSAqY29udGVudEhhc2gqIHByb3BlcnR5IGZvciBkaXJlY3Rvcmllcy5cbiAgICAvLyBJZ25vcmUgc3RhdCBvYmplY3RzIHcvbyBhIGNvbnRlbnRIYXNoIGRlZmluZWQ7IHRob3NlIGFjdHVhbGx5IGV4aXN0ISEhXG4gICAgLy8gKEV4YW1wbGU6IHJlYWRkaXIgcmV0dXJucyBhbiBhcnJheSBvZiBzdGF0IG9ianM7IHN0YXQgb2JqcyBmb3IgZGlycyBpbiB0aGF0IGNvbnRleHQgaGF2ZSBubyBjb250ZW50SGFzaClcbiAgICBpZiAoc3RhdC5jb250ZW50SGFzaCAhPT0gbnVsbCAmJiAoY2FjaGVkSW5mbyA9PT0gdW5kZWZpbmVkIHx8IGNhY2hlZEluZm8uc3RhdC5jb250ZW50SGFzaCAhPT0gc3RhdC5jb250ZW50SGFzaCkpIHtcbiAgICAgIHRoaXMucHV0Q2FjaGVkSW5mbyhwLCA8SUNhY2hlZERpckluZm8+IHtcbiAgICAgICAgc3RhdDogc3RhdCxcbiAgICAgICAgY29udGVudHM6IGNvbnRlbnRzXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUNhY2hlZEZpbGVJbmZvKHA6IHN0cmluZywgc3RhdDogRHJvcGJveC5GaWxlLlN0YXQsIGNvbnRlbnRzOiBBcnJheUJ1ZmZlciA9IG51bGwpOiB2b2lkIHtcbiAgICB2YXIgY2FjaGVkSW5mbyA9IHRoaXMuZ2V0Q2FjaGVkSW5mbyhwKTtcbiAgICAvLyBEcm9wYm94IHVzZXMgdGhlICp2ZXJzaW9uVGFnKiBwcm9wZXJ0eSBmb3IgZmlsZXMuXG4gICAgLy8gSWdub3JlIHN0YXQgb2JqZWN0cyB3L28gYSB2ZXJzaW9uVGFnIGRlZmluZWQuXG4gICAgaWYgKHN0YXQudmVyc2lvblRhZyAhPT0gbnVsbCAmJiAoY2FjaGVkSW5mbyA9PT0gdW5kZWZpbmVkIHx8IGNhY2hlZEluZm8uc3RhdC52ZXJzaW9uVGFnICE9PSBzdGF0LnZlcnNpb25UYWcpKSB7XG4gICAgICB0aGlzLnB1dENhY2hlZEluZm8ocCwgPElDYWNoZWRGaWxlSW5mbz4ge1xuICAgICAgICBzdGF0OiBzdGF0LFxuICAgICAgICBjb250ZW50czogY29udGVudHNcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlQ2FjaGVkSW5mbyhwOiBzdHJpbmcsIHN0YXQ6IERyb3Bib3guRmlsZS5TdGF0LCBjb250ZW50czogQXJyYXlCdWZmZXIgfCBzdHJpbmdbXSA9IG51bGwpOiB2b2lkIHtcbiAgICBpZiAoc3RhdC5pc0ZpbGUgJiYgaXNBcnJheUJ1ZmZlcihjb250ZW50cykpIHtcbiAgICAgIHRoaXMudXBkYXRlQ2FjaGVkRmlsZUluZm8ocCwgc3RhdCwgY29udGVudHMpO1xuICAgIH0gZWxzZSBpZiAoc3RhdC5pc0ZvbGRlciAmJiBBcnJheS5pc0FycmF5KGNvbnRlbnRzKSkge1xuICAgICAgdGhpcy51cGRhdGVDYWNoZWREaXJJbmZvKHAsIHN0YXQsIGNvbnRlbnRzKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgcmVhZGRpcihwOiBzdHJpbmcsIGNiOiAoZXJyb3I6IERyb3Bib3guQXBpRXJyb3IsIGNvbnRlbnRzPzogc3RyaW5nW10pID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgY2FjaGVJbmZvID0gdGhpcy5nZXRDYWNoZWREaXJJbmZvKHApO1xuXG4gICAgdGhpcy5fd3JhcCgoaW50ZXJjZXB0Q2IpID0+IHtcbiAgICAgIGlmIChjYWNoZUluZm8gIT09IG51bGwgJiYgY2FjaGVJbmZvLmNvbnRlbnRzKSB7XG4gICAgICAgIHRoaXMuX2NsaWVudC5yZWFkZGlyKHAsIHtcbiAgICAgICAgICBjb250ZW50SGFzaDogY2FjaGVJbmZvLnN0YXQuY29udGVudEhhc2hcbiAgICAgICAgfSwgaW50ZXJjZXB0Q2IpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fY2xpZW50LnJlYWRkaXIocCwgaW50ZXJjZXB0Q2IpO1xuICAgICAgfVxuICAgIH0sIChlcnI6IERyb3Bib3guQXBpRXJyb3IsIGZpbGVuYW1lczogc3RyaW5nW10sIHN0YXQ6IERyb3Bib3guRmlsZS5TdGF0LCBmb2xkZXJFbnRyaWVzOiBEcm9wYm94LkZpbGUuU3RhdFtdKSA9PiB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGlmIChlcnIuc3RhdHVzID09PSBEcm9wYm94LkFwaUVycm9yLk5PX0NPTlRFTlQgJiYgY2FjaGVJbmZvICE9PSBudWxsKSB7XG4gICAgICAgICAgY2IobnVsbCwgY2FjaGVJbmZvLmNvbnRlbnRzLnNsaWNlKDApKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjYihlcnIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnVwZGF0ZUNhY2hlZERpckluZm8ocCwgc3RhdCwgZmlsZW5hbWVzLnNsaWNlKDApKTtcbiAgICAgICAgZm9sZGVyRW50cmllcy5mb3JFYWNoKChlbnRyeSkgPT4ge1xuICAgICAgICAgIHRoaXMudXBkYXRlQ2FjaGVkSW5mbyhwYXRoLmpvaW4ocCwgZW50cnkubmFtZSksIGVudHJ5KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNiKG51bGwsIGZpbGVuYW1lcyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgcmVtb3ZlKHA6IHN0cmluZywgY2I6IChlcnJvcj86IERyb3Bib3guQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl93cmFwKChpbnRlcmNlcHRDYikgPT4ge1xuICAgICAgdGhpcy5fY2xpZW50LnJlbW92ZShwLCBpbnRlcmNlcHRDYik7XG4gICAgfSwgKGVycjogRHJvcGJveC5BcGlFcnJvciwgc3RhdD86IERyb3Bib3guRmlsZS5TdGF0KSA9PiB7XG4gICAgICBpZiAoIWVycikge1xuICAgICAgICB0aGlzLnVwZGF0ZUNhY2hlZEluZm8ocCwgc3RhdCk7XG4gICAgICB9XG4gICAgICBjYihlcnIpO1xuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIG1vdmUoc3JjOiBzdHJpbmcsIGRlc3Q6IHN0cmluZywgY2I6IChlcnJvcj86IERyb3Bib3guQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl93cmFwKChpbnRlcmNlcHRDYikgPT4ge1xuICAgICAgdGhpcy5fY2xpZW50Lm1vdmUoc3JjLCBkZXN0LCBpbnRlcmNlcHRDYik7XG4gICAgfSwgKGVycjogRHJvcGJveC5BcGlFcnJvciwgc3RhdDogRHJvcGJveC5GaWxlLlN0YXQpID0+IHtcbiAgICAgIGlmICghZXJyKSB7XG4gICAgICAgIHRoaXMuZGVsZXRlQ2FjaGVkSW5mbyhzcmMpO1xuICAgICAgICB0aGlzLnVwZGF0ZUNhY2hlZEluZm8oZGVzdCwgc3RhdCk7XG4gICAgICB9XG4gICAgICBjYihlcnIpO1xuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIHN0YXQocDogc3RyaW5nLCBjYjogKGVycm9yOiBEcm9wYm94LkFwaUVycm9yLCBzdGF0PzogRHJvcGJveC5GaWxlLlN0YXQpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl93cmFwKChpbnRlcmNlcHRDYikgPT4ge1xuICAgICAgdGhpcy5fY2xpZW50LnN0YXQocCwgaW50ZXJjZXB0Q2IpO1xuICAgIH0sIChlcnI6IERyb3Bib3guQXBpRXJyb3IsIHN0YXQ6IERyb3Bib3guRmlsZS5TdGF0KSA9PiB7XG4gICAgICBpZiAoIWVycikge1xuICAgICAgICB0aGlzLnVwZGF0ZUNhY2hlZEluZm8ocCwgc3RhdCk7XG4gICAgICB9XG4gICAgICBjYihlcnIsIHN0YXQpO1xuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIHJlYWRGaWxlKHA6IHN0cmluZywgY2I6IChlcnJvcjogRHJvcGJveC5BcGlFcnJvciwgZmlsZT86IEFycmF5QnVmZmVyLCBzdGF0PzogRHJvcGJveC5GaWxlLlN0YXQpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgY2FjaGVJbmZvID0gdGhpcy5nZXRDYWNoZWRGaWxlSW5mbyhwKTtcbiAgICBpZiAoY2FjaGVJbmZvICE9PSBudWxsICYmIGNhY2hlSW5mby5jb250ZW50cyAhPT0gbnVsbCkge1xuICAgICAgLy8gVHJ5IHRvIHVzZSBjYWNoZWQgaW5mbzsgaXNzdWUgYSBzdGF0IHRvIHNlZSBpZiBjb250ZW50cyBhcmUgdXAtdG8tZGF0ZS5cbiAgICAgIHRoaXMuc3RhdChwLCAoZXJyb3IsIHN0YXQ/KSA9PiB7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgIGNiKGVycm9yKTtcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0LmNvbnRlbnRIYXNoID09PSBjYWNoZUluZm8uc3RhdC5jb250ZW50SGFzaCkge1xuICAgICAgICAgIC8vIE5vIGZpbGUgY2hhbmdlcy5cbiAgICAgICAgICBjYihlcnJvciwgY2FjaGVJbmZvLmNvbnRlbnRzLnNsaWNlKDApLCBjYWNoZUluZm8uc3RhdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gRmlsZSBjaGFuZ2VzOyByZXJ1biB0byB0cmlnZ2VyIGFjdHVhbCByZWFkRmlsZS5cbiAgICAgICAgICB0aGlzLnJlYWRGaWxlKHAsIGNiKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3dyYXAoKGludGVyY2VwdENiKSA9PiB7XG4gICAgICAgIHRoaXMuX2NsaWVudC5yZWFkRmlsZShwLCB7IGFycmF5QnVmZmVyOiB0cnVlIH0sIGludGVyY2VwdENiKTtcbiAgICAgIH0sIChlcnI6IERyb3Bib3guQXBpRXJyb3IsIGNvbnRlbnRzOiBhbnksIHN0YXQ6IERyb3Bib3guRmlsZS5TdGF0KSA9PiB7XG4gICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgdGhpcy51cGRhdGVDYWNoZWRJbmZvKHAsIHN0YXQsIGNvbnRlbnRzLnNsaWNlKDApKTtcbiAgICAgICAgfVxuICAgICAgICBjYihlcnIsIGNvbnRlbnRzLCBzdGF0KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyB3cml0ZUZpbGUocDogc3RyaW5nLCBjb250ZW50czogQXJyYXlCdWZmZXIsIGNiOiAoZXJyb3I6IERyb3Bib3guQXBpRXJyb3IsIHN0YXQ/OiBEcm9wYm94LkZpbGUuU3RhdCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3dyYXAoKGludGVyY2VwdENiKSA9PiB7XG4gICAgICB0aGlzLl9jbGllbnQud3JpdGVGaWxlKHAsIGNvbnRlbnRzLCBpbnRlcmNlcHRDYik7XG4gICAgfSwoZXJyOiBEcm9wYm94LkFwaUVycm9yLCBzdGF0OiBEcm9wYm94LkZpbGUuU3RhdCkgPT4ge1xuICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgdGhpcy51cGRhdGVDYWNoZWRJbmZvKHAsIHN0YXQsIGNvbnRlbnRzLnNsaWNlKDApKTtcbiAgICAgIH1cbiAgICAgIGNiKGVyciwgc3RhdCk7XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgbWtkaXIocDogc3RyaW5nLCBjYjogKGVycm9yPzogRHJvcGJveC5BcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3dyYXAoKGludGVyY2VwdENiKSA9PiB7XG4gICAgICB0aGlzLl9jbGllbnQubWtkaXIocCwgaW50ZXJjZXB0Q2IpO1xuICAgIH0sIChlcnI6IERyb3Bib3guQXBpRXJyb3IsIHN0YXQ6IERyb3Bib3guRmlsZS5TdGF0KSA9PiB7XG4gICAgICBpZiAoIWVycikge1xuICAgICAgICB0aGlzLnVwZGF0ZUNhY2hlZEluZm8ocCwgc3RhdCwgW10pO1xuICAgICAgfVxuICAgICAgY2IoZXJyKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXcmFwcyBhbiBvcGVyYXRpb24gc3VjaCB0aGF0IHdlIHJldHJ5IGEgZmFpbGVkIG9wZXJhdGlvbiAzIHRpbWVzLlxuICAgKiBOZWNlc3NhcnkgdG8gZGVhbCB3aXRoIERyb3Bib3ggcmF0ZSBsaW1pdGluZy5cbiAgICpcbiAgICogQHBhcmFtIHBlcmZvcm1PcCBGdW5jdGlvbiB0aGF0IHBlcmZvcm1zIHRoZSBvcGVyYXRpb24uIFdpbGwgYmUgY2FsbGVkIHVwIHRvIHRocmVlIHRpbWVzLlxuICAgKiBAcGFyYW0gY2IgQ2FsbGVkIHdoZW4gdGhlIG9wZXJhdGlvbiBzdWNjZWVkcywgZmFpbHMgaW4gYSBub24tdGVtcG9yYXJ5IG1hbm5lciwgb3IgZmFpbHMgdGhyZWUgdGltZXMuXG4gICAqL1xuICBwcml2YXRlIF93cmFwKHBlcmZvcm1PcDogKGludGVyY2VwdENiOiAoZXJyb3I6IERyb3Bib3guQXBpRXJyb3IpID0+IHZvaWQpID0+IHZvaWQsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHZhciBudW1SdW4gPSAwLFxuICAgICAgaW50ZXJjZXB0Q2IgPSBmdW5jdGlvbiAoZXJyb3I6IERyb3Bib3guQXBpRXJyb3IpOiB2b2lkIHtcbiAgICAgICAgLy8gVGltZW91dCBkdXJhdGlvbiwgaW4gc2Vjb25kcy5cbiAgICAgICAgdmFyIHRpbWVvdXREdXJhdGlvbjogbnVtYmVyID0gMjtcbiAgICAgICAgaWYgKGVycm9yICYmIDMgPiAoKytudW1SdW4pKSB7XG4gICAgICAgICAgc3dpdGNoKGVycm9yLnN0YXR1cykge1xuICAgICAgICAgICAgY2FzZSBEcm9wYm94LkFwaUVycm9yLlNFUlZFUl9FUlJPUjpcbiAgICAgICAgICAgIGNhc2UgRHJvcGJveC5BcGlFcnJvci5ORVRXT1JLX0VSUk9SOlxuICAgICAgICAgICAgY2FzZSBEcm9wYm94LkFwaUVycm9yLlJBVEVfTElNSVRFRDpcbiAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgcGVyZm9ybU9wKGludGVyY2VwdENiKTtcbiAgICAgICAgICAgICAgfSwgdGltZW91dER1cmF0aW9uICogMTAwMCk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgY2IuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNiLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICBwZXJmb3JtT3AoaW50ZXJjZXB0Q2IpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBEcm9wYm94RmlsZSBleHRlbmRzIHByZWxvYWRfZmlsZS5QcmVsb2FkRmlsZTxEcm9wYm94RmlsZVN5c3RlbT4gaW1wbGVtZW50cyBmaWxlLkZpbGUge1xuICBjb25zdHJ1Y3RvcihfZnM6IERyb3Bib3hGaWxlU3lzdGVtLCBfcGF0aDogc3RyaW5nLCBfZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnLCBfc3RhdDogU3RhdHMsIGNvbnRlbnRzPzogTm9kZUJ1ZmZlcikge1xuICAgIHN1cGVyKF9mcywgX3BhdGgsIF9mbGFnLCBfc3RhdCwgY29udGVudHMpXG4gIH1cblxuICBwdWJsaWMgc3luYyhjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmlzRGlydHkoKSkge1xuICAgICAgdmFyIGJ1ZmZlciA9IHRoaXMuZ2V0QnVmZmVyKCksXG4gICAgICAgIGFycmF5QnVmZmVyID0gYnVmZmVyMkFycmF5QnVmZmVyKGJ1ZmZlcik7XG4gICAgICB0aGlzLl9mcy5fd3JpdGVGaWxlU3RyaWN0KHRoaXMuZ2V0UGF0aCgpLCBhcnJheUJ1ZmZlciwgKGU/OiBBcGlFcnJvcikgPT4ge1xuICAgICAgICBpZiAoIWUpIHtcbiAgICAgICAgICB0aGlzLnJlc2V0RGlydHkoKTtcbiAgICAgICAgfVxuICAgICAgICBjYihlKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYigpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBjbG9zZShjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuc3luYyhjYik7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRHJvcGJveEZpbGVTeXN0ZW0gZXh0ZW5kcyBmaWxlX3N5c3RlbS5CYXNlRmlsZVN5c3RlbSBpbXBsZW1lbnRzIGZpbGVfc3lzdGVtLkZpbGVTeXN0ZW0ge1xuICAvLyBUaGUgRHJvcGJveCBjbGllbnQuXG4gIHByaXZhdGUgX2NsaWVudDogQ2FjaGVkRHJvcGJveENsaWVudDtcblxuICAvKipcbiAgICogQXJndW1lbnRzOiBhbiBhdXRoZW50aWNhdGVkIERyb3Bib3guanMgY2xpZW50XG4gICAqL1xuICBjb25zdHJ1Y3RvcihjbGllbnQ6IERyb3Bib3guQ2xpZW50KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9jbGllbnQgPSBuZXcgQ2FjaGVkRHJvcGJveENsaWVudChjbGllbnQpO1xuICAgIGNvbnN0cnVjdEVycm9yQ29kZUxvb2t1cCgpO1xuICB9XG5cbiAgcHVibGljIGdldE5hbWUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gJ0Ryb3Bib3gnO1xuICB9XG5cbiAgcHVibGljIHN0YXRpYyBpc0F2YWlsYWJsZSgpOiBib29sZWFuIHtcbiAgICAvLyBDaGVja3MgaWYgdGhlIERyb3Bib3ggbGlicmFyeSBpcyBsb2FkZWQuXG4gICAgcmV0dXJuIHR5cGVvZiBEcm9wYm94ICE9PSAndW5kZWZpbmVkJztcbiAgfVxuXG4gIHB1YmxpYyBpc1JlYWRPbmx5KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIERyb3Bib3ggZG9lc24ndCBzdXBwb3J0IHN5bWxpbmtzLCBwcm9wZXJ0aWVzLCBvciBzeW5jaHJvbm91cyBjYWxsc1xuXG4gIHB1YmxpYyBzdXBwb3J0c1N5bWxpbmtzKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHB1YmxpYyBzdXBwb3J0c1Byb3BzKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHB1YmxpYyBzdXBwb3J0c1N5bmNoKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHB1YmxpYyBlbXB0eShtYWluQ2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9jbGllbnQucmVhZGRpcignLycsIChlcnJvciwgZmlsZXMpID0+IHtcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICBtYWluQ2IodGhpcy5jb252ZXJ0KGVycm9yLCAnLycpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBkZWxldGVGaWxlID0gKGZpbGU6IHN0cmluZywgY2I6IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCkgPT4ge1xuICAgICAgICAgIHZhciBwID0gcGF0aC5qb2luKCcvJywgZmlsZSk7XG4gICAgICAgICAgdGhpcy5fY2xpZW50LnJlbW92ZShwLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBjYihlcnIgPyB0aGlzLmNvbnZlcnQoZXJyLCBwKSA6IG51bGwpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICB2YXIgZmluaXNoZWQgPSAoZXJyPzogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICBtYWluQ2IoZXJyKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWFpbkNiKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICAvLyBYWFg6IDxhbnk+IHR5cGluZyBpcyB0byBnZXQgYXJvdW5kIG92ZXJseS1yZXN0cmljdGl2ZSBFcnJvckNhbGxiYWNrIHR5cGluZy5cbiAgICAgICAgYXN5bmMuZWFjaChmaWxlcywgPGFueT4gZGVsZXRlRmlsZSwgPGFueT4gZmluaXNoZWQpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiBwdWJsaWMgcmVuYW1lKG9sZFBhdGg6IHN0cmluZywgbmV3UGF0aDogc3RyaW5nLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX2NsaWVudC5tb3ZlKG9sZFBhdGgsIG5ld1BhdGgsIChlcnJvcikgPT4ge1xuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIC8vIHRoZSBtb3ZlIGlzIHBlcm1pdHRlZCBpZiBuZXdQYXRoIGlzIGEgZmlsZS5cbiAgICAgICAgLy8gQ2hlY2sgaWYgdGhpcyBpcyB0aGUgY2FzZSwgYW5kIHJlbW92ZSBpZiBzby5cbiAgICAgICAgdGhpcy5fY2xpZW50LnN0YXQobmV3UGF0aCwgKGVycm9yMiwgc3RhdCkgPT4ge1xuICAgICAgICAgIGlmIChlcnJvcjIgfHwgc3RhdC5pc0ZvbGRlcikge1xuICAgICAgICAgICAgdmFyIG1pc3NpbmdQYXRoID0gKDxhbnk+IGVycm9yLnJlc3BvbnNlKS5lcnJvci5pbmRleE9mKG9sZFBhdGgpID4gLTEgPyBvbGRQYXRoIDogbmV3UGF0aDtcbiAgICAgICAgICAgIGNiKHRoaXMuY29udmVydChlcnJvciwgbWlzc2luZ1BhdGgpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gRGVsZXRlIGZpbGUsIHJlcGVhdCByZW5hbWUuXG4gICAgICAgICAgICB0aGlzLl9jbGllbnQucmVtb3ZlKG5ld1BhdGgsIChlcnJvcjIpID0+IHtcbiAgICAgICAgICAgICAgaWYgKGVycm9yMikge1xuICAgICAgICAgICAgICAgIGNiKHRoaXMuY29udmVydChlcnJvcjIsIG5ld1BhdGgpKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmFtZShvbGRQYXRoLCBuZXdQYXRoLCBjYik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYigpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIHN0YXQocGF0aDogc3RyaW5nLCBpc0xzdGF0OiBib29sZWFuLCBjYjogKGVycjogQXBpRXJyb3IsIHN0YXQ/OiBTdGF0cykgPT4gdm9pZCk6IHZvaWQge1xuICAgIC8vIElnbm9yZSBsc3RhdCBjYXNlIC0tIERyb3Bib3ggZG9lc24ndCBzdXBwb3J0IHN5bWxpbmtzXG4gICAgLy8gU3RhdCB0aGUgZmlsZVxuICAgIHRoaXMuX2NsaWVudC5zdGF0KHBhdGgsIChlcnJvciwgc3RhdCkgPT4ge1xuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIGNiKHRoaXMuY29udmVydChlcnJvciwgcGF0aCkpO1xuICAgICAgfSBlbHNlIGlmICgoc3RhdCAhPSBudWxsKSAmJiBzdGF0LmlzUmVtb3ZlZCkge1xuICAgICAgICAvLyBEcm9wYm94IGtlZXBzIHRyYWNrIG9mIGRlbGV0ZWQgZmlsZXMsIHNvIGlmIGEgZmlsZSBoYXMgZXhpc3RlZCBpbiB0aGVcbiAgICAgICAgLy8gcGFzdCBidXQgZG9lc24ndCBhbnkgbG9uZ2VyLCB5b3Ugd29udCBnZXQgYW4gZXJyb3JcbiAgICAgICAgY2IoQXBpRXJyb3IuRmlsZUVycm9yKEVycm9yQ29kZS5FTk9FTlQsIHBhdGgpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBzdGF0cyA9IG5ldyBTdGF0cyh0aGlzLl9zdGF0VHlwZShzdGF0KSwgc3RhdC5zaXplKTtcbiAgICAgICAgcmV0dXJuIGNiKG51bGwsIHN0YXRzKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBvcGVuKHBhdGg6IHN0cmluZywgZmxhZ3M6IGZpbGVfZmxhZy5GaWxlRmxhZywgbW9kZTogbnVtYmVyLCBjYjogKGVycjogQXBpRXJyb3IsIGZkPzogZmlsZS5GaWxlKSA9PiBhbnkpOiB2b2lkIHtcbiAgICAvLyBUcnkgYW5kIGdldCB0aGUgZmlsZSdzIGNvbnRlbnRzXG4gICAgdGhpcy5fY2xpZW50LnJlYWRGaWxlKHBhdGgsIChlcnJvciwgY29udGVudCwgZGJTdGF0KSA9PiB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgLy8gSWYgdGhlIGZpbGUncyBiZWluZyBvcGVuZWQgZm9yIHJlYWRpbmcgYW5kIGRvZXNuJ3QgZXhpc3QsIHJldHVybiBhblxuICAgICAgICAvLyBlcnJvclxuICAgICAgICBpZiAoZmxhZ3MuaXNSZWFkYWJsZSgpKSB7XG4gICAgICAgICAgY2IodGhpcy5jb252ZXJ0KGVycm9yLCBwYXRoKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3dpdGNoIChlcnJvci5zdGF0dXMpIHtcbiAgICAgICAgICAgIC8vIElmIGl0J3MgYmVpbmcgb3BlbmVkIGZvciB3cml0aW5nIG9yIGFwcGVuZGluZywgY3JlYXRlIGl0IHNvIHRoYXRcbiAgICAgICAgICAgIC8vIGl0IGNhbiBiZSB3cml0dGVuIHRvXG4gICAgICAgICAgICBjYXNlIERyb3Bib3guQXBpRXJyb3IuTk9UX0ZPVU5EOlxuICAgICAgICAgICAgICB2YXIgYWIgPSBuZXcgQXJyYXlCdWZmZXIoMCk7XG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLl93cml0ZUZpbGVTdHJpY3QocGF0aCwgYWIsIChlcnJvcjI6IEFwaUVycm9yLCBzdGF0PzogRHJvcGJveC5GaWxlLlN0YXQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3IyKSB7XG4gICAgICAgICAgICAgICAgICBjYihlcnJvcjIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICB2YXIgZmlsZSA9IHRoaXMuX21ha2VGaWxlKHBhdGgsIGZsYWdzLCBzdGF0LCBhcnJheUJ1ZmZlcjJCdWZmZXIoYWIpKTtcbiAgICAgICAgICAgICAgICAgIGNiKG51bGwsIGZpbGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICByZXR1cm4gY2IodGhpcy5jb252ZXJ0KGVycm9yLCBwYXRoKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBObyBlcnJvclxuICAgICAgICB2YXIgYnVmZmVyOiBCdWZmZXI7XG4gICAgICAgIC8vIERyb3Bib3guanMgc2VlbXMgdG8gc2V0IGBjb250ZW50YCB0byBgbnVsbGAgcmF0aGVyIHRoYW4gdG8gYW4gZW1wdHlcbiAgICAgICAgLy8gYnVmZmVyIHdoZW4gcmVhZGluZyBhbiBlbXB0eSBmaWxlLiBOb3Qgc3VyZSB3aHkgdGhpcyBpcy5cbiAgICAgICAgaWYgKGNvbnRlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICBidWZmZXIgPSBuZXcgQnVmZmVyKDApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGJ1ZmZlciA9IGFycmF5QnVmZmVyMkJ1ZmZlcihjb250ZW50KTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZmlsZSA9IHRoaXMuX21ha2VGaWxlKHBhdGgsIGZsYWdzLCBkYlN0YXQsIGJ1ZmZlcik7XG4gICAgICAgIHJldHVybiBjYihudWxsLCBmaWxlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBfd3JpdGVGaWxlU3RyaWN0KHA6IHN0cmluZywgZGF0YTogQXJyYXlCdWZmZXIsIGNiOiAoZTogQXBpRXJyb3IsIHN0YXQ/OiBEcm9wYm94LkZpbGUuU3RhdCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciBwYXJlbnQgPSBwYXRoLmRpcm5hbWUocCk7XG4gICAgdGhpcy5zdGF0KHBhcmVudCwgZmFsc2UsIChlcnJvcjogQXBpRXJyb3IsIHN0YXQ/OiBTdGF0cyk6IHZvaWQgPT4ge1xuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIGNiKEFwaUVycm9yLkZpbGVFcnJvcihFcnJvckNvZGUuRU5PRU5ULCBwYXJlbnQpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2NsaWVudC53cml0ZUZpbGUocCwgZGF0YSwgKGVycm9yMiwgc3RhdCkgPT4ge1xuICAgICAgICAgIGlmIChlcnJvcjIpIHtcbiAgICAgICAgICAgIGNiKHRoaXMuY29udmVydChlcnJvcjIsIHApKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2IobnVsbCwgc3RhdCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcml2YXRlXG4gICAqIFJldHVybnMgYSBCcm93c2VyRlMgb2JqZWN0IHJlcHJlc2VudGluZyB0aGUgdHlwZSBvZiBhIERyb3Bib3guanMgc3RhdCBvYmplY3RcbiAgICovXG4gIHB1YmxpYyBfc3RhdFR5cGUoc3RhdDogRHJvcGJveC5GaWxlLlN0YXQpOiBGaWxlVHlwZSB7XG4gICAgcmV0dXJuIHN0YXQuaXNGaWxlID8gRmlsZVR5cGUuRklMRSA6IEZpbGVUeXBlLkRJUkVDVE9SWTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcml2YXRlXG4gICAqIFJldHVybnMgYSBCcm93c2VyRlMgb2JqZWN0IHJlcHJlc2VudGluZyBhIEZpbGUsIGNyZWF0ZWQgZnJvbSB0aGUgZGF0YVxuICAgKiByZXR1cm5lZCBieSBjYWxscyB0byB0aGUgRHJvcGJveCBBUEkuXG4gICAqL1xuICBwdWJsaWMgX21ha2VGaWxlKHBhdGg6IHN0cmluZywgZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnLCBzdGF0OiBEcm9wYm94LkZpbGUuU3RhdCwgYnVmZmVyOiBOb2RlQnVmZmVyKTogRHJvcGJveEZpbGUge1xuICAgIHZhciB0eXBlID0gdGhpcy5fc3RhdFR5cGUoc3RhdCk7XG4gICAgdmFyIHN0YXRzID0gbmV3IFN0YXRzKHR5cGUsIHN0YXQuc2l6ZSk7XG4gICAgcmV0dXJuIG5ldyBEcm9wYm94RmlsZSh0aGlzLCBwYXRoLCBmbGFnLCBzdGF0cywgYnVmZmVyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcml2YXRlXG4gICAqIERlbGV0ZSBhIGZpbGUgb3IgZGlyZWN0b3J5IGZyb20gRHJvcGJveFxuICAgKiBpc0ZpbGUgc2hvdWxkIHJlZmxlY3Qgd2hpY2ggY2FsbCB3YXMgbWFkZSB0byByZW1vdmUgdGhlIGl0IChgdW5saW5rYCBvclxuICAgKiBgcm1kaXJgKS4gSWYgdGhpcyBkb2Vzbid0IG1hdGNoIHdoYXQncyBhY3R1YWxseSBhdCBgcGF0aGAsIGFuIGVycm9yIHdpbGwgYmVcbiAgICogcmV0dXJuZWRcbiAgICovXG4gIHB1YmxpYyBfcmVtb3ZlKHBhdGg6IHN0cmluZywgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQsIGlzRmlsZTogYm9vbGVhbik6IHZvaWQge1xuICAgIHRoaXMuX2NsaWVudC5zdGF0KHBhdGgsIChlcnJvciwgc3RhdCkgPT4ge1xuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIGNiKHRoaXMuY29udmVydChlcnJvciwgcGF0aCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHN0YXQuaXNGaWxlICYmICFpc0ZpbGUpIHtcbiAgICAgICAgICBjYihBcGlFcnJvci5GaWxlRXJyb3IoRXJyb3JDb2RlLkVOT1RESVIsIHBhdGgpKTtcbiAgICAgICAgfSBlbHNlIGlmICghc3RhdC5pc0ZpbGUgJiYgaXNGaWxlKSB7XG4gICAgICAgICAgY2IoQXBpRXJyb3IuRmlsZUVycm9yKEVycm9yQ29kZS5FSVNESVIsIHBhdGgpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9jbGllbnQucmVtb3ZlKHBhdGgsIChlcnJvcikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgIGNiKHRoaXMuY29udmVydChlcnJvciwgcGF0aCkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY2IobnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGUgYSBmaWxlXG4gICAqL1xuICBwdWJsaWMgdW5saW5rKHBhdGg6IHN0cmluZywgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9yZW1vdmUocGF0aCwgY2IsIHRydWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSBhIGRpcmVjdG9yeVxuICAgKi9cbiAgcHVibGljIHJtZGlyKHBhdGg6IHN0cmluZywgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9yZW1vdmUocGF0aCwgY2IsIGZhbHNlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBkaXJlY3RvcnlcbiAgICovXG4gIHB1YmxpYyBta2RpcihwOiBzdHJpbmcsIG1vZGU6IG51bWJlciwgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICAvLyBEcm9wYm94LmpzJyBjbGllbnQubWtkaXIoKSBiZWhhdmVzIGxpa2UgYG1rZGlyIC1wYCwgaS5lLiBpdCBjcmVhdGVzIGFcbiAgICAvLyBkaXJlY3RvcnkgYW5kIGFsbCBpdHMgYW5jZXN0b3JzIGlmIHRoZXkgZG9uJ3QgZXhpc3QuXG4gICAgLy8gTm9kZSdzIGZzLm1rZGlyKCkgYmVoYXZlcyBsaWtlIGBta2RpcmAsIGkuZS4gaXQgdGhyb3dzIGFuIGVycm9yIGlmIGFuIGF0dGVtcHRcbiAgICAvLyBpcyBtYWRlIHRvIGNyZWF0ZSBhIGRpcmVjdG9yeSB3aXRob3V0IGEgcGFyZW50LlxuICAgIC8vIFRvIGhhbmRsZSB0aGlzIGluY29uc2lzdGVuY3ksIGEgY2hlY2sgZm9yIHRoZSBleGlzdGVuY2Ugb2YgYHBhdGhgJ3MgcGFyZW50XG4gICAgLy8gbXVzdCBiZSBwZXJmb3JtZWQgYmVmb3JlIGl0IGlzIGNyZWF0ZWQsIGFuZCBhbiBlcnJvciB0aHJvd24gaWYgaXQgZG9lc1xuICAgIC8vIG5vdCBleGlzdFxuICAgIHZhciBwYXJlbnQgPSBwYXRoLmRpcm5hbWUocCk7XG4gICAgdGhpcy5fY2xpZW50LnN0YXQocGFyZW50LCAoZXJyb3IsIHN0YXQpID0+IHtcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICBjYih0aGlzLmNvbnZlcnQoZXJyb3IsIHBhcmVudCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fY2xpZW50Lm1rZGlyKHAsIChlcnJvcikgPT4ge1xuICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgY2IoQXBpRXJyb3IuRmlsZUVycm9yKEVycm9yQ29kZS5FRVhJU1QsIHApKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2IobnVsbCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIG5hbWVzIG9mIHRoZSBmaWxlcyBpbiBhIGRpcmVjdG9yeVxuICAgKi9cbiAgcHVibGljIHJlYWRkaXIocGF0aDogc3RyaW5nLCBjYjogKGVycjogQXBpRXJyb3IsIGZpbGVzPzogc3RyaW5nW10pID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9jbGllbnQucmVhZGRpcihwYXRoLCAoZXJyb3IsIGZpbGVzKSA9PiB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIGNiKHRoaXMuY29udmVydChlcnJvcikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGNiKG51bGwsIGZpbGVzKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyBhIERyb3Bib3gtSlMgZXJyb3IgaW50byBhIEJGUyBlcnJvci5cbiAgICovXG4gIHB1YmxpYyBjb252ZXJ0KGVycjogRHJvcGJveC5BcGlFcnJvciwgcGF0aDogc3RyaW5nID0gbnVsbCk6IEFwaUVycm9yIHtcbiAgICB2YXIgZXJyb3JDb2RlID0gZXJyb3JDb2RlTG9va3VwW2Vyci5zdGF0dXNdO1xuICAgIGlmIChlcnJvckNvZGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZXJyb3JDb2RlID0gRXJyb3JDb2RlLkVJTztcbiAgICB9XG5cbiAgICBpZiAocGF0aCA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gbmV3IEFwaUVycm9yKGVycm9yQ29kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBBcGlFcnJvci5GaWxlRXJyb3IoZXJyb3JDb2RlLCBwYXRoKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==