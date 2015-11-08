var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var file_system = require('../core/file_system');
var api_error_1 = require('../core/api_error');
var file_flag = require('../core/file_flag');
var util_1 = require('../core/util');
var file = require('../core/file');
var node_fs_stats_1 = require('../core/node_fs_stats');
var preload_file = require('../generic/preload_file');
var global = require('../core/global');
var fs = require('../core/node_fs');
var SpecialArgType;
(function (SpecialArgType) {
    SpecialArgType[SpecialArgType["CB"] = 0] = "CB";
    SpecialArgType[SpecialArgType["FD"] = 1] = "FD";
    SpecialArgType[SpecialArgType["API_ERROR"] = 2] = "API_ERROR";
    SpecialArgType[SpecialArgType["STATS"] = 3] = "STATS";
    SpecialArgType[SpecialArgType["PROBE"] = 4] = "PROBE";
    SpecialArgType[SpecialArgType["FILEFLAG"] = 5] = "FILEFLAG";
    SpecialArgType[SpecialArgType["BUFFER"] = 6] = "BUFFER";
    SpecialArgType[SpecialArgType["ERROR"] = 7] = "ERROR";
})(SpecialArgType || (SpecialArgType = {}));
var CallbackArgumentConverter = (function () {
    function CallbackArgumentConverter() {
        this._callbacks = {};
        this._nextId = 0;
    }
    CallbackArgumentConverter.prototype.toRemoteArg = function (cb) {
        var id = this._nextId++;
        this._callbacks[id] = cb;
        return {
            type: SpecialArgType.CB,
            id: id
        };
    };
    CallbackArgumentConverter.prototype.toLocalArg = function (id) {
        var cb = this._callbacks[id];
        delete this._callbacks[id];
        return cb;
    };
    return CallbackArgumentConverter;
})();
var FileDescriptorArgumentConverter = (function () {
    function FileDescriptorArgumentConverter() {
        this._fileDescriptors = {};
        this._nextId = 0;
    }
    FileDescriptorArgumentConverter.prototype.toRemoteArg = function (fd, p, flag, cb) {
        var id = this._nextId++, data, stat, argsLeft = 2;
        this._fileDescriptors[id] = fd;
        fd.stat(function (err, stats) {
            if (err) {
                cb(err);
            }
            else {
                stat = bufferToTransferrableObject(stats.toBuffer());
                if (flag.isReadable()) {
                    fd.read(new Buffer(stats.size), 0, stats.size, 0, function (err, bytesRead, buff) {
                        if (err) {
                            cb(err);
                        }
                        else {
                            data = bufferToTransferrableObject(buff);
                            cb(null, {
                                type: SpecialArgType.FD,
                                id: id,
                                data: data,
                                stat: stat,
                                path: p,
                                flag: flag.getFlagString()
                            });
                        }
                    });
                }
                else {
                    cb(null, {
                        type: SpecialArgType.FD,
                        id: id,
                        data: new ArrayBuffer(0),
                        stat: stat,
                        path: p,
                        flag: flag.getFlagString()
                    });
                }
            }
        });
    };
    FileDescriptorArgumentConverter.prototype._applyFdChanges = function (remoteFd, cb) {
        var fd = this._fileDescriptors[remoteFd.id], data = transferrableObjectToBuffer(remoteFd.data), remoteStats = node_fs_stats_1.default.fromBuffer(transferrableObjectToBuffer(remoteFd.stat));
        var flag = file_flag.FileFlag.getFileFlag(remoteFd.flag);
        if (flag.isWriteable()) {
            fd.write(data, 0, data.length, flag.isAppendable() ? fd.getPos() : 0, function (e) {
                if (e) {
                    cb(e);
                }
                else {
                    function applyStatChanges() {
                        fd.stat(function (e, stats) {
                            if (e) {
                                cb(e);
                            }
                            else {
                                if (stats.mode !== remoteStats.mode) {
                                    fd.chmod(remoteStats.mode, function (e) {
                                        cb(e, fd);
                                    });
                                }
                                else {
                                    cb(e, fd);
                                }
                            }
                        });
                    }
                    if (!flag.isAppendable()) {
                        fd.truncate(data.length, function () {
                            applyStatChanges();
                        });
                    }
                    else {
                        applyStatChanges();
                    }
                }
            });
        }
        else {
            cb(null, fd);
        }
    };
    FileDescriptorArgumentConverter.prototype.applyFdAPIRequest = function (request, cb) {
        var _this = this;
        var fdArg = request.args[0];
        this._applyFdChanges(fdArg, function (err, fd) {
            if (err) {
                cb(err);
            }
            else {
                fd[request.method](function (e) {
                    if (request.method === 'close') {
                        delete _this._fileDescriptors[fdArg.id];
                    }
                    cb(e);
                });
            }
        });
    };
    return FileDescriptorArgumentConverter;
})();
function apiErrorLocal2Remote(e) {
    return {
        type: SpecialArgType.API_ERROR,
        errorData: bufferToTransferrableObject(e.writeToBuffer())
    };
}
function apiErrorRemote2Local(e) {
    return api_error_1.ApiError.fromBuffer(transferrableObjectToBuffer(e.errorData));
}
function errorLocal2Remote(e) {
    return {
        type: SpecialArgType.ERROR,
        name: e.name,
        message: e.message,
        stack: e.stack
    };
}
function errorRemote2Local(e) {
    var cnstr = global[e.name];
    if (typeof (cnstr) !== 'function') {
        cnstr = Error;
    }
    var err = new cnstr(e.message);
    err.stack = e.stack;
    return err;
}
function statsLocal2Remote(stats) {
    return {
        type: SpecialArgType.STATS,
        statsData: bufferToTransferrableObject(stats.toBuffer())
    };
}
function statsRemote2Local(stats) {
    return node_fs_stats_1.default.fromBuffer(transferrableObjectToBuffer(stats.statsData));
}
function fileFlagLocal2Remote(flag) {
    return {
        type: SpecialArgType.FILEFLAG,
        flagStr: flag.getFlagString()
    };
}
function fileFlagRemote2Local(remoteFlag) {
    return file_flag.FileFlag.getFileFlag(remoteFlag.flagStr);
}
function bufferToTransferrableObject(buff) {
    return util_1.buffer2ArrayBuffer(buff);
}
function transferrableObjectToBuffer(buff) {
    return util_1.arrayBuffer2Buffer(buff);
}
function bufferLocal2Remote(buff) {
    return {
        type: SpecialArgType.BUFFER,
        data: bufferToTransferrableObject(buff)
    };
}
function bufferRemote2Local(buffArg) {
    return transferrableObjectToBuffer(buffArg.data);
}
function isAPIRequest(data) {
    return data != null && typeof data === 'object' && data.hasOwnProperty('browserfsMessage') && data['browserfsMessage'];
}
function isAPIResponse(data) {
    return data != null && typeof data === 'object' && data.hasOwnProperty('browserfsMessage') && data['browserfsMessage'];
}
var WorkerFile = (function (_super) {
    __extends(WorkerFile, _super);
    function WorkerFile(_fs, _path, _flag, _stat, remoteFdId, contents) {
        _super.call(this, _fs, _path, _flag, _stat, contents);
        this._remoteFdId = remoteFdId;
    }
    WorkerFile.prototype.getRemoteFdId = function () {
        return this._remoteFdId;
    };
    WorkerFile.prototype.toRemoteArg = function () {
        return {
            type: SpecialArgType.FD,
            id: this._remoteFdId,
            data: bufferToTransferrableObject(this.getBuffer()),
            stat: bufferToTransferrableObject(this.getStats().toBuffer()),
            path: this.getPath(),
            flag: this.getFlag().getFlagString()
        };
    };
    WorkerFile.prototype._syncClose = function (type, cb) {
        var _this = this;
        if (this.isDirty()) {
            this._fs.syncClose(type, this, function (e) {
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
    WorkerFile.prototype.sync = function (cb) {
        this._syncClose('sync', cb);
    };
    WorkerFile.prototype.close = function (cb) {
        this._syncClose('close', cb);
    };
    return WorkerFile;
})(preload_file.PreloadFile);
var WorkerFS = (function (_super) {
    __extends(WorkerFS, _super);
    function WorkerFS(worker) {
        var _this = this;
        _super.call(this);
        this._callbackConverter = new CallbackArgumentConverter();
        this._isInitialized = false;
        this._isReadOnly = false;
        this._supportLinks = false;
        this._supportProps = false;
        this._outstandingRequests = {};
        this._worker = worker;
        this._worker.addEventListener('message', function (e) {
            var resp = e.data;
            if (isAPIResponse(resp)) {
                var i, args = resp.args, fixedArgs = new Array(args.length);
                for (i = 0; i < fixedArgs.length; i++) {
                    fixedArgs[i] = _this._argRemote2Local(args[i]);
                }
                _this._callbackConverter.toLocalArg(resp.cbId).apply(null, fixedArgs);
            }
        });
    }
    WorkerFS.isAvailable = function () {
        return typeof Worker !== 'undefined';
    };
    WorkerFS.prototype.getName = function () {
        return 'WorkerFS';
    };
    WorkerFS.prototype._argRemote2Local = function (arg) {
        if (arg == null) {
            return arg;
        }
        switch (typeof arg) {
            case 'object':
                if (arg['type'] != null && typeof arg['type'] === 'number') {
                    var specialArg = arg;
                    switch (specialArg.type) {
                        case SpecialArgType.API_ERROR:
                            return apiErrorRemote2Local(specialArg);
                        case SpecialArgType.FD:
                            var fdArg = specialArg;
                            return new WorkerFile(this, fdArg.path, file_flag.FileFlag.getFileFlag(fdArg.flag), node_fs_stats_1.default.fromBuffer(transferrableObjectToBuffer(fdArg.stat)), fdArg.id, transferrableObjectToBuffer(fdArg.data));
                        case SpecialArgType.STATS:
                            return statsRemote2Local(specialArg);
                        case SpecialArgType.FILEFLAG:
                            return fileFlagRemote2Local(specialArg);
                        case SpecialArgType.BUFFER:
                            return bufferRemote2Local(specialArg);
                        case SpecialArgType.ERROR:
                            return errorRemote2Local(specialArg);
                        default:
                            return arg;
                    }
                }
                else {
                    return arg;
                }
            default:
                return arg;
        }
    };
    WorkerFS.prototype._argLocal2Remote = function (arg) {
        if (arg == null) {
            return arg;
        }
        switch (typeof arg) {
            case "object":
                if (arg instanceof node_fs_stats_1.default) {
                    return statsLocal2Remote(arg);
                }
                else if (arg instanceof api_error_1.ApiError) {
                    return apiErrorLocal2Remote(arg);
                }
                else if (arg instanceof WorkerFile) {
                    return arg.toRemoteArg();
                }
                else if (arg instanceof file_flag.FileFlag) {
                    return fileFlagLocal2Remote(arg);
                }
                else if (arg instanceof Buffer) {
                    return bufferLocal2Remote(arg);
                }
                else if (arg instanceof Error) {
                    return errorLocal2Remote(arg);
                }
                else {
                    return "Unknown argument";
                }
            case "function":
                return this._callbackConverter.toRemoteArg(arg);
            default:
                return arg;
        }
    };
    WorkerFS.prototype.initialize = function (cb) {
        var _this = this;
        if (!this._isInitialized) {
            var message = {
                browserfsMessage: true,
                method: 'probe',
                args: [this._argLocal2Remote(new Buffer(0)), this._callbackConverter.toRemoteArg(function (probeResponse) {
                        _this._isInitialized = true;
                        _this._isReadOnly = probeResponse.isReadOnly;
                        _this._supportLinks = probeResponse.supportsLinks;
                        _this._supportProps = probeResponse.supportsProps;
                        cb();
                    })]
            };
            this._worker.postMessage(message);
        }
        else {
            cb();
        }
    };
    WorkerFS.prototype.isReadOnly = function () { return this._isReadOnly; };
    WorkerFS.prototype.supportsSynch = function () { return false; };
    WorkerFS.prototype.supportsLinks = function () { return this._supportLinks; };
    WorkerFS.prototype.supportsProps = function () { return this._supportProps; };
    WorkerFS.prototype._rpc = function (methodName, args) {
        var message = {
            browserfsMessage: true,
            method: methodName,
            args: null
        }, fixedArgs = new Array(args.length), i;
        for (i = 0; i < args.length; i++) {
            fixedArgs[i] = this._argLocal2Remote(args[i]);
        }
        message.args = fixedArgs;
        this._worker.postMessage(message);
    };
    WorkerFS.prototype.rename = function (oldPath, newPath, cb) {
        this._rpc('rename', arguments);
    };
    WorkerFS.prototype.stat = function (p, isLstat, cb) {
        this._rpc('stat', arguments);
    };
    WorkerFS.prototype.open = function (p, flag, mode, cb) {
        this._rpc('open', arguments);
    };
    WorkerFS.prototype.unlink = function (p, cb) {
        this._rpc('unlink', arguments);
    };
    WorkerFS.prototype.rmdir = function (p, cb) {
        this._rpc('rmdir', arguments);
    };
    WorkerFS.prototype.mkdir = function (p, mode, cb) {
        this._rpc('mkdir', arguments);
    };
    WorkerFS.prototype.readdir = function (p, cb) {
        this._rpc('readdir', arguments);
    };
    WorkerFS.prototype.exists = function (p, cb) {
        this._rpc('exists', arguments);
    };
    WorkerFS.prototype.realpath = function (p, cache, cb) {
        this._rpc('realpath', arguments);
    };
    WorkerFS.prototype.truncate = function (p, len, cb) {
        this._rpc('truncate', arguments);
    };
    WorkerFS.prototype.readFile = function (fname, encoding, flag, cb) {
        this._rpc('readFile', arguments);
    };
    WorkerFS.prototype.writeFile = function (fname, data, encoding, flag, mode, cb) {
        this._rpc('writeFile', arguments);
    };
    WorkerFS.prototype.appendFile = function (fname, data, encoding, flag, mode, cb) {
        this._rpc('appendFile', arguments);
    };
    WorkerFS.prototype.chmod = function (p, isLchmod, mode, cb) {
        this._rpc('chmod', arguments);
    };
    WorkerFS.prototype.chown = function (p, isLchown, uid, gid, cb) {
        this._rpc('chown', arguments);
    };
    WorkerFS.prototype.utimes = function (p, atime, mtime, cb) {
        this._rpc('utimes', arguments);
    };
    WorkerFS.prototype.link = function (srcpath, dstpath, cb) {
        this._rpc('link', arguments);
    };
    WorkerFS.prototype.symlink = function (srcpath, dstpath, type, cb) {
        this._rpc('symlink', arguments);
    };
    WorkerFS.prototype.readlink = function (p, cb) {
        this._rpc('readlink', arguments);
    };
    WorkerFS.prototype.syncClose = function (method, fd, cb) {
        this._worker.postMessage({
            browserfsMessage: true,
            method: method,
            args: [fd.toRemoteArg(), this._callbackConverter.toRemoteArg(cb)]
        });
    };
    WorkerFS.attachRemoteListener = function (worker) {
        var fdConverter = new FileDescriptorArgumentConverter();
        function argLocal2Remote(arg, requestArgs, cb) {
            switch (typeof arg) {
                case 'object':
                    if (arg instanceof node_fs_stats_1.default) {
                        cb(null, statsLocal2Remote(arg));
                    }
                    else if (arg instanceof api_error_1.ApiError) {
                        cb(null, apiErrorLocal2Remote(arg));
                    }
                    else if (arg instanceof file.BaseFile) {
                        cb(null, fdConverter.toRemoteArg(arg, requestArgs[0], requestArgs[1], cb));
                    }
                    else if (arg instanceof file_flag.FileFlag) {
                        cb(null, fileFlagLocal2Remote(arg));
                    }
                    else if (arg instanceof Buffer) {
                        cb(null, bufferLocal2Remote(arg));
                    }
                    else if (arg instanceof Error) {
                        cb(null, errorLocal2Remote(arg));
                    }
                    else {
                        cb(null, arg);
                    }
                    break;
                default:
                    cb(null, arg);
                    break;
            }
        }
        function argRemote2Local(arg, fixedRequestArgs) {
            if (arg == null) {
                return arg;
            }
            switch (typeof arg) {
                case 'object':
                    if (typeof arg['type'] === 'number') {
                        var specialArg = arg;
                        switch (specialArg.type) {
                            case SpecialArgType.CB:
                                var cbId = arg.id;
                                return function () {
                                    var i, fixedArgs = new Array(arguments.length), message, countdown = arguments.length;
                                    function abortAndSendError(err) {
                                        if (countdown > 0) {
                                            countdown = -1;
                                            message = {
                                                browserfsMessage: true,
                                                cbId: cbId,
                                                args: [apiErrorLocal2Remote(err)]
                                            };
                                            worker.postMessage(message);
                                        }
                                    }
                                    for (i = 0; i < arguments.length; i++) {
                                        (function (i, arg) {
                                            argLocal2Remote(arg, fixedRequestArgs, function (err, fixedArg) {
                                                fixedArgs[i] = fixedArg;
                                                if (err) {
                                                    abortAndSendError(err);
                                                }
                                                else if (--countdown === 0) {
                                                    message = {
                                                        browserfsMessage: true,
                                                        cbId: cbId,
                                                        args: fixedArgs
                                                    };
                                                    worker.postMessage(message);
                                                }
                                            });
                                        })(i, arguments[i]);
                                    }
                                    if (arguments.length === 0) {
                                        message = {
                                            browserfsMessage: true,
                                            cbId: cbId,
                                            args: fixedArgs
                                        };
                                        worker.postMessage(message);
                                    }
                                };
                            case SpecialArgType.API_ERROR:
                                return apiErrorRemote2Local(specialArg);
                            case SpecialArgType.STATS:
                                return statsRemote2Local(specialArg);
                            case SpecialArgType.FILEFLAG:
                                return fileFlagRemote2Local(specialArg);
                            case SpecialArgType.BUFFER:
                                return bufferRemote2Local(specialArg);
                            case SpecialArgType.ERROR:
                                return errorRemote2Local(specialArg);
                            default:
                                return arg;
                        }
                    }
                    else {
                        return arg;
                    }
                default:
                    return arg;
            }
        }
        worker.addEventListener('message', function (e) {
            var request = e.data;
            if (isAPIRequest(request)) {
                var args = request.args, fixedArgs = new Array(args.length), i;
                switch (request.method) {
                    case 'close':
                    case 'sync':
                        (function () {
                            var remoteCb = args[1];
                            fdConverter.applyFdAPIRequest(request, function (err) {
                                var response = {
                                    browserfsMessage: true,
                                    cbId: remoteCb.id,
                                    args: err ? [apiErrorLocal2Remote(err)] : []
                                };
                                worker.postMessage(response);
                            });
                        })();
                        break;
                    case 'probe':
                        (function () {
                            var rootFs = fs.getRootFS(), remoteCb = args[1], probeResponse = {
                                type: SpecialArgType.PROBE,
                                isReadOnly: rootFs.isReadOnly(),
                                supportsLinks: rootFs.supportsLinks(),
                                supportsProps: rootFs.supportsProps()
                            }, response = {
                                browserfsMessage: true,
                                cbId: remoteCb.id,
                                args: [probeResponse]
                            };
                            worker.postMessage(response);
                        })();
                        break;
                    default:
                        for (i = 0; i < args.length; i++) {
                            fixedArgs[i] = argRemote2Local(args[i], fixedArgs);
                        }
                        var rootFS = fs.getRootFS();
                        rootFS[request.method].apply(rootFS, fixedArgs);
                        break;
                }
            }
        });
    };
    return WorkerFS;
})(file_system.BaseFileSystem);
exports.__esModule = true;
exports["default"] = WorkerFS;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiV29ya2VyRlMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvYmFja2VuZC9Xb3JrZXJGUy50cyJdLCJuYW1lcyI6WyJTcGVjaWFsQXJnVHlwZSIsIkNhbGxiYWNrQXJndW1lbnRDb252ZXJ0ZXIiLCJDYWxsYmFja0FyZ3VtZW50Q29udmVydGVyLmNvbnN0cnVjdG9yIiwiQ2FsbGJhY2tBcmd1bWVudENvbnZlcnRlci50b1JlbW90ZUFyZyIsIkNhbGxiYWNrQXJndW1lbnRDb252ZXJ0ZXIudG9Mb2NhbEFyZyIsIkZpbGVEZXNjcmlwdG9yQXJndW1lbnRDb252ZXJ0ZXIiLCJGaWxlRGVzY3JpcHRvckFyZ3VtZW50Q29udmVydGVyLmNvbnN0cnVjdG9yIiwiRmlsZURlc2NyaXB0b3JBcmd1bWVudENvbnZlcnRlci50b1JlbW90ZUFyZyIsIkZpbGVEZXNjcmlwdG9yQXJndW1lbnRDb252ZXJ0ZXIuX2FwcGx5RmRDaGFuZ2VzIiwiRmlsZURlc2NyaXB0b3JBcmd1bWVudENvbnZlcnRlci5fYXBwbHlGZENoYW5nZXMuYXBwbHlTdGF0Q2hhbmdlcyIsIkZpbGVEZXNjcmlwdG9yQXJndW1lbnRDb252ZXJ0ZXIuYXBwbHlGZEFQSVJlcXVlc3QiLCJhcGlFcnJvckxvY2FsMlJlbW90ZSIsImFwaUVycm9yUmVtb3RlMkxvY2FsIiwiZXJyb3JMb2NhbDJSZW1vdGUiLCJlcnJvclJlbW90ZTJMb2NhbCIsInN0YXRzTG9jYWwyUmVtb3RlIiwic3RhdHNSZW1vdGUyTG9jYWwiLCJmaWxlRmxhZ0xvY2FsMlJlbW90ZSIsImZpbGVGbGFnUmVtb3RlMkxvY2FsIiwiYnVmZmVyVG9UcmFuc2ZlcnJhYmxlT2JqZWN0IiwidHJhbnNmZXJyYWJsZU9iamVjdFRvQnVmZmVyIiwiYnVmZmVyTG9jYWwyUmVtb3RlIiwiYnVmZmVyUmVtb3RlMkxvY2FsIiwiaXNBUElSZXF1ZXN0IiwiaXNBUElSZXNwb25zZSIsIldvcmtlckZpbGUiLCJXb3JrZXJGaWxlLmNvbnN0cnVjdG9yIiwiV29ya2VyRmlsZS5nZXRSZW1vdGVGZElkIiwiV29ya2VyRmlsZS50b1JlbW90ZUFyZyIsIldvcmtlckZpbGUuX3N5bmNDbG9zZSIsIldvcmtlckZpbGUuc3luYyIsIldvcmtlckZpbGUuY2xvc2UiLCJXb3JrZXJGUyIsIldvcmtlckZTLmNvbnN0cnVjdG9yIiwiV29ya2VyRlMuaXNBdmFpbGFibGUiLCJXb3JrZXJGUy5nZXROYW1lIiwiV29ya2VyRlMuX2FyZ1JlbW90ZTJMb2NhbCIsIldvcmtlckZTLl9hcmdMb2NhbDJSZW1vdGUiLCJXb3JrZXJGUy5pbml0aWFsaXplIiwiV29ya2VyRlMuaXNSZWFkT25seSIsIldvcmtlckZTLnN1cHBvcnRzU3luY2giLCJXb3JrZXJGUy5zdXBwb3J0c0xpbmtzIiwiV29ya2VyRlMuc3VwcG9ydHNQcm9wcyIsIldvcmtlckZTLl9ycGMiLCJXb3JrZXJGUy5yZW5hbWUiLCJXb3JrZXJGUy5zdGF0IiwiV29ya2VyRlMub3BlbiIsIldvcmtlckZTLnVubGluayIsIldvcmtlckZTLnJtZGlyIiwiV29ya2VyRlMubWtkaXIiLCJXb3JrZXJGUy5yZWFkZGlyIiwiV29ya2VyRlMuZXhpc3RzIiwiV29ya2VyRlMucmVhbHBhdGgiLCJXb3JrZXJGUy50cnVuY2F0ZSIsIldvcmtlckZTLnJlYWRGaWxlIiwiV29ya2VyRlMud3JpdGVGaWxlIiwiV29ya2VyRlMuYXBwZW5kRmlsZSIsIldvcmtlckZTLmNobW9kIiwiV29ya2VyRlMuY2hvd24iLCJXb3JrZXJGUy51dGltZXMiLCJXb3JrZXJGUy5saW5rIiwiV29ya2VyRlMuc3ltbGluayIsIldvcmtlckZTLnJlYWRsaW5rIiwiV29ya2VyRlMuc3luY0Nsb3NlIiwiV29ya2VyRlMuYXR0YWNoUmVtb3RlTGlzdGVuZXIiLCJXb3JrZXJGUy5hdHRhY2hSZW1vdGVMaXN0ZW5lci5hcmdMb2NhbDJSZW1vdGUiLCJXb3JrZXJGUy5hdHRhY2hSZW1vdGVMaXN0ZW5lci5hcmdSZW1vdGUyTG9jYWwiLCJhYm9ydEFuZFNlbmRF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Q2pDQSxTQUFTQSxDQUFDQSxDQUFDQSxDQUFDQSxHQUFHQSxlQUFlQSxDQUFDQSxJQUFJQSxDQUFDQSxDQUFDQSxDQUFDQSxFQUFFQSxTQUFTQSxDQUFDQSxDQUFDQTt3QkFDckRBLENBQUNBO3dCQUNEQSxJQUFJQSxNQUFNQSxHQUFHQSxFQUFFQSxDQUFDQSxTQUFTQSxFQUFFQSxDQUFDQTt3QkFDaEJBLE1BQU1BLENBQUNBLE9BQU9BLENBQUNBLE1BQU1BLENBQUVBLENBQUNBLEtBQUtBLENBQUNBLE1BQU1BLEVBQUVBLFNBQVNBLENBQUNBLENBQUNBO3dCQUM3REEsS0FBS0EsQ0FBQ0E7Z0JBQ1ZBLENBQUNBO1lBQ0hBLENBQUNBO1FBQ0hBLENBQUNBLENBQUNBLENBQUNBO0lBQ0xBLENBQUNBO0lBQ0hoQyxlQUFDQTtBQUFEQSxDQUFDQSxBQTNYRCxFQUFzQyxXQUFXLENBQUMsY0FBYyxFQTJYL0Q7QUEzWEQ7NkJBMlhDLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZmlsZV9zeXN0ZW0gPSByZXF1aXJlKCcuLi9jb3JlL2ZpbGVfc3lzdGVtJyk7XG5pbXBvcnQge0FwaUVycm9yfSBmcm9tICcuLi9jb3JlL2FwaV9lcnJvcic7XG5pbXBvcnQgZmlsZV9mbGFnID0gcmVxdWlyZSgnLi4vY29yZS9maWxlX2ZsYWcnKTtcbmltcG9ydCB7YnVmZmVyMkFycmF5QnVmZmVyLCBhcnJheUJ1ZmZlcjJCdWZmZXJ9IGZyb20gJy4uL2NvcmUvdXRpbCc7XG5pbXBvcnQgZmlsZSA9IHJlcXVpcmUoJy4uL2NvcmUvZmlsZScpO1xuaW1wb3J0IHtkZWZhdWx0IGFzIFN0YXRzLCBGaWxlVHlwZX0gZnJvbSAnLi4vY29yZS9ub2RlX2ZzX3N0YXRzJztcbmltcG9ydCBwcmVsb2FkX2ZpbGUgPSByZXF1aXJlKCcuLi9nZW5lcmljL3ByZWxvYWRfZmlsZScpO1xuaW1wb3J0IGdsb2JhbCA9IHJlcXVpcmUoJy4uL2NvcmUvZ2xvYmFsJyk7XG5pbXBvcnQgZnMgPSByZXF1aXJlKCcuLi9jb3JlL25vZGVfZnMnKTtcblxuaW50ZXJmYWNlIElCcm93c2VyRlNNZXNzYWdlIHtcbiAgYnJvd3NlcmZzTWVzc2FnZTogYm9vbGVhbjtcbn1cblxuZW51bSBTcGVjaWFsQXJnVHlwZSB7XG4gIC8vIENhbGxiYWNrXG4gIENCLFxuICAvLyBGaWxlIGRlc2NyaXB0b3JcbiAgRkQsXG4gIC8vIEFQSSBlcnJvclxuICBBUElfRVJST1IsXG4gIC8vIFN0YXRzIG9iamVjdFxuICBTVEFUUyxcbiAgLy8gSW5pdGlhbCBwcm9iZSBmb3IgZmlsZSBzeXN0ZW0gaW5mb3JtYXRpb24uXG4gIFBST0JFLFxuICAvLyBGaWxlRmxhZyBvYmplY3QuXG4gIEZJTEVGTEFHLFxuICAvLyBCdWZmZXIgb2JqZWN0LlxuICBCVUZGRVIsXG4gIC8vIEdlbmVyaWMgRXJyb3Igb2JqZWN0LlxuICBFUlJPUlxufVxuXG5pbnRlcmZhY2UgSVNwZWNpYWxBcmd1bWVudCB7XG4gIHR5cGU6IFNwZWNpYWxBcmdUeXBlO1xufVxuXG5pbnRlcmZhY2UgSVByb2JlUmVzcG9uc2UgZXh0ZW5kcyBJU3BlY2lhbEFyZ3VtZW50IHtcbiAgaXNSZWFkT25seTogYm9vbGVhbjtcbiAgc3VwcG9ydHNMaW5rczogYm9vbGVhbjtcbiAgc3VwcG9ydHNQcm9wczogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIElDYWxsYmFja0FyZ3VtZW50IGV4dGVuZHMgSVNwZWNpYWxBcmd1bWVudCB7XG4gIC8vIFRoZSBjYWxsYmFjayBJRC5cbiAgaWQ6IG51bWJlcjtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBjYWxsYmFjayBhcmd1bWVudHMgaW50byBJQ2FsbGJhY2tBcmd1bWVudCBvYmplY3RzLCBhbmQgYmFja1xuICogYWdhaW4uXG4gKi9cbmNsYXNzIENhbGxiYWNrQXJndW1lbnRDb252ZXJ0ZXIge1xuICBwcml2YXRlIF9jYWxsYmFja3M6IHsgW2lkOiBudW1iZXJdOiBGdW5jdGlvbiB9ID0ge307XG4gIHByaXZhdGUgX25leHRJZDogbnVtYmVyID0gMDtcblxuICBwdWJsaWMgdG9SZW1vdGVBcmcoY2I6IEZ1bmN0aW9uKTogSUNhbGxiYWNrQXJndW1lbnQge1xuICAgIHZhciBpZCA9IHRoaXMuX25leHRJZCsrO1xuICAgIHRoaXMuX2NhbGxiYWNrc1tpZF0gPSBjYjtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogU3BlY2lhbEFyZ1R5cGUuQ0IsXG4gICAgICBpZDogaWRcbiAgICB9O1xuICB9XG5cbiAgcHVibGljIHRvTG9jYWxBcmcoaWQ6IG51bWJlcik6IEZ1bmN0aW9uIHtcbiAgICB2YXIgY2IgPSB0aGlzLl9jYWxsYmFja3NbaWRdO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWxsYmFja3NbaWRdO1xuICAgIHJldHVybiBjYjtcbiAgfVxufVxuXG5pbnRlcmZhY2UgSUZpbGVEZXNjcmlwdG9yQXJndW1lbnQgZXh0ZW5kcyBJU3BlY2lhbEFyZ3VtZW50IHtcbiAgLy8gVGhlIGZpbGUgZGVzY3JpcHRvcidzIGlkIG9uIHRoZSByZW1vdGUgc2lkZS5cbiAgaWQ6IG51bWJlcjtcbiAgLy8gVGhlIGVudGlyZSBmaWxlJ3MgZGF0YSwgYXMgYW4gYXJyYXkgYnVmZmVyLlxuICBkYXRhOiBBcnJheUJ1ZmZlcjtcbiAgLy8gVGhlIGZpbGUncyBzdGF0IG9iamVjdCwgYXMgYW4gYXJyYXkgYnVmZmVyLlxuICBzdGF0OiBBcnJheUJ1ZmZlcjtcbiAgLy8gVGhlIHBhdGggdG8gdGhlIGZpbGUuXG4gIHBhdGg6IHN0cmluZztcbiAgLy8gVGhlIGZsYWcgb2YgdGhlIG9wZW4gZmlsZSBkZXNjcmlwdG9yLlxuICBmbGFnOiBzdHJpbmc7XG59XG5cbmNsYXNzIEZpbGVEZXNjcmlwdG9yQXJndW1lbnRDb252ZXJ0ZXIge1xuICBwcml2YXRlIF9maWxlRGVzY3JpcHRvcnM6IHsgW2lkOiBudW1iZXJdOiBmaWxlLkZpbGUgfSA9IHt9O1xuICBwcml2YXRlIF9uZXh0SWQ6IG51bWJlciA9IDA7XG5cbiAgcHVibGljIHRvUmVtb3RlQXJnKGZkOiBmaWxlLkZpbGUsIHA6IHN0cmluZywgZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnLCBjYjogKGVycjogQXBpRXJyb3IsIGFyZz86IElGaWxlRGVzY3JpcHRvckFyZ3VtZW50KSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIGlkID0gdGhpcy5fbmV4dElkKyssXG4gICAgICBkYXRhOiBBcnJheUJ1ZmZlcixcbiAgICAgIHN0YXQ6IEFycmF5QnVmZmVyLFxuICAgICAgYXJnc0xlZnQ6IG51bWJlciA9IDI7XG4gICAgdGhpcy5fZmlsZURlc2NyaXB0b3JzW2lkXSA9IGZkO1xuXG4gICAgLy8gRXh0cmFjdCBuZWVkZWQgaW5mb3JtYXRpb24gYXN5bmNocm9ub3VzbHkuXG4gICAgZmQuc3RhdCgoZXJyLCBzdGF0cykgPT4ge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBjYihlcnIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RhdCA9IGJ1ZmZlclRvVHJhbnNmZXJyYWJsZU9iamVjdChzdGF0cy50b0J1ZmZlcigpKTtcbiAgICAgICAgLy8gSWYgaXQncyBhIHJlYWRhYmxlIGZsYWcsIHdlIG5lZWQgdG8gZ3JhYiBjb250ZW50cy5cbiAgICAgICAgaWYgKGZsYWcuaXNSZWFkYWJsZSgpKSB7XG4gICAgICAgICAgZmQucmVhZChuZXcgQnVmZmVyKHN0YXRzLnNpemUpLCAwLCBzdGF0cy5zaXplLCAwLCAoZXJyLCBieXRlc1JlYWQsIGJ1ZmYpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGRhdGEgPSBidWZmZXJUb1RyYW5zZmVycmFibGVPYmplY3QoYnVmZik7XG4gICAgICAgICAgICAgIGNiKG51bGwsIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBTcGVjaWFsQXJnVHlwZS5GRCxcbiAgICAgICAgICAgICAgICBpZDogaWQsXG4gICAgICAgICAgICAgICAgZGF0YTogZGF0YSxcbiAgICAgICAgICAgICAgICBzdGF0OiBzdGF0LFxuICAgICAgICAgICAgICAgIHBhdGg6IHAsXG4gICAgICAgICAgICAgICAgZmxhZzogZmxhZy5nZXRGbGFnU3RyaW5nKClcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gRmlsZSBpcyBub3QgcmVhZGFibGUsIHdoaWNoIG1lYW5zIHdyaXRpbmcgdG8gaXQgd2lsbCBhcHBlbmQgb3JcbiAgICAgICAgICAvLyB0cnVuY2F0ZS9yZXBsYWNlIGV4aXN0aW5nIGNvbnRlbnRzLiBSZXR1cm4gYW4gZW1wdHkgYXJyYXlidWZmZXIuXG4gICAgICAgICAgY2IobnVsbCwge1xuICAgICAgICAgICAgdHlwZTogU3BlY2lhbEFyZ1R5cGUuRkQsXG4gICAgICAgICAgICBpZDogaWQsXG4gICAgICAgICAgICBkYXRhOiBuZXcgQXJyYXlCdWZmZXIoMCksXG4gICAgICAgICAgICBzdGF0OiBzdGF0LFxuICAgICAgICAgICAgcGF0aDogcCxcbiAgICAgICAgICAgIGZsYWc6IGZsYWcuZ2V0RmxhZ1N0cmluZygpXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX2FwcGx5RmRDaGFuZ2VzKHJlbW90ZUZkOiBJRmlsZURlc2NyaXB0b3JBcmd1bWVudCwgY2I6IChlcnI6IEFwaUVycm9yLCBmZD86IGZpbGUuRmlsZSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciBmZCA9IHRoaXMuX2ZpbGVEZXNjcmlwdG9yc1tyZW1vdGVGZC5pZF0sXG4gICAgICBkYXRhID0gdHJhbnNmZXJyYWJsZU9iamVjdFRvQnVmZmVyKHJlbW90ZUZkLmRhdGEpLFxuICAgICAgcmVtb3RlU3RhdHMgPSBTdGF0cy5mcm9tQnVmZmVyKHRyYW5zZmVycmFibGVPYmplY3RUb0J1ZmZlcihyZW1vdGVGZC5zdGF0KSk7XG5cbiAgICAvLyBXcml0ZSBkYXRhIGlmIHRoZSBmaWxlIGlzIHdyaXRhYmxlLlxuICAgIHZhciBmbGFnID0gZmlsZV9mbGFnLkZpbGVGbGFnLmdldEZpbGVGbGFnKHJlbW90ZUZkLmZsYWcpO1xuICAgIGlmIChmbGFnLmlzV3JpdGVhYmxlKCkpIHtcbiAgICAgIC8vIEFwcGVuZGFibGU6IFdyaXRlIHRvIGVuZCBvZiBmaWxlLlxuICAgICAgLy8gV3JpdGVhYmxlOiBSZXBsYWNlIGVudGlyZSBjb250ZW50cyBvZiBmaWxlLlxuICAgICAgZmQud3JpdGUoZGF0YSwgMCwgZGF0YS5sZW5ndGgsIGZsYWcuaXNBcHBlbmRhYmxlKCkgPyBmZC5nZXRQb3MoKSA6IDAsIChlKSA9PiB7XG4gICAgICAgIGlmIChlKSB7XG4gICAgICAgICAgY2IoZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZnVuY3Rpb24gYXBwbHlTdGF0Q2hhbmdlcygpIHtcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIG1vZGUgY2hhbmdlZC5cbiAgICAgICAgICAgIGZkLnN0YXQoKGUsIHN0YXRzPykgPT4ge1xuICAgICAgICAgICAgICBpZiAoZSkge1xuICAgICAgICAgICAgICAgIGNiKGUpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChzdGF0cy5tb2RlICE9PSByZW1vdGVTdGF0cy5tb2RlKSB7XG4gICAgICAgICAgICAgICAgICBmZC5jaG1vZChyZW1vdGVTdGF0cy5tb2RlLCAoZTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNiKGUsIGZkKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBjYihlLCBmZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBJZiB3cml0ZWFibGUgJiBub3QgYXBwZW5kYWJsZSwgd2UgbmVlZCB0byBlbnN1cmUgZmlsZSBjb250ZW50cyBhcmVcbiAgICAgICAgICAvLyBpZGVudGljYWwgdG8gdGhvc2UgZnJvbSB0aGUgcmVtb3RlIEZELiBUaHVzLCB3ZSB0cnVuY2F0ZSB0byB0aGVcbiAgICAgICAgICAvLyBsZW5ndGggb2YgdGhlIHJlbW90ZSBmaWxlLlxuICAgICAgICAgIGlmICghZmxhZy5pc0FwcGVuZGFibGUoKSkge1xuICAgICAgICAgICAgZmQudHJ1bmNhdGUoZGF0YS5sZW5ndGgsICgpID0+IHtcbiAgICAgICAgICAgICAgYXBwbHlTdGF0Q2hhbmdlcygpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXBwbHlTdGF0Q2hhbmdlcygpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNiKG51bGwsIGZkKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXBwbHlGZEFQSVJlcXVlc3QocmVxdWVzdDogSUFQSVJlcXVlc3QsIGNiOiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgZmRBcmcgPSA8SUZpbGVEZXNjcmlwdG9yQXJndW1lbnQ+IHJlcXVlc3QuYXJnc1swXTtcbiAgICB0aGlzLl9hcHBseUZkQ2hhbmdlcyhmZEFyZywgKGVyciwgZmQ/KSA9PiB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGNiKGVycik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBBcHBseSBtZXRob2Qgb24gbm93LWNoYW5nZWQgZmlsZSBkZXNjcmlwdG9yLlxuICAgICAgICAoPGFueT4gZmQpW3JlcXVlc3QubWV0aG9kXSgoZT86IEFwaUVycm9yKSA9PiB7XG4gICAgICAgICAgaWYgKHJlcXVlc3QubWV0aG9kID09PSAnY2xvc2UnKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fZmlsZURlc2NyaXB0b3JzW2ZkQXJnLmlkXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY2IoZSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbmludGVyZmFjZSBJQVBJRXJyb3JBcmd1bWVudCBleHRlbmRzIElTcGVjaWFsQXJndW1lbnQge1xuICAvLyBUaGUgZXJyb3Igb2JqZWN0LCBhcyBhbiBhcnJheSBidWZmZXIuXG4gIGVycm9yRGF0YTogQXJyYXlCdWZmZXI7XG59XG5cbmZ1bmN0aW9uIGFwaUVycm9yTG9jYWwyUmVtb3RlKGU6IEFwaUVycm9yKTogSUFQSUVycm9yQXJndW1lbnQge1xuICByZXR1cm4ge1xuICAgIHR5cGU6IFNwZWNpYWxBcmdUeXBlLkFQSV9FUlJPUixcbiAgICBlcnJvckRhdGE6IGJ1ZmZlclRvVHJhbnNmZXJyYWJsZU9iamVjdChlLndyaXRlVG9CdWZmZXIoKSlcbiAgfTtcbn1cblxuZnVuY3Rpb24gYXBpRXJyb3JSZW1vdGUyTG9jYWwoZTogSUFQSUVycm9yQXJndW1lbnQpOiBBcGlFcnJvciB7XG4gIHJldHVybiBBcGlFcnJvci5mcm9tQnVmZmVyKHRyYW5zZmVycmFibGVPYmplY3RUb0J1ZmZlcihlLmVycm9yRGF0YSkpO1xufVxuXG5pbnRlcmZhY2UgSUVycm9yQXJndW1lbnQgZXh0ZW5kcyBJU3BlY2lhbEFyZ3VtZW50IHtcbiAgLy8gVGhlIG5hbWUgb2YgdGhlIGVycm9yIChlLmcuICdUeXBlRXJyb3InKS5cbiAgbmFtZTogc3RyaW5nO1xuICAvLyBUaGUgbWVzc2FnZSBhc3NvY2lhdGVkIHdpdGggdGhlIGVycm9yLlxuICBtZXNzYWdlOiBzdHJpbmc7XG4gIC8vIFRoZSBzdGFjayBhc3NvY2lhdGVkIHdpdGggdGhlIGVycm9yLlxuICBzdGFjazogc3RyaW5nO1xufVxuXG5mdW5jdGlvbiBlcnJvckxvY2FsMlJlbW90ZShlOiBFcnJvcik6IElFcnJvckFyZ3VtZW50IHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiBTcGVjaWFsQXJnVHlwZS5FUlJPUixcbiAgICBuYW1lOiBlLm5hbWUsXG4gICAgbWVzc2FnZTogZS5tZXNzYWdlLFxuICAgIHN0YWNrOiBlLnN0YWNrXG4gIH07XG59XG5cbmZ1bmN0aW9uIGVycm9yUmVtb3RlMkxvY2FsKGU6IElFcnJvckFyZ3VtZW50KTogRXJyb3Ige1xuICB2YXIgY25zdHI6IHtcbiAgICBuZXcgKG1zZzogc3RyaW5nKTogRXJyb3I7XG4gIH0gPSBnbG9iYWxbZS5uYW1lXTtcbiAgaWYgKHR5cGVvZihjbnN0cikgIT09ICdmdW5jdGlvbicpIHtcbiAgICBjbnN0ciA9IEVycm9yO1xuICB9XG4gIHZhciBlcnIgPSBuZXcgY25zdHIoZS5tZXNzYWdlKTtcbiAgZXJyLnN0YWNrID0gZS5zdGFjaztcbiAgcmV0dXJuIGVycjtcbn1cblxuaW50ZXJmYWNlIElTdGF0c0FyZ3VtZW50IGV4dGVuZHMgSVNwZWNpYWxBcmd1bWVudCB7XG4gIC8vIFRoZSBzdGF0cyBvYmplY3QgYXMgYW4gYXJyYXkgYnVmZmVyLlxuICBzdGF0c0RhdGE6IEFycmF5QnVmZmVyO1xufVxuXG5mdW5jdGlvbiBzdGF0c0xvY2FsMlJlbW90ZShzdGF0czogU3RhdHMpOiBJU3RhdHNBcmd1bWVudCB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogU3BlY2lhbEFyZ1R5cGUuU1RBVFMsXG4gICAgc3RhdHNEYXRhOiBidWZmZXJUb1RyYW5zZmVycmFibGVPYmplY3Qoc3RhdHMudG9CdWZmZXIoKSlcbiAgfTtcbn1cblxuZnVuY3Rpb24gc3RhdHNSZW1vdGUyTG9jYWwoc3RhdHM6IElTdGF0c0FyZ3VtZW50KTogU3RhdHMge1xuICByZXR1cm4gU3RhdHMuZnJvbUJ1ZmZlcih0cmFuc2ZlcnJhYmxlT2JqZWN0VG9CdWZmZXIoc3RhdHMuc3RhdHNEYXRhKSk7XG59XG5cbmludGVyZmFjZSBJRmlsZUZsYWdBcmd1bWVudCBleHRlbmRzIElTcGVjaWFsQXJndW1lbnQge1xuICBmbGFnU3RyOiBzdHJpbmc7XG59XG5cbmZ1bmN0aW9uIGZpbGVGbGFnTG9jYWwyUmVtb3RlKGZsYWc6IGZpbGVfZmxhZy5GaWxlRmxhZyk6IElGaWxlRmxhZ0FyZ3VtZW50IHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiBTcGVjaWFsQXJnVHlwZS5GSUxFRkxBRyxcbiAgICBmbGFnU3RyOiBmbGFnLmdldEZsYWdTdHJpbmcoKVxuICB9O1xufVxuXG5mdW5jdGlvbiBmaWxlRmxhZ1JlbW90ZTJMb2NhbChyZW1vdGVGbGFnOiBJRmlsZUZsYWdBcmd1bWVudCk6IGZpbGVfZmxhZy5GaWxlRmxhZyB7XG4gIHJldHVybiBmaWxlX2ZsYWcuRmlsZUZsYWcuZ2V0RmlsZUZsYWcocmVtb3RlRmxhZy5mbGFnU3RyKTtcbn1cblxuaW50ZXJmYWNlIElCdWZmZXJBcmd1bWVudCBleHRlbmRzIElTcGVjaWFsQXJndW1lbnQge1xuICBkYXRhOiBBcnJheUJ1ZmZlcjtcbn1cblxuZnVuY3Rpb24gYnVmZmVyVG9UcmFuc2ZlcnJhYmxlT2JqZWN0KGJ1ZmY6IE5vZGVCdWZmZXIpOiBBcnJheUJ1ZmZlciB7XG4gIHJldHVybiBidWZmZXIyQXJyYXlCdWZmZXIoYnVmZik7XG59XG5cbmZ1bmN0aW9uIHRyYW5zZmVycmFibGVPYmplY3RUb0J1ZmZlcihidWZmOiBBcnJheUJ1ZmZlcik6IEJ1ZmZlciB7XG4gIHJldHVybiBhcnJheUJ1ZmZlcjJCdWZmZXIoYnVmZik7XG59XG5cbmZ1bmN0aW9uIGJ1ZmZlckxvY2FsMlJlbW90ZShidWZmOiBCdWZmZXIpOiBJQnVmZmVyQXJndW1lbnQge1xuICByZXR1cm4ge1xuICAgIHR5cGU6IFNwZWNpYWxBcmdUeXBlLkJVRkZFUixcbiAgICBkYXRhOiBidWZmZXJUb1RyYW5zZmVycmFibGVPYmplY3QoYnVmZilcbiAgfTtcbn1cblxuZnVuY3Rpb24gYnVmZmVyUmVtb3RlMkxvY2FsKGJ1ZmZBcmc6IElCdWZmZXJBcmd1bWVudCk6IEJ1ZmZlciB7XG4gIHJldHVybiB0cmFuc2ZlcnJhYmxlT2JqZWN0VG9CdWZmZXIoYnVmZkFyZy5kYXRhKTtcbn1cblxuaW50ZXJmYWNlIElBUElSZXF1ZXN0IGV4dGVuZHMgSUJyb3dzZXJGU01lc3NhZ2Uge1xuICBtZXRob2Q6IHN0cmluZztcbiAgYXJnczogQXJyYXk8bnVtYmVyIHwgc3RyaW5nIHwgSVNwZWNpYWxBcmd1bWVudD47XG59XG5cbmZ1bmN0aW9uIGlzQVBJUmVxdWVzdChkYXRhOiBhbnkpOiBkYXRhIGlzIElBUElSZXF1ZXN0IHtcbiAgcmV0dXJuIGRhdGEgIT0gbnVsbCAmJiB0eXBlb2YgZGF0YSA9PT0gJ29iamVjdCcgJiYgZGF0YS5oYXNPd25Qcm9wZXJ0eSgnYnJvd3NlcmZzTWVzc2FnZScpICYmIGRhdGFbJ2Jyb3dzZXJmc01lc3NhZ2UnXTtcbn1cblxuaW50ZXJmYWNlIElBUElSZXNwb25zZSBleHRlbmRzIElCcm93c2VyRlNNZXNzYWdlIHtcbiAgY2JJZDogbnVtYmVyO1xuICBhcmdzOiBBcnJheTxudW1iZXIgfCBzdHJpbmcgfCBJU3BlY2lhbEFyZ3VtZW50Pjtcbn1cblxuZnVuY3Rpb24gaXNBUElSZXNwb25zZShkYXRhOiBhbnkpOiBkYXRhIGlzIElBUElSZXNwb25zZSB7XG4gIHJldHVybiBkYXRhICE9IG51bGwgJiYgdHlwZW9mIGRhdGEgPT09ICdvYmplY3QnICYmIGRhdGEuaGFzT3duUHJvcGVydHkoJ2Jyb3dzZXJmc01lc3NhZ2UnKSAmJiBkYXRhWydicm93c2VyZnNNZXNzYWdlJ107XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIHJlbW90ZSBmaWxlIGluIGEgZGlmZmVyZW50IHdvcmtlci90aHJlYWQuXG4gKi9cbmNsYXNzIFdvcmtlckZpbGUgZXh0ZW5kcyBwcmVsb2FkX2ZpbGUuUHJlbG9hZEZpbGU8V29ya2VyRlM+IHtcbiAgcHJpdmF0ZSBfcmVtb3RlRmRJZDogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKF9mczogV29ya2VyRlMsIF9wYXRoOiBzdHJpbmcsIF9mbGFnOiBmaWxlX2ZsYWcuRmlsZUZsYWcsIF9zdGF0OiBTdGF0cywgcmVtb3RlRmRJZDogbnVtYmVyLCBjb250ZW50cz86IE5vZGVCdWZmZXIpIHtcbiAgICBzdXBlcihfZnMsIF9wYXRoLCBfZmxhZywgX3N0YXQsIGNvbnRlbnRzKTtcbiAgICB0aGlzLl9yZW1vdGVGZElkID0gcmVtb3RlRmRJZDtcbiAgfVxuXG4gIHB1YmxpYyBnZXRSZW1vdGVGZElkKCkge1xuICAgIHJldHVybiB0aGlzLl9yZW1vdGVGZElkO1xuICB9XG5cbiAgcHVibGljIHRvUmVtb3RlQXJnKCk6IElGaWxlRGVzY3JpcHRvckFyZ3VtZW50IHtcbiAgICByZXR1cm4gPElGaWxlRGVzY3JpcHRvckFyZ3VtZW50PiB7XG4gICAgICB0eXBlOiBTcGVjaWFsQXJnVHlwZS5GRCxcbiAgICAgIGlkOiB0aGlzLl9yZW1vdGVGZElkLFxuICAgICAgZGF0YTogYnVmZmVyVG9UcmFuc2ZlcnJhYmxlT2JqZWN0KHRoaXMuZ2V0QnVmZmVyKCkpLFxuICAgICAgc3RhdDogYnVmZmVyVG9UcmFuc2ZlcnJhYmxlT2JqZWN0KHRoaXMuZ2V0U3RhdHMoKS50b0J1ZmZlcigpKSxcbiAgICAgIHBhdGg6IHRoaXMuZ2V0UGF0aCgpLFxuICAgICAgZmxhZzogdGhpcy5nZXRGbGFnKCkuZ2V0RmxhZ1N0cmluZygpXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgX3N5bmNDbG9zZSh0eXBlOiBzdHJpbmcsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaXNEaXJ0eSgpKSB7XG4gICAgICAoPFdvcmtlckZTPiB0aGlzLl9mcykuc3luY0Nsb3NlKHR5cGUsIHRoaXMsIChlPzogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgaWYgKCFlKSB7XG4gICAgICAgICAgdGhpcy5yZXNldERpcnR5KCk7XG4gICAgICAgIH1cbiAgICAgICAgY2IoZSk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2IoKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgc3luYyhjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3N5bmNDbG9zZSgnc3luYycsIGNiKTtcbiAgfVxuXG4gIHB1YmxpYyBjbG9zZShjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3N5bmNDbG9zZSgnY2xvc2UnLCBjYik7XG4gIH1cbn1cblxuLyoqXG4gKiBXb3JrZXJGUyBsZXRzIHlvdSBhY2Nlc3MgYSBCcm93c2VyRlMgaW5zdGFuY2UgdGhhdCBpcyBydW5uaW5nIGluIGEgZGlmZmVyZW50XG4gKiBKYXZhU2NyaXB0IGNvbnRleHQgKGUuZy4gYWNjZXNzIEJyb3dzZXJGUyBpbiBvbmUgb2YgeW91ciBXZWJXb3JrZXJzLCBvclxuICogYWNjZXNzIEJyb3dzZXJGUyBydW5uaW5nIG9uIHRoZSBtYWluIHBhZ2UgZnJvbSBhIFdlYldvcmtlcikuXG4gKlxuICogRm9yIGV4YW1wbGUsIHRvIGhhdmUgYSBXZWJXb3JrZXIgYWNjZXNzIGZpbGVzIGluIHRoZSBtYWluIGJyb3dzZXIgdGhyZWFkLFxuICogZG8gdGhlIGZvbGxvd2luZzpcbiAqXG4gKiBNQUlOIEJST1dTRVIgVEhSRUFEOlxuICogYGBgXG4gKiAgIC8vIExpc3RlbiBmb3IgcmVtb3RlIGZpbGUgc3lzdGVtIHJlcXVlc3RzLlxuICogICBCcm93c2VyRlMuRmlsZVN5c3RlbS5Xb3JrZXJGUy5hdHRhY2hSZW1vdGVMaXN0ZW5lcih3ZWJXb3JrZXJPYmplY3QpO1xuICogYGBcbiAqXG4gKiBXRUJXT1JLRVIgVEhSRUFEOlxuICogYGBgXG4gKiAgIC8vIFNldCB0aGUgcmVtb3RlIGZpbGUgc3lzdGVtIGFzIHRoZSByb290IGZpbGUgc3lzdGVtLlxuICogICBCcm93c2VyRlMuaW5pdGlhbGl6ZShuZXcgQnJvd3NlckZTLkZpbGVTeXN0ZW0uV29ya2VyRlMoc2VsZikpO1xuICogYGBgXG4gKlxuICogTm90ZSB0aGF0IHN5bmNocm9ub3VzIG9wZXJhdGlvbnMgYXJlIG5vdCBwZXJtaXR0ZWQgb24gdGhlIFdvcmtlckZTLCByZWdhcmRsZXNzXG4gKiBvZiB0aGUgY29uZmlndXJhdGlvbiBvcHRpb24gb2YgdGhlIHJlbW90ZSBGUy5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgV29ya2VyRlMgZXh0ZW5kcyBmaWxlX3N5c3RlbS5CYXNlRmlsZVN5c3RlbSBpbXBsZW1lbnRzIGZpbGVfc3lzdGVtLkZpbGVTeXN0ZW0ge1xuICBwcml2YXRlIF93b3JrZXI6IFdvcmtlcjtcbiAgcHJpdmF0ZSBfY2FsbGJhY2tDb252ZXJ0ZXIgPSBuZXcgQ2FsbGJhY2tBcmd1bWVudENvbnZlcnRlcigpO1xuXG4gIHByaXZhdGUgX2lzSW5pdGlhbGl6ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcbiAgcHJpdmF0ZSBfaXNSZWFkT25seTogYm9vbGVhbiA9IGZhbHNlO1xuICBwcml2YXRlIF9zdXBwb3J0TGlua3M6IGJvb2xlYW4gPSBmYWxzZTtcbiAgcHJpdmF0ZSBfc3VwcG9ydFByb3BzOiBib29sZWFuID0gZmFsc2U7XG5cbiAgLyoqXG4gICAqIFN0b3JlcyBvdXRzdGFuZGluZyBBUEkgcmVxdWVzdHMgdG8gdGhlIHJlbW90ZSBCcm93c2VyRlMgaW5zdGFuY2UuXG4gICAqL1xuICBwcml2YXRlIF9vdXRzdGFuZGluZ1JlcXVlc3RzOiB7IFtpZDogbnVtYmVyXTogKCkgPT4gdm9pZCB9ID0ge307XG5cbiAgLyoqXG4gICAqIENvbnN0cnVjdHMgYSBuZXcgV29ya2VyRlMgaW5zdGFuY2UgdGhhdCBjb25uZWN0cyB3aXRoIEJyb3dzZXJGUyBydW5uaW5nIG9uXG4gICAqIHRoZSBzcGVjaWZpZWQgd29ya2VyLlxuICAgKi9cbiAgY29uc3RydWN0b3Iod29ya2VyOiBXb3JrZXIpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX3dvcmtlciA9IHdvcmtlcjtcbiAgICB0aGlzLl93b3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsKGU6IE1lc3NhZ2VFdmVudCkgPT4ge1xuICAgICAgdmFyIHJlc3A6IE9iamVjdCA9IGUuZGF0YTtcbiAgICAgIGlmIChpc0FQSVJlc3BvbnNlKHJlc3ApKSB7XG4gICAgICAgIHZhciBpOiBudW1iZXIsIGFyZ3MgPSByZXNwLmFyZ3MsIGZpeGVkQXJncyA9IG5ldyBBcnJheShhcmdzLmxlbmd0aCk7XG4gICAgICAgIC8vIERpc3BhdGNoIGV2ZW50IHRvIGNvcnJlY3QgaWQuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBmaXhlZEFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBmaXhlZEFyZ3NbaV0gPSB0aGlzLl9hcmdSZW1vdGUyTG9jYWwoYXJnc1tpXSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fY2FsbGJhY2tDb252ZXJ0ZXIudG9Mb2NhbEFyZyhyZXNwLmNiSWQpLmFwcGx5KG51bGwsIGZpeGVkQXJncyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGlzQXZhaWxhYmxlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0eXBlb2YgV29ya2VyICE9PSAndW5kZWZpbmVkJztcbiAgfVxuXG4gIHB1YmxpYyBnZXROYW1lKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuICdXb3JrZXJGUyc7XG4gIH1cblxuICBwcml2YXRlIF9hcmdSZW1vdGUyTG9jYWwoYXJnOiBhbnkpOiBhbnkge1xuICAgIGlmIChhcmcgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGFyZztcbiAgICB9XG4gICAgc3dpdGNoICh0eXBlb2YgYXJnKSB7XG4gICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICBpZiAoYXJnWyd0eXBlJ10gIT0gbnVsbCAmJiB0eXBlb2YgYXJnWyd0eXBlJ10gPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgdmFyIHNwZWNpYWxBcmcgPSA8SVNwZWNpYWxBcmd1bWVudD4gYXJnO1xuICAgICAgICAgIHN3aXRjaCAoc3BlY2lhbEFyZy50eXBlKSB7XG4gICAgICAgICAgICBjYXNlIFNwZWNpYWxBcmdUeXBlLkFQSV9FUlJPUjpcbiAgICAgICAgICAgICAgcmV0dXJuIGFwaUVycm9yUmVtb3RlMkxvY2FsKDxJQVBJRXJyb3JBcmd1bWVudD4gc3BlY2lhbEFyZyk7XG4gICAgICAgICAgICBjYXNlIFNwZWNpYWxBcmdUeXBlLkZEOlxuICAgICAgICAgICAgICB2YXIgZmRBcmcgPSA8SUZpbGVEZXNjcmlwdG9yQXJndW1lbnQ+IHNwZWNpYWxBcmc7XG4gICAgICAgICAgICAgIHJldHVybiBuZXcgV29ya2VyRmlsZSh0aGlzLCBmZEFyZy5wYXRoLCBmaWxlX2ZsYWcuRmlsZUZsYWcuZ2V0RmlsZUZsYWcoZmRBcmcuZmxhZyksIFN0YXRzLmZyb21CdWZmZXIodHJhbnNmZXJyYWJsZU9iamVjdFRvQnVmZmVyKGZkQXJnLnN0YXQpKSwgZmRBcmcuaWQsIHRyYW5zZmVycmFibGVPYmplY3RUb0J1ZmZlcihmZEFyZy5kYXRhKSk7XG4gICAgICAgICAgICBjYXNlIFNwZWNpYWxBcmdUeXBlLlNUQVRTOlxuICAgICAgICAgICAgICByZXR1cm4gc3RhdHNSZW1vdGUyTG9jYWwoPElTdGF0c0FyZ3VtZW50PiBzcGVjaWFsQXJnKTtcbiAgICAgICAgICAgIGNhc2UgU3BlY2lhbEFyZ1R5cGUuRklMRUZMQUc6XG4gICAgICAgICAgICAgIHJldHVybiBmaWxlRmxhZ1JlbW90ZTJMb2NhbCg8SUZpbGVGbGFnQXJndW1lbnQ+IHNwZWNpYWxBcmcpO1xuICAgICAgICAgICAgY2FzZSBTcGVjaWFsQXJnVHlwZS5CVUZGRVI6XG4gICAgICAgICAgICAgIHJldHVybiBidWZmZXJSZW1vdGUyTG9jYWwoPElCdWZmZXJBcmd1bWVudD4gc3BlY2lhbEFyZyk7XG4gICAgICAgICAgICBjYXNlIFNwZWNpYWxBcmdUeXBlLkVSUk9SOlxuICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZW1vdGUyTG9jYWwoPElFcnJvckFyZ3VtZW50PiBzcGVjaWFsQXJnKTtcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgIHJldHVybiBhcmc7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBhcmc7XG4gICAgICAgIH1cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBhcmc7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnRzIGEgbG9jYWwgYXJndW1lbnQgaW50byBhIHJlbW90ZSBhcmd1bWVudC4gUHVibGljIHNvIFdvcmtlckZpbGUgb2JqZWN0cyBjYW4gY2FsbCBpdC5cbiAgICovXG4gIHB1YmxpYyBfYXJnTG9jYWwyUmVtb3RlKGFyZzogYW55KTogYW55IHtcbiAgICBpZiAoYXJnID09IG51bGwpIHtcbiAgICAgIHJldHVybiBhcmc7XG4gICAgfVxuICAgIHN3aXRjaCAodHlwZW9mIGFyZykge1xuICAgICAgY2FzZSBcIm9iamVjdFwiOlxuICAgICAgICBpZiAoYXJnIGluc3RhbmNlb2YgU3RhdHMpIHtcbiAgICAgICAgICByZXR1cm4gc3RhdHNMb2NhbDJSZW1vdGUoYXJnKTtcbiAgICAgICAgfSBlbHNlIGlmIChhcmcgaW5zdGFuY2VvZiBBcGlFcnJvcikge1xuICAgICAgICAgIHJldHVybiBhcGlFcnJvckxvY2FsMlJlbW90ZShhcmcpO1xuICAgICAgICB9IGVsc2UgaWYgKGFyZyBpbnN0YW5jZW9mIFdvcmtlckZpbGUpIHtcbiAgICAgICAgICByZXR1cm4gKDxXb3JrZXJGaWxlPiBhcmcpLnRvUmVtb3RlQXJnKCk7XG4gICAgICAgIH0gZWxzZSBpZiAoYXJnIGluc3RhbmNlb2YgZmlsZV9mbGFnLkZpbGVGbGFnKSB7XG4gICAgICAgICAgcmV0dXJuIGZpbGVGbGFnTG9jYWwyUmVtb3RlKGFyZyk7XG4gICAgICAgIH0gZWxzZSBpZiAoYXJnIGluc3RhbmNlb2YgQnVmZmVyKSB7XG4gICAgICAgICAgcmV0dXJuIGJ1ZmZlckxvY2FsMlJlbW90ZShhcmcpO1xuICAgICAgICB9IGVsc2UgaWYgKGFyZyBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgICAgcmV0dXJuIGVycm9yTG9jYWwyUmVtb3RlKGFyZyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIFwiVW5rbm93biBhcmd1bWVudFwiO1xuICAgICAgICB9XG4gICAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbGxiYWNrQ29udmVydGVyLnRvUmVtb3RlQXJnKGFyZyk7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gYXJnO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsZWQgb25jZSBib3RoIGxvY2FsIGFuZCByZW1vdGUgc2lkZXMgYXJlIHNldCB1cC5cbiAgICovXG4gIHB1YmxpYyBpbml0aWFsaXplKGNiOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLl9pc0luaXRpYWxpemVkKSB7XG4gICAgICB2YXIgbWVzc2FnZTogSUFQSVJlcXVlc3QgPSB7XG4gICAgICAgIGJyb3dzZXJmc01lc3NhZ2U6IHRydWUsXG4gICAgICAgIG1ldGhvZDogJ3Byb2JlJyxcbiAgICAgICAgYXJnczogW3RoaXMuX2FyZ0xvY2FsMlJlbW90ZShuZXcgQnVmZmVyKDApKSwgdGhpcy5fY2FsbGJhY2tDb252ZXJ0ZXIudG9SZW1vdGVBcmcoKHByb2JlUmVzcG9uc2U6IElQcm9iZVJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgdGhpcy5faXNJbml0aWFsaXplZCA9IHRydWU7XG4gICAgICAgICAgdGhpcy5faXNSZWFkT25seSA9IHByb2JlUmVzcG9uc2UuaXNSZWFkT25seTtcbiAgICAgICAgICB0aGlzLl9zdXBwb3J0TGlua3MgPSBwcm9iZVJlc3BvbnNlLnN1cHBvcnRzTGlua3M7XG4gICAgICAgICAgdGhpcy5fc3VwcG9ydFByb3BzID0gcHJvYmVSZXNwb25zZS5zdXBwb3J0c1Byb3BzO1xuICAgICAgICAgIGNiKCk7XG4gICAgICAgIH0pXVxuICAgICAgfTtcbiAgICAgIHRoaXMuX3dvcmtlci5wb3N0TWVzc2FnZShtZXNzYWdlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2IoKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgaXNSZWFkT25seSgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2lzUmVhZE9ubHk7IH1cbiAgcHVibGljIHN1cHBvcnRzU3luY2goKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuICBwdWJsaWMgc3VwcG9ydHNMaW5rcygpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX3N1cHBvcnRMaW5rczsgfVxuICBwdWJsaWMgc3VwcG9ydHNQcm9wcygpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX3N1cHBvcnRQcm9wczsgfVxuXG4gIHByaXZhdGUgX3JwYyhtZXRob2ROYW1lOiBzdHJpbmcsIGFyZ3M6IElBcmd1bWVudHMpIHtcbiAgICB2YXIgbWVzc2FnZTogSUFQSVJlcXVlc3QgPSB7XG4gICAgICBicm93c2VyZnNNZXNzYWdlOiB0cnVlLFxuICAgICAgbWV0aG9kOiBtZXRob2ROYW1lLFxuICAgICAgYXJnczogbnVsbFxuICAgIH0sIGZpeGVkQXJncyA9IG5ldyBBcnJheShhcmdzLmxlbmd0aCksIGk6IG51bWJlcjtcbiAgICBmb3IgKGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgZml4ZWRBcmdzW2ldID0gdGhpcy5fYXJnTG9jYWwyUmVtb3RlKGFyZ3NbaV0pO1xuICAgIH1cbiAgICBtZXNzYWdlLmFyZ3MgPSBmaXhlZEFyZ3M7XG4gICAgdGhpcy5fd29ya2VyLnBvc3RNZXNzYWdlKG1lc3NhZ2UpO1xuICB9XG5cbiAgcHVibGljIHJlbmFtZShvbGRQYXRoOiBzdHJpbmcsIG5ld1BhdGg6IHN0cmluZywgY2I6IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3JwYygncmVuYW1lJywgYXJndW1lbnRzKTtcbiAgfVxuICBwdWJsaWMgc3RhdChwOiBzdHJpbmcsIGlzTHN0YXQ6IGJvb2xlYW4sIGNiOiAoZXJyOiBBcGlFcnJvciwgc3RhdD86IFN0YXRzKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fcnBjKCdzdGF0JywgYXJndW1lbnRzKTtcbiAgfVxuICBwdWJsaWMgb3BlbihwOiBzdHJpbmcsIGZsYWc6IGZpbGVfZmxhZy5GaWxlRmxhZywgbW9kZTogbnVtYmVyLCBjYjogKGVycjogQXBpRXJyb3IsIGZkPzogZmlsZS5GaWxlKSA9PiBhbnkpOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ29wZW4nLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyB1bmxpbmsocDogc3RyaW5nLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ3VubGluaycsIGFyZ3VtZW50cyk7XG4gIH1cbiAgcHVibGljIHJtZGlyKHA6IHN0cmluZywgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgdGhpcy5fcnBjKCdybWRpcicsIGFyZ3VtZW50cyk7XG4gIH1cbiAgcHVibGljIG1rZGlyKHA6IHN0cmluZywgbW9kZTogbnVtYmVyLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ21rZGlyJywgYXJndW1lbnRzKTtcbiAgfVxuICBwdWJsaWMgcmVhZGRpcihwOiBzdHJpbmcsIGNiOiAoZXJyOiBBcGlFcnJvciwgZmlsZXM/OiBzdHJpbmdbXSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3JwYygncmVhZGRpcicsIGFyZ3VtZW50cyk7XG4gIH1cbiAgcHVibGljIGV4aXN0cyhwOiBzdHJpbmcsIGNiOiAoZXhpc3RzOiBib29sZWFuKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fcnBjKCdleGlzdHMnLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyByZWFscGF0aChwOiBzdHJpbmcsIGNhY2hlOiB7IFtwYXRoOiBzdHJpbmddOiBzdHJpbmcgfSwgY2I6IChlcnI6IEFwaUVycm9yLCByZXNvbHZlZFBhdGg/OiBzdHJpbmcpID0+IGFueSk6IHZvaWQge1xuICAgIHRoaXMuX3JwYygncmVhbHBhdGgnLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyB0cnVuY2F0ZShwOiBzdHJpbmcsIGxlbjogbnVtYmVyLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ3RydW5jYXRlJywgYXJndW1lbnRzKTtcbiAgfVxuICBwdWJsaWMgcmVhZEZpbGUoZm5hbWU6IHN0cmluZywgZW5jb2Rpbmc6IHN0cmluZywgZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnLCBjYjogKGVycjogQXBpRXJyb3IsIGRhdGE/OiBhbnkpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ3JlYWRGaWxlJywgYXJndW1lbnRzKTtcbiAgfVxuICBwdWJsaWMgd3JpdGVGaWxlKGZuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgZW5jb2Rpbmc6IHN0cmluZywgZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnLCBtb2RlOiBudW1iZXIsIGNiOiAoZXJyOiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3JwYygnd3JpdGVGaWxlJywgYXJndW1lbnRzKTtcbiAgfVxuICBwdWJsaWMgYXBwZW5kRmlsZShmbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGVuY29kaW5nOiBzdHJpbmcsIGZsYWc6IGZpbGVfZmxhZy5GaWxlRmxhZywgbW9kZTogbnVtYmVyLCBjYjogKGVycjogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ2FwcGVuZEZpbGUnLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyBjaG1vZChwOiBzdHJpbmcsIGlzTGNobW9kOiBib29sZWFuLCBtb2RlOiBudW1iZXIsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRoaXMuX3JwYygnY2htb2QnLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyBjaG93bihwOiBzdHJpbmcsIGlzTGNob3duOiBib29sZWFuLCB1aWQ6IG51bWJlciwgZ2lkOiBudW1iZXIsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRoaXMuX3JwYygnY2hvd24nLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyB1dGltZXMocDogc3RyaW5nLCBhdGltZTogRGF0ZSwgbXRpbWU6IERhdGUsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRoaXMuX3JwYygndXRpbWVzJywgYXJndW1lbnRzKTtcbiAgfVxuICBwdWJsaWMgbGluayhzcmNwYXRoOiBzdHJpbmcsIGRzdHBhdGg6IHN0cmluZywgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgdGhpcy5fcnBjKCdsaW5rJywgYXJndW1lbnRzKTtcbiAgfVxuICBwdWJsaWMgc3ltbGluayhzcmNwYXRoOiBzdHJpbmcsIGRzdHBhdGg6IHN0cmluZywgdHlwZTogc3RyaW5nLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ3N5bWxpbmsnLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyByZWFkbGluayhwOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRoaXMuX3JwYygncmVhZGxpbmsnLCBhcmd1bWVudHMpO1xuICB9XG5cbiAgcHVibGljIHN5bmNDbG9zZShtZXRob2Q6IHN0cmluZywgZmQ6IGZpbGUuRmlsZSwgY2I6IChlOiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3dvcmtlci5wb3N0TWVzc2FnZSg8SUFQSVJlcXVlc3Q+IHtcbiAgICAgIGJyb3dzZXJmc01lc3NhZ2U6IHRydWUsXG4gICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgIGFyZ3M6IFsoPFdvcmtlckZpbGU+IGZkKS50b1JlbW90ZUFyZygpLCB0aGlzLl9jYWxsYmFja0NvbnZlcnRlci50b1JlbW90ZUFyZyhjYildXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQXR0YWNoZXMgYSBsaXN0ZW5lciB0byB0aGUgcmVtb3RlIHdvcmtlciBmb3IgZmlsZSBzeXN0ZW0gcmVxdWVzdHMuXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGF0dGFjaFJlbW90ZUxpc3RlbmVyKHdvcmtlcjogV29ya2VyKSB7XG4gICAgdmFyIGZkQ29udmVydGVyID0gbmV3IEZpbGVEZXNjcmlwdG9yQXJndW1lbnRDb252ZXJ0ZXIoKTtcblxuICAgIGZ1bmN0aW9uIGFyZ0xvY2FsMlJlbW90ZShhcmc6IGFueSwgcmVxdWVzdEFyZ3M6IGFueVtdLCBjYjogKGVycjogQXBpRXJyb3IsIGFyZz86IGFueSkgPT4gdm9pZCk6IHZvaWQge1xuICAgICAgc3dpdGNoICh0eXBlb2YgYXJnKSB7XG4gICAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgICAgaWYgKGFyZyBpbnN0YW5jZW9mIFN0YXRzKSB7XG4gICAgICAgICAgICBjYihudWxsLCBzdGF0c0xvY2FsMlJlbW90ZShhcmcpKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGFyZyBpbnN0YW5jZW9mIEFwaUVycm9yKSB7XG4gICAgICAgICAgICBjYihudWxsLCBhcGlFcnJvckxvY2FsMlJlbW90ZShhcmcpKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGFyZyBpbnN0YW5jZW9mIGZpbGUuQmFzZUZpbGUpIHtcbiAgICAgICAgICAgIC8vIFBhc3MgaW4gcCBhbmQgZmxhZ3MgZnJvbSBvcmlnaW5hbCByZXF1ZXN0LlxuICAgICAgICAgICAgY2IobnVsbCwgZmRDb252ZXJ0ZXIudG9SZW1vdGVBcmcoYXJnLCByZXF1ZXN0QXJnc1swXSwgcmVxdWVzdEFyZ3NbMV0sIGNiKSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChhcmcgaW5zdGFuY2VvZiBmaWxlX2ZsYWcuRmlsZUZsYWcpIHtcbiAgICAgICAgICAgIGNiKG51bGwsIGZpbGVGbGFnTG9jYWwyUmVtb3RlKGFyZykpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoYXJnIGluc3RhbmNlb2YgQnVmZmVyKSB7XG4gICAgICAgICAgICBjYihudWxsLCBidWZmZXJMb2NhbDJSZW1vdGUoYXJnKSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChhcmcgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICAgICAgY2IobnVsbCwgZXJyb3JMb2NhbDJSZW1vdGUoYXJnKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNiKG51bGwsIGFyZyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGNiKG51bGwsIGFyZyk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYXJnUmVtb3RlMkxvY2FsKGFyZzogYW55LCBmaXhlZFJlcXVlc3RBcmdzOiBhbnlbXSk6IGFueSB7XG4gICAgICBpZiAoYXJnID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGFyZztcbiAgICAgIH1cbiAgICAgIHN3aXRjaCAodHlwZW9mIGFyZykge1xuICAgICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICAgIGlmICh0eXBlb2YgYXJnWyd0eXBlJ10gPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICB2YXIgc3BlY2lhbEFyZyA9IDxJU3BlY2lhbEFyZ3VtZW50PiBhcmc7XG4gICAgICAgICAgICBzd2l0Y2ggKHNwZWNpYWxBcmcudHlwZSkge1xuICAgICAgICAgICAgICBjYXNlIFNwZWNpYWxBcmdUeXBlLkNCOlxuICAgICAgICAgICAgICAgIHZhciBjYklkID0gKDxJQ2FsbGJhY2tBcmd1bWVudD4gYXJnKS5pZDtcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICB2YXIgaTogbnVtYmVyLCBmaXhlZEFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCksXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IElBUElSZXNwb25zZSxcbiAgICAgICAgICAgICAgICAgICAgY291bnRkb3duID0gYXJndW1lbnRzLmxlbmd0aDtcblxuICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gYWJvcnRBbmRTZW5kRXJyb3IoZXJyOiBBcGlFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY291bnRkb3duID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgIGNvdW50ZG93biA9IC0xO1xuICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBicm93c2VyZnNNZXNzYWdlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgY2JJZDogY2JJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3M6IFthcGlFcnJvckxvY2FsMlJlbW90ZShlcnIpXVxuICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgd29ya2VyLnBvc3RNZXNzYWdlKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAvLyBDYXB0dXJlIGkgYW5kIGFyZ3VtZW50LlxuICAgICAgICAgICAgICAgICAgICAoKGk6IG51bWJlciwgYXJnOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBhcmdMb2NhbDJSZW1vdGUoYXJnLCBmaXhlZFJlcXVlc3RBcmdzLCAoZXJyLCBmaXhlZEFyZz8pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpeGVkQXJnc1tpXSA9IGZpeGVkQXJnO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBhYm9ydEFuZFNlbmRFcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICgtLWNvdW50ZG93biA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyb3dzZXJmc01lc3NhZ2U6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2JJZDogY2JJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcmdzOiBmaXhlZEFyZ3NcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgd29ya2VyLnBvc3RNZXNzYWdlKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KShpLCBhcmd1bWVudHNbaV0pO1xuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlID0ge1xuICAgICAgICAgICAgICAgICAgICAgIGJyb3dzZXJmc01lc3NhZ2U6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgY2JJZDogY2JJZCxcbiAgICAgICAgICAgICAgICAgICAgICBhcmdzOiBmaXhlZEFyZ3NcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgd29ya2VyLnBvc3RNZXNzYWdlKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgY2FzZSBTcGVjaWFsQXJnVHlwZS5BUElfRVJST1I6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFwaUVycm9yUmVtb3RlMkxvY2FsKDxJQVBJRXJyb3JBcmd1bWVudD4gc3BlY2lhbEFyZyk7XG4gICAgICAgICAgICAgIGNhc2UgU3BlY2lhbEFyZ1R5cGUuU1RBVFM6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0YXRzUmVtb3RlMkxvY2FsKDxJU3RhdHNBcmd1bWVudD4gc3BlY2lhbEFyZyk7XG4gICAgICAgICAgICAgIGNhc2UgU3BlY2lhbEFyZ1R5cGUuRklMRUZMQUc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZpbGVGbGFnUmVtb3RlMkxvY2FsKDxJRmlsZUZsYWdBcmd1bWVudD4gc3BlY2lhbEFyZyk7XG4gICAgICAgICAgICAgIGNhc2UgU3BlY2lhbEFyZ1R5cGUuQlVGRkVSOlxuICAgICAgICAgICAgICAgIHJldHVybiBidWZmZXJSZW1vdGUyTG9jYWwoPElCdWZmZXJBcmd1bWVudD4gc3BlY2lhbEFyZyk7XG4gICAgICAgICAgICAgIGNhc2UgU3BlY2lhbEFyZ1R5cGUuRVJST1I6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVtb3RlMkxvY2FsKDxJRXJyb3JBcmd1bWVudD4gc3BlY2lhbEFyZyk7XG4gICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgLy8gTm8gaWRlYSB3aGF0IHRoaXMgaXMuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGFyZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGFyZztcbiAgICAgICAgICB9XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcmV0dXJuIGFyZztcbiAgICAgIH1cbiAgICB9XG5cbiAgICB3b3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsKGU6IE1lc3NhZ2VFdmVudCkgPT4ge1xuICAgICAgdmFyIHJlcXVlc3Q6IE9iamVjdCA9IGUuZGF0YTtcbiAgICAgIGlmIChpc0FQSVJlcXVlc3QocmVxdWVzdCkpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSByZXF1ZXN0LmFyZ3MsXG4gICAgICAgICAgZml4ZWRBcmdzID0gbmV3IEFycmF5PGFueT4oYXJncy5sZW5ndGgpLFxuICAgICAgICAgIGk6IG51bWJlcjtcblxuICAgICAgICBzd2l0Y2ggKHJlcXVlc3QubWV0aG9kKSB7XG4gICAgICAgICAgY2FzZSAnY2xvc2UnOlxuICAgICAgICAgIGNhc2UgJ3N5bmMnOlxuICAgICAgICAgICAgKCgpID0+IHtcbiAgICAgICAgICAgICAgLy8gRmlsZSBkZXNjcmlwdG9yLXJlbGF0aXZlIG1ldGhvZHMuXG4gICAgICAgICAgICAgIHZhciByZW1vdGVDYiA9IDxJQ2FsbGJhY2tBcmd1bWVudD4gYXJnc1sxXTtcbiAgICAgICAgICAgICAgZmRDb252ZXJ0ZXIuYXBwbHlGZEFQSVJlcXVlc3QocmVxdWVzdCwgKGVycj86IEFwaUVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gU2VuZCByZXNwb25zZS5cbiAgICAgICAgICAgICAgICB2YXIgcmVzcG9uc2U6IElBUElSZXNwb25zZSA9IHtcbiAgICAgICAgICAgICAgICAgIGJyb3dzZXJmc01lc3NhZ2U6IHRydWUsXG4gICAgICAgICAgICAgICAgICBjYklkOiByZW1vdGVDYi5pZCxcbiAgICAgICAgICAgICAgICAgIGFyZ3M6IGVyciA/IFthcGlFcnJvckxvY2FsMlJlbW90ZShlcnIpXSA6IFtdXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB3b3JrZXIucG9zdE1lc3NhZ2UocmVzcG9uc2UpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pKCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdwcm9iZSc6XG4gICAgICAgICAgICAoKCkgPT4ge1xuICAgICAgICAgICAgICB2YXIgcm9vdEZzID0gPGZpbGVfc3lzdGVtLkZpbGVTeXN0ZW0+IGZzLmdldFJvb3RGUygpLFxuICAgICAgICAgICAgICAgIHJlbW90ZUNiID0gPElDYWxsYmFja0FyZ3VtZW50PiBhcmdzWzFdLFxuICAgICAgICAgICAgICAgIHByb2JlUmVzcG9uc2U6IElQcm9iZVJlc3BvbnNlID0ge1xuICAgICAgICAgICAgICAgICAgdHlwZTogU3BlY2lhbEFyZ1R5cGUuUFJPQkUsXG4gICAgICAgICAgICAgICAgICBpc1JlYWRPbmx5OiByb290RnMuaXNSZWFkT25seSgpLFxuICAgICAgICAgICAgICAgICAgc3VwcG9ydHNMaW5rczogcm9vdEZzLnN1cHBvcnRzTGlua3MoKSxcbiAgICAgICAgICAgICAgICAgIHN1cHBvcnRzUHJvcHM6IHJvb3RGcy5zdXBwb3J0c1Byb3BzKClcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlc3BvbnNlOiBJQVBJUmVzcG9uc2UgPSB7XG4gICAgICAgICAgICAgICAgICBicm93c2VyZnNNZXNzYWdlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgY2JJZDogcmVtb3RlQ2IuaWQsXG4gICAgICAgICAgICAgICAgICBhcmdzOiBbcHJvYmVSZXNwb25zZV1cbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgIHdvcmtlci5wb3N0TWVzc2FnZShyZXNwb25zZSk7XG4gICAgICAgICAgICB9KSgpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIC8vIEZpbGUgc3lzdGVtIG1ldGhvZHMuXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICBmaXhlZEFyZ3NbaV0gPSBhcmdSZW1vdGUyTG9jYWwoYXJnc1tpXSwgZml4ZWRBcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciByb290RlMgPSBmcy5nZXRSb290RlMoKTtcbiAgICAgICAgICAgICg8RnVuY3Rpb24+IHJvb3RGU1tyZXF1ZXN0Lm1ldGhvZF0pLmFwcGx5KHJvb3RGUywgZml4ZWRBcmdzKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==