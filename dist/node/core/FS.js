var api_error_1 = require('./api_error');
var file_flag_1 = require('./file_flag');
var path = require('path');
var node_fs_stats_1 = require('./node_fs_stats');
function wrapCb(cb, numArgs) {
    if (typeof cb !== 'function') {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Callback must be a function.');
    }
    if (typeof __numWaiting === 'undefined') {
        __numWaiting = 0;
    }
    __numWaiting++;
    switch (numArgs) {
        case 1:
            return function (arg1) {
                setImmediate(function () {
                    __numWaiting--;
                    return cb(arg1);
                });
            };
        case 2:
            return function (arg1, arg2) {
                setImmediate(function () {
                    __numWaiting--;
                    return cb(arg1, arg2);
                });
            };
        case 3:
            return function (arg1, arg2, arg3) {
                setImmediate(function () {
                    __numWaiting--;
                    return cb(arg1, arg2, arg3);
                });
            };
        default:
            throw new Error('Invalid invocation of wrapCb.');
    }
}
function normalizeMode(mode, def) {
    switch (typeof mode) {
        case 'number':
            return mode;
        case 'string':
            var trueMode = parseInt(mode, 8);
            if (trueMode !== NaN) {
                return trueMode;
            }
        default:
            return def;
    }
}
function normalizeTime(time) {
    if (time instanceof Date) {
        return time;
    }
    else if (typeof time === 'number') {
        return new Date(time * 1000);
    }
    else {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid time.");
    }
}
function normalizePath(p) {
    if (p.indexOf('\u0000') >= 0) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Path must be a string without null bytes.');
    }
    else if (p === '') {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Path must not be empty.');
    }
    return path.resolve(p);
}
function normalizeOptions(options, defEnc, defFlag, defMode) {
    switch (typeof options) {
        case 'object':
            return {
                encoding: typeof options['encoding'] !== 'undefined' ? options['encoding'] : defEnc,
                flag: typeof options['flag'] !== 'undefined' ? options['flag'] : defFlag,
                mode: normalizeMode(options['mode'], defMode)
            };
        case 'string':
            return {
                encoding: options,
                flag: defFlag,
                mode: defMode
            };
        default:
            return {
                encoding: defEnc,
                flag: defFlag,
                mode: defMode
            };
    }
}
function nopCb() { }
;
var FS = (function () {
    function FS() {
        this.root = null;
        this.fdMap = {};
        this.nextFd = 100;
        this.F_OK = 0;
        this.R_OK = 4;
        this.W_OK = 2;
        this.X_OK = 1;
        this._wrapCb = wrapCb;
    }
    FS.prototype.getFdForFile = function (file) {
        var fd = this.nextFd++;
        this.fdMap[fd] = file;
        return fd;
    };
    FS.prototype.fd2file = function (fd) {
        var rv = this.fdMap[fd];
        if (rv) {
            return rv;
        }
        else {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EBADF, 'Invalid file descriptor.');
        }
    };
    FS.prototype.closeFd = function (fd) {
        delete this.fdMap[fd];
    };
    FS.prototype.initialize = function (rootFS) {
        if (!rootFS.constructor.isAvailable()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Tried to instantiate BrowserFS with an unavailable file system.');
        }
        return this.root = rootFS;
    };
    FS.prototype._toUnixTimestamp = function (time) {
        if (typeof time === 'number') {
            return time;
        }
        else if (time instanceof Date) {
            return time.getTime() / 1000;
        }
        throw new Error("Cannot parse time: " + time);
    };
    FS.prototype.getRootFS = function () {
        if (this.root) {
            return this.root;
        }
        else {
            return null;
        }
    };
    FS.prototype.rename = function (oldPath, newPath, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            this.root.rename(normalizePath(oldPath), normalizePath(newPath), newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.renameSync = function (oldPath, newPath) {
        this.root.renameSync(normalizePath(oldPath), normalizePath(newPath));
    };
    FS.prototype.exists = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            return this.root.exists(normalizePath(path), newCb);
        }
        catch (e) {
            return newCb(false);
        }
    };
    FS.prototype.existsSync = function (path) {
        try {
            return this.root.existsSync(normalizePath(path));
        }
        catch (e) {
            return false;
        }
    };
    FS.prototype.stat = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 2);
        try {
            return this.root.stat(normalizePath(path), false, newCb);
        }
        catch (e) {
            return newCb(e, null);
        }
    };
    FS.prototype.statSync = function (path) {
        return this.root.statSync(normalizePath(path), false);
    };
    FS.prototype.lstat = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 2);
        try {
            return this.root.stat(normalizePath(path), true, newCb);
        }
        catch (e) {
            return newCb(e, null);
        }
    };
    FS.prototype.lstatSync = function (path) {
        return this.root.statSync(normalizePath(path), true);
    };
    FS.prototype.truncate = function (path, arg2, cb) {
        if (arg2 === void 0) { arg2 = 0; }
        if (cb === void 0) { cb = nopCb; }
        var len = 0;
        if (typeof arg2 === 'function') {
            cb = arg2;
        }
        else if (typeof arg2 === 'number') {
            len = arg2;
        }
        var newCb = wrapCb(cb, 1);
        try {
            if (len < 0) {
                throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL);
            }
            return this.root.truncate(normalizePath(path), len, newCb);
        }
        catch (e) {
            return newCb(e);
        }
    };
    FS.prototype.truncateSync = function (path, len) {
        if (len === void 0) { len = 0; }
        if (len < 0) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL);
        }
        return this.root.truncateSync(normalizePath(path), len);
    };
    FS.prototype.unlink = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            return this.root.unlink(normalizePath(path), newCb);
        }
        catch (e) {
            return newCb(e);
        }
    };
    FS.prototype.unlinkSync = function (path) {
        return this.root.unlinkSync(normalizePath(path));
    };
    FS.prototype.open = function (path, flag, arg2, cb) {
        var _this = this;
        if (cb === void 0) { cb = nopCb; }
        var mode = normalizeMode(arg2, 0x1a4);
        cb = typeof arg2 === 'function' ? arg2 : cb;
        var newCb = wrapCb(cb, 2);
        try {
            this.root.open(normalizePath(path), file_flag_1.FileFlag.getFileFlag(flag), mode, function (e, file) {
                if (file) {
                    newCb(e, _this.getFdForFile(file));
                }
                else {
                    newCb(e);
                }
            });
        }
        catch (e) {
            newCb(e, null);
        }
    };
    FS.prototype.openSync = function (path, flag, mode) {
        if (mode === void 0) { mode = 0x1a4; }
        return this.getFdForFile(this.root.openSync(normalizePath(path), file_flag_1.FileFlag.getFileFlag(flag), normalizeMode(mode, 0x1a4)));
    };
    FS.prototype.readFile = function (filename, arg2, cb) {
        if (arg2 === void 0) { arg2 = {}; }
        if (cb === void 0) { cb = nopCb; }
        var options = normalizeOptions(arg2, null, 'r', null);
        cb = typeof arg2 === 'function' ? arg2 : cb;
        var newCb = wrapCb(cb, 2);
        try {
            var flag = file_flag_1.FileFlag.getFileFlag(options['flag']);
            if (!flag.isReadable()) {
                return newCb(new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Flag passed to readFile must allow for reading.'));
            }
            return this.root.readFile(normalizePath(filename), options.encoding, flag, newCb);
        }
        catch (e) {
            return newCb(e, null);
        }
    };
    FS.prototype.readFileSync = function (filename, arg2) {
        if (arg2 === void 0) { arg2 = {}; }
        var options = normalizeOptions(arg2, null, 'r', null);
        var flag = file_flag_1.FileFlag.getFileFlag(options.flag);
        if (!flag.isReadable()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Flag passed to readFile must allow for reading.');
        }
        return this.root.readFileSync(normalizePath(filename), options.encoding, flag);
    };
    FS.prototype.writeFile = function (filename, data, arg3, cb) {
        if (arg3 === void 0) { arg3 = {}; }
        if (cb === void 0) { cb = nopCb; }
        var options = normalizeOptions(arg3, 'utf8', 'w', 0x1a4);
        cb = typeof arg3 === 'function' ? arg3 : cb;
        var newCb = wrapCb(cb, 1);
        try {
            var flag = file_flag_1.FileFlag.getFileFlag(options.flag);
            if (!flag.isWriteable()) {
                return newCb(new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Flag passed to writeFile must allow for writing.'));
            }
            return this.root.writeFile(normalizePath(filename), data, options.encoding, flag, options.mode, newCb);
        }
        catch (e) {
            return newCb(e);
        }
    };
    FS.prototype.writeFileSync = function (filename, data, arg3) {
        var options = normalizeOptions(arg3, 'utf8', 'w', 0x1a4);
        var flag = file_flag_1.FileFlag.getFileFlag(options.flag);
        if (!flag.isWriteable()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Flag passed to writeFile must allow for writing.');
        }
        return this.root.writeFileSync(normalizePath(filename), data, options.encoding, flag, options.mode);
    };
    FS.prototype.appendFile = function (filename, data, arg3, cb) {
        if (cb === void 0) { cb = nopCb; }
        var options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
        cb = typeof arg3 === 'function' ? arg3 : cb;
        var newCb = wrapCb(cb, 1);
        try {
            var flag = file_flag_1.FileFlag.getFileFlag(options.flag);
            if (!flag.isAppendable()) {
                return newCb(new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.'));
            }
            this.root.appendFile(normalizePath(filename), data, options.encoding, flag, options.mode, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.appendFileSync = function (filename, data, arg3) {
        var options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
        var flag = file_flag_1.FileFlag.getFileFlag(options.flag);
        if (!flag.isAppendable()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.');
        }
        return this.root.appendFileSync(normalizePath(filename), data, options.encoding, flag, options.mode);
    };
    FS.prototype.fstat = function (fd, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 2);
        try {
            var file = this.fd2file(fd);
            file.stat(newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.fstatSync = function (fd) {
        return this.fd2file(fd).statSync();
    };
    FS.prototype.close = function (fd, cb) {
        var _this = this;
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            this.fd2file(fd).close(function (e) {
                if (!e) {
                    _this.closeFd(fd);
                }
                newCb(e);
            });
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.closeSync = function (fd) {
        this.fd2file(fd).closeSync();
        this.closeFd(fd);
    };
    FS.prototype.ftruncate = function (fd, arg2, cb) {
        if (cb === void 0) { cb = nopCb; }
        var length = typeof arg2 === 'number' ? arg2 : 0;
        cb = typeof arg2 === 'function' ? arg2 : cb;
        var newCb = wrapCb(cb, 1);
        try {
            var file = this.fd2file(fd);
            if (length < 0) {
                throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL);
            }
            file.truncate(length, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.ftruncateSync = function (fd, len) {
        if (len === void 0) { len = 0; }
        var file = this.fd2file(fd);
        if (len < 0) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL);
        }
        file.truncateSync(len);
    };
    FS.prototype.fsync = function (fd, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            this.fd2file(fd).sync(newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.fsyncSync = function (fd) {
        this.fd2file(fd).syncSync();
    };
    FS.prototype.fdatasync = function (fd, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            this.fd2file(fd).datasync(newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.fdatasyncSync = function (fd) {
        this.fd2file(fd).datasyncSync();
    };
    FS.prototype.write = function (fd, arg2, arg3, arg4, arg5, cb) {
        if (cb === void 0) { cb = nopCb; }
        var buffer, offset, length, position = null;
        if (typeof arg2 === 'string') {
            var encoding = 'utf8';
            switch (typeof arg3) {
                case 'function':
                    cb = arg3;
                    break;
                case 'number':
                    position = arg3;
                    encoding = typeof arg4 === 'string' ? arg4 : 'utf8';
                    cb = typeof arg5 === 'function' ? arg5 : cb;
                    break;
                default:
                    cb = typeof arg4 === 'function' ? arg4 : typeof arg5 === 'function' ? arg5 : cb;
                    return cb(new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Invalid arguments.'));
            }
            buffer = new Buffer(arg2, encoding);
            offset = 0;
            length = buffer.length;
        }
        else {
            buffer = arg2;
            offset = arg3;
            length = arg4;
            position = typeof arg5 === 'number' ? arg5 : null;
            cb = typeof arg5 === 'function' ? arg5 : cb;
        }
        var newCb = wrapCb(cb, 3);
        try {
            var file = this.fd2file(fd);
            if (position == null) {
                position = file.getPos();
            }
            file.write(buffer, offset, length, position, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.writeSync = function (fd, arg2, arg3, arg4, arg5) {
        var buffer, offset = 0, length, position;
        if (typeof arg2 === 'string') {
            position = typeof arg3 === 'number' ? arg3 : null;
            var encoding = typeof arg4 === 'string' ? arg4 : 'utf8';
            offset = 0;
            buffer = new Buffer(arg2, encoding);
            length = buffer.length;
        }
        else {
            buffer = arg2;
            offset = arg3;
            length = arg4;
            position = typeof arg5 === 'number' ? arg5 : null;
        }
        var file = this.fd2file(fd);
        if (position == null) {
            position = file.getPos();
        }
        return file.writeSync(buffer, offset, length, position);
    };
    FS.prototype.read = function (fd, arg2, arg3, arg4, arg5, cb) {
        if (cb === void 0) { cb = nopCb; }
        var position, offset, length, buffer, newCb;
        if (typeof arg2 === 'number') {
            length = arg2;
            position = arg3;
            var encoding = arg4;
            cb = typeof arg5 === 'function' ? arg5 : cb;
            offset = 0;
            buffer = new Buffer(length);
            newCb = wrapCb((function (err, bytesRead, buf) {
                if (err) {
                    return cb(err);
                }
                cb(err, buf.toString(encoding), bytesRead);
            }), 3);
        }
        else {
            buffer = arg2;
            offset = arg3;
            length = arg4;
            position = arg5;
            newCb = wrapCb(cb, 3);
        }
        try {
            var file = this.fd2file(fd);
            if (position == null) {
                position = file.getPos();
            }
            file.read(buffer, offset, length, position, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.readSync = function (fd, arg2, arg3, arg4, arg5) {
        var shenanigans = false;
        var buffer, offset, length, position;
        if (typeof arg2 === 'number') {
            length = arg2;
            position = arg3;
            var encoding = arg4;
            offset = 0;
            buffer = new Buffer(length);
            shenanigans = true;
        }
        else {
            buffer = arg2;
            offset = arg3;
            length = arg4;
            position = arg5;
        }
        var file = this.fd2file(fd);
        if (position == null) {
            position = file.getPos();
        }
        var rv = file.readSync(buffer, offset, length, position);
        if (!shenanigans) {
            return rv;
        }
        else {
            return [buffer.toString(encoding), rv];
        }
    };
    FS.prototype.fchown = function (fd, uid, gid, callback) {
        if (callback === void 0) { callback = nopCb; }
        var newCb = wrapCb(callback, 1);
        try {
            this.fd2file(fd).chown(uid, gid, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.fchownSync = function (fd, uid, gid) {
        this.fd2file(fd).chownSync(uid, gid);
    };
    FS.prototype.fchmod = function (fd, mode, cb) {
        var newCb = wrapCb(cb, 1);
        try {
            var numMode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
            this.fd2file(fd).chmod(numMode, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.fchmodSync = function (fd, mode) {
        var numMode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
        this.fd2file(fd).chmodSync(numMode);
    };
    FS.prototype.futimes = function (fd, atime, mtime, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            var file = this.fd2file(fd);
            if (typeof atime === 'number') {
                atime = new Date(atime * 1000);
            }
            if (typeof mtime === 'number') {
                mtime = new Date(mtime * 1000);
            }
            file.utimes(atime, mtime, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.futimesSync = function (fd, atime, mtime) {
        this.fd2file(fd).utimesSync(normalizeTime(atime), normalizeTime(mtime));
    };
    FS.prototype.rmdir = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            path = normalizePath(path);
            this.root.rmdir(path, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.rmdirSync = function (path) {
        path = normalizePath(path);
        return this.root.rmdirSync(path);
    };
    FS.prototype.mkdir = function (path, mode, cb) {
        if (cb === void 0) { cb = nopCb; }
        if (typeof mode === 'function') {
            cb = mode;
            mode = 0x1ff;
        }
        var newCb = wrapCb(cb, 1);
        try {
            path = normalizePath(path);
            this.root.mkdir(path, mode, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.mkdirSync = function (path, mode) {
        this.root.mkdirSync(normalizePath(path), normalizeMode(mode, 0x1ff));
    };
    FS.prototype.readdir = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 2);
        try {
            path = normalizePath(path);
            this.root.readdir(path, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.readdirSync = function (path) {
        path = normalizePath(path);
        return this.root.readdirSync(path);
    };
    FS.prototype.link = function (srcpath, dstpath, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            srcpath = normalizePath(srcpath);
            dstpath = normalizePath(dstpath);
            this.root.link(srcpath, dstpath, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.linkSync = function (srcpath, dstpath) {
        srcpath = normalizePath(srcpath);
        dstpath = normalizePath(dstpath);
        return this.root.linkSync(srcpath, dstpath);
    };
    FS.prototype.symlink = function (srcpath, dstpath, arg3, cb) {
        if (cb === void 0) { cb = nopCb; }
        var type = typeof arg3 === 'string' ? arg3 : 'file';
        cb = typeof arg3 === 'function' ? arg3 : cb;
        var newCb = wrapCb(cb, 1);
        try {
            if (type !== 'file' && type !== 'dir') {
                return newCb(new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid type: " + type));
            }
            srcpath = normalizePath(srcpath);
            dstpath = normalizePath(dstpath);
            this.root.symlink(srcpath, dstpath, type, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.symlinkSync = function (srcpath, dstpath, type) {
        if (type == null) {
            type = 'file';
        }
        else if (type !== 'file' && type !== 'dir') {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid type: " + type);
        }
        srcpath = normalizePath(srcpath);
        dstpath = normalizePath(dstpath);
        return this.root.symlinkSync(srcpath, dstpath, type);
    };
    FS.prototype.readlink = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 2);
        try {
            path = normalizePath(path);
            this.root.readlink(path, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.readlinkSync = function (path) {
        path = normalizePath(path);
        return this.root.readlinkSync(path);
    };
    FS.prototype.chown = function (path, uid, gid, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            path = normalizePath(path);
            this.root.chown(path, false, uid, gid, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.chownSync = function (path, uid, gid) {
        path = normalizePath(path);
        this.root.chownSync(path, false, uid, gid);
    };
    FS.prototype.lchown = function (path, uid, gid, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            path = normalizePath(path);
            this.root.chown(path, true, uid, gid, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.lchownSync = function (path, uid, gid) {
        path = normalizePath(path);
        this.root.chownSync(path, true, uid, gid);
    };
    FS.prototype.chmod = function (path, mode, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            var numMode = normalizeMode(mode, -1);
            if (numMode < 0) {
                throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid mode.");
            }
            this.root.chmod(normalizePath(path), false, numMode, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.chmodSync = function (path, mode) {
        var numMode = normalizeMode(mode, -1);
        if (numMode < 0) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid mode.");
        }
        path = normalizePath(path);
        this.root.chmodSync(path, false, numMode);
    };
    FS.prototype.lchmod = function (path, mode, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            var numMode = normalizeMode(mode, -1);
            if (numMode < 0) {
                throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid mode.");
            }
            this.root.chmod(normalizePath(path), true, numMode, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.lchmodSync = function (path, mode) {
        var numMode = normalizeMode(mode, -1);
        if (numMode < 1) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid mode.");
        }
        this.root.chmodSync(normalizePath(path), true, numMode);
    };
    FS.prototype.utimes = function (path, atime, mtime, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            this.root.utimes(normalizePath(path), normalizeTime(atime), normalizeTime(mtime), newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.utimesSync = function (path, atime, mtime) {
        this.root.utimesSync(normalizePath(path), normalizeTime(atime), normalizeTime(mtime));
    };
    FS.prototype.realpath = function (path, arg2, cb) {
        if (cb === void 0) { cb = nopCb; }
        var cache = typeof arg2 === 'object' ? arg2 : {};
        cb = typeof arg2 === 'function' ? arg2 : nopCb;
        var newCb = wrapCb(cb, 2);
        try {
            path = normalizePath(path);
            this.root.realpath(path, cache, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    FS.prototype.realpathSync = function (path, cache) {
        if (cache === void 0) { cache = {}; }
        path = normalizePath(path);
        return this.root.realpathSync(path, cache);
    };
    FS.prototype.watchFile = function (filename, arg2, listener) {
        if (listener === void 0) { listener = nopCb; }
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    FS.prototype.unwatchFile = function (filename, listener) {
        if (listener === void 0) { listener = nopCb; }
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    FS.prototype.watch = function (filename, arg2, listener) {
        if (listener === void 0) { listener = nopCb; }
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    FS.prototype.access = function (path, arg2, cb) {
        if (cb === void 0) { cb = nopCb; }
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    FS.prototype.accessSync = function (path, mode) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    FS.prototype.createReadStream = function (path, options) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    FS.prototype.createWriteStream = function (path, options) {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    FS.Stats = node_fs_stats_1["default"];
    return FS;
})();
exports.__esModule = true;
exports["default"] = FS;
var _ = new FS();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRlMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29yZS9GUy50cyJdLCJuYW1lcyI6WyJ3cmFwQ2IiLCJub3JtYWxpemVNb2RlIiwibm9ybWFsaXplVGltZSIsIm5vcm1hbGl6ZVBhdGgiLCJub3JtYWxpemVPcHRpb25zIiwibm9wQ2IiLCJGUyIsIkZTLmNvbnN0cnVjdG9yIiwiRlMuZ2V0RmRGb3JGaWxlIiwiRlMuZmQyZmlsZSIsIkZTLmNsb3NlRmQiLCJGUy5pbml0aWFsaXplIiwiRlMuX3RvVW5peFRpbWVzdGFtcCIsIkZTLmdldFJvb3RGUyIsIkZTLnJlbmFtZSIsIkZTLnJlbmFtZVN5bmMiLCJGUy5leGlzdHMiLCJGUy5leGlzdHNTeW5jIiwiRlMuc3RhdCIsIkZTLnN0YXRTeW5jIiwiRlMubHN0YXQiLCJGUy5sc3RhdFN5bmMiLCJGUy50cnVuY2F0ZSIsIkZTLnRydW5jYXRlU3luYyIsIkZTLnVubGluayIsIkZTLnVubGlua1N5bmMiLCJGUy5vcGVuIiwiRlMub3BlblN5bmMiLCJGUy5yZWFkRmlsZSIsIkZTLnJlYWRGaWxlU3luYyIsIkZTLndyaXRlRmlsZSIsIkZTLndyaXRlRmlsZVN5bmMiLCJGUy5hcHBlbmRGaWxlIiwiRlMuYXBwZW5kRmlsZVN5bmMiLCJGUy5mc3RhdCIsIkZTLmZzdGF0U3luYyIsIkZTLmNsb3NlIiwiRlMuY2xvc2VTeW5jIiwiRlMuZnRydW5jYXRlIiwiRlMuZnRydW5jYXRlU3luYyIsIkZTLmZzeW5jIiwiRlMuZnN5bmNTeW5jIiwiRlMuZmRhdGFzeW5jIiwiRlMuZmRhdGFzeW5jU3luYyIsIkZTLndyaXRlIiwiRlMud3JpdGVTeW5jIiwiRlMucmVhZCIsIkZTLnJlYWRTeW5jIiwiRlMuZmNob3duIiwiRlMuZmNob3duU3luYyIsIkZTLmZjaG1vZCIsIkZTLmZjaG1vZFN5bmMiLCJGUy5mdXRpbWVzIiwiRlMuZnV0aW1lc1N5bmMiLCJGUy5ybWRpciIsIkZTLnJtZGlyU3luYyIsIkZTLm1rZGlyIiwiRlMubWtkaXJTeW5jIiwiRlMucmVhZGRpciIsIkZTLnJlYWRkaXJTeW5jIiwiRlMubGluayIsIkZTLmxpbmtTeW5jIiwiRlMuc3ltbGluayIsIkZTLnN5bWxpbmtTeW5jIiwiRlMucmVhZGxpbmsiLCJGUy5yZWFkbGlua1N5bmMiLCJGUy5jaG93biIsIkZTLmNob3duU3luYyIsIkZTLmxjaG93biIsIkZTLmxjaG93blN5bmMiLCJGUy5jaG1vZCIsIkZTLmNobW9kU3luYyIsIkZTLmxjaG1vZCIsIkZTLmxjaG1vZFN5bmMiLCJGUy51dGltZXMiLCJGUy51dGltZXNTeW5jIiwiRlMucmVhbHBhdGgiLCJGUy5yZWFscGF0aFN5bmMiLCJGUy53YXRjaEZpbGUiLCJGUy51bndhdGNoRmlsZSIsIkZTLndhdGNoIiwiRlMuYWNjZXNzIiwiRlMuYWNjZXNzU3luYyIsIkZTLmNyZWF0ZVJlYWRTdHJlYW0iLCJGUy5jcmVhdGVXcml0ZVN0cmVhbSJdLCJtYXBwaW5ncyI6IkFBQ0EsMEJBQWtDLGFBQWEsQ0FBQyxDQUFBO0FBRWhELDBCQUF1QixhQUFhLENBQUMsQ0FBQTtBQUNyQyxJQUFPLElBQUksV0FBVyxNQUFNLENBQUMsQ0FBQztBQUM5Qiw4QkFBa0IsaUJBQWlCLENBQUMsQ0FBQTtBQWFwQyxnQkFBb0MsRUFBSyxFQUFFLE9BQWU7SUFDeERBLEVBQUVBLENBQUNBLENBQUNBLE9BQU9BLEVBQUVBLEtBQUtBLFVBQVVBLENBQUNBLENBQUNBLENBQUNBO1FBQzdCQSxNQUFNQSxJQUFJQSxvQkFBUUEsQ0FBQ0EscUJBQVNBLENBQUNBLE1BQU1BLEVBQUVBLDhCQUE4QkEsQ0FBQ0EsQ0FBQ0E7SUFDdkVBLENBQUNBO0lBR0RBLEVBQUVBLENBQUNBLENBQUNBLE9BQU9BLFlBQVlBLEtBQUtBLFdBQVdBLENBQUNBLENBQUNBLENBQUNBO1FBQ3hDQSxZQUFZQSxHQUFHQSxDQUFDQSxDQUFDQTtJQUNuQkEsQ0FBQ0E7SUFDREEsWUFBWUEsRUFBRUEsQ0FBQ0E7SUFHZkEsTUFBTUEsQ0FBQ0EsQ0FBQ0EsT0FB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QUFHQSxJQUFJQSxDQUFDQTtRQUNwREEsQ0FBQ0E7UUFFREEsSUFBSUEsSUFBSUEsR0FBR0EsSUFBSUEsQ0FBQ0EsT0FBT0EsQ0FBQ0EsRUFBRUEsQ0FBQ0EsQ0FBQ0E7UUFDNUJBLEVBQUVBLENBQUNBLENBQUNBLFFBQVFBLElBQUlBLElBQUlBLENBQUNBLENBQUNBLENBQUNBO1lBQ3JCQSxRQUFRQSxHQUFHQSxJQUFJQSxDQUFDQSxNQUFNQSxFQUFFQSxDQUFDQTtRQUMzQkEsQ0FBQ0E7UUFDREEsTUFBTUEsQ0FBQ0EsSUFBSUEsQ0FBQ0EsU0FBU0EsQ0FBQ0EsTUFBTUEsRUFBRUEsTUFBTUEsRUFBRUEsTUFBTUEsRUFBRUEsUUFBUUEsQ0FBQ0EsQ0FBQ0E7SUFDMURBLENBQUNBO0lBa0JNdkMsaUJBQUlBLEdBQVhBLFVBQVlBLEVBQVVBLEVBQUVBLElBQVNBLEVBQUVBLElBQVNBLEVBQUVBLElBQVNBLEVBQUVBLElBQVVBLEVBQUVBLEVBQTJEQTtRQUEzRHdDLGtCQUEyREEsR0FBM0RBLFVBQTJEQTtRQUM5SEEsSUFBSUEsUUFBZ0JBLEVBQUVBLE1BQWNBLEVBQUVBLE1BQWNBLEVBQUVBLE1BQWNBLEVBQUVBLEtBQW1FQSxDQUFDQTtRQUMxSUEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsT0FBT0EsSUFBSUEsS0FBS0EsUUFBUUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFHN0JBLE1BQU1BLEdBQUdBLElBQUlBLENBQUNBO1lBQ2RBLFFBQVFBLEdBQUdBLElBQUlBLENBQUNBO1lBQ2hCQSxJQUFJQSxRQUFRQSxHQUFHQSxJQUFJQSxDQUFDQTtZQUNwQkEsRUFBRUEsR0FBR0EsT0FBT0EsSUFBSUEsS0FBS0EsVUFBVUEsR0FBR0EsSUFBSUEsR0FBR0EsRUFBRUEsQ0FBQ0E7WUFDNUNBLE1BQU1BLEdBQUdBLENBQUNBLENBQUNBO1lBQ1hBLE1BQU1BLEdBQUdBLElBQUlBLE1BQU1BLENBQUNBLE1BQU1BLENBQUNBLENBQUNBO1lBSTVCQSxLQUFLQSxHQUFHQSxNQUFNQSxDQUFDQSxDQUFDQSxVQUFTQSxHQUFRQSxFQUFFQSxTQUFpQkEsRUFBRUEsR0FBV0E7Z0JBQy9ELEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7b0JBQ1IsTUFBTSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDakIsQ0FBQztnQkFDRCxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDN0MsQ0FBQyxDQUFDQSxFQUFFQSxDQUFDQSxDQUFDQSxDQUFDQTtRQUNUQSxDQUFDQTtRQUFDQSxJQUFJQSxDQUFDQSxDQUFDQTtZQUNOQSxNQUFNQSxHQUFHQSxJQUFJQSxDQUFDQTtZQUNkQSxNQUFNQSxHQUFHQSxJQUFJQSxDQUFDQTtZQUNkQSxNQUFNQSxHQUFHQSxJQUFJQSxDQUFDQTtZQUNkQSxRQUFRQSxHQUFHQSxJQUFJQSxDQUFDQTtZQUNoQkEsS0FBS0EsR0FBR0EsTUFBTUEsQ0FBQ0EsRUFBRUEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDeEJBLENBQUNBO1FBRURBLElBQUlBLENBQUNBO1lBQ0hBLElBQUlBLElBQUlBLEdBQUdBLElBQUlBLENBQUNBLE9BQU9BLENBQUNBLEVBQUVBLENBQUNBLENBQUNBO1lBQzVCQSxFQUFFQSxDQUFDQSxDQUFDQSxRQUFRQSxJQUFJQSxJQUFJQSxDQUFDQSxDQUFDQSxDQUFDQTtnQkFDckJBLFFBQVFBLEdBQUdBLElBQUlBLENBQUNBLE1BQU1BLEVBQUVBLENBQUNBO1lBQzNCQSxDQUFDQTtZQUNEQSxJQUFJQSxDQUFDQSxJQUFJQSxDQUFDQSxNQUFNQSxFQUFFQSxNQUFNQSxFQUFFQSxNQUFNQSxFQUFFQSxRQUFRQSxFQUFFQSxLQUFLQSxDQUFDQSxDQUFDQTtRQUNyREEsQ0FBRUE7UUFBQUEsS0FBS0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFDWEEsS0FBS0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDWEEsQ0FBQ0E7SUFDSEEsQ0FBQ0E7SUFpQk14QyxxQkFBUUEsR0FBZkEsVUFBZ0JBLEVBQVVBLEVBQUVBLElBQVNBLEVBQUVBLElBQVNBLEVBQUVBLElBQVNBLEVBQUVBLElBQVVBO1FBQ3JFeUMsSUFBSUEsV0FBV0EsR0FBR0EsS0FBS0EsQ0FBQ0E7UUFDeEJBLElBQUlBLE1BQWNBLEVBQUVBLE1BQWNBLEVBQUVBLE1BQWNBLEVBQUVBLFFBQWdCQSxDQUFDQTtRQUNyRUEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsT0FBT0EsSUFBSUEsS0FBS0EsUUFBUUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFDN0JBLE1BQU1BLEdBQUdBLElBQUlBLENBQUNBO1lBQ2RBLFFBQVFBLEdBQUdBLElBQUlBLENBQUNBO1lBQ2hCQSxJQUFJQSxRQUFRQSxHQUFHQSxJQUFJQSxDQUFDQTtZQUNwQkEsTUFBTUEsR0FBR0EsQ0FBQ0EsQ0FBQ0E7WUFDWEEsTUFBTUEsR0FBR0EsSUFBSUEsTUFBTUEsQ0FBQ0EsTUFBTUEsQ0FBQ0EsQ0FBQ0E7WUFDNUJBLFdBQVdBLEdBQUdBLElBQUlBLENBQUNBO1FBQ3JCQSxDQUFDQTtRQUFDQSxJQUFJQSxDQUFDQSxDQUFDQTtZQUNOQSxNQUFNQSxHQUFHQSxJQUFJQSxDQUFDQTtZQUNkQSxNQUFNQSxHQUFHQSxJQUFJQSxDQUFDQTtZQUNkQSxNQUFNQSxHQUFHQSxJQUFJQSxDQUFDQTtZQUNkQSxRQUFRQSxHQUFHQSxJQUFJQSxDQUFDQTtRQUNsQkEsQ0FBQ0E7UUFDREEsSUFBSUEsSUFBSUEsR0FBR0EsSUFBSUEsQ0FBQ0EsT0FBT0EsQ0FBQ0EsRUFBRUEsQ0FBQ0EsQ0FBQ0E7UUFDNUJBLEVBQUVBLENBQUNBLENBQUNBLFFBQVFBLElBQUlBLElBQUlBLENBQUNBLENBQUNBLENBQUNBO1lBQ3JCQSxRQUFRQSxHQUFHQSxJQUFJQSxDQUFDQSxNQUFNQSxFQUFFQSxDQUFDQTtRQUMzQkEsQ0FBQ0E7UUFFREEsSUFBSUEsRUFBRUEsR0FBR0EsSUFBSUEsQ0FBQ0EsUUFBUUEsQ0FBQ0EsTUFBTUEsRUFBRUEsTUFBTUEsRUFBRUEsTUFBTUEsRUFBRUEsUUFB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SUEsS0FBS0EsR0FBR0EsTUFBTUEsQ0FBQ0EsRUFBRUEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDMUJBLElBQUlBLENBQUNBO1lBQ0hBLElBQUlBLEdBQUdBLGFBQWFBLENBQUNBLElBQUlBLENBQUNBLENBQUNBO1lBQzNCQSxJQUFJQSxDQUFDQSxJQUFJQSxDQUFDQSxLQUFLQSxDQUFDQSxJQUFJQSxFQUFFQSxLQUFLQSxFQUFFQSxHQUFHQSxFQUFFQSxHQUFHQSxFQUFFQSxLQUFLQSxDQUFDQSxDQUFDQTtRQUNoREEsQ0FBRUE7UUFBQUEsS0FBS0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFDWEEsS0FBS0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDWEEsQ0FBQ0E7SUFDSEEsQ0FBQ0E7SUFRTTVELHNCQUFTQSxHQUFoQkEsVUFBaUJBLElBQVlBLEVBQUVBLEdBQVdBLEVBQUVBLEdBQVdBO1FBQ3JENkQsSUFBSUEsR0FBR0EsYUFBYUEsQ0FBQ0EsSUFBSUEsQ0FBQ0EsQ0FBQ0E7UUFDM0JBLElBQUlBLENBQUNBLElBQUlBLENBQUNBLFNBQVNBLENBQUNBLElBQUlBLEVBQUVBLEtBQUtBLEVBQUVBLEdBQUdBLEVBQUVBLEdBQUdBLENBQUNBLENBQUNBO0lBQzdDQSxDQUFDQTtJQVNNN0QsbUJBQU1BLEdBQWJBLFVBQWNBLElBQVlBLEVBQUVBLEdBQVdBLEVBQUVBLEdBQVdBLEVBQUVBLEVBQWtDQTtRQUFsQzhELGtCQUFrQ0EsR0FBbENBLFVBQWtDQTtRQUN0RkEsSUFBSUEsS0FBS0EsR0FBR0EsTUFBTUEsQ0FBQ0EsRUFBRUEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDMUJBLElBQUlBLENBQUNBO1lBQ0hBLElBQUlBLEdBQUdBLGFBQWFBLENBQUNBLElBQUlBLENBQUNBLENBQUNBO1lBQzNCQSxJQUFJQSxDQUFDQSxJQUFJQSxDQUFDQSxLQUFLQSxDQUFDQSxJQUFJQSxFQUFFQSxJQUFJQSxFQUFFQSxHQUFHQSxFQUFFQSxHQUFHQSxFQUFFQSxLQUFL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QkFBU0EsQ0FBQ0EsT0FBT0EsQ0FBQ0EsQ0FBQ0E7SUFDeENBLENBQUNBO0lBRU0zRSx1QkFBVUEsR0FBakJBLFVBQWtCQSxJQUFZQSxFQUFFQSxJQUFhQTtRQUMzQzRFLE1BQU1BLElBQUlBLG9CQUFRQSxDQUFDQSxxQkFBU0EsQ0FBQ0EsT0FBT0EsQ0FBQ0EsQ0FBQ0E7SUFDeENBLENBQUNBO0lBRU01RSw2QkFBZ0JBLEdBQXZCQSxVQUF3QkEsSUFBWUEsRUFBRUEsT0FNbkNBO1FBQ0Q2RSxNQUFNQSxJQUFJQSxvQkFBUUEsQ0FBQ0EscUJBQVNBLENBQUNBLE9BQU9BLENBQUNBLENBQUNBO0lBQ3hDQSxDQUFDQTtJQUVNN0UsOEJBQWlCQSxHQUF4QkEsVUFBeUJBLElBQVlBLEVBQUVBLE9BS3BDQTtRQUNEOEUsTUFBTUEsSUFBSUEsb0JBQVFBLENBQUNBLHFCQUFTQSxDQUFDQSxPQUFPQSxDQUFDQSxDQUFDQTtJQUN4Q0EsQ0FBQ0E7SUFqeUNhOUUsUUFBS0EsR0FBR0EsMEJBQUtBLENBQUNBO0lBb3lDOUJBLFNBQUNBO0FBQURBLENBQUNBLEFBdHlDRCxJQXN5Q0M7QUF0eUNEO3VCQXN5Q0MsQ0FBQTtBQUdELElBQUksQ0FBQyxHQUFlLElBQUksRUFBRSxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0ZpbGV9IGZyb20gJy4vZmlsZSc7XG5pbXBvcnQge0FwaUVycm9yLCBFcnJvckNvZGV9IGZyb20gJy4vYXBpX2Vycm9yJztcbmltcG9ydCBmaWxlX3N5c3RlbSA9IHJlcXVpcmUoJy4vZmlsZV9zeXN0ZW0nKTtcbmltcG9ydCB7RmlsZUZsYWd9IGZyb20gJy4vZmlsZV9mbGFnJztcbmltcG9ydCBwYXRoID0gcmVxdWlyZSgncGF0aCcpO1xuaW1wb3J0IFN0YXRzIGZyb20gJy4vbm9kZV9mc19zdGF0cyc7XG4vLyBUeXBpbmcgaW5mbyBvbmx5LlxuaW1wb3J0IF9mcyA9IHJlcXVpcmUoJ2ZzJyk7XG5cbmRlY2xhcmUgdmFyIF9fbnVtV2FpdGluZzogbnVtYmVyO1xuZGVjbGFyZSB2YXIgc2V0SW1tZWRpYXRlOiAoY2I6IEZ1bmN0aW9uKSA9PiB2b2lkO1xuXG4vKipcbiAqIFdyYXBzIGEgY2FsbGJhY2sgd2l0aCBhIHNldEltbWVkaWF0ZSBjYWxsLlxuICogQHBhcmFtIFtGdW5jdGlvbl0gY2IgVGhlIGNhbGxiYWNrIHRvIHdyYXAuXG4gKiBAcGFyYW0gW051bWJlcl0gbnVtQXJncyBUaGUgbnVtYmVyIG9mIGFyZ3VtZW50cyB0aGF0IHRoZSBjYWxsYmFjayB0YWtlcy5cbiAqIEByZXR1cm4gW0Z1bmN0aW9uXSBUaGUgd3JhcHBlZCBjYWxsYmFjay5cbiAqL1xuZnVuY3Rpb24gd3JhcENiPFQgZXh0ZW5kcyBGdW5jdGlvbj4oY2I6IFQsIG51bUFyZ3M6IG51bWJlcik6IFQge1xuICBpZiAodHlwZW9mIGNiICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsICdDYWxsYmFjayBtdXN0IGJlIGEgZnVuY3Rpb24uJyk7XG4gIH1cbiAgLy8gQHRvZG8gVGhpcyBpcyB1c2VkIGZvciB1bml0IHRlc3RpbmcuIE1heWJlIHdlIHNob3VsZCBpbmplY3QgdGhpcyBsb2dpY1xuICAvLyAgICAgICBkeW5hbWljYWxseSByYXRoZXIgdGhhbiBidW5kbGUgaXQgaW4gJ3Byb2R1Y3Rpb24nIGNvZGUuXG4gIGlmICh0eXBlb2YgX19udW1XYWl0aW5nID09PSAndW5kZWZpbmVkJykge1xuICAgIF9fbnVtV2FpdGluZyA9IDA7XG4gIH1cbiAgX19udW1XYWl0aW5nKys7XG4gIC8vIFdlIGNvdWxkIHVzZSBgYXJndW1lbnRzYCwgYnV0IEZ1bmN0aW9uLmNhbGwvYXBwbHkgaXMgZXhwZW5zaXZlLiBBbmQgd2Ugb25seVxuICAvLyBuZWVkIHRvIGhhbmRsZSAxLTMgYXJndW1lbnRzXG4gIHN3aXRjaCAobnVtQXJncykge1xuICAgIGNhc2UgMTpcbiAgICAgIHJldHVybiA8YW55PiBmdW5jdGlvbihhcmcxOiBhbnkpIHtcbiAgICAgICAgc2V0SW1tZWRpYXRlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIF9fbnVtV2FpdGluZy0tO1xuICAgICAgICAgIHJldHVybiBjYihhcmcxKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgIGNhc2UgMjpcbiAgICAgIHJldHVybiA8YW55PiBmdW5jdGlvbihhcmcxOiBhbnksIGFyZzI6IGFueSkge1xuICAgICAgICBzZXRJbW1lZGlhdGUoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgX19udW1XYWl0aW5nLS07XG4gICAgICAgICAgcmV0dXJuIGNiKGFyZzEsIGFyZzIpO1xuICAgICAgICB9KTtcbiAgICAgIH07XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIDxhbnk+IGZ1bmN0aW9uKGFyZzE6IGFueSwgYXJnMjogYW55LCBhcmczOiBhbnkpIHtcbiAgICAgICAgc2V0SW1tZWRpYXRlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIF9fbnVtV2FpdGluZy0tO1xuICAgICAgICAgIHJldHVybiBjYihhcmcxLCBhcmcyLCBhcmczKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaW52b2NhdGlvbiBvZiB3cmFwQ2IuJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplTW9kZShtb2RlOiBudW1iZXJ8c3RyaW5nLCBkZWY6IG51bWJlcik6IG51bWJlciB7XG4gIHN3aXRjaCh0eXBlb2YgbW9kZSkge1xuICAgIGNhc2UgJ251bWJlcic6XG4gICAgICAvLyAocGF0aCwgZmxhZywgbW9kZSwgY2I/KVxuICAgICAgcmV0dXJuIDxudW1iZXI+IG1vZGU7XG4gICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgIC8vIChwYXRoLCBmbGFnLCBtb2RlU3RyaW5nLCBjYj8pXG4gICAgICB2YXIgdHJ1ZU1vZGUgPSBwYXJzZUludCg8c3RyaW5nPiBtb2RlLCA4KTtcbiAgICAgIGlmICh0cnVlTW9kZSAhPT0gTmFOKSB7XG4gICAgICAgIHJldHVybiB0cnVlTW9kZTtcbiAgICAgIH1cbiAgICAgIC8vIEZBTEwgVEhST1VHSCBpZiBtb2RlIGlzIGFuIGludmFsaWQgc3RyaW5nIVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZGVmO1xuICB9XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVRpbWUodGltZTogbnVtYmVyIHwgRGF0ZSk6IERhdGUge1xuICBpZiAodGltZSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICByZXR1cm4gdGltZTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgdGltZSA9PT0gJ251bWJlcicpIHtcbiAgICByZXR1cm4gbmV3IERhdGUodGltZSAqIDEwMDApO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCBgSW52YWxpZCB0aW1lLmApO1xuICB9XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVBhdGgocDogc3RyaW5nKTogc3RyaW5nIHtcbiAgLy8gTm9kZSBkb2Vzbid0IGFsbG93IG51bGwgY2hhcmFjdGVycyBpbiBwYXRocy5cbiAgaWYgKHAuaW5kZXhPZignXFx1MDAwMCcpID49IDApIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgJ1BhdGggbXVzdCBiZSBhIHN0cmluZyB3aXRob3V0IG51bGwgYnl0ZXMuJyk7XG4gIH0gZWxzZSBpZiAocCA9PT0gJycpIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgJ1BhdGggbXVzdCBub3QgYmUgZW1wdHkuJyk7XG4gIH1cbiAgcmV0dXJuIHBhdGgucmVzb2x2ZShwKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplT3B0aW9ucyhvcHRpb25zOiBhbnksIGRlZkVuYzogc3RyaW5nLCBkZWZGbGFnOiBzdHJpbmcsIGRlZk1vZGU6IG51bWJlcik6IHtlbmNvZGluZzogc3RyaW5nOyBmbGFnOiBzdHJpbmc7IG1vZGU6IG51bWJlcn0ge1xuICBzd2l0Y2ggKHR5cGVvZiBvcHRpb25zKSB7XG4gICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGVuY29kaW5nOiB0eXBlb2Ygb3B0aW9uc1snZW5jb2RpbmcnXSAhPT0gJ3VuZGVmaW5lZCcgPyBvcHRpb25zWydlbmNvZGluZyddIDogZGVmRW5jLFxuICAgICAgICBmbGFnOiB0eXBlb2Ygb3B0aW9uc1snZmxhZyddICE9PSAndW5kZWZpbmVkJyA/IG9wdGlvbnNbJ2ZsYWcnXSA6IGRlZkZsYWcsXG4gICAgICAgIG1vZGU6IG5vcm1hbGl6ZU1vZGUob3B0aW9uc1snbW9kZSddLCBkZWZNb2RlKVxuICAgICAgfTtcbiAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZW5jb2Rpbmc6IG9wdGlvbnMsXG4gICAgICAgIGZsYWc6IGRlZkZsYWcsXG4gICAgICAgIG1vZGU6IGRlZk1vZGVcbiAgICAgIH07XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGVuY29kaW5nOiBkZWZFbmMsXG4gICAgICAgIGZsYWc6IGRlZkZsYWcsXG4gICAgICAgIG1vZGU6IGRlZk1vZGVcbiAgICAgIH07XG4gIH1cbn1cblxuLy8gVGhlIGRlZmF1bHQgY2FsbGJhY2sgaXMgYSBOT1AuXG5mdW5jdGlvbiBub3BDYigpIHt9O1xuXG4vKipcbiAqIFRoZSBub2RlIGZyb250ZW5kIHRvIGFsbCBmaWxlc3lzdGVtcy5cbiAqIFRoaXMgbGF5ZXIgaGFuZGxlczpcbiAqXG4gKiAqIFNhbml0eSBjaGVja2luZyBpbnB1dHMuXG4gKiAqIE5vcm1hbGl6aW5nIHBhdGhzLlxuICogKiBSZXNldHRpbmcgc3RhY2sgZGVwdGggZm9yIGFzeW5jaHJvbm91cyBvcGVyYXRpb25zIHdoaWNoIG1heSBub3QgZ28gdGhyb3VnaFxuICogICB0aGUgYnJvd3NlciBieSB3cmFwcGluZyBhbGwgaW5wdXQgY2FsbGJhY2tzIHVzaW5nIGBzZXRJbW1lZGlhdGVgLlxuICogKiBQZXJmb3JtaW5nIHRoZSByZXF1ZXN0ZWQgb3BlcmF0aW9uIHRocm91Z2ggdGhlIGZpbGVzeXN0ZW0gb3IgdGhlIGZpbGVcbiAqICAgZGVzY3JpcHRvciwgYXMgYXBwcm9wcmlhdGUuXG4gKiAqIEhhbmRsaW5nIG9wdGlvbmFsIGFyZ3VtZW50cyBhbmQgc2V0dGluZyBkZWZhdWx0IGFyZ3VtZW50cy5cbiAqIEBzZWUgaHR0cDovL25vZGVqcy5vcmcvYXBpL2ZzLmh0bWxcbiAqIEBjbGFzc1xuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBGUyB7XG4gIC8vIEV4cG9ydGVkIGZzLlN0YXRzLlxuICBwdWJsaWMgc3RhdGljIFN0YXRzID0gU3RhdHM7XG5cbiAgcHJpdmF0ZSByb290OiBmaWxlX3N5c3RlbS5GaWxlU3lzdGVtID0gbnVsbDtcbiAgcHJpdmF0ZSBmZE1hcDoge1tmZDogbnVtYmVyXTogRmlsZX0gPSB7fTtcbiAgcHJpdmF0ZSBuZXh0RmQgPSAxMDA7XG4gIHByaXZhdGUgZ2V0RmRGb3JGaWxlKGZpbGU6IEZpbGUpOiBudW1iZXIge1xuICAgIGxldCBmZCA9IHRoaXMubmV4dEZkKys7XG4gICAgdGhpcy5mZE1hcFtmZF0gPSBmaWxlO1xuICAgIHJldHVybiBmZDtcbiAgfVxuICBwcml2YXRlIGZkMmZpbGUoZmQ6IG51bWJlcik6IEZpbGUge1xuICAgIGxldCBydiA9IHRoaXMuZmRNYXBbZmRdO1xuICAgIGlmIChydikge1xuICAgICAgcmV0dXJuIHJ2O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVCQURGLCAnSW52YWxpZCBmaWxlIGRlc2NyaXB0b3IuJyk7XG4gICAgfVxuICB9XG4gIHByaXZhdGUgY2xvc2VGZChmZDogbnVtYmVyKTogdm9pZCB7XG4gICAgZGVsZXRlIHRoaXMuZmRNYXBbZmRdO1xuICB9XG5cbiAgcHVibGljIGluaXRpYWxpemUocm9vdEZTOiBmaWxlX3N5c3RlbS5GaWxlU3lzdGVtKTogZmlsZV9zeXN0ZW0uRmlsZVN5c3RlbSB7XG4gICAgaWYgKCEoPGFueT4gcm9vdEZTKS5jb25zdHJ1Y3Rvci5pc0F2YWlsYWJsZSgpKSB7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgJ1RyaWVkIHRvIGluc3RhbnRpYXRlIEJyb3dzZXJGUyB3aXRoIGFuIHVuYXZhaWxhYmxlIGZpbGUgc3lzdGVtLicpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5yb290ID0gcm9vdEZTO1xuICB9XG5cbiAgLyoqXG4gICAqIGNvbnZlcnRzIERhdGUgb3IgbnVtYmVyIHRvIGEgZnJhY3Rpb25hbCBVTklYIHRpbWVzdGFtcFxuICAgKiBHcmFiYmVkIGZyb20gTm9kZUpTIHNvdXJjZXMgKGxpYi9mcy5qcylcbiAgICovXG4gIHB1YmxpYyBfdG9Vbml4VGltZXN0YW1wKHRpbWU6IERhdGUgfCBudW1iZXIpOiBudW1iZXIge1xuICAgIGlmICh0eXBlb2YgdGltZSA9PT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiB0aW1lO1xuICAgIH0gZWxzZSBpZiAodGltZSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgIHJldHVybiB0aW1lLmdldFRpbWUoKSAvIDEwMDA7XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBwYXJzZSB0aW1lOiBcIiArIHRpbWUpO1xuICB9XG5cbiAgLyoqXG4gICAqICoqTk9OU1RBTkRBUkQqKjogR3JhYiB0aGUgRmlsZVN5c3RlbSBpbnN0YW5jZSB0aGF0IGJhY2tzIHRoaXMgQVBJLlxuICAgKiBAcmV0dXJuIFtCcm93c2VyRlMuRmlsZVN5c3RlbSB8IG51bGxdIFJldHVybnMgbnVsbCBpZiB0aGUgZmlsZSBzeXN0ZW0gaGFzXG4gICAqICAgbm90IGJlZW4gaW5pdGlhbGl6ZWQuXG4gICAqL1xuICBwdWJsaWMgZ2V0Um9vdEZTKCk6IGZpbGVfc3lzdGVtLkZpbGVTeXN0ZW0ge1xuICAgIGlmICh0aGlzLnJvb3QpIHtcbiAgICAgIHJldHVybiB0aGlzLnJvb3Q7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8vIEZJTEUgT1IgRElSRUNUT1JZIE1FVEhPRFNcblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIHJlbmFtZS4gTm8gYXJndW1lbnRzIG90aGVyIHRoYW4gYSBwb3NzaWJsZSBleGNlcHRpb24gYXJlIGdpdmVuXG4gICAqIHRvIHRoZSBjb21wbGV0aW9uIGNhbGxiYWNrLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gb2xkUGF0aFxuICAgKiBAcGFyYW0gW1N0cmluZ10gbmV3UGF0aFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgcmVuYW1lKG9sZFBhdGg6IHN0cmluZywgbmV3UGF0aDogc3RyaW5nLCBjYjogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICB0aGlzLnJvb3QucmVuYW1lKG5vcm1hbGl6ZVBhdGgob2xkUGF0aCksIG5vcm1hbGl6ZVBhdGgobmV3UGF0aCksIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgcmVuYW1lLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gb2xkUGF0aFxuICAgKiBAcGFyYW0gW1N0cmluZ10gbmV3UGF0aFxuICAgKi9cbiAgcHVibGljIHJlbmFtZVN5bmMob2xkUGF0aDogc3RyaW5nLCBuZXdQYXRoOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLnJvb3QucmVuYW1lU3luYyhub3JtYWxpemVQYXRoKG9sZFBhdGgpLCBub3JtYWxpemVQYXRoKG5ld1BhdGgpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUZXN0IHdoZXRoZXIgb3Igbm90IHRoZSBnaXZlbiBwYXRoIGV4aXN0cyBieSBjaGVja2luZyB3aXRoIHRoZSBmaWxlIHN5c3RlbS5cbiAgICogVGhlbiBjYWxsIHRoZSBjYWxsYmFjayBhcmd1bWVudCB3aXRoIGVpdGhlciB0cnVlIG9yIGZhbHNlLlxuICAgKiBAZXhhbXBsZSBTYW1wbGUgaW52b2NhdGlvblxuICAgKiAgIGZzLmV4aXN0cygnL2V0Yy9wYXNzd2QnLCBmdW5jdGlvbiAoZXhpc3RzKSB7XG4gICAqICAgICB1dGlsLmRlYnVnKGV4aXN0cyA/IFwiaXQncyB0aGVyZVwiIDogXCJubyBwYXNzd2QhXCIpO1xuICAgKiAgIH0pO1xuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJvb2xlYW4pXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIGV4aXN0cyhwYXRoOiBzdHJpbmcsIGNiOiAoZXhpc3RzOiBib29sZWFuKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gdGhpcy5yb290LmV4aXN0cyhub3JtYWxpemVQYXRoKHBhdGgpLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gRG9lc24ndCByZXR1cm4gYW4gZXJyb3IuIElmIHNvbWV0aGluZyBiYWQgaGFwcGVucywgd2UgYXNzdW1lIGl0IGp1c3RcbiAgICAgIC8vIGRvZXNuJ3QgZXhpc3QuXG4gICAgICByZXR1cm4gbmV3Q2IoZmFsc2UpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUZXN0IHdoZXRoZXIgb3Igbm90IHRoZSBnaXZlbiBwYXRoIGV4aXN0cyBieSBjaGVja2luZyB3aXRoIHRoZSBmaWxlIHN5c3RlbS5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHJldHVybiBbYm9vbGVhbl1cbiAgICovXG4gIHB1YmxpYyBleGlzdHNTeW5jKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gdGhpcy5yb290LmV4aXN0c1N5bmMobm9ybWFsaXplUGF0aChwYXRoKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gRG9lc24ndCByZXR1cm4gYW4gZXJyb3IuIElmIHNvbWV0aGluZyBiYWQgaGFwcGVucywgd2UgYXNzdW1lIGl0IGp1c3RcbiAgICAgIC8vIGRvZXNuJ3QgZXhpc3QuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgc3RhdGAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yLCBCcm93c2VyRlMubm9kZS5mcy5TdGF0cyldIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgc3RhdChwYXRoOiBzdHJpbmcsIGNiOiAoZXJyOiBBcGlFcnJvciwgc3RhdHM/OiBTdGF0cykgPT4gYW55ID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDIpO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gdGhpcy5yb290LnN0YXQobm9ybWFsaXplUGF0aChwYXRoKSwgZmFsc2UsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gbmV3Q2IoZSwgbnVsbCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBzdGF0YC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHJldHVybiBbQnJvd3NlckZTLm5vZGUuZnMuU3RhdHNdXG4gICAqL1xuICBwdWJsaWMgc3RhdFN5bmMocGF0aDogc3RyaW5nKTogU3RhdHMge1xuICAgIHJldHVybiB0aGlzLnJvb3Quc3RhdFN5bmMobm9ybWFsaXplUGF0aChwYXRoKSwgZmFsc2UpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgbHN0YXRgLlxuICAgKiBgbHN0YXQoKWAgaXMgaWRlbnRpY2FsIHRvIGBzdGF0KClgLCBleGNlcHQgdGhhdCBpZiBwYXRoIGlzIGEgc3ltYm9saWMgbGluayxcbiAgICogdGhlbiB0aGUgbGluayBpdHNlbGYgaXMgc3RhdC1lZCwgbm90IHRoZSBmaWxlIHRoYXQgaXQgcmVmZXJzIHRvLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvciwgQnJvd3NlckZTLm5vZGUuZnMuU3RhdHMpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIGxzdGF0KHBhdGg6IHN0cmluZywgY2I6IChlcnI6IEFwaUVycm9yLCBzdGF0cz86IFN0YXRzKSA9PiBhbnkgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMik7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB0aGlzLnJvb3Quc3RhdChub3JtYWxpemVQYXRoKHBhdGgpLCB0cnVlLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIG5ld0NiKGUsIG51bGwpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgbHN0YXRgLlxuICAgKiBgbHN0YXQoKWAgaXMgaWRlbnRpY2FsIHRvIGBzdGF0KClgLCBleGNlcHQgdGhhdCBpZiBwYXRoIGlzIGEgc3ltYm9saWMgbGluayxcbiAgICogdGhlbiB0aGUgbGluayBpdHNlbGYgaXMgc3RhdC1lZCwgbm90IHRoZSBmaWxlIHRoYXQgaXQgcmVmZXJzIHRvLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcmV0dXJuIFtCcm93c2VyRlMubm9kZS5mcy5TdGF0c11cbiAgICovXG4gIHB1YmxpYyBsc3RhdFN5bmMocGF0aDogc3RyaW5nKTogU3RhdHMge1xuICAgIHJldHVybiB0aGlzLnJvb3Quc3RhdFN5bmMobm9ybWFsaXplUGF0aChwYXRoKSwgdHJ1ZSk7XG4gIH1cblxuICAvLyBGSUxFLU9OTFkgTUVUSE9EU1xuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYHRydW5jYXRlYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtOdW1iZXJdIGxlblxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgdHJ1bmNhdGUocGF0aDogc3RyaW5nLCBjYj86IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyB0cnVuY2F0ZShwYXRoOiBzdHJpbmcsIGxlbjogbnVtYmVyLCBjYj86IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyB0cnVuY2F0ZShwYXRoOiBzdHJpbmcsIGFyZzI6IGFueSA9IDAsIGNiOiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBsZW4gPSAwO1xuICAgIGlmICh0eXBlb2YgYXJnMiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2IgPSBhcmcyO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGFyZzIgPT09ICdudW1iZXInKSB7XG4gICAgICBsZW4gPSBhcmcyO1xuICAgIH1cblxuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIGlmIChsZW4gPCAwKSB7XG4gICAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnJvb3QudHJ1bmNhdGUobm9ybWFsaXplUGF0aChwYXRoKSwgbGVuLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgdHJ1bmNhdGVgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW051bWJlcl0gbGVuXG4gICAqL1xuICBwdWJsaWMgdHJ1bmNhdGVTeW5jKHBhdGg6IHN0cmluZywgbGVuOiBudW1iZXIgPSAwKTogdm9pZCB7XG4gICAgaWYgKGxlbiA8IDApIHtcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucm9vdC50cnVuY2F0ZVN5bmMobm9ybWFsaXplUGF0aChwYXRoKSwgbGVuKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYHVubGlua2AuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyB1bmxpbmsocGF0aDogc3RyaW5nLCBjYjogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gdGhpcy5yb290LnVubGluayhub3JtYWxpemVQYXRoKHBhdGgpLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgdW5saW5rYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICovXG4gIHB1YmxpYyB1bmxpbmtTeW5jKHBhdGg6IHN0cmluZyk6IHZvaWQge1xuICAgIHJldHVybiB0aGlzLnJvb3QudW5saW5rU3luYyhub3JtYWxpemVQYXRoKHBhdGgpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgZmlsZSBvcGVuLlxuICAgKiBFeGNsdXNpdmUgbW9kZSBlbnN1cmVzIHRoYXQgcGF0aCBpcyBuZXdseSBjcmVhdGVkLlxuICAgKlxuICAgKiBgZmxhZ3NgIGNhbiBiZTpcbiAgICpcbiAgICogKiBgJ3InYCAtIE9wZW4gZmlsZSBmb3IgcmVhZGluZy4gQW4gZXhjZXB0aW9uIG9jY3VycyBpZiB0aGUgZmlsZSBkb2VzIG5vdCBleGlzdC5cbiAgICogKiBgJ3IrJ2AgLSBPcGVuIGZpbGUgZm9yIHJlYWRpbmcgYW5kIHdyaXRpbmcuIEFuIGV4Y2VwdGlvbiBvY2N1cnMgaWYgdGhlIGZpbGUgZG9lcyBub3QgZXhpc3QuXG4gICAqICogYCdycydgIC0gT3BlbiBmaWxlIGZvciByZWFkaW5nIGluIHN5bmNocm9ub3VzIG1vZGUuIEluc3RydWN0cyB0aGUgZmlsZXN5c3RlbSB0byBub3QgY2FjaGUgd3JpdGVzLlxuICAgKiAqIGAncnMrJ2AgLSBPcGVuIGZpbGUgZm9yIHJlYWRpbmcgYW5kIHdyaXRpbmcsIGFuZCBvcGVucyB0aGUgZmlsZSBpbiBzeW5jaHJvbm91cyBtb2RlLlxuICAgKiAqIGAndydgIC0gT3BlbiBmaWxlIGZvciB3cml0aW5nLiBUaGUgZmlsZSBpcyBjcmVhdGVkIChpZiBpdCBkb2VzIG5vdCBleGlzdCkgb3IgdHJ1bmNhdGVkIChpZiBpdCBleGlzdHMpLlxuICAgKiAqIGAnd3gnYCAtIExpa2UgJ3cnIGJ1dCBvcGVucyB0aGUgZmlsZSBpbiBleGNsdXNpdmUgbW9kZS5cbiAgICogKiBgJ3crJ2AgLSBPcGVuIGZpbGUgZm9yIHJlYWRpbmcgYW5kIHdyaXRpbmcuIFRoZSBmaWxlIGlzIGNyZWF0ZWQgKGlmIGl0IGRvZXMgbm90IGV4aXN0KSBvciB0cnVuY2F0ZWQgKGlmIGl0IGV4aXN0cykuXG4gICAqICogYCd3eCsnYCAtIExpa2UgJ3crJyBidXQgb3BlbnMgdGhlIGZpbGUgaW4gZXhjbHVzaXZlIG1vZGUuXG4gICAqICogYCdhJ2AgLSBPcGVuIGZpbGUgZm9yIGFwcGVuZGluZy4gVGhlIGZpbGUgaXMgY3JlYXRlZCBpZiBpdCBkb2VzIG5vdCBleGlzdC5cbiAgICogKiBgJ2F4J2AgLSBMaWtlICdhJyBidXQgb3BlbnMgdGhlIGZpbGUgaW4gZXhjbHVzaXZlIG1vZGUuXG4gICAqICogYCdhKydgIC0gT3BlbiBmaWxlIGZvciByZWFkaW5nIGFuZCBhcHBlbmRpbmcuIFRoZSBmaWxlIGlzIGNyZWF0ZWQgaWYgaXQgZG9lcyBub3QgZXhpc3QuXG4gICAqICogYCdheCsnYCAtIExpa2UgJ2ErJyBidXQgb3BlbnMgdGhlIGZpbGUgaW4gZXhjbHVzaXZlIG1vZGUuXG4gICAqXG4gICAqIEBzZWUgaHR0cDovL3d3dy5tYW5wYWdlei5jb20vbWFuLzIvb3Blbi9cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtTdHJpbmddIGZsYWdzXG4gICAqIEBwYXJhbSBbTnVtYmVyP10gbW9kZSBkZWZhdWx0cyB0byBgMDY0NGBcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IsIEJyb3dzZXJGUy5GaWxlKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBvcGVuKHBhdGg6IHN0cmluZywgZmxhZzogc3RyaW5nLCBjYj86IChlcnI6IEFwaUVycm9yLCBmZD86IG51bWJlcikgPT4gYW55KTogdm9pZDtcbiAgcHVibGljIG9wZW4ocGF0aDogc3RyaW5nLCBmbGFnOiBzdHJpbmcsIG1vZGU6IG51bWJlcnxzdHJpbmcsIGNiPzogKGVycjogQXBpRXJyb3IsIGZkPzogbnVtYmVyKSA9PiBhbnkpOiB2b2lkO1xuICBwdWJsaWMgb3BlbihwYXRoOiBzdHJpbmcsIGZsYWc6IHN0cmluZywgYXJnMj86IGFueSwgY2I6IChlcnI6IEFwaUVycm9yLCBmZD86IG51bWJlcikgPT4gYW55ID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbW9kZSA9IG5vcm1hbGl6ZU1vZGUoYXJnMiwgMHgxYTQpO1xuICAgIGNiID0gdHlwZW9mIGFyZzIgPT09ICdmdW5jdGlvbicgPyBhcmcyIDogY2I7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAyKTtcbiAgICB0cnkge1xuICAgICAgdGhpcy5yb290Lm9wZW4obm9ybWFsaXplUGF0aChwYXRoKSwgRmlsZUZsYWcuZ2V0RmlsZUZsYWcoZmxhZyksIG1vZGUsIChlOiBBcGlFcnJvciwgZmlsZT86IEZpbGUpID0+IHtcbiAgICAgICAgaWYgKGZpbGUpIHtcbiAgICAgICAgICBuZXdDYihlLCB0aGlzLmdldEZkRm9yRmlsZShmaWxlKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3Q2IoZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUsIG51bGwpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBmaWxlIG9wZW4uXG4gICAqIEBzZWUgaHR0cDovL3d3dy5tYW5wYWdlei5jb20vbWFuLzIvb3Blbi9cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtTdHJpbmddIGZsYWdzXG4gICAqIEBwYXJhbSBbTnVtYmVyP10gbW9kZSBkZWZhdWx0cyB0byBgMDY0NGBcbiAgICogQHJldHVybiBbQnJvd3NlckZTLkZpbGVdXG4gICAqL1xuICBwdWJsaWMgb3BlblN5bmMocGF0aDogc3RyaW5nLCBmbGFnOiBzdHJpbmcsIG1vZGU6IG51bWJlcnxzdHJpbmcgPSAweDFhNCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0RmRGb3JGaWxlKFxuICAgICAgdGhpcy5yb290Lm9wZW5TeW5jKG5vcm1hbGl6ZVBhdGgocGF0aCksIEZpbGVGbGFnLmdldEZpbGVGbGFnKGZsYWcpLCBub3JtYWxpemVNb2RlKG1vZGUsIDB4MWE0KSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91c2x5IHJlYWRzIHRoZSBlbnRpcmUgY29udGVudHMgb2YgYSBmaWxlLlxuICAgKiBAZXhhbXBsZSBVc2FnZSBleGFtcGxlXG4gICAqICAgZnMucmVhZEZpbGUoJy9ldGMvcGFzc3dkJywgZnVuY3Rpb24gKGVyciwgZGF0YSkge1xuICAgKiAgICAgaWYgKGVycikgdGhyb3cgZXJyO1xuICAgKiAgICAgY29uc29sZS5sb2coZGF0YSk7XG4gICAqICAgfSk7XG4gICAqIEBwYXJhbSBbU3RyaW5nXSBmaWxlbmFtZVxuICAgKiBAcGFyYW0gW09iamVjdD9dIG9wdGlvbnNcbiAgICogQG9wdGlvbiBvcHRpb25zIFtTdHJpbmddIGVuY29kaW5nIFRoZSBzdHJpbmcgZW5jb2RpbmcgZm9yIHRoZSBmaWxlIGNvbnRlbnRzLiBEZWZhdWx0cyB0byBgbnVsbGAuXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbU3RyaW5nXSBmbGFnIERlZmF1bHRzIHRvIGAncidgLlxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvciwgU3RyaW5nIHwgQnJvd3NlckZTLm5vZGUuQnVmZmVyKV0gY2FsbGJhY2sgSWYgbm8gZW5jb2RpbmcgaXMgc3BlY2lmaWVkLCB0aGVuIHRoZSByYXcgYnVmZmVyIGlzIHJldHVybmVkLlxuICAgKi9cbiAgcHVibGljIHJlYWRGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGNiOiAoZXJyOiBBcGlFcnJvciwgZGF0YT86IEJ1ZmZlcikgPT4gdm9pZCApOiB2b2lkO1xuICBwdWJsaWMgcmVhZEZpbGUoZmlsZW5hbWU6IHN0cmluZywgb3B0aW9uczogeyBmbGFnPzogc3RyaW5nOyB9LCBjYWxsYmFjazogKGVycjogQXBpRXJyb3IsIGRhdGE6IEJ1ZmZlcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyByZWFkRmlsZShmaWxlbmFtZTogc3RyaW5nLCBvcHRpb25zOiB7IGVuY29kaW5nOiBzdHJpbmc7IGZsYWc/OiBzdHJpbmc7IH0sIGNhbGxiYWNrOiAoZXJyOiBBcGlFcnJvciwgZGF0YTogc3RyaW5nKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHJlYWRGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGVuY29kaW5nOiBzdHJpbmcsIGNiPzogKGVycjogQXBpRXJyb3IsIGRhdGE/OiBzdHJpbmcpID0+IHZvaWQgKTogdm9pZDtcbiAgcHVibGljIHJlYWRGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGFyZzI6IGFueSA9IHt9LCBjYjogKGVycjogQXBpRXJyb3IsIGRhdGE/OiBhbnkpID0+IHZvaWQgPSBub3BDYiApIHtcbiAgICB2YXIgb3B0aW9ucyA9IG5vcm1hbGl6ZU9wdGlvbnMoYXJnMiwgbnVsbCwgJ3InLCBudWxsKTtcbiAgICBjYiA9IHR5cGVvZiBhcmcyID09PSAnZnVuY3Rpb24nID8gYXJnMiA6IGNiO1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMik7XG4gICAgdHJ5IHtcbiAgICAgIHZhciBmbGFnID0gRmlsZUZsYWcuZ2V0RmlsZUZsYWcob3B0aW9uc1snZmxhZyddKTtcbiAgICAgIGlmICghZmxhZy5pc1JlYWRhYmxlKCkpIHtcbiAgICAgICAgcmV0dXJuIG5ld0NiKG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnRmxhZyBwYXNzZWQgdG8gcmVhZEZpbGUgbXVzdCBhbGxvdyBmb3IgcmVhZGluZy4nKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5yb290LnJlYWRGaWxlKG5vcm1hbGl6ZVBhdGgoZmlsZW5hbWUpLCBvcHRpb25zLmVuY29kaW5nLCBmbGFnLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIG5ld0NiKGUsIG51bGwpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91c2x5IHJlYWRzIHRoZSBlbnRpcmUgY29udGVudHMgb2YgYSBmaWxlLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gZmlsZW5hbWVcbiAgICogQHBhcmFtIFtPYmplY3Q/XSBvcHRpb25zXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbU3RyaW5nXSBlbmNvZGluZyBUaGUgc3RyaW5nIGVuY29kaW5nIGZvciB0aGUgZmlsZSBjb250ZW50cy4gRGVmYXVsdHMgdG8gYG51bGxgLlxuICAgKiBAb3B0aW9uIG9wdGlvbnMgW1N0cmluZ10gZmxhZyBEZWZhdWx0cyB0byBgJ3InYC5cbiAgICogQHJldHVybiBbU3RyaW5nIHwgQnJvd3NlckZTLm5vZGUuQnVmZmVyXVxuICAgKi9cbiAgcHVibGljIHJlYWRGaWxlU3luYyhmaWxlbmFtZTogc3RyaW5nLCBvcHRpb25zPzogeyBmbGFnPzogc3RyaW5nOyB9KTogQnVmZmVyO1xuICBwdWJsaWMgcmVhZEZpbGVTeW5jKGZpbGVuYW1lOiBzdHJpbmcsIG9wdGlvbnM6IHsgZW5jb2Rpbmc6IHN0cmluZzsgZmxhZz86IHN0cmluZzsgfSk6IHN0cmluZztcbiAgcHVibGljIHJlYWRGaWxlU3luYyhmaWxlbmFtZTogc3RyaW5nLCBlbmNvZGluZzogc3RyaW5nKTogc3RyaW5nO1xuICBwdWJsaWMgcmVhZEZpbGVTeW5jKGZpbGVuYW1lOiBzdHJpbmcsIGFyZzI6IGFueSA9IHt9KTogYW55IHtcbiAgICB2YXIgb3B0aW9ucyA9IG5vcm1hbGl6ZU9wdGlvbnMoYXJnMiwgbnVsbCwgJ3InLCBudWxsKTtcbiAgICB2YXIgZmxhZyA9IEZpbGVGbGFnLmdldEZpbGVGbGFnKG9wdGlvbnMuZmxhZyk7XG4gICAgaWYgKCFmbGFnLmlzUmVhZGFibGUoKSkge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsICdGbGFnIHBhc3NlZCB0byByZWFkRmlsZSBtdXN0IGFsbG93IGZvciByZWFkaW5nLicpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5yb290LnJlYWRGaWxlU3luYyhub3JtYWxpemVQYXRoKGZpbGVuYW1lKSwgb3B0aW9ucy5lbmNvZGluZywgZmxhZyk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzbHkgd3JpdGVzIGRhdGEgdG8gYSBmaWxlLCByZXBsYWNpbmcgdGhlIGZpbGUgaWYgaXQgYWxyZWFkeVxuICAgKiBleGlzdHMuXG4gICAqXG4gICAqIFRoZSBlbmNvZGluZyBvcHRpb24gaXMgaWdub3JlZCBpZiBkYXRhIGlzIGEgYnVmZmVyLlxuICAgKlxuICAgKiBAZXhhbXBsZSBVc2FnZSBleGFtcGxlXG4gICAqICAgZnMud3JpdGVGaWxlKCdtZXNzYWdlLnR4dCcsICdIZWxsbyBOb2RlJywgZnVuY3Rpb24gKGVycikge1xuICAgKiAgICAgaWYgKGVycikgdGhyb3cgZXJyO1xuICAgKiAgICAgY29uc29sZS5sb2coJ0l0XFwncyBzYXZlZCEnKTtcbiAgICogICB9KTtcbiAgICogQHBhcmFtIFtTdHJpbmddIGZpbGVuYW1lXG4gICAqIEBwYXJhbSBbU3RyaW5nIHwgQnJvd3NlckZTLm5vZGUuQnVmZmVyXSBkYXRhXG4gICAqIEBwYXJhbSBbT2JqZWN0P10gb3B0aW9uc1xuICAgKiBAb3B0aW9uIG9wdGlvbnMgW1N0cmluZ10gZW5jb2RpbmcgRGVmYXVsdHMgdG8gYCd1dGY4J2AuXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbTnVtYmVyXSBtb2RlIERlZmF1bHRzIHRvIGAwNjQ0YC5cbiAgICogQG9wdGlvbiBvcHRpb25zIFtTdHJpbmddIGZsYWcgRGVmYXVsdHMgdG8gYCd3J2AuXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyB3cml0ZUZpbGUoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogYW55LCBjYj86IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyB3cml0ZUZpbGUoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogYW55LCBlbmNvZGluZz86IHN0cmluZywgY2I/OiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgd3JpdGVGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgb3B0aW9ucz86IHsgZW5jb2Rpbmc/OiBzdHJpbmc7IG1vZGU/OiBzdHJpbmcgfCBudW1iZXI7IGZsYWc/OiBzdHJpbmc7IH0sIGNiPzogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHdyaXRlRmlsZShmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGFyZzM6IGFueSA9IHt9LCBjYjogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgb3B0aW9ucyA9IG5vcm1hbGl6ZU9wdGlvbnMoYXJnMywgJ3V0ZjgnLCAndycsIDB4MWE0KTtcbiAgICBjYiA9IHR5cGVvZiBhcmczID09PSAnZnVuY3Rpb24nID8gYXJnMyA6IGNiO1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHZhciBmbGFnID0gRmlsZUZsYWcuZ2V0RmlsZUZsYWcob3B0aW9ucy5mbGFnKTtcbiAgICAgIGlmICghZmxhZy5pc1dyaXRlYWJsZSgpKSB7XG4gICAgICAgIHJldHVybiBuZXdDYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgJ0ZsYWcgcGFzc2VkIHRvIHdyaXRlRmlsZSBtdXN0IGFsbG93IGZvciB3cml0aW5nLicpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnJvb3Qud3JpdGVGaWxlKG5vcm1hbGl6ZVBhdGgoZmlsZW5hbWUpLCBkYXRhLCBvcHRpb25zLmVuY29kaW5nLCBmbGFnLCBvcHRpb25zLm1vZGUsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzbHkgd3JpdGVzIGRhdGEgdG8gYSBmaWxlLCByZXBsYWNpbmcgdGhlIGZpbGUgaWYgaXQgYWxyZWFkeVxuICAgKiBleGlzdHMuXG4gICAqXG4gICAqIFRoZSBlbmNvZGluZyBvcHRpb24gaXMgaWdub3JlZCBpZiBkYXRhIGlzIGEgYnVmZmVyLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gZmlsZW5hbWVcbiAgICogQHBhcmFtIFtTdHJpbmcgfCBCcm93c2VyRlMubm9kZS5CdWZmZXJdIGRhdGFcbiAgICogQHBhcmFtIFtPYmplY3Q/XSBvcHRpb25zXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbU3RyaW5nXSBlbmNvZGluZyBEZWZhdWx0cyB0byBgJ3V0ZjgnYC5cbiAgICogQG9wdGlvbiBvcHRpb25zIFtOdW1iZXJdIG1vZGUgRGVmYXVsdHMgdG8gYDA2NDRgLlxuICAgKiBAb3B0aW9uIG9wdGlvbnMgW1N0cmluZ10gZmxhZyBEZWZhdWx0cyB0byBgJ3cnYC5cbiAgICovXG4gIHB1YmxpYyB3cml0ZUZpbGVTeW5jKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgb3B0aW9ucz86IHsgZW5jb2Rpbmc/OiBzdHJpbmc7IG1vZGU/OiBudW1iZXIgfCBzdHJpbmc7IGZsYWc/OiBzdHJpbmc7IH0pOiB2b2lkO1xuICBwdWJsaWMgd3JpdGVGaWxlU3luYyhmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGVuY29kaW5nPzogc3RyaW5nKTogdm9pZDtcbiAgcHVibGljIHdyaXRlRmlsZVN5bmMoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogYW55LCBhcmczPzogYW55KTogdm9pZCB7XG4gICAgdmFyIG9wdGlvbnMgPSBub3JtYWxpemVPcHRpb25zKGFyZzMsICd1dGY4JywgJ3cnLCAweDFhNCk7XG4gICAgdmFyIGZsYWcgPSBGaWxlRmxhZy5nZXRGaWxlRmxhZyhvcHRpb25zLmZsYWcpO1xuICAgIGlmICghZmxhZy5pc1dyaXRlYWJsZSgpKSB7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgJ0ZsYWcgcGFzc2VkIHRvIHdyaXRlRmlsZSBtdXN0IGFsbG93IGZvciB3cml0aW5nLicpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5yb290LndyaXRlRmlsZVN5bmMobm9ybWFsaXplUGF0aChmaWxlbmFtZSksIGRhdGEsIG9wdGlvbnMuZW5jb2RpbmcsIGZsYWcsIG9wdGlvbnMubW9kZSk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzbHkgYXBwZW5kIGRhdGEgdG8gYSBmaWxlLCBjcmVhdGluZyB0aGUgZmlsZSBpZiBpdCBub3QgeWV0XG4gICAqIGV4aXN0cy5cbiAgICpcbiAgICogQGV4YW1wbGUgVXNhZ2UgZXhhbXBsZVxuICAgKiAgIGZzLmFwcGVuZEZpbGUoJ21lc3NhZ2UudHh0JywgJ2RhdGEgdG8gYXBwZW5kJywgZnVuY3Rpb24gKGVycikge1xuICAgKiAgICAgaWYgKGVycikgdGhyb3cgZXJyO1xuICAgKiAgICAgY29uc29sZS5sb2coJ1RoZSBcImRhdGEgdG8gYXBwZW5kXCIgd2FzIGFwcGVuZGVkIHRvIGZpbGUhJyk7XG4gICAqICAgfSk7XG4gICAqIEBwYXJhbSBbU3RyaW5nXSBmaWxlbmFtZVxuICAgKiBAcGFyYW0gW1N0cmluZyB8IEJyb3dzZXJGUy5ub2RlLkJ1ZmZlcl0gZGF0YVxuICAgKiBAcGFyYW0gW09iamVjdD9dIG9wdGlvbnNcbiAgICogQG9wdGlvbiBvcHRpb25zIFtTdHJpbmddIGVuY29kaW5nIERlZmF1bHRzIHRvIGAndXRmOCdgLlxuICAgKiBAb3B0aW9uIG9wdGlvbnMgW051bWJlcl0gbW9kZSBEZWZhdWx0cyB0byBgMDY0NGAuXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbU3RyaW5nXSBmbGFnIERlZmF1bHRzIHRvIGAnYSdgLlxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgYXBwZW5kRmlsZShmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGNiPzogKGVycjogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgYXBwZW5kRmlsZShmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIG9wdGlvbnM/OiB7IGVuY29kaW5nPzogc3RyaW5nOyBtb2RlPzogbnVtYmVyfHN0cmluZzsgZmxhZz86IHN0cmluZzsgfSwgY2I/OiAoZXJyOiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyBhcHBlbmRGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgZW5jb2Rpbmc/OiBzdHJpbmcsIGNiPzogKGVycjogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgYXBwZW5kRmlsZShmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGFyZzM/OiBhbnksIGNiOiAoZXJyOiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG9wdGlvbnMgPSBub3JtYWxpemVPcHRpb25zKGFyZzMsICd1dGY4JywgJ2EnLCAweDFhNCk7XG4gICAgY2IgPSB0eXBlb2YgYXJnMyA9PT0gJ2Z1bmN0aW9uJyA/IGFyZzMgOiBjYjtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICB2YXIgZmxhZyA9IEZpbGVGbGFnLmdldEZpbGVGbGFnKG9wdGlvbnMuZmxhZyk7XG4gICAgICBpZiAoIWZsYWcuaXNBcHBlbmRhYmxlKCkpIHtcbiAgICAgICAgcmV0dXJuIG5ld0NiKG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnRmxhZyBwYXNzZWQgdG8gYXBwZW5kRmlsZSBtdXN0IGFsbG93IGZvciBhcHBlbmRpbmcuJykpO1xuICAgICAgfVxuICAgICAgdGhpcy5yb290LmFwcGVuZEZpbGUobm9ybWFsaXplUGF0aChmaWxlbmFtZSksIGRhdGEsIG9wdGlvbnMuZW5jb2RpbmcsIGZsYWcsIG9wdGlvbnMubW9kZSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXNseSBhcHBlbmQgZGF0YSB0byBhIGZpbGUsIGNyZWF0aW5nIHRoZSBmaWxlIGlmIGl0IG5vdCB5ZXRcbiAgICogZXhpc3RzLlxuICAgKlxuICAgKiBAZXhhbXBsZSBVc2FnZSBleGFtcGxlXG4gICAqICAgZnMuYXBwZW5kRmlsZSgnbWVzc2FnZS50eHQnLCAnZGF0YSB0byBhcHBlbmQnLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAqICAgICBpZiAoZXJyKSB0aHJvdyBlcnI7XG4gICAqICAgICBjb25zb2xlLmxvZygnVGhlIFwiZGF0YSB0byBhcHBlbmRcIiB3YXMgYXBwZW5kZWQgdG8gZmlsZSEnKTtcbiAgICogICB9KTtcbiAgICogQHBhcmFtIFtTdHJpbmddIGZpbGVuYW1lXG4gICAqIEBwYXJhbSBbU3RyaW5nIHwgQnJvd3NlckZTLm5vZGUuQnVmZmVyXSBkYXRhXG4gICAqIEBwYXJhbSBbT2JqZWN0P10gb3B0aW9uc1xuICAgKiBAb3B0aW9uIG9wdGlvbnMgW1N0cmluZ10gZW5jb2RpbmcgRGVmYXVsdHMgdG8gYCd1dGY4J2AuXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbTnVtYmVyXSBtb2RlIERlZmF1bHRzIHRvIGAwNjQ0YC5cbiAgICogQG9wdGlvbiBvcHRpb25zIFtTdHJpbmddIGZsYWcgRGVmYXVsdHMgdG8gYCdhJ2AuXG4gICAqL1xuICBwdWJsaWMgYXBwZW5kRmlsZVN5bmMoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogYW55LCBvcHRpb25zPzogeyBlbmNvZGluZz86IHN0cmluZzsgbW9kZT86IG51bWJlciB8IHN0cmluZzsgZmxhZz86IHN0cmluZzsgfSk6IHZvaWQ7XG4gIHB1YmxpYyBhcHBlbmRGaWxlU3luYyhmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGVuY29kaW5nPzogc3RyaW5nKTogdm9pZDtcbiAgcHVibGljIGFwcGVuZEZpbGVTeW5jKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgYXJnMz86IGFueSk6IHZvaWQge1xuICAgIHZhciBvcHRpb25zID0gbm9ybWFsaXplT3B0aW9ucyhhcmczLCAndXRmOCcsICdhJywgMHgxYTQpO1xuICAgIHZhciBmbGFnID0gRmlsZUZsYWcuZ2V0RmlsZUZsYWcob3B0aW9ucy5mbGFnKTtcbiAgICBpZiAoIWZsYWcuaXNBcHBlbmRhYmxlKCkpIHtcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnRmxhZyBwYXNzZWQgdG8gYXBwZW5kRmlsZSBtdXN0IGFsbG93IGZvciBhcHBlbmRpbmcuJyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnJvb3QuYXBwZW5kRmlsZVN5bmMobm9ybWFsaXplUGF0aChmaWxlbmFtZSksIGRhdGEsIG9wdGlvbnMuZW5jb2RpbmcsIGZsYWcsIG9wdGlvbnMubW9kZSk7XG4gIH1cblxuICAvLyBGSUxFIERFU0NSSVBUT1IgTUVUSE9EU1xuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYGZzdGF0YC5cbiAgICogYGZzdGF0KClgIGlzIGlkZW50aWNhbCB0byBgc3RhdCgpYCwgZXhjZXB0IHRoYXQgdGhlIGZpbGUgdG8gYmUgc3RhdC1lZCBpc1xuICAgKiBzcGVjaWZpZWQgYnkgdGhlIGZpbGUgZGVzY3JpcHRvciBgZmRgLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvciwgQnJvd3NlckZTLm5vZGUuZnMuU3RhdHMpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIGZzdGF0KGZkOiBudW1iZXIsIGNiOiAoZXJyOiBBcGlFcnJvciwgc3RhdHM/OiBTdGF0cykgPT4gYW55ID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDIpO1xuICAgIHRyeSB7XG4gICAgICBsZXQgZmlsZSA9IHRoaXMuZmQyZmlsZShmZCk7XG4gICAgICBmaWxlLnN0YXQobmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgZnN0YXRgLlxuICAgKiBgZnN0YXQoKWAgaXMgaWRlbnRpY2FsIHRvIGBzdGF0KClgLCBleGNlcHQgdGhhdCB0aGUgZmlsZSB0byBiZSBzdGF0LWVkIGlzXG4gICAqIHNwZWNpZmllZCBieSB0aGUgZmlsZSBkZXNjcmlwdG9yIGBmZGAuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEByZXR1cm4gW0Jyb3dzZXJGUy5ub2RlLmZzLlN0YXRzXVxuICAgKi9cbiAgcHVibGljIGZzdGF0U3luYyhmZDogbnVtYmVyKTogU3RhdHMge1xuICAgIHJldHVybiB0aGlzLmZkMmZpbGUoZmQpLnN0YXRTeW5jKCk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGNsb3NlLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgY2xvc2UoZmQ6IG51bWJlciwgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuZmQyZmlsZShmZCkuY2xvc2UoKGU6IEFwaUVycm9yKSA9PiB7XG4gICAgICAgIGlmICghZSkge1xuICAgICAgICAgIHRoaXMuY2xvc2VGZChmZCk7XG4gICAgICAgIH1cbiAgICAgICAgbmV3Q2IoZSk7XG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgY2xvc2UuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqL1xuICBwdWJsaWMgY2xvc2VTeW5jKGZkOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLmZkMmZpbGUoZmQpLmNsb3NlU3luYygpO1xuICAgIHRoaXMuY2xvc2VGZChmZCk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGZ0cnVuY2F0ZS5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtOdW1iZXJdIGxlblxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgZnRydW5jYXRlKGZkOiBudW1iZXIsIGNiPzogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIGZ0cnVuY2F0ZShmZDogbnVtYmVyLCBsZW4/OiBudW1iZXIsIGNiPzogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIGZ0cnVuY2F0ZShmZDogbnVtYmVyLCBhcmcyPzogYW55LCBjYjogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbGVuZ3RoID0gdHlwZW9mIGFyZzIgPT09ICdudW1iZXInID8gYXJnMiA6IDA7XG4gICAgY2IgPSB0eXBlb2YgYXJnMiA9PT0gJ2Z1bmN0aW9uJyA/IGFyZzIgOiBjYjtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICBsZXQgZmlsZSA9IHRoaXMuZmQyZmlsZShmZCk7XG4gICAgICBpZiAobGVuZ3RoIDwgMCkge1xuICAgICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCk7XG4gICAgICB9XG4gICAgICBmaWxlLnRydW5jYXRlKGxlbmd0aCwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBmdHJ1bmNhdGUuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBsZW5cbiAgICovXG4gIHB1YmxpYyBmdHJ1bmNhdGVTeW5jKGZkOiBudW1iZXIsIGxlbjogbnVtYmVyID0gMCk6IHZvaWQge1xuICAgIGxldCBmaWxlID0gdGhpcy5mZDJmaWxlKGZkKTtcbiAgICBpZiAobGVuIDwgMCkge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwpO1xuICAgIH1cbiAgICBmaWxlLnRydW5jYXRlU3luYyhsZW4pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBmc3luYy5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIGZzeW5jKGZkOiBudW1iZXIsIGNiOiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuZmQyZmlsZShmZCkuc3luYyhuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGZzeW5jLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKi9cbiAgcHVibGljIGZzeW5jU3luYyhmZDogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhpcy5mZDJmaWxlKGZkKS5zeW5jU3luYygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBmZGF0YXN5bmMuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBmZGF0YXN5bmMoZmQ6IG51bWJlciwgY2I6IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgdGhpcy5mZDJmaWxlKGZkKS5kYXRhc3luYyhuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGZkYXRhc3luYy5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICovXG4gIHB1YmxpYyBmZGF0YXN5bmNTeW5jKGZkOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLmZkMmZpbGUoZmQpLmRhdGFzeW5jU3luYygpO1xuICB9XG5cbiAgLyoqXG4gICAqIFdyaXRlIGJ1ZmZlciB0byB0aGUgZmlsZSBzcGVjaWZpZWQgYnkgYGZkYC5cbiAgICogTm90ZSB0aGF0IGl0IGlzIHVuc2FmZSB0byB1c2UgZnMud3JpdGUgbXVsdGlwbGUgdGltZXMgb24gdGhlIHNhbWUgZmlsZVxuICAgKiB3aXRob3V0IHdhaXRpbmcgZm9yIHRoZSBjYWxsYmFjay5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtCcm93c2VyRlMubm9kZS5CdWZmZXJdIGJ1ZmZlciBCdWZmZXIgY29udGFpbmluZyB0aGUgZGF0YSB0byB3cml0ZSB0b1xuICAgKiAgIHRoZSBmaWxlLlxuICAgKiBAcGFyYW0gW051bWJlcl0gb2Zmc2V0IE9mZnNldCBpbiB0aGUgYnVmZmVyIHRvIHN0YXJ0IHJlYWRpbmcgZGF0YSBmcm9tLlxuICAgKiBAcGFyYW0gW051bWJlcl0gbGVuZ3RoIFRoZSBhbW91bnQgb2YgYnl0ZXMgdG8gd3JpdGUgdG8gdGhlIGZpbGUuXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBwb3NpdGlvbiBPZmZzZXQgZnJvbSB0aGUgYmVnaW5uaW5nIG9mIHRoZSBmaWxlIHdoZXJlIHRoaXNcbiAgICogICBkYXRhIHNob3VsZCBiZSB3cml0dGVuLiBJZiBwb3NpdGlvbiBpcyBudWxsLCB0aGUgZGF0YSB3aWxsIGJlIHdyaXR0ZW4gYXRcbiAgICogICB0aGUgY3VycmVudCBwb3NpdGlvbi5cbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IsIE51bWJlciwgQnJvd3NlckZTLm5vZGUuQnVmZmVyKV1cbiAgICogICBjYWxsYmFjayBUaGUgbnVtYmVyIHNwZWNpZmllcyB0aGUgbnVtYmVyIG9mIGJ5dGVzIHdyaXR0ZW4gaW50byB0aGUgZmlsZS5cbiAgICovXG4gIHB1YmxpYyB3cml0ZShmZDogbnVtYmVyLCBidWZmZXI6IEJ1ZmZlciwgb2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLCBjYj86IChlcnI6IEFwaUVycm9yLCB3cml0dGVuOiBudW1iZXIsIGJ1ZmZlcjogQnVmZmVyKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHdyaXRlKGZkOiBudW1iZXIsIGJ1ZmZlcjogQnVmZmVyLCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIHBvc2l0aW9uOiBudW1iZXIsIGNiPzogKGVycjogQXBpRXJyb3IsIHdyaXR0ZW46IG51bWJlciwgYnVmZmVyOiBCdWZmZXIpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgd3JpdGUoZmQ6IG51bWJlciwgZGF0YTogYW55LCBjYj86IChlcnI6IEFwaUVycm9yLCB3cml0dGVuOiBudW1iZXIsIHN0cjogc3RyaW5nKSA9PiBhbnkpOiB2b2lkO1xuICBwdWJsaWMgd3JpdGUoZmQ6IG51bWJlciwgZGF0YTogYW55LCBwb3NpdGlvbjogbnVtYmVyLCBjYj86IChlcnI6IEFwaUVycm9yLCB3cml0dGVuOiBudW1iZXIsIHN0cjogc3RyaW5nKSA9PiBhbnkpOiB2b2lkO1xuICBwdWJsaWMgd3JpdGUoZmQ6IG51bWJlciwgZGF0YTogYW55LCBwb3NpdGlvbjogbnVtYmVyLCBlbmNvZGluZzogc3RyaW5nLCBjYj86IChlcnI6IEFwaUVycm9yLCB3cml0dGVuOiBudW1iZXIsIHN0cjogc3RyaW5nKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHdyaXRlKGZkOiBudW1iZXIsIGFyZzI6IGFueSwgYXJnMz86IGFueSwgYXJnND86IGFueSwgYXJnNT86IGFueSwgY2I6IChlcnI6IEFwaUVycm9yLCB3cml0dGVuPzogbnVtYmVyLCBidWZmZXI/OiBCdWZmZXIpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBidWZmZXI6IEJ1ZmZlciwgb2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLCBwb3NpdGlvbjogbnVtYmVyID0gbnVsbDtcbiAgICBpZiAodHlwZW9mIGFyZzIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBTaWduYXR1cmUgMTogKGZkLCBzdHJpbmcsIFtwb3NpdGlvbj8sIFtlbmNvZGluZz9dXSwgY2I/KVxuICAgICAgdmFyIGVuY29kaW5nID0gJ3V0ZjgnO1xuICAgICAgc3dpdGNoICh0eXBlb2YgYXJnMykge1xuICAgICAgICBjYXNlICdmdW5jdGlvbic6XG4gICAgICAgICAgLy8gKGZkLCBzdHJpbmcsIGNiKVxuICAgICAgICAgIGNiID0gYXJnMztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgICAvLyAoZmQsIHN0cmluZywgcG9zaXRpb24sIGVuY29kaW5nPywgY2I/KVxuICAgICAgICAgIHBvc2l0aW9uID0gYXJnMztcbiAgICAgICAgICBlbmNvZGluZyA9IHR5cGVvZiBhcmc0ID09PSAnc3RyaW5nJyA/IGFyZzQgOiAndXRmOCc7XG4gICAgICAgICAgY2IgPSB0eXBlb2YgYXJnNSA9PT0gJ2Z1bmN0aW9uJyA/IGFyZzUgOiBjYjtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAvLyAuLi50cnkgdG8gZmluZCB0aGUgY2FsbGJhY2sgYW5kIGdldCBvdXQgb2YgaGVyZSFcbiAgICAgICAgICBjYiA9IHR5cGVvZiBhcmc0ID09PSAnZnVuY3Rpb24nID8gYXJnNCA6IHR5cGVvZiBhcmc1ID09PSAnZnVuY3Rpb24nID8gYXJnNSA6IGNiO1xuICAgICAgICAgIHJldHVybiBjYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgJ0ludmFsaWQgYXJndW1lbnRzLicpKTtcbiAgICAgIH1cbiAgICAgIGJ1ZmZlciA9IG5ldyBCdWZmZXIoYXJnMiwgZW5jb2RpbmcpO1xuICAgICAgb2Zmc2V0ID0gMDtcbiAgICAgIGxlbmd0aCA9IGJ1ZmZlci5sZW5ndGg7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFNpZ25hdHVyZSAyOiAoZmQsIGJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgsIHBvc2l0aW9uPywgY2I/KVxuICAgICAgYnVmZmVyID0gYXJnMjtcbiAgICAgIG9mZnNldCA9IGFyZzM7XG4gICAgICBsZW5ndGggPSBhcmc0O1xuICAgICAgcG9zaXRpb24gPSB0eXBlb2YgYXJnNSA9PT0gJ251bWJlcicgPyBhcmc1IDogbnVsbDtcbiAgICAgIGNiID0gdHlwZW9mIGFyZzUgPT09ICdmdW5jdGlvbicgPyBhcmc1IDogY2I7XG4gICAgfVxuXG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAzKTtcbiAgICB0cnkge1xuICAgICAgbGV0IGZpbGUgPSB0aGlzLmZkMmZpbGUoZmQpO1xuICAgICAgaWYgKHBvc2l0aW9uID09IG51bGwpIHtcbiAgICAgICAgcG9zaXRpb24gPSBmaWxlLmdldFBvcygpO1xuICAgICAgfVxuICAgICAgZmlsZS53cml0ZShidWZmZXIsIG9mZnNldCwgbGVuZ3RoLCBwb3NpdGlvbiwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZSBidWZmZXIgdG8gdGhlIGZpbGUgc3BlY2lmaWVkIGJ5IGBmZGAuXG4gICAqIE5vdGUgdGhhdCBpdCBpcyB1bnNhZmUgdG8gdXNlIGZzLndyaXRlIG11bHRpcGxlIHRpbWVzIG9uIHRoZSBzYW1lIGZpbGVcbiAgICogd2l0aG91dCB3YWl0aW5nIGZvciBpdCB0byByZXR1cm4uXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLm5vZGUuQnVmZmVyXSBidWZmZXIgQnVmZmVyIGNvbnRhaW5pbmcgdGhlIGRhdGEgdG8gd3JpdGUgdG9cbiAgICogICB0aGUgZmlsZS5cbiAgICogQHBhcmFtIFtOdW1iZXJdIG9mZnNldCBPZmZzZXQgaW4gdGhlIGJ1ZmZlciB0byBzdGFydCByZWFkaW5nIGRhdGEgZnJvbS5cbiAgICogQHBhcmFtIFtOdW1iZXJdIGxlbmd0aCBUaGUgYW1vdW50IG9mIGJ5dGVzIHRvIHdyaXRlIHRvIHRoZSBmaWxlLlxuICAgKiBAcGFyYW0gW051bWJlcl0gcG9zaXRpb24gT2Zmc2V0IGZyb20gdGhlIGJlZ2lubmluZyBvZiB0aGUgZmlsZSB3aGVyZSB0aGlzXG4gICAqICAgZGF0YSBzaG91bGQgYmUgd3JpdHRlbi4gSWYgcG9zaXRpb24gaXMgbnVsbCwgdGhlIGRhdGEgd2lsbCBiZSB3cml0dGVuIGF0XG4gICAqICAgdGhlIGN1cnJlbnQgcG9zaXRpb24uXG4gICAqIEByZXR1cm4gW051bWJlcl1cbiAgICovXG4gIHB1YmxpYyB3cml0ZVN5bmMoZmQ6IG51bWJlciwgYnVmZmVyOiBCdWZmZXIsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlciwgcG9zaXRpb24/OiBudW1iZXIpOiBudW1iZXI7XG4gIHB1YmxpYyB3cml0ZVN5bmMoZmQ6IG51bWJlciwgZGF0YTogc3RyaW5nLCBwb3NpdGlvbj86IG51bWJlciwgZW5jb2Rpbmc/OiBzdHJpbmcpOiBudW1iZXI7XG4gIHB1YmxpYyB3cml0ZVN5bmMoZmQ6IG51bWJlciwgYXJnMjogYW55LCBhcmczPzogYW55LCBhcmc0PzogYW55LCBhcmc1PzogYW55KTogbnVtYmVyIHtcbiAgICB2YXIgYnVmZmVyOiBCdWZmZXIsIG9mZnNldDogbnVtYmVyID0gMCwgbGVuZ3RoOiBudW1iZXIsIHBvc2l0aW9uOiBudW1iZXI7XG4gICAgaWYgKHR5cGVvZiBhcmcyID09PSAnc3RyaW5nJykge1xuICAgICAgLy8gU2lnbmF0dXJlIDE6IChmZCwgc3RyaW5nLCBbcG9zaXRpb24/LCBbZW5jb2Rpbmc/XV0pXG4gICAgICBwb3NpdGlvbiA9IHR5cGVvZiBhcmczID09PSAnbnVtYmVyJyA/IGFyZzMgOiBudWxsO1xuICAgICAgdmFyIGVuY29kaW5nID0gdHlwZW9mIGFyZzQgPT09ICdzdHJpbmcnID8gYXJnNCA6ICd1dGY4JztcbiAgICAgIG9mZnNldCA9IDA7XG4gICAgICBidWZmZXIgPSBuZXcgQnVmZmVyKGFyZzIsIGVuY29kaW5nKTtcbiAgICAgIGxlbmd0aCA9IGJ1ZmZlci5sZW5ndGg7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFNpZ25hdHVyZSAyOiAoZmQsIGJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgsIHBvc2l0aW9uPylcbiAgICAgIGJ1ZmZlciA9IGFyZzI7XG4gICAgICBvZmZzZXQgPSBhcmczO1xuICAgICAgbGVuZ3RoID0gYXJnNDtcbiAgICAgIHBvc2l0aW9uID0gdHlwZW9mIGFyZzUgPT09ICdudW1iZXInID8gYXJnNSA6IG51bGw7XG4gICAgfVxuXG4gICAgbGV0IGZpbGUgPSB0aGlzLmZkMmZpbGUoZmQpO1xuICAgIGlmIChwb3NpdGlvbiA9PSBudWxsKSB7XG4gICAgICBwb3NpdGlvbiA9IGZpbGUuZ2V0UG9zKCk7XG4gICAgfVxuICAgIHJldHVybiBmaWxlLndyaXRlU3luYyhidWZmZXIsIG9mZnNldCwgbGVuZ3RoLCBwb3NpdGlvbik7XG4gIH1cblxuICAvKipcbiAgICogUmVhZCBkYXRhIGZyb20gdGhlIGZpbGUgc3BlY2lmaWVkIGJ5IGBmZGAuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLm5vZGUuQnVmZmVyXSBidWZmZXIgVGhlIGJ1ZmZlciB0aGF0IHRoZSBkYXRhIHdpbGwgYmVcbiAgICogICB3cml0dGVuIHRvLlxuICAgKiBAcGFyYW0gW051bWJlcl0gb2Zmc2V0IFRoZSBvZmZzZXQgd2l0aGluIHRoZSBidWZmZXIgd2hlcmUgd3JpdGluZyB3aWxsXG4gICAqICAgc3RhcnQuXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBsZW5ndGggQW4gaW50ZWdlciBzcGVjaWZ5aW5nIHRoZSBudW1iZXIgb2YgYnl0ZXMgdG8gcmVhZC5cbiAgICogQHBhcmFtIFtOdW1iZXJdIHBvc2l0aW9uIEFuIGludGVnZXIgc3BlY2lmeWluZyB3aGVyZSB0byBiZWdpbiByZWFkaW5nIGZyb21cbiAgICogICBpbiB0aGUgZmlsZS4gSWYgcG9zaXRpb24gaXMgbnVsbCwgZGF0YSB3aWxsIGJlIHJlYWQgZnJvbSB0aGUgY3VycmVudCBmaWxlXG4gICAqICAgcG9zaXRpb24uXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yLCBOdW1iZXIsIEJyb3dzZXJGUy5ub2RlLkJ1ZmZlcildXG4gICAqICAgY2FsbGJhY2sgVGhlIG51bWJlciBpcyB0aGUgbnVtYmVyIG9mIGJ5dGVzIHJlYWRcbiAgICovXG4gIHB1YmxpYyByZWFkKGZkOiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLCBwb3NpdGlvbjogbnVtYmVyLCBlbmNvZGluZzogc3RyaW5nLCBjYj86IChlcnI6IEFwaUVycm9yLCBkYXRhPzogc3RyaW5nLCBieXRlc1JlYWQ/OiBudW1iZXIpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgcmVhZChmZDogbnVtYmVyLCBidWZmZXI6IEJ1ZmZlciwgb2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLCBwb3NpdGlvbjogbnVtYmVyLCBjYj86IChlcnI6IEFwaUVycm9yLCBieXRlc1JlYWQ/OiBudW1iZXIsIGJ1ZmZlcj86IEJ1ZmZlcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyByZWFkKGZkOiBudW1iZXIsIGFyZzI6IGFueSwgYXJnMzogYW55LCBhcmc0OiBhbnksIGFyZzU/OiBhbnksIGNiOiAoZXJyOiBBcGlFcnJvciwgYXJnMj86IGFueSwgYXJnMz86IGFueSkgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIHBvc2l0aW9uOiBudW1iZXIsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlciwgYnVmZmVyOiBCdWZmZXIsIG5ld0NiOiAoZXJyOiBBcGlFcnJvciwgYnl0ZXNSZWFkPzogbnVtYmVyLCBidWZmZXI/OiBCdWZmZXIpID0+IHZvaWQ7XG4gICAgaWYgKHR5cGVvZiBhcmcyID09PSAnbnVtYmVyJykge1xuICAgICAgLy8gbGVnYWN5IGludGVyZmFjZVxuICAgICAgLy8gKGZkLCBsZW5ndGgsIHBvc2l0aW9uLCBlbmNvZGluZywgY2FsbGJhY2spXG4gICAgICBsZW5ndGggPSBhcmcyO1xuICAgICAgcG9zaXRpb24gPSBhcmczO1xuICAgICAgdmFyIGVuY29kaW5nID0gYXJnNDtcbiAgICAgIGNiID0gdHlwZW9mIGFyZzUgPT09ICdmdW5jdGlvbicgPyBhcmc1IDogY2I7XG4gICAgICBvZmZzZXQgPSAwO1xuICAgICAgYnVmZmVyID0gbmV3IEJ1ZmZlcihsZW5ndGgpO1xuICAgICAgLy8gWFhYOiBJbmVmZmljaWVudC5cbiAgICAgIC8vIFdyYXAgdGhlIGNiIHNvIHdlIHNoZWx0ZXIgdXBwZXIgbGF5ZXJzIG9mIHRoZSBBUEkgZnJvbSB0aGVzZVxuICAgICAgLy8gc2hlbmFuaWdhbnMuXG4gICAgICBuZXdDYiA9IHdyYXBDYigoZnVuY3Rpb24oZXJyOiBhbnksIGJ5dGVzUmVhZDogbnVtYmVyLCBidWY6IEJ1ZmZlcikge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmV0dXJuIGNiKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgY2IoZXJyLCBidWYudG9TdHJpbmcoZW5jb2RpbmcpLCBieXRlc1JlYWQpO1xuICAgICAgfSksIDMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBidWZmZXIgPSBhcmcyO1xuICAgICAgb2Zmc2V0ID0gYXJnMztcbiAgICAgIGxlbmd0aCA9IGFyZzQ7XG4gICAgICBwb3NpdGlvbiA9IGFyZzU7XG4gICAgICBuZXdDYiA9IHdyYXBDYihjYiwgMyk7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGxldCBmaWxlID0gdGhpcy5mZDJmaWxlKGZkKTtcbiAgICAgIGlmIChwb3NpdGlvbiA9PSBudWxsKSB7XG4gICAgICAgIHBvc2l0aW9uID0gZmlsZS5nZXRQb3MoKTtcbiAgICAgIH1cbiAgICAgIGZpbGUucmVhZChidWZmZXIsIG9mZnNldCwgbGVuZ3RoLCBwb3NpdGlvbiwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWFkIGRhdGEgZnJvbSB0aGUgZmlsZSBzcGVjaWZpZWQgYnkgYGZkYC5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtCcm93c2VyRlMubm9kZS5CdWZmZXJdIGJ1ZmZlciBUaGUgYnVmZmVyIHRoYXQgdGhlIGRhdGEgd2lsbCBiZVxuICAgKiAgIHdyaXR0ZW4gdG8uXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBvZmZzZXQgVGhlIG9mZnNldCB3aXRoaW4gdGhlIGJ1ZmZlciB3aGVyZSB3cml0aW5nIHdpbGxcbiAgICogICBzdGFydC5cbiAgICogQHBhcmFtIFtOdW1iZXJdIGxlbmd0aCBBbiBpbnRlZ2VyIHNwZWNpZnlpbmcgdGhlIG51bWJlciBvZiBieXRlcyB0byByZWFkLlxuICAgKiBAcGFyYW0gW051bWJlcl0gcG9zaXRpb24gQW4gaW50ZWdlciBzcGVjaWZ5aW5nIHdoZXJlIHRvIGJlZ2luIHJlYWRpbmcgZnJvbVxuICAgKiAgIGluIHRoZSBmaWxlLiBJZiBwb3NpdGlvbiBpcyBudWxsLCBkYXRhIHdpbGwgYmUgcmVhZCBmcm9tIHRoZSBjdXJyZW50IGZpbGVcbiAgICogICBwb3NpdGlvbi5cbiAgICogQHJldHVybiBbTnVtYmVyXVxuICAgKi9cbiAgcHVibGljIHJlYWRTeW5jKGZkOiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLCBwb3NpdGlvbjogbnVtYmVyLCBlbmNvZGluZzogc3RyaW5nKTogc3RyaW5nO1xuICBwdWJsaWMgcmVhZFN5bmMoZmQ6IG51bWJlciwgYnVmZmVyOiBCdWZmZXIsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlciwgcG9zaXRpb246IG51bWJlcik6IG51bWJlcjtcbiAgcHVibGljIHJlYWRTeW5jKGZkOiBudW1iZXIsIGFyZzI6IGFueSwgYXJnMzogYW55LCBhcmc0OiBhbnksIGFyZzU/OiBhbnkpOiBhbnkge1xuICAgIHZhciBzaGVuYW5pZ2FucyA9IGZhbHNlO1xuICAgIHZhciBidWZmZXI6IEJ1ZmZlciwgb2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLCBwb3NpdGlvbjogbnVtYmVyO1xuICAgIGlmICh0eXBlb2YgYXJnMiA9PT0gJ251bWJlcicpIHtcbiAgICAgIGxlbmd0aCA9IGFyZzI7XG4gICAgICBwb3NpdGlvbiA9IGFyZzM7XG4gICAgICB2YXIgZW5jb2RpbmcgPSBhcmc0O1xuICAgICAgb2Zmc2V0ID0gMDtcbiAgICAgIGJ1ZmZlciA9IG5ldyBCdWZmZXIobGVuZ3RoKTtcbiAgICAgIHNoZW5hbmlnYW5zID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYnVmZmVyID0gYXJnMjtcbiAgICAgIG9mZnNldCA9IGFyZzM7XG4gICAgICBsZW5ndGggPSBhcmc0O1xuICAgICAgcG9zaXRpb24gPSBhcmc1O1xuICAgIH1cbiAgICBsZXQgZmlsZSA9IHRoaXMuZmQyZmlsZShmZCk7XG4gICAgaWYgKHBvc2l0aW9uID09IG51bGwpIHtcbiAgICAgIHBvc2l0aW9uID0gZmlsZS5nZXRQb3MoKTtcbiAgICB9XG5cbiAgICB2YXIgcnYgPSBmaWxlLnJlYWRTeW5jKGJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgsIHBvc2l0aW9uKTtcbiAgICBpZiAoIXNoZW5hbmlnYW5zKSB7XG4gICAgICByZXR1cm4gcnY7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBbYnVmZmVyLnRvU3RyaW5nKGVuY29kaW5nKSwgcnZdO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYGZjaG93bmAuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbTnVtYmVyXSB1aWRcbiAgICogQHBhcmFtIFtOdW1iZXJdIGdpZFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgZmNob3duKGZkOiBudW1iZXIsIHVpZDogbnVtYmVyLCBnaWQ6IG51bWJlciwgY2FsbGJhY2s6IChlPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYWxsYmFjaywgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuZmQyZmlsZShmZCkuY2hvd24odWlkLCBnaWQsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYGZjaG93bmAuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbTnVtYmVyXSB1aWRcbiAgICogQHBhcmFtIFtOdW1iZXJdIGdpZFxuICAgKi9cbiAgcHVibGljIGZjaG93blN5bmMoZmQ6IG51bWJlciwgdWlkOiBudW1iZXIsIGdpZDogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhpcy5mZDJmaWxlKGZkKS5jaG93blN5bmModWlkLCBnaWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgZmNobW9kYC5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtOdW1iZXJdIG1vZGVcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIGZjaG1vZChmZDogbnVtYmVyLCBtb2RlOiBzdHJpbmcgfCBudW1iZXIsIGNiPzogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBudW1Nb2RlID0gdHlwZW9mIG1vZGUgPT09ICdzdHJpbmcnID8gcGFyc2VJbnQobW9kZSwgOCkgOiBtb2RlO1xuICAgICAgdGhpcy5mZDJmaWxlKGZkKS5jaG1vZChudW1Nb2RlLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBmY2htb2RgLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW051bWJlcl0gbW9kZVxuICAgKi9cbiAgcHVibGljIGZjaG1vZFN5bmMoZmQ6IG51bWJlciwgbW9kZTogbnVtYmVyIHwgc3RyaW5nKTogdm9pZCB7XG4gICAgbGV0IG51bU1vZGUgPSB0eXBlb2YgbW9kZSA9PT0gJ3N0cmluZycgPyBwYXJzZUludChtb2RlLCA4KSA6IG1vZGU7XG4gICAgdGhpcy5mZDJmaWxlKGZkKS5jaG1vZFN5bmMobnVtTW9kZSk7XG4gIH1cblxuICAvKipcbiAgICogQ2hhbmdlIHRoZSBmaWxlIHRpbWVzdGFtcHMgb2YgYSBmaWxlIHJlZmVyZW5jZWQgYnkgdGhlIHN1cHBsaWVkIGZpbGVcbiAgICogZGVzY3JpcHRvci5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtEYXRlXSBhdGltZVxuICAgKiBAcGFyYW0gW0RhdGVdIG10aW1lXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBmdXRpbWVzKGZkOiBudW1iZXIsIGF0aW1lOiBudW1iZXIsIG10aW1lOiBudW1iZXIsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIGZ1dGltZXMoZmQ6IG51bWJlciwgYXRpbWU6IERhdGUsIG10aW1lOiBEYXRlLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyBmdXRpbWVzKGZkOiBudW1iZXIsIGF0aW1lOiBhbnksIG10aW1lOiBhbnksIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICBsZXQgZmlsZSA9IHRoaXMuZmQyZmlsZShmZCk7XG4gICAgICBpZiAodHlwZW9mIGF0aW1lID09PSAnbnVtYmVyJykge1xuICAgICAgICBhdGltZSA9IG5ldyBEYXRlKGF0aW1lICogMTAwMCk7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIG10aW1lID09PSAnbnVtYmVyJykge1xuICAgICAgICBtdGltZSA9IG5ldyBEYXRlKG10aW1lICogMTAwMCk7XG4gICAgICB9XG4gICAgICBmaWxlLnV0aW1lcyhhdGltZSwgbXRpbWUsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2hhbmdlIHRoZSBmaWxlIHRpbWVzdGFtcHMgb2YgYSBmaWxlIHJlZmVyZW5jZWQgYnkgdGhlIHN1cHBsaWVkIGZpbGVcbiAgICogZGVzY3JpcHRvci5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtEYXRlXSBhdGltZVxuICAgKiBAcGFyYW0gW0RhdGVdIG10aW1lXG4gICAqL1xuICBwdWJsaWMgZnV0aW1lc1N5bmMoZmQ6IG51bWJlciwgYXRpbWU6IG51bWJlciB8IERhdGUsIG10aW1lOiBudW1iZXIgfCBEYXRlKTogdm9pZCB7XG4gICAgdGhpcy5mZDJmaWxlKGZkKS51dGltZXNTeW5jKG5vcm1hbGl6ZVRpbWUoYXRpbWUpLCBub3JtYWxpemVUaW1lKG10aW1lKSk7XG4gIH1cblxuICAvLyBESVJFQ1RPUlktT05MWSBNRVRIT0RTXG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgcm1kaXJgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgcm1kaXIocGF0aDogc3RyaW5nLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG4gICAgICB0aGlzLnJvb3Qucm1kaXIocGF0aCwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgcm1kaXJgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKi9cbiAgcHVibGljIHJtZGlyU3luYyhwYXRoOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBwYXRoID0gbm9ybWFsaXplUGF0aChwYXRoKTtcbiAgICByZXR1cm4gdGhpcy5yb290LnJtZGlyU3luYyhwYXRoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYG1rZGlyYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtOdW1iZXI/XSBtb2RlIGRlZmF1bHRzIHRvIGAwNzc3YFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgbWtkaXIocGF0aDogc3RyaW5nLCBtb2RlPzogYW55LCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgaWYgKHR5cGVvZiBtb2RlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYiA9IG1vZGU7XG4gICAgICBtb2RlID0gMHgxZmY7XG4gICAgfVxuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgICAgdGhpcy5yb290Lm1rZGlyKHBhdGgsIG1vZGUsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYG1rZGlyYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtOdW1iZXI/XSBtb2RlIGRlZmF1bHRzIHRvIGAwNzc3YFxuICAgKi9cbiAgcHVibGljIG1rZGlyU3luYyhwYXRoOiBzdHJpbmcsIG1vZGU/OiBudW1iZXIgfCBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLnJvb3QubWtkaXJTeW5jKG5vcm1hbGl6ZVBhdGgocGF0aCksIG5vcm1hbGl6ZU1vZGUobW9kZSwgMHgxZmYpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYHJlYWRkaXJgLiBSZWFkcyB0aGUgY29udGVudHMgb2YgYSBkaXJlY3RvcnkuXG4gICAqIFRoZSBjYWxsYmFjayBnZXRzIHR3byBhcmd1bWVudHMgYChlcnIsIGZpbGVzKWAgd2hlcmUgYGZpbGVzYCBpcyBhbiBhcnJheSBvZlxuICAgKiB0aGUgbmFtZXMgb2YgdGhlIGZpbGVzIGluIHRoZSBkaXJlY3RvcnkgZXhjbHVkaW5nIGAnLidgIGFuZCBgJy4uJ2AuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yLCBTdHJpbmdbXSldIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgcmVhZGRpcihwYXRoOiBzdHJpbmcsIGNiOiAoZXJyOiBBcGlFcnJvciwgZmlsZXM/OiBzdHJpbmdbXSkgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gPChlcnI6IEFwaUVycm9yLCBmaWxlcz86IHN0cmluZ1tdKSA9PiB2b2lkPiB3cmFwQ2IoY2IsIDIpO1xuICAgIHRyeSB7XG4gICAgICBwYXRoID0gbm9ybWFsaXplUGF0aChwYXRoKTtcbiAgICAgIHRoaXMucm9vdC5yZWFkZGlyKHBhdGgsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYHJlYWRkaXJgLiBSZWFkcyB0aGUgY29udGVudHMgb2YgYSBkaXJlY3RvcnkuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEByZXR1cm4gW1N0cmluZ1tdXVxuICAgKi9cbiAgcHVibGljIHJlYWRkaXJTeW5jKHBhdGg6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICBwYXRoID0gbm9ybWFsaXplUGF0aChwYXRoKTtcbiAgICByZXR1cm4gdGhpcy5yb290LnJlYWRkaXJTeW5jKHBhdGgpO1xuICB9XG5cbiAgLy8gU1lNTElOSyBNRVRIT0RTXG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgbGlua2AuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBzcmNwYXRoXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBkc3RwYXRoXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBsaW5rKHNyY3BhdGg6IHN0cmluZywgZHN0cGF0aDogc3RyaW5nLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgc3JjcGF0aCA9IG5vcm1hbGl6ZVBhdGgoc3JjcGF0aCk7XG4gICAgICBkc3RwYXRoID0gbm9ybWFsaXplUGF0aChkc3RwYXRoKTtcbiAgICAgIHRoaXMucm9vdC5saW5rKHNyY3BhdGgsIGRzdHBhdGgsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYGxpbmtgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gc3JjcGF0aFxuICAgKiBAcGFyYW0gW1N0cmluZ10gZHN0cGF0aFxuICAgKi9cbiAgcHVibGljIGxpbmtTeW5jKHNyY3BhdGg6IHN0cmluZywgZHN0cGF0aDogc3RyaW5nKTogdm9pZCB7XG4gICAgc3JjcGF0aCA9IG5vcm1hbGl6ZVBhdGgoc3JjcGF0aCk7XG4gICAgZHN0cGF0aCA9IG5vcm1hbGl6ZVBhdGgoZHN0cGF0aCk7XG4gICAgcmV0dXJuIHRoaXMucm9vdC5saW5rU3luYyhzcmNwYXRoLCBkc3RwYXRoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYHN5bWxpbmtgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gc3JjcGF0aFxuICAgKiBAcGFyYW0gW1N0cmluZ10gZHN0cGF0aFxuICAgKiBAcGFyYW0gW1N0cmluZz9dIHR5cGUgY2FuIGJlIGVpdGhlciBgJ2RpcidgIG9yIGAnZmlsZSdgIChkZWZhdWx0IGlzIGAnZmlsZSdgKVxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgc3ltbGluayhzcmNwYXRoOiBzdHJpbmcsIGRzdHBhdGg6IHN0cmluZywgY2I/OiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHN5bWxpbmsoc3JjcGF0aDogc3RyaW5nLCBkc3RwYXRoOiBzdHJpbmcsIHR5cGU/OiBzdHJpbmcsIGNiPzogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyBzeW1saW5rKHNyY3BhdGg6IHN0cmluZywgZHN0cGF0aDogc3RyaW5nLCBhcmczPzogYW55LCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIHR5cGUgPSB0eXBlb2YgYXJnMyA9PT0gJ3N0cmluZycgPyBhcmczIDogJ2ZpbGUnO1xuICAgIGNiID0gdHlwZW9mIGFyZzMgPT09ICdmdW5jdGlvbicgPyBhcmczIDogY2I7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgaWYgKHR5cGUgIT09ICdmaWxlJyAmJiB0eXBlICE9PSAnZGlyJykge1xuICAgICAgICByZXR1cm4gbmV3Q2IobmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsIFwiSW52YWxpZCB0eXBlOiBcIiArIHR5cGUpKTtcbiAgICAgIH1cbiAgICAgIHNyY3BhdGggPSBub3JtYWxpemVQYXRoKHNyY3BhdGgpO1xuICAgICAgZHN0cGF0aCA9IG5vcm1hbGl6ZVBhdGgoZHN0cGF0aCk7XG4gICAgICB0aGlzLnJvb3Quc3ltbGluayhzcmNwYXRoLCBkc3RwYXRoLCB0eXBlLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBzeW1saW5rYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHNyY3BhdGhcbiAgICogQHBhcmFtIFtTdHJpbmddIGRzdHBhdGhcbiAgICogQHBhcmFtIFtTdHJpbmc/XSB0eXBlIGNhbiBiZSBlaXRoZXIgYCdkaXInYCBvciBgJ2ZpbGUnYCAoZGVmYXVsdCBpcyBgJ2ZpbGUnYClcbiAgICovXG4gIHB1YmxpYyBzeW1saW5rU3luYyhzcmNwYXRoOiBzdHJpbmcsIGRzdHBhdGg6IHN0cmluZywgdHlwZT86IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICh0eXBlID09IG51bGwpIHtcbiAgICAgIHR5cGUgPSAnZmlsZSc7XG4gICAgfSBlbHNlIGlmICh0eXBlICE9PSAnZmlsZScgJiYgdHlwZSAhPT0gJ2RpcicpIHtcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCBcIkludmFsaWQgdHlwZTogXCIgKyB0eXBlKTtcbiAgICB9XG4gICAgc3JjcGF0aCA9IG5vcm1hbGl6ZVBhdGgoc3JjcGF0aCk7XG4gICAgZHN0cGF0aCA9IG5vcm1hbGl6ZVBhdGgoZHN0cGF0aCk7XG4gICAgcmV0dXJuIHRoaXMucm9vdC5zeW1saW5rU3luYyhzcmNwYXRoLCBkc3RwYXRoLCB0eXBlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgcmVhZGxpbmsuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yLCBTdHJpbmcpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHJlYWRsaW5rKHBhdGg6IHN0cmluZywgY2I6IChlcnI6IEFwaUVycm9yLCBsaW5rU3RyaW5nPzogc3RyaW5nKSA9PiBhbnkgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMik7XG4gICAgdHJ5IHtcbiAgICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgICAgdGhpcy5yb290LnJlYWRsaW5rKHBhdGgsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgcmVhZGxpbmsuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEByZXR1cm4gW1N0cmluZ11cbiAgICovXG4gIHB1YmxpYyByZWFkbGlua1N5bmMocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBwYXRoID0gbm9ybWFsaXplUGF0aChwYXRoKTtcbiAgICByZXR1cm4gdGhpcy5yb290LnJlYWRsaW5rU3luYyhwYXRoKTtcbiAgfVxuXG4gIC8vIFBST1BFUlRZIE9QRVJBVElPTlNcblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBjaG93bmAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbTnVtYmVyXSB1aWRcbiAgICogQHBhcmFtIFtOdW1iZXJdIGdpZFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgY2hvd24ocGF0aDogc3RyaW5nLCB1aWQ6IG51bWJlciwgZ2lkOiBudW1iZXIsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICBwYXRoID0gbm9ybWFsaXplUGF0aChwYXRoKTtcbiAgICAgIHRoaXMucm9vdC5jaG93bihwYXRoLCBmYWxzZSwgdWlkLCBnaWQsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYGNob3duYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtOdW1iZXJdIHVpZFxuICAgKiBAcGFyYW0gW051bWJlcl0gZ2lkXG4gICAqL1xuICBwdWJsaWMgY2hvd25TeW5jKHBhdGg6IHN0cmluZywgdWlkOiBudW1iZXIsIGdpZDogbnVtYmVyKTogdm9pZCB7XG4gICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG4gICAgdGhpcy5yb290LmNob3duU3luYyhwYXRoLCBmYWxzZSwgdWlkLCBnaWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgbGNob3duYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtOdW1iZXJdIHVpZFxuICAgKiBAcGFyYW0gW051bWJlcl0gZ2lkXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBsY2hvd24ocGF0aDogc3RyaW5nLCB1aWQ6IG51bWJlciwgZ2lkOiBudW1iZXIsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICBwYXRoID0gbm9ybWFsaXplUGF0aChwYXRoKTtcbiAgICAgIHRoaXMucm9vdC5jaG93bihwYXRoLCB0cnVlLCB1aWQsIGdpZCwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgbGNob3duYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtOdW1iZXJdIHVpZFxuICAgKiBAcGFyYW0gW051bWJlcl0gZ2lkXG4gICAqL1xuICBwdWJsaWMgbGNob3duU3luYyhwYXRoOiBzdHJpbmcsIHVpZDogbnVtYmVyLCBnaWQ6IG51bWJlcik6IHZvaWQge1xuICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgIHRoaXMucm9vdC5jaG93blN5bmMocGF0aCwgdHJ1ZSwgdWlkLCBnaWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgY2htb2RgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW051bWJlcl0gbW9kZVxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgY2htb2QocGF0aDogc3RyaW5nLCBtb2RlOiBudW1iZXIgfCBzdHJpbmcsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICBsZXQgbnVtTW9kZSA9IG5vcm1hbGl6ZU1vZGUobW9kZSwgLTEpO1xuICAgICAgaWYgKG51bU1vZGUgPCAwKSB7XG4gICAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCBgSW52YWxpZCBtb2RlLmApO1xuICAgICAgfVxuICAgICAgdGhpcy5yb290LmNobW9kKG5vcm1hbGl6ZVBhdGgocGF0aCksIGZhbHNlLCBudW1Nb2RlLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBjaG1vZGAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBtb2RlXG4gICAqL1xuICBwdWJsaWMgY2htb2RTeW5jKHBhdGg6IHN0cmluZywgbW9kZTogc3RyaW5nfG51bWJlcik6IHZvaWQge1xuICAgIGxldCBudW1Nb2RlID0gbm9ybWFsaXplTW9kZShtb2RlLCAtMSk7XG4gICAgaWYgKG51bU1vZGUgPCAwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgYEludmFsaWQgbW9kZS5gKTtcbiAgICB9XG4gICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG4gICAgdGhpcy5yb290LmNobW9kU3luYyhwYXRoLCBmYWxzZSwgbnVtTW9kZSk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBsY2htb2RgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW051bWJlcl0gbW9kZVxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgbGNobW9kKHBhdGg6IHN0cmluZywgbW9kZTogbnVtYmVyfHN0cmluZywgY2I6IEZ1bmN0aW9uID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICBsZXQgbnVtTW9kZSA9IG5vcm1hbGl6ZU1vZGUobW9kZSwgLTEpO1xuICAgICAgaWYgKG51bU1vZGUgPCAwKSB7XG4gICAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCBgSW52YWxpZCBtb2RlLmApO1xuICAgICAgfVxuICAgICAgdGhpcy5yb290LmNobW9kKG5vcm1hbGl6ZVBhdGgocGF0aCksIHRydWUsIG51bU1vZGUsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYGxjaG1vZGAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBtb2RlXG4gICAqL1xuICBwdWJsaWMgbGNobW9kU3luYyhwYXRoOiBzdHJpbmcsIG1vZGU6IG51bWJlcnxzdHJpbmcpOiB2b2lkIHtcbiAgICBsZXQgbnVtTW9kZSA9IG5vcm1hbGl6ZU1vZGUobW9kZSwgLTEpO1xuICAgIGlmIChudW1Nb2RlIDwgMSkge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsIGBJbnZhbGlkIG1vZGUuYCk7XG4gICAgfVxuICAgIHRoaXMucm9vdC5jaG1vZFN5bmMobm9ybWFsaXplUGF0aChwYXRoKSwgdHJ1ZSwgbnVtTW9kZSk7XG4gIH1cblxuICAvKipcbiAgICogQ2hhbmdlIGZpbGUgdGltZXN0YW1wcyBvZiB0aGUgZmlsZSByZWZlcmVuY2VkIGJ5IHRoZSBzdXBwbGllZCBwYXRoLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW0RhdGVdIGF0aW1lXG4gICAqIEBwYXJhbSBbRGF0ZV0gbXRpbWVcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHV0aW1lcyhwYXRoOiBzdHJpbmcsIGF0aW1lOiBudW1iZXJ8RGF0ZSwgbXRpbWU6IG51bWJlcnxEYXRlLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgdGhpcy5yb290LnV0aW1lcyhub3JtYWxpemVQYXRoKHBhdGgpLCBub3JtYWxpemVUaW1lKGF0aW1lKSwgbm9ybWFsaXplVGltZShtdGltZSksIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2hhbmdlIGZpbGUgdGltZXN0YW1wcyBvZiB0aGUgZmlsZSByZWZlcmVuY2VkIGJ5IHRoZSBzdXBwbGllZCBwYXRoLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW0RhdGVdIGF0aW1lXG4gICAqIEBwYXJhbSBbRGF0ZV0gbXRpbWVcbiAgICovXG4gIHB1YmxpYyB1dGltZXNTeW5jKHBhdGg6IHN0cmluZywgYXRpbWU6IG51bWJlcnxEYXRlLCBtdGltZTogbnVtYmVyfERhdGUpOiB2b2lkIHtcbiAgICB0aGlzLnJvb3QudXRpbWVzU3luYyhub3JtYWxpemVQYXRoKHBhdGgpLCBub3JtYWxpemVUaW1lKGF0aW1lKSwgbm9ybWFsaXplVGltZShtdGltZSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgcmVhbHBhdGhgLiBUaGUgY2FsbGJhY2sgZ2V0cyB0d28gYXJndW1lbnRzXG4gICAqIGAoZXJyLCByZXNvbHZlZFBhdGgpYC4gTWF5IHVzZSBgcHJvY2Vzcy5jd2RgIHRvIHJlc29sdmUgcmVsYXRpdmUgcGF0aHMuXG4gICAqXG4gICAqIEBleGFtcGxlIFVzYWdlIGV4YW1wbGVcbiAgICogICB2YXIgY2FjaGUgPSB7Jy9ldGMnOicvcHJpdmF0ZS9ldGMnfTtcbiAgICogICBmcy5yZWFscGF0aCgnL2V0Yy9wYXNzd2QnLCBjYWNoZSwgZnVuY3Rpb24gKGVyciwgcmVzb2x2ZWRQYXRoKSB7XG4gICAqICAgICBpZiAoZXJyKSB0aHJvdyBlcnI7XG4gICAqICAgICBjb25zb2xlLmxvZyhyZXNvbHZlZFBhdGgpO1xuICAgKiAgIH0pO1xuICAgKlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW09iamVjdD9dIGNhY2hlIEFuIG9iamVjdCBsaXRlcmFsIG9mIG1hcHBlZCBwYXRocyB0aGF0IGNhbiBiZSB1c2VkIHRvXG4gICAqICAgZm9yY2UgYSBzcGVjaWZpYyBwYXRoIHJlc29sdXRpb24gb3IgYXZvaWQgYWRkaXRpb25hbCBgZnMuc3RhdGAgY2FsbHMgZm9yXG4gICAqICAga25vd24gcmVhbCBwYXRocy5cbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IsIFN0cmluZyldIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgcmVhbHBhdGgocGF0aDogc3RyaW5nLCBjYj86IChlcnI6IEFwaUVycm9yLCByZXNvbHZlZFBhdGg/OiBzdHJpbmcpID0+YW55KTogdm9pZDtcbiAgcHVibGljIHJlYWxwYXRoKHBhdGg6IHN0cmluZywgY2FjaGU6IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSwgY2I6IChlcnI6IEFwaUVycm9yLCByZXNvbHZlZFBhdGg/OiBzdHJpbmcpID0+YW55KTogdm9pZDtcbiAgcHVibGljIHJlYWxwYXRoKHBhdGg6IHN0cmluZywgYXJnMj86IGFueSwgY2I6IChlcnI6IEFwaUVycm9yLCByZXNvbHZlZFBhdGg/OiBzdHJpbmcpID0+IGFueSA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIGNhY2hlID0gdHlwZW9mIGFyZzIgPT09ICdvYmplY3QnID8gYXJnMiA6IHt9O1xuICAgIGNiID0gdHlwZW9mIGFyZzIgPT09ICdmdW5jdGlvbicgPyBhcmcyIDogbm9wQ2I7XG4gICAgdmFyIG5ld0NiID0gPChlcnI6IEFwaUVycm9yLCByZXNvbHZlZFBhdGg/OiBzdHJpbmcpID0+YW55PiB3cmFwQ2IoY2IsIDIpO1xuICAgIHRyeSB7XG4gICAgICBwYXRoID0gbm9ybWFsaXplUGF0aChwYXRoKTtcbiAgICAgIHRoaXMucm9vdC5yZWFscGF0aChwYXRoLCBjYWNoZSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgcmVhbHBhdGhgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW09iamVjdD9dIGNhY2hlIEFuIG9iamVjdCBsaXRlcmFsIG9mIG1hcHBlZCBwYXRocyB0aGF0IGNhbiBiZSB1c2VkIHRvXG4gICAqICAgZm9yY2UgYSBzcGVjaWZpYyBwYXRoIHJlc29sdXRpb24gb3IgYXZvaWQgYWRkaXRpb25hbCBgZnMuc3RhdGAgY2FsbHMgZm9yXG4gICAqICAga25vd24gcmVhbCBwYXRocy5cbiAgICogQHJldHVybiBbU3RyaW5nXVxuICAgKi9cbiAgcHVibGljIHJlYWxwYXRoU3luYyhwYXRoOiBzdHJpbmcsIGNhY2hlOiB7W3BhdGg6IHN0cmluZ106IHN0cmluZ30gPSB7fSk6IHN0cmluZyB7XG4gICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG4gICAgcmV0dXJuIHRoaXMucm9vdC5yZWFscGF0aFN5bmMocGF0aCwgY2FjaGUpO1xuICB9XG5cbiAgcHVibGljIHdhdGNoRmlsZShmaWxlbmFtZTogc3RyaW5nLCBsaXN0ZW5lcjogKGN1cnI6IFN0YXRzLCBwcmV2OiBTdGF0cykgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyB3YXRjaEZpbGUoZmlsZW5hbWU6IHN0cmluZywgb3B0aW9uczogeyBwZXJzaXN0ZW50PzogYm9vbGVhbjsgaW50ZXJ2YWw/OiBudW1iZXI7IH0sIGxpc3RlbmVyOiAoY3VycjogU3RhdHMsIHByZXY6IFN0YXRzKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHdhdGNoRmlsZShmaWxlbmFtZTogc3RyaW5nLCBhcmcyOiBhbnksIGxpc3RlbmVyOiAoY3VycjogU3RhdHMsIHByZXY6IFN0YXRzKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xuICB9XG5cbiAgcHVibGljIHVud2F0Y2hGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGxpc3RlbmVyOiAoY3VycjogU3RhdHMsIHByZXY6IFN0YXRzKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xuICB9XG5cbiAgcHVibGljIHdhdGNoKGZpbGVuYW1lOiBzdHJpbmcsIGxpc3RlbmVyPzogKGV2ZW50OiBzdHJpbmcsIGZpbGVuYW1lOiBzdHJpbmcpID0+IGFueSk6IF9mcy5GU1dhdGNoZXI7XG4gIHB1YmxpYyB3YXRjaChmaWxlbmFtZTogc3RyaW5nLCBvcHRpb25zOiB7IHBlcnNpc3RlbnQ/OiBib29sZWFuOyB9LCBsaXN0ZW5lcj86IChldmVudDogc3RyaW5nLCBmaWxlbmFtZTogc3RyaW5nKSA9PiBhbnkpOiBfZnMuRlNXYXRjaGVyO1xuICBwdWJsaWMgd2F0Y2goZmlsZW5hbWU6IHN0cmluZywgYXJnMjogYW55LCBsaXN0ZW5lcjogKGV2ZW50OiBzdHJpbmcsIGZpbGVuYW1lOiBzdHJpbmcpID0+IGFueSA9IG5vcENiKTogX2ZzLkZTV2F0Y2hlciB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxuXG4gIHB1YmxpYyBGX09LOiBudW1iZXIgPSAwO1xuICBwdWJsaWMgUl9PSzogbnVtYmVyID0gNDtcbiAgcHVibGljIFdfT0s6IG51bWJlciA9IDI7XG4gIHB1YmxpYyBYX09LOiBudW1iZXIgPSAxO1xuXG4gIHB1YmxpYyBhY2Nlc3MocGF0aDogc3RyaW5nLCBjYWxsYmFjazogKGVycjogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgYWNjZXNzKHBhdGg6IHN0cmluZywgbW9kZTogbnVtYmVyLCBjYWxsYmFjazogKGVycjogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgYWNjZXNzKHBhdGg6IHN0cmluZywgYXJnMjogYW55LCBjYjogKGU6IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xuICB9XG5cbiAgcHVibGljIGFjY2Vzc1N5bmMocGF0aDogc3RyaW5nLCBtb2RlPzogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVSZWFkU3RyZWFtKHBhdGg6IHN0cmluZywgb3B0aW9ucz86IHtcbiAgICAgICAgZmxhZ3M/OiBzdHJpbmc7XG4gICAgICAgIGVuY29kaW5nPzogc3RyaW5nO1xuICAgICAgICBmZD86IG51bWJlcjtcbiAgICAgICAgbW9kZT86IG51bWJlcjtcbiAgICAgICAgYXV0b0Nsb3NlPzogYm9vbGVhbjtcbiAgICB9KTogX2ZzLlJlYWRTdHJlYW0ge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCk7XG4gIH1cblxuICBwdWJsaWMgY3JlYXRlV3JpdGVTdHJlYW0ocGF0aDogc3RyaW5nLCBvcHRpb25zPzoge1xuICAgICAgICBmbGFncz86IHN0cmluZztcbiAgICAgICAgZW5jb2Rpbmc/OiBzdHJpbmc7XG4gICAgICAgIGZkPzogbnVtYmVyO1xuICAgICAgICBtb2RlPzogbnVtYmVyO1xuICAgIH0pOiBfZnMuV3JpdGVTdHJlYW0ge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCk7XG4gIH1cblxuICBwdWJsaWMgX3dyYXBDYjogKGNiOiBGdW5jdGlvbiwgYXJnczogbnVtYmVyKSA9PiBGdW5jdGlvbiA9IHdyYXBDYjtcbn1cblxuLy8gVHlwZSBjaGVja2luZy5cbnZhciBfOiB0eXBlb2YgX2ZzID0gbmV3IEZTKCk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRlNNb2R1bGUgZXh0ZW5kcyBGUyB7XG4gIC8qKlxuICAgKiBSZXRyaWV2ZSB0aGUgRlMgb2JqZWN0IGJhY2tpbmcgdGhlIGZzIG1vZHVsZS5cbiAgICovXG4gIGdldEZTTW9kdWxlKCk6IEZTO1xuICAvKipcbiAgICogU2V0IHRoZSBGUyBvYmplY3QgYmFja2luZyB0aGUgZnMgbW9kdWxlLlxuICAgKi9cbiAgY2hhbmdlRlNNb2R1bGUobmV3RnM6IEZTKTogdm9pZDtcbiAgLyoqXG4gICAqIFRoZSBGUyBjb25zdHJ1Y3Rvci5cbiAgICovXG4gIEZTOiB0eXBlb2YgRlM7XG59XG4iXX0=