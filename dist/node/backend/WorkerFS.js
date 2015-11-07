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
var node_fs_stats = require('../core/node_fs_stats');
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
        var fd = this._fileDescriptors[remoteFd.id], data = transferrableObjectToBuffer(remoteFd.data), remoteStats = node_fs_stats.Stats.fromBuffer(transferrableObjectToBuffer(remoteFd.stat));
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
    return node_fs_stats.Stats.fromBuffer(transferrableObjectToBuffer(stats.statsData));
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
                            return new WorkerFile(this, fdArg.path, file_flag.FileFlag.getFileFlag(fdArg.flag), node_fs_stats.Stats.fromBuffer(transferrableObjectToBuffer(fdArg.stat)), fdArg.id, transferrableObjectToBuffer(fdArg.data));
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
                if (arg instanceof node_fs_stats.Stats) {
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
                    if (arg instanceof node_fs_stats.Stats) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiV29ya2VyRlMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvYmFja2VuZC9Xb3JrZXJGUy50cyJdLCJuYW1lcyI6WyJTcGVjaWFsQXJnVHlwZSIsIkNhbGxiYWNrQXJndW1lbnRDb252ZXJ0ZXIiLCJDYWxsYmFja0FyZ3VtZW50Q29udmVydGVyLmNvbnN0cnVjdG9yIiwiQ2FsbGJhY2tBcmd1bWVudENvbnZlcnRlci50b1JlbW90ZUFyZyIsIkNhbGxiYWNrQXJndW1lbnRDb252ZXJ0ZXIudG9Mb2NhbEFyZyIsIkZpbGVEZXNjcmlwdG9yQXJndW1lbnRDb252ZXJ0ZXIiLCJGaWxlRGVzY3JpcHRvckFyZ3VtZW50Q29udmVydGVyLmNvbnN0cnVjdG9yIiwiRmlsZURlc2NyaXB0b3JBcmd1bWVudENvbnZlcnRlci50b1JlbW90ZUFyZyIsIkZpbGVEZXNjcmlwdG9yQXJndW1lbnRDb252ZXJ0ZXIuX2FwcGx5RmRDaGFuZ2VzIiwiRmlsZURlc2NyaXB0b3JBcmd1bWVudENvbnZlcnRlci5fYXBwbHlGZENoYW5nZXMuYXBwbHlTdGF0Q2hhbmdlcyIsIkZpbGVEZXNjcmlwdG9yQXJndW1lbnRDb252ZXJ0ZXIuYXBwbHlGZEFQSVJlcXVlc3QiLCJhcGlFcnJvckxvY2FsMlJlbW90ZSIsImFwaUVycm9yUmVtb3RlMkxvY2FsIiwiZXJyb3JMb2NhbDJSZW1vdGUiLCJlcnJvclJlbW90ZTJMb2NhbCIsInN0YXRzTG9jYWwyUmVtb3RlIiwic3RhdHNSZW1vdGUyTG9jYWwiLCJmaWxlRmxhZ0xvY2FsMlJlbW90ZSIsImZpbGVGbGFnUmVtb3RlMkxvY2FsIiwiYnVmZmVyVG9UcmFuc2ZlcnJhYmxlT2JqZWN0IiwidHJhbnNmZXJyYWJsZU9iamVjdFRvQnVmZmVyIiwiYnVmZmVyTG9jYWwyUmVtb3RlIiwiYnVmZmVyUmVtb3RlMkxvY2FsIiwiaXNBUElSZXF1ZXN0IiwiaXNBUElSZXNwb25zZSIsIldvcmtlckZpbGUiLCJXb3JrZXJGaWxlLmNvbnN0cnVjdG9yIiwiV29ya2VyRmlsZS5nZXRSZW1vdGVGZElkIiwiV29ya2VyRmlsZS50b1JlbW90ZUFyZyIsIldvcmtlckZpbGUuX3N5bmNDbG9zZSIsIldvcmtlckZpbGUuc3luYyIsIldvcmtlckZpbGUuY2xvc2UiLCJXb3JrZXJGUyIsIldvcmtlckZTLmNvbnN0cnVjdG9yIiwiV29ya2VyRlMuaXNBdmFpbGFibGUiLCJXb3JrZXJGUy5nZXROYW1lIiwiV29ya2VyRlMuX2FyZ1JlbW90ZTJMb2NhbCIsIldvcmtlckZTLl9hcmdMb2NhbDJSZW1vdGUiLCJXb3JrZXJGUy5pbml0aWFsaXplIiwiV29ya2VyRlMuaXNSZWFkT25seSIsIldvcmtlckZTLnN1cHBvcnRzU3luY2giLCJXb3JrZXJGUy5zdXBwb3J0c0xpbmtzIiwiV29ya2VyRlMuc3VwcG9ydHNQcm9wcyIsIldvcmtlckZTLl9ycGMiLCJXb3JrZXJGUy5yZW5hbWUiLCJXb3JrZXJGUy5zdGF0IiwiV29ya2VyRlMub3BlbiIsIldvcmtlckZTLnVubGluayIsIldvcmtlckZTLnJtZGlyIiwiV29ya2VyRlMubWtkaXIiLCJXb3JrZXJGUy5yZWFkZGlyIiwiV29ya2VyRlMuZXhpc3RzIiwiV29ya2VyRlMucmVhbHBhdGgiLCJXb3JrZXJGUy50cnVuY2F0ZSIsIldvcmtlckZTLnJlYWRGaWxlIiwiV29ya2VyRlMud3JpdGVGaWxlIiwiV29ya2VyRlMuYXBwZW5kRmlsZSIsIldvcmtlckZTLmNobW9kIiwiV29ya2VyRlMuY2hvd24iLCJXb3JrZXJGUy51dGltZXMiLCJXb3JrZXJGUy5saW5rIiwiV29ya2VyRlMuc3ltbGluayIsIldvcmtlckZTLnJlYWRsaW5rIiwiV29ya2VyRlMuc3luY0Nsb3NlIiwiV29ya2VyRlMuYXR0YWNoUmVtb3RlTGlzdGVuZXIiLCJXb3JrZXJGUy5hdHRhY2hSZW1vdGVMaXN0ZW5lci5hcmdMb2NhbDJSZW1vdGUiLCJXb3JrZXJGUy5hdHRhY2hSZW1vdGVMaXN0ZW5lci5hcmdSZW1vdGUyTG9jYWwiLCJhYm9ydEFuZFNlbmRF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QSxDQUFDQSxHQUFHQSxJQUFJQSxDQUFDQSxNQUFNQSxFQUFFQSxDQUFDQSxFQUFFQSxFQUFFQSxDQUFDQTs0QkFDakNBLFNBQVNBLENBQUNBLENBQUNBLENBQUNBLEdBQUdBLGVBQWVBLENBQUNBLElBQUlBLENBQUNBLENBQUNBLENBQUNBLEVBQUVBLFNBQVNBLENBQUNBLENBQUNBO3dCQUNyREEsQ0FBQ0E7d0JBQ0RBLElBQUlBLE1BQU1BLEdBQUdBLEVBQUVBLENBQUNBLFNBQVNBLEVBQUVBLENBQUNBO3dCQUNoQkEsTUFBTUEsQ0FBQ0EsT0FBT0EsQ0FBQ0EsTUFBTUEsQ0FBRUEsQ0FBQ0EsS0FBS0EsQ0FBQ0EsTUFBTUEsRUFBRUEsU0FBU0EsQ0FBQ0EsQ0FBQ0E7d0JBQzdEQSxLQUFLQSxDQUFDQTtnQkFDVkEsQ0FBQ0E7WUFDSEEsQ0FBQ0E7UUFDSEEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7SUFDTEEsQ0FBQ0E7SUFDSGhDLGVBQUNBO0FBQURBLENBQUNBLEFBM1hELEVBQXNDLFdBQVcsQ0FBQyxjQUFjLEVBMlgvRDtBQTNYRDs2QkEyWEMsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBmaWxlX3N5c3RlbSA9IHJlcXVpcmUoJy4uL2NvcmUvZmlsZV9zeXN0ZW0nKTtcbmltcG9ydCB7QXBpRXJyb3J9IGZyb20gJy4uL2NvcmUvYXBpX2Vycm9yJztcbmltcG9ydCBmaWxlX2ZsYWcgPSByZXF1aXJlKCcuLi9jb3JlL2ZpbGVfZmxhZycpO1xuaW1wb3J0IHtidWZmZXIyQXJyYXlCdWZmZXIsIGFycmF5QnVmZmVyMkJ1ZmZlcn0gZnJvbSAnLi4vY29yZS91dGlsJztcbmltcG9ydCBmaWxlID0gcmVxdWlyZSgnLi4vY29yZS9maWxlJyk7XG5pbXBvcnQgbm9kZV9mc19zdGF0cyA9IHJlcXVpcmUoJy4uL2NvcmUvbm9kZV9mc19zdGF0cycpO1xuaW1wb3J0IHByZWxvYWRfZmlsZSA9IHJlcXVpcmUoJy4uL2dlbmVyaWMvcHJlbG9hZF9maWxlJyk7XG5pbXBvcnQgZ2xvYmFsID0gcmVxdWlyZSgnLi4vY29yZS9nbG9iYWwnKTtcbmltcG9ydCBmcyA9IHJlcXVpcmUoJy4uL2NvcmUvbm9kZV9mcycpO1xuXG5pbnRlcmZhY2UgSUJyb3dzZXJGU01lc3NhZ2Uge1xuICBicm93c2VyZnNNZXNzYWdlOiBib29sZWFuO1xufVxuXG5lbnVtIFNwZWNpYWxBcmdUeXBlIHtcbiAgLy8gQ2FsbGJhY2tcbiAgQ0IsXG4gIC8vIEZpbGUgZGVzY3JpcHRvclxuICBGRCxcbiAgLy8gQVBJIGVycm9yXG4gIEFQSV9FUlJPUixcbiAgLy8gU3RhdHMgb2JqZWN0XG4gIFNUQVRTLFxuICAvLyBJbml0aWFsIHByb2JlIGZvciBmaWxlIHN5c3RlbSBpbmZvcm1hdGlvbi5cbiAgUFJPQkUsXG4gIC8vIEZpbGVGbGFnIG9iamVjdC5cbiAgRklMRUZMQUcsXG4gIC8vIEJ1ZmZlciBvYmplY3QuXG4gIEJVRkZFUixcbiAgLy8gR2VuZXJpYyBFcnJvciBvYmplY3QuXG4gIEVSUk9SXG59XG5cbmludGVyZmFjZSBJU3BlY2lhbEFyZ3VtZW50IHtcbiAgdHlwZTogU3BlY2lhbEFyZ1R5cGU7XG59XG5cbmludGVyZmFjZSBJUHJvYmVSZXNwb25zZSBleHRlbmRzIElTcGVjaWFsQXJndW1lbnQge1xuICBpc1JlYWRPbmx5OiBib29sZWFuO1xuICBzdXBwb3J0c0xpbmtzOiBib29sZWFuO1xuICBzdXBwb3J0c1Byb3BzOiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgSUNhbGxiYWNrQXJndW1lbnQgZXh0ZW5kcyBJU3BlY2lhbEFyZ3VtZW50IHtcbiAgLy8gVGhlIGNhbGxiYWNrIElELlxuICBpZDogbnVtYmVyO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGNhbGxiYWNrIGFyZ3VtZW50cyBpbnRvIElDYWxsYmFja0FyZ3VtZW50IG9iamVjdHMsIGFuZCBiYWNrXG4gKiBhZ2Fpbi5cbiAqL1xuY2xhc3MgQ2FsbGJhY2tBcmd1bWVudENvbnZlcnRlciB7XG4gIHByaXZhdGUgX2NhbGxiYWNrczogeyBbaWQ6IG51bWJlcl06IEZ1bmN0aW9uIH0gPSB7fTtcbiAgcHJpdmF0ZSBfbmV4dElkOiBudW1iZXIgPSAwO1xuXG4gIHB1YmxpYyB0b1JlbW90ZUFyZyhjYjogRnVuY3Rpb24pOiBJQ2FsbGJhY2tBcmd1bWVudCB7XG4gICAgdmFyIGlkID0gdGhpcy5fbmV4dElkKys7XG4gICAgdGhpcy5fY2FsbGJhY2tzW2lkXSA9IGNiO1xuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiBTcGVjaWFsQXJnVHlwZS5DQixcbiAgICAgIGlkOiBpZFxuICAgIH07XG4gIH1cblxuICBwdWJsaWMgdG9Mb2NhbEFyZyhpZDogbnVtYmVyKTogRnVuY3Rpb24ge1xuICAgIHZhciBjYiA9IHRoaXMuX2NhbGxiYWNrc1tpZF07XG4gICAgZGVsZXRlIHRoaXMuX2NhbGxiYWNrc1tpZF07XG4gICAgcmV0dXJuIGNiO1xuICB9XG59XG5cbmludGVyZmFjZSBJRmlsZURlc2NyaXB0b3JBcmd1bWVudCBleHRlbmRzIElTcGVjaWFsQXJndW1lbnQge1xuICAvLyBUaGUgZmlsZSBkZXNjcmlwdG9yJ3MgaWQgb24gdGhlIHJlbW90ZSBzaWRlLlxuICBpZDogbnVtYmVyO1xuICAvLyBUaGUgZW50aXJlIGZpbGUncyBkYXRhLCBhcyBhbiBhcnJheSBidWZmZXIuXG4gIGRhdGE6IEFycmF5QnVmZmVyO1xuICAvLyBUaGUgZmlsZSdzIHN0YXQgb2JqZWN0LCBhcyBhbiBhcnJheSBidWZmZXIuXG4gIHN0YXQ6IEFycmF5QnVmZmVyO1xuICAvLyBUaGUgcGF0aCB0byB0aGUgZmlsZS5cbiAgcGF0aDogc3RyaW5nO1xuICAvLyBUaGUgZmxhZyBvZiB0aGUgb3BlbiBmaWxlIGRlc2NyaXB0b3IuXG4gIGZsYWc6IHN0cmluZztcbn1cblxuY2xhc3MgRmlsZURlc2NyaXB0b3JBcmd1bWVudENvbnZlcnRlciB7XG4gIHByaXZhdGUgX2ZpbGVEZXNjcmlwdG9yczogeyBbaWQ6IG51bWJlcl06IGZpbGUuRmlsZSB9ID0ge307XG4gIHByaXZhdGUgX25leHRJZDogbnVtYmVyID0gMDtcblxuICBwdWJsaWMgdG9SZW1vdGVBcmcoZmQ6IGZpbGUuRmlsZSwgcDogc3RyaW5nLCBmbGFnOiBmaWxlX2ZsYWcuRmlsZUZsYWcsIGNiOiAoZXJyOiBBcGlFcnJvciwgYXJnPzogSUZpbGVEZXNjcmlwdG9yQXJndW1lbnQpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgaWQgPSB0aGlzLl9uZXh0SWQrKyxcbiAgICAgIGRhdGE6IEFycmF5QnVmZmVyLFxuICAgICAgc3RhdDogQXJyYXlCdWZmZXIsXG4gICAgICBhcmdzTGVmdDogbnVtYmVyID0gMjtcbiAgICB0aGlzLl9maWxlRGVzY3JpcHRvcnNbaWRdID0gZmQ7XG5cbiAgICAvLyBFeHRyYWN0IG5lZWRlZCBpbmZvcm1hdGlvbiBhc3luY2hyb25vdXNseS5cbiAgICBmZC5zdGF0KChlcnIsIHN0YXRzKSA9PiB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGNiKGVycik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdGF0ID0gYnVmZmVyVG9UcmFuc2ZlcnJhYmxlT2JqZWN0KHN0YXRzLnRvQnVmZmVyKCkpO1xuICAgICAgICAvLyBJZiBpdCdzIGEgcmVhZGFibGUgZmxhZywgd2UgbmVlZCB0byBncmFiIGNvbnRlbnRzLlxuICAgICAgICBpZiAoZmxhZy5pc1JlYWRhYmxlKCkpIHtcbiAgICAgICAgICBmZC5yZWFkKG5ldyBCdWZmZXIoc3RhdHMuc2l6ZSksIDAsIHN0YXRzLnNpemUsIDAsIChlcnIsIGJ5dGVzUmVhZCwgYnVmZikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZGF0YSA9IGJ1ZmZlclRvVHJhbnNmZXJyYWJsZU9iamVjdChidWZmKTtcbiAgICAgICAgICAgICAgY2IobnVsbCwge1xuICAgICAgICAgICAgICAgIHR5cGU6IFNwZWNpYWxBcmdUeXBlLkZELFxuICAgICAgICAgICAgICAgIGlkOiBpZCxcbiAgICAgICAgICAgICAgICBkYXRhOiBkYXRhLFxuICAgICAgICAgICAgICAgIHN0YXQ6IHN0YXQsXG4gICAgICAgICAgICAgICAgcGF0aDogcCxcbiAgICAgICAgICAgICAgICBmbGFnOiBmbGFnLmdldEZsYWdTdHJpbmcoKVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBGaWxlIGlzIG5vdCByZWFkYWJsZSwgd2hpY2ggbWVhbnMgd3JpdGluZyB0byBpdCB3aWxsIGFwcGVuZCBvclxuICAgICAgICAgIC8vIHRydW5jYXRlL3JlcGxhY2UgZXhpc3RpbmcgY29udGVudHMuIFJldHVybiBhbiBlbXB0eSBhcnJheWJ1ZmZlci5cbiAgICAgICAgICBjYihudWxsLCB7XG4gICAgICAgICAgICB0eXBlOiBTcGVjaWFsQXJnVHlwZS5GRCxcbiAgICAgICAgICAgIGlkOiBpZCxcbiAgICAgICAgICAgIGRhdGE6IG5ldyBBcnJheUJ1ZmZlcigwKSxcbiAgICAgICAgICAgIHN0YXQ6IHN0YXQsXG4gICAgICAgICAgICBwYXRoOiBwLFxuICAgICAgICAgICAgZmxhZzogZmxhZy5nZXRGbGFnU3RyaW5nKClcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfYXBwbHlGZENoYW5nZXMocmVtb3RlRmQ6IElGaWxlRGVzY3JpcHRvckFyZ3VtZW50LCBjYjogKGVycjogQXBpRXJyb3IsIGZkPzogZmlsZS5GaWxlKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIGZkID0gdGhpcy5fZmlsZURlc2NyaXB0b3JzW3JlbW90ZUZkLmlkXSxcbiAgICAgIGRhdGEgPSB0cmFuc2ZlcnJhYmxlT2JqZWN0VG9CdWZmZXIocmVtb3RlRmQuZGF0YSksXG4gICAgICByZW1vdGVTdGF0cyA9IG5vZGVfZnNfc3RhdHMuU3RhdHMuZnJvbUJ1ZmZlcih0cmFuc2ZlcnJhYmxlT2JqZWN0VG9CdWZmZXIocmVtb3RlRmQuc3RhdCkpO1xuXG4gICAgLy8gV3JpdGUgZGF0YSBpZiB0aGUgZmlsZSBpcyB3cml0YWJsZS5cbiAgICB2YXIgZmxhZyA9IGZpbGVfZmxhZy5GaWxlRmxhZy5nZXRGaWxlRmxhZyhyZW1vdGVGZC5mbGFnKTtcbiAgICBpZiAoZmxhZy5pc1dyaXRlYWJsZSgpKSB7XG4gICAgICAvLyBBcHBlbmRhYmxlOiBXcml0ZSB0byBlbmQgb2YgZmlsZS5cbiAgICAgIC8vIFdyaXRlYWJsZTogUmVwbGFjZSBlbnRpcmUgY29udGVudHMgb2YgZmlsZS5cbiAgICAgIGZkLndyaXRlKGRhdGEsIDAsIGRhdGEubGVuZ3RoLCBmbGFnLmlzQXBwZW5kYWJsZSgpID8gZmQuZ2V0UG9zKCkgOiAwLCAoZSkgPT4ge1xuICAgICAgICBpZiAoZSkge1xuICAgICAgICAgIGNiKGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZ1bmN0aW9uIGFwcGx5U3RhdENoYW5nZXMoKSB7XG4gICAgICAgICAgICAvLyBDaGVjayBpZiBtb2RlIGNoYW5nZWQuXG4gICAgICAgICAgICBmZC5zdGF0KChlLCBzdGF0cz8pID0+IHtcbiAgICAgICAgICAgICAgaWYgKGUpIHtcbiAgICAgICAgICAgICAgICBjYihlKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoc3RhdHMubW9kZSAhPT0gcmVtb3RlU3RhdHMubW9kZSkge1xuICAgICAgICAgICAgICAgICAgZmQuY2htb2QocmVtb3RlU3RhdHMubW9kZSwgKGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjYihlLCBmZCk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgY2IoZSwgZmQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gSWYgd3JpdGVhYmxlICYgbm90IGFwcGVuZGFibGUsIHdlIG5lZWQgdG8gZW5zdXJlIGZpbGUgY29udGVudHMgYXJlXG4gICAgICAgICAgLy8gaWRlbnRpY2FsIHRvIHRob3NlIGZyb20gdGhlIHJlbW90ZSBGRC4gVGh1cywgd2UgdHJ1bmNhdGUgdG8gdGhlXG4gICAgICAgICAgLy8gbGVuZ3RoIG9mIHRoZSByZW1vdGUgZmlsZS5cbiAgICAgICAgICBpZiAoIWZsYWcuaXNBcHBlbmRhYmxlKCkpIHtcbiAgICAgICAgICAgIGZkLnRydW5jYXRlKGRhdGEubGVuZ3RoLCAoKSA9PiB7XG4gICAgICAgICAgICAgIGFwcGx5U3RhdENoYW5nZXMoKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFwcGx5U3RhdENoYW5nZXMoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYihudWxsLCBmZCk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFwcGx5RmRBUElSZXF1ZXN0KHJlcXVlc3Q6IElBUElSZXF1ZXN0LCBjYjogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIGZkQXJnID0gPElGaWxlRGVzY3JpcHRvckFyZ3VtZW50PiByZXF1ZXN0LmFyZ3NbMF07XG4gICAgdGhpcy5fYXBwbHlGZENoYW5nZXMoZmRBcmcsIChlcnIsIGZkPykgPT4ge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBjYihlcnIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQXBwbHkgbWV0aG9kIG9uIG5vdy1jaGFuZ2VkIGZpbGUgZGVzY3JpcHRvci5cbiAgICAgICAgKDxhbnk+IGZkKVtyZXF1ZXN0Lm1ldGhvZF0oKGU/OiBBcGlFcnJvcikgPT4ge1xuICAgICAgICAgIGlmIChyZXF1ZXN0Lm1ldGhvZCA9PT0gJ2Nsb3NlJykge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2ZpbGVEZXNjcmlwdG9yc1tmZEFyZy5pZF07XG4gICAgICAgICAgfVxuICAgICAgICAgIGNiKGUpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG5pbnRlcmZhY2UgSUFQSUVycm9yQXJndW1lbnQgZXh0ZW5kcyBJU3BlY2lhbEFyZ3VtZW50IHtcbiAgLy8gVGhlIGVycm9yIG9iamVjdCwgYXMgYW4gYXJyYXkgYnVmZmVyLlxuICBlcnJvckRhdGE6IEFycmF5QnVmZmVyO1xufVxuXG5mdW5jdGlvbiBhcGlFcnJvckxvY2FsMlJlbW90ZShlOiBBcGlFcnJvcik6IElBUElFcnJvckFyZ3VtZW50IHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiBTcGVjaWFsQXJnVHlwZS5BUElfRVJST1IsXG4gICAgZXJyb3JEYXRhOiBidWZmZXJUb1RyYW5zZmVycmFibGVPYmplY3QoZS53cml0ZVRvQnVmZmVyKCkpXG4gIH07XG59XG5cbmZ1bmN0aW9uIGFwaUVycm9yUmVtb3RlMkxvY2FsKGU6IElBUElFcnJvckFyZ3VtZW50KTogQXBpRXJyb3Ige1xuICByZXR1cm4gQXBpRXJyb3IuZnJvbUJ1ZmZlcih0cmFuc2ZlcnJhYmxlT2JqZWN0VG9CdWZmZXIoZS5lcnJvckRhdGEpKTtcbn1cblxuaW50ZXJmYWNlIElFcnJvckFyZ3VtZW50IGV4dGVuZHMgSVNwZWNpYWxBcmd1bWVudCB7XG4gIC8vIFRoZSBuYW1lIG9mIHRoZSBlcnJvciAoZS5nLiAnVHlwZUVycm9yJykuXG4gIG5hbWU6IHN0cmluZztcbiAgLy8gVGhlIG1lc3NhZ2UgYXNzb2NpYXRlZCB3aXRoIHRoZSBlcnJvci5cbiAgbWVzc2FnZTogc3RyaW5nO1xuICAvLyBUaGUgc3RhY2sgYXNzb2NpYXRlZCB3aXRoIHRoZSBlcnJvci5cbiAgc3RhY2s6IHN0cmluZztcbn1cblxuZnVuY3Rpb24gZXJyb3JMb2NhbDJSZW1vdGUoZTogRXJyb3IpOiBJRXJyb3JBcmd1bWVudCB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogU3BlY2lhbEFyZ1R5cGUuRVJST1IsXG4gICAgbmFtZTogZS5uYW1lLFxuICAgIG1lc3NhZ2U6IGUubWVzc2FnZSxcbiAgICBzdGFjazogZS5zdGFja1xuICB9O1xufVxuXG5mdW5jdGlvbiBlcnJvclJlbW90ZTJMb2NhbChlOiBJRXJyb3JBcmd1bWVudCk6IEVycm9yIHtcbiAgdmFyIGNuc3RyOiB7XG4gICAgbmV3IChtc2c6IHN0cmluZyk6IEVycm9yO1xuICB9ID0gZ2xvYmFsW2UubmFtZV07XG4gIGlmICh0eXBlb2YoY25zdHIpICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgY25zdHIgPSBFcnJvcjtcbiAgfVxuICB2YXIgZXJyID0gbmV3IGNuc3RyKGUubWVzc2FnZSk7XG4gIGVyci5zdGFjayA9IGUuc3RhY2s7XG4gIHJldHVybiBlcnI7XG59XG5cbmludGVyZmFjZSBJU3RhdHNBcmd1bWVudCBleHRlbmRzIElTcGVjaWFsQXJndW1lbnQge1xuICAvLyBUaGUgc3RhdHMgb2JqZWN0IGFzIGFuIGFycmF5IGJ1ZmZlci5cbiAgc3RhdHNEYXRhOiBBcnJheUJ1ZmZlcjtcbn1cblxuZnVuY3Rpb24gc3RhdHNMb2NhbDJSZW1vdGUoc3RhdHM6IG5vZGVfZnNfc3RhdHMuU3RhdHMpOiBJU3RhdHNBcmd1bWVudCB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogU3BlY2lhbEFyZ1R5cGUuU1RBVFMsXG4gICAgc3RhdHNEYXRhOiBidWZmZXJUb1RyYW5zZmVycmFibGVPYmplY3Qoc3RhdHMudG9CdWZmZXIoKSlcbiAgfTtcbn1cblxuZnVuY3Rpb24gc3RhdHNSZW1vdGUyTG9jYWwoc3RhdHM6IElTdGF0c0FyZ3VtZW50KTogbm9kZV9mc19zdGF0cy5TdGF0cyB7XG4gIHJldHVybiBub2RlX2ZzX3N0YXRzLlN0YXRzLmZyb21CdWZmZXIodHJhbnNmZXJyYWJsZU9iamVjdFRvQnVmZmVyKHN0YXRzLnN0YXRzRGF0YSkpO1xufVxuXG5pbnRlcmZhY2UgSUZpbGVGbGFnQXJndW1lbnQgZXh0ZW5kcyBJU3BlY2lhbEFyZ3VtZW50IHtcbiAgZmxhZ1N0cjogc3RyaW5nO1xufVxuXG5mdW5jdGlvbiBmaWxlRmxhZ0xvY2FsMlJlbW90ZShmbGFnOiBmaWxlX2ZsYWcuRmlsZUZsYWcpOiBJRmlsZUZsYWdBcmd1bWVudCB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogU3BlY2lhbEFyZ1R5cGUuRklMRUZMQUcsXG4gICAgZmxhZ1N0cjogZmxhZy5nZXRGbGFnU3RyaW5nKClcbiAgfTtcbn1cblxuZnVuY3Rpb24gZmlsZUZsYWdSZW1vdGUyTG9jYWwocmVtb3RlRmxhZzogSUZpbGVGbGFnQXJndW1lbnQpOiBmaWxlX2ZsYWcuRmlsZUZsYWcge1xuICByZXR1cm4gZmlsZV9mbGFnLkZpbGVGbGFnLmdldEZpbGVGbGFnKHJlbW90ZUZsYWcuZmxhZ1N0cik7XG59XG5cbmludGVyZmFjZSBJQnVmZmVyQXJndW1lbnQgZXh0ZW5kcyBJU3BlY2lhbEFyZ3VtZW50IHtcbiAgZGF0YTogQXJyYXlCdWZmZXI7XG59XG5cbmZ1bmN0aW9uIGJ1ZmZlclRvVHJhbnNmZXJyYWJsZU9iamVjdChidWZmOiBOb2RlQnVmZmVyKTogQXJyYXlCdWZmZXIge1xuICByZXR1cm4gYnVmZmVyMkFycmF5QnVmZmVyKGJ1ZmYpO1xufVxuXG5mdW5jdGlvbiB0cmFuc2ZlcnJhYmxlT2JqZWN0VG9CdWZmZXIoYnVmZjogQXJyYXlCdWZmZXIpOiBCdWZmZXIge1xuICByZXR1cm4gYXJyYXlCdWZmZXIyQnVmZmVyKGJ1ZmYpO1xufVxuXG5mdW5jdGlvbiBidWZmZXJMb2NhbDJSZW1vdGUoYnVmZjogQnVmZmVyKTogSUJ1ZmZlckFyZ3VtZW50IHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiBTcGVjaWFsQXJnVHlwZS5CVUZGRVIsXG4gICAgZGF0YTogYnVmZmVyVG9UcmFuc2ZlcnJhYmxlT2JqZWN0KGJ1ZmYpXG4gIH07XG59XG5cbmZ1bmN0aW9uIGJ1ZmZlclJlbW90ZTJMb2NhbChidWZmQXJnOiBJQnVmZmVyQXJndW1lbnQpOiBCdWZmZXIge1xuICByZXR1cm4gdHJhbnNmZXJyYWJsZU9iamVjdFRvQnVmZmVyKGJ1ZmZBcmcuZGF0YSk7XG59XG5cbmludGVyZmFjZSBJQVBJUmVxdWVzdCBleHRlbmRzIElCcm93c2VyRlNNZXNzYWdlIHtcbiAgbWV0aG9kOiBzdHJpbmc7XG4gIGFyZ3M6IEFycmF5PG51bWJlciB8IHN0cmluZyB8IElTcGVjaWFsQXJndW1lbnQ+O1xufVxuXG5mdW5jdGlvbiBpc0FQSVJlcXVlc3QoZGF0YTogYW55KTogZGF0YSBpcyBJQVBJUmVxdWVzdCB7XG4gIHJldHVybiBkYXRhICE9IG51bGwgJiYgdHlwZW9mIGRhdGEgPT09ICdvYmplY3QnICYmIGRhdGEuaGFzT3duUHJvcGVydHkoJ2Jyb3dzZXJmc01lc3NhZ2UnKSAmJiBkYXRhWydicm93c2VyZnNNZXNzYWdlJ107XG59XG5cbmludGVyZmFjZSBJQVBJUmVzcG9uc2UgZXh0ZW5kcyBJQnJvd3NlckZTTWVzc2FnZSB7XG4gIGNiSWQ6IG51bWJlcjtcbiAgYXJnczogQXJyYXk8bnVtYmVyIHwgc3RyaW5nIHwgSVNwZWNpYWxBcmd1bWVudD47XG59XG5cbmZ1bmN0aW9uIGlzQVBJUmVzcG9uc2UoZGF0YTogYW55KTogZGF0YSBpcyBJQVBJUmVzcG9uc2Uge1xuICByZXR1cm4gZGF0YSAhPSBudWxsICYmIHR5cGVvZiBkYXRhID09PSAnb2JqZWN0JyAmJiBkYXRhLmhhc093blByb3BlcnR5KCdicm93c2VyZnNNZXNzYWdlJykgJiYgZGF0YVsnYnJvd3NlcmZzTWVzc2FnZSddO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYSByZW1vdGUgZmlsZSBpbiBhIGRpZmZlcmVudCB3b3JrZXIvdGhyZWFkLlxuICovXG5jbGFzcyBXb3JrZXJGaWxlIGV4dGVuZHMgcHJlbG9hZF9maWxlLlByZWxvYWRGaWxlPFdvcmtlckZTPiB7XG4gIHByaXZhdGUgX3JlbW90ZUZkSWQ6IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihfZnM6IFdvcmtlckZTLCBfcGF0aDogc3RyaW5nLCBfZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnLCBfc3RhdDogbm9kZV9mc19zdGF0cy5TdGF0cywgcmVtb3RlRmRJZDogbnVtYmVyLCBjb250ZW50cz86IE5vZGVCdWZmZXIpIHtcbiAgICBzdXBlcihfZnMsIF9wYXRoLCBfZmxhZywgX3N0YXQsIGNvbnRlbnRzKTtcbiAgICB0aGlzLl9yZW1vdGVGZElkID0gcmVtb3RlRmRJZDtcbiAgfVxuXG4gIHB1YmxpYyBnZXRSZW1vdGVGZElkKCkge1xuICAgIHJldHVybiB0aGlzLl9yZW1vdGVGZElkO1xuICB9XG5cbiAgcHVibGljIHRvUmVtb3RlQXJnKCk6IElGaWxlRGVzY3JpcHRvckFyZ3VtZW50IHtcbiAgICByZXR1cm4gPElGaWxlRGVzY3JpcHRvckFyZ3VtZW50PiB7XG4gICAgICB0eXBlOiBTcGVjaWFsQXJnVHlwZS5GRCxcbiAgICAgIGlkOiB0aGlzLl9yZW1vdGVGZElkLFxuICAgICAgZGF0YTogYnVmZmVyVG9UcmFuc2ZlcnJhYmxlT2JqZWN0KHRoaXMuZ2V0QnVmZmVyKCkpLFxuICAgICAgc3RhdDogYnVmZmVyVG9UcmFuc2ZlcnJhYmxlT2JqZWN0KHRoaXMuZ2V0U3RhdHMoKS50b0J1ZmZlcigpKSxcbiAgICAgIHBhdGg6IHRoaXMuZ2V0UGF0aCgpLFxuICAgICAgZmxhZzogdGhpcy5nZXRGbGFnKCkuZ2V0RmxhZ1N0cmluZygpXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgX3N5bmNDbG9zZSh0eXBlOiBzdHJpbmcsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaXNEaXJ0eSgpKSB7XG4gICAgICAoPFdvcmtlckZTPiB0aGlzLl9mcykuc3luY0Nsb3NlKHR5cGUsIHRoaXMsIChlPzogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgaWYgKCFlKSB7XG4gICAgICAgICAgdGhpcy5yZXNldERpcnR5KCk7XG4gICAgICAgIH1cbiAgICAgICAgY2IoZSk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2IoKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgc3luYyhjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3N5bmNDbG9zZSgnc3luYycsIGNiKTtcbiAgfVxuXG4gIHB1YmxpYyBjbG9zZShjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3N5bmNDbG9zZSgnY2xvc2UnLCBjYik7XG4gIH1cbn1cblxuLyoqXG4gKiBXb3JrZXJGUyBsZXRzIHlvdSBhY2Nlc3MgYSBCcm93c2VyRlMgaW5zdGFuY2UgdGhhdCBpcyBydW5uaW5nIGluIGEgZGlmZmVyZW50XG4gKiBKYXZhU2NyaXB0IGNvbnRleHQgKGUuZy4gYWNjZXNzIEJyb3dzZXJGUyBpbiBvbmUgb2YgeW91ciBXZWJXb3JrZXJzLCBvclxuICogYWNjZXNzIEJyb3dzZXJGUyBydW5uaW5nIG9uIHRoZSBtYWluIHBhZ2UgZnJvbSBhIFdlYldvcmtlcikuXG4gKlxuICogRm9yIGV4YW1wbGUsIHRvIGhhdmUgYSBXZWJXb3JrZXIgYWNjZXNzIGZpbGVzIGluIHRoZSBtYWluIGJyb3dzZXIgdGhyZWFkLFxuICogZG8gdGhlIGZvbGxvd2luZzpcbiAqXG4gKiBNQUlOIEJST1dTRVIgVEhSRUFEOlxuICogYGBgXG4gKiAgIC8vIExpc3RlbiBmb3IgcmVtb3RlIGZpbGUgc3lzdGVtIHJlcXVlc3RzLlxuICogICBCcm93c2VyRlMuRmlsZVN5c3RlbS5Xb3JrZXJGUy5hdHRhY2hSZW1vdGVMaXN0ZW5lcih3ZWJXb3JrZXJPYmplY3QpO1xuICogYGBcbiAqXG4gKiBXRUJXT1JLRVIgVEhSRUFEOlxuICogYGBgXG4gKiAgIC8vIFNldCB0aGUgcmVtb3RlIGZpbGUgc3lzdGVtIGFzIHRoZSByb290IGZpbGUgc3lzdGVtLlxuICogICBCcm93c2VyRlMuaW5pdGlhbGl6ZShuZXcgQnJvd3NlckZTLkZpbGVTeXN0ZW0uV29ya2VyRlMoc2VsZikpO1xuICogYGBgXG4gKlxuICogTm90ZSB0aGF0IHN5bmNocm9ub3VzIG9wZXJhdGlvbnMgYXJlIG5vdCBwZXJtaXR0ZWQgb24gdGhlIFdvcmtlckZTLCByZWdhcmRsZXNzXG4gKiBvZiB0aGUgY29uZmlndXJhdGlvbiBvcHRpb24gb2YgdGhlIHJlbW90ZSBGUy5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgV29ya2VyRlMgZXh0ZW5kcyBmaWxlX3N5c3RlbS5CYXNlRmlsZVN5c3RlbSBpbXBsZW1lbnRzIGZpbGVfc3lzdGVtLkZpbGVTeXN0ZW0ge1xuICBwcml2YXRlIF93b3JrZXI6IFdvcmtlcjtcbiAgcHJpdmF0ZSBfY2FsbGJhY2tDb252ZXJ0ZXIgPSBuZXcgQ2FsbGJhY2tBcmd1bWVudENvbnZlcnRlcigpO1xuXG4gIHByaXZhdGUgX2lzSW5pdGlhbGl6ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcbiAgcHJpdmF0ZSBfaXNSZWFkT25seTogYm9vbGVhbiA9IGZhbHNlO1xuICBwcml2YXRlIF9zdXBwb3J0TGlua3M6IGJvb2xlYW4gPSBmYWxzZTtcbiAgcHJpdmF0ZSBfc3VwcG9ydFByb3BzOiBib29sZWFuID0gZmFsc2U7XG5cbiAgLyoqXG4gICAqIFN0b3JlcyBvdXRzdGFuZGluZyBBUEkgcmVxdWVzdHMgdG8gdGhlIHJlbW90ZSBCcm93c2VyRlMgaW5zdGFuY2UuXG4gICAqL1xuICBwcml2YXRlIF9vdXRzdGFuZGluZ1JlcXVlc3RzOiB7IFtpZDogbnVtYmVyXTogKCkgPT4gdm9pZCB9ID0ge307XG5cbiAgLyoqXG4gICAqIENvbnN0cnVjdHMgYSBuZXcgV29ya2VyRlMgaW5zdGFuY2UgdGhhdCBjb25uZWN0cyB3aXRoIEJyb3dzZXJGUyBydW5uaW5nIG9uXG4gICAqIHRoZSBzcGVjaWZpZWQgd29ya2VyLlxuICAgKi9cbiAgY29uc3RydWN0b3Iod29ya2VyOiBXb3JrZXIpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX3dvcmtlciA9IHdvcmtlcjtcbiAgICB0aGlzLl93b3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsKGU6IE1lc3NhZ2VFdmVudCkgPT4ge1xuICAgICAgdmFyIHJlc3A6IE9iamVjdCA9IGUuZGF0YTtcbiAgICAgIGlmIChpc0FQSVJlc3BvbnNlKHJlc3ApKSB7XG4gICAgICAgIHZhciBpOiBudW1iZXIsIGFyZ3MgPSByZXNwLmFyZ3MsIGZpeGVkQXJncyA9IG5ldyBBcnJheShhcmdzLmxlbmd0aCk7XG4gICAgICAgIC8vIERpc3BhdGNoIGV2ZW50IHRvIGNvcnJlY3QgaWQuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBmaXhlZEFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBmaXhlZEFyZ3NbaV0gPSB0aGlzLl9hcmdSZW1vdGUyTG9jYWwoYXJnc1tpXSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fY2FsbGJhY2tDb252ZXJ0ZXIudG9Mb2NhbEFyZyhyZXNwLmNiSWQpLmFwcGx5KG51bGwsIGZpeGVkQXJncyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGlzQXZhaWxhYmxlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0eXBlb2YgV29ya2VyICE9PSAndW5kZWZpbmVkJztcbiAgfVxuXG4gIHB1YmxpYyBnZXROYW1lKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuICdXb3JrZXJGUyc7XG4gIH1cblxuICBwcml2YXRlIF9hcmdSZW1vdGUyTG9jYWwoYXJnOiBhbnkpOiBhbnkge1xuICAgIGlmIChhcmcgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGFyZztcbiAgICB9XG4gICAgc3dpdGNoICh0eXBlb2YgYXJnKSB7XG4gICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICBpZiAoYXJnWyd0eXBlJ10gIT0gbnVsbCAmJiB0eXBlb2YgYXJnWyd0eXBlJ10gPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgdmFyIHNwZWNpYWxBcmcgPSA8SVNwZWNpYWxBcmd1bWVudD4gYXJnO1xuICAgICAgICAgIHN3aXRjaCAoc3BlY2lhbEFyZy50eXBlKSB7XG4gICAgICAgICAgICBjYXNlIFNwZWNpYWxBcmdUeXBlLkFQSV9FUlJPUjpcbiAgICAgICAgICAgICAgcmV0dXJuIGFwaUVycm9yUmVtb3RlMkxvY2FsKDxJQVBJRXJyb3JBcmd1bWVudD4gc3BlY2lhbEFyZyk7XG4gICAgICAgICAgICBjYXNlIFNwZWNpYWxBcmdUeXBlLkZEOlxuICAgICAgICAgICAgICB2YXIgZmRBcmcgPSA8SUZpbGVEZXNjcmlwdG9yQXJndW1lbnQ+IHNwZWNpYWxBcmc7XG4gICAgICAgICAgICAgIHJldHVybiBuZXcgV29ya2VyRmlsZSh0aGlzLCBmZEFyZy5wYXRoLCBmaWxlX2ZsYWcuRmlsZUZsYWcuZ2V0RmlsZUZsYWcoZmRBcmcuZmxhZyksIG5vZGVfZnNfc3RhdHMuU3RhdHMuZnJvbUJ1ZmZlcih0cmFuc2ZlcnJhYmxlT2JqZWN0VG9CdWZmZXIoZmRBcmcuc3RhdCkpLCBmZEFyZy5pZCwgdHJhbnNmZXJyYWJsZU9iamVjdFRvQnVmZmVyKGZkQXJnLmRhdGEpKTtcbiAgICAgICAgICAgIGNhc2UgU3BlY2lhbEFyZ1R5cGUuU1RBVFM6XG4gICAgICAgICAgICAgIHJldHVybiBzdGF0c1JlbW90ZTJMb2NhbCg8SVN0YXRzQXJndW1lbnQ+IHNwZWNpYWxBcmcpO1xuICAgICAgICAgICAgY2FzZSBTcGVjaWFsQXJnVHlwZS5GSUxFRkxBRzpcbiAgICAgICAgICAgICAgcmV0dXJuIGZpbGVGbGFnUmVtb3RlMkxvY2FsKDxJRmlsZUZsYWdBcmd1bWVudD4gc3BlY2lhbEFyZyk7XG4gICAgICAgICAgICBjYXNlIFNwZWNpYWxBcmdUeXBlLkJVRkZFUjpcbiAgICAgICAgICAgICAgcmV0dXJuIGJ1ZmZlclJlbW90ZTJMb2NhbCg8SUJ1ZmZlckFyZ3VtZW50PiBzcGVjaWFsQXJnKTtcbiAgICAgICAgICAgIGNhc2UgU3BlY2lhbEFyZ1R5cGUuRVJST1I6XG4gICAgICAgICAgICAgIHJldHVybiBlcnJvclJlbW90ZTJMb2NhbCg8SUVycm9yQXJndW1lbnQ+IHNwZWNpYWxBcmcpO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgcmV0dXJuIGFyZztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGFyZztcbiAgICAgICAgfVxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIGFyZztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydHMgYSBsb2NhbCBhcmd1bWVudCBpbnRvIGEgcmVtb3RlIGFyZ3VtZW50LiBQdWJsaWMgc28gV29ya2VyRmlsZSBvYmplY3RzIGNhbiBjYWxsIGl0LlxuICAgKi9cbiAgcHVibGljIF9hcmdMb2NhbDJSZW1vdGUoYXJnOiBhbnkpOiBhbnkge1xuICAgIGlmIChhcmcgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGFyZztcbiAgICB9XG4gICAgc3dpdGNoICh0eXBlb2YgYXJnKSB7XG4gICAgICBjYXNlIFwib2JqZWN0XCI6XG4gICAgICAgIGlmIChhcmcgaW5zdGFuY2VvZiBub2RlX2ZzX3N0YXRzLlN0YXRzKSB7XG4gICAgICAgICAgcmV0dXJuIHN0YXRzTG9jYWwyUmVtb3RlKGFyZyk7XG4gICAgICAgIH0gZWxzZSBpZiAoYXJnIGluc3RhbmNlb2YgQXBpRXJyb3IpIHtcbiAgICAgICAgICByZXR1cm4gYXBpRXJyb3JMb2NhbDJSZW1vdGUoYXJnKTtcbiAgICAgICAgfSBlbHNlIGlmIChhcmcgaW5zdGFuY2VvZiBXb3JrZXJGaWxlKSB7XG4gICAgICAgICAgcmV0dXJuICg8V29ya2VyRmlsZT4gYXJnKS50b1JlbW90ZUFyZygpO1xuICAgICAgICB9IGVsc2UgaWYgKGFyZyBpbnN0YW5jZW9mIGZpbGVfZmxhZy5GaWxlRmxhZykge1xuICAgICAgICAgIHJldHVybiBmaWxlRmxhZ0xvY2FsMlJlbW90ZShhcmcpO1xuICAgICAgICB9IGVsc2UgaWYgKGFyZyBpbnN0YW5jZW9mIEJ1ZmZlcikge1xuICAgICAgICAgIHJldHVybiBidWZmZXJMb2NhbDJSZW1vdGUoYXJnKTtcbiAgICAgICAgfSBlbHNlIGlmIChhcmcgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICAgIHJldHVybiBlcnJvckxvY2FsMlJlbW90ZShhcmcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBcIlVua25vd24gYXJndW1lbnRcIjtcbiAgICAgICAgfVxuICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6XG4gICAgICAgIHJldHVybiB0aGlzLl9jYWxsYmFja0NvbnZlcnRlci50b1JlbW90ZUFyZyhhcmcpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIGFyZztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIG9uY2UgYm90aCBsb2NhbCBhbmQgcmVtb3RlIHNpZGVzIGFyZSBzZXQgdXAuXG4gICAqL1xuICBwdWJsaWMgaW5pdGlhbGl6ZShjYjogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5faXNJbml0aWFsaXplZCkge1xuICAgICAgdmFyIG1lc3NhZ2U6IElBUElSZXF1ZXN0ID0ge1xuICAgICAgICBicm93c2VyZnNNZXNzYWdlOiB0cnVlLFxuICAgICAgICBtZXRob2Q6ICdwcm9iZScsXG4gICAgICAgIGFyZ3M6IFt0aGlzLl9hcmdMb2NhbDJSZW1vdGUobmV3IEJ1ZmZlcigwKSksIHRoaXMuX2NhbGxiYWNrQ29udmVydGVyLnRvUmVtb3RlQXJnKChwcm9iZVJlc3BvbnNlOiBJUHJvYmVSZXNwb25zZSkgPT4ge1xuICAgICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgICAgICAgIHRoaXMuX2lzUmVhZE9ubHkgPSBwcm9iZVJlc3BvbnNlLmlzUmVhZE9ubHk7XG4gICAgICAgICAgdGhpcy5fc3VwcG9ydExpbmtzID0gcHJvYmVSZXNwb25zZS5zdXBwb3J0c0xpbmtzO1xuICAgICAgICAgIHRoaXMuX3N1cHBvcnRQcm9wcyA9IHByb2JlUmVzcG9uc2Uuc3VwcG9ydHNQcm9wcztcbiAgICAgICAgICBjYigpO1xuICAgICAgICB9KV1cbiAgICAgIH07XG4gICAgICB0aGlzLl93b3JrZXIucG9zdE1lc3NhZ2UobWVzc2FnZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNiKCk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGlzUmVhZE9ubHkoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9pc1JlYWRPbmx5OyB9XG4gIHB1YmxpYyBzdXBwb3J0c1N5bmNoKCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cbiAgcHVibGljIHN1cHBvcnRzTGlua3MoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9zdXBwb3J0TGlua3M7IH1cbiAgcHVibGljIHN1cHBvcnRzUHJvcHMoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9zdXBwb3J0UHJvcHM7IH1cblxuICBwcml2YXRlIF9ycGMobWV0aG9kTmFtZTogc3RyaW5nLCBhcmdzOiBJQXJndW1lbnRzKSB7XG4gICAgdmFyIG1lc3NhZ2U6IElBUElSZXF1ZXN0ID0ge1xuICAgICAgYnJvd3NlcmZzTWVzc2FnZTogdHJ1ZSxcbiAgICAgIG1ldGhvZDogbWV0aG9kTmFtZSxcbiAgICAgIGFyZ3M6IG51bGxcbiAgICB9LCBmaXhlZEFyZ3MgPSBuZXcgQXJyYXkoYXJncy5sZW5ndGgpLCBpOiBudW1iZXI7XG4gICAgZm9yIChpID0gMDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZpeGVkQXJnc1tpXSA9IHRoaXMuX2FyZ0xvY2FsMlJlbW90ZShhcmdzW2ldKTtcbiAgICB9XG4gICAgbWVzc2FnZS5hcmdzID0gZml4ZWRBcmdzO1xuICAgIHRoaXMuX3dvcmtlci5wb3N0TWVzc2FnZShtZXNzYWdlKTtcbiAgfVxuXG4gIHB1YmxpYyByZW5hbWUob2xkUGF0aDogc3RyaW5nLCBuZXdQYXRoOiBzdHJpbmcsIGNiOiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ3JlbmFtZScsIGFyZ3VtZW50cyk7XG4gIH1cbiAgcHVibGljIHN0YXQocDogc3RyaW5nLCBpc0xzdGF0OiBib29sZWFuLCBjYjogKGVycjogQXBpRXJyb3IsIHN0YXQ/OiBub2RlX2ZzX3N0YXRzLlN0YXRzKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fcnBjKCdzdGF0JywgYXJndW1lbnRzKTtcbiAgfVxuICBwdWJsaWMgb3BlbihwOiBzdHJpbmcsIGZsYWc6IGZpbGVfZmxhZy5GaWxlRmxhZywgbW9kZTogbnVtYmVyLCBjYjogKGVycjogQXBpRXJyb3IsIGZkPzogZmlsZS5GaWxlKSA9PiBhbnkpOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ29wZW4nLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyB1bmxpbmsocDogc3RyaW5nLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ3VubGluaycsIGFyZ3VtZW50cyk7XG4gIH1cbiAgcHVibGljIHJtZGlyKHA6IHN0cmluZywgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgdGhpcy5fcnBjKCdybWRpcicsIGFyZ3VtZW50cyk7XG4gIH1cbiAgcHVibGljIG1rZGlyKHA6IHN0cmluZywgbW9kZTogbnVtYmVyLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ21rZGlyJywgYXJndW1lbnRzKTtcbiAgfVxuICBwdWJsaWMgcmVhZGRpcihwOiBzdHJpbmcsIGNiOiAoZXJyOiBBcGlFcnJvciwgZmlsZXM/OiBzdHJpbmdbXSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3JwYygncmVhZGRpcicsIGFyZ3VtZW50cyk7XG4gIH1cbiAgcHVibGljIGV4aXN0cyhwOiBzdHJpbmcsIGNiOiAoZXhpc3RzOiBib29sZWFuKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fcnBjKCdleGlzdHMnLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyByZWFscGF0aChwOiBzdHJpbmcsIGNhY2hlOiB7IFtwYXRoOiBzdHJpbmddOiBzdHJpbmcgfSwgY2I6IChlcnI6IEFwaUVycm9yLCByZXNvbHZlZFBhdGg/OiBzdHJpbmcpID0+IGFueSk6IHZvaWQge1xuICAgIHRoaXMuX3JwYygncmVhbHBhdGgnLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyB0cnVuY2F0ZShwOiBzdHJpbmcsIGxlbjogbnVtYmVyLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ3RydW5jYXRlJywgYXJndW1lbnRzKTtcbiAgfVxuICBwdWJsaWMgcmVhZEZpbGUoZm5hbWU6IHN0cmluZywgZW5jb2Rpbmc6IHN0cmluZywgZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnLCBjYjogKGVycjogQXBpRXJyb3IsIGRhdGE/OiBhbnkpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ3JlYWRGaWxlJywgYXJndW1lbnRzKTtcbiAgfVxuICBwdWJsaWMgd3JpdGVGaWxlKGZuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgZW5jb2Rpbmc6IHN0cmluZywgZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnLCBtb2RlOiBudW1iZXIsIGNiOiAoZXJyOiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3JwYygnd3JpdGVGaWxlJywgYXJndW1lbnRzKTtcbiAgfVxuICBwdWJsaWMgYXBwZW5kRmlsZShmbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGVuY29kaW5nOiBzdHJpbmcsIGZsYWc6IGZpbGVfZmxhZy5GaWxlRmxhZywgbW9kZTogbnVtYmVyLCBjYjogKGVycjogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ2FwcGVuZEZpbGUnLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyBjaG1vZChwOiBzdHJpbmcsIGlzTGNobW9kOiBib29sZWFuLCBtb2RlOiBudW1iZXIsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRoaXMuX3JwYygnY2htb2QnLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyBjaG93bihwOiBzdHJpbmcsIGlzTGNob3duOiBib29sZWFuLCB1aWQ6IG51bWJlciwgZ2lkOiBudW1iZXIsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRoaXMuX3JwYygnY2hvd24nLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyB1dGltZXMocDogc3RyaW5nLCBhdGltZTogRGF0ZSwgbXRpbWU6IERhdGUsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRoaXMuX3JwYygndXRpbWVzJywgYXJndW1lbnRzKTtcbiAgfVxuICBwdWJsaWMgbGluayhzcmNwYXRoOiBzdHJpbmcsIGRzdHBhdGg6IHN0cmluZywgY2I6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgdGhpcy5fcnBjKCdsaW5rJywgYXJndW1lbnRzKTtcbiAgfVxuICBwdWJsaWMgc3ltbGluayhzcmNwYXRoOiBzdHJpbmcsIGRzdHBhdGg6IHN0cmluZywgdHlwZTogc3RyaW5nLCBjYjogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICB0aGlzLl9ycGMoJ3N5bWxpbmsnLCBhcmd1bWVudHMpO1xuICB9XG4gIHB1YmxpYyByZWFkbGluayhwOiBzdHJpbmcsIGNiOiBGdW5jdGlvbik6IHZvaWQge1xuICAgIHRoaXMuX3JwYygncmVhZGxpbmsnLCBhcmd1bWVudHMpO1xuICB9XG5cbiAgcHVibGljIHN5bmNDbG9zZShtZXRob2Q6IHN0cmluZywgZmQ6IGZpbGUuRmlsZSwgY2I6IChlOiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX3dvcmtlci5wb3N0TWVzc2FnZSg8SUFQSVJlcXVlc3Q+IHtcbiAgICAgIGJyb3dzZXJmc01lc3NhZ2U6IHRydWUsXG4gICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgIGFyZ3M6IFsoPFdvcmtlckZpbGU+IGZkKS50b1JlbW90ZUFyZygpLCB0aGlzLl9jYWxsYmFja0NvbnZlcnRlci50b1JlbW90ZUFyZyhjYildXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQXR0YWNoZXMgYSBsaXN0ZW5lciB0byB0aGUgcmVtb3RlIHdvcmtlciBmb3IgZmlsZSBzeXN0ZW0gcmVxdWVzdHMuXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGF0dGFjaFJlbW90ZUxpc3RlbmVyKHdvcmtlcjogV29ya2VyKSB7XG4gICAgdmFyIGZkQ29udmVydGVyID0gbmV3IEZpbGVEZXNjcmlwdG9yQXJndW1lbnRDb252ZXJ0ZXIoKTtcblxuICAgIGZ1bmN0aW9uIGFyZ0xvY2FsMlJlbW90ZShhcmc6IGFueSwgcmVxdWVzdEFyZ3M6IGFueVtdLCBjYjogKGVycjogQXBpRXJyb3IsIGFyZz86IGFueSkgPT4gdm9pZCk6IHZvaWQge1xuICAgICAgc3dpdGNoICh0eXBlb2YgYXJnKSB7XG4gICAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgICAgaWYgKGFyZyBpbnN0YW5jZW9mIG5vZGVfZnNfc3RhdHMuU3RhdHMpIHtcbiAgICAgICAgICAgIGNiKG51bGwsIHN0YXRzTG9jYWwyUmVtb3RlKGFyZykpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoYXJnIGluc3RhbmNlb2YgQXBpRXJyb3IpIHtcbiAgICAgICAgICAgIGNiKG51bGwsIGFwaUVycm9yTG9jYWwyUmVtb3RlKGFyZykpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoYXJnIGluc3RhbmNlb2YgZmlsZS5CYXNlRmlsZSkge1xuICAgICAgICAgICAgLy8gUGFzcyBpbiBwIGFuZCBmbGFncyBmcm9tIG9yaWdpbmFsIHJlcXVlc3QuXG4gICAgICAgICAgICBjYihudWxsLCBmZENvbnZlcnRlci50b1JlbW90ZUFyZyhhcmcsIHJlcXVlc3RBcmdzWzBdLCByZXF1ZXN0QXJnc1sxXSwgY2IpKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGFyZyBpbnN0YW5jZW9mIGZpbGVfZmxhZy5GaWxlRmxhZykge1xuICAgICAgICAgICAgY2IobnVsbCwgZmlsZUZsYWdMb2NhbDJSZW1vdGUoYXJnKSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChhcmcgaW5zdGFuY2VvZiBCdWZmZXIpIHtcbiAgICAgICAgICAgIGNiKG51bGwsIGJ1ZmZlckxvY2FsMlJlbW90ZShhcmcpKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGFyZyBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgICAgICBjYihudWxsLCBlcnJvckxvY2FsMlJlbW90ZShhcmcpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2IobnVsbCwgYXJnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgY2IobnVsbCwgYXJnKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhcmdSZW1vdGUyTG9jYWwoYXJnOiBhbnksIGZpeGVkUmVxdWVzdEFyZ3M6IGFueVtdKTogYW55IHtcbiAgICAgIGlmIChhcmcgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gYXJnO1xuICAgICAgfVxuICAgICAgc3dpdGNoICh0eXBlb2YgYXJnKSB7XG4gICAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgICAgaWYgKHR5cGVvZiBhcmdbJ3R5cGUnXSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHZhciBzcGVjaWFsQXJnID0gPElTcGVjaWFsQXJndW1lbnQ+IGFyZztcbiAgICAgICAgICAgIHN3aXRjaCAoc3BlY2lhbEFyZy50eXBlKSB7XG4gICAgICAgICAgICAgIGNhc2UgU3BlY2lhbEFyZ1R5cGUuQ0I6XG4gICAgICAgICAgICAgICAgdmFyIGNiSWQgPSAoPElDYWxsYmFja0FyZ3VtZW50PiBhcmcpLmlkO1xuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgIHZhciBpOiBudW1iZXIsIGZpeGVkQXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoKSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogSUFQSVJlc3BvbnNlLFxuICAgICAgICAgICAgICAgICAgICBjb3VudGRvd24gPSBhcmd1bWVudHMubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgICBmdW5jdGlvbiBhYm9ydEFuZFNlbmRFcnJvcihlcnI6IEFwaUVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb3VudGRvd24gPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgY291bnRkb3duID0gLTE7XG4gICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyb3dzZXJmc01lc3NhZ2U6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjYklkOiBjYklkLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXJnczogW2FwaUVycm9yTG9jYWwyUmVtb3RlKGVycildXG4gICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICB3b3JrZXIucG9zdE1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIENhcHR1cmUgaSBhbmQgYXJndW1lbnQuXG4gICAgICAgICAgICAgICAgICAgICgoaTogbnVtYmVyLCBhcmc6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGFyZ0xvY2FsMlJlbW90ZShhcmcsIGZpeGVkUmVxdWVzdEFyZ3MsIChlcnIsIGZpeGVkQXJnPykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZml4ZWRBcmdzW2ldID0gZml4ZWRBcmc7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGFib3J0QW5kU2VuZEVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKC0tY291bnRkb3duID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJvd3NlcmZzTWVzc2FnZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYklkOiBjYklkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3M6IGZpeGVkQXJnc1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICB3b3JrZXIucG9zdE1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pKGksIGFyZ3VtZW50c1tpXSk7XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgYnJvd3NlcmZzTWVzc2FnZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICBjYklkOiBjYklkLFxuICAgICAgICAgICAgICAgICAgICAgIGFyZ3M6IGZpeGVkQXJnc1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB3b3JrZXIucG9zdE1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICBjYXNlIFNwZWNpYWxBcmdUeXBlLkFQSV9FUlJPUjpcbiAgICAgICAgICAgICAgICByZXR1cm4gYXBpRXJyb3JSZW1vdGUyTG9jYWwoPElBUElFcnJvckFyZ3VtZW50PiBzcGVjaWFsQXJnKTtcbiAgICAgICAgICAgICAgY2FzZSBTcGVjaWFsQXJnVHlwZS5TVEFUUzpcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RhdHNSZW1vdGUyTG9jYWwoPElTdGF0c0FyZ3VtZW50PiBzcGVjaWFsQXJnKTtcbiAgICAgICAgICAgICAgY2FzZSBTcGVjaWFsQXJnVHlwZS5GSUxFRkxBRzpcbiAgICAgICAgICAgICAgICByZXR1cm4gZmlsZUZsYWdSZW1vdGUyTG9jYWwoPElGaWxlRmxhZ0FyZ3VtZW50PiBzcGVjaWFsQXJnKTtcbiAgICAgICAgICAgICAgY2FzZSBTcGVjaWFsQXJnVHlwZS5CVUZGRVI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ1ZmZlclJlbW90ZTJMb2NhbCg8SUJ1ZmZlckFyZ3VtZW50PiBzcGVjaWFsQXJnKTtcbiAgICAgICAgICAgICAgY2FzZSBTcGVjaWFsQXJnVHlwZS5FUlJPUjpcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZW1vdGUyTG9jYWwoPElFcnJvckFyZ3VtZW50PiBzcGVjaWFsQXJnKTtcbiAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAvLyBObyBpZGVhIHdoYXQgdGhpcyBpcy5cbiAgICAgICAgICAgICAgICByZXR1cm4gYXJnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gYXJnO1xuICAgICAgICAgIH1cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gYXJnO1xuICAgICAgfVxuICAgIH1cblxuICAgIHdvcmtlci5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywoZTogTWVzc2FnZUV2ZW50KSA9PiB7XG4gICAgICB2YXIgcmVxdWVzdDogT2JqZWN0ID0gZS5kYXRhO1xuICAgICAgaWYgKGlzQVBJUmVxdWVzdChyZXF1ZXN0KSkge1xuICAgICAgICB2YXIgYXJncyA9IHJlcXVlc3QuYXJncyxcbiAgICAgICAgICBmaXhlZEFyZ3MgPSBuZXcgQXJyYXk8YW55PihhcmdzLmxlbmd0aCksXG4gICAgICAgICAgaTogbnVtYmVyO1xuXG4gICAgICAgIHN3aXRjaCAocmVxdWVzdC5tZXRob2QpIHtcbiAgICAgICAgICBjYXNlICdjbG9zZSc6XG4gICAgICAgICAgY2FzZSAnc3luYyc6XG4gICAgICAgICAgICAoKCkgPT4ge1xuICAgICAgICAgICAgICAvLyBGaWxlIGRlc2NyaXB0b3ItcmVsYXRpdmUgbWV0aG9kcy5cbiAgICAgICAgICAgICAgdmFyIHJlbW90ZUNiID0gPElDYWxsYmFja0FyZ3VtZW50PiBhcmdzWzFdO1xuICAgICAgICAgICAgICBmZENvbnZlcnRlci5hcHBseUZkQVBJUmVxdWVzdChyZXF1ZXN0LCAoZXJyPzogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBTZW5kIHJlc3BvbnNlLlxuICAgICAgICAgICAgICAgIHZhciByZXNwb25zZTogSUFQSVJlc3BvbnNlID0ge1xuICAgICAgICAgICAgICAgICAgYnJvd3NlcmZzTWVzc2FnZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgIGNiSWQ6IHJlbW90ZUNiLmlkLFxuICAgICAgICAgICAgICAgICAgYXJnczogZXJyID8gW2FwaUVycm9yTG9jYWwyUmVtb3RlKGVycildIDogW11cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHdvcmtlci5wb3N0TWVzc2FnZShyZXNwb25zZSk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSkoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ3Byb2JlJzpcbiAgICAgICAgICAgICgoKSA9PiB7XG4gICAgICAgICAgICAgIHZhciByb290RnMgPSA8ZmlsZV9zeXN0ZW0uRmlsZVN5c3RlbT4gZnMuZ2V0Um9vdEZTKCksXG4gICAgICAgICAgICAgICAgcmVtb3RlQ2IgPSA8SUNhbGxiYWNrQXJndW1lbnQ+IGFyZ3NbMV0sXG4gICAgICAgICAgICAgICAgcHJvYmVSZXNwb25zZTogSVByb2JlUmVzcG9uc2UgPSB7XG4gICAgICAgICAgICAgICAgICB0eXBlOiBTcGVjaWFsQXJnVHlwZS5QUk9CRSxcbiAgICAgICAgICAgICAgICAgIGlzUmVhZE9ubHk6IHJvb3RGcy5pc1JlYWRPbmx5KCksXG4gICAgICAgICAgICAgICAgICBzdXBwb3J0c0xpbmtzOiByb290RnMuc3VwcG9ydHNMaW5rcygpLFxuICAgICAgICAgICAgICAgICAgc3VwcG9ydHNQcm9wczogcm9vdEZzLnN1cHBvcnRzUHJvcHMoKVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVzcG9uc2U6IElBUElSZXNwb25zZSA9IHtcbiAgICAgICAgICAgICAgICAgIGJyb3dzZXJmc01lc3NhZ2U6IHRydWUsXG4gICAgICAgICAgICAgICAgICBjYklkOiByZW1vdGVDYi5pZCxcbiAgICAgICAgICAgICAgICAgIGFyZ3M6IFtwcm9iZVJlc3BvbnNlXVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgd29ya2VyLnBvc3RNZXNzYWdlKHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH0pKCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgLy8gRmlsZSBzeXN0ZW0gbWV0aG9kcy5cbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgIGZpeGVkQXJnc1tpXSA9IGFyZ1JlbW90ZTJMb2NhbChhcmdzW2ldLCBmaXhlZEFyZ3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHJvb3RGUyA9IGZzLmdldFJvb3RGUygpO1xuICAgICAgICAgICAgKDxGdW5jdGlvbj4gcm9vdEZTW3JlcXVlc3QubWV0aG9kXSkuYXBwbHkocm9vdEZTLCBmaXhlZEFyZ3MpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuIl19