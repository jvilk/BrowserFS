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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRlMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29yZS9GUy50cyJdLCJuYW1lcyI6WyJ3cmFwQ2IiLCJub3JtYWxpemVNb2RlIiwibm9ybWFsaXplVGltZSIsIm5vcm1hbGl6ZVBhdGgiLCJub3JtYWxpemVPcHRpb25zIiwibm9wQ2IiLCJGUyIsIkZTLmNvbnN0cnVjdG9yIiwiRlMuZ2V0RmRGb3JGaWxlIiwiRlMuZmQyZmlsZSIsIkZTLmNsb3NlRmQiLCJGUy5pbml0aWFsaXplIiwiRlMuX3RvVW5peFRpbWVzdGFtcCIsIkZTLmdldFJvb3RGUyIsIkZTLnJlbmFtZSIsIkZTLnJlbmFtZVN5bmMiLCJGUy5leGlzdHMiLCJGUy5leGlzdHNTeW5jIiwiRlMuc3RhdCIsIkZTLnN0YXRTeW5jIiwiRlMubHN0YXQiLCJGUy5sc3RhdFN5bmMiLCJGUy50cnVuY2F0ZSIsIkZTLnRydW5jYXRlU3luYyIsIkZTLnVubGluayIsIkZTLnVubGlua1N5bmMiLCJGUy5vcGVuIiwiRlMub3BlblN5bmMiLCJGUy5yZWFkRmlsZSIsIkZTLnJlYWRGaWxlU3luYyIsIkZTLndyaXRlRmlsZSIsIkZTLndyaXRlRmlsZVN5bmMiLCJGUy5hcHBlbmRGaWxlIiwiRlMuYXBwZW5kRmlsZVN5bmMiLCJGUy5mc3RhdCIsIkZTLmZzdGF0U3luYyIsIkZTLmNsb3NlIiwiRlMuY2xvc2VTeW5jIiwiRlMuZnRydW5jYXRlIiwiRlMuZnRydW5jYXRlU3luYyIsIkZTLmZzeW5jIiwiRlMuZnN5bmNTeW5jIiwiRlMuZmRhdGFzeW5jIiwiRlMuZmRhdGFzeW5jU3luYyIsIkZTLndyaXRlIiwiRlMud3JpdGVTeW5jIiwiRlMucmVhZCIsIkZTLnJlYWRTeW5jIiwiRlMuZmNob3duIiwiRlMuZmNob3duU3luYyIsIkZTLmZjaG1vZCIsIkZTLmZjaG1vZFN5bmMiLCJGUy5mdXRpbWVzIiwiRlMuZnV0aW1lc1N5bmMiLCJGUy5ybWRpciIsIkZTLnJtZGlyU3luYyIsIkZTLm1rZGlyIiwiRlMubWtkaXJTeW5jIiwiRlMucmVhZGRpciIsIkZTLnJlYWRkaXJTeW5jIiwiRlMubGluayIsIkZTLmxpbmtTeW5jIiwiRlMuc3ltbGluayIsIkZTLnN5bWxpbmtTeW5jIiwiRlMucmVhZGxpbmsiLCJGUy5yZWFkbGlua1N5bmMiLCJGUy5jaG93biIsIkZTLmNob3duU3luYyIsIkZTLmxjaG93biIsIkZTLmxjaG93blN5bmMiLCJGUy5jaG1vZCIsIkZTLmNobW9kU3luYyIsIkZTLmxjaG1vZCIsIkZTLmxjaG1vZFN5bmMiLCJGUy51dGltZXMiLCJGUy51dGltZXNTeW5jIiwiRlMucmVhbHBhdGgiLCJGUy5yZWFscGF0aFN5bmMiLCJGUy53YXRjaEZpbGUiLCJGUy51bndhdGNoRmlsZSIsIkZTLndhdGNoIiwiRlMuYWNjZXNzIiwiRlMuYWNjZXNzU3luYyIsIkZTLmNyZWF0ZVJlYWRTdHJlYW0iLCJGUy5jcmVhdGVXcml0ZVN0cmVhbSJdLCJtYXBwaW5ncyI6IkFBQ0EsMEJBQWtDLGFBQWEsQ0FBQyxDQUFBO0FBRWhELDBCQUF1QixhQUFhLENBQUMsQ0FBQTtBQUNyQyxJQUFPLElBQUksV0FBVyxNQUFNLENBQUMsQ0FBQztBQUM5Qiw4QkFBa0IsaUJBQWlCLENBQUMsQ0FBQTtBQWFwQyxnQkFBb0MsRUFBSyxFQUFFLE9BQWU7SUFDeERBLEVBQUVBLENBQUNBLENBQUNBLE9BQU9BLEVBQUVBLEtBQUtBLFVBQVVBLENBQUNBLENBQUNBLENBQUNBO1FBQzdCQSxNQUFNQSxJQUFJQSxvQkFBUUEsQ0FBQ0EscUJBQVNBLENBQUNBLE1BQU1BLEVBQUVBLDhCQUE4QkEsQ0FBQ0EsQ0FBQ0E7SUFDdkVBLENBQUNBO0lBR0RBLEVBQUVBLENBQUNBLENBQUNBLE9BQU9BLFlBQVlBLEtBQUtBLFdBQVdBLENBQUNBLENBQUNBLENBQUNBO1FBQ3hDQSxZQUFZQSxHQUFHQSxDQUFDQSxDQUFDQTtJQUNuQkEsQ0FBQ0E7SUFDREEsWUFBWUEsRUFBRUEsQ0FBQ0E7SUFHZkEsTUFBTUEsQ0FBQ0EsQ0FBQ0EsT0FB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Q0FBQ0EsQ0FBQ0EsQ0FBQ0E7Z0JBQzlCQSxLQUFLQSxHQUFHQSxJQUFJQSxJQUFJQSxDQUFDQSxLQUFLQSxHQUFHQSxJQUFJQSxDQUFDQSxDQUFDQTtZQUNqQ0EsQ0FBQ0E7WUFDREEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsT0FBT0EsS0FBS0EsS0FBS0EsUUFBUUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7Z0JBQzlCQSxLQUFLQSxHQUFHQSxJQUFJQSxJQUFJQSxDQUFDQSxLQUFLQSxHQUFHQSxJQUFJQSxDQUFDQSxDQUFDQTtZQUNqQ0EsQ0FBQ0E7WUFDREEsSUFBSUEsQ0FBQ0EsTUFBTUEsQ0FBQ0EsS0FBS0EsRUFBRUEsS0FBS0EsRUFBRUEsS0FBS0EsQ0FBQ0EsQ0FBQ0E7UUFDbkNBLENBQUVBO1FBQUFBLEtBQUtBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1lBQ1hBLEtBQUtBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1FBQ1hBLENBQUNBO0lBQ0hBLENBQUNBO0lBU005Qyx3QkFBV0EsR0FBbEJBLFVBQW1CQSxFQUFVQSxFQUFFQSxLQUFvQkEsRUFBRUEsS0FBb0JBO1FBQ3ZFK0MsSUFBSUEsQ0FBQ0EsT0FBT0EsQ0FBQ0EsRUFBRUEsQ0FBQ0EsQ0FBQ0EsVUFBVUEsQ0FBQ0EsYUFBYUEsQ0FBQ0EsS0FBS0EsQ0FBQ0EsRUFBRUEsYUFBYUEsQ0FBQ0EsS0FBS0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7SUFDMUVBLENBQUNBO0lBU00vQyxrQkFBS0EsR0FBWkEsVUFBYUEsSUFBWUEsRUFBRUEsRUFBa0NBO1FBQWxDZ0Qsa0JBQWtDQSxHQUFsQ0EsVUFBa0NBO1FBQzNEQSxJQUFJQSxLQUFLQSxHQUFHQSxNQUFNQSxDQUFDQSxFQUFFQSxFQUFFQSxDQUFDQSxDQUFDQSxDQUFDQTtRQUMxQkEsSUFBSUEsQ0FBQ0E7WUFDSEEsSUFBSUEsR0FBR0EsYUFBYUEsQ0FBQ0EsSUFBSUEsQ0FBQ0EsQ0FBQ0E7WUFDM0JBLElBQUlBLENBQUNBLElBQUlBLENBQUNBLEtBQUtBLENBQUNBLElBQUlBLEVB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Q0FBQ0EsYUFBYUEsQ0FBQ0EsSUFBSUEsQ0FBQ0EsRUFBRUEsSUFBSUEsRUFBRUEsT0FBT0EsRUFBRUEsS0FBS0EsQ0FBQ0EsQ0FBQ0E7UUFDN0RBLENBQUVBO1FBQUFBLEtBQUtBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1lBQ1hBLEtBQUtBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1FBQ1hBLENBQUNBO0lBQ0hBLENBQUNBO0lBT01sRSx1QkFBVUEsR0FBakJBLFVBQWtCQSxJQUFZQSxFQUFFQSxJQUFtQkE7UUFDakRtRSxJQUFJQSxPQUFPQSxHQUFHQSxhQUFhQSxDQUFDQSxJQUFJQSxFQUFFQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQTtRQUN0Q0EsRUFBRUEsQ0FBQ0EsQ0FBQ0EsT0FBT0EsR0FBR0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFDaEJBLE1BQU1BLElBQUlBLG9CQUFRQSxDQUFDQSxxQkFBU0EsQ0FBQ0EsTUFBTUEsRUFBRUEsZUFBZUEsQ0FBQ0EsQ0FBQ0E7UUFDeERBLENBQUNBO1FBQ0RBLElBQUlBLENBQUNBLElBQUlBLENBQUNBLFNBQVNBLENBQUNBLGFBQWFBLENBQUNBLElBQUlBLENBQUNBLEVBQUVBLElBQUlBLEVBQUVBLE9BQU9BLENBQUNBLENBQUNBO0lBQzFEQSxDQUFDQTtJQVNNbkUsbUJBQU1BLEdBQWJBLFVBQWNBLElBQVlBLEVBQUVBLEtBQWtCQSxFQUFFQSxLQUFrQkEsRUFBRUEsRUFBa0NBO1FBQWxDb0Usa0JBQWtDQSxHQUFsQ0EsVUFBa0NBO1FBQ3BHQSxJQUFJQSxLQUFLQSxHQUFHQSxNQUFNQSxDQUFDQSxFQUFFQSxFQUFFQSxDQUFDQSxDQUFDQSxDQUFDQTtRQUMxQkEsSUFBSUEsQ0FBQ0E7WUFDSEEsSUFBSUEsQ0FBQ0EsSUFBSUEsQ0FBQ0EsTUFBTUEsQ0FBQ0EsYUFBYUEsQ0FBQ0EsSUFBSUEsQ0FBQ0EsRUFBRUEsYUFBYUEsQ0FBQ0EsS0FBS0EsQ0FBQ0EsRUFBRUEsYUFBYUEsQ0FBQ0EsS0FBS0EsQ0FBQ0EsRUFB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Q3hDQSxDQUFDQTtJQUVNM0UsdUJBQVVBLEdBQWpCQSxVQUFrQkEsSUFBWUEsRUFBRUEsSUFBYUE7UUFDM0M0RSxNQUFNQSxJQUFJQSxvQkFBUUEsQ0FBQ0EscUJBQVNBLENBQUNBLE9BQU9BLENBQUNBLENBQUNBO0lBQ3hDQSxDQUFDQTtJQUVNNUUsNkJBQWdCQSxHQUF2QkEsVUFBd0JBLElBQVlBLEVBQUVBLE9BTW5DQTtRQUNENkUsTUFBTUEsSUFBSUEsb0JBQVFBLENBQUNBLHFCQUFTQSxDQUFDQSxPQUFPQSxDQUFDQSxDQUFDQTtJQUN4Q0EsQ0FBQ0E7SUFFTTdFLDhCQUFpQkEsR0FBeEJBLFVBQXlCQSxJQUFZQSxFQUFFQSxPQUtwQ0E7UUFDRDhFLE1BQU1BLElBQUlBLG9CQUFRQSxDQUFDQSxxQkFBU0EsQ0FBQ0EsT0FBT0EsQ0FBQ0EsQ0FBQ0E7SUFDeENBLENBQUNBO0lBanlDYTlFLFFBQUtBLEdBQUdBLDBCQUFLQSxDQUFDQTtJQWt5QzlCQSxTQUFDQTtBQUFEQSxDQUFDQSxBQXB5Q0QsSUFveUNDO0FBcHlDRDt1QkFveUNDLENBQUE7QUFHRCxJQUFJLENBQUMsR0FBZSxJQUFJLEVBQUUsRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtGaWxlfSBmcm9tICcuL2ZpbGUnO1xuaW1wb3J0IHtBcGlFcnJvciwgRXJyb3JDb2RlfSBmcm9tICcuL2FwaV9lcnJvcic7XG5pbXBvcnQgZmlsZV9zeXN0ZW0gPSByZXF1aXJlKCcuL2ZpbGVfc3lzdGVtJyk7XG5pbXBvcnQge0ZpbGVGbGFnfSBmcm9tICcuL2ZpbGVfZmxhZyc7XG5pbXBvcnQgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKTtcbmltcG9ydCBTdGF0cyBmcm9tICcuL25vZGVfZnNfc3RhdHMnO1xuLy8gVHlwaW5nIGluZm8gb25seS5cbmltcG9ydCBfZnMgPSByZXF1aXJlKCdmcycpO1xuXG5kZWNsYXJlIHZhciBfX251bVdhaXRpbmc6IG51bWJlcjtcbmRlY2xhcmUgdmFyIHNldEltbWVkaWF0ZTogKGNiOiBGdW5jdGlvbikgPT4gdm9pZDtcblxuLyoqXG4gKiBXcmFwcyBhIGNhbGxiYWNrIHdpdGggYSBzZXRJbW1lZGlhdGUgY2FsbC5cbiAqIEBwYXJhbSBbRnVuY3Rpb25dIGNiIFRoZSBjYWxsYmFjayB0byB3cmFwLlxuICogQHBhcmFtIFtOdW1iZXJdIG51bUFyZ3MgVGhlIG51bWJlciBvZiBhcmd1bWVudHMgdGhhdCB0aGUgY2FsbGJhY2sgdGFrZXMuXG4gKiBAcmV0dXJuIFtGdW5jdGlvbl0gVGhlIHdyYXBwZWQgY2FsbGJhY2suXG4gKi9cbmZ1bmN0aW9uIHdyYXBDYjxUIGV4dGVuZHMgRnVuY3Rpb24+KGNiOiBULCBudW1BcmdzOiBudW1iZXIpOiBUIHtcbiAgaWYgKHR5cGVvZiBjYiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnQ2FsbGJhY2sgbXVzdCBiZSBhIGZ1bmN0aW9uLicpO1xuICB9XG4gIC8vIEB0b2RvIFRoaXMgaXMgdXNlZCBmb3IgdW5pdCB0ZXN0aW5nLiBNYXliZSB3ZSBzaG91bGQgaW5qZWN0IHRoaXMgbG9naWNcbiAgLy8gICAgICAgZHluYW1pY2FsbHkgcmF0aGVyIHRoYW4gYnVuZGxlIGl0IGluICdwcm9kdWN0aW9uJyBjb2RlLlxuICBpZiAodHlwZW9mIF9fbnVtV2FpdGluZyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBfX251bVdhaXRpbmcgPSAwO1xuICB9XG4gIF9fbnVtV2FpdGluZysrO1xuICAvLyBXZSBjb3VsZCB1c2UgYGFyZ3VtZW50c2AsIGJ1dCBGdW5jdGlvbi5jYWxsL2FwcGx5IGlzIGV4cGVuc2l2ZS4gQW5kIHdlIG9ubHlcbiAgLy8gbmVlZCB0byBoYW5kbGUgMS0zIGFyZ3VtZW50c1xuICBzd2l0Y2ggKG51bUFyZ3MpIHtcbiAgICBjYXNlIDE6XG4gICAgICByZXR1cm4gPGFueT4gZnVuY3Rpb24oYXJnMTogYW55KSB7XG4gICAgICAgIHNldEltbWVkaWF0ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICBfX251bVdhaXRpbmctLTtcbiAgICAgICAgICByZXR1cm4gY2IoYXJnMSk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICBjYXNlIDI6XG4gICAgICByZXR1cm4gPGFueT4gZnVuY3Rpb24oYXJnMTogYW55LCBhcmcyOiBhbnkpIHtcbiAgICAgICAgc2V0SW1tZWRpYXRlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIF9fbnVtV2FpdGluZy0tO1xuICAgICAgICAgIHJldHVybiBjYihhcmcxLCBhcmcyKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiA8YW55PiBmdW5jdGlvbihhcmcxOiBhbnksIGFyZzI6IGFueSwgYXJnMzogYW55KSB7XG4gICAgICAgIHNldEltbWVkaWF0ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICBfX251bVdhaXRpbmctLTtcbiAgICAgICAgICByZXR1cm4gY2IoYXJnMSwgYXJnMiwgYXJnMyk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGludm9jYXRpb24gb2Ygd3JhcENiLicpO1xuICB9XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZU1vZGUobW9kZTogbnVtYmVyfHN0cmluZywgZGVmOiBudW1iZXIpOiBudW1iZXIge1xuICBzd2l0Y2godHlwZW9mIG1vZGUpIHtcbiAgICBjYXNlICdudW1iZXInOlxuICAgICAgLy8gKHBhdGgsIGZsYWcsIG1vZGUsIGNiPylcbiAgICAgIHJldHVybiA8bnVtYmVyPiBtb2RlO1xuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAvLyAocGF0aCwgZmxhZywgbW9kZVN0cmluZywgY2I/KVxuICAgICAgdmFyIHRydWVNb2RlID0gcGFyc2VJbnQoPHN0cmluZz4gbW9kZSwgOCk7XG4gICAgICBpZiAodHJ1ZU1vZGUgIT09IE5hTikge1xuICAgICAgICByZXR1cm4gdHJ1ZU1vZGU7XG4gICAgICB9XG4gICAgICAvLyBGQUxMIFRIUk9VR0ggaWYgbW9kZSBpcyBhbiBpbnZhbGlkIHN0cmluZyFcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGRlZjtcbiAgfVxufVxuXG5mdW5jdGlvbiBub3JtYWxpemVUaW1lKHRpbWU6IG51bWJlciB8IERhdGUpOiBEYXRlIHtcbiAgaWYgKHRpbWUgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgcmV0dXJuIHRpbWU7XG4gIH0gZWxzZSBpZiAodHlwZW9mIHRpbWUgPT09ICdudW1iZXInKSB7XG4gICAgcmV0dXJuIG5ldyBEYXRlKHRpbWUgKiAxMDAwKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgYEludmFsaWQgdGltZS5gKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBub3JtYWxpemVQYXRoKHA6IHN0cmluZyk6IHN0cmluZyB7XG4gIC8vIE5vZGUgZG9lc24ndCBhbGxvdyBudWxsIGNoYXJhY3RlcnMgaW4gcGF0aHMuXG4gIGlmIChwLmluZGV4T2YoJ1xcdTAwMDAnKSA+PSAwKSB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsICdQYXRoIG11c3QgYmUgYSBzdHJpbmcgd2l0aG91dCBudWxsIGJ5dGVzLicpO1xuICB9IGVsc2UgaWYgKHAgPT09ICcnKSB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsICdQYXRoIG11c3Qgbm90IGJlIGVtcHR5LicpO1xuICB9XG4gIHJldHVybiBwYXRoLnJlc29sdmUocCk7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZU9wdGlvbnMob3B0aW9uczogYW55LCBkZWZFbmM6IHN0cmluZywgZGVmRmxhZzogc3RyaW5nLCBkZWZNb2RlOiBudW1iZXIpOiB7ZW5jb2Rpbmc6IHN0cmluZzsgZmxhZzogc3RyaW5nOyBtb2RlOiBudW1iZXJ9IHtcbiAgc3dpdGNoICh0eXBlb2Ygb3B0aW9ucykge1xuICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBlbmNvZGluZzogdHlwZW9mIG9wdGlvbnNbJ2VuY29kaW5nJ10gIT09ICd1bmRlZmluZWQnID8gb3B0aW9uc1snZW5jb2RpbmcnXSA6IGRlZkVuYyxcbiAgICAgICAgZmxhZzogdHlwZW9mIG9wdGlvbnNbJ2ZsYWcnXSAhPT0gJ3VuZGVmaW5lZCcgPyBvcHRpb25zWydmbGFnJ10gOiBkZWZGbGFnLFxuICAgICAgICBtb2RlOiBub3JtYWxpemVNb2RlKG9wdGlvbnNbJ21vZGUnXSwgZGVmTW9kZSlcbiAgICAgIH07XG4gICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGVuY29kaW5nOiBvcHRpb25zLFxuICAgICAgICBmbGFnOiBkZWZGbGFnLFxuICAgICAgICBtb2RlOiBkZWZNb2RlXG4gICAgICB9O1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBlbmNvZGluZzogZGVmRW5jLFxuICAgICAgICBmbGFnOiBkZWZGbGFnLFxuICAgICAgICBtb2RlOiBkZWZNb2RlXG4gICAgICB9O1xuICB9XG59XG5cbi8vIFRoZSBkZWZhdWx0IGNhbGxiYWNrIGlzIGEgTk9QLlxuZnVuY3Rpb24gbm9wQ2IoKSB7fTtcblxuLyoqXG4gKiBUaGUgbm9kZSBmcm9udGVuZCB0byBhbGwgZmlsZXN5c3RlbXMuXG4gKiBUaGlzIGxheWVyIGhhbmRsZXM6XG4gKlxuICogKiBTYW5pdHkgY2hlY2tpbmcgaW5wdXRzLlxuICogKiBOb3JtYWxpemluZyBwYXRocy5cbiAqICogUmVzZXR0aW5nIHN0YWNrIGRlcHRoIGZvciBhc3luY2hyb25vdXMgb3BlcmF0aW9ucyB3aGljaCBtYXkgbm90IGdvIHRocm91Z2hcbiAqICAgdGhlIGJyb3dzZXIgYnkgd3JhcHBpbmcgYWxsIGlucHV0IGNhbGxiYWNrcyB1c2luZyBgc2V0SW1tZWRpYXRlYC5cbiAqICogUGVyZm9ybWluZyB0aGUgcmVxdWVzdGVkIG9wZXJhdGlvbiB0aHJvdWdoIHRoZSBmaWxlc3lzdGVtIG9yIHRoZSBmaWxlXG4gKiAgIGRlc2NyaXB0b3IsIGFzIGFwcHJvcHJpYXRlLlxuICogKiBIYW5kbGluZyBvcHRpb25hbCBhcmd1bWVudHMgYW5kIHNldHRpbmcgZGVmYXVsdCBhcmd1bWVudHMuXG4gKiBAc2VlIGh0dHA6Ly9ub2RlanMub3JnL2FwaS9mcy5odG1sXG4gKiBAY2xhc3NcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRlMge1xuICAvLyBFeHBvcnRlZCBmcy5TdGF0cy5cbiAgcHVibGljIHN0YXRpYyBTdGF0cyA9IFN0YXRzO1xuXG4gIHByaXZhdGUgcm9vdDogZmlsZV9zeXN0ZW0uRmlsZVN5c3RlbSA9IG51bGw7XG4gIHByaXZhdGUgZmRNYXA6IHtbZmQ6IG51bWJlcl06IEZpbGV9ID0ge307XG4gIHByaXZhdGUgbmV4dEZkID0gMTAwO1xuICBwcml2YXRlIGdldEZkRm9yRmlsZShmaWxlOiBGaWxlKTogbnVtYmVyIHtcbiAgICBsZXQgZmQgPSB0aGlzLm5leHRGZCsrO1xuICAgIHRoaXMuZmRNYXBbZmRdID0gZmlsZTtcbiAgICByZXR1cm4gZmQ7XG4gIH1cbiAgcHJpdmF0ZSBmZDJmaWxlKGZkOiBudW1iZXIpOiBGaWxlIHtcbiAgICBsZXQgcnYgPSB0aGlzLmZkTWFwW2ZkXTtcbiAgICBpZiAocnYpIHtcbiAgICAgIHJldHVybiBydjtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FQkFERiwgJ0ludmFsaWQgZmlsZSBkZXNjcmlwdG9yLicpO1xuICAgIH1cbiAgfVxuICBwcml2YXRlIGNsb3NlRmQoZmQ6IG51bWJlcik6IHZvaWQge1xuICAgIGRlbGV0ZSB0aGlzLmZkTWFwW2ZkXTtcbiAgfVxuXG4gIHB1YmxpYyBpbml0aWFsaXplKHJvb3RGUzogZmlsZV9zeXN0ZW0uRmlsZVN5c3RlbSk6IGZpbGVfc3lzdGVtLkZpbGVTeXN0ZW0ge1xuICAgIGlmICghKDxhbnk+IHJvb3RGUykuY29uc3RydWN0b3IuaXNBdmFpbGFibGUoKSkge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsICdUcmllZCB0byBpbnN0YW50aWF0ZSBCcm93c2VyRlMgd2l0aCBhbiB1bmF2YWlsYWJsZSBmaWxlIHN5c3RlbS4nKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucm9vdCA9IHJvb3RGUztcbiAgfVxuXG4gIC8qKlxuICAgKiBjb252ZXJ0cyBEYXRlIG9yIG51bWJlciB0byBhIGZyYWN0aW9uYWwgVU5JWCB0aW1lc3RhbXBcbiAgICogR3JhYmJlZCBmcm9tIE5vZGVKUyBzb3VyY2VzIChsaWIvZnMuanMpXG4gICAqL1xuICBwdWJsaWMgX3RvVW5peFRpbWVzdGFtcCh0aW1lOiBEYXRlIHwgbnVtYmVyKTogbnVtYmVyIHtcbiAgICBpZiAodHlwZW9mIHRpbWUgPT09ICdudW1iZXInKSB7XG4gICAgICByZXR1cm4gdGltZTtcbiAgICB9IGVsc2UgaWYgKHRpbWUgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICByZXR1cm4gdGltZS5nZXRUaW1lKCkgLyAxMDAwO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgcGFyc2UgdGltZTogXCIgKyB0aW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiAqKk5PTlNUQU5EQVJEKio6IEdyYWIgdGhlIEZpbGVTeXN0ZW0gaW5zdGFuY2UgdGhhdCBiYWNrcyB0aGlzIEFQSS5cbiAgICogQHJldHVybiBbQnJvd3NlckZTLkZpbGVTeXN0ZW0gfCBudWxsXSBSZXR1cm5zIG51bGwgaWYgdGhlIGZpbGUgc3lzdGVtIGhhc1xuICAgKiAgIG5vdCBiZWVuIGluaXRpYWxpemVkLlxuICAgKi9cbiAgcHVibGljIGdldFJvb3RGUygpOiBmaWxlX3N5c3RlbS5GaWxlU3lzdGVtIHtcbiAgICBpZiAodGhpcy5yb290KSB7XG4gICAgICByZXR1cm4gdGhpcy5yb290O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvLyBGSUxFIE9SIERJUkVDVE9SWSBNRVRIT0RTXG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyByZW5hbWUuIE5vIGFyZ3VtZW50cyBvdGhlciB0aGFuIGEgcG9zc2libGUgZXhjZXB0aW9uIGFyZSBnaXZlblxuICAgKiB0byB0aGUgY29tcGxldGlvbiBjYWxsYmFjay5cbiAgICogQHBhcmFtIFtTdHJpbmddIG9sZFBhdGhcbiAgICogQHBhcmFtIFtTdHJpbmddIG5ld1BhdGhcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHJlbmFtZShvbGRQYXRoOiBzdHJpbmcsIG5ld1BhdGg6IHN0cmluZywgY2I6IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgdGhpcy5yb290LnJlbmFtZShub3JtYWxpemVQYXRoKG9sZFBhdGgpLCBub3JtYWxpemVQYXRoKG5ld1BhdGgpLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIHJlbmFtZS5cbiAgICogQHBhcmFtIFtTdHJpbmddIG9sZFBhdGhcbiAgICogQHBhcmFtIFtTdHJpbmddIG5ld1BhdGhcbiAgICovXG4gIHB1YmxpYyByZW5hbWVTeW5jKG9sZFBhdGg6IHN0cmluZywgbmV3UGF0aDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5yb290LnJlbmFtZVN5bmMobm9ybWFsaXplUGF0aChvbGRQYXRoKSwgbm9ybWFsaXplUGF0aChuZXdQYXRoKSk7XG4gIH1cblxuICAvKipcbiAgICogVGVzdCB3aGV0aGVyIG9yIG5vdCB0aGUgZ2l2ZW4gcGF0aCBleGlzdHMgYnkgY2hlY2tpbmcgd2l0aCB0aGUgZmlsZSBzeXN0ZW0uXG4gICAqIFRoZW4gY2FsbCB0aGUgY2FsbGJhY2sgYXJndW1lbnQgd2l0aCBlaXRoZXIgdHJ1ZSBvciBmYWxzZS5cbiAgICogQGV4YW1wbGUgU2FtcGxlIGludm9jYXRpb25cbiAgICogICBmcy5leGlzdHMoJy9ldGMvcGFzc3dkJywgZnVuY3Rpb24gKGV4aXN0cykge1xuICAgKiAgICAgdXRpbC5kZWJ1ZyhleGlzdHMgPyBcIml0J3MgdGhlcmVcIiA6IFwibm8gcGFzc3dkIVwiKTtcbiAgICogICB9KTtcbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCb29sZWFuKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBleGlzdHMocGF0aDogc3RyaW5nLCBjYjogKGV4aXN0czogYm9vbGVhbikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHRoaXMucm9vdC5leGlzdHMobm9ybWFsaXplUGF0aChwYXRoKSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIERvZXNuJ3QgcmV0dXJuIGFuIGVycm9yLiBJZiBzb21ldGhpbmcgYmFkIGhhcHBlbnMsIHdlIGFzc3VtZSBpdCBqdXN0XG4gICAgICAvLyBkb2Vzbid0IGV4aXN0LlxuICAgICAgcmV0dXJuIG5ld0NiKGZhbHNlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVGVzdCB3aGV0aGVyIG9yIG5vdCB0aGUgZ2l2ZW4gcGF0aCBleGlzdHMgYnkgY2hlY2tpbmcgd2l0aCB0aGUgZmlsZSBzeXN0ZW0uXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEByZXR1cm4gW2Jvb2xlYW5dXG4gICAqL1xuICBwdWJsaWMgZXhpc3RzU3luYyhwYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHRoaXMucm9vdC5leGlzdHNTeW5jKG5vcm1hbGl6ZVBhdGgocGF0aCkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIERvZXNuJ3QgcmV0dXJuIGFuIGVycm9yLiBJZiBzb21ldGhpbmcgYmFkIGhhcHBlbnMsIHdlIGFzc3VtZSBpdCBqdXN0XG4gICAgICAvLyBkb2Vzbid0IGV4aXN0LlxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYHN0YXRgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvciwgQnJvd3NlckZTLm5vZGUuZnMuU3RhdHMpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHN0YXQocGF0aDogc3RyaW5nLCBjYjogKGVycjogQXBpRXJyb3IsIHN0YXRzPzogU3RhdHMpID0+IGFueSA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAyKTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHRoaXMucm9vdC5zdGF0KG5vcm1hbGl6ZVBhdGgocGF0aCksIGZhbHNlLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIG5ld0NiKGUsIG51bGwpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgc3RhdGAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEByZXR1cm4gW0Jyb3dzZXJGUy5ub2RlLmZzLlN0YXRzXVxuICAgKi9cbiAgcHVibGljIHN0YXRTeW5jKHBhdGg6IHN0cmluZyk6IFN0YXRzIHtcbiAgICByZXR1cm4gdGhpcy5yb290LnN0YXRTeW5jKG5vcm1hbGl6ZVBhdGgocGF0aCksIGZhbHNlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYGxzdGF0YC5cbiAgICogYGxzdGF0KClgIGlzIGlkZW50aWNhbCB0byBgc3RhdCgpYCwgZXhjZXB0IHRoYXQgaWYgcGF0aCBpcyBhIHN5bWJvbGljIGxpbmssXG4gICAqIHRoZW4gdGhlIGxpbmsgaXRzZWxmIGlzIHN0YXQtZWQsIG5vdCB0aGUgZmlsZSB0aGF0IGl0IHJlZmVycyB0by5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IsIEJyb3dzZXJGUy5ub2RlLmZzLlN0YXRzKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBsc3RhdChwYXRoOiBzdHJpbmcsIGNiOiAoZXJyOiBBcGlFcnJvciwgc3RhdHM/OiBTdGF0cykgPT4gYW55ID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDIpO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gdGhpcy5yb290LnN0YXQobm9ybWFsaXplUGF0aChwYXRoKSwgdHJ1ZSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBuZXdDYihlLCBudWxsKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYGxzdGF0YC5cbiAgICogYGxzdGF0KClgIGlzIGlkZW50aWNhbCB0byBgc3RhdCgpYCwgZXhjZXB0IHRoYXQgaWYgcGF0aCBpcyBhIHN5bWJvbGljIGxpbmssXG4gICAqIHRoZW4gdGhlIGxpbmsgaXRzZWxmIGlzIHN0YXQtZWQsIG5vdCB0aGUgZmlsZSB0aGF0IGl0IHJlZmVycyB0by5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHJldHVybiBbQnJvd3NlckZTLm5vZGUuZnMuU3RhdHNdXG4gICAqL1xuICBwdWJsaWMgbHN0YXRTeW5jKHBhdGg6IHN0cmluZyk6IFN0YXRzIHtcbiAgICByZXR1cm4gdGhpcy5yb290LnN0YXRTeW5jKG5vcm1hbGl6ZVBhdGgocGF0aCksIHRydWUpO1xuICB9XG5cbiAgLy8gRklMRS1PTkxZIE1FVEhPRFNcblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGB0cnVuY2F0ZWAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBsZW5cbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHRydW5jYXRlKHBhdGg6IHN0cmluZywgY2I/OiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgdHJ1bmNhdGUocGF0aDogc3RyaW5nLCBsZW46IG51bWJlciwgY2I/OiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgdHJ1bmNhdGUocGF0aDogc3RyaW5nLCBhcmcyOiBhbnkgPSAwLCBjYjogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbGVuID0gMDtcbiAgICBpZiAodHlwZW9mIGFyZzIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNiID0gYXJnMjtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBhcmcyID09PSAnbnVtYmVyJykge1xuICAgICAgbGVuID0gYXJnMjtcbiAgICB9XG5cbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICBpZiAobGVuIDwgMCkge1xuICAgICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5yb290LnRydW5jYXRlKG5vcm1hbGl6ZVBhdGgocGF0aCksIGxlbiwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYHRydW5jYXRlYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtOdW1iZXJdIGxlblxuICAgKi9cbiAgcHVibGljIHRydW5jYXRlU3luYyhwYXRoOiBzdHJpbmcsIGxlbjogbnVtYmVyID0gMCk6IHZvaWQge1xuICAgIGlmIChsZW4gPCAwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnJvb3QudHJ1bmNhdGVTeW5jKG5vcm1hbGl6ZVBhdGgocGF0aCksIGxlbik7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGB1bmxpbmtgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgdW5saW5rKHBhdGg6IHN0cmluZywgY2I6IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHRoaXMucm9vdC51bmxpbmsobm9ybWFsaXplUGF0aChwYXRoKSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYHVubGlua2AuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqL1xuICBwdWJsaWMgdW5saW5rU3luYyhwYXRoOiBzdHJpbmcpOiB2b2lkIHtcbiAgICByZXR1cm4gdGhpcy5yb290LnVubGlua1N5bmMobm9ybWFsaXplUGF0aChwYXRoKSk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGZpbGUgb3Blbi5cbiAgICogRXhjbHVzaXZlIG1vZGUgZW5zdXJlcyB0aGF0IHBhdGggaXMgbmV3bHkgY3JlYXRlZC5cbiAgICpcbiAgICogYGZsYWdzYCBjYW4gYmU6XG4gICAqXG4gICAqICogYCdyJ2AgLSBPcGVuIGZpbGUgZm9yIHJlYWRpbmcuIEFuIGV4Y2VwdGlvbiBvY2N1cnMgaWYgdGhlIGZpbGUgZG9lcyBub3QgZXhpc3QuXG4gICAqICogYCdyKydgIC0gT3BlbiBmaWxlIGZvciByZWFkaW5nIGFuZCB3cml0aW5nLiBBbiBleGNlcHRpb24gb2NjdXJzIGlmIHRoZSBmaWxlIGRvZXMgbm90IGV4aXN0LlxuICAgKiAqIGAncnMnYCAtIE9wZW4gZmlsZSBmb3IgcmVhZGluZyBpbiBzeW5jaHJvbm91cyBtb2RlLiBJbnN0cnVjdHMgdGhlIGZpbGVzeXN0ZW0gdG8gbm90IGNhY2hlIHdyaXRlcy5cbiAgICogKiBgJ3JzKydgIC0gT3BlbiBmaWxlIGZvciByZWFkaW5nIGFuZCB3cml0aW5nLCBhbmQgb3BlbnMgdGhlIGZpbGUgaW4gc3luY2hyb25vdXMgbW9kZS5cbiAgICogKiBgJ3cnYCAtIE9wZW4gZmlsZSBmb3Igd3JpdGluZy4gVGhlIGZpbGUgaXMgY3JlYXRlZCAoaWYgaXQgZG9lcyBub3QgZXhpc3QpIG9yIHRydW5jYXRlZCAoaWYgaXQgZXhpc3RzKS5cbiAgICogKiBgJ3d4J2AgLSBMaWtlICd3JyBidXQgb3BlbnMgdGhlIGZpbGUgaW4gZXhjbHVzaXZlIG1vZGUuXG4gICAqICogYCd3KydgIC0gT3BlbiBmaWxlIGZvciByZWFkaW5nIGFuZCB3cml0aW5nLiBUaGUgZmlsZSBpcyBjcmVhdGVkIChpZiBpdCBkb2VzIG5vdCBleGlzdCkgb3IgdHJ1bmNhdGVkIChpZiBpdCBleGlzdHMpLlxuICAgKiAqIGAnd3grJ2AgLSBMaWtlICd3KycgYnV0IG9wZW5zIHRoZSBmaWxlIGluIGV4Y2x1c2l2ZSBtb2RlLlxuICAgKiAqIGAnYSdgIC0gT3BlbiBmaWxlIGZvciBhcHBlbmRpbmcuIFRoZSBmaWxlIGlzIGNyZWF0ZWQgaWYgaXQgZG9lcyBub3QgZXhpc3QuXG4gICAqICogYCdheCdgIC0gTGlrZSAnYScgYnV0IG9wZW5zIHRoZSBmaWxlIGluIGV4Y2x1c2l2ZSBtb2RlLlxuICAgKiAqIGAnYSsnYCAtIE9wZW4gZmlsZSBmb3IgcmVhZGluZyBhbmQgYXBwZW5kaW5nLiBUaGUgZmlsZSBpcyBjcmVhdGVkIGlmIGl0IGRvZXMgbm90IGV4aXN0LlxuICAgKiAqIGAnYXgrJ2AgLSBMaWtlICdhKycgYnV0IG9wZW5zIHRoZSBmaWxlIGluIGV4Y2x1c2l2ZSBtb2RlLlxuICAgKlxuICAgKiBAc2VlIGh0dHA6Ly93d3cubWFucGFnZXouY29tL21hbi8yL29wZW4vXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBmbGFnc1xuICAgKiBAcGFyYW0gW051bWJlcj9dIG1vZGUgZGVmYXVsdHMgdG8gYDA2NDRgXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yLCBCcm93c2VyRlMuRmlsZSldIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgb3BlbihwYXRoOiBzdHJpbmcsIGZsYWc6IHN0cmluZywgY2I/OiAoZXJyOiBBcGlFcnJvciwgZmQ/OiBudW1iZXIpID0+IGFueSk6IHZvaWQ7XG4gIHB1YmxpYyBvcGVuKHBhdGg6IHN0cmluZywgZmxhZzogc3RyaW5nLCBtb2RlOiBudW1iZXJ8c3RyaW5nLCBjYj86IChlcnI6IEFwaUVycm9yLCBmZD86IG51bWJlcikgPT4gYW55KTogdm9pZDtcbiAgcHVibGljIG9wZW4ocGF0aDogc3RyaW5nLCBmbGFnOiBzdHJpbmcsIGFyZzI/OiBhbnksIGNiOiAoZXJyOiBBcGlFcnJvciwgZmQ/OiBudW1iZXIpID0+IGFueSA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG1vZGUgPSBub3JtYWxpemVNb2RlKGFyZzIsIDB4MWE0KTtcbiAgICBjYiA9IHR5cGVvZiBhcmcyID09PSAnZnVuY3Rpb24nID8gYXJnMiA6IGNiO1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMik7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMucm9vdC5vcGVuKG5vcm1hbGl6ZVBhdGgocGF0aCksIEZpbGVGbGFnLmdldEZpbGVGbGFnKGZsYWcpLCBtb2RlLCAoZTogQXBpRXJyb3IsIGZpbGU/OiBGaWxlKSA9PiB7XG4gICAgICAgIGlmIChmaWxlKSB7XG4gICAgICAgICAgbmV3Q2IoZSwgdGhpcy5nZXRGZEZvckZpbGUoZmlsZSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG5ld0NiKGUpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlLCBudWxsKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgZmlsZSBvcGVuLlxuICAgKiBAc2VlIGh0dHA6Ly93d3cubWFucGFnZXouY29tL21hbi8yL29wZW4vXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBmbGFnc1xuICAgKiBAcGFyYW0gW051bWJlcj9dIG1vZGUgZGVmYXVsdHMgdG8gYDA2NDRgXG4gICAqIEByZXR1cm4gW0Jyb3dzZXJGUy5GaWxlXVxuICAgKi9cbiAgcHVibGljIG9wZW5TeW5jKHBhdGg6IHN0cmluZywgZmxhZzogc3RyaW5nLCBtb2RlOiBudW1iZXJ8c3RyaW5nID0gMHgxYTQpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmdldEZkRm9yRmlsZShcbiAgICAgIHRoaXMucm9vdC5vcGVuU3luYyhub3JtYWxpemVQYXRoKHBhdGgpLCBGaWxlRmxhZy5nZXRGaWxlRmxhZyhmbGFnKSwgbm9ybWFsaXplTW9kZShtb2RlLCAweDFhNCkpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXNseSByZWFkcyB0aGUgZW50aXJlIGNvbnRlbnRzIG9mIGEgZmlsZS5cbiAgICogQGV4YW1wbGUgVXNhZ2UgZXhhbXBsZVxuICAgKiAgIGZzLnJlYWRGaWxlKCcvZXRjL3Bhc3N3ZCcsIGZ1bmN0aW9uIChlcnIsIGRhdGEpIHtcbiAgICogICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICogICAgIGNvbnNvbGUubG9nKGRhdGEpO1xuICAgKiAgIH0pO1xuICAgKiBAcGFyYW0gW1N0cmluZ10gZmlsZW5hbWVcbiAgICogQHBhcmFtIFtPYmplY3Q/XSBvcHRpb25zXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbU3RyaW5nXSBlbmNvZGluZyBUaGUgc3RyaW5nIGVuY29kaW5nIGZvciB0aGUgZmlsZSBjb250ZW50cy4gRGVmYXVsdHMgdG8gYG51bGxgLlxuICAgKiBAb3B0aW9uIG9wdGlvbnMgW1N0cmluZ10gZmxhZyBEZWZhdWx0cyB0byBgJ3InYC5cbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IsIFN0cmluZyB8IEJyb3dzZXJGUy5ub2RlLkJ1ZmZlcildIGNhbGxiYWNrIElmIG5vIGVuY29kaW5nIGlzIHNwZWNpZmllZCwgdGhlbiB0aGUgcmF3IGJ1ZmZlciBpcyByZXR1cm5lZC5cbiAgICovXG4gIHB1YmxpYyByZWFkRmlsZShmaWxlbmFtZTogc3RyaW5nLCBjYjogKGVycjogQXBpRXJyb3IsIGRhdGE/OiBCdWZmZXIpID0+IHZvaWQgKTogdm9pZDtcbiAgcHVibGljIHJlYWRGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIG9wdGlvbnM6IHsgZmxhZz86IHN0cmluZzsgfSwgY2FsbGJhY2s6IChlcnI6IEFwaUVycm9yLCBkYXRhOiBCdWZmZXIpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgcmVhZEZpbGUoZmlsZW5hbWU6IHN0cmluZywgb3B0aW9uczogeyBlbmNvZGluZzogc3RyaW5nOyBmbGFnPzogc3RyaW5nOyB9LCBjYWxsYmFjazogKGVycjogQXBpRXJyb3IsIGRhdGE6IHN0cmluZykgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyByZWFkRmlsZShmaWxlbmFtZTogc3RyaW5nLCBlbmNvZGluZzogc3RyaW5nLCBjYj86IChlcnI6IEFwaUVycm9yLCBkYXRhPzogc3RyaW5nKSA9PiB2b2lkICk6IHZvaWQ7XG4gIHB1YmxpYyByZWFkRmlsZShmaWxlbmFtZTogc3RyaW5nLCBhcmcyOiBhbnkgPSB7fSwgY2I6IChlcnI6IEFwaUVycm9yLCBkYXRhPzogYW55KSA9PiB2b2lkID0gbm9wQ2IgKSB7XG4gICAgdmFyIG9wdGlvbnMgPSBub3JtYWxpemVPcHRpb25zKGFyZzIsIG51bGwsICdyJywgbnVsbCk7XG4gICAgY2IgPSB0eXBlb2YgYXJnMiA9PT0gJ2Z1bmN0aW9uJyA/IGFyZzIgOiBjYjtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDIpO1xuICAgIHRyeSB7XG4gICAgICB2YXIgZmxhZyA9IEZpbGVGbGFnLmdldEZpbGVGbGFnKG9wdGlvbnNbJ2ZsYWcnXSk7XG4gICAgICBpZiAoIWZsYWcuaXNSZWFkYWJsZSgpKSB7XG4gICAgICAgIHJldHVybiBuZXdDYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgJ0ZsYWcgcGFzc2VkIHRvIHJlYWRGaWxlIG11c3QgYWxsb3cgZm9yIHJlYWRpbmcuJykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMucm9vdC5yZWFkRmlsZShub3JtYWxpemVQYXRoKGZpbGVuYW1lKSwgb3B0aW9ucy5lbmNvZGluZywgZmxhZywgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBuZXdDYihlLCBudWxsKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXNseSByZWFkcyB0aGUgZW50aXJlIGNvbnRlbnRzIG9mIGEgZmlsZS5cbiAgICogQHBhcmFtIFtTdHJpbmddIGZpbGVuYW1lXG4gICAqIEBwYXJhbSBbT2JqZWN0P10gb3B0aW9uc1xuICAgKiBAb3B0aW9uIG9wdGlvbnMgW1N0cmluZ10gZW5jb2RpbmcgVGhlIHN0cmluZyBlbmNvZGluZyBmb3IgdGhlIGZpbGUgY29udGVudHMuIERlZmF1bHRzIHRvIGBudWxsYC5cbiAgICogQG9wdGlvbiBvcHRpb25zIFtTdHJpbmddIGZsYWcgRGVmYXVsdHMgdG8gYCdyJ2AuXG4gICAqIEByZXR1cm4gW1N0cmluZyB8IEJyb3dzZXJGUy5ub2RlLkJ1ZmZlcl1cbiAgICovXG4gIHB1YmxpYyByZWFkRmlsZVN5bmMoZmlsZW5hbWU6IHN0cmluZywgb3B0aW9ucz86IHsgZmxhZz86IHN0cmluZzsgfSk6IEJ1ZmZlcjtcbiAgcHVibGljIHJlYWRGaWxlU3luYyhmaWxlbmFtZTogc3RyaW5nLCBvcHRpb25zOiB7IGVuY29kaW5nOiBzdHJpbmc7IGZsYWc/OiBzdHJpbmc7IH0pOiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkRmlsZVN5bmMoZmlsZW5hbWU6IHN0cmluZywgZW5jb2Rpbmc6IHN0cmluZyk6IHN0cmluZztcbiAgcHVibGljIHJlYWRGaWxlU3luYyhmaWxlbmFtZTogc3RyaW5nLCBhcmcyOiBhbnkgPSB7fSk6IGFueSB7XG4gICAgdmFyIG9wdGlvbnMgPSBub3JtYWxpemVPcHRpb25zKGFyZzIsIG51bGwsICdyJywgbnVsbCk7XG4gICAgdmFyIGZsYWcgPSBGaWxlRmxhZy5nZXRGaWxlRmxhZyhvcHRpb25zLmZsYWcpO1xuICAgIGlmICghZmxhZy5pc1JlYWRhYmxlKCkpIHtcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnRmxhZyBwYXNzZWQgdG8gcmVhZEZpbGUgbXVzdCBhbGxvdyBmb3IgcmVhZGluZy4nKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucm9vdC5yZWFkRmlsZVN5bmMobm9ybWFsaXplUGF0aChmaWxlbmFtZSksIG9wdGlvbnMuZW5jb2RpbmcsIGZsYWcpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91c2x5IHdyaXRlcyBkYXRhIHRvIGEgZmlsZSwgcmVwbGFjaW5nIHRoZSBmaWxlIGlmIGl0IGFscmVhZHlcbiAgICogZXhpc3RzLlxuICAgKlxuICAgKiBUaGUgZW5jb2Rpbmcgb3B0aW9uIGlzIGlnbm9yZWQgaWYgZGF0YSBpcyBhIGJ1ZmZlci5cbiAgICpcbiAgICogQGV4YW1wbGUgVXNhZ2UgZXhhbXBsZVxuICAgKiAgIGZzLndyaXRlRmlsZSgnbWVzc2FnZS50eHQnLCAnSGVsbG8gTm9kZScsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICogICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICogICAgIGNvbnNvbGUubG9nKCdJdFxcJ3Mgc2F2ZWQhJyk7XG4gICAqICAgfSk7XG4gICAqIEBwYXJhbSBbU3RyaW5nXSBmaWxlbmFtZVxuICAgKiBAcGFyYW0gW1N0cmluZyB8IEJyb3dzZXJGUy5ub2RlLkJ1ZmZlcl0gZGF0YVxuICAgKiBAcGFyYW0gW09iamVjdD9dIG9wdGlvbnNcbiAgICogQG9wdGlvbiBvcHRpb25zIFtTdHJpbmddIGVuY29kaW5nIERlZmF1bHRzIHRvIGAndXRmOCdgLlxuICAgKiBAb3B0aW9uIG9wdGlvbnMgW051bWJlcl0gbW9kZSBEZWZhdWx0cyB0byBgMDY0NGAuXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbU3RyaW5nXSBmbGFnIERlZmF1bHRzIHRvIGAndydgLlxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgd3JpdGVGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgY2I/OiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgd3JpdGVGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgZW5jb2Rpbmc/OiBzdHJpbmcsIGNiPzogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHdyaXRlRmlsZShmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIG9wdGlvbnM/OiB7IGVuY29kaW5nPzogc3RyaW5nOyBtb2RlPzogc3RyaW5nIHwgbnVtYmVyOyBmbGFnPzogc3RyaW5nOyB9LCBjYj86IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyB3cml0ZUZpbGUoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogYW55LCBhcmczOiBhbnkgPSB7fSwgY2I6IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG9wdGlvbnMgPSBub3JtYWxpemVPcHRpb25zKGFyZzMsICd1dGY4JywgJ3cnLCAweDFhNCk7XG4gICAgY2IgPSB0eXBlb2YgYXJnMyA9PT0gJ2Z1bmN0aW9uJyA/IGFyZzMgOiBjYjtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICB2YXIgZmxhZyA9IEZpbGVGbGFnLmdldEZpbGVGbGFnKG9wdGlvbnMuZmxhZyk7XG4gICAgICBpZiAoIWZsYWcuaXNXcml0ZWFibGUoKSkge1xuICAgICAgICByZXR1cm4gbmV3Q2IobmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsICdGbGFnIHBhc3NlZCB0byB3cml0ZUZpbGUgbXVzdCBhbGxvdyBmb3Igd3JpdGluZy4nKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5yb290LndyaXRlRmlsZShub3JtYWxpemVQYXRoKGZpbGVuYW1lKSwgZGF0YSwgb3B0aW9ucy5lbmNvZGluZywgZmxhZywgb3B0aW9ucy5tb2RlLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91c2x5IHdyaXRlcyBkYXRhIHRvIGEgZmlsZSwgcmVwbGFjaW5nIHRoZSBmaWxlIGlmIGl0IGFscmVhZHlcbiAgICogZXhpc3RzLlxuICAgKlxuICAgKiBUaGUgZW5jb2Rpbmcgb3B0aW9uIGlzIGlnbm9yZWQgaWYgZGF0YSBpcyBhIGJ1ZmZlci5cbiAgICogQHBhcmFtIFtTdHJpbmddIGZpbGVuYW1lXG4gICAqIEBwYXJhbSBbU3RyaW5nIHwgQnJvd3NlckZTLm5vZGUuQnVmZmVyXSBkYXRhXG4gICAqIEBwYXJhbSBbT2JqZWN0P10gb3B0aW9uc1xuICAgKiBAb3B0aW9uIG9wdGlvbnMgW1N0cmluZ10gZW5jb2RpbmcgRGVmYXVsdHMgdG8gYCd1dGY4J2AuXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbTnVtYmVyXSBtb2RlIERlZmF1bHRzIHRvIGAwNjQ0YC5cbiAgICogQG9wdGlvbiBvcHRpb25zIFtTdHJpbmddIGZsYWcgRGVmYXVsdHMgdG8gYCd3J2AuXG4gICAqL1xuICBwdWJsaWMgd3JpdGVGaWxlU3luYyhmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIG9wdGlvbnM/OiB7IGVuY29kaW5nPzogc3RyaW5nOyBtb2RlPzogbnVtYmVyIHwgc3RyaW5nOyBmbGFnPzogc3RyaW5nOyB9KTogdm9pZDtcbiAgcHVibGljIHdyaXRlRmlsZVN5bmMoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogYW55LCBlbmNvZGluZz86IHN0cmluZyk6IHZvaWQ7XG4gIHB1YmxpYyB3cml0ZUZpbGVTeW5jKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgYXJnMz86IGFueSk6IHZvaWQge1xuICAgIHZhciBvcHRpb25zID0gbm9ybWFsaXplT3B0aW9ucyhhcmczLCAndXRmOCcsICd3JywgMHgxYTQpO1xuICAgIHZhciBmbGFnID0gRmlsZUZsYWcuZ2V0RmlsZUZsYWcob3B0aW9ucy5mbGFnKTtcbiAgICBpZiAoIWZsYWcuaXNXcml0ZWFibGUoKSkge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsICdGbGFnIHBhc3NlZCB0byB3cml0ZUZpbGUgbXVzdCBhbGxvdyBmb3Igd3JpdGluZy4nKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucm9vdC53cml0ZUZpbGVTeW5jKG5vcm1hbGl6ZVBhdGgoZmlsZW5hbWUpLCBkYXRhLCBvcHRpb25zLmVuY29kaW5nLCBmbGFnLCBvcHRpb25zLm1vZGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91c2x5IGFwcGVuZCBkYXRhIHRvIGEgZmlsZSwgY3JlYXRpbmcgdGhlIGZpbGUgaWYgaXQgbm90IHlldFxuICAgKiBleGlzdHMuXG4gICAqXG4gICAqIEBleGFtcGxlIFVzYWdlIGV4YW1wbGVcbiAgICogICBmcy5hcHBlbmRGaWxlKCdtZXNzYWdlLnR4dCcsICdkYXRhIHRvIGFwcGVuZCcsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICogICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICogICAgIGNvbnNvbGUubG9nKCdUaGUgXCJkYXRhIHRvIGFwcGVuZFwiIHdhcyBhcHBlbmRlZCB0byBmaWxlIScpO1xuICAgKiAgIH0pO1xuICAgKiBAcGFyYW0gW1N0cmluZ10gZmlsZW5hbWVcbiAgICogQHBhcmFtIFtTdHJpbmcgfCBCcm93c2VyRlMubm9kZS5CdWZmZXJdIGRhdGFcbiAgICogQHBhcmFtIFtPYmplY3Q/XSBvcHRpb25zXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbU3RyaW5nXSBlbmNvZGluZyBEZWZhdWx0cyB0byBgJ3V0ZjgnYC5cbiAgICogQG9wdGlvbiBvcHRpb25zIFtOdW1iZXJdIG1vZGUgRGVmYXVsdHMgdG8gYDA2NDRgLlxuICAgKiBAb3B0aW9uIG9wdGlvbnMgW1N0cmluZ10gZmxhZyBEZWZhdWx0cyB0byBgJ2EnYC5cbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIGFwcGVuZEZpbGUoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogYW55LCBjYj86IChlcnI6IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIGFwcGVuZEZpbGUoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogYW55LCBvcHRpb25zPzogeyBlbmNvZGluZz86IHN0cmluZzsgbW9kZT86IG51bWJlcnxzdHJpbmc7IGZsYWc/OiBzdHJpbmc7IH0sIGNiPzogKGVycjogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgYXBwZW5kRmlsZShmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGVuY29kaW5nPzogc3RyaW5nLCBjYj86IChlcnI6IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIGFwcGVuZEZpbGUoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogYW55LCBhcmczPzogYW55LCBjYjogKGVycjogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBvcHRpb25zID0gbm9ybWFsaXplT3B0aW9ucyhhcmczLCAndXRmOCcsICdhJywgMHgxYTQpO1xuICAgIGNiID0gdHlwZW9mIGFyZzMgPT09ICdmdW5jdGlvbicgPyBhcmczIDogY2I7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgdmFyIGZsYWcgPSBGaWxlRmxhZy5nZXRGaWxlRmxhZyhvcHRpb25zLmZsYWcpO1xuICAgICAgaWYgKCFmbGFnLmlzQXBwZW5kYWJsZSgpKSB7XG4gICAgICAgIHJldHVybiBuZXdDYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgJ0ZsYWcgcGFzc2VkIHRvIGFwcGVuZEZpbGUgbXVzdCBhbGxvdyBmb3IgYXBwZW5kaW5nLicpKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucm9vdC5hcHBlbmRGaWxlKG5vcm1hbGl6ZVBhdGgoZmlsZW5hbWUpLCBkYXRhLCBvcHRpb25zLmVuY29kaW5nLCBmbGFnLCBvcHRpb25zLm1vZGUsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzbHkgYXBwZW5kIGRhdGEgdG8gYSBmaWxlLCBjcmVhdGluZyB0aGUgZmlsZSBpZiBpdCBub3QgeWV0XG4gICAqIGV4aXN0cy5cbiAgICpcbiAgICogQGV4YW1wbGUgVXNhZ2UgZXhhbXBsZVxuICAgKiAgIGZzLmFwcGVuZEZpbGUoJ21lc3NhZ2UudHh0JywgJ2RhdGEgdG8gYXBwZW5kJywgZnVuY3Rpb24gKGVycikge1xuICAgKiAgICAgaWYgKGVycikgdGhyb3cgZXJyO1xuICAgKiAgICAgY29uc29sZS5sb2coJ1RoZSBcImRhdGEgdG8gYXBwZW5kXCIgd2FzIGFwcGVuZGVkIHRvIGZpbGUhJyk7XG4gICAqICAgfSk7XG4gICAqIEBwYXJhbSBbU3RyaW5nXSBmaWxlbmFtZVxuICAgKiBAcGFyYW0gW1N0cmluZyB8IEJyb3dzZXJGUy5ub2RlLkJ1ZmZlcl0gZGF0YVxuICAgKiBAcGFyYW0gW09iamVjdD9dIG9wdGlvbnNcbiAgICogQG9wdGlvbiBvcHRpb25zIFtTdHJpbmddIGVuY29kaW5nIERlZmF1bHRzIHRvIGAndXRmOCdgLlxuICAgKiBAb3B0aW9uIG9wdGlvbnMgW051bWJlcl0gbW9kZSBEZWZhdWx0cyB0byBgMDY0NGAuXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbU3RyaW5nXSBmbGFnIERlZmF1bHRzIHRvIGAnYSdgLlxuICAgKi9cbiAgcHVibGljIGFwcGVuZEZpbGVTeW5jKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgb3B0aW9ucz86IHsgZW5jb2Rpbmc/OiBzdHJpbmc7IG1vZGU/OiBudW1iZXIgfCBzdHJpbmc7IGZsYWc/OiBzdHJpbmc7IH0pOiB2b2lkO1xuICBwdWJsaWMgYXBwZW5kRmlsZVN5bmMoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogYW55LCBlbmNvZGluZz86IHN0cmluZyk6IHZvaWQ7XG4gIHB1YmxpYyBhcHBlbmRGaWxlU3luYyhmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGFyZzM/OiBhbnkpOiB2b2lkIHtcbiAgICB2YXIgb3B0aW9ucyA9IG5vcm1hbGl6ZU9wdGlvbnMoYXJnMywgJ3V0ZjgnLCAnYScsIDB4MWE0KTtcbiAgICB2YXIgZmxhZyA9IEZpbGVGbGFnLmdldEZpbGVGbGFnKG9wdGlvbnMuZmxhZyk7XG4gICAgaWYgKCFmbGFnLmlzQXBwZW5kYWJsZSgpKSB7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgJ0ZsYWcgcGFzc2VkIHRvIGFwcGVuZEZpbGUgbXVzdCBhbGxvdyBmb3IgYXBwZW5kaW5nLicpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5yb290LmFwcGVuZEZpbGVTeW5jKG5vcm1hbGl6ZVBhdGgoZmlsZW5hbWUpLCBkYXRhLCBvcHRpb25zLmVuY29kaW5nLCBmbGFnLCBvcHRpb25zLm1vZGUpO1xuICB9XG5cbiAgLy8gRklMRSBERVNDUklQVE9SIE1FVEhPRFNcblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBmc3RhdGAuXG4gICAqIGBmc3RhdCgpYCBpcyBpZGVudGljYWwgdG8gYHN0YXQoKWAsIGV4Y2VwdCB0aGF0IHRoZSBmaWxlIHRvIGJlIHN0YXQtZWQgaXNcbiAgICogc3BlY2lmaWVkIGJ5IHRoZSBmaWxlIGRlc2NyaXB0b3IgYGZkYC5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IsIEJyb3dzZXJGUy5ub2RlLmZzLlN0YXRzKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBmc3RhdChmZDogbnVtYmVyLCBjYjogKGVycjogQXBpRXJyb3IsIHN0YXRzPzogU3RhdHMpID0+IGFueSA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAyKTtcbiAgICB0cnkge1xuICAgICAgbGV0IGZpbGUgPSB0aGlzLmZkMmZpbGUoZmQpO1xuICAgICAgZmlsZS5zdGF0KG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYGZzdGF0YC5cbiAgICogYGZzdGF0KClgIGlzIGlkZW50aWNhbCB0byBgc3RhdCgpYCwgZXhjZXB0IHRoYXQgdGhlIGZpbGUgdG8gYmUgc3RhdC1lZCBpc1xuICAgKiBzcGVjaWZpZWQgYnkgdGhlIGZpbGUgZGVzY3JpcHRvciBgZmRgLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcmV0dXJuIFtCcm93c2VyRlMubm9kZS5mcy5TdGF0c11cbiAgICovXG4gIHB1YmxpYyBmc3RhdFN5bmMoZmQ6IG51bWJlcik6IFN0YXRzIHtcbiAgICByZXR1cm4gdGhpcy5mZDJmaWxlKGZkKS5zdGF0U3luYygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBjbG9zZS5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIGNsb3NlKGZkOiBudW1iZXIsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICB0aGlzLmZkMmZpbGUoZmQpLmNsb3NlKChlOiBBcGlFcnJvcikgPT4ge1xuICAgICAgICBpZiAoIWUpIHtcbiAgICAgICAgICB0aGlzLmNsb3NlRmQoZmQpO1xuICAgICAgICB9XG4gICAgICAgIG5ld0NiKGUpO1xuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGNsb3NlLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKi9cbiAgcHVibGljIGNsb3NlU3luYyhmZDogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhpcy5mZDJmaWxlKGZkKS5jbG9zZVN5bmMoKTtcbiAgICB0aGlzLmNsb3NlRmQoZmQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBmdHJ1bmNhdGUuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBsZW5cbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIGZ0cnVuY2F0ZShmZDogbnVtYmVyLCBjYj86IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyBmdHJ1bmNhdGUoZmQ6IG51bWJlciwgbGVuPzogbnVtYmVyLCBjYj86IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyBmdHJ1bmNhdGUoZmQ6IG51bWJlciwgYXJnMj86IGFueSwgY2I6IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIGxlbmd0aCA9IHR5cGVvZiBhcmcyID09PSAnbnVtYmVyJyA/IGFyZzIgOiAwO1xuICAgIGNiID0gdHlwZW9mIGFyZzIgPT09ICdmdW5jdGlvbicgPyBhcmcyIDogY2I7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgbGV0IGZpbGUgPSB0aGlzLmZkMmZpbGUoZmQpO1xuICAgICAgaWYgKGxlbmd0aCA8IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwpO1xuICAgICAgfVxuICAgICAgZmlsZS50cnVuY2F0ZShsZW5ndGgsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgZnRydW5jYXRlLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW051bWJlcl0gbGVuXG4gICAqL1xuICBwdWJsaWMgZnRydW5jYXRlU3luYyhmZDogbnVtYmVyLCBsZW46IG51bWJlciA9IDApOiB2b2lkIHtcbiAgICBsZXQgZmlsZSA9IHRoaXMuZmQyZmlsZShmZCk7XG4gICAgaWYgKGxlbiA8IDApIHtcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMKTtcbiAgICB9XG4gICAgZmlsZS50cnVuY2F0ZVN5bmMobGVuKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgZnN5bmMuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBmc3luYyhmZDogbnVtYmVyLCBjYjogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICB0aGlzLmZkMmZpbGUoZmQpLnN5bmMobmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBmc3luYy5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICovXG4gIHB1YmxpYyBmc3luY1N5bmMoZmQ6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuZmQyZmlsZShmZCkuc3luY1N5bmMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgZmRhdGFzeW5jLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgZmRhdGFzeW5jKGZkOiBudW1iZXIsIGNiOiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuZmQyZmlsZShmZCkuZGF0YXN5bmMobmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBmZGF0YXN5bmMuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqL1xuICBwdWJsaWMgZmRhdGFzeW5jU3luYyhmZDogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhpcy5mZDJmaWxlKGZkKS5kYXRhc3luY1N5bmMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZSBidWZmZXIgdG8gdGhlIGZpbGUgc3BlY2lmaWVkIGJ5IGBmZGAuXG4gICAqIE5vdGUgdGhhdCBpdCBpcyB1bnNhZmUgdG8gdXNlIGZzLndyaXRlIG11bHRpcGxlIHRpbWVzIG9uIHRoZSBzYW1lIGZpbGVcbiAgICogd2l0aG91dCB3YWl0aW5nIGZvciB0aGUgY2FsbGJhY2suXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLm5vZGUuQnVmZmVyXSBidWZmZXIgQnVmZmVyIGNvbnRhaW5pbmcgdGhlIGRhdGEgdG8gd3JpdGUgdG9cbiAgICogICB0aGUgZmlsZS5cbiAgICogQHBhcmFtIFtOdW1iZXJdIG9mZnNldCBPZmZzZXQgaW4gdGhlIGJ1ZmZlciB0byBzdGFydCByZWFkaW5nIGRhdGEgZnJvbS5cbiAgICogQHBhcmFtIFtOdW1iZXJdIGxlbmd0aCBUaGUgYW1vdW50IG9mIGJ5dGVzIHRvIHdyaXRlIHRvIHRoZSBmaWxlLlxuICAgKiBAcGFyYW0gW051bWJlcl0gcG9zaXRpb24gT2Zmc2V0IGZyb20gdGhlIGJlZ2lubmluZyBvZiB0aGUgZmlsZSB3aGVyZSB0aGlzXG4gICAqICAgZGF0YSBzaG91bGQgYmUgd3JpdHRlbi4gSWYgcG9zaXRpb24gaXMgbnVsbCwgdGhlIGRhdGEgd2lsbCBiZSB3cml0dGVuIGF0XG4gICAqICAgdGhlIGN1cnJlbnQgcG9zaXRpb24uXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yLCBOdW1iZXIsIEJyb3dzZXJGUy5ub2RlLkJ1ZmZlcildXG4gICAqICAgY2FsbGJhY2sgVGhlIG51bWJlciBzcGVjaWZpZXMgdGhlIG51bWJlciBvZiBieXRlcyB3cml0dGVuIGludG8gdGhlIGZpbGUuXG4gICAqL1xuICBwdWJsaWMgd3JpdGUoZmQ6IG51bWJlciwgYnVmZmVyOiBCdWZmZXIsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlciwgY2I/OiAoZXJyOiBBcGlFcnJvciwgd3JpdHRlbjogbnVtYmVyLCBidWZmZXI6IEJ1ZmZlcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyB3cml0ZShmZDogbnVtYmVyLCBidWZmZXI6IEJ1ZmZlciwgb2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLCBwb3NpdGlvbjogbnVtYmVyLCBjYj86IChlcnI6IEFwaUVycm9yLCB3cml0dGVuOiBudW1iZXIsIGJ1ZmZlcjogQnVmZmVyKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHdyaXRlKGZkOiBudW1iZXIsIGRhdGE6IGFueSwgY2I/OiAoZXJyOiBBcGlFcnJvciwgd3JpdHRlbjogbnVtYmVyLCBzdHI6IHN0cmluZykgPT4gYW55KTogdm9pZDtcbiAgcHVibGljIHdyaXRlKGZkOiBudW1iZXIsIGRhdGE6IGFueSwgcG9zaXRpb246IG51bWJlciwgY2I/OiAoZXJyOiBBcGlFcnJvciwgd3JpdHRlbjogbnVtYmVyLCBzdHI6IHN0cmluZykgPT4gYW55KTogdm9pZDtcbiAgcHVibGljIHdyaXRlKGZkOiBudW1iZXIsIGRhdGE6IGFueSwgcG9zaXRpb246IG51bWJlciwgZW5jb2Rpbmc6IHN0cmluZywgY2I/OiAoZXJyOiBBcGlFcnJvciwgd3JpdHRlbjogbnVtYmVyLCBzdHI6IHN0cmluZykgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyB3cml0ZShmZDogbnVtYmVyLCBhcmcyOiBhbnksIGFyZzM/OiBhbnksIGFyZzQ/OiBhbnksIGFyZzU/OiBhbnksIGNiOiAoZXJyOiBBcGlFcnJvciwgd3JpdHRlbj86IG51bWJlciwgYnVmZmVyPzogQnVmZmVyKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgYnVmZmVyOiBCdWZmZXIsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlciwgcG9zaXRpb246IG51bWJlciA9IG51bGw7XG4gICAgaWYgKHR5cGVvZiBhcmcyID09PSAnc3RyaW5nJykge1xuICAgICAgLy8gU2lnbmF0dXJlIDE6IChmZCwgc3RyaW5nLCBbcG9zaXRpb24/LCBbZW5jb2Rpbmc/XV0sIGNiPylcbiAgICAgIHZhciBlbmNvZGluZyA9ICd1dGY4JztcbiAgICAgIHN3aXRjaCAodHlwZW9mIGFyZzMpIHtcbiAgICAgICAgY2FzZSAnZnVuY3Rpb24nOlxuICAgICAgICAgIC8vIChmZCwgc3RyaW5nLCBjYilcbiAgICAgICAgICBjYiA9IGFyZzM7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICAgICAgLy8gKGZkLCBzdHJpbmcsIHBvc2l0aW9uLCBlbmNvZGluZz8sIGNiPylcbiAgICAgICAgICBwb3NpdGlvbiA9IGFyZzM7XG4gICAgICAgICAgZW5jb2RpbmcgPSB0eXBlb2YgYXJnNCA9PT0gJ3N0cmluZycgPyBhcmc0IDogJ3V0ZjgnO1xuICAgICAgICAgIGNiID0gdHlwZW9mIGFyZzUgPT09ICdmdW5jdGlvbicgPyBhcmc1IDogY2I7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgLy8gLi4udHJ5IHRvIGZpbmQgdGhlIGNhbGxiYWNrIGFuZCBnZXQgb3V0IG9mIGhlcmUhXG4gICAgICAgICAgY2IgPSB0eXBlb2YgYXJnNCA9PT0gJ2Z1bmN0aW9uJyA/IGFyZzQgOiB0eXBlb2YgYXJnNSA9PT0gJ2Z1bmN0aW9uJyA/IGFyZzUgOiBjYjtcbiAgICAgICAgICByZXR1cm4gY2IobmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsICdJbnZhbGlkIGFyZ3VtZW50cy4nKSk7XG4gICAgICB9XG4gICAgICBidWZmZXIgPSBuZXcgQnVmZmVyKGFyZzIsIGVuY29kaW5nKTtcbiAgICAgIG9mZnNldCA9IDA7XG4gICAgICBsZW5ndGggPSBidWZmZXIubGVuZ3RoO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTaWduYXR1cmUgMjogKGZkLCBidWZmZXIsIG9mZnNldCwgbGVuZ3RoLCBwb3NpdGlvbj8sIGNiPylcbiAgICAgIGJ1ZmZlciA9IGFyZzI7XG4gICAgICBvZmZzZXQgPSBhcmczO1xuICAgICAgbGVuZ3RoID0gYXJnNDtcbiAgICAgIHBvc2l0aW9uID0gdHlwZW9mIGFyZzUgPT09ICdudW1iZXInID8gYXJnNSA6IG51bGw7XG4gICAgICBjYiA9IHR5cGVvZiBhcmc1ID09PSAnZnVuY3Rpb24nID8gYXJnNSA6IGNiO1xuICAgIH1cblxuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMyk7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBmaWxlID0gdGhpcy5mZDJmaWxlKGZkKTtcbiAgICAgIGlmIChwb3NpdGlvbiA9PSBudWxsKSB7XG4gICAgICAgIHBvc2l0aW9uID0gZmlsZS5nZXRQb3MoKTtcbiAgICAgIH1cbiAgICAgIGZpbGUud3JpdGUoYnVmZmVyLCBvZmZzZXQsIGxlbmd0aCwgcG9zaXRpb24sIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogV3JpdGUgYnVmZmVyIHRvIHRoZSBmaWxlIHNwZWNpZmllZCBieSBgZmRgLlxuICAgKiBOb3RlIHRoYXQgaXQgaXMgdW5zYWZlIHRvIHVzZSBmcy53cml0ZSBtdWx0aXBsZSB0aW1lcyBvbiB0aGUgc2FtZSBmaWxlXG4gICAqIHdpdGhvdXQgd2FpdGluZyBmb3IgaXQgdG8gcmV0dXJuLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5ub2RlLkJ1ZmZlcl0gYnVmZmVyIEJ1ZmZlciBjb250YWluaW5nIHRoZSBkYXRhIHRvIHdyaXRlIHRvXG4gICAqICAgdGhlIGZpbGUuXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBvZmZzZXQgT2Zmc2V0IGluIHRoZSBidWZmZXIgdG8gc3RhcnQgcmVhZGluZyBkYXRhIGZyb20uXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBsZW5ndGggVGhlIGFtb3VudCBvZiBieXRlcyB0byB3cml0ZSB0byB0aGUgZmlsZS5cbiAgICogQHBhcmFtIFtOdW1iZXJdIHBvc2l0aW9uIE9mZnNldCBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGZpbGUgd2hlcmUgdGhpc1xuICAgKiAgIGRhdGEgc2hvdWxkIGJlIHdyaXR0ZW4uIElmIHBvc2l0aW9uIGlzIG51bGwsIHRoZSBkYXRhIHdpbGwgYmUgd3JpdHRlbiBhdFxuICAgKiAgIHRoZSBjdXJyZW50IHBvc2l0aW9uLlxuICAgKiBAcmV0dXJuIFtOdW1iZXJdXG4gICAqL1xuICBwdWJsaWMgd3JpdGVTeW5jKGZkOiBudW1iZXIsIGJ1ZmZlcjogQnVmZmVyLCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIHBvc2l0aW9uPzogbnVtYmVyKTogbnVtYmVyO1xuICBwdWJsaWMgd3JpdGVTeW5jKGZkOiBudW1iZXIsIGRhdGE6IHN0cmluZywgcG9zaXRpb24/OiBudW1iZXIsIGVuY29kaW5nPzogc3RyaW5nKTogbnVtYmVyO1xuICBwdWJsaWMgd3JpdGVTeW5jKGZkOiBudW1iZXIsIGFyZzI6IGFueSwgYXJnMz86IGFueSwgYXJnND86IGFueSwgYXJnNT86IGFueSk6IG51bWJlciB7XG4gICAgdmFyIGJ1ZmZlcjogQnVmZmVyLCBvZmZzZXQ6IG51bWJlciA9IDAsIGxlbmd0aDogbnVtYmVyLCBwb3NpdGlvbjogbnVtYmVyO1xuICAgIGlmICh0eXBlb2YgYXJnMiA9PT0gJ3N0cmluZycpIHtcbiAgICAgIC8vIFNpZ25hdHVyZSAxOiAoZmQsIHN0cmluZywgW3Bvc2l0aW9uPywgW2VuY29kaW5nP11dKVxuICAgICAgcG9zaXRpb24gPSB0eXBlb2YgYXJnMyA9PT0gJ251bWJlcicgPyBhcmczIDogbnVsbDtcbiAgICAgIHZhciBlbmNvZGluZyA9IHR5cGVvZiBhcmc0ID09PSAnc3RyaW5nJyA/IGFyZzQgOiAndXRmOCc7XG4gICAgICBvZmZzZXQgPSAwO1xuICAgICAgYnVmZmVyID0gbmV3IEJ1ZmZlcihhcmcyLCBlbmNvZGluZyk7XG4gICAgICBsZW5ndGggPSBidWZmZXIubGVuZ3RoO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTaWduYXR1cmUgMjogKGZkLCBidWZmZXIsIG9mZnNldCwgbGVuZ3RoLCBwb3NpdGlvbj8pXG4gICAgICBidWZmZXIgPSBhcmcyO1xuICAgICAgb2Zmc2V0ID0gYXJnMztcbiAgICAgIGxlbmd0aCA9IGFyZzQ7XG4gICAgICBwb3NpdGlvbiA9IHR5cGVvZiBhcmc1ID09PSAnbnVtYmVyJyA/IGFyZzUgOiBudWxsO1xuICAgIH1cblxuICAgIGxldCBmaWxlID0gdGhpcy5mZDJmaWxlKGZkKTtcbiAgICBpZiAocG9zaXRpb24gPT0gbnVsbCkge1xuICAgICAgcG9zaXRpb24gPSBmaWxlLmdldFBvcygpO1xuICAgIH1cbiAgICByZXR1cm4gZmlsZS53cml0ZVN5bmMoYnVmZmVyLCBvZmZzZXQsIGxlbmd0aCwgcG9zaXRpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlYWQgZGF0YSBmcm9tIHRoZSBmaWxlIHNwZWNpZmllZCBieSBgZmRgLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5ub2RlLkJ1ZmZlcl0gYnVmZmVyIFRoZSBidWZmZXIgdGhhdCB0aGUgZGF0YSB3aWxsIGJlXG4gICAqICAgd3JpdHRlbiB0by5cbiAgICogQHBhcmFtIFtOdW1iZXJdIG9mZnNldCBUaGUgb2Zmc2V0IHdpdGhpbiB0aGUgYnVmZmVyIHdoZXJlIHdyaXRpbmcgd2lsbFxuICAgKiAgIHN0YXJ0LlxuICAgKiBAcGFyYW0gW051bWJlcl0gbGVuZ3RoIEFuIGludGVnZXIgc3BlY2lmeWluZyB0aGUgbnVtYmVyIG9mIGJ5dGVzIHRvIHJlYWQuXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBwb3NpdGlvbiBBbiBpbnRlZ2VyIHNwZWNpZnlpbmcgd2hlcmUgdG8gYmVnaW4gcmVhZGluZyBmcm9tXG4gICAqICAgaW4gdGhlIGZpbGUuIElmIHBvc2l0aW9uIGlzIG51bGwsIGRhdGEgd2lsbCBiZSByZWFkIGZyb20gdGhlIGN1cnJlbnQgZmlsZVxuICAgKiAgIHBvc2l0aW9uLlxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvciwgTnVtYmVyLCBCcm93c2VyRlMubm9kZS5CdWZmZXIpXVxuICAgKiAgIGNhbGxiYWNrIFRoZSBudW1iZXIgaXMgdGhlIG51bWJlciBvZiBieXRlcyByZWFkXG4gICAqL1xuICBwdWJsaWMgcmVhZChmZDogbnVtYmVyLCBsZW5ndGg6IG51bWJlciwgcG9zaXRpb246IG51bWJlciwgZW5jb2Rpbmc6IHN0cmluZywgY2I/OiAoZXJyOiBBcGlFcnJvciwgZGF0YT86IHN0cmluZywgYnl0ZXNSZWFkPzogbnVtYmVyKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHJlYWQoZmQ6IG51bWJlciwgYnVmZmVyOiBCdWZmZXIsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlciwgcG9zaXRpb246IG51bWJlciwgY2I/OiAoZXJyOiBBcGlFcnJvciwgYnl0ZXNSZWFkPzogbnVtYmVyLCBidWZmZXI/OiBCdWZmZXIpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgcmVhZChmZDogbnVtYmVyLCBhcmcyOiBhbnksIGFyZzM6IGFueSwgYXJnNDogYW55LCBhcmc1PzogYW55LCBjYjogKGVycjogQXBpRXJyb3IsIGFyZzI/OiBhbnksIGFyZzM/OiBhbnkpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBwb3NpdGlvbjogbnVtYmVyLCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIGJ1ZmZlcjogQnVmZmVyLCBuZXdDYjogKGVycjogQXBpRXJyb3IsIGJ5dGVzUmVhZD86IG51bWJlciwgYnVmZmVyPzogQnVmZmVyKSA9PiB2b2lkO1xuICAgIGlmICh0eXBlb2YgYXJnMiA9PT0gJ251bWJlcicpIHtcbiAgICAgIC8vIGxlZ2FjeSBpbnRlcmZhY2VcbiAgICAgIC8vIChmZCwgbGVuZ3RoLCBwb3NpdGlvbiwgZW5jb2RpbmcsIGNhbGxiYWNrKVxuICAgICAgbGVuZ3RoID0gYXJnMjtcbiAgICAgIHBvc2l0aW9uID0gYXJnMztcbiAgICAgIHZhciBlbmNvZGluZyA9IGFyZzQ7XG4gICAgICBjYiA9IHR5cGVvZiBhcmc1ID09PSAnZnVuY3Rpb24nID8gYXJnNSA6IGNiO1xuICAgICAgb2Zmc2V0ID0gMDtcbiAgICAgIGJ1ZmZlciA9IG5ldyBCdWZmZXIobGVuZ3RoKTtcbiAgICAgIC8vIFhYWDogSW5lZmZpY2llbnQuXG4gICAgICAvLyBXcmFwIHRoZSBjYiBzbyB3ZSBzaGVsdGVyIHVwcGVyIGxheWVycyBvZiB0aGUgQVBJIGZyb20gdGhlc2VcbiAgICAgIC8vIHNoZW5hbmlnYW5zLlxuICAgICAgbmV3Q2IgPSB3cmFwQ2IoKGZ1bmN0aW9uKGVycjogYW55LCBieXRlc1JlYWQ6IG51bWJlciwgYnVmOiBCdWZmZXIpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHJldHVybiBjYihlcnIpO1xuICAgICAgICB9XG4gICAgICAgIGNiKGVyciwgYnVmLnRvU3RyaW5nKGVuY29kaW5nKSwgYnl0ZXNSZWFkKTtcbiAgICAgIH0pLCAzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYnVmZmVyID0gYXJnMjtcbiAgICAgIG9mZnNldCA9IGFyZzM7XG4gICAgICBsZW5ndGggPSBhcmc0O1xuICAgICAgcG9zaXRpb24gPSBhcmc1O1xuICAgICAgbmV3Q2IgPSB3cmFwQ2IoY2IsIDMpO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBsZXQgZmlsZSA9IHRoaXMuZmQyZmlsZShmZCk7XG4gICAgICBpZiAocG9zaXRpb24gPT0gbnVsbCkge1xuICAgICAgICBwb3NpdGlvbiA9IGZpbGUuZ2V0UG9zKCk7XG4gICAgICB9XG4gICAgICBmaWxlLnJlYWQoYnVmZmVyLCBvZmZzZXQsIGxlbmd0aCwgcG9zaXRpb24sIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVhZCBkYXRhIGZyb20gdGhlIGZpbGUgc3BlY2lmaWVkIGJ5IGBmZGAuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLm5vZGUuQnVmZmVyXSBidWZmZXIgVGhlIGJ1ZmZlciB0aGF0IHRoZSBkYXRhIHdpbGwgYmVcbiAgICogICB3cml0dGVuIHRvLlxuICAgKiBAcGFyYW0gW051bWJlcl0gb2Zmc2V0IFRoZSBvZmZzZXQgd2l0aGluIHRoZSBidWZmZXIgd2hlcmUgd3JpdGluZyB3aWxsXG4gICAqICAgc3RhcnQuXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBsZW5ndGggQW4gaW50ZWdlciBzcGVjaWZ5aW5nIHRoZSBudW1iZXIgb2YgYnl0ZXMgdG8gcmVhZC5cbiAgICogQHBhcmFtIFtOdW1iZXJdIHBvc2l0aW9uIEFuIGludGVnZXIgc3BlY2lmeWluZyB3aGVyZSB0byBiZWdpbiByZWFkaW5nIGZyb21cbiAgICogICBpbiB0aGUgZmlsZS4gSWYgcG9zaXRpb24gaXMgbnVsbCwgZGF0YSB3aWxsIGJlIHJlYWQgZnJvbSB0aGUgY3VycmVudCBmaWxlXG4gICAqICAgcG9zaXRpb24uXG4gICAqIEByZXR1cm4gW051bWJlcl1cbiAgICovXG4gIHB1YmxpYyByZWFkU3luYyhmZDogbnVtYmVyLCBsZW5ndGg6IG51bWJlciwgcG9zaXRpb246IG51bWJlciwgZW5jb2Rpbmc6IHN0cmluZyk6IHN0cmluZztcbiAgcHVibGljIHJlYWRTeW5jKGZkOiBudW1iZXIsIGJ1ZmZlcjogQnVmZmVyLCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIHBvc2l0aW9uOiBudW1iZXIpOiBudW1iZXI7XG4gIHB1YmxpYyByZWFkU3luYyhmZDogbnVtYmVyLCBhcmcyOiBhbnksIGFyZzM6IGFueSwgYXJnNDogYW55LCBhcmc1PzogYW55KTogYW55IHtcbiAgICB2YXIgc2hlbmFuaWdhbnMgPSBmYWxzZTtcbiAgICB2YXIgYnVmZmVyOiBCdWZmZXIsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlciwgcG9zaXRpb246IG51bWJlcjtcbiAgICBpZiAodHlwZW9mIGFyZzIgPT09ICdudW1iZXInKSB7XG4gICAgICBsZW5ndGggPSBhcmcyO1xuICAgICAgcG9zaXRpb24gPSBhcmczO1xuICAgICAgdmFyIGVuY29kaW5nID0gYXJnNDtcbiAgICAgIG9mZnNldCA9IDA7XG4gICAgICBidWZmZXIgPSBuZXcgQnVmZmVyKGxlbmd0aCk7XG4gICAgICBzaGVuYW5pZ2FucyA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJ1ZmZlciA9IGFyZzI7XG4gICAgICBvZmZzZXQgPSBhcmczO1xuICAgICAgbGVuZ3RoID0gYXJnNDtcbiAgICAgIHBvc2l0aW9uID0gYXJnNTtcbiAgICB9XG4gICAgbGV0IGZpbGUgPSB0aGlzLmZkMmZpbGUoZmQpO1xuICAgIGlmIChwb3NpdGlvbiA9PSBudWxsKSB7XG4gICAgICBwb3NpdGlvbiA9IGZpbGUuZ2V0UG9zKCk7XG4gICAgfVxuXG4gICAgdmFyIHJ2ID0gZmlsZS5yZWFkU3luYyhidWZmZXIsIG9mZnNldCwgbGVuZ3RoLCBwb3NpdGlvbik7XG4gICAgaWYgKCFzaGVuYW5pZ2Fucykge1xuICAgICAgcmV0dXJuIHJ2O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gW2J1ZmZlci50b1N0cmluZyhlbmNvZGluZyksIHJ2XTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBmY2hvd25gLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW051bWJlcl0gdWlkXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBnaWRcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIGZjaG93bihmZDogbnVtYmVyLCB1aWQ6IG51bWJlciwgZ2lkOiBudW1iZXIsIGNhbGxiYWNrOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2FsbGJhY2ssIDEpO1xuICAgIHRyeSB7XG4gICAgICB0aGlzLmZkMmZpbGUoZmQpLmNob3duKHVpZCwgZ2lkLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBmY2hvd25gLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW051bWJlcl0gdWlkXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBnaWRcbiAgICovXG4gIHB1YmxpYyBmY2hvd25TeW5jKGZkOiBudW1iZXIsIHVpZDogbnVtYmVyLCBnaWQ6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuZmQyZmlsZShmZCkuY2hvd25TeW5jKHVpZCwgZ2lkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYGZjaG1vZGAuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBtb2RlXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBmY2htb2QoZmQ6IG51bWJlciwgbW9kZTogc3RyaW5nIHwgbnVtYmVyLCBjYj86IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICBsZXQgbnVtTW9kZSA9IHR5cGVvZiBtb2RlID09PSAnc3RyaW5nJyA/IHBhcnNlSW50KG1vZGUsIDgpIDogbW9kZTtcbiAgICAgIHRoaXMuZmQyZmlsZShmZCkuY2htb2QobnVtTW9kZSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgZmNobW9kYC5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtOdW1iZXJdIG1vZGVcbiAgICovXG4gIHB1YmxpYyBmY2htb2RTeW5jKGZkOiBudW1iZXIsIG1vZGU6IG51bWJlciB8IHN0cmluZyk6IHZvaWQge1xuICAgIGxldCBudW1Nb2RlID0gdHlwZW9mIG1vZGUgPT09ICdzdHJpbmcnID8gcGFyc2VJbnQobW9kZSwgOCkgOiBtb2RlO1xuICAgIHRoaXMuZmQyZmlsZShmZCkuY2htb2RTeW5jKG51bU1vZGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoYW5nZSB0aGUgZmlsZSB0aW1lc3RhbXBzIG9mIGEgZmlsZSByZWZlcmVuY2VkIGJ5IHRoZSBzdXBwbGllZCBmaWxlXG4gICAqIGRlc2NyaXB0b3IuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbRGF0ZV0gYXRpbWVcbiAgICogQHBhcmFtIFtEYXRlXSBtdGltZVxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgZnV0aW1lcyhmZDogbnVtYmVyLCBhdGltZTogbnVtYmVyLCBtdGltZTogbnVtYmVyLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyBmdXRpbWVzKGZkOiBudW1iZXIsIGF0aW1lOiBEYXRlLCBtdGltZTogRGF0ZSwgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgZnV0aW1lcyhmZDogbnVtYmVyLCBhdGltZTogYW55LCBtdGltZTogYW55LCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgbGV0IGZpbGUgPSB0aGlzLmZkMmZpbGUoZmQpO1xuICAgICAgaWYgKHR5cGVvZiBhdGltZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgYXRpbWUgPSBuZXcgRGF0ZShhdGltZSAqIDEwMDApO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBtdGltZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgbXRpbWUgPSBuZXcgRGF0ZShtdGltZSAqIDEwMDApO1xuICAgICAgfVxuICAgICAgZmlsZS51dGltZXMoYXRpbWUsIG10aW1lLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENoYW5nZSB0aGUgZmlsZSB0aW1lc3RhbXBzIG9mIGEgZmlsZSByZWZlcmVuY2VkIGJ5IHRoZSBzdXBwbGllZCBmaWxlXG4gICAqIGRlc2NyaXB0b3IuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbRGF0ZV0gYXRpbWVcbiAgICogQHBhcmFtIFtEYXRlXSBtdGltZVxuICAgKi9cbiAgcHVibGljIGZ1dGltZXNTeW5jKGZkOiBudW1iZXIsIGF0aW1lOiBudW1iZXIgfCBEYXRlLCBtdGltZTogbnVtYmVyIHwgRGF0ZSk6IHZvaWQge1xuICAgIHRoaXMuZmQyZmlsZShmZCkudXRpbWVzU3luYyhub3JtYWxpemVUaW1lKGF0aW1lKSwgbm9ybWFsaXplVGltZShtdGltZSkpO1xuICB9XG5cbiAgLy8gRElSRUNUT1JZLU9OTFkgTUVUSE9EU1xuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYHJtZGlyYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHJtZGlyKHBhdGg6IHN0cmluZywgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgICAgdGhpcy5yb290LnJtZGlyKHBhdGgsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYHJtZGlyYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICovXG4gIHB1YmxpYyBybWRpclN5bmMocGF0aDogc3RyaW5nKTogdm9pZCB7XG4gICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG4gICAgcmV0dXJuIHRoaXMucm9vdC5ybWRpclN5bmMocGF0aCk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBta2RpcmAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbTnVtYmVyP10gbW9kZSBkZWZhdWx0cyB0byBgMDc3N2BcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIG1rZGlyKHBhdGg6IHN0cmluZywgbW9kZT86IGFueSwgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIGlmICh0eXBlb2YgbW9kZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2IgPSBtb2RlO1xuICAgICAgbW9kZSA9IDB4MWZmO1xuICAgIH1cbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICBwYXRoID0gbm9ybWFsaXplUGF0aChwYXRoKTtcbiAgICAgIHRoaXMucm9vdC5ta2RpcihwYXRoLCBtb2RlLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBta2RpcmAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbTnVtYmVyP10gbW9kZSBkZWZhdWx0cyB0byBgMDc3N2BcbiAgICovXG4gIHB1YmxpYyBta2RpclN5bmMocGF0aDogc3RyaW5nLCBtb2RlPzogbnVtYmVyIHwgc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5yb290Lm1rZGlyU3luYyhub3JtYWxpemVQYXRoKHBhdGgpLCBub3JtYWxpemVNb2RlKG1vZGUsIDB4MWZmKSk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGByZWFkZGlyYC4gUmVhZHMgdGhlIGNvbnRlbnRzIG9mIGEgZGlyZWN0b3J5LlxuICAgKiBUaGUgY2FsbGJhY2sgZ2V0cyB0d28gYXJndW1lbnRzIGAoZXJyLCBmaWxlcylgIHdoZXJlIGBmaWxlc2AgaXMgYW4gYXJyYXkgb2ZcbiAgICogdGhlIG5hbWVzIG9mIHRoZSBmaWxlcyBpbiB0aGUgZGlyZWN0b3J5IGV4Y2x1ZGluZyBgJy4nYCBhbmQgYCcuLidgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvciwgU3RyaW5nW10pXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHJlYWRkaXIocGF0aDogc3RyaW5nLCBjYjogKGVycjogQXBpRXJyb3IsIGZpbGVzPzogc3RyaW5nW10pID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IDwoZXJyOiBBcGlFcnJvciwgZmlsZXM/OiBzdHJpbmdbXSkgPT4gdm9pZD4gd3JhcENiKGNiLCAyKTtcbiAgICB0cnkge1xuICAgICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG4gICAgICB0aGlzLnJvb3QucmVhZGRpcihwYXRoLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGByZWFkZGlyYC4gUmVhZHMgdGhlIGNvbnRlbnRzIG9mIGEgZGlyZWN0b3J5LlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcmV0dXJuIFtTdHJpbmdbXV1cbiAgICovXG4gIHB1YmxpYyByZWFkZGlyU3luYyhwYXRoOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG4gICAgcmV0dXJuIHRoaXMucm9vdC5yZWFkZGlyU3luYyhwYXRoKTtcbiAgfVxuXG4gIC8vIFNZTUxJTksgTUVUSE9EU1xuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYGxpbmtgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gc3JjcGF0aFxuICAgKiBAcGFyYW0gW1N0cmluZ10gZHN0cGF0aFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgbGluayhzcmNwYXRoOiBzdHJpbmcsIGRzdHBhdGg6IHN0cmluZywgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHNyY3BhdGggPSBub3JtYWxpemVQYXRoKHNyY3BhdGgpO1xuICAgICAgZHN0cGF0aCA9IG5vcm1hbGl6ZVBhdGgoZHN0cGF0aCk7XG4gICAgICB0aGlzLnJvb3QubGluayhzcmNwYXRoLCBkc3RwYXRoLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBsaW5rYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHNyY3BhdGhcbiAgICogQHBhcmFtIFtTdHJpbmddIGRzdHBhdGhcbiAgICovXG4gIHB1YmxpYyBsaW5rU3luYyhzcmNwYXRoOiBzdHJpbmcsIGRzdHBhdGg6IHN0cmluZyk6IHZvaWQge1xuICAgIHNyY3BhdGggPSBub3JtYWxpemVQYXRoKHNyY3BhdGgpO1xuICAgIGRzdHBhdGggPSBub3JtYWxpemVQYXRoKGRzdHBhdGgpO1xuICAgIHJldHVybiB0aGlzLnJvb3QubGlua1N5bmMoc3JjcGF0aCwgZHN0cGF0aCk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBzeW1saW5rYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHNyY3BhdGhcbiAgICogQHBhcmFtIFtTdHJpbmddIGRzdHBhdGhcbiAgICogQHBhcmFtIFtTdHJpbmc/XSB0eXBlIGNhbiBiZSBlaXRoZXIgYCdkaXInYCBvciBgJ2ZpbGUnYCAoZGVmYXVsdCBpcyBgJ2ZpbGUnYClcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHN5bWxpbmsoc3JjcGF0aDogc3RyaW5nLCBkc3RwYXRoOiBzdHJpbmcsIGNiPzogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyBzeW1saW5rKHNyY3BhdGg6IHN0cmluZywgZHN0cGF0aDogc3RyaW5nLCB0eXBlPzogc3RyaW5nLCBjYj86IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgc3ltbGluayhzcmNwYXRoOiBzdHJpbmcsIGRzdHBhdGg6IHN0cmluZywgYXJnMz86IGFueSwgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciB0eXBlID0gdHlwZW9mIGFyZzMgPT09ICdzdHJpbmcnID8gYXJnMyA6ICdmaWxlJztcbiAgICBjYiA9IHR5cGVvZiBhcmczID09PSAnZnVuY3Rpb24nID8gYXJnMyA6IGNiO1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIGlmICh0eXBlICE9PSAnZmlsZScgJiYgdHlwZSAhPT0gJ2RpcicpIHtcbiAgICAgICAgcmV0dXJuIG5ld0NiKG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCBcIkludmFsaWQgdHlwZTogXCIgKyB0eXBlKSk7XG4gICAgICB9XG4gICAgICBzcmNwYXRoID0gbm9ybWFsaXplUGF0aChzcmNwYXRoKTtcbiAgICAgIGRzdHBhdGggPSBub3JtYWxpemVQYXRoKGRzdHBhdGgpO1xuICAgICAgdGhpcy5yb290LnN5bWxpbmsoc3JjcGF0aCwgZHN0cGF0aCwgdHlwZSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgc3ltbGlua2AuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBzcmNwYXRoXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBkc3RwYXRoXG4gICAqIEBwYXJhbSBbU3RyaW5nP10gdHlwZSBjYW4gYmUgZWl0aGVyIGAnZGlyJ2Agb3IgYCdmaWxlJ2AgKGRlZmF1bHQgaXMgYCdmaWxlJ2ApXG4gICAqL1xuICBwdWJsaWMgc3ltbGlua1N5bmMoc3JjcGF0aDogc3RyaW5nLCBkc3RwYXRoOiBzdHJpbmcsIHR5cGU/OiBzdHJpbmcpOiB2b2lkIHtcbiAgICBpZiAodHlwZSA9PSBudWxsKSB7XG4gICAgICB0eXBlID0gJ2ZpbGUnO1xuICAgIH0gZWxzZSBpZiAodHlwZSAhPT0gJ2ZpbGUnICYmIHR5cGUgIT09ICdkaXInKSB7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgXCJJbnZhbGlkIHR5cGU6IFwiICsgdHlwZSk7XG4gICAgfVxuICAgIHNyY3BhdGggPSBub3JtYWxpemVQYXRoKHNyY3BhdGgpO1xuICAgIGRzdHBhdGggPSBub3JtYWxpemVQYXRoKGRzdHBhdGgpO1xuICAgIHJldHVybiB0aGlzLnJvb3Quc3ltbGlua1N5bmMoc3JjcGF0aCwgZHN0cGF0aCwgdHlwZSk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIHJlYWRsaW5rLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvciwgU3RyaW5nKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyByZWFkbGluayhwYXRoOiBzdHJpbmcsIGNiOiAoZXJyOiBBcGlFcnJvciwgbGlua1N0cmluZz86IHN0cmluZykgPT4gYW55ID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDIpO1xuICAgIHRyeSB7XG4gICAgICBwYXRoID0gbm9ybWFsaXplUGF0aChwYXRoKTtcbiAgICAgIHRoaXMucm9vdC5yZWFkbGluayhwYXRoLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIHJlYWRsaW5rLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcmV0dXJuIFtTdHJpbmddXG4gICAqL1xuICBwdWJsaWMgcmVhZGxpbmtTeW5jKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG4gICAgcmV0dXJuIHRoaXMucm9vdC5yZWFkbGlua1N5bmMocGF0aCk7XG4gIH1cblxuICAvLyBQUk9QRVJUWSBPUEVSQVRJT05TXG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgY2hvd25gLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW051bWJlcl0gdWlkXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBnaWRcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIGNob3duKHBhdGg6IHN0cmluZywgdWlkOiBudW1iZXIsIGdpZDogbnVtYmVyLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG4gICAgICB0aGlzLnJvb3QuY2hvd24ocGF0aCwgZmFsc2UsIHVpZCwgZ2lkLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBjaG93bmAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbTnVtYmVyXSB1aWRcbiAgICogQHBhcmFtIFtOdW1iZXJdIGdpZFxuICAgKi9cbiAgcHVibGljIGNob3duU3luYyhwYXRoOiBzdHJpbmcsIHVpZDogbnVtYmVyLCBnaWQ6IG51bWJlcik6IHZvaWQge1xuICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgIHRoaXMucm9vdC5jaG93blN5bmMocGF0aCwgZmFsc2UsIHVpZCwgZ2lkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYGxjaG93bmAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbTnVtYmVyXSB1aWRcbiAgICogQHBhcmFtIFtOdW1iZXJdIGdpZFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgbGNob3duKHBhdGg6IHN0cmluZywgdWlkOiBudW1iZXIsIGdpZDogbnVtYmVyLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG4gICAgICB0aGlzLnJvb3QuY2hvd24ocGF0aCwgdHJ1ZSwgdWlkLCBnaWQsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYGxjaG93bmAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbTnVtYmVyXSB1aWRcbiAgICogQHBhcmFtIFtOdW1iZXJdIGdpZFxuICAgKi9cbiAgcHVibGljIGxjaG93blN5bmMocGF0aDogc3RyaW5nLCB1aWQ6IG51bWJlciwgZ2lkOiBudW1iZXIpOiB2b2lkIHtcbiAgICBwYXRoID0gbm9ybWFsaXplUGF0aChwYXRoKTtcbiAgICB0aGlzLnJvb3QuY2hvd25TeW5jKHBhdGgsIHRydWUsIHVpZCwgZ2lkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYGNobW9kYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtOdW1iZXJdIG1vZGVcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIGNobW9kKHBhdGg6IHN0cmluZywgbW9kZTogbnVtYmVyIHwgc3RyaW5nLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgbGV0IG51bU1vZGUgPSBub3JtYWxpemVNb2RlKG1vZGUsIC0xKTtcbiAgICAgIGlmIChudW1Nb2RlIDwgMCkge1xuICAgICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgYEludmFsaWQgbW9kZS5gKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucm9vdC5jaG1vZChub3JtYWxpemVQYXRoKHBhdGgpLCBmYWxzZSwgbnVtTW9kZSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgY2htb2RgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW051bWJlcl0gbW9kZVxuICAgKi9cbiAgcHVibGljIGNobW9kU3luYyhwYXRoOiBzdHJpbmcsIG1vZGU6IHN0cmluZ3xudW1iZXIpOiB2b2lkIHtcbiAgICBsZXQgbnVtTW9kZSA9IG5vcm1hbGl6ZU1vZGUobW9kZSwgLTEpO1xuICAgIGlmIChudW1Nb2RlIDwgMCkge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsIGBJbnZhbGlkIG1vZGUuYCk7XG4gICAgfVxuICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgIHRoaXMucm9vdC5jaG1vZFN5bmMocGF0aCwgZmFsc2UsIG51bU1vZGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgbGNobW9kYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtOdW1iZXJdIG1vZGVcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIGxjaG1vZChwYXRoOiBzdHJpbmcsIG1vZGU6IG51bWJlcnxzdHJpbmcsIGNiOiBGdW5jdGlvbiA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgbGV0IG51bU1vZGUgPSBub3JtYWxpemVNb2RlKG1vZGUsIC0xKTtcbiAgICAgIGlmIChudW1Nb2RlIDwgMCkge1xuICAgICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgYEludmFsaWQgbW9kZS5gKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucm9vdC5jaG1vZChub3JtYWxpemVQYXRoKHBhdGgpLCB0cnVlLCBudW1Nb2RlLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBsY2htb2RgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW051bWJlcl0gbW9kZVxuICAgKi9cbiAgcHVibGljIGxjaG1vZFN5bmMocGF0aDogc3RyaW5nLCBtb2RlOiBudW1iZXJ8c3RyaW5nKTogdm9pZCB7XG4gICAgbGV0IG51bU1vZGUgPSBub3JtYWxpemVNb2RlKG1vZGUsIC0xKTtcbiAgICBpZiAobnVtTW9kZSA8IDEpIHtcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCBgSW52YWxpZCBtb2RlLmApO1xuICAgIH1cbiAgICB0aGlzLnJvb3QuY2htb2RTeW5jKG5vcm1hbGl6ZVBhdGgocGF0aCksIHRydWUsIG51bU1vZGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoYW5nZSBmaWxlIHRpbWVzdGFtcHMgb2YgdGhlIGZpbGUgcmVmZXJlbmNlZCBieSB0aGUgc3VwcGxpZWQgcGF0aC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtEYXRlXSBhdGltZVxuICAgKiBAcGFyYW0gW0RhdGVdIG10aW1lXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyB1dGltZXMocGF0aDogc3RyaW5nLCBhdGltZTogbnVtYmVyfERhdGUsIG10aW1lOiBudW1iZXJ8RGF0ZSwgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMucm9vdC51dGltZXMobm9ybWFsaXplUGF0aChwYXRoKSwgbm9ybWFsaXplVGltZShhdGltZSksIG5vcm1hbGl6ZVRpbWUobXRpbWUpLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENoYW5nZSBmaWxlIHRpbWVzdGFtcHMgb2YgdGhlIGZpbGUgcmVmZXJlbmNlZCBieSB0aGUgc3VwcGxpZWQgcGF0aC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtEYXRlXSBhdGltZVxuICAgKiBAcGFyYW0gW0RhdGVdIG10aW1lXG4gICAqL1xuICBwdWJsaWMgdXRpbWVzU3luYyhwYXRoOiBzdHJpbmcsIGF0aW1lOiBudW1iZXJ8RGF0ZSwgbXRpbWU6IG51bWJlcnxEYXRlKTogdm9pZCB7XG4gICAgdGhpcy5yb290LnV0aW1lc1N5bmMobm9ybWFsaXplUGF0aChwYXRoKSwgbm9ybWFsaXplVGltZShhdGltZSksIG5vcm1hbGl6ZVRpbWUobXRpbWUpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYHJlYWxwYXRoYC4gVGhlIGNhbGxiYWNrIGdldHMgdHdvIGFyZ3VtZW50c1xuICAgKiBgKGVyciwgcmVzb2x2ZWRQYXRoKWAuIE1heSB1c2UgYHByb2Nlc3MuY3dkYCB0byByZXNvbHZlIHJlbGF0aXZlIHBhdGhzLlxuICAgKlxuICAgKiBAZXhhbXBsZSBVc2FnZSBleGFtcGxlXG4gICAqICAgdmFyIGNhY2hlID0geycvZXRjJzonL3ByaXZhdGUvZXRjJ307XG4gICAqICAgZnMucmVhbHBhdGgoJy9ldGMvcGFzc3dkJywgY2FjaGUsIGZ1bmN0aW9uIChlcnIsIHJlc29sdmVkUGF0aCkge1xuICAgKiAgICAgaWYgKGVycikgdGhyb3cgZXJyO1xuICAgKiAgICAgY29uc29sZS5sb2cocmVzb2x2ZWRQYXRoKTtcbiAgICogICB9KTtcbiAgICpcbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtPYmplY3Q/XSBjYWNoZSBBbiBvYmplY3QgbGl0ZXJhbCBvZiBtYXBwZWQgcGF0aHMgdGhhdCBjYW4gYmUgdXNlZCB0b1xuICAgKiAgIGZvcmNlIGEgc3BlY2lmaWMgcGF0aCByZXNvbHV0aW9uIG9yIGF2b2lkIGFkZGl0aW9uYWwgYGZzLnN0YXRgIGNhbGxzIGZvclxuICAgKiAgIGtub3duIHJlYWwgcGF0aHMuXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yLCBTdHJpbmcpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHJlYWxwYXRoKHBhdGg6IHN0cmluZywgY2I/OiAoZXJyOiBBcGlFcnJvciwgcmVzb2x2ZWRQYXRoPzogc3RyaW5nKSA9PmFueSk6IHZvaWQ7XG4gIHB1YmxpYyByZWFscGF0aChwYXRoOiBzdHJpbmcsIGNhY2hlOiB7W3BhdGg6IHN0cmluZ106IHN0cmluZ30sIGNiOiAoZXJyOiBBcGlFcnJvciwgcmVzb2x2ZWRQYXRoPzogc3RyaW5nKSA9PmFueSk6IHZvaWQ7XG4gIHB1YmxpYyByZWFscGF0aChwYXRoOiBzdHJpbmcsIGFyZzI/OiBhbnksIGNiOiAoZXJyOiBBcGlFcnJvciwgcmVzb2x2ZWRQYXRoPzogc3RyaW5nKSA9PiBhbnkgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBjYWNoZSA9IHR5cGVvZiBhcmcyID09PSAnb2JqZWN0JyA/IGFyZzIgOiB7fTtcbiAgICBjYiA9IHR5cGVvZiBhcmcyID09PSAnZnVuY3Rpb24nID8gYXJnMiA6IG5vcENiO1xuICAgIHZhciBuZXdDYiA9IDwoZXJyOiBBcGlFcnJvciwgcmVzb2x2ZWRQYXRoPzogc3RyaW5nKSA9PmFueT4gd3JhcENiKGNiLCAyKTtcbiAgICB0cnkge1xuICAgICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG4gICAgICB0aGlzLnJvb3QucmVhbHBhdGgocGF0aCwgY2FjaGUsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYHJlYWxwYXRoYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtPYmplY3Q/XSBjYWNoZSBBbiBvYmplY3QgbGl0ZXJhbCBvZiBtYXBwZWQgcGF0aHMgdGhhdCBjYW4gYmUgdXNlZCB0b1xuICAgKiAgIGZvcmNlIGEgc3BlY2lmaWMgcGF0aCByZXNvbHV0aW9uIG9yIGF2b2lkIGFkZGl0aW9uYWwgYGZzLnN0YXRgIGNhbGxzIGZvclxuICAgKiAgIGtub3duIHJlYWwgcGF0aHMuXG4gICAqIEByZXR1cm4gW1N0cmluZ11cbiAgICovXG4gIHB1YmxpYyByZWFscGF0aFN5bmMocGF0aDogc3RyaW5nLCBjYWNoZToge1twYXRoOiBzdHJpbmddOiBzdHJpbmd9ID0ge30pOiBzdHJpbmcge1xuICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgIHJldHVybiB0aGlzLnJvb3QucmVhbHBhdGhTeW5jKHBhdGgsIGNhY2hlKTtcbiAgfVxuXG4gIHB1YmxpYyB3YXRjaEZpbGUoZmlsZW5hbWU6IHN0cmluZywgbGlzdGVuZXI6IChjdXJyOiBTdGF0cywgcHJldjogU3RhdHMpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgd2F0Y2hGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIG9wdGlvbnM6IHsgcGVyc2lzdGVudD86IGJvb2xlYW47IGludGVydmFsPzogbnVtYmVyOyB9LCBsaXN0ZW5lcjogKGN1cnI6IFN0YXRzLCBwcmV2OiBTdGF0cykgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyB3YXRjaEZpbGUoZmlsZW5hbWU6IHN0cmluZywgYXJnMjogYW55LCBsaXN0ZW5lcjogKGN1cnI6IFN0YXRzLCBwcmV2OiBTdGF0cykgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxuXG4gIHB1YmxpYyB1bndhdGNoRmlsZShmaWxlbmFtZTogc3RyaW5nLCBsaXN0ZW5lcjogKGN1cnI6IFN0YXRzLCBwcmV2OiBTdGF0cykgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxuXG4gIHB1YmxpYyB3YXRjaChmaWxlbmFtZTogc3RyaW5nLCBsaXN0ZW5lcj86IChldmVudDogc3RyaW5nLCBmaWxlbmFtZTogc3RyaW5nKSA9PiBhbnkpOiBfZnMuRlNXYXRjaGVyO1xuICBwdWJsaWMgd2F0Y2goZmlsZW5hbWU6IHN0cmluZywgb3B0aW9uczogeyBwZXJzaXN0ZW50PzogYm9vbGVhbjsgfSwgbGlzdGVuZXI/OiAoZXZlbnQ6IHN0cmluZywgZmlsZW5hbWU6IHN0cmluZykgPT4gYW55KTogX2ZzLkZTV2F0Y2hlcjtcbiAgcHVibGljIHdhdGNoKGZpbGVuYW1lOiBzdHJpbmcsIGFyZzI6IGFueSwgbGlzdGVuZXI6IChldmVudDogc3RyaW5nLCBmaWxlbmFtZTogc3RyaW5nKSA9PiBhbnkgPSBub3BDYik6IF9mcy5GU1dhdGNoZXIge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCk7XG4gIH1cblxuICBwdWJsaWMgRl9PSzogbnVtYmVyID0gMDtcbiAgcHVibGljIFJfT0s6IG51bWJlciA9IDQ7XG4gIHB1YmxpYyBXX09LOiBudW1iZXIgPSAyO1xuICBwdWJsaWMgWF9PSzogbnVtYmVyID0gMTtcblxuICBwdWJsaWMgYWNjZXNzKHBhdGg6IHN0cmluZywgY2FsbGJhY2s6IChlcnI6IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIGFjY2VzcyhwYXRoOiBzdHJpbmcsIG1vZGU6IG51bWJlciwgY2FsbGJhY2s6IChlcnI6IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIGFjY2VzcyhwYXRoOiBzdHJpbmcsIGFyZzI6IGFueSwgY2I6IChlOiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcbiAgfVxuXG4gIHB1YmxpYyBhY2Nlc3NTeW5jKHBhdGg6IHN0cmluZywgbW9kZT86IG51bWJlcik6IHZvaWQge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCk7XG4gIH1cblxuICBwdWJsaWMgY3JlYXRlUmVhZFN0cmVhbShwYXRoOiBzdHJpbmcsIG9wdGlvbnM/OiB7XG4gICAgICAgIGZsYWdzPzogc3RyaW5nO1xuICAgICAgICBlbmNvZGluZz86IHN0cmluZztcbiAgICAgICAgZmQ/OiBudW1iZXI7XG4gICAgICAgIG1vZGU/OiBudW1iZXI7XG4gICAgICAgIGF1dG9DbG9zZT86IGJvb2xlYW47XG4gICAgfSk6IF9mcy5SZWFkU3RyZWFtIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZVdyaXRlU3RyZWFtKHBhdGg6IHN0cmluZywgb3B0aW9ucz86IHtcbiAgICAgICAgZmxhZ3M/OiBzdHJpbmc7XG4gICAgICAgIGVuY29kaW5nPzogc3RyaW5nO1xuICAgICAgICBmZD86IG51bWJlcjtcbiAgICAgICAgbW9kZT86IG51bWJlcjtcbiAgICB9KTogX2ZzLldyaXRlU3RyZWFtIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xuICB9XG59XG5cbi8vIFR5cGUgY2hlY2tpbmcuXG52YXIgXzogdHlwZW9mIF9mcyA9IG5ldyBGUygpO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZTTW9kdWxlIGV4dGVuZHMgRlMge1xuICAvKipcbiAgICogUmV0cmlldmUgdGhlIEZTIG9iamVjdCBiYWNraW5nIHRoZSBmcyBtb2R1bGUuXG4gICAqL1xuICBnZXRGU01vZHVsZSgpOiBGUztcbiAgLyoqXG4gICAqIFNldCB0aGUgRlMgb2JqZWN0IGJhY2tpbmcgdGhlIGZzIG1vZHVsZS5cbiAgICovXG4gIGNoYW5nZUZTTW9kdWxlKG5ld0ZzOiBGUyk6IHZvaWQ7XG4gIC8qKlxuICAgKiBUaGUgRlMgY29uc3RydWN0b3IuXG4gICAqL1xuICBGUzogdHlwZW9mIEZTO1xufVxuIl19