var api_error_1 = require('./api_error');
var file_flag_1 = require('./file_flag');
var buffer_1 = require('./buffer');
var path = require('./node_path');
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
            buffer = new buffer_1.Buffer(arg2, encoding);
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
            buffer = new buffer_1.Buffer(arg2, encoding);
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
            buffer = new buffer_1.Buffer(length);
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
            buffer = new buffer_1.Buffer(length);
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
//# sourceMappingURL=node_fs.js.map