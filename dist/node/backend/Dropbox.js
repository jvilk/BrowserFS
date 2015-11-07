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
                var stats = new node_fs_stats_1.Stats(_this._statType(stat), stat.size);
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
        var stats = new node_fs_stats_1.Stats(type, stat.size);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRHJvcGJveC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9iYWNrZW5kL0Ryb3Bib3gudHMiXSwibmFtZXMiOlsiY29uc3RydWN0RXJyb3JDb2RlTG9va3VwIiwiaXNGaWxlSW5mbyIsImlzRGlySW5mbyIsImlzQXJyYXlCdWZmZXIiLCJDYWNoZWREcm9wYm94Q2xpZW50IiwiQ2FjaGVkRHJvcGJveENsaWVudC5jb25zdHJ1Y3RvciIsIkNhY2hlZERyb3Bib3hDbGllbnQuZ2V0Q2FjaGVkSW5mbyIsIkNhY2hlZERyb3Bib3hDbGllbnQucHV0Q2FjaGVkSW5mbyIsIkNhY2hlZERyb3Bib3hDbGllbnQuZGVsZXRlQ2FjaGVkSW5mbyIsIkNhY2hlZERyb3Bib3hDbGllbnQuZ2V0Q2FjaGVkRGlySW5mbyIsIkNhY2hlZERyb3Bib3hDbGllbnQuZ2V0Q2FjaGVkRmlsZUluZm8iLCJDYWNoZWREcm9wYm94Q2xpZW50LnVwZGF0ZUNhY2hlZERpckluZm8iLCJDYWNoZWREcm9wYm94Q2xpZW50LnVwZGF0ZUNhY2hlZEZpbGVJbmZvIiwiQ2FjaGVkRHJvcGJveENsaWVudC51cGRhdGVDYWNoZWRJbmZvIiwiQ2FjaGVkRHJvcGJveENsaWVudC5yZWFkZGlyIiwiQ2FjaGVkRHJvcGJveENsaWVudC5yZW1vdmUiLCJDYWNoZWREcm9wYm94Q2xpZW50Lm1vdmUiLCJDYWNoZWREcm9wYm94Q2xpZW50LnN0YXQiLCJDYWNoZWREcm9wYm94Q2xpZW50LnJlYWRGaWxlIiwiQ2FjaGVkRHJvcGJveENsaWVudC53cml0ZUZpbGUiLCJDYWNoZWREcm9wYm94Q2xpZW50Lm1rZGlyIiwiQ2FjaGVkRHJvcGJveENsaWVudC5fd3JhcCIsIkRyb3Bib3hGaWxlIiwiRHJvcGJveEZpbGUuY29uc3RydWN0b3IiLCJEcm9wYm94RmlsZS5zeW5jIiwiRHJvcGJveEZpbGUuY2xvc2UiLCJEcm9wYm94RmlsZVN5c3RlbSIsIkRyb3Bib3hGaWxlU3lzdGVtLmNvbnN0cnVjdG9yIiwiRHJvcGJveEZpbGVTeXN0ZW0uZ2V0TmFtZSIsIkRyb3Bib3hGaWxlU3lzdGVtLmlzQXZhaWxhYmxlIiwiRHJvcGJveEZpbGVTeXN0ZW0uaXNSZWFkT25seSIsIkRyb3Bib3hGaWxlU3lzdGVtLnN1cHBvcnRzU3ltbGlua3MiLCJEcm9wYm94RmlsZVN5c3RlbS5zdXBwb3J0c1Byb3BzIiwiRHJvcGJveEZpbGVTeXN0ZW0uc3VwcG9ydHNTeW5jaCIsIkRyb3Bib3hGaWxlU3lzdGVtLmVtcHR5IiwiRHJvcGJveEZpbGVTeXN0ZW0ucmVuYW1lIiwiRHJvcGJveEZpbGVTeXN0ZW0uc3RhdCIsIkRyb3Bib3hGaWxlU3lzdGVtLm9wZW4iLCJEcm9wYm94RmlsZVN5c3RlbS5fd3JpdGVGaWxlU3RyaWN0IiwiRHJvcGJveEZpbGVTeXN0ZW0uX3N0YXRUeXBlIiwiRHJvcGJveEZpbGVTeXN0ZW0uX21ha2VGaWxlIiwiRHJvcGJveEZpbGVTeXN0ZW0uX3JlbW92ZSIsIkRyb3Bib3hGaWxlU3lzdGVtLnVubGluayIsIkRyb3Bib3hGaWxlU3lzdGVtLnJtZGlyIiwiRHJvcGJveEZpbGVTeXN0ZW0ubWtkaXIiLCJEcm9wYm94RmlsZVN5c3RlbS5yZWFkZGlyIiwiRHJvcGJveEZpbGVTeXN0ZW0uY29udmVydCJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxJQUFPLFlBQVksV0FBVyx5QkFBeUIsQ0FBQyxDQUFDO0FBQ3pELElBQU8sV0FBVyxXQUFXLHFCQUFxQixDQUFDLENBQUM7QUFFcEQsOEJBQThCLHVCQUF1QixDQUFDLENBQUE7QUFDdEQsMEJBQWtDLG1CQUFtQixDQUFDLENBQUE7QUFFdEQsSUFBTyxLQUFLLFdBQVcsT0FBTyxDQUFDLENBQUM7QUFDaEMsSUFBTyxJQUFJLFdBQVcsTUFBTSxDQUFDLENBQUM7QUFDOUIscUJBQXFELGNBQWMsQ0FBQyxDQUFBO0FBRXBFLElBQUksZUFBZSxHQUE0QyxJQUFJLENBQUM7QUFFcEU7SUFDRUEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsZUFBZUEsS0FBS0EsSUFBSUEsQ0FB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LENBQUNBO1lBQ05BLE1BQU1BLENBQUNBLG9CQUFRQSxDQUFDQSxTQUFTQSxDQUFDQSxTQUFTQSxFQUFFQSxJQUFJQSxDQUFDQSxDQUFDQTtRQUM3Q0EsQ0FBQ0E7SUFDSEEsQ0FBQ0E7SUFDSHBCLHdCQUFDQTtBQUFEQSxDQUFDQSxBQTNSRCxFQUErQyxXQUFXLENBQUMsY0FBYyxFQTJSeEU7QUEzUkQ7c0NBMlJDLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcHJlbG9hZF9maWxlID0gcmVxdWlyZSgnLi4vZ2VuZXJpYy9wcmVsb2FkX2ZpbGUnKTtcbmltcG9ydCBmaWxlX3N5c3RlbSA9IHJlcXVpcmUoJy4uL2NvcmUvZmlsZV9zeXN0ZW0nKTtcbmltcG9ydCBmaWxlX2ZsYWcgPSByZXF1aXJlKCcuLi9jb3JlL2ZpbGVfZmxhZycpO1xuaW1wb3J0IHtTdGF0cywgRmlsZVR5cGV9IGZyb20gJy4uL2NvcmUvbm9kZV9mc19zdGF0cyc7XG5pbXBvcnQge0FwaUVycm9yLCBFcnJvckNvZGV9IGZyb20gJy4uL2NvcmUvYXBpX2Vycm9yJztcbmltcG9ydCBmaWxlID0gcmVxdWlyZSgnLi4vY29yZS9maWxlJyk7XG5pbXBvcnQgYXN5bmMgPSByZXF1aXJlKCdhc3luYycpO1xuaW1wb3J0IHBhdGggPSByZXF1aXJlKCdwYXRoJyk7XG5pbXBvcnQge2FycmF5QnVmZmVyMkJ1ZmZlciwgYnVmZmVyMkFycmF5QnVmZmVyfSBmcm9tICcuLi9jb3JlL3V0aWwnO1xuXG52YXIgZXJyb3JDb2RlTG9va3VwOiB7W2Ryb3Bib3hFcnJvckNvZGU6IG51bWJlcl06IEVycm9yQ29kZX0gPSBudWxsO1xuLy8gTGF6aWx5IGNvbnN0cnVjdCBlcnJvciBjb2RlIGxvb2t1cCwgc2luY2UgRHJvcGJveEpTIG1pZ2h0IGJlIGxvYWRlZCAqYWZ0ZXIqIEJyb3dzZXJGUyAob3Igbm90IGF0IGFsbCEpXG5mdW5jdGlvbiBjb25zdHJ1Y3RFcnJvckNvZGVMb29rdXAoKSB7XG4gIGlmIChlcnJvckNvZGVMb29rdXAgIT09IG51bGwpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgZXJyb3JDb2RlTG9va3VwID0ge307XG4gIC8vIFRoaXMgaW5kaWNhdGVzIGEgbmV0d29yayB0cmFuc21pc3Npb24gZXJyb3Igb24gbW9kZXJuIGJyb3dzZXJzLiBJbnRlcm5ldCBFeHBsb3JlciBtaWdodCBjYXVzZSB0aGlzIGNvZGUgdG8gYmUgcmVwb3J0ZWQgb24gc29tZSBBUEkgc2VydmVyIGVycm9ycy5cbiAgZXJyb3JDb2RlTG9va3VwW0Ryb3Bib3guQXBpRXJyb3IuTkVUV09SS19FUlJPUl0gPSBFcnJvckNvZGUuRUlPO1xuICAvLyBUaGlzIGhhcHBlbnMgd2hlbiB0aGUgY29udGVudEhhc2ggcGFyYW1ldGVyIHBhc3NlZCB0byBhIERyb3Bib3guQ2xpZW50I3JlYWRkaXIgb3IgRHJvcGJveC5DbGllbnQjc3RhdCBtYXRjaGVzIHRoZSBtb3N0IHJlY2VudCBjb250ZW50LCBzbyB0aGUgQVBJIGNhbGwgcmVzcG9uc2UgaXMgb21pdHRlZCwgdG8gc2F2ZSBiYW5kd2lkdGguXG4gIC8vIGVycm9yQ29kZUxvb2t1cFtEcm9wYm94LkFwaUVycm9yLk5PX0NPTlRFTlRdO1xuICAvLyBUaGUgZXJyb3IgcHJvcGVydHkgb24ge0Ryb3Bib3guQXBpRXJyb3IjcmVzcG9uc2V9IHNob3VsZCBpbmRpY2F0ZSB3aGljaCBpbnB1dCBwYXJhbWV0ZXIgaXMgaW52YWxpZCBhbmQgd2h5LlxuICBlcnJvckNvZGVMb29rdXBbRHJvcGJveC5BcGlFcnJvci5JTlZBTElEX1BBUkFNXSA9IEVycm9yQ29kZS5FSU5WQUw7XG4gIC8vIFRoZSBPQXV0aCB0b2tlbiB1c2VkIGZvciB0aGUgcmVxdWVzdCB3aWxsIG5ldmVyIGJlY29tZSB2YWxpZCBhZ2Fpbiwgc28gdGhlIHVzZXIgc2hvdWxkIGJlIHJlLWF1dGhlbnRpY2F0ZWQuXG4gIGVycm9yQ29kZUxvb2t1cFtEcm9wYm94LkFwaUVycm9yLklOVkFMSURfVE9LRU5dID0gRXJyb3JDb2RlLkVQRVJNO1xuICAvLyBUaGlzIGluZGljYXRlcyBhIGJ1ZyBpbiBkcm9wYm94LmpzIGFuZCBzaG91bGQgbmV2ZXIgb2NjdXIgdW5kZXIgbm9ybWFsIGNpcmN1bXN0YW5jZXMuXG4gIC8vIF4gQWN0dWFsbHksIHRoYXQncyBmYWxzZS4gVGhpcyBvY2N1cnMgd2hlbiB5b3UgdHJ5IHRvIG1vdmUgZm9sZGVycyB0byB0aGVtc2VsdmVzLCBvciBtb3ZlIGEgZmlsZSBvdmVyIGFub3RoZXIgZmlsZS5cbiAgZXJyb3JDb2RlTG9va3VwW0Ryb3Bib3guQXBpRXJyb3IuT0FVVEhfRVJST1JdID0gRXJyb3JDb2RlLkVQRVJNO1xuICAvLyBUaGlzIGhhcHBlbnMgd2hlbiB0cnlpbmcgdG8gcmVhZCBmcm9tIGEgbm9uLWV4aXN0aW5nIGZpbGUsIHJlYWRkaXIgYSBub24tZXhpc3RpbmcgZGlyZWN0b3J5LCB3cml0ZSBhIGZpbGUgaW50byBhIG5vbi1leGlzdGluZyBkaXJlY3RvcnksIGV0Yy5cbiAgZXJyb3JDb2RlTG9va3VwW0Ryb3Bib3guQXBpRXJyb3IuTk9UX0ZPVU5EXSA9IEVycm9yQ29kZS5FTk9FTlQ7XG4gIC8vIFRoaXMgaW5kaWNhdGVzIGEgYnVnIGluIGRyb3Bib3guanMgYW5kIHNob3VsZCBuZXZlciBvY2N1ciB1bmRlciBub3JtYWwgY2lyY3Vtc3RhbmNlcy5cbiAgZXJyb3JDb2RlTG9va3VwW0Ryb3Bib3guQXBpRXJyb3IuSU5WQUxJRF9NRVRIT0RdID0gRXJyb3JDb2RlLkVJTlZBTDtcbiAgLy8gVGhpcyBoYXBwZW5zIHdoZW4gYSBEcm9wYm94LkNsaWVudCNyZWFkZGlyIG9yIERyb3Bib3guQ2xpZW50I3N0YXQgY2FsbCB3b3VsZCByZXR1cm4gbW9yZSB0aGFuIGEgbWF4aW11bSBhbW91bnQgb2YgZGlyZWN0b3J5IGVudHJpZXMuXG4gIGVycm9yQ29kZUxvb2t1cFtEcm9wYm94LkFwaUVycm9yLk5PVF9BQ0NFUFRBQkxFXSA9IEVycm9yQ29kZS5FSU5WQUw7XG4gIC8vIFRoaXMgaXMgdXNlZCBieSBzb21lIGJhY2tlbmQgbWV0aG9kcyB0byBpbmRpY2F0ZSB0aGF0IHRoZSBjbGllbnQgbmVlZHMgdG8gZG93bmxvYWQgc2VydmVyLXNpZGUgY2hhbmdlcyBhbmQgcGVyZm9ybSBjb25mbGljdCByZXNvbHV0aW9uLiBVbmRlciBub3JtYWwgdXNhZ2UsIGVycm9ycyB3aXRoIHRoaXMgY29kZSBzaG91bGQgbmV2ZXIgc3VyZmFjZSB0byB0aGUgY29kZSB1c2luZyBkcm9wYm94LmpzLlxuICBlcnJvckNvZGVMb29rdXBbRHJvcGJveC5BcGlFcnJvci5DT05GTElDVF0gPSBFcnJvckNvZGUuRUlOVkFMO1xuICAvLyBTdGF0dXMgdmFsdWUgaW5kaWNhdGluZyB0aGF0IHRoZSBhcHBsaWNhdGlvbiBpcyBtYWtpbmcgdG9vIG1hbnkgcmVxdWVzdHMuXG4gIGVycm9yQ29kZUxvb2t1cFtEcm9wYm94LkFwaUVycm9yLlJBVEVfTElNSVRFRF0gPSBFcnJvckNvZGUuRUJVU1k7XG4gIC8vIFRoZSByZXF1ZXN0IHNob3VsZCBiZSByZXRyaWVkIGFmdGVyIHNvbWUgdGltZS5cbiAgZXJyb3JDb2RlTG9va3VwW0Ryb3Bib3guQXBpRXJyb3IuU0VSVkVSX0VSUk9SXSA9IEVycm9yQ29kZS5FQlVTWTtcbiAgLy8gU3RhdHVzIHZhbHVlIGluZGljYXRpbmcgdGhhdCB0aGUgdXNlcidzIERyb3Bib3ggaXMgb3ZlciBpdHMgc3RvcmFnZSBxdW90YS5cbiAgZXJyb3JDb2RlTG9va3VwW0Ryb3Bib3guQXBpRXJyb3IuT1ZFUl9RVU9UQV0gPSBFcnJvckNvZGUuRU5PU1BDO1xufVxuXG5pbnRlcmZhY2UgSUNhY2hlZFBhdGhJbmZvIHtcbiAgc3RhdDogRHJvcGJveC5GaWxlLlN0YXQ7XG59XG5cbmludGVyZmFjZSBJQ2FjaGVkRmlsZUluZm8gZXh0ZW5kcyBJQ2FjaGVkUGF0aEluZm8ge1xuICBjb250ZW50czogQXJyYXlCdWZmZXI7XG59XG5cbmZ1bmN0aW9uIGlzRmlsZUluZm8oY2FjaGU6IElDYWNoZWRQYXRoSW5mbyk6IGNhY2hlIGlzIElDYWNoZWRGaWxlSW5mbyB7XG4gIHJldHVybiBjYWNoZSAmJiBjYWNoZS5zdGF0LmlzRmlsZTtcbn1cblxuaW50ZXJmYWNlIElDYWNoZWREaXJJbmZvIGV4dGVuZHMgSUNhY2hlZFBhdGhJbmZvIHtcbiAgY29udGVudHM6IHN0cmluZ1tdO1xufVxuXG5mdW5jdGlvbiBpc0RpckluZm8oY2FjaGU6IElDYWNoZWRQYXRoSW5mbyk6IGNhY2hlIGlzIElDYWNoZWREaXJJbmZvIHtcbiAgcmV0dXJuIGNhY2hlICYmIGNhY2hlLnN0YXQuaXNGb2xkZXI7XG59XG5cbmZ1bmN0aW9uIGlzQXJyYXlCdWZmZXIoYWI6IGFueSk6IGFiIGlzIEFycmF5QnVmZmVyIHtcbiAgLy8gQWNjZXB0IG51bGwgLyB1bmRlZmluZWQsIHRvby5cbiAgcmV0dXJuIGFiID09PSBudWxsIHx8IGFiID09PSB1bmRlZmluZWQgfHwgKHR5cGVvZihhYikgPT09ICdvYmplY3QnICYmIHR5cGVvZihhYlsnYnl0ZUxlbmd0aCddKSA9PT0gJ251bWJlcicpO1xufVxuXG4vKipcbiAqIFdyYXBzIGEgRHJvcGJveCBjbGllbnQgYW5kIGNhY2hlcyBvcGVyYXRpb25zLlxuICovXG5jbGFzcyBDYWNoZWREcm9wYm94Q2xpZW50IHtcbiAgcHJpdmF0ZSBfY2FjaGU6IHtbcGF0aDogc3RyaW5nXTogSUNhY2hlZFBhdGhJbmZvfSA9IHt9O1xuICBwcml2YXRlIF9jbGllbnQ6IERyb3Bib3guQ2xpZW50O1xuXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogRHJvcGJveC5DbGllbnQpIHtcbiAgICB0aGlzLl9jbGllbnQgPSBjbGllbnQ7XG4gIH1cblxuICBwcml2YXRlIGdldENhY2hlZEluZm8ocDogc3RyaW5nKTogSUNhY2hlZFBhdGhJbmZvIHtcbiAgICByZXR1cm4gdGhpcy5fY2FjaGVbcC50b0xvd2VyQ2FzZSgpXTtcbiAgfVxuXG4gIHByaXZhdGUgcHV0Q2FjaGVkSW5mbyhwOiBzdHJpbmcsIGNhY2hlOiBJQ2FjaGVkUGF0aEluZm8pOiB2b2lkIHtcbiAgICB0aGlzLl9jYWNoZVtwLnRvTG93ZXJDYXNlKCldID0gY2FjaGU7XG4gIH1cblxuICBwcml2YXRlIGRlbGV0ZUNhY2hlZEluZm8ocDogc3RyaW5nKTogdm9pZCB7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlW3AudG9Mb3dlckNhc2UoKV07XG4gIH1cblxuICBwcml2YXRlIGdldENhY2hlZERpckluZm8ocDogc3RyaW5nKTogSUNhY2hlZERpckluZm8ge1xuICAgIHZhciBpbmZvID0gdGhpcy5nZXRDYWNoZWRJbmZvKHApO1xuICAgIGlmIChpc0RpckluZm8oaW5mbykpIHtcbiAgICAgIHJldHVybiBpbmZvO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldENhY2hlZEZpbGVJbmZvKHA6IHN0cmluZyk6IElDYWNoZWRGaWxlSW5mbyB7XG4gICAgdmFyIGluZm8gPSB0aGlzLmdldENhY2hlZEluZm8ocCk7XG4gICAgaWYgKGlzRmlsZUluZm8oaW5mbykpIHtcbiAgICAgIHJldHVybiBpbmZvO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUNhY2hlZERpckluZm8ocDogc3RyaW5nLCBzdGF0OiBEcm9wYm94LkZpbGUuU3RhdCwgY29udGVudHM6IHN0cmluZ1tdID0gbnVsbCk6IHZvaWQge1xuICAgIHZhciBjYWNoZWRJbmZvID0gdGhpcy5nZXRDYWNoZWRJbmZvKHApO1xuICAgIC8vIERyb3Bib3ggdXNlcyB0aGUgKmNvbnRlbnRIYXNoKiBwcm9wZXJ0eSBmb3IgZGlyZWN0b3JpZXMuXG4gICAgLy8gSWdub3JlIHN0YXQgb2JqZWN0cyB3L28gYSBjb250ZW50SGFzaCBkZWZpbmVkOyB0aG9zZSBhY3R1YWxseSBleGlzdCEhIVxuICAgIC8vIChFeGFtcGxlOiByZWFkZGlyIHJldHVybnMgYW4gYXJyYXkgb2Ygc3RhdCBvYmpzOyBzdGF0IG9ianMgZm9yIGRpcnMgaW4gdGhhdCBjb250ZXh0IGhhdmUgbm8gY29udGVudEhhc2gpXG4gICAgaWYgKHN0YXQuY29udGVudEhhc2ggIT09IG51bGwgJiYgKGNhY2hlZEluZm8gPT09IHVuZGVmaW5lZCB8fCBjYWNoZWRJbmZvLnN0YXQuY29udGVudEhhc2ggIT09IHN0YXQuY29udGVudEhhc2gpKSB7XG4gICAgICB0aGlzLnB1dENhY2hlZEluZm8ocCwgPElDYWNoZWREaXJJbmZvPiB7XG4gICAgICAgIHN0YXQ6IHN0YXQsXG4gICAgICAgIGNvbnRlbnRzOiBjb250ZW50c1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVDYWNoZWRGaWxlSW5mbyhwOiBzdHJpbmcsIHN0YXQ6IERyb3Bib3guRmlsZS5TdGF0LCBjb250ZW50czogQXJyYXlCdWZmZXIgPSBudWxsKTogdm9pZCB7XG4gICAgdmFyIGNhY2hlZEluZm8gPSB0aGlzLmdldENhY2hlZEluZm8ocCk7XG4gICAgLy8gRHJvcGJveCB1c2VzIHRoZSAqdmVyc2lvblRhZyogcHJvcGVydHkgZm9yIGZpbGVzLlxuICAgIC8vIElnbm9yZSBzdGF0IG9iamVjdHMgdy9vIGEgdmVyc2lvblRhZyBkZWZpbmVkLlxuICAgIGlmIChzdGF0LnZlcnNpb25UYWcgIT09IG51bGwgJiYgKGNhY2hlZEluZm8gPT09IHVuZGVmaW5lZCB8fCBjYWNoZWRJbmZvLnN0YXQudmVyc2lvblRhZyAhPT0gc3RhdC52ZXJzaW9uVGFnKSkge1xuICAgICAgdGhpcy5wdXRDYWNoZWRJbmZvKHAsIDxJQ2FjaGVkRmlsZUluZm8+IHtcbiAgICAgICAgc3RhdDogc3RhdCxcbiAgICAgICAgY29udGVudHM6IGNvbnRlbnRzXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUNhY2hlZEluZm8ocDogc3RyaW5nLCBzdGF0OiBEcm9wYm94LkZpbGUuU3RhdCwgY29udGVudHM6IEFycmF5QnVmZmVyIHwgc3RyaW5nW10gPSBudWxsKTogdm9pZCB7XG4gICAgaWYgKHN0YXQuaXNGaWxlICYmIGlzQXJyYXlCdWZmZXIoY29udGVudHMpKSB7XG4gICAgICB0aGlzLnVwZGF0ZUNhY2hlZEZpbGVJbmZvKHAsIHN0YXQsIGNvbnRlbnRzKTtcbiAgICB9IGVsc2UgaWYgKHN0YXQuaXNGb2xkZXIgJiYgQXJyYXkuaXNBcnJheShjb250ZW50cykpIHtcbiAgICAgIHRoaXMudXBkYXRlQ2FjaGVkRGlySW5mbyhwLCBzdGF0LCBjb250ZW50cyk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHJlYWRkaXIocDogc3RyaW5nLCBjYjogKGVycm9yOiBEcm9wYm94LkFwaUVycm9yLCBjb250ZW50cz86IHN0cmluZ1tdKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIGNhY2hlSW5mbyA9IHRoaXMuZ2V0Q2FjaGVkRGlySW5mbyhwKTtcblxuICAgIHRoaXMuX3dyYXAoKGludGVyY2VwdENiKSA9PiB7XG4gICAgICBpZiAoY2FjaGVJbmZvICE9PSBudWxsICYmIGNhY2hlSW5mby5jb250ZW50cykge1xuICAgICAgICB0aGlzLl9jbGllbnQucmVhZGRpcihwLCB7XG4gICAgICAgICAgY29udGVudEhhc2g6IGNhY2hlSW5mby5zdGF0LmNvbnRlbnRIYXNoXG4gICAgICAgIH0sIGludGVyY2VwdENiKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2NsaWVudC5yZWFkZGlyKHAsIGludGVyY2VwdENiKTtcbiAgICAgIH1cbiAgICB9LCAoZXJyOiBEcm9wYm94LkFwaUVycm9yLCBmaWxlbmFtZXM6IHN0cmluZ1tdLCBzdGF0OiBEcm9wYm94LkZpbGUuU3RhdCwgZm9sZGVyRW50cmllczogRHJvcGJveC5GaWxlLlN0YXRbXSkgPT4ge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBpZiAoZXJyLnN0YXR1cyA9PT0gRHJvcGJveC5BcGlFcnJvci5OT19DT05URU5UICYmIGNhY2hlSW5mbyAhPT0gbnVsbCkge1xuICAgICAgICAgIGNiKG51bGwsIGNhY2hlSW5mby5jb250ZW50cy5zbGljZSgwKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy51cGRhdGVDYWNoZWREaXJJbmZvKHAsIHN0YXQsIGZpbGVuYW1lcy5zbGljZSgwKSk7XG4gICAgICAgIGZvbGRlckVudHJpZXMuZm9yRWFjaCgoZW50cnkpID0+IHtcbiAgICAgICAgICB0aGlzLnVwZGF0ZUNhY2hlZEluZm8ocGF0aC5qb2luKHAsIGVudHJ5Lm5hbWUpLCBlbnRyeSk7XG4gICAgICAgIH0pO1xuICAgICAgICBjYihudWxsLCBmaWxlbmFtZXMpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIHJlbW92ZShwOiBzdHJpbmcsIGNiOiAoZXJyb3I/OiBEcm9wYm94LkFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fd3JhcCgoaW50ZXJjZXB0Q2IpID0+IHtcbiAgICAgIHRoaXMuX2NsaWVudC5yZW1vdmUocCwgaW50ZXJjZXB0Q2IpO1xuICAgIH0sIChlcnI6IERyb3Bib3guQXBpRXJyb3IsIHN0YXQ/OiBEcm9wYm94LkZpbGUuU3RhdCkgPT4ge1xuICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgdGhpcy51cGRhdGVDYWNoZWRJbmZvKHAsIHN0YXQpO1xuICAgICAgfVxuICAgICAgY2IoZXJyKTtcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBtb3ZlKHNyYzogc3RyaW5nLCBkZXN0OiBzdHJpbmcsIGNiOiAoZXJyb3I/OiBEcm9wYm94LkFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fd3JhcCgoaW50ZXJjZXB0Q2IpID0+IHtcbiAgICAgIHRoaXMuX2NsaWVudC5tb3ZlKHNyYywgZGVzdCwgaW50ZXJjZXB0Q2IpO1xuICAgIH0sIChlcnI6IERyb3Bib3guQXBpRXJyb3IsIHN0YXQ6IERyb3Bib3guRmlsZS5TdGF0KSA9PiB7XG4gICAgICBpZiAoIWVycikge1xuICAgICAgICB0aGlzLmRlbGV0ZUNhY2hlZEluZm8oc3JjKTtcbiAgICAgICAgdGhpcy51cGRhdGVDYWNoZWRJbmZvKGRlc3QsIHN0YXQpO1xuICAgICAgfVxuICAgICAgY2IoZXJyKTtcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBzdGF0KHA6IHN0cmluZywgY2I6IChlcnJvcjogRHJvcGJveC5BcGlFcnJvciwgc3RhdD86IERyb3Bib3guRmlsZS5TdGF0KSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fd3JhcCgoaW50ZXJjZXB0Q2IpID0+IHtcbiAgICAgIHRoaXMuX2NsaWVudC5zdGF0KHAsIGludGVyY2VwdENiKTtcbiAgICB9LCAoZXJyOiBEcm9wYm94LkFwaUVycm9yLCBzdGF0OiBEcm9wYm94LkZpbGUuU3RhdCkgPT4ge1xuICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgdGhpcy51cGRhdGVDYWNoZWRJbmZvKHAsIHN0YXQpO1xuICAgICAgfVxuICAgICAgY2IoZXJyLCBzdGF0KTtcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyByZWFkRmlsZShwOiBzdHJpbmcsIGNiOiAoZXJyb3I6IERyb3Bib3guQXBpRXJyb3IsIGZpbGU/OiBBcnJheUJ1ZmZlciwgc3RhdD86IERyb3Bib3guRmlsZS5TdGF0KSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIGNhY2hlSW5mbyA9IHRoaXMuZ2V0Q2FjaGVkRmlsZUluZm8ocCk7XG4gICAgaWYgKGNhY2hlSW5mbyAhPT0gbnVsbCAmJiBjYWNoZUluZm8uY29udGVudHMgIT09IG51bGwpIHtcbiAgICAgIC8vIFRyeSB0byB1c2UgY2FjaGVkIGluZm87IGlzc3VlIGEgc3RhdCB0byBzZWUgaWYgY29udGVudHMgYXJlIHVwLXRvLWRhdGUuXG4gICAgICB0aGlzLnN0YXQocCwgKGVycm9yLCBzdGF0PykgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICBjYihlcnJvcik7XG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdC5jb250ZW50SGFzaCA9PT0gY2FjaGVJbmZvLnN0YXQuY29udGVudEhhc2gpIHtcbiAgICAgICAgICAvLyBObyBmaWxlIGNoYW5nZXMuXG4gICAgICAgICAgY2IoZXJyb3IsIGNhY2hlSW5mby5jb250ZW50cy5zbGljZSgwKSwgY2FjaGVJbmZvLnN0YXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEZpbGUgY2hhbmdlczsgcmVydW4gdG8gdHJpZ2dlciBhY3R1YWwgcmVhZEZpbGUuXG4gICAgICAgICAgdGhpcy5yZWFkRmlsZShwLCBjYik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl93cmFwKChpbnRlcmNlcHRDYikgPT4ge1xuICAgICAgICB0aGlzLl9jbGllbnQucmVhZEZpbGUocCwgeyBhcnJheUJ1ZmZlcjogdHJ1ZSB9LCBpbnRlcmNlcHRDYik7XG4gICAgICB9LCAoZXJyOiBEcm9wYm94LkFwaUVycm9yLCBjb250ZW50czogYW55LCBzdGF0OiBEcm9wYm94LkZpbGUuU3RhdCkgPT4ge1xuICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgIHRoaXMudXBkYXRlQ2FjaGVkSW5mbyhwLCBzdGF0LCBjb250ZW50cy5zbGljZSgwKSk7XG4gICAgICAgIH1cbiAgICAgICAgY2IoZXJyLCBjb250ZW50cywgc3RhdCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgd3JpdGVGaWxlKHA6IHN0cmluZywgY29udGVudHM6IEFycmF5QnVmZmVyLCBjYjogKGVycm9yOiBEcm9wYm94LkFwaUVycm9yLCBzdGF0PzogRHJvcGJveC5GaWxlLlN0YXQpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl93cmFwKChpbnRlcmNlcHRDYikgPT4ge1xuICAgICAgdGhpcy5fY2xpZW50LndyaXRlRmlsZShwLCBjb250ZW50cywgaW50ZXJjZXB0Q2IpO1xuICAgIH0sKGVycjogRHJvcGJveC5BcGlFcnJvciwgc3RhdDogRHJvcGJveC5GaWxlLlN0YXQpID0+IHtcbiAgICAgIGlmICghZXJyKSB7XG4gICAgICAgIHRoaXMudXBkYXRlQ2FjaGVkSW5mbyhwLCBzdGF0LCBjb250ZW50cy5zbGljZSgwKSk7XG4gICAgICB9XG4gICAgICBjYihlcnIsIHN0YXQpO1xuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIG1rZGlyKHA6IHN0cmluZywgY2I6IChlcnJvcj86IERyb3Bib3guQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl93cmFwKChpbnRlcmNlcHRDYikgPT4ge1xuICAgICAgdGhpcy5fY2xpZW50Lm1rZGlyKHAsIGludGVyY2VwdENiKTtcbiAgICB9LCAoZXJyOiBEcm9wYm94LkFwaUVycm9yLCBzdGF0OiBEcm9wYm94LkZpbGUuU3RhdCkgPT4ge1xuICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgdGhpcy51cGRhdGVDYWNoZWRJbmZvKHAsIHN0YXQsIFtdKTtcbiAgICAgIH1cbiAgICAgIGNiKGVycik7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogV3JhcHMgYW4gb3BlcmF0aW9uIHN1Y2ggdGhhdCB3ZSByZXRyeSBhIGZhaWxlZCBvcGVyYXRpb24gMyB0aW1lcy5cbiAgICogTmVjZXNzYXJ5IHRvIGRlYWwgd2l0aCBEcm9wYm94IHJhdGUgbGltaXRpbmcuXG4gICAqXG4gICAqIEBwYXJhbSBwZXJmb3JtT3AgRnVuY3Rpb24gdGhhdCBwZXJmb3JtcyB0aGUgb3BlcmF0aW9uLiBXaWxsIGJlIGNhbGxlZCB1cCB0byB0aHJlZSB0aW1lcy5cbiAgICogQHBhcmFtIGNiIENhbGxlZCB3aGVuIHRoZSBvcGVyYXRpb24gc3VjY2VlZHMsIGZhaWxzIGluIGEgbm9uLXRlbXBvcmFyeSBtYW5uZXIsIG9yIGZhaWxzIHRocmVlIHRpbWVzLlxuICAgKi9cbiAgcHJpdmF0ZSBfd3JhcChwZXJmb3JtT3A6IChpbnRlcmNlcHRDYjogKGVycm9yOiBEcm9wYm94LkFwaUVycm9yKSA9PiB2b2lkKSA9PiB2b2lkLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB2YXIgbnVtUnVuID0gMCxcbiAgICAgIGludGVyY2VwdENiID0gZnVuY3Rpb24gKGVycm9yOiBEcm9wYm94LkFwaUVycm9yKTogdm9pZCB7XG4gICAgICAgIC8vIFRpbWVvdXQgZHVyYXRpb24sIGluIHNlY29uZHMuXG4gICAgICAgIHZhciB0aW1lb3V0RHVyYXRpb246IG51bWJlciA9IDI7XG4gICAgICAgIGlmIChlcnJvciAmJiAzID4gKCsrbnVtUnVuKSkge1xuICAgICAgICAgIHN3aXRjaChlcnJvci5zdGF0dXMpIHtcbiAgICAgICAgICAgIGNhc2UgRHJvcGJveC5BcGlFcnJvci5TRVJWRVJfRVJST1I6XG4gICAgICAgICAgICBjYXNlIERyb3Bib3guQXBpRXJyb3IuTkVUV09SS19FUlJPUjpcbiAgICAgICAgICAgIGNhc2UgRHJvcGJveC5BcGlFcnJvci5SQVRFX0xJTUlURUQ6XG4gICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgIHBlcmZvcm1PcChpbnRlcmNlcHRDYik7XG4gICAgICAgICAgICAgIH0sIHRpbWVvdXREdXJhdGlvbiAqIDEwMDApO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgIGNiLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjYi5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgcGVyZm9ybU9wKGludGVyY2VwdENiKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRHJvcGJveEZpbGUgZXh0ZW5kcyBwcmVsb2FkX2ZpbGUuUHJlbG9hZEZpbGU8RHJvcGJveEZpbGVTeXN0ZW0+IGltcGxlbWVudHMgZmlsZS5GaWxlIHtcbiAgY29uc3RydWN0b3IoX2ZzOiBEcm9wYm94RmlsZVN5c3RlbSwgX3BhdGg6IHN0cmluZywgX2ZsYWc6IGZpbGVfZmxhZy5GaWxlRmxhZywgX3N0YXQ6IFN0YXRzLCBjb250ZW50cz86IE5vZGVCdWZmZXIpIHtcbiAgICBzdXBlcihfZnMsIF9wYXRoLCBfZmxhZywgX3N0YXQsIGNvbnRlbnRzKVxuICB9XG5cbiAgcHVibGljIHN5bmMoY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5pc0RpcnR5KCkpIHtcbiAgICAgIHZhciBidWZmZXIgPSB0aGlzLmdldEJ1ZmZlcigpLFxuICAgICAgICBhcnJheUJ1ZmZlciA9IGJ1ZmZlcjJBcnJheUJ1ZmZlcihidWZmZXIpO1xuICAgICAgdGhpcy5fZnMuX3dyaXRlRmlsZVN0cmljdCh0aGlzLmdldFBhdGgoKSwgYXJyYXlCdWZmZXIsIChlPzogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgaWYgKCFlKSB7XG4gICAgICAgICAgdGhpcy5yZXNldERpcnR5KCk7XG4gICAgICAgIH1cbiAgICAgICAgY2IoZSk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2IoKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgY2xvc2UoY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLnN5bmMoY2IpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIERyb3Bib3hGaWxlU3lzdGVtIGV4dGVuZHMgZmlsZV9zeXN0ZW0uQmFzZUZpbGVTeXN0ZW0gaW1wbGVtZW50cyBmaWxlX3N5c3RlbS5GaWxlU3lzdGVtIHtcbiAgLy8gVGhlIERyb3Bib3ggY2xpZW50LlxuICBwcml2YXRlIF9jbGllbnQ6IENhY2hlZERyb3Bib3hDbGllbnQ7XG5cbiAgLyoqXG4gICAqIEFyZ3VtZW50czogYW4gYXV0aGVudGljYXRlZCBEcm9wYm94LmpzIGNsaWVudFxuICAgKi9cbiAgY29uc3RydWN0b3IoY2xpZW50OiBEcm9wYm94LkNsaWVudCkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fY2xpZW50ID0gbmV3IENhY2hlZERyb3Bib3hDbGllbnQoY2xpZW50KTtcbiAgICBjb25zdHJ1Y3RFcnJvckNvZGVMb29rdXAoKTtcbiAgfVxuXG4gIHB1YmxpYyBnZXROYW1lKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuICdEcm9wYm94JztcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgaXNBdmFpbGFibGUoKTogYm9vbGVhbiB7XG4gICAgLy8gQ2hlY2tzIGlmIHRoZSBEcm9wYm94IGxpYnJhcnkgaXMgbG9hZGVkLlxuICAgIHJldHVybiB0eXBlb2YgRHJvcGJveCAhPT0gJ3VuZGVmaW5lZCc7XG4gIH1cblxuICBwdWJsaWMgaXNSZWFkT25seSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBEcm9wYm94IGRvZXNuJ3Qgc3VwcG9ydCBzeW1saW5rcywgcHJvcGVydGllcywgb3Igc3luY2hyb25vdXMgY2FsbHNcblxuICBwdWJsaWMgc3VwcG9ydHNTeW1saW5rcygpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwdWJsaWMgc3VwcG9ydHNQcm9wcygpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwdWJsaWMgc3VwcG9ydHNTeW5jaCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwdWJsaWMgZW1wdHkobWFpbkNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fY2xpZW50LnJlYWRkaXIoJy8nLCAoZXJyb3IsIGZpbGVzKSA9PiB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgbWFpbkNiKHRoaXMuY29udmVydChlcnJvciwgJy8nKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgZGVsZXRlRmlsZSA9IChmaWxlOiBzdHJpbmcsIGNiOiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQpID0+IHtcbiAgICAgICAgICB2YXIgcCA9IHBhdGguam9pbignLycsIGZpbGUpO1xuICAgICAgICAgIHRoaXMuX2NsaWVudC5yZW1vdmUocCwgKGVycikgPT4ge1xuICAgICAgICAgICAgY2IoZXJyID8gdGhpcy5jb252ZXJ0KGVyciwgcCkgOiBudWxsKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgdmFyIGZpbmlzaGVkID0gKGVycj86IEFwaUVycm9yKSA9PiB7XG4gICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgbWFpbkNiKGVycik7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1haW5DYigpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgLy8gWFhYOiA8YW55PiB0eXBpbmcgaXMgdG8gZ2V0IGFyb3VuZCBvdmVybHktcmVzdHJpY3RpdmUgRXJyb3JDYWxsYmFjayB0eXBpbmcuXG4gICAgICAgIGFzeW5jLmVhY2goZmlsZXMsIDxhbnk+IGRlbGV0ZUZpbGUsIDxhbnk+IGZpbmlzaGVkKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gcHVibGljIHJlbmFtZShvbGRQYXRoOiBzdHJpbmcsIG5ld1BhdGg6IHN0cmluZywgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9jbGllbnQubW92ZShvbGRQYXRoLCBuZXdQYXRoLCAoZXJyb3IpID0+IHtcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAvLyB0aGUgbW92ZSBpcyBwZXJtaXR0ZWQgaWYgbmV3UGF0aCBpcyBhIGZpbGUuXG4gICAgICAgIC8vIENoZWNrIGlmIHRoaXMgaXMgdGhlIGNhc2UsIGFuZCByZW1vdmUgaWYgc28uXG4gICAgICAgIHRoaXMuX2NsaWVudC5zdGF0KG5ld1BhdGgsIChlcnJvcjIsIHN0YXQpID0+IHtcbiAgICAgICAgICBpZiAoZXJyb3IyIHx8IHN0YXQuaXNGb2xkZXIpIHtcbiAgICAgICAgICAgIHZhciBtaXNzaW5nUGF0aCA9ICg8YW55PiBlcnJvci5yZXNwb25zZSkuZXJyb3IuaW5kZXhPZihvbGRQYXRoKSA+IC0xID8gb2xkUGF0aCA6IG5ld1BhdGg7XG4gICAgICAgICAgICBjYih0aGlzLmNvbnZlcnQoZXJyb3IsIG1pc3NpbmdQYXRoKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIERlbGV0ZSBmaWxlLCByZXBlYXQgcmVuYW1lLlxuICAgICAgICAgICAgdGhpcy5fY2xpZW50LnJlbW92ZShuZXdQYXRoLCAoZXJyb3IyKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChlcnJvcjIpIHtcbiAgICAgICAgICAgICAgICBjYih0aGlzLmNvbnZlcnQoZXJyb3IyLCBuZXdQYXRoKSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5hbWUob2xkUGF0aCwgbmV3UGF0aCwgY2IpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2IoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBzdGF0KHBhdGg6IHN0cmluZywgaXNMc3RhdDogYm9vbGVhbiwgY2I6IChlcnI6IEFwaUVycm9yLCBzdGF0PzogU3RhdHMpID0+IHZvaWQpOiB2b2lkIHtcbiAgICAvLyBJZ25vcmUgbHN0YXQgY2FzZSAtLSBEcm9wYm94IGRvZXNuJ3Qgc3VwcG9ydCBzeW1saW5rc1xuICAgIC8vIFN0YXQgdGhlIGZpbGVcbiAgICB0aGlzLl9jbGllbnQuc3RhdChwYXRoLCAoZXJyb3IsIHN0YXQpID0+IHtcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICBjYih0aGlzLmNvbnZlcnQoZXJyb3IsIHBhdGgpKTtcbiAgICAgIH0gZWxzZSBpZiAoKHN0YXQgIT0gbnVsbCkgJiYgc3RhdC5pc1JlbW92ZWQpIHtcbiAgICAgICAgLy8gRHJvcGJveCBrZWVwcyB0cmFjayBvZiBkZWxldGVkIGZpbGVzLCBzbyBpZiBhIGZpbGUgaGFzIGV4aXN0ZWQgaW4gdGhlXG4gICAgICAgIC8vIHBhc3QgYnV0IGRvZXNuJ3QgYW55IGxvbmdlciwgeW91IHdvbnQgZ2V0IGFuIGVycm9yXG4gICAgICAgIGNiKEFwaUVycm9yLkZpbGVFcnJvcihFcnJvckNvZGUuRU5PRU5ULCBwYXRoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgc3RhdHMgPSBuZXcgU3RhdHModGhpcy5fc3RhdFR5cGUoc3RhdCksIHN0YXQuc2l6ZSk7XG4gICAgICAgIHJldHVybiBjYihudWxsLCBzdGF0cyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgb3BlbihwYXRoOiBzdHJpbmcsIGZsYWdzOiBmaWxlX2ZsYWcuRmlsZUZsYWcsIG1vZGU6IG51bWJlciwgY2I6IChlcnI6IEFwaUVycm9yLCBmZD86IGZpbGUuRmlsZSkgPT4gYW55KTogdm9pZCB7XG4gICAgLy8gVHJ5IGFuZCBnZXQgdGhlIGZpbGUncyBjb250ZW50c1xuICAgIHRoaXMuX2NsaWVudC5yZWFkRmlsZShwYXRoLCAoZXJyb3IsIGNvbnRlbnQsIGRiU3RhdCkgPT4ge1xuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIC8vIElmIHRoZSBmaWxlJ3MgYmVpbmcgb3BlbmVkIGZvciByZWFkaW5nIGFuZCBkb2Vzbid0IGV4aXN0LCByZXR1cm4gYW5cbiAgICAgICAgLy8gZXJyb3JcbiAgICAgICAgaWYgKGZsYWdzLmlzUmVhZGFibGUoKSkge1xuICAgICAgICAgIGNiKHRoaXMuY29udmVydChlcnJvciwgcGF0aCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN3aXRjaCAoZXJyb3Iuc3RhdHVzKSB7XG4gICAgICAgICAgICAvLyBJZiBpdCdzIGJlaW5nIG9wZW5lZCBmb3Igd3JpdGluZyBvciBhcHBlbmRpbmcsIGNyZWF0ZSBpdCBzbyB0aGF0XG4gICAgICAgICAgICAvLyBpdCBjYW4gYmUgd3JpdHRlbiB0b1xuICAgICAgICAgICAgY2FzZSBEcm9wYm94LkFwaUVycm9yLk5PVF9GT1VORDpcbiAgICAgICAgICAgICAgdmFyIGFiID0gbmV3IEFycmF5QnVmZmVyKDApO1xuICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fd3JpdGVGaWxlU3RyaWN0KHBhdGgsIGFiLCAoZXJyb3IyOiBBcGlFcnJvciwgc3RhdD86IERyb3Bib3guRmlsZS5TdGF0KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yMikge1xuICAgICAgICAgICAgICAgICAgY2IoZXJyb3IyKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgdmFyIGZpbGUgPSB0aGlzLl9tYWtlRmlsZShwYXRoLCBmbGFncywgc3RhdCwgYXJyYXlCdWZmZXIyQnVmZmVyKGFiKSk7XG4gICAgICAgICAgICAgICAgICBjYihudWxsLCBmaWxlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgcmV0dXJuIGNiKHRoaXMuY29udmVydChlcnJvciwgcGF0aCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTm8gZXJyb3JcbiAgICAgICAgdmFyIGJ1ZmZlcjogQnVmZmVyO1xuICAgICAgICAvLyBEcm9wYm94LmpzIHNlZW1zIHRvIHNldCBgY29udGVudGAgdG8gYG51bGxgIHJhdGhlciB0aGFuIHRvIGFuIGVtcHR5XG4gICAgICAgIC8vIGJ1ZmZlciB3aGVuIHJlYWRpbmcgYW4gZW1wdHkgZmlsZS4gTm90IHN1cmUgd2h5IHRoaXMgaXMuXG4gICAgICAgIGlmIChjb250ZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgYnVmZmVyID0gbmV3IEJ1ZmZlcigwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBidWZmZXIgPSBhcnJheUJ1ZmZlcjJCdWZmZXIoY29udGVudCk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGZpbGUgPSB0aGlzLl9tYWtlRmlsZShwYXRoLCBmbGFncywgZGJTdGF0LCBidWZmZXIpO1xuICAgICAgICByZXR1cm4gY2IobnVsbCwgZmlsZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgX3dyaXRlRmlsZVN0cmljdChwOiBzdHJpbmcsIGRhdGE6IEFycmF5QnVmZmVyLCBjYjogKGU6IEFwaUVycm9yLCBzdGF0PzogRHJvcGJveC5GaWxlLlN0YXQpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgcGFyZW50ID0gcGF0aC5kaXJuYW1lKHApO1xuICAgIHRoaXMuc3RhdChwYXJlbnQsIGZhbHNlLCAoZXJyb3I6IEFwaUVycm9yLCBzdGF0PzogU3RhdHMpOiB2b2lkID0+IHtcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICBjYihBcGlFcnJvci5GaWxlRXJyb3IoRXJyb3JDb2RlLkVOT0VOVCwgcGFyZW50KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9jbGllbnQud3JpdGVGaWxlKHAsIGRhdGEsIChlcnJvcjIsIHN0YXQpID0+IHtcbiAgICAgICAgICBpZiAoZXJyb3IyKSB7XG4gICAgICAgICAgICBjYih0aGlzLmNvbnZlcnQoZXJyb3IyLCBwKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNiKG51bGwsIHN0YXQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUHJpdmF0ZVxuICAgKiBSZXR1cm5zIGEgQnJvd3NlckZTIG9iamVjdCByZXByZXNlbnRpbmcgdGhlIHR5cGUgb2YgYSBEcm9wYm94LmpzIHN0YXQgb2JqZWN0XG4gICAqL1xuICBwdWJsaWMgX3N0YXRUeXBlKHN0YXQ6IERyb3Bib3guRmlsZS5TdGF0KTogRmlsZVR5cGUge1xuICAgIHJldHVybiBzdGF0LmlzRmlsZSA/IEZpbGVUeXBlLkZJTEUgOiBGaWxlVHlwZS5ESVJFQ1RPUlk7XG4gIH1cblxuICAvKipcbiAgICogUHJpdmF0ZVxuICAgKiBSZXR1cm5zIGEgQnJvd3NlckZTIG9iamVjdCByZXByZXNlbnRpbmcgYSBGaWxlLCBjcmVhdGVkIGZyb20gdGhlIGRhdGFcbiAgICogcmV0dXJuZWQgYnkgY2FsbHMgdG8gdGhlIERyb3Bib3ggQVBJLlxuICAgKi9cbiAgcHVibGljIF9tYWtlRmlsZShwYXRoOiBzdHJpbmcsIGZsYWc6IGZpbGVfZmxhZy5GaWxlRmxhZywgc3RhdDogRHJvcGJveC5GaWxlLlN0YXQsIGJ1ZmZlcjogTm9kZUJ1ZmZlcik6IERyb3Bib3hGaWxlIHtcbiAgICB2YXIgdHlwZSA9IHRoaXMuX3N0YXRUeXBlKHN0YXQpO1xuICAgIHZhciBzdGF0cyA9IG5ldyBTdGF0cyh0eXBlLCBzdGF0LnNpemUpO1xuICAgIHJldHVybiBuZXcgRHJvcGJveEZpbGUodGhpcywgcGF0aCwgZmxhZywgc3RhdHMsIGJ1ZmZlcik7XG4gIH1cblxuICAvKipcbiAgICogUHJpdmF0ZVxuICAgKiBEZWxldGUgYSBmaWxlIG9yIGRpcmVjdG9yeSBmcm9tIERyb3Bib3hcbiAgICogaXNGaWxlIHNob3VsZCByZWZsZWN0IHdoaWNoIGNhbGwgd2FzIG1hZGUgdG8gcmVtb3ZlIHRoZSBpdCAoYHVubGlua2Agb3JcbiAgICogYHJtZGlyYCkuIElmIHRoaXMgZG9lc24ndCBtYXRjaCB3aGF0J3MgYWN0dWFsbHkgYXQgYHBhdGhgLCBhbiBlcnJvciB3aWxsIGJlXG4gICAqIHJldHVybmVkXG4gICAqL1xuICBwdWJsaWMgX3JlbW92ZShwYXRoOiBzdHJpbmcsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkLCBpc0ZpbGU6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICB0aGlzLl9jbGllbnQuc3RhdChwYXRoLCAoZXJyb3IsIHN0YXQpID0+IHtcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICBjYih0aGlzLmNvbnZlcnQoZXJyb3IsIHBhdGgpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChzdGF0LmlzRmlsZSAmJiAhaXNGaWxlKSB7XG4gICAgICAgICAgY2IoQXBpRXJyb3IuRmlsZUVycm9yKEVycm9yQ29kZS5FTk9URElSLCBwYXRoKSk7XG4gICAgICAgIH0gZWxzZSBpZiAoIXN0YXQuaXNGaWxlICYmIGlzRmlsZSkge1xuICAgICAgICAgIGNiKEFwaUVycm9yLkZpbGVFcnJvcihFcnJvckNvZGUuRUlTRElSLCBwYXRoKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fY2xpZW50LnJlbW92ZShwYXRoLCAoZXJyb3IpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICBjYih0aGlzLmNvbnZlcnQoZXJyb3IsIHBhdGgpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNiKG51bGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIGEgZmlsZVxuICAgKi9cbiAgcHVibGljIHVubGluayhwYXRoOiBzdHJpbmcsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fcmVtb3ZlKHBhdGgsIGNiLCB0cnVlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGUgYSBkaXJlY3RvcnlcbiAgICovXG4gIHB1YmxpYyBybWRpcihwYXRoOiBzdHJpbmcsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fcmVtb3ZlKHBhdGgsIGNiLCBmYWxzZSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgZGlyZWN0b3J5XG4gICAqL1xuICBwdWJsaWMgbWtkaXIocDogc3RyaW5nLCBtb2RlOiBudW1iZXIsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgLy8gRHJvcGJveC5qcycgY2xpZW50Lm1rZGlyKCkgYmVoYXZlcyBsaWtlIGBta2RpciAtcGAsIGkuZS4gaXQgY3JlYXRlcyBhXG4gICAgLy8gZGlyZWN0b3J5IGFuZCBhbGwgaXRzIGFuY2VzdG9ycyBpZiB0aGV5IGRvbid0IGV4aXN0LlxuICAgIC8vIE5vZGUncyBmcy5ta2RpcigpIGJlaGF2ZXMgbGlrZSBgbWtkaXJgLCBpLmUuIGl0IHRocm93cyBhbiBlcnJvciBpZiBhbiBhdHRlbXB0XG4gICAgLy8gaXMgbWFkZSB0byBjcmVhdGUgYSBkaXJlY3Rvcnkgd2l0aG91dCBhIHBhcmVudC5cbiAgICAvLyBUbyBoYW5kbGUgdGhpcyBpbmNvbnNpc3RlbmN5LCBhIGNoZWNrIGZvciB0aGUgZXhpc3RlbmNlIG9mIGBwYXRoYCdzIHBhcmVudFxuICAgIC8vIG11c3QgYmUgcGVyZm9ybWVkIGJlZm9yZSBpdCBpcyBjcmVhdGVkLCBhbmQgYW4gZXJyb3IgdGhyb3duIGlmIGl0IGRvZXNcbiAgICAvLyBub3QgZXhpc3RcbiAgICB2YXIgcGFyZW50ID0gcGF0aC5kaXJuYW1lKHApO1xuICAgIHRoaXMuX2NsaWVudC5zdGF0KHBhcmVudCwgKGVycm9yLCBzdGF0KSA9PiB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgY2IodGhpcy5jb252ZXJ0KGVycm9yLCBwYXJlbnQpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2NsaWVudC5ta2RpcihwLCAoZXJyb3IpID0+IHtcbiAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNiKEFwaUVycm9yLkZpbGVFcnJvcihFcnJvckNvZGUuRUVYSVNULCBwKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNiKG51bGwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBuYW1lcyBvZiB0aGUgZmlsZXMgaW4gYSBkaXJlY3RvcnlcbiAgICovXG4gIHB1YmxpYyByZWFkZGlyKHBhdGg6IHN0cmluZywgY2I6IChlcnI6IEFwaUVycm9yLCBmaWxlcz86IHN0cmluZ1tdKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fY2xpZW50LnJlYWRkaXIocGF0aCwgKGVycm9yLCBmaWxlcykgPT4ge1xuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIHJldHVybiBjYih0aGlzLmNvbnZlcnQoZXJyb3IpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBjYihudWxsLCBmaWxlcyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydHMgYSBEcm9wYm94LUpTIGVycm9yIGludG8gYSBCRlMgZXJyb3IuXG4gICAqL1xuICBwdWJsaWMgY29udmVydChlcnI6IERyb3Bib3guQXBpRXJyb3IsIHBhdGg6IHN0cmluZyA9IG51bGwpOiBBcGlFcnJvciB7XG4gICAgdmFyIGVycm9yQ29kZSA9IGVycm9yQ29kZUxvb2t1cFtlcnIuc3RhdHVzXTtcbiAgICBpZiAoZXJyb3JDb2RlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGVycm9yQ29kZSA9IEVycm9yQ29kZS5FSU87XG4gICAgfVxuXG4gICAgaWYgKHBhdGggPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG5ldyBBcGlFcnJvcihlcnJvckNvZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gQXBpRXJyb3IuRmlsZUVycm9yKGVycm9yQ29kZSwgcGF0aCk7XG4gICAgfVxuICB9XG59XG4iXX0=