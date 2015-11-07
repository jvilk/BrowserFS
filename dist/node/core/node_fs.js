var api_error_1 = require('./api_error');
var file_flag_1 = require('./file_flag');
var path = require('path');
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
function checkFd(fd) {
    if (typeof fd['write'] !== 'function') {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.EBADF, 'Invalid file descriptor.');
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
var fs = (function () {
    function fs() {
    }
    fs._initialize = function (rootFS) {
        if (!rootFS.constructor.isAvailable()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Tried to instantiate BrowserFS with an unavailable file system.');
        }
        return fs.root = rootFS;
    };
    fs._toUnixTimestamp = function (time) {
        if (typeof time === 'number') {
            return time;
        }
        else if (time instanceof Date) {
            return time.getTime() / 1000;
        }
        throw new Error("Cannot parse time: " + time);
    };
    fs.getRootFS = function () {
        if (fs.root) {
            return fs.root;
        }
        else {
            return null;
        }
    };
    fs.rename = function (oldPath, newPath, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            fs.root.rename(normalizePath(oldPath), normalizePath(newPath), newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.renameSync = function (oldPath, newPath) {
        fs.root.renameSync(normalizePath(oldPath), normalizePath(newPath));
    };
    fs.exists = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            return fs.root.exists(normalizePath(path), newCb);
        }
        catch (e) {
            return newCb(false);
        }
    };
    fs.existsSync = function (path) {
        try {
            return fs.root.existsSync(normalizePath(path));
        }
        catch (e) {
            return false;
        }
    };
    fs.stat = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 2);
        try {
            return fs.root.stat(normalizePath(path), false, newCb);
        }
        catch (e) {
            return newCb(e, null);
        }
    };
    fs.statSync = function (path) {
        return fs.root.statSync(normalizePath(path), false);
    };
    fs.lstat = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 2);
        try {
            return fs.root.stat(normalizePath(path), true, newCb);
        }
        catch (e) {
            return newCb(e, null);
        }
    };
    fs.lstatSync = function (path) {
        return fs.root.statSync(normalizePath(path), true);
    };
    fs.truncate = function (path, arg2, cb) {
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
            return fs.root.truncate(normalizePath(path), len, newCb);
        }
        catch (e) {
            return newCb(e);
        }
    };
    fs.truncateSync = function (path, len) {
        if (len === void 0) { len = 0; }
        if (len < 0) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL);
        }
        return fs.root.truncateSync(normalizePath(path), len);
    };
    fs.unlink = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            return fs.root.unlink(normalizePath(path), newCb);
        }
        catch (e) {
            return newCb(e);
        }
    };
    fs.unlinkSync = function (path) {
        return fs.root.unlinkSync(normalizePath(path));
    };
    fs.open = function (path, flag, arg2, cb) {
        if (cb === void 0) { cb = nopCb; }
        var mode = normalizeMode(arg2, 0x1a4);
        cb = typeof arg2 === 'function' ? arg2 : cb;
        var newCb = wrapCb(cb, 2);
        try {
            return fs.root.open(normalizePath(path), file_flag_1.FileFlag.getFileFlag(flag), mode, newCb);
        }
        catch (e) {
            return newCb(e, null);
        }
    };
    fs.openSync = function (path, flag, mode) {
        if (mode === void 0) { mode = 0x1a4; }
        return fs.root.openSync(normalizePath(path), file_flag_1.FileFlag.getFileFlag(flag), mode);
    };
    fs.readFile = function (filename, arg2, cb) {
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
            return fs.root.readFile(normalizePath(filename), options.encoding, flag, newCb);
        }
        catch (e) {
            return newCb(e, null);
        }
    };
    fs.readFileSync = function (filename, arg2) {
        if (arg2 === void 0) { arg2 = {}; }
        var options = normalizeOptions(arg2, null, 'r', null);
        var flag = file_flag_1.FileFlag.getFileFlag(options.flag);
        if (!flag.isReadable()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Flag passed to readFile must allow for reading.');
        }
        return fs.root.readFileSync(normalizePath(filename), options.encoding, flag);
    };
    fs.writeFile = function (filename, data, arg3, cb) {
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
            return fs.root.writeFile(normalizePath(filename), data, options.encoding, flag, options.mode, newCb);
        }
        catch (e) {
            return newCb(e);
        }
    };
    fs.writeFileSync = function (filename, data, arg3) {
        var options = normalizeOptions(arg3, 'utf8', 'w', 0x1a4);
        var flag = file_flag_1.FileFlag.getFileFlag(options.flag);
        if (!flag.isWriteable()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Flag passed to writeFile must allow for writing.');
        }
        return fs.root.writeFileSync(normalizePath(filename), data, options.encoding, flag, options.mode);
    };
    fs.appendFile = function (filename, data, arg3, cb) {
        if (cb === void 0) { cb = nopCb; }
        var options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
        cb = typeof arg3 === 'function' ? arg3 : cb;
        var newCb = wrapCb(cb, 1);
        try {
            var flag = file_flag_1.FileFlag.getFileFlag(options.flag);
            if (!flag.isAppendable()) {
                return newCb(new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.'));
            }
            fs.root.appendFile(normalizePath(filename), data, options.encoding, flag, options.mode, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.appendFileSync = function (filename, data, arg3) {
        var options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
        var flag = file_flag_1.FileFlag.getFileFlag(options.flag);
        if (!flag.isAppendable()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.');
        }
        return fs.root.appendFileSync(normalizePath(filename), data, options.encoding, flag, options.mode);
    };
    fs.fstat = function (fd, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 2);
        try {
            checkFd(fd);
            fd.stat(newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.fstatSync = function (fd) {
        checkFd(fd);
        return fd.statSync();
    };
    fs.close = function (fd, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            checkFd(fd);
            fd.close(newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.closeSync = function (fd) {
        checkFd(fd);
        return fd.closeSync();
    };
    fs.ftruncate = function (fd, arg2, cb) {
        if (cb === void 0) { cb = nopCb; }
        var length = typeof arg2 === 'number' ? arg2 : 0;
        cb = typeof arg2 === 'function' ? arg2 : cb;
        var newCb = wrapCb(cb, 1);
        try {
            checkFd(fd);
            if (length < 0) {
                throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL);
            }
            fd.truncate(length, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.ftruncateSync = function (fd, len) {
        if (len === void 0) { len = 0; }
        checkFd(fd);
        return fd.truncateSync(len);
    };
    fs.fsync = function (fd, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            checkFd(fd);
            fd.sync(newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.fsyncSync = function (fd) {
        checkFd(fd);
        return fd.syncSync();
    };
    fs.fdatasync = function (fd, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            checkFd(fd);
            fd.datasync(newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.fdatasyncSync = function (fd) {
        checkFd(fd);
        fd.datasyncSync();
    };
    fs.write = function (fd, arg2, arg3, arg4, arg5, cb) {
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
            checkFd(fd);
            if (position == null) {
                position = fd.getPos();
            }
            fd.write(buffer, offset, length, position, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.writeSync = function (fd, arg2, arg3, arg4, arg5) {
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
        checkFd(fd);
        if (position == null) {
            position = fd.getPos();
        }
        return fd.writeSync(buffer, offset, length, position);
    };
    fs.read = function (fd, arg2, arg3, arg4, arg5, cb) {
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
            checkFd(fd);
            if (position == null) {
                position = fd.getPos();
            }
            fd.read(buffer, offset, length, position, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.readSync = function (fd, arg2, arg3, arg4, arg5) {
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
        checkFd(fd);
        if (position == null) {
            position = fd.getPos();
        }
        var rv = fd.readSync(buffer, offset, length, position);
        if (!shenanigans) {
            return rv;
        }
        else {
            return [buffer.toString(encoding), rv];
        }
    };
    fs.fchown = function (fd, uid, gid, callback) {
        if (callback === void 0) { callback = nopCb; }
        var newCb = wrapCb(callback, 1);
        try {
            checkFd(fd);
            fd.chown(uid, gid, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.fchownSync = function (fd, uid, gid) {
        checkFd(fd);
        return fd.chownSync(uid, gid);
    };
    fs.fchmod = function (fd, mode, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
            checkFd(fd);
            fd.chmod(mode, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.fchmodSync = function (fd, mode) {
        mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
        checkFd(fd);
        return fd.chmodSync(mode);
    };
    fs.futimes = function (fd, atime, mtime, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            checkFd(fd);
            if (typeof atime === 'number') {
                atime = new Date(atime * 1000);
            }
            if (typeof mtime === 'number') {
                mtime = new Date(mtime * 1000);
            }
            fd.utimes(atime, mtime, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.futimesSync = function (fd, atime, mtime) {
        checkFd(fd);
        if (typeof atime === 'number') {
            atime = new Date(atime * 1000);
        }
        if (typeof mtime === 'number') {
            mtime = new Date(mtime * 1000);
        }
        return fd.utimesSync(atime, mtime);
    };
    fs.rmdir = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            path = normalizePath(path);
            fs.root.rmdir(path, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.rmdirSync = function (path) {
        path = normalizePath(path);
        return fs.root.rmdirSync(path);
    };
    fs.mkdir = function (path, mode, cb) {
        if (cb === void 0) { cb = nopCb; }
        if (typeof mode === 'function') {
            cb = mode;
            mode = 0x1ff;
        }
        var newCb = wrapCb(cb, 1);
        try {
            path = normalizePath(path);
            fs.root.mkdir(path, mode, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.mkdirSync = function (path, mode) {
        if (mode === void 0) { mode = 0x1ff; }
        mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
        path = normalizePath(path);
        return fs.root.mkdirSync(path, mode);
    };
    fs.readdir = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 2);
        try {
            path = normalizePath(path);
            fs.root.readdir(path, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.readdirSync = function (path) {
        path = normalizePath(path);
        return fs.root.readdirSync(path);
    };
    fs.link = function (srcpath, dstpath, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            srcpath = normalizePath(srcpath);
            dstpath = normalizePath(dstpath);
            fs.root.link(srcpath, dstpath, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.linkSync = function (srcpath, dstpath) {
        srcpath = normalizePath(srcpath);
        dstpath = normalizePath(dstpath);
        return fs.root.linkSync(srcpath, dstpath);
    };
    fs.symlink = function (srcpath, dstpath, arg3, cb) {
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
            fs.root.symlink(srcpath, dstpath, type, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.symlinkSync = function (srcpath, dstpath, type) {
        if (type == null) {
            type = 'file';
        }
        else if (type !== 'file' && type !== 'dir') {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EINVAL, "Invalid type: " + type);
        }
        srcpath = normalizePath(srcpath);
        dstpath = normalizePath(dstpath);
        return fs.root.symlinkSync(srcpath, dstpath, type);
    };
    fs.readlink = function (path, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 2);
        try {
            path = normalizePath(path);
            fs.root.readlink(path, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.readlinkSync = function (path) {
        path = normalizePath(path);
        return fs.root.readlinkSync(path);
    };
    fs.chown = function (path, uid, gid, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            path = normalizePath(path);
            fs.root.chown(path, false, uid, gid, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.chownSync = function (path, uid, gid) {
        path = normalizePath(path);
        fs.root.chownSync(path, false, uid, gid);
    };
    fs.lchown = function (path, uid, gid, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            path = normalizePath(path);
            fs.root.chown(path, true, uid, gid, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.lchownSync = function (path, uid, gid) {
        path = normalizePath(path);
        return fs.root.chownSync(path, true, uid, gid);
    };
    fs.chmod = function (path, mode, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
            path = normalizePath(path);
            fs.root.chmod(path, false, mode, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.chmodSync = function (path, mode) {
        mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
        path = normalizePath(path);
        return fs.root.chmodSync(path, false, mode);
    };
    fs.lchmod = function (path, mode, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
            path = normalizePath(path);
            fs.root.chmod(path, true, mode, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.lchmodSync = function (path, mode) {
        path = normalizePath(path);
        mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
        return fs.root.chmodSync(path, true, mode);
    };
    fs.utimes = function (path, atime, mtime, cb) {
        if (cb === void 0) { cb = nopCb; }
        var newCb = wrapCb(cb, 1);
        try {
            path = normalizePath(path);
            if (typeof atime === 'number') {
                atime = new Date(atime * 1000);
            }
            if (typeof mtime === 'number') {
                mtime = new Date(mtime * 1000);
            }
            fs.root.utimes(path, atime, mtime, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.utimesSync = function (path, atime, mtime) {
        path = normalizePath(path);
        if (typeof atime === 'number') {
            atime = new Date(atime * 1000);
        }
        if (typeof mtime === 'number') {
            mtime = new Date(mtime * 1000);
        }
        return fs.root.utimesSync(path, atime, mtime);
    };
    fs.realpath = function (path, arg2, cb) {
        if (cb === void 0) { cb = nopCb; }
        var cache = typeof arg2 === 'object' ? arg2 : {};
        cb = typeof arg2 === 'function' ? arg2 : nopCb;
        var newCb = wrapCb(cb, 2);
        try {
            path = normalizePath(path);
            fs.root.realpath(path, cache, newCb);
        }
        catch (e) {
            newCb(e);
        }
    };
    fs.realpathSync = function (path, cache) {
        if (cache === void 0) { cache = {}; }
        path = normalizePath(path);
        return fs.root.realpathSync(path, cache);
    };
    fs.root = null;
    return fs;
})();
module.exports = fs;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9kZV9mcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb3JlL25vZGVfZnMudHMiXSwibmFtZXMiOlsid3JhcENiIiwiY2hlY2tGZCIsIm5vcm1hbGl6ZU1vZGUiLCJub3JtYWxpemVQYXRoIiwibm9ybWFsaXplT3B0aW9ucyIsIm5vcENiIiwiZnMiLCJmcy5jb25zdHJ1Y3RvciIsImZzLl9pbml0aWFsaXplIiwiZnMuX3RvVW5peFRpbWVzdGFtcCIsImZzLmdldFJvb3RGUyIsImZzLnJlbmFtZSIsImZzLnJlbmFtZVN5bmMiLCJmcy5leGlzdHMiLCJmcy5leGlzdHNTeW5jIiwiZnMuc3RhdCIsImZzLnN0YXRTeW5jIiwiZnMubHN0YXQiLCJmcy5sc3RhdFN5bmMiLCJmcy50cnVuY2F0ZSIsImZzLnRydW5jYXRlU3luYyIsImZzLnVubGluayIsImZzLnVubGlua1N5bmMiLCJmcy5vcGVuIiwiZnMub3BlblN5bmMiLCJmcy5yZWFkRmlsZSIsImZzLnJlYWRGaWxlU3luYyIsImZzLndyaXRlRmlsZSIsImZzLndyaXRlRmlsZVN5bmMiLCJmcy5hcHBlbmRGaWxlIiwiZnMuYXBwZW5kRmlsZVN5bmMiLCJmcy5mc3RhdCIsImZzLmZzdGF0U3luYyIsImZzLmNsb3NlIiwiZnMuY2xvc2VTeW5jIiwiZnMuZnRydW5jYXRlIiwiZnMuZnRydW5jYXRlU3luYyIsImZzLmZzeW5jIiwiZnMuZnN5bmNTeW5jIiwiZnMuZmRhdGFzeW5jIiwiZnMuZmRhdGFzeW5jU3luYyIsImZzLndyaXRlIiwiZnMud3JpdGVTeW5jIiwiZnMucmVhZCIsImZzLnJlYWRTeW5jIiwiZnMuZmNob3duIiwiZnMuZmNob3duU3luYyIsImZzLmZjaG1vZCIsImZzLmZjaG1vZFN5bmMiLCJmcy5mdXRpbWVzIiwiZnMuZnV0aW1lc1N5bmMiLCJmcy5ybWRpciIsImZzLnJtZGlyU3luYyIsImZzLm1rZGlyIiwiZnMubWtkaXJTeW5jIiwiZnMucmVhZGRpciIsImZzLnJlYWRkaXJTeW5jIiwiZnMubGluayIsImZzLmxpbmtTeW5jIiwiZnMuc3ltbGluayIsImZzLnN5bWxpbmtTeW5jIiwiZnMucmVhZGxpbmsiLCJmcy5yZWFkbGlua1N5bmMiLCJmcy5jaG93biIsImZzLmNob3duU3luYyIsImZzLmxjaG93biIsImZzLmxjaG93blN5bmMiLCJmcy5jaG1vZCIsImZzLmNobW9kU3luYyIsImZzLmxjaG1vZCIsImZzLmxjaG1vZFN5bmMiLCJmcy51dGltZXMiLCJmcy51dGltZXNTeW5jIiwiZnMucmVhbHBhdGgiLCJmcy5yZWFscGF0aFN5bmMiXSwibWFwcGluZ3MiOiJBQUNBLDBCQUFrQyxhQUFhLENBQUMsQ0FBQTtBQUVoRCwwQkFBdUIsYUFBYSxDQUFDLENBQUE7QUFDckMsSUFBTyxJQUFJLFdBQVcsTUFBTSxDQUFDLENBQUM7QUFhOUIsZ0JBQWdCLEVBQVksRUFBRSxPQUFlO0lBQzNDQSxFQUFFQSxDQUFDQSxDQUFDQSxPQUFPQSxFQUFFQSxLQUFLQSxVQUFVQSxDQUFDQSxDQUFDQSxDQUFDQTtRQUM3QkEsTUFBTUEsSUFBSUEsb0JBQVFBLENBQUNBLHFCQUFTQSxDQUFDQSxNQUFNQSxFQUFFQSw4QkFBOEJBLENBQUNBLENBQUNBO0lBQ3ZFQSxDQUFDQTtJQUdEQSxFQUFFQSxDQUFDQSxDQUFDQSxPQUFPQSxZQUFZQSxLQUFLQSxXQUFXQSxDQUFDQSxDQUFDQSxDQUFDQTtRQUN4Q0EsWUFBWUEsR0FBR0EsQ0FBQ0EsQ0FBQ0E7SUFDbkJBLENBQUNBO0lBQ0RBLFlBQVlBLEVBQUVBLENBQUNBO0lBR2ZBLE1BQU1BLENBQUNBLENBQUNBLE9BQU9BLENBQUNBLENBQUNBLENBQUNBO1FBQ2hCQSxLQUFLQSxDQUFDQTtZQUNKQSxNQUFNQSxDQUFDQSxVQUFTQSxJQUFTQTtnQkFDdkIsWUFBWSxDQUFDO29CQUNYLFlBQVksRUFBRSxDQUFDO29CQUNmLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ2xCLENBQUMsQ0FBQyxDQUFDO1lBQ0wsQ0FBQyxDQUFD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QXhEQSxVQUF3REE7UUFDdkdBLElBQUlBLEtBQUtBLEdBQUdBLE9BQU9BLElBQUlBLEtBQUtBLFFBQVFBLEdBQUdBLElBQUlBLEdBQUdBLEVBQUVBLENBQUNBO1FBQ2pEQSxFQUFFQSxHQUFHQSxPQUFPQSxJQUFJQSxLQUFLQSxVQUFVQSxHQUFHQSxJQUFJQSxHQUFHQSxLQUFLQSxDQUFDQTtRQUMvQ0EsSUFBSUEsS0FBS0EsR0FBa0RBLE1BQU1BLENBQUNBLEVBQUVBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBO1FBQ3pFQSxJQUFJQSxDQUFDQTtZQUNIQSxJQUFJQSxHQUFHQSxhQUFhQSxDQUFDQSxJQUFJQSxDQUFDQSxDQUFDQTtZQUMzQkEsRUFBRUEsQ0FBQ0EsSUFBSUEsQ0FBQ0EsUUFBUUEsQ0FBQ0EsSUFBSUEsRUFBRUEsS0FBS0EsRUFBRUEsS0FBS0EsQ0FBQ0EsQ0FBQ0E7UUFDdkNBLENBQUVBO1FBQUFBLEtBQUtBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1lBQ1hBLEtBQUtBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1FBQ1hBLENBQUNBO0lBQ0hBLENBQUNBO0lBVWFuRSxlQUFZQSxHQUExQkEsVUFBMkJBLElBQVlBLEVBQUVBLEtBQW9DQTtRQUFwQ29FLHFCQUFvQ0EsR0FBcENBLFVBQW9DQTtRQUMzRUEsSUFBSUEsR0FBR0EsYUFBYUEsQ0FBQ0EsSUFBSUEsQ0FBQ0EsQ0FBQ0E7UUFDM0JBLE1BQU1BLENBQUNBLEVBQUVBLENBQUNBLElBQUlBLENBQUNBLFlBQVlBLENBQUNBLElBQUlBLEVBQUVBLEtBQUtBLENBQUNBLENBQUNBO0lBQzNDQSxDQUFDQTtJQTN2Q2NwRSxPQUFJQSxHQUEyQkEsSUFBSUEsQ0FBQ0E7SUE0dkNyREEsU0FBQ0E7QUFBREEsQ0FBQ0EsQUE3dkNELElBNnZDQztBQUVELGlCQUFTLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBmaWxlID0gcmVxdWlyZSgnLi9maWxlJyk7XG5pbXBvcnQge0FwaUVycm9yLCBFcnJvckNvZGV9IGZyb20gJy4vYXBpX2Vycm9yJztcbmltcG9ydCBmaWxlX3N5c3RlbSA9IHJlcXVpcmUoJy4vZmlsZV9zeXN0ZW0nKTtcbmltcG9ydCB7RmlsZUZsYWd9IGZyb20gJy4vZmlsZV9mbGFnJztcbmltcG9ydCBwYXRoID0gcmVxdWlyZSgncGF0aCcpO1xuaW1wb3J0IHtTdGF0c30gZnJvbSAnLi9ub2RlX2ZzX3N0YXRzJztcblxuXG5kZWNsYXJlIHZhciBfX251bVdhaXRpbmc6IG51bWJlcjtcbmRlY2xhcmUgdmFyIHNldEltbWVkaWF0ZTogKGNiOiBGdW5jdGlvbikgPT4gdm9pZDtcblxuLyoqXG4gKiBXcmFwcyBhIGNhbGxiYWNrIHdpdGggYSBzZXRJbW1lZGlhdGUgY2FsbC5cbiAqIEBwYXJhbSBbRnVuY3Rpb25dIGNiIFRoZSBjYWxsYmFjayB0byB3cmFwLlxuICogQHBhcmFtIFtOdW1iZXJdIG51bUFyZ3MgVGhlIG51bWJlciBvZiBhcmd1bWVudHMgdGhhdCB0aGUgY2FsbGJhY2sgdGFrZXMuXG4gKiBAcmV0dXJuIFtGdW5jdGlvbl0gVGhlIHdyYXBwZWQgY2FsbGJhY2suXG4gKi9cbmZ1bmN0aW9uIHdyYXBDYihjYjogRnVuY3Rpb24sIG51bUFyZ3M6IG51bWJlcik6IEZ1bmN0aW9uIHtcbiAgaWYgKHR5cGVvZiBjYiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnQ2FsbGJhY2sgbXVzdCBiZSBhIGZ1bmN0aW9uLicpO1xuICB9XG4gIC8vIEB0b2RvIFRoaXMgaXMgdXNlZCBmb3IgdW5pdCB0ZXN0aW5nLiBNYXliZSB3ZSBzaG91bGQgaW5qZWN0IHRoaXMgbG9naWNcbiAgLy8gICAgICAgZHluYW1pY2FsbHkgcmF0aGVyIHRoYW4gYnVuZGxlIGl0IGluICdwcm9kdWN0aW9uJyBjb2RlLlxuICBpZiAodHlwZW9mIF9fbnVtV2FpdGluZyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBfX251bVdhaXRpbmcgPSAwO1xuICB9XG4gIF9fbnVtV2FpdGluZysrO1xuICAvLyBXZSBjb3VsZCB1c2UgYGFyZ3VtZW50c2AsIGJ1dCBGdW5jdGlvbi5jYWxsL2FwcGx5IGlzIGV4cGVuc2l2ZS4gQW5kIHdlIG9ubHlcbiAgLy8gbmVlZCB0byBoYW5kbGUgMS0zIGFyZ3VtZW50c1xuICBzd2l0Y2ggKG51bUFyZ3MpIHtcbiAgICBjYXNlIDE6XG4gICAgICByZXR1cm4gZnVuY3Rpb24oYXJnMTogYW55KSB7XG4gICAgICAgIHNldEltbWVkaWF0ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICBfX251bVdhaXRpbmctLTtcbiAgICAgICAgICByZXR1cm4gY2IoYXJnMSk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICBjYXNlIDI6XG4gICAgICByZXR1cm4gZnVuY3Rpb24oYXJnMTogYW55LCBhcmcyOiBhbnkpIHtcbiAgICAgICAgc2V0SW1tZWRpYXRlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIF9fbnVtV2FpdGluZy0tO1xuICAgICAgICAgIHJldHVybiBjYihhcmcxLCBhcmcyKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBmdW5jdGlvbihhcmcxOiBhbnksIGFyZzI6IGFueSwgYXJnMzogYW55KSB7XG4gICAgICAgIHNldEltbWVkaWF0ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICBfX251bVdhaXRpbmctLTtcbiAgICAgICAgICByZXR1cm4gY2IoYXJnMSwgYXJnMiwgYXJnMyk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGludm9jYXRpb24gb2Ygd3JhcENiLicpO1xuICB9XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSBmZCBpcyB2YWxpZC5cbiAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkIEEgZmlsZSBkZXNjcmlwdG9yIChpbiBCcm93c2VyRlMsIGl0J3MgYSBGaWxlIG9iamVjdClcbiAqIEByZXR1cm4gW0Jvb2xlYW4sIEJyb3dzZXJGUy5BcGlFcnJvcl0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIEZEIGlzIE9LLFxuICogICBvdGhlcndpc2UgcmV0dXJucyBhbiBBcGlFcnJvci5cbiAqL1xuZnVuY3Rpb24gY2hlY2tGZChmZDogZmlsZS5GaWxlKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgZmRbJ3dyaXRlJ10gIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVCQURGLCAnSW52YWxpZCBmaWxlIGRlc2NyaXB0b3IuJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplTW9kZShtb2RlOiBhbnksIGRlZjogbnVtYmVyKTogbnVtYmVyIHtcbiAgc3dpdGNoKHR5cGVvZiBtb2RlKSB7XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIC8vIChwYXRoLCBmbGFnLCBtb2RlLCBjYj8pXG4gICAgICByZXR1cm4gbW9kZTtcbiAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgLy8gKHBhdGgsIGZsYWcsIG1vZGVTdHJpbmcsIGNiPylcbiAgICAgIHZhciB0cnVlTW9kZSA9IHBhcnNlSW50KG1vZGUsIDgpO1xuICAgICAgaWYgKHRydWVNb2RlICE9PSBOYU4pIHtcbiAgICAgICAgcmV0dXJuIHRydWVNb2RlO1xuICAgICAgfVxuICAgICAgLy8gRkFMTCBUSFJPVUdIIGlmIG1vZGUgaXMgYW4gaW52YWxpZCBzdHJpbmchXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBkZWY7XG4gIH1cbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplUGF0aChwOiBzdHJpbmcpOiBzdHJpbmcge1xuICAvLyBOb2RlIGRvZXNuJ3QgYWxsb3cgbnVsbCBjaGFyYWN0ZXJzIGluIHBhdGhzLlxuICBpZiAocC5pbmRleE9mKCdcXHUwMDAwJykgPj0gMCkge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnUGF0aCBtdXN0IGJlIGEgc3RyaW5nIHdpdGhvdXQgbnVsbCBieXRlcy4nKTtcbiAgfSBlbHNlIGlmIChwID09PSAnJykge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnUGF0aCBtdXN0IG5vdCBiZSBlbXB0eS4nKTtcbiAgfVxuICByZXR1cm4gcGF0aC5yZXNvbHZlKHApO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVPcHRpb25zKG9wdGlvbnM6IGFueSwgZGVmRW5jOiBzdHJpbmcsIGRlZkZsYWc6IHN0cmluZywgZGVmTW9kZTogbnVtYmVyKToge2VuY29kaW5nOiBzdHJpbmc7IGZsYWc6IHN0cmluZzsgbW9kZTogbnVtYmVyfSB7XG4gIHN3aXRjaCAodHlwZW9mIG9wdGlvbnMpIHtcbiAgICBjYXNlICdvYmplY3QnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZW5jb2Rpbmc6IHR5cGVvZiBvcHRpb25zWydlbmNvZGluZyddICE9PSAndW5kZWZpbmVkJyA/IG9wdGlvbnNbJ2VuY29kaW5nJ10gOiBkZWZFbmMsXG4gICAgICAgIGZsYWc6IHR5cGVvZiBvcHRpb25zWydmbGFnJ10gIT09ICd1bmRlZmluZWQnID8gb3B0aW9uc1snZmxhZyddIDogZGVmRmxhZyxcbiAgICAgICAgbW9kZTogbm9ybWFsaXplTW9kZShvcHRpb25zWydtb2RlJ10sIGRlZk1vZGUpXG4gICAgICB9O1xuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBlbmNvZGluZzogb3B0aW9ucyxcbiAgICAgICAgZmxhZzogZGVmRmxhZyxcbiAgICAgICAgbW9kZTogZGVmTW9kZVxuICAgICAgfTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZW5jb2Rpbmc6IGRlZkVuYyxcbiAgICAgICAgZmxhZzogZGVmRmxhZyxcbiAgICAgICAgbW9kZTogZGVmTW9kZVxuICAgICAgfTtcbiAgfVxufVxuXG4vLyBUaGUgZGVmYXVsdCBjYWxsYmFjayBpcyBhIE5PUC5cbmZ1bmN0aW9uIG5vcENiKCkge307XG5cbi8qKlxuICogVGhlIG5vZGUgZnJvbnRlbmQgdG8gYWxsIGZpbGVzeXN0ZW1zLlxuICogVGhpcyBsYXllciBoYW5kbGVzOlxuICpcbiAqICogU2FuaXR5IGNoZWNraW5nIGlucHV0cy5cbiAqICogTm9ybWFsaXppbmcgcGF0aHMuXG4gKiAqIFJlc2V0dGluZyBzdGFjayBkZXB0aCBmb3IgYXN5bmNocm9ub3VzIG9wZXJhdGlvbnMgd2hpY2ggbWF5IG5vdCBnbyB0aHJvdWdoXG4gKiAgIHRoZSBicm93c2VyIGJ5IHdyYXBwaW5nIGFsbCBpbnB1dCBjYWxsYmFja3MgdXNpbmcgYHNldEltbWVkaWF0ZWAuXG4gKiAqIFBlcmZvcm1pbmcgdGhlIHJlcXVlc3RlZCBvcGVyYXRpb24gdGhyb3VnaCB0aGUgZmlsZXN5c3RlbSBvciB0aGUgZmlsZVxuICogICBkZXNjcmlwdG9yLCBhcyBhcHByb3ByaWF0ZS5cbiAqICogSGFuZGxpbmcgb3B0aW9uYWwgYXJndW1lbnRzIGFuZCBzZXR0aW5nIGRlZmF1bHQgYXJndW1lbnRzLlxuICogQHNlZSBodHRwOi8vbm9kZWpzLm9yZy9hcGkvZnMuaHRtbFxuICogQGNsYXNzXG4gKi9cbmNsYXNzIGZzIHtcbiAgcHJpdmF0ZSBzdGF0aWMgcm9vdDogZmlsZV9zeXN0ZW0uRmlsZVN5c3RlbSA9IG51bGw7XG5cbiAgcHVibGljIHN0YXRpYyBfaW5pdGlhbGl6ZShyb290RlM6IGZpbGVfc3lzdGVtLkZpbGVTeXN0ZW0pOiBmaWxlX3N5c3RlbS5GaWxlU3lzdGVtIHtcbiAgICBpZiAoISg8YW55PiByb290RlMpLmNvbnN0cnVjdG9yLmlzQXZhaWxhYmxlKCkpIHtcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnVHJpZWQgdG8gaW5zdGFudGlhdGUgQnJvd3NlckZTIHdpdGggYW4gdW5hdmFpbGFibGUgZmlsZSBzeXN0ZW0uJyk7XG4gICAgfVxuICAgIHJldHVybiBmcy5yb290ID0gcm9vdEZTO1xuICB9XG5cbiAgLyoqXG4gICAqIGNvbnZlcnRzIERhdGUgb3IgbnVtYmVyIHRvIGEgZnJhY3Rpb25hbCBVTklYIHRpbWVzdGFtcFxuICAgKiBHcmFiYmVkIGZyb20gTm9kZUpTIHNvdXJjZXMgKGxpYi9mcy5qcylcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgX3RvVW5peFRpbWVzdGFtcCh0aW1lOiBEYXRlKTogbnVtYmVyO1xuICBwdWJsaWMgc3RhdGljIF90b1VuaXhUaW1lc3RhbXAodGltZTogbnVtYmVyKTogbnVtYmVyO1xuICBwdWJsaWMgc3RhdGljIF90b1VuaXhUaW1lc3RhbXAodGltZTogYW55KTogbnVtYmVyIHtcbiAgICBpZiAodHlwZW9mIHRpbWUgPT09ICdudW1iZXInKSB7XG4gICAgICByZXR1cm4gdGltZTtcbiAgICB9IGVsc2UgaWYgKHRpbWUgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICByZXR1cm4gdGltZS5nZXRUaW1lKCkgLyAxMDAwO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgcGFyc2UgdGltZTogXCIgKyB0aW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiAqKk5PTlNUQU5EQVJEKio6IEdyYWIgdGhlIEZpbGVTeXN0ZW0gaW5zdGFuY2UgdGhhdCBiYWNrcyB0aGlzIEFQSS5cbiAgICogQHJldHVybiBbQnJvd3NlckZTLkZpbGVTeXN0ZW0gfCBudWxsXSBSZXR1cm5zIG51bGwgaWYgdGhlIGZpbGUgc3lzdGVtIGhhc1xuICAgKiAgIG5vdCBiZWVuIGluaXRpYWxpemVkLlxuICAgKi9cbiAgcHVibGljIHN0YXRpYyBnZXRSb290RlMoKTogZmlsZV9zeXN0ZW0uRmlsZVN5c3RlbSB7XG4gICAgaWYgKGZzLnJvb3QpIHtcbiAgICAgIHJldHVybiBmcy5yb290O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvLyBGSUxFIE9SIERJUkVDVE9SWSBNRVRIT0RTXG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyByZW5hbWUuIE5vIGFyZ3VtZW50cyBvdGhlciB0aGFuIGEgcG9zc2libGUgZXhjZXB0aW9uIGFyZSBnaXZlblxuICAgKiB0byB0aGUgY29tcGxldGlvbiBjYWxsYmFjay5cbiAgICogQHBhcmFtIFtTdHJpbmddIG9sZFBhdGhcbiAgICogQHBhcmFtIFtTdHJpbmddIG5ld1BhdGhcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHN0YXRpYyByZW5hbWUob2xkUGF0aDogc3RyaW5nLCBuZXdQYXRoOiBzdHJpbmcsIGNiOiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IDwoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQ+IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIGZzLnJvb3QucmVuYW1lKG5vcm1hbGl6ZVBhdGgob2xkUGF0aCksIG5vcm1hbGl6ZVBhdGgobmV3UGF0aCksIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgcmVuYW1lLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gb2xkUGF0aFxuICAgKiBAcGFyYW0gW1N0cmluZ10gbmV3UGF0aFxuICAgKi9cbiAgcHVibGljIHN0YXRpYyByZW5hbWVTeW5jKG9sZFBhdGg6IHN0cmluZywgbmV3UGF0aDogc3RyaW5nKTogdm9pZCB7XG4gICAgZnMucm9vdC5yZW5hbWVTeW5jKG5vcm1hbGl6ZVBhdGgob2xkUGF0aCksIG5vcm1hbGl6ZVBhdGgobmV3UGF0aCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRlc3Qgd2hldGhlciBvciBub3QgdGhlIGdpdmVuIHBhdGggZXhpc3RzIGJ5IGNoZWNraW5nIHdpdGggdGhlIGZpbGUgc3lzdGVtLlxuICAgKiBUaGVuIGNhbGwgdGhlIGNhbGxiYWNrIGFyZ3VtZW50IHdpdGggZWl0aGVyIHRydWUgb3IgZmFsc2UuXG4gICAqIEBleGFtcGxlIFNhbXBsZSBpbnZvY2F0aW9uXG4gICAqICAgZnMuZXhpc3RzKCcvZXRjL3Bhc3N3ZCcsIGZ1bmN0aW9uIChleGlzdHMpIHtcbiAgICogICAgIHV0aWwuZGVidWcoZXhpc3RzID8gXCJpdCdzIHRoZXJlXCIgOiBcIm5vIHBhc3N3ZCFcIik7XG4gICAqICAgfSk7XG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQm9vbGVhbildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGV4aXN0cyhwYXRoOiBzdHJpbmcsIGNiOiAoZXhpc3RzOiBib29sZWFuKSA9PiB2b2lkID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSA8KGV4aXN0czogYm9vbGVhbikgPT4gdm9pZD4gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGZzLnJvb3QuZXhpc3RzKG5vcm1hbGl6ZVBhdGgocGF0aCksIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBEb2Vzbid0IHJldHVybiBhbiBlcnJvci4gSWYgc29tZXRoaW5nIGJhZCBoYXBwZW5zLCB3ZSBhc3N1bWUgaXQganVzdFxuICAgICAgLy8gZG9lc24ndCBleGlzdC5cbiAgICAgIHJldHVybiBuZXdDYihmYWxzZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRlc3Qgd2hldGhlciBvciBub3QgdGhlIGdpdmVuIHBhdGggZXhpc3RzIGJ5IGNoZWNraW5nIHdpdGggdGhlIGZpbGUgc3lzdGVtLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcmV0dXJuIFtib29sZWFuXVxuICAgKi9cbiAgcHVibGljIHN0YXRpYyBleGlzdHNTeW5jKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gZnMucm9vdC5leGlzdHNTeW5jKG5vcm1hbGl6ZVBhdGgocGF0aCkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIERvZXNuJ3QgcmV0dXJuIGFuIGVycm9yLiBJZiBzb21ldGhpbmcgYmFkIGhhcHBlbnMsIHdlIGFzc3VtZSBpdCBqdXN0XG4gICAgICAvLyBkb2Vzbid0IGV4aXN0LlxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYHN0YXRgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvciwgQnJvd3NlckZTLm5vZGUuZnMuU3RhdHMpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHN0YXRpYyBzdGF0KHBhdGg6IHN0cmluZywgY2I6IChlcnI6IEFwaUVycm9yLCBzdGF0cz86IFN0YXRzKSA9PiBhbnkgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IDwoZXJyOiBBcGlFcnJvciwgc3RhdHM/OiBTdGF0cykgPT4gYW55PiB3cmFwQ2IoY2IsIDIpO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gZnMucm9vdC5zdGF0KG5vcm1hbGl6ZVBhdGgocGF0aCksIGZhbHNlLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIG5ld0NiKGUsIG51bGwpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgc3RhdGAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEByZXR1cm4gW0Jyb3dzZXJGUy5ub2RlLmZzLlN0YXRzXVxuICAgKi9cbiAgcHVibGljIHN0YXRpYyBzdGF0U3luYyhwYXRoOiBzdHJpbmcpOiBTdGF0cyB7XG4gICAgcmV0dXJuIGZzLnJvb3Quc3RhdFN5bmMobm9ybWFsaXplUGF0aChwYXRoKSwgZmFsc2UpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgbHN0YXRgLlxuICAgKiBgbHN0YXQoKWAgaXMgaWRlbnRpY2FsIHRvIGBzdGF0KClgLCBleGNlcHQgdGhhdCBpZiBwYXRoIGlzIGEgc3ltYm9saWMgbGluayxcbiAgICogdGhlbiB0aGUgbGluayBpdHNlbGYgaXMgc3RhdC1lZCwgbm90IHRoZSBmaWxlIHRoYXQgaXQgcmVmZXJzIHRvLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvciwgQnJvd3NlckZTLm5vZGUuZnMuU3RhdHMpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHN0YXRpYyBsc3RhdChwYXRoOiBzdHJpbmcsIGNiOiAoZXJyOiBBcGlFcnJvciwgc3RhdHM/OiBTdGF0cykgPT4gYW55ID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSA8KGVycjogQXBpRXJyb3IsIHN0YXRzPzogU3RhdHMpID0+IGFueT4gd3JhcENiKGNiLCAyKTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGZzLnJvb3Quc3RhdChub3JtYWxpemVQYXRoKHBhdGgpLCB0cnVlLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIG5ld0NiKGUsIG51bGwpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgbHN0YXRgLlxuICAgKiBgbHN0YXQoKWAgaXMgaWRlbnRpY2FsIHRvIGBzdGF0KClgLCBleGNlcHQgdGhhdCBpZiBwYXRoIGlzIGEgc3ltYm9saWMgbGluayxcbiAgICogdGhlbiB0aGUgbGluayBpdHNlbGYgaXMgc3RhdC1lZCwgbm90IHRoZSBmaWxlIHRoYXQgaXQgcmVmZXJzIHRvLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcmV0dXJuIFtCcm93c2VyRlMubm9kZS5mcy5TdGF0c11cbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgbHN0YXRTeW5jKHBhdGg6IHN0cmluZyk6IFN0YXRzIHtcbiAgICByZXR1cm4gZnMucm9vdC5zdGF0U3luYyhub3JtYWxpemVQYXRoKHBhdGgpLCB0cnVlKTtcbiAgfVxuXG4gIC8vIEZJTEUtT05MWSBNRVRIT0RTXG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgdHJ1bmNhdGVgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW051bWJlcl0gbGVuXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgdHJ1bmNhdGUocGF0aDogc3RyaW5nLCBjYj86IEZ1bmN0aW9uKTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyB0cnVuY2F0ZShwYXRoOiBzdHJpbmcsIGxlbjogbnVtYmVyLCBjYj86IEZ1bmN0aW9uKTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyB0cnVuY2F0ZShwYXRoOiBzdHJpbmcsIGFyZzI6IGFueSA9IDAsIGNiOiBGdW5jdGlvbiA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIGxlbiA9IDA7XG4gICAgaWYgKHR5cGVvZiBhcmcyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYiA9IGFyZzI7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgYXJnMiA9PT0gJ251bWJlcicpIHtcbiAgICAgIGxlbiA9IGFyZzI7XG4gICAgfVxuXG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgaWYgKGxlbiA8IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZzLnJvb3QudHJ1bmNhdGUobm9ybWFsaXplUGF0aChwYXRoKSwgbGVuLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgdHJ1bmNhdGVgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW051bWJlcl0gbGVuXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIHRydW5jYXRlU3luYyhwYXRoOiBzdHJpbmcsIGxlbjogbnVtYmVyID0gMCk6IHZvaWQge1xuICAgIGlmIChsZW4gPCAwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCk7XG4gICAgfVxuICAgIHJldHVybiBmcy5yb290LnRydW5jYXRlU3luYyhub3JtYWxpemVQYXRoKHBhdGgpLCBsZW4pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBgdW5saW5rYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHN0YXRpYyB1bmxpbmsocGF0aDogc3RyaW5nLCBjYjogRnVuY3Rpb24gPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBmcy5yb290LnVubGluayhub3JtYWxpemVQYXRoKHBhdGgpLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgdW5saW5rYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgdW5saW5rU3luYyhwYXRoOiBzdHJpbmcpOiB2b2lkIHtcbiAgICByZXR1cm4gZnMucm9vdC51bmxpbmtTeW5jKG5vcm1hbGl6ZVBhdGgocGF0aCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBmaWxlIG9wZW4uXG4gICAqIEV4Y2x1c2l2ZSBtb2RlIGVuc3VyZXMgdGhhdCBwYXRoIGlzIG5ld2x5IGNyZWF0ZWQuXG4gICAqXG4gICAqIGBmbGFnc2AgY2FuIGJlOlxuICAgKlxuICAgKiAqIGAncidgIC0gT3BlbiBmaWxlIGZvciByZWFkaW5nLiBBbiBleGNlcHRpb24gb2NjdXJzIGlmIHRoZSBmaWxlIGRvZXMgbm90IGV4aXN0LlxuICAgKiAqIGAncisnYCAtIE9wZW4gZmlsZSBmb3IgcmVhZGluZyBhbmQgd3JpdGluZy4gQW4gZXhjZXB0aW9uIG9jY3VycyBpZiB0aGUgZmlsZSBkb2VzIG5vdCBleGlzdC5cbiAgICogKiBgJ3JzJ2AgLSBPcGVuIGZpbGUgZm9yIHJlYWRpbmcgaW4gc3luY2hyb25vdXMgbW9kZS4gSW5zdHJ1Y3RzIHRoZSBmaWxlc3lzdGVtIHRvIG5vdCBjYWNoZSB3cml0ZXMuXG4gICAqICogYCdycysnYCAtIE9wZW4gZmlsZSBmb3IgcmVhZGluZyBhbmQgd3JpdGluZywgYW5kIG9wZW5zIHRoZSBmaWxlIGluIHN5bmNocm9ub3VzIG1vZGUuXG4gICAqICogYCd3J2AgLSBPcGVuIGZpbGUgZm9yIHdyaXRpbmcuIFRoZSBmaWxlIGlzIGNyZWF0ZWQgKGlmIGl0IGRvZXMgbm90IGV4aXN0KSBvciB0cnVuY2F0ZWQgKGlmIGl0IGV4aXN0cykuXG4gICAqICogYCd3eCdgIC0gTGlrZSAndycgYnV0IG9wZW5zIHRoZSBmaWxlIGluIGV4Y2x1c2l2ZSBtb2RlLlxuICAgKiAqIGAndysnYCAtIE9wZW4gZmlsZSBmb3IgcmVhZGluZyBhbmQgd3JpdGluZy4gVGhlIGZpbGUgaXMgY3JlYXRlZCAoaWYgaXQgZG9lcyBub3QgZXhpc3QpIG9yIHRydW5jYXRlZCAoaWYgaXQgZXhpc3RzKS5cbiAgICogKiBgJ3d4KydgIC0gTGlrZSAndysnIGJ1dCBvcGVucyB0aGUgZmlsZSBpbiBleGNsdXNpdmUgbW9kZS5cbiAgICogKiBgJ2EnYCAtIE9wZW4gZmlsZSBmb3IgYXBwZW5kaW5nLiBUaGUgZmlsZSBpcyBjcmVhdGVkIGlmIGl0IGRvZXMgbm90IGV4aXN0LlxuICAgKiAqIGAnYXgnYCAtIExpa2UgJ2EnIGJ1dCBvcGVucyB0aGUgZmlsZSBpbiBleGNsdXNpdmUgbW9kZS5cbiAgICogKiBgJ2ErJ2AgLSBPcGVuIGZpbGUgZm9yIHJlYWRpbmcgYW5kIGFwcGVuZGluZy4gVGhlIGZpbGUgaXMgY3JlYXRlZCBpZiBpdCBkb2VzIG5vdCBleGlzdC5cbiAgICogKiBgJ2F4KydgIC0gTGlrZSAnYSsnIGJ1dCBvcGVucyB0aGUgZmlsZSBpbiBleGNsdXNpdmUgbW9kZS5cbiAgICpcbiAgICogQHNlZSBodHRwOi8vd3d3Lm1hbnBhZ2V6LmNvbS9tYW4vMi9vcGVuL1xuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW1N0cmluZ10gZmxhZ3NcbiAgICogQHBhcmFtIFtOdW1iZXI/XSBtb2RlIGRlZmF1bHRzIHRvIGAwNjQ0YFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvciwgQnJvd3NlckZTLkZpbGUpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHN0YXRpYyBvcGVuKHBhdGg6IHN0cmluZywgZmxhZzogc3RyaW5nLCBjYj86IChlcnI6IEFwaUVycm9yLCBmZD86IGZpbGUuRmlsZSkgPT4gYW55KTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyBvcGVuKHBhdGg6IHN0cmluZywgZmxhZzogc3RyaW5nLCBtb2RlOiBzdHJpbmcsIGNiPzogKGVycjogQXBpRXJyb3IsIGZkPzogZmlsZS5GaWxlKSA9PiBhbnkpOiB2b2lkO1xuICBwdWJsaWMgc3RhdGljIG9wZW4ocGF0aDogc3RyaW5nLCBmbGFnOiBzdHJpbmcsIG1vZGU6IG51bWJlciwgY2I/OiAoZXJyOiBBcGlFcnJvciwgZmQ/OiBmaWxlLkZpbGUpID0+IGFueSk6IHZvaWQ7XG4gIHB1YmxpYyBzdGF0aWMgb3BlbihwYXRoOiBzdHJpbmcsIGZsYWc6IHN0cmluZywgYXJnMj86IGFueSwgY2I6IChlcnI6IEFwaUVycm9yLCBmZD86IGZpbGUuRmlsZSkgPT4gYW55ID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbW9kZSA9IG5vcm1hbGl6ZU1vZGUoYXJnMiwgMHgxYTQpO1xuICAgIGNiID0gdHlwZW9mIGFyZzIgPT09ICdmdW5jdGlvbicgPyBhcmcyIDogY2I7XG4gICAgdmFyIG5ld0NiID0gPChlcnI6IEFwaUVycm9yLCBmZD86IGZpbGUuRmlsZSkgPT4gYW55PiB3cmFwQ2IoY2IsIDIpO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gZnMucm9vdC5vcGVuKG5vcm1hbGl6ZVBhdGgocGF0aCksIEZpbGVGbGFnLmdldEZpbGVGbGFnKGZsYWcpLCBtb2RlLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIG5ld0NiKGUsIG51bGwpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBmaWxlIG9wZW4uXG4gICAqIEBzZWUgaHR0cDovL3d3dy5tYW5wYWdlei5jb20vbWFuLzIvb3Blbi9cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtTdHJpbmddIGZsYWdzXG4gICAqIEBwYXJhbSBbTnVtYmVyP10gbW9kZSBkZWZhdWx0cyB0byBgMDY0NGBcbiAgICogQHJldHVybiBbQnJvd3NlckZTLkZpbGVdXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIG9wZW5TeW5jKHBhdGg6IHN0cmluZywgZmxhZzogc3RyaW5nLCBtb2RlPzogc3RyaW5nKTogZmlsZS5GaWxlO1xuICBwdWJsaWMgc3RhdGljIG9wZW5TeW5jKHBhdGg6IHN0cmluZywgZmxhZzogc3RyaW5nLCBtb2RlPzogbnVtYmVyKTogZmlsZS5GaWxlO1xuICBwdWJsaWMgc3RhdGljIG9wZW5TeW5jKHBhdGg6IHN0cmluZywgZmxhZzogc3RyaW5nLCBtb2RlOiBhbnkgPSAweDFhNCk6IGZpbGUuRmlsZSB7XG4gICAgcmV0dXJuIGZzLnJvb3Qub3BlblN5bmMobm9ybWFsaXplUGF0aChwYXRoKSwgRmlsZUZsYWcuZ2V0RmlsZUZsYWcoZmxhZyksIG1vZGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91c2x5IHJlYWRzIHRoZSBlbnRpcmUgY29udGVudHMgb2YgYSBmaWxlLlxuICAgKiBAZXhhbXBsZSBVc2FnZSBleGFtcGxlXG4gICAqICAgZnMucmVhZEZpbGUoJy9ldGMvcGFzc3dkJywgZnVuY3Rpb24gKGVyciwgZGF0YSkge1xuICAgKiAgICAgaWYgKGVycikgdGhyb3cgZXJyO1xuICAgKiAgICAgY29uc29sZS5sb2coZGF0YSk7XG4gICAqICAgfSk7XG4gICAqIEBwYXJhbSBbU3RyaW5nXSBmaWxlbmFtZVxuICAgKiBAcGFyYW0gW09iamVjdD9dIG9wdGlvbnNcbiAgICogQG9wdGlvbiBvcHRpb25zIFtTdHJpbmddIGVuY29kaW5nIFRoZSBzdHJpbmcgZW5jb2RpbmcgZm9yIHRoZSBmaWxlIGNvbnRlbnRzLiBEZWZhdWx0cyB0byBgbnVsbGAuXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbU3RyaW5nXSBmbGFnIERlZmF1bHRzIHRvIGAncidgLlxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvciwgU3RyaW5nIHwgQnJvd3NlckZTLm5vZGUuQnVmZmVyKV0gY2FsbGJhY2sgSWYgbm8gZW5jb2RpbmcgaXMgc3BlY2lmaWVkLCB0aGVuIHRoZSByYXcgYnVmZmVyIGlzIHJldHVybmVkLlxuICAgKi9cbiAgcHVibGljIHN0YXRpYyByZWFkRmlsZShmaWxlbmFtZTogc3RyaW5nLCBjYj86IChlcnI6IEFwaUVycm9yLCBkYXRhPzogYW55KSA9PiB2b2lkICk6IHZvaWQ7XG4gIHB1YmxpYyBzdGF0aWMgcmVhZEZpbGUoZmlsZW5hbWU6IHN0cmluZywgb3B0aW9uczoge1tvcHQ6IHN0cmluZ106IGFueX0sIGNiPzogKGVycjogQXBpRXJyb3IsIGRhdGE/OiBhbnkpID0+IHZvaWQgKTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyByZWFkRmlsZShmaWxlbmFtZTogc3RyaW5nLCBlbmNvZGluZzogc3RyaW5nLCBjYj86IChlcnI6IEFwaUVycm9yLCBkYXRhPzogYW55KSA9PiB2b2lkICk6IHZvaWQ7XG4gIHB1YmxpYyBzdGF0aWMgcmVhZEZpbGUoZmlsZW5hbWU6IHN0cmluZywgYXJnMjogYW55ID0ge30sIGNiOiAoZXJyOiBBcGlFcnJvciwgZGF0YT86IGFueSkgPT4gdm9pZCA9IG5vcENiICkge1xuICAgIHZhciBvcHRpb25zID0gbm9ybWFsaXplT3B0aW9ucyhhcmcyLCBudWxsLCAncicsIG51bGwpO1xuICAgIGNiID0gdHlwZW9mIGFyZzIgPT09ICdmdW5jdGlvbicgPyBhcmcyIDogY2I7XG4gICAgdmFyIG5ld0NiID0gPChlcnI6IEFwaUVycm9yLCBkYXRhPzogYW55KSA9PiB2b2lkPiB3cmFwQ2IoY2IsIDIpO1xuICAgIHRyeSB7XG4gICAgICB2YXIgZmxhZyA9IEZpbGVGbGFnLmdldEZpbGVGbGFnKG9wdGlvbnNbJ2ZsYWcnXSk7XG4gICAgICBpZiAoIWZsYWcuaXNSZWFkYWJsZSgpKSB7XG4gICAgICAgIHJldHVybiBuZXdDYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgJ0ZsYWcgcGFzc2VkIHRvIHJlYWRGaWxlIG11c3QgYWxsb3cgZm9yIHJlYWRpbmcuJykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZzLnJvb3QucmVhZEZpbGUobm9ybWFsaXplUGF0aChmaWxlbmFtZSksIG9wdGlvbnMuZW5jb2RpbmcsIGZsYWcsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gbmV3Q2IoZSwgbnVsbCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzbHkgcmVhZHMgdGhlIGVudGlyZSBjb250ZW50cyBvZiBhIGZpbGUuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBmaWxlbmFtZVxuICAgKiBAcGFyYW0gW09iamVjdD9dIG9wdGlvbnNcbiAgICogQG9wdGlvbiBvcHRpb25zIFtTdHJpbmddIGVuY29kaW5nIFRoZSBzdHJpbmcgZW5jb2RpbmcgZm9yIHRoZSBmaWxlIGNvbnRlbnRzLiBEZWZhdWx0cyB0byBgbnVsbGAuXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbU3RyaW5nXSBmbGFnIERlZmF1bHRzIHRvIGAncidgLlxuICAgKiBAcmV0dXJuIFtTdHJpbmcgfCBCcm93c2VyRlMubm9kZS5CdWZmZXJdXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIHJlYWRGaWxlU3luYyhmaWxlbmFtZTogc3RyaW5nLCBlbmNvZGluZz86IHN0cmluZyk6IE5vZGVCdWZmZXI7XG4gIHB1YmxpYyBzdGF0aWMgcmVhZEZpbGVTeW5jKGZpbGVuYW1lOiBzdHJpbmcsIG9wdGlvbnM/OiB7IGVuY29kaW5nPzogc3RyaW5nOyBmbGFnPzogc3RyaW5nOyB9KTogTm9kZUJ1ZmZlcjtcbiAgcHVibGljIHN0YXRpYyByZWFkRmlsZVN5bmMoZmlsZW5hbWU6IHN0cmluZywgYXJnMjogYW55ID0ge30pOiBOb2RlQnVmZmVyIHtcbiAgICB2YXIgb3B0aW9ucyA9IG5vcm1hbGl6ZU9wdGlvbnMoYXJnMiwgbnVsbCwgJ3InLCBudWxsKTtcbiAgICB2YXIgZmxhZyA9IEZpbGVGbGFnLmdldEZpbGVGbGFnKG9wdGlvbnMuZmxhZyk7XG4gICAgaWYgKCFmbGFnLmlzUmVhZGFibGUoKSkge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsICdGbGFnIHBhc3NlZCB0byByZWFkRmlsZSBtdXN0IGFsbG93IGZvciByZWFkaW5nLicpO1xuICAgIH1cbiAgICByZXR1cm4gZnMucm9vdC5yZWFkRmlsZVN5bmMobm9ybWFsaXplUGF0aChmaWxlbmFtZSksIG9wdGlvbnMuZW5jb2RpbmcsIGZsYWcpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91c2x5IHdyaXRlcyBkYXRhIHRvIGEgZmlsZSwgcmVwbGFjaW5nIHRoZSBmaWxlIGlmIGl0IGFscmVhZHlcbiAgICogZXhpc3RzLlxuICAgKlxuICAgKiBUaGUgZW5jb2Rpbmcgb3B0aW9uIGlzIGlnbm9yZWQgaWYgZGF0YSBpcyBhIGJ1ZmZlci5cbiAgICpcbiAgICogQGV4YW1wbGUgVXNhZ2UgZXhhbXBsZVxuICAgKiAgIGZzLndyaXRlRmlsZSgnbWVzc2FnZS50eHQnLCAnSGVsbG8gTm9kZScsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICogICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICogICAgIGNvbnNvbGUubG9nKCdJdFxcJ3Mgc2F2ZWQhJyk7XG4gICAqICAgfSk7XG4gICAqIEBwYXJhbSBbU3RyaW5nXSBmaWxlbmFtZVxuICAgKiBAcGFyYW0gW1N0cmluZyB8IEJyb3dzZXJGUy5ub2RlLkJ1ZmZlcl0gZGF0YVxuICAgKiBAcGFyYW0gW09iamVjdD9dIG9wdGlvbnNcbiAgICogQG9wdGlvbiBvcHRpb25zIFtTdHJpbmddIGVuY29kaW5nIERlZmF1bHRzIHRvIGAndXRmOCdgLlxuICAgKiBAb3B0aW9uIG9wdGlvbnMgW051bWJlcl0gbW9kZSBEZWZhdWx0cyB0byBgMDY0NGAuXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbU3RyaW5nXSBmbGFnIERlZmF1bHRzIHRvIGAndydgLlxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIHdyaXRlRmlsZShmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGNiPzogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyB3cml0ZUZpbGUoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogYW55LCBlbmNvZGluZz86IHN0cmluZywgY2I/OiAoZXJyPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgc3RhdGljIHdyaXRlRmlsZShmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIG9wdGlvbnM/OiBPYmplY3QsIGNiPzogKGVycj86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyB3cml0ZUZpbGUoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogYW55LCBhcmczOiBhbnkgPSB7fSwgY2I6IChlcnI/OiBBcGlFcnJvcikgPT4gdm9pZCA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG9wdGlvbnMgPSBub3JtYWxpemVPcHRpb25zKGFyZzMsICd1dGY4JywgJ3cnLCAweDFhNCk7XG4gICAgY2IgPSB0eXBlb2YgYXJnMyA9PT0gJ2Z1bmN0aW9uJyA/IGFyZzMgOiBjYjtcbiAgICB2YXIgbmV3Q2IgPSA8KGVycj86IEFwaUVycm9yKSA9PiB2b2lkPiB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICB2YXIgZmxhZyA9IEZpbGVGbGFnLmdldEZpbGVGbGFnKG9wdGlvbnMuZmxhZyk7XG4gICAgICBpZiAoIWZsYWcuaXNXcml0ZWFibGUoKSkge1xuICAgICAgICByZXR1cm4gbmV3Q2IobmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsICdGbGFnIHBhc3NlZCB0byB3cml0ZUZpbGUgbXVzdCBhbGxvdyBmb3Igd3JpdGluZy4nKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZnMucm9vdC53cml0ZUZpbGUobm9ybWFsaXplUGF0aChmaWxlbmFtZSksIGRhdGEsIG9wdGlvbnMuZW5jb2RpbmcsIGZsYWcsIG9wdGlvbnMubW9kZSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXNseSB3cml0ZXMgZGF0YSB0byBhIGZpbGUsIHJlcGxhY2luZyB0aGUgZmlsZSBpZiBpdCBhbHJlYWR5XG4gICAqIGV4aXN0cy5cbiAgICpcbiAgICogVGhlIGVuY29kaW5nIG9wdGlvbiBpcyBpZ25vcmVkIGlmIGRhdGEgaXMgYSBidWZmZXIuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBmaWxlbmFtZVxuICAgKiBAcGFyYW0gW1N0cmluZyB8IEJyb3dzZXJGUy5ub2RlLkJ1ZmZlcl0gZGF0YVxuICAgKiBAcGFyYW0gW09iamVjdD9dIG9wdGlvbnNcbiAgICogQG9wdGlvbiBvcHRpb25zIFtTdHJpbmddIGVuY29kaW5nIERlZmF1bHRzIHRvIGAndXRmOCdgLlxuICAgKiBAb3B0aW9uIG9wdGlvbnMgW051bWJlcl0gbW9kZSBEZWZhdWx0cyB0byBgMDY0NGAuXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbU3RyaW5nXSBmbGFnIERlZmF1bHRzIHRvIGAndydgLlxuICAgKi9cbiAgcHVibGljIHN0YXRpYyB3cml0ZUZpbGVTeW5jKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgb3B0aW9ucz86IE9iamVjdCk6IHZvaWQ7XG4gIHB1YmxpYyBzdGF0aWMgd3JpdGVGaWxlU3luYyhmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGVuY29kaW5nPzogc3RyaW5nKTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyB3cml0ZUZpbGVTeW5jKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgYXJnMz86IGFueSk6IHZvaWQge1xuICAgIHZhciBvcHRpb25zID0gbm9ybWFsaXplT3B0aW9ucyhhcmczLCAndXRmOCcsICd3JywgMHgxYTQpO1xuICAgIHZhciBmbGFnID0gRmlsZUZsYWcuZ2V0RmlsZUZsYWcob3B0aW9ucy5mbGFnKTtcbiAgICBpZiAoIWZsYWcuaXNXcml0ZWFibGUoKSkge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsICdGbGFnIHBhc3NlZCB0byB3cml0ZUZpbGUgbXVzdCBhbGxvdyBmb3Igd3JpdGluZy4nKTtcbiAgICB9XG4gICAgcmV0dXJuIGZzLnJvb3Qud3JpdGVGaWxlU3luYyhub3JtYWxpemVQYXRoKGZpbGVuYW1lKSwgZGF0YSwgb3B0aW9ucy5lbmNvZGluZywgZmxhZywgb3B0aW9ucy5tb2RlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXNseSBhcHBlbmQgZGF0YSB0byBhIGZpbGUsIGNyZWF0aW5nIHRoZSBmaWxlIGlmIGl0IG5vdCB5ZXRcbiAgICogZXhpc3RzLlxuICAgKlxuICAgKiBAZXhhbXBsZSBVc2FnZSBleGFtcGxlXG4gICAqICAgZnMuYXBwZW5kRmlsZSgnbWVzc2FnZS50eHQnLCAnZGF0YSB0byBhcHBlbmQnLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAqICAgICBpZiAoZXJyKSB0aHJvdyBlcnI7XG4gICAqICAgICBjb25zb2xlLmxvZygnVGhlIFwiZGF0YSB0byBhcHBlbmRcIiB3YXMgYXBwZW5kZWQgdG8gZmlsZSEnKTtcbiAgICogICB9KTtcbiAgICogQHBhcmFtIFtTdHJpbmddIGZpbGVuYW1lXG4gICAqIEBwYXJhbSBbU3RyaW5nIHwgQnJvd3NlckZTLm5vZGUuQnVmZmVyXSBkYXRhXG4gICAqIEBwYXJhbSBbT2JqZWN0P10gb3B0aW9uc1xuICAgKiBAb3B0aW9uIG9wdGlvbnMgW1N0cmluZ10gZW5jb2RpbmcgRGVmYXVsdHMgdG8gYCd1dGY4J2AuXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbTnVtYmVyXSBtb2RlIERlZmF1bHRzIHRvIGAwNjQ0YC5cbiAgICogQG9wdGlvbiBvcHRpb25zIFtTdHJpbmddIGZsYWcgRGVmYXVsdHMgdG8gYCdhJ2AuXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgYXBwZW5kRmlsZShmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIGNiPzogKGVycjogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgc3RhdGljIGFwcGVuZEZpbGUoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogYW55LCBvcHRpb25zPzogT2JqZWN0LCBjYj86IChlcnI6IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyBhcHBlbmRGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgZW5jb2Rpbmc/OiBzdHJpbmcsIGNiPzogKGVycjogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgc3RhdGljIGFwcGVuZEZpbGUoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogYW55LCBhcmczPzogYW55LCBjYjogKGVycjogQXBpRXJyb3IpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBvcHRpb25zID0gbm9ybWFsaXplT3B0aW9ucyhhcmczLCAndXRmOCcsICdhJywgMHgxYTQpO1xuICAgIGNiID0gdHlwZW9mIGFyZzMgPT09ICdmdW5jdGlvbicgPyBhcmczIDogY2I7XG4gICAgdmFyIG5ld0NiID0gPChlcnI6IEFwaUVycm9yKSA9PiB2b2lkPiB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICB2YXIgZmxhZyA9IEZpbGVGbGFnLmdldEZpbGVGbGFnKG9wdGlvbnMuZmxhZyk7XG4gICAgICBpZiAoIWZsYWcuaXNBcHBlbmRhYmxlKCkpIHtcbiAgICAgICAgcmV0dXJuIG5ld0NiKG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnRmxhZyBwYXNzZWQgdG8gYXBwZW5kRmlsZSBtdXN0IGFsbG93IGZvciBhcHBlbmRpbmcuJykpO1xuICAgICAgfVxuICAgICAgZnMucm9vdC5hcHBlbmRGaWxlKG5vcm1hbGl6ZVBhdGgoZmlsZW5hbWUpLCBkYXRhLCBvcHRpb25zLmVuY29kaW5nLCBmbGFnLCBvcHRpb25zLm1vZGUsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzbHkgYXBwZW5kIGRhdGEgdG8gYSBmaWxlLCBjcmVhdGluZyB0aGUgZmlsZSBpZiBpdCBub3QgeWV0XG4gICAqIGV4aXN0cy5cbiAgICpcbiAgICogQGV4YW1wbGUgVXNhZ2UgZXhhbXBsZVxuICAgKiAgIGZzLmFwcGVuZEZpbGUoJ21lc3NhZ2UudHh0JywgJ2RhdGEgdG8gYXBwZW5kJywgZnVuY3Rpb24gKGVycikge1xuICAgKiAgICAgaWYgKGVycikgdGhyb3cgZXJyO1xuICAgKiAgICAgY29uc29sZS5sb2coJ1RoZSBcImRhdGEgdG8gYXBwZW5kXCIgd2FzIGFwcGVuZGVkIHRvIGZpbGUhJyk7XG4gICAqICAgfSk7XG4gICAqIEBwYXJhbSBbU3RyaW5nXSBmaWxlbmFtZVxuICAgKiBAcGFyYW0gW1N0cmluZyB8IEJyb3dzZXJGUy5ub2RlLkJ1ZmZlcl0gZGF0YVxuICAgKiBAcGFyYW0gW09iamVjdD9dIG9wdGlvbnNcbiAgICogQG9wdGlvbiBvcHRpb25zIFtTdHJpbmddIGVuY29kaW5nIERlZmF1bHRzIHRvIGAndXRmOCdgLlxuICAgKiBAb3B0aW9uIG9wdGlvbnMgW051bWJlcl0gbW9kZSBEZWZhdWx0cyB0byBgMDY0NGAuXG4gICAqIEBvcHRpb24gb3B0aW9ucyBbU3RyaW5nXSBmbGFnIERlZmF1bHRzIHRvIGAnYSdgLlxuICAgKi9cbiAgcHVibGljIHN0YXRpYyBhcHBlbmRGaWxlU3luYyhmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBhbnksIG9wdGlvbnM/OiBPYmplY3QpOiB2b2lkO1xuICBwdWJsaWMgc3RhdGljIGFwcGVuZEZpbGVTeW5jKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgZW5jb2Rpbmc/OiBzdHJpbmcpOiB2b2lkO1xuICBwdWJsaWMgc3RhdGljIGFwcGVuZEZpbGVTeW5jKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IGFueSwgYXJnMz86IGFueSk6IHZvaWQge1xuICAgIHZhciBvcHRpb25zID0gbm9ybWFsaXplT3B0aW9ucyhhcmczLCAndXRmOCcsICdhJywgMHgxYTQpO1xuICAgIHZhciBmbGFnID0gRmlsZUZsYWcuZ2V0RmlsZUZsYWcob3B0aW9ucy5mbGFnKTtcbiAgICBpZiAoIWZsYWcuaXNBcHBlbmRhYmxlKCkpIHtcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUlOVkFMLCAnRmxhZyBwYXNzZWQgdG8gYXBwZW5kRmlsZSBtdXN0IGFsbG93IGZvciBhcHBlbmRpbmcuJyk7XG4gICAgfVxuICAgIHJldHVybiBmcy5yb290LmFwcGVuZEZpbGVTeW5jKG5vcm1hbGl6ZVBhdGgoZmlsZW5hbWUpLCBkYXRhLCBvcHRpb25zLmVuY29kaW5nLCBmbGFnLCBvcHRpb25zLm1vZGUpO1xuICB9XG5cbiAgLy8gRklMRSBERVNDUklQVE9SIE1FVEhPRFNcblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBmc3RhdGAuXG4gICAqIGBmc3RhdCgpYCBpcyBpZGVudGljYWwgdG8gYHN0YXQoKWAsIGV4Y2VwdCB0aGF0IHRoZSBmaWxlIHRvIGJlIHN0YXQtZWQgaXNcbiAgICogc3BlY2lmaWVkIGJ5IHRoZSBmaWxlIGRlc2NyaXB0b3IgYGZkYC5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IsIEJyb3dzZXJGUy5ub2RlLmZzLlN0YXRzKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgZnN0YXQoZmQ6IGZpbGUuRmlsZSwgY2I6IChlcnI6IEFwaUVycm9yLCBzdGF0cz86IFN0YXRzKSA9PiBhbnkgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IDwoZXJyOiBBcGlFcnJvciwgc3RhdHM/OiBTdGF0cykgPT4gYW55PiB3cmFwQ2IoY2IsIDIpO1xuICAgIHRyeSB7XG4gICAgICBjaGVja0ZkKGZkKTtcbiAgICAgIGZkLnN0YXQobmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgZnN0YXRgLlxuICAgKiBgZnN0YXQoKWAgaXMgaWRlbnRpY2FsIHRvIGBzdGF0KClgLCBleGNlcHQgdGhhdCB0aGUgZmlsZSB0byBiZSBzdGF0LWVkIGlzXG4gICAqIHNwZWNpZmllZCBieSB0aGUgZmlsZSBkZXNjcmlwdG9yIGBmZGAuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEByZXR1cm4gW0Jyb3dzZXJGUy5ub2RlLmZzLlN0YXRzXVxuICAgKi9cbiAgcHVibGljIHN0YXRpYyBmc3RhdFN5bmMoZmQ6IGZpbGUuRmlsZSk6IFN0YXRzIHtcbiAgICBjaGVja0ZkKGZkKTtcbiAgICByZXR1cm4gZmQuc3RhdFN5bmMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgY2xvc2UuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgY2xvc2UoZmQ6IGZpbGUuRmlsZSwgY2I6IEZ1bmN0aW9uID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICBjaGVja0ZkKGZkKTtcbiAgICAgIGZkLmNsb3NlKG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgY2xvc2UuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGNsb3NlU3luYyhmZDogZmlsZS5GaWxlKTogdm9pZCB7XG4gICAgY2hlY2tGZChmZCk7XG4gICAgcmV0dXJuIGZkLmNsb3NlU3luYygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBmdHJ1bmNhdGUuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBsZW5cbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHN0YXRpYyBmdHJ1bmNhdGUoZmQ6IGZpbGUuRmlsZSwgY2I/OkZ1bmN0aW9uKTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyBmdHJ1bmNhdGUoZmQ6IGZpbGUuRmlsZSwgbGVuPzogbnVtYmVyLCBjYj86RnVuY3Rpb24pOiB2b2lkO1xuICBwdWJsaWMgc3RhdGljIGZ0cnVuY2F0ZShmZDogZmlsZS5GaWxlLCBhcmcyPzogYW55LCBjYjpGdW5jdGlvbiA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIGxlbmd0aCA9IHR5cGVvZiBhcmcyID09PSAnbnVtYmVyJyA/IGFyZzIgOiAwO1xuICAgIGNiID0gdHlwZW9mIGFyZzIgPT09ICdmdW5jdGlvbicgPyBhcmcyIDogY2I7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgY2hlY2tGZChmZCk7XG4gICAgICBpZiAobGVuZ3RoIDwgMCkge1xuICAgICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCk7XG4gICAgICB9XG4gICAgICBmZC50cnVuY2F0ZShsZW5ndGgsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgZnRydW5jYXRlLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW051bWJlcl0gbGVuXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGZ0cnVuY2F0ZVN5bmMoZmQ6IGZpbGUuRmlsZSwgbGVuOiBudW1iZXIgPSAwKSB7XG4gICAgY2hlY2tGZChmZCk7XG4gICAgcmV0dXJuIGZkLnRydW5jYXRlU3luYyhsZW4pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBmc3luYy5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHN0YXRpYyBmc3luYyhmZDogZmlsZS5GaWxlLCBjYjogRnVuY3Rpb24gPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIGNoZWNrRmQoZmQpO1xuICAgICAgZmQuc3luYyhuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGZzeW5jLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKi9cbiAgcHVibGljIHN0YXRpYyBmc3luY1N5bmMoZmQ6IGZpbGUuRmlsZSk6IHZvaWQge1xuICAgIGNoZWNrRmQoZmQpO1xuICAgIHJldHVybiBmZC5zeW5jU3luYygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91cyBmZGF0YXN5bmMuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgZmRhdGFzeW5jKGZkOiBmaWxlLkZpbGUsIGNiOiBGdW5jdGlvbiA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgY2hlY2tGZChmZCk7XG4gICAgICBmZC5kYXRhc3luYyhuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGZkYXRhc3luYy5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgZmRhdGFzeW5jU3luYyhmZDogZmlsZS5GaWxlKTogdm9pZCB7XG4gICAgY2hlY2tGZChmZCk7XG4gICAgZmQuZGF0YXN5bmNTeW5jKCk7XG4gIH1cblxuICAvKipcbiAgICogV3JpdGUgYnVmZmVyIHRvIHRoZSBmaWxlIHNwZWNpZmllZCBieSBgZmRgLlxuICAgKiBOb3RlIHRoYXQgaXQgaXMgdW5zYWZlIHRvIHVzZSBmcy53cml0ZSBtdWx0aXBsZSB0aW1lcyBvbiB0aGUgc2FtZSBmaWxlXG4gICAqIHdpdGhvdXQgd2FpdGluZyBmb3IgdGhlIGNhbGxiYWNrLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5ub2RlLkJ1ZmZlcl0gYnVmZmVyIEJ1ZmZlciBjb250YWluaW5nIHRoZSBkYXRhIHRvIHdyaXRlIHRvXG4gICAqICAgdGhlIGZpbGUuXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBvZmZzZXQgT2Zmc2V0IGluIHRoZSBidWZmZXIgdG8gc3RhcnQgcmVhZGluZyBkYXRhIGZyb20uXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBsZW5ndGggVGhlIGFtb3VudCBvZiBieXRlcyB0byB3cml0ZSB0byB0aGUgZmlsZS5cbiAgICogQHBhcmFtIFtOdW1iZXJdIHBvc2l0aW9uIE9mZnNldCBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGZpbGUgd2hlcmUgdGhpc1xuICAgKiAgIGRhdGEgc2hvdWxkIGJlIHdyaXR0ZW4uIElmIHBvc2l0aW9uIGlzIG51bGwsIHRoZSBkYXRhIHdpbGwgYmUgd3JpdHRlbiBhdFxuICAgKiAgIHRoZSBjdXJyZW50IHBvc2l0aW9uLlxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvciwgTnVtYmVyLCBCcm93c2VyRlMubm9kZS5CdWZmZXIpXVxuICAgKiAgIGNhbGxiYWNrIFRoZSBudW1iZXIgc3BlY2lmaWVzIHRoZSBudW1iZXIgb2YgYnl0ZXMgd3JpdHRlbiBpbnRvIHRoZSBmaWxlLlxuICAgKi9cbiAgcHVibGljIHN0YXRpYyB3cml0ZShmZDogZmlsZS5GaWxlLCBidWZmZXI6IE5vZGVCdWZmZXIsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlciwgY2I/OiAoZXJyOiBBcGlFcnJvciwgd3JpdHRlbj86IG51bWJlciwgYnVmZmVyPzogTm9kZUJ1ZmZlcikgPT4gYW55KTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyB3cml0ZShmZDogZmlsZS5GaWxlLCBidWZmZXI6IE5vZGVCdWZmZXIsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlciwgcG9zaXRpb24/OiBudW1iZXIsIGNiPzogKGVycjogQXBpRXJyb3IsIHdyaXR0ZW4/OiBudW1iZXIsIGJ1ZmZlcj86IE5vZGVCdWZmZXIpID0+IGFueSk6IHZvaWQ7XG4gIHB1YmxpYyBzdGF0aWMgd3JpdGUoZmQ6IGZpbGUuRmlsZSwgZGF0YTogc3RyaW5nLCBjYj86IChlcnI6IEFwaUVycm9yLCB3cml0dGVuPzogbnVtYmVyLCBidWZmZXI/OiBOb2RlQnVmZmVyKSA9PiBhbnkpOiB2b2lkO1xuICBwdWJsaWMgc3RhdGljIHdyaXRlKGZkOiBmaWxlLkZpbGUsIGRhdGE6IHN0cmluZywgcG9zaXRpb246IG51bWJlciwgY2I/OiAoZXJyOiBBcGlFcnJvciwgd3JpdHRlbj86IG51bWJlciwgYnVmZmVyPzogTm9kZUJ1ZmZlcikgPT4gYW55KTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyB3cml0ZShmZDogZmlsZS5GaWxlLCBkYXRhOiBzdHJpbmcsIHBvc2l0aW9uOiBudW1iZXIsIGVuY29kaW5nOiBzdHJpbmcsIGNiPzogKGVycjogQXBpRXJyb3IsIHdyaXR0ZW4/OiBudW1iZXIsIGJ1ZmZlcj86IE5vZGVCdWZmZXIpID0+IGFueSk6IHZvaWQ7XG4gIHB1YmxpYyBzdGF0aWMgd3JpdGUoZmQ6IGZpbGUuRmlsZSwgYXJnMjogYW55LCBhcmczPzogYW55LCBhcmc0PzogYW55LCBhcmc1PzogYW55LCBjYjogKGVycjogQXBpRXJyb3IsIHdyaXR0ZW4/OiBudW1iZXIsIGJ1ZmZlcj86IE5vZGVCdWZmZXIpID0+IGFueSA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIGJ1ZmZlcjogTm9kZUJ1ZmZlciwgb2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLCBwb3NpdGlvbjogbnVtYmVyID0gbnVsbDtcbiAgICBpZiAodHlwZW9mIGFyZzIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBTaWduYXR1cmUgMTogKGZkLCBzdHJpbmcsIFtwb3NpdGlvbj8sIFtlbmNvZGluZz9dXSwgY2I/KVxuICAgICAgdmFyIGVuY29kaW5nID0gJ3V0ZjgnO1xuICAgICAgc3dpdGNoICh0eXBlb2YgYXJnMykge1xuICAgICAgICBjYXNlICdmdW5jdGlvbic6XG4gICAgICAgICAgLy8gKGZkLCBzdHJpbmcsIGNiKVxuICAgICAgICAgIGNiID0gYXJnMztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgICAvLyAoZmQsIHN0cmluZywgcG9zaXRpb24sIGVuY29kaW5nPywgY2I/KVxuICAgICAgICAgIHBvc2l0aW9uID0gYXJnMztcbiAgICAgICAgICBlbmNvZGluZyA9IHR5cGVvZiBhcmc0ID09PSAnc3RyaW5nJyA/IGFyZzQgOiAndXRmOCc7XG4gICAgICAgICAgY2IgPSB0eXBlb2YgYXJnNSA9PT0gJ2Z1bmN0aW9uJyA/IGFyZzUgOiBjYjtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAvLyAuLi50cnkgdG8gZmluZCB0aGUgY2FsbGJhY2sgYW5kIGdldCBvdXQgb2YgaGVyZSFcbiAgICAgICAgICBjYiA9IHR5cGVvZiBhcmc0ID09PSAnZnVuY3Rpb24nID8gYXJnNCA6IHR5cGVvZiBhcmc1ID09PSAnZnVuY3Rpb24nID8gYXJnNSA6IGNiO1xuICAgICAgICAgIHJldHVybiBjYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTlZBTCwgJ0ludmFsaWQgYXJndW1lbnRzLicpKTtcbiAgICAgIH1cbiAgICAgIGJ1ZmZlciA9IG5ldyBCdWZmZXIoYXJnMiwgZW5jb2RpbmcpO1xuICAgICAgb2Zmc2V0ID0gMDtcbiAgICAgIGxlbmd0aCA9IGJ1ZmZlci5sZW5ndGg7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFNpZ25hdHVyZSAyOiAoZmQsIGJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgsIHBvc2l0aW9uPywgY2I/KVxuICAgICAgYnVmZmVyID0gYXJnMjtcbiAgICAgIG9mZnNldCA9IGFyZzM7XG4gICAgICBsZW5ndGggPSBhcmc0O1xuICAgICAgcG9zaXRpb24gPSB0eXBlb2YgYXJnNSA9PT0gJ251bWJlcicgPyBhcmc1IDogbnVsbDtcbiAgICAgIGNiID0gdHlwZW9mIGFyZzUgPT09ICdmdW5jdGlvbicgPyBhcmc1IDogY2I7XG4gICAgfVxuXG4gICAgdmFyIG5ld0NiID0gPChlcnI6IEFwaUVycm9yLCB3cml0dGVuPzogbnVtYmVyLCBidWZmZXI/OiBOb2RlQnVmZmVyKSA9PiBhbnk+IHdyYXBDYihjYiwgMyk7XG4gICAgdHJ5IHtcbiAgICAgIGNoZWNrRmQoZmQpO1xuICAgICAgaWYgKHBvc2l0aW9uID09IG51bGwpIHtcbiAgICAgICAgcG9zaXRpb24gPSBmZC5nZXRQb3MoKTtcbiAgICAgIH1cbiAgICAgIGZkLndyaXRlKGJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgsIHBvc2l0aW9uLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFdyaXRlIGJ1ZmZlciB0byB0aGUgZmlsZSBzcGVjaWZpZWQgYnkgYGZkYC5cbiAgICogTm90ZSB0aGF0IGl0IGlzIHVuc2FmZSB0byB1c2UgZnMud3JpdGUgbXVsdGlwbGUgdGltZXMgb24gdGhlIHNhbWUgZmlsZVxuICAgKiB3aXRob3V0IHdhaXRpbmcgZm9yIGl0IHRvIHJldHVybi5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtCcm93c2VyRlMubm9kZS5CdWZmZXJdIGJ1ZmZlciBCdWZmZXIgY29udGFpbmluZyB0aGUgZGF0YSB0byB3cml0ZSB0b1xuICAgKiAgIHRoZSBmaWxlLlxuICAgKiBAcGFyYW0gW051bWJlcl0gb2Zmc2V0IE9mZnNldCBpbiB0aGUgYnVmZmVyIHRvIHN0YXJ0IHJlYWRpbmcgZGF0YSBmcm9tLlxuICAgKiBAcGFyYW0gW051bWJlcl0gbGVuZ3RoIFRoZSBhbW91bnQgb2YgYnl0ZXMgdG8gd3JpdGUgdG8gdGhlIGZpbGUuXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBwb3NpdGlvbiBPZmZzZXQgZnJvbSB0aGUgYmVnaW5uaW5nIG9mIHRoZSBmaWxlIHdoZXJlIHRoaXNcbiAgICogICBkYXRhIHNob3VsZCBiZSB3cml0dGVuLiBJZiBwb3NpdGlvbiBpcyBudWxsLCB0aGUgZGF0YSB3aWxsIGJlIHdyaXR0ZW4gYXRcbiAgICogICB0aGUgY3VycmVudCBwb3NpdGlvbi5cbiAgICogQHJldHVybiBbTnVtYmVyXVxuICAgKi9cbiAgcHVibGljIHN0YXRpYyB3cml0ZVN5bmMoZmQ6IGZpbGUuRmlsZSwgYnVmZmVyOiBOb2RlQnVmZmVyLCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIHBvc2l0aW9uPzogbnVtYmVyKTogbnVtYmVyO1xuICBwdWJsaWMgc3RhdGljIHdyaXRlU3luYyhmZDogZmlsZS5GaWxlLCBkYXRhOiBzdHJpbmcsIHBvc2l0aW9uPzogbnVtYmVyLCBlbmNvZGluZz86IHN0cmluZyk6IG51bWJlcjtcbiAgcHVibGljIHN0YXRpYyB3cml0ZVN5bmMoZmQ6IGZpbGUuRmlsZSwgYXJnMjogYW55LCBhcmczPzogYW55LCBhcmc0PzogYW55LCBhcmc1PzogYW55KTogbnVtYmVyIHtcbiAgICB2YXIgYnVmZmVyOiBOb2RlQnVmZmVyLCBvZmZzZXQ6IG51bWJlciA9IDAsIGxlbmd0aDogbnVtYmVyLCBwb3NpdGlvbjogbnVtYmVyO1xuICAgIGlmICh0eXBlb2YgYXJnMiA9PT0gJ3N0cmluZycpIHtcbiAgICAgIC8vIFNpZ25hdHVyZSAxOiAoZmQsIHN0cmluZywgW3Bvc2l0aW9uPywgW2VuY29kaW5nP11dKVxuICAgICAgcG9zaXRpb24gPSB0eXBlb2YgYXJnMyA9PT0gJ251bWJlcicgPyBhcmczIDogbnVsbDtcbiAgICAgIHZhciBlbmNvZGluZyA9IHR5cGVvZiBhcmc0ID09PSAnc3RyaW5nJyA/IGFyZzQgOiAndXRmOCc7XG4gICAgICBvZmZzZXQgPSAwO1xuICAgICAgYnVmZmVyID0gbmV3IEJ1ZmZlcihhcmcyLCBlbmNvZGluZyk7XG4gICAgICBsZW5ndGggPSBidWZmZXIubGVuZ3RoO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTaWduYXR1cmUgMjogKGZkLCBidWZmZXIsIG9mZnNldCwgbGVuZ3RoLCBwb3NpdGlvbj8pXG4gICAgICBidWZmZXIgPSBhcmcyO1xuICAgICAgb2Zmc2V0ID0gYXJnMztcbiAgICAgIGxlbmd0aCA9IGFyZzQ7XG4gICAgICBwb3NpdGlvbiA9IHR5cGVvZiBhcmc1ID09PSAnbnVtYmVyJyA/IGFyZzUgOiBudWxsO1xuICAgIH1cblxuICAgIGNoZWNrRmQoZmQpO1xuICAgIGlmIChwb3NpdGlvbiA9PSBudWxsKSB7XG4gICAgICBwb3NpdGlvbiA9IGZkLmdldFBvcygpO1xuICAgIH1cbiAgICByZXR1cm4gZmQud3JpdGVTeW5jKGJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgsIHBvc2l0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWFkIGRhdGEgZnJvbSB0aGUgZmlsZSBzcGVjaWZpZWQgYnkgYGZkYC5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtCcm93c2VyRlMubm9kZS5CdWZmZXJdIGJ1ZmZlciBUaGUgYnVmZmVyIHRoYXQgdGhlIGRhdGEgd2lsbCBiZVxuICAgKiAgIHdyaXR0ZW4gdG8uXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBvZmZzZXQgVGhlIG9mZnNldCB3aXRoaW4gdGhlIGJ1ZmZlciB3aGVyZSB3cml0aW5nIHdpbGxcbiAgICogICBzdGFydC5cbiAgICogQHBhcmFtIFtOdW1iZXJdIGxlbmd0aCBBbiBpbnRlZ2VyIHNwZWNpZnlpbmcgdGhlIG51bWJlciBvZiBieXRlcyB0byByZWFkLlxuICAgKiBAcGFyYW0gW051bWJlcl0gcG9zaXRpb24gQW4gaW50ZWdlciBzcGVjaWZ5aW5nIHdoZXJlIHRvIGJlZ2luIHJlYWRpbmcgZnJvbVxuICAgKiAgIGluIHRoZSBmaWxlLiBJZiBwb3NpdGlvbiBpcyBudWxsLCBkYXRhIHdpbGwgYmUgcmVhZCBmcm9tIHRoZSBjdXJyZW50IGZpbGVcbiAgICogICBwb3NpdGlvbi5cbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IsIE51bWJlciwgQnJvd3NlckZTLm5vZGUuQnVmZmVyKV1cbiAgICogICBjYWxsYmFjayBUaGUgbnVtYmVyIGlzIHRoZSBudW1iZXIgb2YgYnl0ZXMgcmVhZFxuICAgKi9cbiAgcHVibGljIHN0YXRpYyByZWFkKGZkOiBmaWxlLkZpbGUsIGxlbmd0aDogbnVtYmVyLCBwb3NpdGlvbjogbnVtYmVyLCBlbmNvZGluZzogc3RyaW5nLCBjYj86IChlcnI6IEFwaUVycm9yLCBkYXRhPzogc3RyaW5nLCBieXRlc1JlYWQ/OiBudW1iZXIpID0+IHZvaWQpOiB2b2lkO1xuICBwdWJsaWMgc3RhdGljIHJlYWQoZmQ6IGZpbGUuRmlsZSwgYnVmZmVyOiBOb2RlQnVmZmVyLCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIHBvc2l0aW9uOiBudW1iZXIsIGNiPzogKGVycjogQXBpRXJyb3IsIGJ5dGVzUmVhZD86IG51bWJlciwgYnVmZmVyPzogTm9kZUJ1ZmZlcikgPT4gdm9pZCk6IHZvaWQ7XG4gIHB1YmxpYyBzdGF0aWMgcmVhZChmZDogZmlsZS5GaWxlLCBhcmcyOiBhbnksIGFyZzM6IGFueSwgYXJnNDogYW55LCBhcmc1PzogYW55LCBjYjogKGVycjogQXBpRXJyb3IsIGFyZzI/OiBhbnksIGFyZzM/OiBhbnkpID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBwb3NpdGlvbjogbnVtYmVyLCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIGJ1ZmZlcjogTm9kZUJ1ZmZlciwgbmV3Q2I6IChlcnI6IEFwaUVycm9yLCBieXRlc1JlYWQ/OiBudW1iZXIsIGJ1ZmZlcj86IE5vZGVCdWZmZXIpID0+IHZvaWQ7XG4gICAgaWYgKHR5cGVvZiBhcmcyID09PSAnbnVtYmVyJykge1xuICAgICAgLy8gbGVnYWN5IGludGVyZmFjZVxuICAgICAgLy8gKGZkLCBsZW5ndGgsIHBvc2l0aW9uLCBlbmNvZGluZywgY2FsbGJhY2spXG4gICAgICBsZW5ndGggPSBhcmcyO1xuICAgICAgcG9zaXRpb24gPSBhcmczO1xuICAgICAgdmFyIGVuY29kaW5nID0gYXJnNDtcbiAgICAgIGNiID0gdHlwZW9mIGFyZzUgPT09ICdmdW5jdGlvbicgPyBhcmc1IDogY2I7XG4gICAgICBvZmZzZXQgPSAwO1xuICAgICAgYnVmZmVyID0gbmV3IEJ1ZmZlcihsZW5ndGgpO1xuICAgICAgLy8gWFhYOiBJbmVmZmljaWVudC5cbiAgICAgIC8vIFdyYXAgdGhlIGNiIHNvIHdlIHNoZWx0ZXIgdXBwZXIgbGF5ZXJzIG9mIHRoZSBBUEkgZnJvbSB0aGVzZVxuICAgICAgLy8gc2hlbmFuaWdhbnMuXG4gICAgICBuZXdDYiA9IDwoZXJyOiBBcGlFcnJvciwgYnl0ZXNSZWFkPzogbnVtYmVyLCBidWZmZXI/OiBOb2RlQnVmZmVyKSA9PiB2b2lkPiB3cmFwQ2IoKGZ1bmN0aW9uKGVycjogYW55LCBieXRlc1JlYWQ6IG51bWJlciwgYnVmOiBCdWZmZXIpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHJldHVybiBjYihlcnIpO1xuICAgICAgICB9XG4gICAgICAgIGNiKGVyciwgYnVmLnRvU3RyaW5nKGVuY29kaW5nKSwgYnl0ZXNSZWFkKTtcbiAgICAgIH0pLCAzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYnVmZmVyID0gYXJnMjtcbiAgICAgIG9mZnNldCA9IGFyZzM7XG4gICAgICBsZW5ndGggPSBhcmc0O1xuICAgICAgcG9zaXRpb24gPSBhcmc1O1xuICAgICAgbmV3Q2IgPSA8KGVycjogQXBpRXJyb3IsIGJ5dGVzUmVhZD86IG51bWJlciwgYnVmZmVyPzogTm9kZUJ1ZmZlcikgPT4gdm9pZD4gd3JhcENiKGNiLCAzKTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY2hlY2tGZChmZCk7XG4gICAgICBpZiAocG9zaXRpb24gPT0gbnVsbCkge1xuICAgICAgICBwb3NpdGlvbiA9IGZkLmdldFBvcygpO1xuICAgICAgfVxuICAgICAgZmQucmVhZChidWZmZXIsIG9mZnNldCwgbGVuZ3RoLCBwb3NpdGlvbiwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWFkIGRhdGEgZnJvbSB0aGUgZmlsZSBzcGVjaWZpZWQgYnkgYGZkYC5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtCcm93c2VyRlMubm9kZS5CdWZmZXJdIGJ1ZmZlciBUaGUgYnVmZmVyIHRoYXQgdGhlIGRhdGEgd2lsbCBiZVxuICAgKiAgIHdyaXR0ZW4gdG8uXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBvZmZzZXQgVGhlIG9mZnNldCB3aXRoaW4gdGhlIGJ1ZmZlciB3aGVyZSB3cml0aW5nIHdpbGxcbiAgICogICBzdGFydC5cbiAgICogQHBhcmFtIFtOdW1iZXJdIGxlbmd0aCBBbiBpbnRlZ2VyIHNwZWNpZnlpbmcgdGhlIG51bWJlciBvZiBieXRlcyB0byByZWFkLlxuICAgKiBAcGFyYW0gW051bWJlcl0gcG9zaXRpb24gQW4gaW50ZWdlciBzcGVjaWZ5aW5nIHdoZXJlIHRvIGJlZ2luIHJlYWRpbmcgZnJvbVxuICAgKiAgIGluIHRoZSBmaWxlLiBJZiBwb3NpdGlvbiBpcyBudWxsLCBkYXRhIHdpbGwgYmUgcmVhZCBmcm9tIHRoZSBjdXJyZW50IGZpbGVcbiAgICogICBwb3NpdGlvbi5cbiAgICogQHJldHVybiBbTnVtYmVyXVxuICAgKi9cbiAgcHVibGljIHN0YXRpYyByZWFkU3luYyhmZDogZmlsZS5GaWxlLCBsZW5ndGg6IG51bWJlciwgcG9zaXRpb246IG51bWJlciwgZW5jb2Rpbmc6IHN0cmluZyk6IHN0cmluZztcbiAgcHVibGljIHN0YXRpYyByZWFkU3luYyhmZDogZmlsZS5GaWxlLCBidWZmZXI6IE5vZGVCdWZmZXIsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlciwgcG9zaXRpb246IG51bWJlcik6IG51bWJlcjtcbiAgcHVibGljIHN0YXRpYyByZWFkU3luYyhmZDogZmlsZS5GaWxlLCBhcmcyOiBhbnksIGFyZzM6IGFueSwgYXJnNDogYW55LCBhcmc1PzogYW55KTogYW55IHtcbiAgICB2YXIgc2hlbmFuaWdhbnMgPSBmYWxzZTtcbiAgICB2YXIgYnVmZmVyOiBOb2RlQnVmZmVyLCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIHBvc2l0aW9uOiBudW1iZXI7XG4gICAgaWYgKHR5cGVvZiBhcmcyID09PSAnbnVtYmVyJykge1xuICAgICAgbGVuZ3RoID0gYXJnMjtcbiAgICAgIHBvc2l0aW9uID0gYXJnMztcbiAgICAgIHZhciBlbmNvZGluZyA9IGFyZzQ7XG4gICAgICBvZmZzZXQgPSAwO1xuICAgICAgYnVmZmVyID0gbmV3IEJ1ZmZlcihsZW5ndGgpO1xuICAgICAgc2hlbmFuaWdhbnMgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBidWZmZXIgPSBhcmcyO1xuICAgICAgb2Zmc2V0ID0gYXJnMztcbiAgICAgIGxlbmd0aCA9IGFyZzQ7XG4gICAgICBwb3NpdGlvbiA9IGFyZzU7XG4gICAgfVxuICAgIGNoZWNrRmQoZmQpO1xuICAgIGlmIChwb3NpdGlvbiA9PSBudWxsKSB7XG4gICAgICBwb3NpdGlvbiA9IGZkLmdldFBvcygpO1xuICAgIH1cblxuICAgIHZhciBydiA9IGZkLnJlYWRTeW5jKGJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgsIHBvc2l0aW9uKTtcbiAgICBpZiAoIXNoZW5hbmlnYW5zKSB7XG4gICAgICByZXR1cm4gcnY7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBbYnVmZmVyLnRvU3RyaW5nKGVuY29kaW5nKSwgcnZdO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYGZjaG93bmAuXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLkZpbGVdIGZkXG4gICAqIEBwYXJhbSBbTnVtYmVyXSB1aWRcbiAgICogQHBhcmFtIFtOdW1iZXJdIGdpZFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGZjaG93bihmZDogZmlsZS5GaWxlLCB1aWQ6IG51bWJlciwgZ2lkOiBudW1iZXIsIGNhbGxiYWNrOiBGdW5jdGlvbiA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNhbGxiYWNrLCAxKTtcbiAgICB0cnkge1xuICAgICAgY2hlY2tGZChmZCk7XG4gICAgICBmZC5jaG93bih1aWQsIGdpZCwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgZmNob3duYC5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtOdW1iZXJdIHVpZFxuICAgKiBAcGFyYW0gW051bWJlcl0gZ2lkXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGZjaG93blN5bmMoZmQ6IGZpbGUuRmlsZSwgdWlkOiBudW1iZXIsIGdpZDogbnVtYmVyKTogdm9pZCB7XG4gICAgY2hlY2tGZChmZCk7XG4gICAgcmV0dXJuIGZkLmNob3duU3luYyh1aWQsIGdpZCk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBmY2htb2RgLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW051bWJlcl0gbW9kZVxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGZjaG1vZChmZDogZmlsZS5GaWxlLCBtb2RlOiBzdHJpbmcsIGNiPzogRnVuY3Rpb24pOiB2b2lkO1xuICBwdWJsaWMgc3RhdGljIGZjaG1vZChmZDogZmlsZS5GaWxlLCBtb2RlOiBudW1iZXIsIGNiPzogRnVuY3Rpb24pOiB2b2lkO1xuICBwdWJsaWMgc3RhdGljIGZjaG1vZChmZDogZmlsZS5GaWxlLCBtb2RlOiBhbnksIGNiOiBGdW5jdGlvbiA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgbW9kZSA9IHR5cGVvZiBtb2RlID09PSAnc3RyaW5nJyA/IHBhcnNlSW50KG1vZGUsIDgpIDogbW9kZTtcbiAgICAgIGNoZWNrRmQoZmQpO1xuICAgICAgZmQuY2htb2QobW9kZSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgZmNobW9kYC5cbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZV0gZmRcbiAgICogQHBhcmFtIFtOdW1iZXJdIG1vZGVcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgZmNobW9kU3luYyhmZDogZmlsZS5GaWxlLCBtb2RlOiBzdHJpbmcpOiB2b2lkO1xuICBwdWJsaWMgc3RhdGljIGZjaG1vZFN5bmMoZmQ6IGZpbGUuRmlsZSwgbW9kZTogbnVtYmVyKTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyBmY2htb2RTeW5jKGZkOiBmaWxlLkZpbGUsIG1vZGU6IGFueSk6IHZvaWQge1xuICAgIG1vZGUgPSB0eXBlb2YgbW9kZSA9PT0gJ3N0cmluZycgPyBwYXJzZUludChtb2RlLCA4KSA6IG1vZGU7XG4gICAgY2hlY2tGZChmZCk7XG4gICAgcmV0dXJuIGZkLmNobW9kU3luYyhtb2RlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGFuZ2UgdGhlIGZpbGUgdGltZXN0YW1wcyBvZiBhIGZpbGUgcmVmZXJlbmNlZCBieSB0aGUgc3VwcGxpZWQgZmlsZVxuICAgKiBkZXNjcmlwdG9yLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW0RhdGVdIGF0aW1lXG4gICAqIEBwYXJhbSBbRGF0ZV0gbXRpbWVcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHN0YXRpYyBmdXRpbWVzKGZkOiBmaWxlLkZpbGUsIGF0aW1lOiBudW1iZXIsIG10aW1lOiBudW1iZXIsIGNiOiBGdW5jdGlvbik6IHZvaWQ7XG4gIHB1YmxpYyBzdGF0aWMgZnV0aW1lcyhmZDogZmlsZS5GaWxlLCBhdGltZTogRGF0ZSwgbXRpbWU6IERhdGUsIGNiOiBGdW5jdGlvbik6IHZvaWQ7XG4gIHB1YmxpYyBzdGF0aWMgZnV0aW1lcyhmZDogZmlsZS5GaWxlLCBhdGltZTogYW55LCBtdGltZTogYW55LCBjYjogRnVuY3Rpb24gPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIGNoZWNrRmQoZmQpO1xuICAgICAgaWYgKHR5cGVvZiBhdGltZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgYXRpbWUgPSBuZXcgRGF0ZShhdGltZSAqIDEwMDApO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBtdGltZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgbXRpbWUgPSBuZXcgRGF0ZShtdGltZSAqIDEwMDApO1xuICAgICAgfVxuICAgICAgZmQudXRpbWVzKGF0aW1lLCBtdGltZSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDaGFuZ2UgdGhlIGZpbGUgdGltZXN0YW1wcyBvZiBhIGZpbGUgcmVmZXJlbmNlZCBieSB0aGUgc3VwcGxpZWQgZmlsZVxuICAgKiBkZXNjcmlwdG9yLlxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5GaWxlXSBmZFxuICAgKiBAcGFyYW0gW0RhdGVdIGF0aW1lXG4gICAqIEBwYXJhbSBbRGF0ZV0gbXRpbWVcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgZnV0aW1lc1N5bmMoZmQ6IGZpbGUuRmlsZSwgYXRpbWU6IG51bWJlciwgbXRpbWU6IG51bWJlcik6IHZvaWQ7XG4gIHB1YmxpYyBzdGF0aWMgZnV0aW1lc1N5bmMoZmQ6IGZpbGUuRmlsZSwgYXRpbWU6IERhdGUsIG10aW1lOiBEYXRlKTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyBmdXRpbWVzU3luYyhmZDogZmlsZS5GaWxlLCBhdGltZTogYW55LCBtdGltZTogYW55KTogdm9pZCB7XG4gICAgY2hlY2tGZChmZCk7XG4gICAgaWYgKHR5cGVvZiBhdGltZSA9PT0gJ251bWJlcicpIHtcbiAgICAgIGF0aW1lID0gbmV3IERhdGUoYXRpbWUgKiAxMDAwKTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBtdGltZSA9PT0gJ251bWJlcicpIHtcbiAgICAgIG10aW1lID0gbmV3IERhdGUobXRpbWUgKiAxMDAwKTtcbiAgICB9XG4gICAgcmV0dXJuIGZkLnV0aW1lc1N5bmMoYXRpbWUsIG10aW1lKTtcbiAgfVxuXG4gIC8vIERJUkVDVE9SWS1PTkxZIE1FVEhPRFNcblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBybWRpcmAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgcm1kaXIocGF0aDogc3RyaW5nLCBjYjogRnVuY3Rpb24gPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgICAgZnMucm9vdC5ybWRpcihwYXRoLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBybWRpcmAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIHJtZGlyU3luYyhwYXRoOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBwYXRoID0gbm9ybWFsaXplUGF0aChwYXRoKTtcbiAgICByZXR1cm4gZnMucm9vdC5ybWRpclN5bmMocGF0aCk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBta2RpcmAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbTnVtYmVyP10gbW9kZSBkZWZhdWx0cyB0byBgMDc3N2BcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHN0YXRpYyBta2RpcihwYXRoOiBzdHJpbmcsIG1vZGU/OiBhbnksIGNiOiBGdW5jdGlvbiA9IG5vcENiKTogdm9pZCB7XG4gICAgaWYgKHR5cGVvZiBtb2RlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYiA9IG1vZGU7XG4gICAgICBtb2RlID0gMHgxZmY7XG4gICAgfVxuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgICAgZnMucm9vdC5ta2RpcihwYXRoLCBtb2RlLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBta2RpcmAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbTnVtYmVyP10gbW9kZSBkZWZhdWx0cyB0byBgMDc3N2BcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgbWtkaXJTeW5jKHBhdGg6IHN0cmluZywgbW9kZT86IHN0cmluZyk6IHZvaWQ7XG4gIHB1YmxpYyBzdGF0aWMgbWtkaXJTeW5jKHBhdGg6IHN0cmluZywgbW9kZT86IG51bWJlcik6IHZvaWQ7XG4gIHB1YmxpYyBzdGF0aWMgbWtkaXJTeW5jKHBhdGg6IHN0cmluZywgbW9kZTogYW55ID0gMHgxZmYpOiB2b2lkIHtcbiAgICBtb2RlID0gdHlwZW9mIG1vZGUgPT09ICdzdHJpbmcnID8gcGFyc2VJbnQobW9kZSwgOCkgOiBtb2RlO1xuICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgIHJldHVybiBmcy5yb290Lm1rZGlyU3luYyhwYXRoLCBtb2RlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYHJlYWRkaXJgLiBSZWFkcyB0aGUgY29udGVudHMgb2YgYSBkaXJlY3RvcnkuXG4gICAqIFRoZSBjYWxsYmFjayBnZXRzIHR3byBhcmd1bWVudHMgYChlcnIsIGZpbGVzKWAgd2hlcmUgYGZpbGVzYCBpcyBhbiBhcnJheSBvZlxuICAgKiB0aGUgbmFtZXMgb2YgdGhlIGZpbGVzIGluIHRoZSBkaXJlY3RvcnkgZXhjbHVkaW5nIGAnLidgIGFuZCBgJy4uJ2AuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yLCBTdHJpbmdbXSldIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIHJlYWRkaXIocGF0aDogc3RyaW5nLCBjYjogKGVycjogQXBpRXJyb3IsIGZpbGVzPzogc3RyaW5nW10pID0+IHZvaWQgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IDwoZXJyOiBBcGlFcnJvciwgZmlsZXM/OiBzdHJpbmdbXSkgPT4gdm9pZD4gd3JhcENiKGNiLCAyKTtcbiAgICB0cnkge1xuICAgICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG4gICAgICBmcy5yb290LnJlYWRkaXIocGF0aCwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgcmVhZGRpcmAuIFJlYWRzIHRoZSBjb250ZW50cyBvZiBhIGRpcmVjdG9yeS5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHJldHVybiBbU3RyaW5nW11dXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIHJlYWRkaXJTeW5jKHBhdGg6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICBwYXRoID0gbm9ybWFsaXplUGF0aChwYXRoKTtcbiAgICByZXR1cm4gZnMucm9vdC5yZWFkZGlyU3luYyhwYXRoKTtcbiAgfVxuXG4gIC8vIFNZTUxJTksgTUVUSE9EU1xuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYGxpbmtgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gc3JjcGF0aFxuICAgKiBAcGFyYW0gW1N0cmluZ10gZHN0cGF0aFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGxpbmsoc3JjcGF0aDogc3RyaW5nLCBkc3RwYXRoOiBzdHJpbmcsIGNiOiBGdW5jdGlvbiA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgc3JjcGF0aCA9IG5vcm1hbGl6ZVBhdGgoc3JjcGF0aCk7XG4gICAgICBkc3RwYXRoID0gbm9ybWFsaXplUGF0aChkc3RwYXRoKTtcbiAgICAgIGZzLnJvb3QubGluayhzcmNwYXRoLCBkc3RwYXRoLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBsaW5rYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHNyY3BhdGhcbiAgICogQHBhcmFtIFtTdHJpbmddIGRzdHBhdGhcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgbGlua1N5bmMoc3JjcGF0aDogc3RyaW5nLCBkc3RwYXRoOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBzcmNwYXRoID0gbm9ybWFsaXplUGF0aChzcmNwYXRoKTtcbiAgICBkc3RwYXRoID0gbm9ybWFsaXplUGF0aChkc3RwYXRoKTtcbiAgICByZXR1cm4gZnMucm9vdC5saW5rU3luYyhzcmNwYXRoLCBkc3RwYXRoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYHN5bWxpbmtgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gc3JjcGF0aFxuICAgKiBAcGFyYW0gW1N0cmluZ10gZHN0cGF0aFxuICAgKiBAcGFyYW0gW1N0cmluZz9dIHR5cGUgY2FuIGJlIGVpdGhlciBgJ2RpcidgIG9yIGAnZmlsZSdgIChkZWZhdWx0IGlzIGAnZmlsZSdgKVxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIHN5bWxpbmsoc3JjcGF0aDogc3RyaW5nLCBkc3RwYXRoOiBzdHJpbmcsIGNiPzogRnVuY3Rpb24pOiB2b2lkO1xuICBwdWJsaWMgc3RhdGljIHN5bWxpbmsoc3JjcGF0aDogc3RyaW5nLCBkc3RwYXRoOiBzdHJpbmcsIHR5cGU/OiBzdHJpbmcsIGNiPzogRnVuY3Rpb24pOiB2b2lkO1xuICBwdWJsaWMgc3RhdGljIHN5bWxpbmsoc3JjcGF0aDogc3RyaW5nLCBkc3RwYXRoOiBzdHJpbmcsIGFyZzM/OiBhbnksIGNiOiBGdW5jdGlvbiA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIHR5cGUgPSB0eXBlb2YgYXJnMyA9PT0gJ3N0cmluZycgPyBhcmczIDogJ2ZpbGUnO1xuICAgIGNiID0gdHlwZW9mIGFyZzMgPT09ICdmdW5jdGlvbicgPyBhcmczIDogY2I7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgaWYgKHR5cGUgIT09ICdmaWxlJyAmJiB0eXBlICE9PSAnZGlyJykge1xuICAgICAgICByZXR1cm4gbmV3Q2IobmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsIFwiSW52YWxpZCB0eXBlOiBcIiArIHR5cGUpKTtcbiAgICAgIH1cbiAgICAgIHNyY3BhdGggPSBub3JtYWxpemVQYXRoKHNyY3BhdGgpO1xuICAgICAgZHN0cGF0aCA9IG5vcm1hbGl6ZVBhdGgoZHN0cGF0aCk7XG4gICAgICBmcy5yb290LnN5bWxpbmsoc3JjcGF0aCwgZHN0cGF0aCwgdHlwZSwgbmV3Q2IpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5ld0NiKGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyBgc3ltbGlua2AuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBzcmNwYXRoXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBkc3RwYXRoXG4gICAqIEBwYXJhbSBbU3RyaW5nP10gdHlwZSBjYW4gYmUgZWl0aGVyIGAnZGlyJ2Agb3IgYCdmaWxlJ2AgKGRlZmF1bHQgaXMgYCdmaWxlJ2ApXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIHN5bWxpbmtTeW5jKHNyY3BhdGg6IHN0cmluZywgZHN0cGF0aDogc3RyaW5nLCB0eXBlPzogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKHR5cGUgPT0gbnVsbCkge1xuICAgICAgdHlwZSA9ICdmaWxlJztcbiAgICB9IGVsc2UgaWYgKHR5cGUgIT09ICdmaWxlJyAmJiB0eXBlICE9PSAnZGlyJykge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU5WQUwsIFwiSW52YWxpZCB0eXBlOiBcIiArIHR5cGUpO1xuICAgIH1cbiAgICBzcmNwYXRoID0gbm9ybWFsaXplUGF0aChzcmNwYXRoKTtcbiAgICBkc3RwYXRoID0gbm9ybWFsaXplUGF0aChkc3RwYXRoKTtcbiAgICByZXR1cm4gZnMucm9vdC5zeW1saW5rU3luYyhzcmNwYXRoLCBkc3RwYXRoLCB0eXBlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgcmVhZGxpbmsuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yLCBTdHJpbmcpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHN0YXRpYyByZWFkbGluayhwYXRoOiBzdHJpbmcsIGNiOiAoZXJyOiBBcGlFcnJvciwgbGlua1N0cmluZzogc3RyaW5nKSA9PiBhbnkgPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMik7XG4gICAgdHJ5IHtcbiAgICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgICAgZnMucm9vdC5yZWFkbGluayhwYXRoLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIHJlYWRsaW5rLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcmV0dXJuIFtTdHJpbmddXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIHJlYWRsaW5rU3luYyhwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgIHJldHVybiBmcy5yb290LnJlYWRsaW5rU3luYyhwYXRoKTtcbiAgfVxuXG4gIC8vIFBST1BFUlRZIE9QRVJBVElPTlNcblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBjaG93bmAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbTnVtYmVyXSB1aWRcbiAgICogQHBhcmFtIFtOdW1iZXJdIGdpZFxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGNob3duKHBhdGg6IHN0cmluZywgdWlkOiBudW1iZXIsIGdpZDogbnVtYmVyLCBjYjogRnVuY3Rpb24gPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgICAgZnMucm9vdC5jaG93bihwYXRoLCBmYWxzZSwgdWlkLCBnaWQsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYGNob3duYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtOdW1iZXJdIHVpZFxuICAgKiBAcGFyYW0gW051bWJlcl0gZ2lkXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGNob3duU3luYyhwYXRoOiBzdHJpbmcsIHVpZDogbnVtYmVyLCBnaWQ6IG51bWJlcik6IHZvaWQge1xuICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgIGZzLnJvb3QuY2hvd25TeW5jKHBhdGgsIGZhbHNlLCB1aWQsIGdpZCk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBsY2hvd25gLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW051bWJlcl0gdWlkXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBnaWRcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHN0YXRpYyBsY2hvd24ocGF0aDogc3RyaW5nLCB1aWQ6IG51bWJlciwgZ2lkOiBudW1iZXIsIGNiOiBGdW5jdGlvbiA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG4gICAgICBmcy5yb290LmNob3duKHBhdGgsIHRydWUsIHVpZCwgZ2lkLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBsY2hvd25gLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW051bWJlcl0gdWlkXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBnaWRcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgbGNob3duU3luYyhwYXRoOiBzdHJpbmcsIHVpZDogbnVtYmVyLCBnaWQ6IG51bWJlcik6IHZvaWQge1xuICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgIHJldHVybiBmcy5yb290LmNob3duU3luYyhwYXRoLCB0cnVlLCB1aWQsIGdpZCk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBjaG1vZGAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBtb2RlXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2FsbGJhY2tcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgY2htb2QocGF0aDogc3RyaW5nLCBtb2RlOiBzdHJpbmcsIGNiPzogRnVuY3Rpb24pOiB2b2lkO1xuICBwdWJsaWMgc3RhdGljIGNobW9kKHBhdGg6IHN0cmluZywgbW9kZTogbnVtYmVyLCBjYj86IEZ1bmN0aW9uKTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyBjaG1vZChwYXRoOiBzdHJpbmcsIG1vZGU6IGFueSwgY2I6IEZ1bmN0aW9uID0gbm9wQ2IpOiB2b2lkIHtcbiAgICB2YXIgbmV3Q2IgPSB3cmFwQ2IoY2IsIDEpO1xuICAgIHRyeSB7XG4gICAgICBtb2RlID0gdHlwZW9mIG1vZGUgPT09ICdzdHJpbmcnID8gcGFyc2VJbnQobW9kZSwgOCkgOiBtb2RlO1xuICAgICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG4gICAgICBmcy5yb290LmNobW9kKHBhdGgsIGZhbHNlLCBtb2RlLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBjaG1vZGAuXG4gICAqIEBwYXJhbSBbU3RyaW5nXSBwYXRoXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBtb2RlXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGNobW9kU3luYyhwYXRoOiBzdHJpbmcsIG1vZGU6IHN0cmluZyk6IHZvaWQ7XG4gIHB1YmxpYyBzdGF0aWMgY2htb2RTeW5jKHBhdGg6IHN0cmluZywgbW9kZTogbnVtYmVyKTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyBjaG1vZFN5bmMocGF0aDogc3RyaW5nLCBtb2RlOiBhbnkpOiB2b2lkIHtcbiAgICBtb2RlID0gdHlwZW9mIG1vZGUgPT09ICdzdHJpbmcnID8gcGFyc2VJbnQobW9kZSwgOCkgOiBtb2RlO1xuICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgIHJldHVybiBmcy5yb290LmNobW9kU3luYyhwYXRoLCBmYWxzZSwgbW9kZSk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzIGBsY2htb2RgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW051bWJlcl0gbW9kZVxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvcildIGNhbGxiYWNrXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGxjaG1vZChwYXRoOiBzdHJpbmcsIG1vZGU6IHN0cmluZywgY2I/OiBGdW5jdGlvbik6IHZvaWQ7XG4gIHB1YmxpYyBzdGF0aWMgbGNobW9kKHBhdGg6IHN0cmluZywgbW9kZTogbnVtYmVyLCBjYj86IEZ1bmN0aW9uKTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyBsY2htb2QocGF0aDogc3RyaW5nLCBtb2RlOiBhbnksIGNiOiBGdW5jdGlvbiA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIG5ld0NiID0gd3JhcENiKGNiLCAxKTtcbiAgICB0cnkge1xuICAgICAgbW9kZSA9IHR5cGVvZiBtb2RlID09PSAnc3RyaW5nJyA/IHBhcnNlSW50KG1vZGUsIDgpIDogbW9kZTtcbiAgICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgICAgZnMucm9vdC5jaG1vZChwYXRoLCB0cnVlLCBtb2RlLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGBsY2htb2RgLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW051bWJlcl0gbW9kZVxuICAgKi9cbiAgcHVibGljIHN0YXRpYyBsY2htb2RTeW5jKHBhdGg6IHN0cmluZywgbW9kZTogbnVtYmVyKTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyBsY2htb2RTeW5jKHBhdGg6IHN0cmluZywgbW9kZTogc3RyaW5nKTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyBsY2htb2RTeW5jKHBhdGg6IHN0cmluZywgbW9kZTogYW55KTogdm9pZCB7XG4gICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG4gICAgbW9kZSA9IHR5cGVvZiBtb2RlID09PSAnc3RyaW5nJyA/IHBhcnNlSW50KG1vZGUsIDgpIDogbW9kZTtcbiAgICByZXR1cm4gZnMucm9vdC5jaG1vZFN5bmMocGF0aCwgdHJ1ZSwgbW9kZSk7XG4gIH1cblxuICAvKipcbiAgICogQ2hhbmdlIGZpbGUgdGltZXN0YW1wcyBvZiB0aGUgZmlsZSByZWZlcmVuY2VkIGJ5IHRoZSBzdXBwbGllZCBwYXRoLlxuICAgKiBAcGFyYW0gW1N0cmluZ10gcGF0aFxuICAgKiBAcGFyYW0gW0RhdGVdIGF0aW1lXG4gICAqIEBwYXJhbSBbRGF0ZV0gbXRpbWVcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHN0YXRpYyB1dGltZXMocGF0aDogc3RyaW5nLCBhdGltZTogbnVtYmVyLCBtdGltZTogbnVtYmVyLCBjYjogRnVuY3Rpb24pOiB2b2lkO1xuICBwdWJsaWMgc3RhdGljIHV0aW1lcyhwYXRoOiBzdHJpbmcsIGF0aW1lOiBEYXRlLCBtdGltZTogRGF0ZSwgY2I6IEZ1bmN0aW9uKTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyB1dGltZXMocGF0aDogc3RyaW5nLCBhdGltZTogYW55LCBtdGltZTogYW55LCBjYjogRnVuY3Rpb24gPSBub3BDYik6IHZvaWQge1xuICAgIHZhciBuZXdDYiA9IHdyYXBDYihjYiwgMSk7XG4gICAgdHJ5IHtcbiAgICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgICAgaWYgKHR5cGVvZiBhdGltZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgYXRpbWUgPSBuZXcgRGF0ZShhdGltZSAqIDEwMDApO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBtdGltZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgbXRpbWUgPSBuZXcgRGF0ZShtdGltZSAqIDEwMDApO1xuICAgICAgfVxuICAgICAgZnMucm9vdC51dGltZXMocGF0aCwgYXRpbWUsIG10aW1lLCBuZXdDYik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbmV3Q2IoZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENoYW5nZSBmaWxlIHRpbWVzdGFtcHMgb2YgdGhlIGZpbGUgcmVmZXJlbmNlZCBieSB0aGUgc3VwcGxpZWQgcGF0aC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtEYXRlXSBhdGltZVxuICAgKiBAcGFyYW0gW0RhdGVdIG10aW1lXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIHV0aW1lc1N5bmMocGF0aDogc3RyaW5nLCBhdGltZTogbnVtYmVyLCBtdGltZTogbnVtYmVyKTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyB1dGltZXNTeW5jKHBhdGg6IHN0cmluZywgYXRpbWU6IERhdGUsIG10aW1lOiBEYXRlKTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyB1dGltZXNTeW5jKHBhdGg6IHN0cmluZywgYXRpbWU6IGFueSwgbXRpbWU6IGFueSk6IHZvaWQge1xuICAgIHBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuICAgIGlmICh0eXBlb2YgYXRpbWUgPT09ICdudW1iZXInKSB7XG4gICAgICBhdGltZSA9IG5ldyBEYXRlKGF0aW1lICogMTAwMCk7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgbXRpbWUgPT09ICdudW1iZXInKSB7XG4gICAgICBtdGltZSA9IG5ldyBEYXRlKG10aW1lICogMTAwMCk7XG4gICAgfVxuICAgIHJldHVybiBmcy5yb290LnV0aW1lc1N5bmMocGF0aCwgYXRpbWUsIG10aW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYHJlYWxwYXRoYC4gVGhlIGNhbGxiYWNrIGdldHMgdHdvIGFyZ3VtZW50c1xuICAgKiBgKGVyciwgcmVzb2x2ZWRQYXRoKWAuIE1heSB1c2UgYHByb2Nlc3MuY3dkYCB0byByZXNvbHZlIHJlbGF0aXZlIHBhdGhzLlxuICAgKlxuICAgKiBAZXhhbXBsZSBVc2FnZSBleGFtcGxlXG4gICAqICAgdmFyIGNhY2hlID0geycvZXRjJzonL3ByaXZhdGUvZXRjJ307XG4gICAqICAgZnMucmVhbHBhdGgoJy9ldGMvcGFzc3dkJywgY2FjaGUsIGZ1bmN0aW9uIChlcnIsIHJlc29sdmVkUGF0aCkge1xuICAgKiAgICAgaWYgKGVycikgdGhyb3cgZXJyO1xuICAgKiAgICAgY29uc29sZS5sb2cocmVzb2x2ZWRQYXRoKTtcbiAgICogICB9KTtcbiAgICpcbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtPYmplY3Q/XSBjYWNoZSBBbiBvYmplY3QgbGl0ZXJhbCBvZiBtYXBwZWQgcGF0aHMgdGhhdCBjYW4gYmUgdXNlZCB0b1xuICAgKiAgIGZvcmNlIGEgc3BlY2lmaWMgcGF0aCByZXNvbHV0aW9uIG9yIGF2b2lkIGFkZGl0aW9uYWwgYGZzLnN0YXRgIGNhbGxzIGZvclxuICAgKiAgIGtub3duIHJlYWwgcGF0aHMuXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yLCBTdHJpbmcpXSBjYWxsYmFja1xuICAgKi9cbiAgcHVibGljIHN0YXRpYyByZWFscGF0aChwYXRoOiBzdHJpbmcsIGNiPzogKGVycjogQXBpRXJyb3IsIHJlc29sdmVkUGF0aD86IHN0cmluZykgPT5hbnkpOiB2b2lkO1xuICBwdWJsaWMgc3RhdGljIHJlYWxwYXRoKHBhdGg6IHN0cmluZywgY2FjaGU6IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSwgY2I6IChlcnI6IEFwaUVycm9yLCByZXNvbHZlZFBhdGg/OiBzdHJpbmcpID0+YW55KTogdm9pZDtcbiAgcHVibGljIHN0YXRpYyByZWFscGF0aChwYXRoOiBzdHJpbmcsIGFyZzI/OiBhbnksIGNiOiAoZXJyOiBBcGlFcnJvciwgcmVzb2x2ZWRQYXRoPzogc3RyaW5nKSA9PmFueSA9IG5vcENiKTogdm9pZCB7XG4gICAgdmFyIGNhY2hlID0gdHlwZW9mIGFyZzIgPT09ICdvYmplY3QnID8gYXJnMiA6IHt9O1xuICAgIGNiID0gdHlwZW9mIGFyZzIgPT09ICdmdW5jdGlvbicgPyBhcmcyIDogbm9wQ2I7XG4gICAgdmFyIG5ld0NiID0gPChlcnI6IEFwaUVycm9yLCByZXNvbHZlZFBhdGg/OiBzdHJpbmcpID0+YW55PiB3cmFwQ2IoY2IsIDIpO1xuICAgIHRyeSB7XG4gICAgICBwYXRoID0gbm9ybWFsaXplUGF0aChwYXRoKTtcbiAgICAgIGZzLnJvb3QucmVhbHBhdGgocGF0aCwgY2FjaGUsIG5ld0NiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXdDYihlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYHJlYWxwYXRoYC5cbiAgICogQHBhcmFtIFtTdHJpbmddIHBhdGhcbiAgICogQHBhcmFtIFtPYmplY3Q/XSBjYWNoZSBBbiBvYmplY3QgbGl0ZXJhbCBvZiBtYXBwZWQgcGF0aHMgdGhhdCBjYW4gYmUgdXNlZCB0b1xuICAgKiAgIGZvcmNlIGEgc3BlY2lmaWMgcGF0aCByZXNvbHV0aW9uIG9yIGF2b2lkIGFkZGl0aW9uYWwgYGZzLnN0YXRgIGNhbGxzIGZvclxuICAgKiAgIGtub3duIHJlYWwgcGF0aHMuXG4gICAqIEByZXR1cm4gW1N0cmluZ11cbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgcmVhbHBhdGhTeW5jKHBhdGg6IHN0cmluZywgY2FjaGU6IHtbcGF0aDogc3RyaW5nXTogc3RyaW5nfSA9IHt9KTogc3RyaW5nIHtcbiAgICBwYXRoID0gbm9ybWFsaXplUGF0aChwYXRoKTtcbiAgICByZXR1cm4gZnMucm9vdC5yZWFscGF0aFN5bmMocGF0aCwgY2FjaGUpO1xuICB9XG59XG5cbmV4cG9ydCA9IGZzO1xuIl19