var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var file_system = require('../core/file_system');
var api_error_1 = require('../core/api_error');
var node_fs_stats = require('../core/node_fs_stats');
var path = require('path');
var Inode = require('../generic/inode');
var preload_file = require('../generic/preload_file');
var ROOT_NODE_ID = "/";
function GenerateRandomID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
function noError(e, cb) {
    if (e) {
        cb(e);
        return false;
    }
    return true;
}
function noErrorTx(e, tx, cb) {
    if (e) {
        tx.abort(function () {
            cb(e);
        });
        return false;
    }
    return true;
}
var SimpleSyncRWTransaction = (function () {
    function SimpleSyncRWTransaction(store) {
        this.store = store;
        this.originalData = {};
        this.modifiedKeys = [];
    }
    SimpleSyncRWTransaction.prototype.stashOldValue = function (key, value) {
        if (!this.originalData.hasOwnProperty(key)) {
            this.originalData[key] = value;
        }
    };
    SimpleSyncRWTransaction.prototype.markModified = function (key) {
        if (this.modifiedKeys.indexOf(key) === -1) {
            this.modifiedKeys.push(key);
            if (!this.originalData.hasOwnProperty(key)) {
                this.originalData[key] = this.store.get(key);
            }
        }
    };
    SimpleSyncRWTransaction.prototype.get = function (key) {
        var val = this.store.get(key);
        this.stashOldValue(key, val);
        return val;
    };
    SimpleSyncRWTransaction.prototype.put = function (key, data, overwrite) {
        this.markModified(key);
        return this.store.put(key, data, overwrite);
    };
    SimpleSyncRWTransaction.prototype.del = function (key) {
        this.markModified(key);
        this.store.del(key);
    };
    SimpleSyncRWTransaction.prototype.commit = function () { };
    SimpleSyncRWTransaction.prototype.abort = function () {
        var i, key, value;
        for (i = 0; i < this.modifiedKeys.length; i++) {
            key = this.modifiedKeys[i];
            value = this.originalData[key];
            if (value === null) {
                this.store.del(key);
            }
            else {
                this.store.put(key, value, true);
            }
        }
    };
    return SimpleSyncRWTransaction;
})();
exports.SimpleSyncRWTransaction = SimpleSyncRWTransaction;
var SyncKeyValueFile = (function (_super) {
    __extends(SyncKeyValueFile, _super);
    function SyncKeyValueFile(_fs, _path, _flag, _stat, contents) {
        _super.call(this, _fs, _path, _flag, _stat, contents);
    }
    SyncKeyValueFile.prototype.syncSync = function () {
        if (this.isDirty()) {
            this._fs._syncSync(this.getPath(), this.getBuffer(), this.getStats());
            this.resetDirty();
        }
    };
    SyncKeyValueFile.prototype.closeSync = function () {
        this.syncSync();
    };
    return SyncKeyValueFile;
})(preload_file.PreloadFile);
exports.SyncKeyValueFile = SyncKeyValueFile;
var SyncKeyValueFileSystem = (function (_super) {
    __extends(SyncKeyValueFileSystem, _super);
    function SyncKeyValueFileSystem(options) {
        _super.call(this);
        this.store = options.store;
        this.makeRootDirectory();
    }
    SyncKeyValueFileSystem.isAvailable = function () { return true; };
    SyncKeyValueFileSystem.prototype.getName = function () { return this.store.name(); };
    SyncKeyValueFileSystem.prototype.isReadOnly = function () { return false; };
    SyncKeyValueFileSystem.prototype.supportsSymlinks = function () { return false; };
    SyncKeyValueFileSystem.prototype.supportsProps = function () { return false; };
    SyncKeyValueFileSystem.prototype.supportsSynch = function () { return true; };
    SyncKeyValueFileSystem.prototype.makeRootDirectory = function () {
        var tx = this.store.beginTransaction('readwrite');
        if (tx.get(ROOT_NODE_ID) === undefined) {
            var currTime = (new Date()).getTime(), dirInode = new Inode(GenerateRandomID(), 4096, 511 | node_fs_stats.FileType.DIRECTORY, currTime, currTime, currTime);
            tx.put(dirInode.id, new Buffer("{}"), false);
            tx.put(ROOT_NODE_ID, dirInode.toBuffer(), false);
            tx.commit();
        }
    };
    SyncKeyValueFileSystem.prototype._findINode = function (tx, parent, filename) {
        var _this = this;
        var read_directory = function (inode) {
            var dirList = _this.getDirListing(tx, parent, inode);
            if (dirList[filename]) {
                return dirList[filename];
            }
            else {
                throw api_error_1.ApiError.ENOENT(path.resolve(parent, filename));
            }
        };
        if (parent === '/') {
            if (filename === '') {
                return ROOT_NODE_ID;
            }
            else {
                return read_directory(this.getINode(tx, parent, ROOT_NODE_ID));
            }
        }
        else {
            return read_directory(this.getINode(tx, parent + path.sep + filename, this._findINode(tx, path.dirname(parent), path.basename(parent))));
        }
    };
    SyncKeyValueFileSystem.prototype.findINode = function (tx, p) {
        return this.getINode(tx, p, this._findINode(tx, path.dirname(p), path.basename(p)));
    };
    SyncKeyValueFileSystem.prototype.getINode = function (tx, p, id) {
        var inode = tx.get(id);
        if (inode === undefined) {
            throw api_error_1.ApiError.ENOENT(p);
        }
        return Inode.fromBuffer(inode);
    };
    SyncKeyValueFileSystem.prototype.getDirListing = function (tx, p, inode) {
        if (!inode.isDirectory()) {
            throw api_error_1.ApiError.ENOTDIR(p);
        }
        var data = tx.get(inode.id);
        if (data === undefined) {
            throw api_error_1.ApiError.ENOENT(p);
        }
        return JSON.parse(data.toString());
    };
    SyncKeyValueFileSystem.prototype.addNewNode = function (tx, data) {
        var retries = 0, currId;
        while (retries < 5) {
            try {
                currId = GenerateRandomID();
                tx.put(currId, data, false);
                return currId;
            }
            catch (e) {
            }
        }
        throw new api_error_1.ApiError(api_error_1.ErrorCode.EIO, 'Unable to commit data to key-value store.');
    };
    SyncKeyValueFileSystem.prototype.commitNewFile = function (tx, p, type, mode, data) {
        var parentDir = path.dirname(p), fname = path.basename(p), parentNode = this.findINode(tx, parentDir), dirListing = this.getDirListing(tx, parentDir, parentNode), currTime = (new Date()).getTime();
        if (p === '/') {
            throw api_error_1.ApiError.EEXIST(p);
        }
        if (dirListing[fname]) {
            throw api_error_1.ApiError.EEXIST(p);
        }
        try {
            var dataId = this.addNewNode(tx, data), fileNode = new Inode(dataId, data.length, mode | type, currTime, currTime, currTime), fileNodeId = this.addNewNode(tx, fileNode.toBuffer());
            dirListing[fname] = fileNodeId;
            tx.put(parentNode.id, new Buffer(JSON.stringify(dirListing)), true);
        }
        catch (e) {
            tx.abort();
            throw e;
        }
        tx.commit();
        return fileNode;
    };
    SyncKeyValueFileSystem.prototype.empty = function () {
        this.store.clear();
        this.makeRootDirectory();
    };
    SyncKeyValueFileSystem.prototype.renameSync = function (oldPath, newPath) {
        var tx = this.store.beginTransaction('readwrite'), oldParent = path.dirname(oldPath), oldName = path.basename(oldPath), newParent = path.dirname(newPath), newName = path.basename(newPath), oldDirNode = this.findINode(tx, oldParent), oldDirList = this.getDirListing(tx, oldParent, oldDirNode);
        if (!oldDirList[oldName]) {
            throw api_error_1.ApiError.ENOENT(oldPath);
        }
        var nodeId = oldDirList[oldName];
        delete oldDirList[oldName];
        if ((newParent + '/').indexOf(oldPath + '/') === 0) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EBUSY, oldParent);
        }
        var newDirNode, newDirList;
        if (newParent === oldParent) {
            newDirNode = oldDirNode;
            newDirList = oldDirList;
        }
        else {
            newDirNode = this.findINode(tx, newParent);
            newDirList = this.getDirListing(tx, newParent, newDirNode);
        }
        if (newDirList[newName]) {
            var newNameNode = this.getINode(tx, newPath, newDirList[newName]);
            if (newNameNode.isFile()) {
                try {
                    tx.del(newNameNode.id);
                    tx.del(newDirList[newName]);
                }
                catch (e) {
                    tx.abort();
                    throw e;
                }
            }
            else {
                throw api_error_1.ApiError.EPERM(newPath);
            }
        }
        newDirList[newName] = nodeId;
        try {
            tx.put(oldDirNode.id, new Buffer(JSON.stringify(oldDirList)), true);
            tx.put(newDirNode.id, new Buffer(JSON.stringify(newDirList)), true);
        }
        catch (e) {
            tx.abort();
            throw e;
        }
        tx.commit();
    };
    SyncKeyValueFileSystem.prototype.statSync = function (p, isLstat) {
        return this.findINode(this.store.beginTransaction('readonly'), p).toStats();
    };
    SyncKeyValueFileSystem.prototype.createFileSync = function (p, flag, mode) {
        var tx = this.store.beginTransaction('readwrite'), data = new Buffer(0), newFile = this.commitNewFile(tx, p, node_fs_stats.FileType.FILE, mode, data);
        return new SyncKeyValueFile(this, p, flag, newFile.toStats(), data);
    };
    SyncKeyValueFileSystem.prototype.openFileSync = function (p, flag) {
        var tx = this.store.beginTransaction('readonly'), node = this.findINode(tx, p), data = tx.get(node.id);
        if (data === undefined) {
            throw api_error_1.ApiError.ENOENT(p);
        }
        return new SyncKeyValueFile(this, p, flag, node.toStats(), data);
    };
    SyncKeyValueFileSystem.prototype.removeEntry = function (p, isDir) {
        var tx = this.store.beginTransaction('readwrite'), parent = path.dirname(p), parentNode = this.findINode(tx, parent), parentListing = this.getDirListing(tx, parent, parentNode), fileName = path.basename(p);
        if (!parentListing[fileName]) {
            throw api_error_1.ApiError.ENOENT(p);
        }
        var fileNodeId = parentListing[fileName];
        delete parentListing[fileName];
        var fileNode = this.getINode(tx, p, fileNodeId);
        if (!isDir && fileNode.isDirectory()) {
            throw api_error_1.ApiError.EISDIR(p);
        }
        else if (isDir && !fileNode.isDirectory()) {
            throw api_error_1.ApiError.ENOTDIR(p);
        }
        try {
            tx.del(fileNode.id);
            tx.del(fileNodeId);
            tx.put(parentNode.id, new Buffer(JSON.stringify(parentListing)), true);
        }
        catch (e) {
            tx.abort();
            throw e;
        }
        tx.commit();
    };
    SyncKeyValueFileSystem.prototype.unlinkSync = function (p) {
        this.removeEntry(p, false);
    };
    SyncKeyValueFileSystem.prototype.rmdirSync = function (p) {
        this.removeEntry(p, true);
    };
    SyncKeyValueFileSystem.prototype.mkdirSync = function (p, mode) {
        var tx = this.store.beginTransaction('readwrite'), data = new Buffer('{}');
        this.commitNewFile(tx, p, node_fs_stats.FileType.DIRECTORY, mode, data);
    };
    SyncKeyValueFileSystem.prototype.readdirSync = function (p) {
        var tx = this.store.beginTransaction('readonly');
        return Object.keys(this.getDirListing(tx, p, this.findINode(tx, p)));
    };
    SyncKeyValueFileSystem.prototype._syncSync = function (p, data, stats) {
        var tx = this.store.beginTransaction('readwrite'), fileInodeId = this._findINode(tx, path.dirname(p), path.basename(p)), fileInode = this.getINode(tx, p, fileInodeId), inodeChanged = fileInode.update(stats);
        try {
            tx.put(fileInode.id, data, true);
            if (inodeChanged) {
                tx.put(fileInodeId, fileInode.toBuffer(), true);
            }
        }
        catch (e) {
            tx.abort();
            throw e;
        }
        tx.commit();
    };
    return SyncKeyValueFileSystem;
})(file_system.SynchronousFileSystem);
exports.SyncKeyValueFileSystem = SyncKeyValueFileSystem;
var AsyncKeyValueFile = (function (_super) {
    __extends(AsyncKeyValueFile, _super);
    function AsyncKeyValueFile(_fs, _path, _flag, _stat, contents) {
        _super.call(this, _fs, _path, _flag, _stat, contents);
    }
    AsyncKeyValueFile.prototype.sync = function (cb) {
        var _this = this;
        if (this.isDirty()) {
            this._fs._sync(this.getPath(), this.getBuffer(), this.getStats(), function (e) {
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
    AsyncKeyValueFile.prototype.close = function (cb) {
        this.sync(cb);
    };
    return AsyncKeyValueFile;
})(preload_file.PreloadFile);
exports.AsyncKeyValueFile = AsyncKeyValueFile;
var AsyncKeyValueFileSystem = (function (_super) {
    __extends(AsyncKeyValueFileSystem, _super);
    function AsyncKeyValueFileSystem() {
        _super.apply(this, arguments);
    }
    AsyncKeyValueFileSystem.prototype.init = function (store, cb) {
        this.store = store;
        this.makeRootDirectory(cb);
    };
    AsyncKeyValueFileSystem.isAvailable = function () { return true; };
    AsyncKeyValueFileSystem.prototype.getName = function () { return this.store.name(); };
    AsyncKeyValueFileSystem.prototype.isReadOnly = function () { return false; };
    AsyncKeyValueFileSystem.prototype.supportsSymlinks = function () { return false; };
    AsyncKeyValueFileSystem.prototype.supportsProps = function () { return false; };
    AsyncKeyValueFileSystem.prototype.supportsSynch = function () { return false; };
    AsyncKeyValueFileSystem.prototype.makeRootDirectory = function (cb) {
        var tx = this.store.beginTransaction('readwrite');
        tx.get(ROOT_NODE_ID, function (e, data) {
            if (e || data === undefined) {
                var currTime = (new Date()).getTime(), dirInode = new Inode(GenerateRandomID(), 4096, 511 | node_fs_stats.FileType.DIRECTORY, currTime, currTime, currTime);
                tx.put(dirInode.id, new Buffer("{}"), false, function (e) {
                    if (noErrorTx(e, tx, cb)) {
                        tx.put(ROOT_NODE_ID, dirInode.toBuffer(), false, function (e) {
                            if (e) {
                                tx.abort(function () { cb(e); });
                            }
                            else {
                                tx.commit(cb);
                            }
                        });
                    }
                });
            }
            else {
                tx.commit(cb);
            }
        });
    };
    AsyncKeyValueFileSystem.prototype._findINode = function (tx, parent, filename, cb) {
        var _this = this;
        var handle_directory_listings = function (e, inode, dirList) {
            if (e) {
                cb(e);
            }
            else if (dirList[filename]) {
                cb(null, dirList[filename]);
            }
            else {
                cb(api_error_1.ApiError.ENOENT(path.resolve(parent, filename)));
            }
        };
        if (parent === '/') {
            if (filename === '') {
                cb(null, ROOT_NODE_ID);
            }
            else {
                this.getINode(tx, parent, ROOT_NODE_ID, function (e, inode) {
                    if (noError(e, cb)) {
                        _this.getDirListing(tx, parent, inode, function (e, dirList) {
                            handle_directory_listings(e, inode, dirList);
                        });
                    }
                });
            }
        }
        else {
            this.findINodeAndDirListing(tx, parent, handle_directory_listings);
        }
    };
    AsyncKeyValueFileSystem.prototype.findINode = function (tx, p, cb) {
        var _this = this;
        this._findINode(tx, path.dirname(p), path.basename(p), function (e, id) {
            if (noError(e, cb)) {
                _this.getINode(tx, p, id, cb);
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.getINode = function (tx, p, id, cb) {
        tx.get(id, function (e, data) {
            if (noError(e, cb)) {
                if (data === undefined) {
                    cb(api_error_1.ApiError.ENOENT(p));
                }
                else {
                    cb(null, Inode.fromBuffer(data));
                }
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.getDirListing = function (tx, p, inode, cb) {
        if (!inode.isDirectory()) {
            cb(api_error_1.ApiError.ENOTDIR(p));
        }
        else {
            tx.get(inode.id, function (e, data) {
                if (noError(e, cb)) {
                    try {
                        cb(null, JSON.parse(data.toString()));
                    }
                    catch (e) {
                        cb(api_error_1.ApiError.ENOENT(p));
                    }
                }
            });
        }
    };
    AsyncKeyValueFileSystem.prototype.findINodeAndDirListing = function (tx, p, cb) {
        var _this = this;
        this.findINode(tx, p, function (e, inode) {
            if (noError(e, cb)) {
                _this.getDirListing(tx, p, inode, function (e, listing) {
                    if (noError(e, cb)) {
                        cb(null, inode, listing);
                    }
                });
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.addNewNode = function (tx, data, cb) {
        var retries = 0, currId, reroll = function () {
            if (++retries === 5) {
                cb(new api_error_1.ApiError(api_error_1.ErrorCode.EIO, 'Unable to commit data to key-value store.'));
            }
            else {
                currId = GenerateRandomID();
                tx.put(currId, data, false, function (e, committed) {
                    if (e || !committed) {
                        reroll();
                    }
                    else {
                        cb(null, currId);
                    }
                });
            }
        };
        reroll();
    };
    AsyncKeyValueFileSystem.prototype.commitNewFile = function (tx, p, type, mode, data, cb) {
        var _this = this;
        var parentDir = path.dirname(p), fname = path.basename(p), currTime = (new Date()).getTime();
        if (p === '/') {
            return cb(api_error_1.ApiError.EEXIST(p));
        }
        this.findINodeAndDirListing(tx, parentDir, function (e, parentNode, dirListing) {
            if (noErrorTx(e, tx, cb)) {
                if (dirListing[fname]) {
                    tx.abort(function () {
                        cb(api_error_1.ApiError.EEXIST(p));
                    });
                }
                else {
                    _this.addNewNode(tx, data, function (e, dataId) {
                        if (noErrorTx(e, tx, cb)) {
                            var fileInode = new Inode(dataId, data.length, mode | type, currTime, currTime, currTime);
                            _this.addNewNode(tx, fileInode.toBuffer(), function (e, fileInodeId) {
                                if (noErrorTx(e, tx, cb)) {
                                    dirListing[fname] = fileInodeId;
                                    tx.put(parentNode.id, new Buffer(JSON.stringify(dirListing)), true, function (e) {
                                        if (noErrorTx(e, tx, cb)) {
                                            tx.commit(function (e) {
                                                if (noErrorTx(e, tx, cb)) {
                                                    cb(null, fileInode);
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.empty = function (cb) {
        var _this = this;
        this.store.clear(function (e) {
            if (noError(e, cb)) {
                _this.makeRootDirectory(cb);
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.rename = function (oldPath, newPath, cb) {
        var _this = this;
        var tx = this.store.beginTransaction('readwrite'), oldParent = path.dirname(oldPath), oldName = path.basename(oldPath), newParent = path.dirname(newPath), newName = path.basename(newPath), inodes = {}, lists = {}, errorOccurred = false;
        if ((newParent + '/').indexOf(oldPath + '/') === 0) {
            return cb(new api_error_1.ApiError(api_error_1.ErrorCode.EBUSY, oldParent));
        }
        var theOleSwitcharoo = function () {
            if (errorOccurred || !lists.hasOwnProperty(oldParent) || !lists.hasOwnProperty(newParent)) {
                return;
            }
            var oldParentList = lists[oldParent], oldParentINode = inodes[oldParent], newParentList = lists[newParent], newParentINode = inodes[newParent];
            if (!oldParentList[oldName]) {
                cb(api_error_1.ApiError.ENOENT(oldPath));
            }
            else {
                var fileId = oldParentList[oldName];
                delete oldParentList[oldName];
                var completeRename = function () {
                    newParentList[newName] = fileId;
                    tx.put(oldParentINode.id, new Buffer(JSON.stringify(oldParentList)), true, function (e) {
                        if (noErrorTx(e, tx, cb)) {
                            if (oldParent === newParent) {
                                tx.commit(cb);
                            }
                            else {
                                tx.put(newParentINode.id, new Buffer(JSON.stringify(newParentList)), true, function (e) {
                                    if (noErrorTx(e, tx, cb)) {
                                        tx.commit(cb);
                                    }
                                });
                            }
                        }
                    });
                };
                if (newParentList[newName]) {
                    _this.getINode(tx, newPath, newParentList[newName], function (e, inode) {
                        if (noErrorTx(e, tx, cb)) {
                            if (inode.isFile()) {
                                tx.del(inode.id, function (e) {
                                    if (noErrorTx(e, tx, cb)) {
                                        tx.del(newParentList[newName], function (e) {
                                            if (noErrorTx(e, tx, cb)) {
                                                completeRename();
                                            }
                                        });
                                    }
                                });
                            }
                            else {
                                tx.abort(function (e) {
                                    cb(api_error_1.ApiError.EPERM(newPath));
                                });
                            }
                        }
                    });
                }
                else {
                    completeRename();
                }
            }
        };
        var processInodeAndListings = function (p) {
            _this.findINodeAndDirListing(tx, p, function (e, node, dirList) {
                if (e) {
                    if (!errorOccurred) {
                        errorOccurred = true;
                        tx.abort(function () {
                            cb(e);
                        });
                    }
                }
                else {
                    inodes[p] = node;
                    lists[p] = dirList;
                    theOleSwitcharoo();
                }
            });
        };
        processInodeAndListings(oldParent);
        if (oldParent !== newParent) {
            processInodeAndListings(newParent);
        }
    };
    AsyncKeyValueFileSystem.prototype.stat = function (p, isLstat, cb) {
        var tx = this.store.beginTransaction('readonly');
        this.findINode(tx, p, function (e, inode) {
            if (noError(e, cb)) {
                cb(null, inode.toStats());
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.createFile = function (p, flag, mode, cb) {
        var _this = this;
        var tx = this.store.beginTransaction('readwrite'), data = new Buffer(0);
        this.commitNewFile(tx, p, node_fs_stats.FileType.FILE, mode, data, function (e, newFile) {
            if (noError(e, cb)) {
                cb(null, new AsyncKeyValueFile(_this, p, flag, newFile.toStats(), data));
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.openFile = function (p, flag, cb) {
        var _this = this;
        var tx = this.store.beginTransaction('readonly');
        this.findINode(tx, p, function (e, inode) {
            if (noError(e, cb)) {
                tx.get(inode.id, function (e, data) {
                    if (noError(e, cb)) {
                        if (data === undefined) {
                            cb(api_error_1.ApiError.ENOENT(p));
                        }
                        else {
                            cb(null, new AsyncKeyValueFile(_this, p, flag, inode.toStats(), data));
                        }
                    }
                });
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.removeEntry = function (p, isDir, cb) {
        var _this = this;
        var tx = this.store.beginTransaction('readwrite'), parent = path.dirname(p), fileName = path.basename(p);
        this.findINodeAndDirListing(tx, parent, function (e, parentNode, parentListing) {
            if (noErrorTx(e, tx, cb)) {
                if (!parentListing[fileName]) {
                    tx.abort(function () {
                        cb(api_error_1.ApiError.ENOENT(p));
                    });
                }
                else {
                    var fileNodeId = parentListing[fileName];
                    delete parentListing[fileName];
                    _this.getINode(tx, p, fileNodeId, function (e, fileNode) {
                        if (noErrorTx(e, tx, cb)) {
                            if (!isDir && fileNode.isDirectory()) {
                                tx.abort(function () {
                                    cb(api_error_1.ApiError.EISDIR(p));
                                });
                            }
                            else if (isDir && !fileNode.isDirectory()) {
                                tx.abort(function () {
                                    cb(api_error_1.ApiError.ENOTDIR(p));
                                });
                            }
                            else {
                                tx.del(fileNode.id, function (e) {
                                    if (noErrorTx(e, tx, cb)) {
                                        tx.del(fileNodeId, function (e) {
                                            if (noErrorTx(e, tx, cb)) {
                                                tx.put(parentNode.id, new Buffer(JSON.stringify(parentListing)), true, function (e) {
                                                    if (noErrorTx(e, tx, cb)) {
                                                        tx.commit(cb);
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        }
                    });
                }
            }
        });
    };
    AsyncKeyValueFileSystem.prototype.unlink = function (p, cb) {
        this.removeEntry(p, false, cb);
    };
    AsyncKeyValueFileSystem.prototype.rmdir = function (p, cb) {
        this.removeEntry(p, true, cb);
    };
    AsyncKeyValueFileSystem.prototype.mkdir = function (p, mode, cb) {
        var tx = this.store.beginTransaction('readwrite'), data = new Buffer('{}');
        this.commitNewFile(tx, p, node_fs_stats.FileType.DIRECTORY, mode, data, cb);
    };
    AsyncKeyValueFileSystem.prototype.readdir = function (p, cb) {
        var _this = this;
        var tx = this.store.beginTransaction('readonly');
        this.findINode(tx, p, function (e, inode) {
            if (noError(e, cb)) {
                _this.getDirListing(tx, p, inode, function (e, dirListing) {
                    if (noError(e, cb)) {
                        cb(null, Object.keys(dirListing));
                    }
                });
            }
        });
    };
    AsyncKeyValueFileSystem.prototype._sync = function (p, data, stats, cb) {
        var _this = this;
        var tx = this.store.beginTransaction('readwrite');
        this._findINode(tx, path.dirname(p), path.basename(p), function (e, fileInodeId) {
            if (noErrorTx(e, tx, cb)) {
                _this.getINode(tx, p, fileInodeId, function (e, fileInode) {
                    if (noErrorTx(e, tx, cb)) {
                        var inodeChanged = fileInode.update(stats);
                        tx.put(fileInode.id, data, true, function (e) {
                            if (noErrorTx(e, tx, cb)) {
                                if (inodeChanged) {
                                    tx.put(fileInodeId, fileInode.toBuffer(), true, function (e) {
                                        if (noErrorTx(e, tx, cb)) {
                                            tx.commit(cb);
                                        }
                                    });
                                }
                                else {
                                    tx.commit(cb);
                                }
                            }
                        });
                    }
                });
            }
        });
    };
    return AsyncKeyValueFileSystem;
})(file_system.BaseFileSystem);
exports.AsyncKeyValueFileSystem = AsyncKeyValueFileSystem;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2V5X3ZhbHVlX2ZpbGVzeXN0ZW0uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvZ2VuZXJpYy9rZXlfdmFsdWVfZmlsZXN5c3RlbS50cyJdLCJuYW1lcyI6WyJHZW5lcmF0ZVJhbmRvbUlEIiwibm9FcnJvciIsIm5vRXJyb3JUeCIsIlNpbXBsZVN5bmNSV1RyYW5zYWN0aW9uIiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24uY29uc3RydWN0b3IiLCJTaW1wbGVTeW5jUldUcmFuc2FjdGlvbi5zdGFzaE9sZFZhbHVlIiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24ubWFya01vZGlmaWVkIiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24uZ2V0IiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24ucHV0IiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24uZGVsIiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24uY29tbWl0IiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24uYWJvcnQiLCJTeW5jS2V5VmFsdWVGaWxlIiwiU3luY0tleVZhbHVlRmlsZS5jb25zdHJ1Y3RvciIsIlN5bmNLZXlWYWx1ZUZpbGUuc3luY1N5bmMiLCJTeW5jS2V5VmFsdWVGaWxlLmNsb3NlU3luYyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0iLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmNvbnN0cnVjdG9yIiwiU3luY0tleVZhbHVlRmlsZVN5c3RlbS5pc0F2YWlsYWJsZSIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uZ2V0TmFtZSIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uaXNSZWFkT25seSIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uc3VwcG9ydHNTeW1saW5rcyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uc3VwcG9ydHNQcm9wcyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uc3VwcG9ydHNTeW5jaCIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0ubWFrZVJvb3REaXJlY3RvcnkiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLl9maW5kSU5vZGUiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmZpbmRJTm9kZSIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uZ2V0SU5vZGUiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmdldERpckxpc3RpbmciLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmFkZE5ld05vZGUiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmNvbW1pdE5ld0ZpbGUiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmVtcHR5IiwiU3luY0tleVZhbHVlRmlsZVN5c3RlbS5yZW5hbWVTeW5jIiwiU3luY0tleVZhbHVlRmlsZVN5c3RlbS5zdGF0U3luYyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uY3JlYXRlRmlsZVN5bmMiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLm9wZW5GaWxlU3luYyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0ucmVtb3ZlRW50cnkiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLnVubGlua1N5bmMiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLnJtZGlyU3luYyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0ubWtkaXJTeW5jIiwiU3luY0tleVZhbHVlRmlsZVN5c3RlbS5yZWFkZGlyU3luYyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uX3N5bmNTeW5jIiwiQXN5bmNLZXlWYWx1ZUZpbGUiLCJBc3luY0tleVZhbHVlRmlsZS5jb25zdHJ1Y3RvciIsIkFzeW5jS2V5VmFsdWVGaWxlLnN5bmMiLCJBc3luY0tleVZhbHVlRmlsZS5jbG9zZSIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uY29uc3RydWN0b3IiLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5pbml0IiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uaXNBdmFpbGFibGUiLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5nZXROYW1lIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uaXNSZWFkT25seSIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLnN1cHBvcnRzU3ltbGlua3MiLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5zdXBwb3J0c1Byb3BzIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uc3VwcG9ydHNTeW5jaCIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLm1ha2VSb290RGlyZWN0b3J5IiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uX2ZpbmRJTm9kZSIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmZpbmRJTm9kZSIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmdldElOb2RlIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uZ2V0RGlyTGlzdGluZyIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmZpbmRJTm9kZUFuZERpckxpc3RpbmciLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5hZGROZXdOb2RlIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uY29tbWl0TmV3RmlsZSIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmVtcHR5IiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0ucmVuYW1lIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uc3RhdCIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmNyZWF0ZUZpbGUiLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5vcGVuRmlsZSIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLnJlbW92ZUVudHJ5IiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0udW5saW5rIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0ucm1kaXIiLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5ta2RpciIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLnJlYWRkaXIiLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5fc3luYyJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxJQUFPLFdBQVcsV0FBVyxxQkFBcUIsQ0FBQyxDQUFDO0FBQ3BELDBC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QUNBO1FBQ0hBLENBQUNBLENBQUNBO1FBQ0ZBLEVBQUVBLENBQUNBLENBQUNBLE1BQU1BLEtBQUtBLEdBQUdBLENBQUNBLENBQUNBLENBQUNBO1lBQ25CQSxFQUFFQSxDQUFDQSxDQUFDQSxRQUFRQSxLQUFLQSxFQUFFQSxDQUFDQSxDQUFDQSxDQUFDQTtnQkFFcEJBLE1BQU1BLENBQUNBLFlBQVlBLENBQUNBO1lBQ3RCQSxDQUFDQTtZQUFDQSxJQUFJQSxDQUFDQSxDQUFDQTtnQkFFTkEsTUFBTUEsQ0FBQ0EsY0FBY0EsQ0FBQ0EsSUFBSUEsQ0FBQ0EsUUFBUUEsQ0FBQ0EsRUFBRUEsRUFBRUEsTUFBTUEsRUFBRUEsWUFBWUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFDakVBLENBQUNBO1FBQ0hBLENBQUNBO1FBQUNBLElBQUlBLENBQUNBLENBQUNBO1lBQ05BLE1BQU1BLENBQUNBLGNBQWNBLENBQUNBLElBQUlBLENBQUNBLFFBQVFBLENBQUNBLEVBQUVBLEVBQUVBLE1BQU1BLEdBQUdBLElBQUlBLENBQUNBLEdBQUdBLEdBQUdBLFFBQVFBLEVBQ2xFQSxJQUFJQSxDQUFDQSxVQUFVQSxDQUFDQSxFQUFFQSxFQUFFQSxJQUFJQSxDQUFDQSxPQUFPQSxDQUFDQSxNQUFNQSxDQUFDQSxFQUFFQSxJQUFJQSxDQUFDQSxRQUFRQSxDQUFDQSxNQUFNQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQTtRQUN2RUEsQ0FBQ0E7SUFDSEEsQ0FBQ0E7SUFRT1QsMENBQVNBLEdBQWpCQSxVQUFrQkEsRUFBNkJBLEVBQUVBLENBQVNBO1FBQ3hEVSxNQUFNQSxDQUFDQSxJQUFJQSxDQUFDQSxRQUFRQSxDQUFDQSxFQUFFQSxFQUFFQSxDQUFDQSxFQUFFQSxJQUFJQSxDQUFDQSxVQUFVQSxDQUFDQSxFQUFFQSxFQUFFQSxJQUFJQSxDQUFDQSxPQUFPQSxDQUFDQSxDQUFDQSxDQUFDQSxFQUFFQSxJQUFJQSxDQUFDQSxRQUFRQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQTtJQUN0RkEsQ0FBQ0E7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UUEsQ0FBQ0EsTUFBTUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDM0JBLENBQUNBO1FBR0RBLEVBQUVBLENBQUNBLENBQUNBLFVBQVVBLENBQUNBLEtBQUtBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1lBQ3RCQSxNQUFNQSxvQkFBUUEsQ0FBQ0EsTUFBTUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDM0JBLENBQUNBO1FBRURBLElBQUlBLENBQUNBO1lBRUhBLElBQUlBLE1BQU1BLEdBQUdBLElBQUlBLENBQUNBLFVBQVVBLENBQUNBLEVBQUVBLEVBQUVBLElBQUlBLENBQUNBLEVBQ3BDQSxRQUFRQSxHQUFHQSxJQUFJQSxLQUFLQSxDQUFDQSxNQUFNQSxFQUFFQSxJQUFJQSxDQUFDQSxNQUFNQSxFQUFFQSxJQUFJQSxHQUFHQSxJQUFJQSxFQUFFQSxRQUFRQSxFQUFFQSxRQUFRQSxFQUFFQSxRQUFRQSxDQUFDQSxFQUVwRkEsVUFBVUEsR0FBR0EsSUFBSUEsQ0FBQ0EsVUFBVUEsQ0FBQ0EsRUFBRUEsRUFBRUEsUUFBUUEsQ0FBQ0EsUUFBUUEsRUFBRUEsQ0FBQ0EsQ0FBQ0E7WUFFeERBLFVBQVVBLENBQUNBLEtBQUtBLENBQUNBLEdBQUdBLFVBQVVBLENBQUNBO1lBQy9CQSxFQUFFQSxDQUFDQSxHQUFHQSxDQUFDQSxVQUFVQSxDQUFDQSxFQUFFQSxFQUFFQSxJQUFJQSxNQUFNQSxDQUFDQSxJQUFJQSxDQUFDQSxTQUFTQSxDQUFDQSxVQUFVQSxDQUFDQSxDQUFDQSxFQUFFQSxJQUFJQSxDQUFDQSxDQUFDQTtRQUN0RUEsQ0FBRUE7UUFBQUEsS0FBS0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFDWEEsRUFBRUEsQ0FBQ0EsS0FBS0EsRUFBRUEsQ0FBQ0E7WUFDWEEsTUFBTUEsQ0FBQ0EsQ0FBQ0E7UUFDVkEsQ0FBQ0E7UUFDREEsRUFBRUEsQ0FBQ0EsTUFBTUEsRUFBRUEsQ0FBQ0E7UUFDWkEsTUFBTUEsQ0FBQ0EsUUFBUUEsQ0FBQ0E7SUFDbEJBLENBQUNB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Q0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFDZEEsTUFBTUEsQ0FBQ0EsRUFBRUEsQ0FBQ0Esb0JBQVFBLENBQUNBLE1BQU1BLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1FBQ2hDQSxDQUFDQTtRQUtEQSxJQUFJQSxDQUFDQSxzQkFBc0JBLENBQUNBLEVBQUVBLEVBQUVBLFNBQVNBLEVBQUVBLFVBQUNBLENBQVdBLEVBQUVBLFVBQWtCQSxFQUFFQSxVQUFxQ0E7WUFDaEhBLEVBQUVBLENBQUNBLENBQUNBLFNBQVNBLENBQUNBLENBQUNBLEVBQUVBLEVBQUVBLEVBQUVBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO2dCQUN6QkEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsVUFBVUEsQ0FBQ0EsS0FBS0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7b0JBRXRCQSxFQUFFQSxDQUFDQSxLQUFLQSxDQUFDQTt3QkFDUEEsRUFBRUEsQ0FBQ0Esb0JBQVFBLENBQUNBLE1BQU1BLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO29CQUN6QkEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7Z0JBQ0xBLENBQUNBO2dCQUFDQSxJQUFJQSxDQUFDQSxDQUFDQTtvQkFFTkEsS0FBSUEsQ0FBQ0EsVUFBVUEsQ0FBQ0EsRUFBRUEsRUFBRUEsSUFBSUEsRUFBRUEsVUFBQ0EsQ0FBV0EsRUFBRUEsTUFBZUE7d0JBQ3JEQSxFQUFFQSxDQUFDQSxDQUFDQSxTQUFTQSxDQUFDQSxDQUFDQSxFQUFFQSxFQUFFQSxFQUFFQSxFQUFFQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQTs0QkFFekJBLElBQUlBLFNBQVNBLEdBQUdBLElBQUlBLEtBQUtBLENBQUNBLE1BQU1BLEVBQUVBLElBQUlBLENBQUNBLE1BQU1BLEVBQUVBLElBQUlBLEdBQUdBLElBQUlBLEVBQUVBLFFBQVFBLEVBQUVBLFFBQVFBLEVBQUVBLFFBQVFBLENBQUNBLENBQUNBOzRCQUMxRkEsS0FBSUEsQ0FBQ0EsVUFBVUEsQ0FBQ0EsRUFBRUEsRUFBRUEsU0FBU0EsQ0FBQ0Es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Q0EsVUFBVUEsQ0FBQ0EsRUFBRUEsRUFBRUEsSUFBSUEsQ0FBQ0EsT0FBT0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsRUFBRUEsSUFBSUEsQ0FBQ0EsUUFBUUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsRUFBRUEsVUFBQ0EsQ0FBV0EsRUFBRUEsV0FBb0JBO1lBQ3ZGQSxFQUFFQSxDQUFDQSxDQUFDQSxTQUFTQSxDQUFDQSxDQUFDQSxFQUFFQSxFQUFFQSxFQUFFQSxFQUFFQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQTtnQkFFekJBLEtBQUlBLENBQUNBLFFBQVFBLENBQUNBLEVBQUVBLEVBQUVBLENBQUNBLEVBQUVBLFdBQVdBLEVBQUVBLFVBQUNBLENBQVdBLEVBQUVBLFNBQWlCQTtvQkFDL0RBLEVBQUVBLENBQUNBLENBQUNBLFNBQVNBLENBQUNBLENBQUNBLEVBQUVBLEVBQUVBLEVBQUVBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO3dCQUN6QkEsSUFBSUEsWUFBWUEsR0FBWUEsU0FBU0EsQ0FBQ0EsTUFBTUEsQ0FBQ0EsS0FBS0EsQ0FBQ0EsQ0FBQ0E7d0JBRXBEQSxFQUFFQSxDQUFDQSxHQUFHQSxDQUFDQSxTQUFTQSxDQUFDQSxFQUFFQSxFQUFFQSxJQUFJQSxFQUFFQSxJQUFJQSxFQUFFQSxVQUFDQSxDQUFXQTs0QkFDM0NBLEVBQUVBLENBQUNBLENBQUNBLFNBQVNBLENBQUNBLENBQUNBLEVBQUVBLEVBQUVBLEVBQUVBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO2dDQUV6QkEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsWUFBWUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7b0NBQ2pCQSxFQUFFQSxDQUFDQSxHQUFHQSxDQUFDQSxXQUFXQSxFQUFFQSxTQUFTQSxDQUFDQSxRQUFRQSxFQUFFQSxFQUFFQSxJQUFJQSxFQUFFQSxVQUFDQSxDQUFXQTt3Q0FDMURBLEVBQUVBLENBQUNBLENBQUNBLFNBQVNBLENBQUNBLENBQUNBLEVBQUVBLEVBQUVBLEVBQUVBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBLENBQUNBOzRDQUN6QkEsRUFBRUEsQ0FBQ0EsTUFBTUEsQ0FBQ0EsRUFBRUEsQ0FBQ0EsQ0FBQ0E7d0NBQ2hCQSxDQUFDQTtvQ0FDSEEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7Z0NBQ0xBLENBQUNBO2dDQUFDQSxJQUFJQSxDQUFDQSxDQUFDQTtvQ0FFTkEsRUFBRUEsQ0FBQ0EsTUFBTUEsQ0FBQ0EsRUFBRUEsQ0FBQ0EsQ0FBQ0E7Z0NBQ2hCQSxDQUFDQTs0QkFDSEEsQ0FBQ0E7d0JBQ0hBLENBQUNBLENBQUNBLENBQUNBO29CQUNMQSxDQUFDQTtnQkFDSEEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFDTEEsQ0FBQ0E7UUFDSEEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7SUFDTEEsQ0FBQ0E7SUFDSDNCLDhCQUFDQTtBQUFEQSxDQUFDQSxBQXZoQkQsRUFBNkMsV0FBVyxDQUFDLGNBQWMsRUF1aEJ0RTtBQXZoQlksK0JBQXVCLDBCQXVoQm5DLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZmlsZV9zeXN0ZW0gPSByZXF1aXJlKCcuLi9jb3JlL2ZpbGVfc3lzdGVtJyk7XG5pbXBvcnQge0FwaUVycm9yLCBFcnJvckNvZGV9IGZyb20gJy4uL2NvcmUvYXBpX2Vycm9yJztcbmltcG9ydCBub2RlX2ZzX3N0YXRzID0gcmVxdWlyZSgnLi4vY29yZS9ub2RlX2ZzX3N0YXRzJyk7XG5pbXBvcnQgZmlsZSA9IHJlcXVpcmUoJy4uL2NvcmUvZmlsZScpO1xuaW1wb3J0IGZpbGVfZmxhZyA9IHJlcXVpcmUoJy4uL2NvcmUvZmlsZV9mbGFnJyk7XG5pbXBvcnQgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKTtcbmltcG9ydCBJbm9kZSA9IHJlcXVpcmUoJy4uL2dlbmVyaWMvaW5vZGUnKTtcbmltcG9ydCBwcmVsb2FkX2ZpbGUgPSByZXF1aXJlKCcuLi9nZW5lcmljL3ByZWxvYWRfZmlsZScpO1xudmFyIFJPT1RfTk9ERV9JRDogc3RyaW5nID0gXCIvXCI7XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgcmFuZG9tIElELlxuICovXG5mdW5jdGlvbiBHZW5lcmF0ZVJhbmRvbUlEKCk6IHN0cmluZyB7XG4gIC8vIEZyb20gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xMDUwMzQvaG93LXRvLWNyZWF0ZS1hLWd1aWQtdXVpZC1pbi1qYXZhc2NyaXB0XG4gIHJldHVybiAneHh4eHh4eHgteHh4eC00eHh4LXl4eHgteHh4eHh4eHh4eHh4Jy5yZXBsYWNlKC9beHldL2csIGZ1bmN0aW9uIChjKSB7XG4gICAgdmFyIHIgPSBNYXRoLnJhbmRvbSgpICogMTYgfCAwLCB2ID0gYyA9PSAneCcgPyByIDogKHIgJiAweDMgfCAweDgpO1xuICAgIHJldHVybiB2LnRvU3RyaW5nKDE2KTtcbiAgfSk7XG59XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uLiBDaGVja3MgaWYgJ2UnIGlzIGRlZmluZWQuIElmIHNvLCBpdCB0cmlnZ2VycyB0aGUgY2FsbGJhY2tcbiAqIHdpdGggJ2UnIGFuZCByZXR1cm5zIGZhbHNlLiBPdGhlcndpc2UsIHJldHVybnMgdHJ1ZS5cbiAqL1xuZnVuY3Rpb24gbm9FcnJvcihlOiBBcGlFcnJvciwgY2I6IChlOiBBcGlFcnJvcikgPT4gdm9pZCk6IGJvb2xlYW4ge1xuICBpZiAoZSkge1xuICAgIGNiKGUpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuLyoqXG4gKiBIZWxwZXIgZnVuY3Rpb24uIENoZWNrcyBpZiAnZScgaXMgZGVmaW5lZC4gSWYgc28sIGl0IGFib3J0cyB0aGUgdHJhbnNhY3Rpb24sXG4gKiB0cmlnZ2VycyB0aGUgY2FsbGJhY2sgd2l0aCAnZScsIGFuZCByZXR1cm5zIGZhbHNlLiBPdGhlcndpc2UsIHJldHVybnMgdHJ1ZS5cbiAqL1xuZnVuY3Rpb24gbm9FcnJvclR4KGU6IEFwaUVycm9yLCB0eDogQXN5bmNLZXlWYWx1ZVJXVHJhbnNhY3Rpb24sIGNiOiAoZTogQXBpRXJyb3IpID0+IHZvaWQpOiBib29sZWFuIHtcbiAgaWYgKGUpIHtcbiAgICB0eC5hYm9ydCgoKSA9PiB7XG4gICAgICBjYihlKTtcbiAgICB9KTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhICpzeW5jaHJvbm91cyoga2V5LXZhbHVlIHN0b3JlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFN5bmNLZXlWYWx1ZVN0b3JlIHtcbiAgLyoqXG4gICAqIFRoZSBuYW1lIG9mIHRoZSBrZXktdmFsdWUgc3RvcmUuXG4gICAqL1xuICBuYW1lKCk6IHN0cmluZztcbiAgLyoqXG4gICAqIEVtcHRpZXMgdGhlIGtleS12YWx1ZSBzdG9yZSBjb21wbGV0ZWx5LlxuICAgKi9cbiAgY2xlYXIoKTogdm9pZDtcbiAgLyoqXG4gICAqIEJlZ2lucyBhIG5ldyByZWFkLW9ubHkgdHJhbnNhY3Rpb24uXG4gICAqL1xuICBiZWdpblRyYW5zYWN0aW9uKHR5cGU6IFwicmVhZG9ubHlcIik6IFN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb247XG4gIC8qKlxuICAgKiBCZWdpbnMgYSBuZXcgcmVhZC13cml0ZSB0cmFuc2FjdGlvbi5cbiAgICovXG4gIGJlZ2luVHJhbnNhY3Rpb24odHlwZTogXCJyZWFkd3JpdGVcIik6IFN5bmNLZXlWYWx1ZVJXVHJhbnNhY3Rpb247XG4gIGJlZ2luVHJhbnNhY3Rpb24odHlwZTogc3RyaW5nKTogU3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbjtcbn1cblxuLyoqXG4gKiBBIHJlYWQtb25seSB0cmFuc2FjdGlvbiBmb3IgYSBzeW5jaHJvbm91cyBrZXkgdmFsdWUgc3RvcmUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbiB7XG4gIC8qKlxuICAgKiBSZXRyaWV2ZXMgdGhlIGRhdGEgYXQgdGhlIGdpdmVuIGtleS4gVGhyb3dzIGFuIEFwaUVycm9yIGlmIGFuIGVycm9yIG9jY3Vyc1xuICAgKiBvciBpZiB0aGUga2V5IGRvZXMgbm90IGV4aXN0LlxuICAgKiBAcGFyYW0ga2V5IFRoZSBrZXkgdG8gbG9vayB1bmRlciBmb3IgZGF0YS5cbiAgICogQHJldHVybiBUaGUgZGF0YSBzdG9yZWQgdW5kZXIgdGhlIGtleSwgb3IgdW5kZWZpbmVkIGlmIG5vdCBwcmVzZW50LlxuICAgKi9cbiAgZ2V0KGtleTogc3RyaW5nKTogTm9kZUJ1ZmZlcjtcbn1cblxuLyoqXG4gKiBBIHJlYWQtd3JpdGUgdHJhbnNhY3Rpb24gZm9yIGEgc3luY2hyb25vdXMga2V5IHZhbHVlIHN0b3JlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFN5bmNLZXlWYWx1ZVJXVHJhbnNhY3Rpb24gZXh0ZW5kcyBTeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uIHtcbiAgLyoqXG4gICAqIEFkZHMgdGhlIGRhdGEgdG8gdGhlIHN0b3JlIHVuZGVyIHRoZSBnaXZlbiBrZXkuXG4gICAqIEBwYXJhbSBrZXkgVGhlIGtleSB0byBhZGQgdGhlIGRhdGEgdW5kZXIuXG4gICAqIEBwYXJhbSBkYXRhIFRoZSBkYXRhIHRvIGFkZCB0byB0aGUgc3RvcmUuXG4gICAqIEBwYXJhbSBvdmVyd3JpdGUgSWYgJ3RydWUnLCBvdmVyd3JpdGUgYW55IGV4aXN0aW5nIGRhdGEuIElmICdmYWxzZScsXG4gICAqICAgYXZvaWRzIHN0b3JpbmcgdGhlIGRhdGEgaWYgdGhlIGtleSBleGlzdHMuXG4gICAqIEByZXR1cm4gVHJ1ZSBpZiBzdG9yYWdlIHN1Y2NlZWRlZCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgKi9cbiAgcHV0KGtleTogc3RyaW5nLCBkYXRhOiBOb2RlQnVmZmVyLCBvdmVyd3JpdGU6IGJvb2xlYW4pOiBib29sZWFuO1xuICAvKipcbiAgICogRGVsZXRlcyB0aGUgZGF0YSBhdCB0aGUgZ2l2ZW4ga2V5LlxuICAgKiBAcGFyYW0ga2V5IFRoZSBrZXkgdG8gZGVsZXRlIGZyb20gdGhlIHN0b3JlLlxuICAgKi9cbiAgZGVsKGtleTogc3RyaW5nKTogdm9pZDtcbiAgLyoqXG4gICAqIENvbW1pdHMgdGhlIHRyYW5zYWN0aW9uLlxuICAgKi9cbiAgY29tbWl0KCk6IHZvaWQ7XG4gIC8qKlxuICAgKiBBYm9ydHMgYW5kIHJvbGxzIGJhY2sgdGhlIHRyYW5zYWN0aW9uLlxuICAgKi9cbiAgYWJvcnQoKTogdm9pZDtcbn1cblxuLyoqXG4gKiBBbiBpbnRlcmZhY2UgZm9yIHNpbXBsZSBzeW5jaHJvbm91cyBrZXktdmFsdWUgc3RvcmVzIHRoYXQgZG9uJ3QgaGF2ZSBzcGVjaWFsXG4gKiBzdXBwb3J0IGZvciB0cmFuc2FjdGlvbnMgYW5kIHN1Y2guXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU2ltcGxlU3luY1N0b3JlIHtcbiAgZ2V0KGtleTogc3RyaW5nKTogTm9kZUJ1ZmZlcjtcbiAgcHV0KGtleTogc3RyaW5nLCBkYXRhOiBOb2RlQnVmZmVyLCBvdmVyd3JpdGU6IGJvb2xlYW4pOiBib29sZWFuO1xuICBkZWwoa2V5OiBzdHJpbmcpOiB2b2lkO1xufVxuXG4vKipcbiAqIEEgc2ltcGxlIFJXIHRyYW5zYWN0aW9uIGZvciBzaW1wbGUgc3luY2hyb25vdXMga2V5LXZhbHVlIHN0b3Jlcy5cbiAqL1xuZXhwb3J0IGNsYXNzIFNpbXBsZVN5bmNSV1RyYW5zYWN0aW9uIGltcGxlbWVudHMgU3luY0tleVZhbHVlUldUcmFuc2FjdGlvbiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgc3RvcmU6IFNpbXBsZVN5bmNTdG9yZSkgeyB9XG4gIC8qKlxuICAgKiBTdG9yZXMgZGF0YSBpbiB0aGUga2V5cyB3ZSBtb2RpZnkgcHJpb3IgdG8gbW9kaWZ5aW5nIHRoZW0uXG4gICAqIEFsbG93cyB1cyB0byByb2xsIGJhY2sgY29tbWl0cy5cbiAgICovXG4gIHByaXZhdGUgb3JpZ2luYWxEYXRhOiB7IFtrZXk6IHN0cmluZ106IE5vZGVCdWZmZXIgfSA9IHt9O1xuICAvKipcbiAgICogTGlzdCBvZiBrZXlzIG1vZGlmaWVkIGluIHRoaXMgdHJhbnNhY3Rpb24sIGlmIGFueS5cbiAgICovXG4gIHByaXZhdGUgbW9kaWZpZWRLZXlzOiBzdHJpbmdbXSA9IFtdO1xuICAvKipcbiAgICogU3Rhc2hlcyBnaXZlbiBrZXkgdmFsdWUgcGFpciBpbnRvIGBvcmlnaW5hbERhdGFgIGlmIGl0IGRvZXNuJ3QgYWxyZWFkeVxuICAgKiBleGlzdC4gQWxsb3dzIHVzIHRvIHN0YXNoIHZhbHVlcyB0aGUgcHJvZ3JhbSBpcyByZXF1ZXN0aW5nIGFueXdheSB0b1xuICAgKiBwcmV2ZW50IG5lZWRsZXNzIGBnZXRgIHJlcXVlc3RzIGlmIHRoZSBwcm9ncmFtIG1vZGlmaWVzIHRoZSBkYXRhIGxhdGVyXG4gICAqIG9uIGR1cmluZyB0aGUgdHJhbnNhY3Rpb24uXG4gICAqL1xuICBwcml2YXRlIHN0YXNoT2xkVmFsdWUoa2V5OiBzdHJpbmcsIHZhbHVlOiBOb2RlQnVmZmVyKSB7XG4gICAgLy8gS2VlcCBvbmx5IHRoZSBlYXJsaWVzdCB2YWx1ZSBpbiB0aGUgdHJhbnNhY3Rpb24uXG4gICAgaWYgKCF0aGlzLm9yaWdpbmFsRGF0YS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICB0aGlzLm9yaWdpbmFsRGF0YVtrZXldID0gdmFsdWVcbiAgICB9XG4gIH1cbiAgLyoqXG4gICAqIE1hcmtzIHRoZSBnaXZlbiBrZXkgYXMgbW9kaWZpZWQsIGFuZCBzdGFzaGVzIGl0cyB2YWx1ZSBpZiBpdCBoYXMgbm90IGJlZW5cbiAgICogc3Rhc2hlZCBhbHJlYWR5LlxuICAgKi9cbiAgcHJpdmF0ZSBtYXJrTW9kaWZpZWQoa2V5OiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5tb2RpZmllZEtleXMuaW5kZXhPZihrZXkpID09PSAtMSkge1xuICAgICAgdGhpcy5tb2RpZmllZEtleXMucHVzaChrZXkpO1xuICAgICAgaWYgKCF0aGlzLm9yaWdpbmFsRGF0YS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgIHRoaXMub3JpZ2luYWxEYXRhW2tleV0gPSB0aGlzLnN0b3JlLmdldChrZXkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBnZXQoa2V5OiBzdHJpbmcpOiBOb2RlQnVmZmVyIHtcbiAgICB2YXIgdmFsID0gdGhpcy5zdG9yZS5nZXQoa2V5KTtcbiAgICB0aGlzLnN0YXNoT2xkVmFsdWUoa2V5LCB2YWwpO1xuICAgIHJldHVybiB2YWw7XG4gIH1cblxuICBwdWJsaWMgcHV0KGtleTogc3RyaW5nLCBkYXRhOiBOb2RlQnVmZmVyLCBvdmVyd3JpdGU6IGJvb2xlYW4pOiBib29sZWFuIHtcbiAgICB0aGlzLm1hcmtNb2RpZmllZChrZXkpO1xuICAgIHJldHVybiB0aGlzLnN0b3JlLnB1dChrZXksIGRhdGEsIG92ZXJ3cml0ZSk7XG4gIH1cblxuICBwdWJsaWMgZGVsKGtleTogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5tYXJrTW9kaWZpZWQoa2V5KTtcbiAgICB0aGlzLnN0b3JlLmRlbChrZXkpO1xuICB9XG5cbiAgcHVibGljIGNvbW1pdCgpOiB2b2lkIHsvKiBOT1AgKi99XG4gIHB1YmxpYyBhYm9ydCgpOiB2b2lkIHtcbiAgICAvLyBSb2xsYmFjayBvbGQgdmFsdWVzLlxuICAgIHZhciBpOiBudW1iZXIsIGtleTogc3RyaW5nLCB2YWx1ZTogTm9kZUJ1ZmZlcjtcbiAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5tb2RpZmllZEtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGtleSA9IHRoaXMubW9kaWZpZWRLZXlzW2ldO1xuICAgICAgdmFsdWUgPSB0aGlzLm9yaWdpbmFsRGF0YVtrZXldO1xuICAgICAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgIC8vIEtleSBkaWRuJ3QgZXhpc3QuXG4gICAgICAgIHRoaXMuc3RvcmUuZGVsKGtleSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBLZXkgZXhpc3RlZC4gU3RvcmUgb2xkIHZhbHVlLlxuICAgICAgICB0aGlzLnN0b3JlLnB1dChrZXksIHZhbHVlLCB0cnVlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBTeW5jS2V5VmFsdWVGaWxlU3lzdGVtT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBUaGUgYWN0dWFsIGtleS12YWx1ZSBzdG9yZSB0byByZWFkIGZyb20vd3JpdGUgdG8uXG4gICAqL1xuICBzdG9yZTogU3luY0tleVZhbHVlU3RvcmU7XG4gIC8qKlxuICAgKiBTaG91bGQgdGhlIGZpbGUgc3lzdGVtIHN1cHBvcnQgcHJvcGVydGllcyAobXRpbWUvYXRpbWUvY3RpbWUvY2htb2QvZXRjKT9cbiAgICogRW5hYmxpbmcgdGhpcyBzbGlnaHRseSBpbmNyZWFzZXMgdGhlIHN0b3JhZ2Ugc3BhY2UgcGVyIGZpbGUsIGFuZCBhZGRzXG4gICAqIGF0aW1lIHVwZGF0ZXMgZXZlcnkgdGltZSBhIGZpbGUgaXMgYWNjZXNzZWQsIG10aW1lIHVwZGF0ZXMgZXZlcnkgdGltZVxuICAgKiBhIGZpbGUgaXMgbW9kaWZpZWQsIGFuZCBwZXJtaXNzaW9uIGNoZWNrcyBvbiBldmVyeSBvcGVyYXRpb24uXG4gICAqXG4gICAqIERlZmF1bHRzIHRvICpmYWxzZSouXG4gICAqL1xuICAvL3N1cHBvcnRQcm9wcz86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBTaG91bGQgdGhlIGZpbGUgc3lzdGVtIHN1cHBvcnQgbGlua3M/XG4gICAqL1xuICAvL3N1cHBvcnRMaW5rcz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBTeW5jS2V5VmFsdWVGaWxlIGV4dGVuZHMgcHJlbG9hZF9maWxlLlByZWxvYWRGaWxlPFN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0+IGltcGxlbWVudHMgZmlsZS5GaWxlIHtcbiAgY29uc3RydWN0b3IoX2ZzOiBTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLCBfcGF0aDogc3RyaW5nLCBfZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnLCBfc3RhdDogbm9kZV9mc19zdGF0cy5TdGF0cywgY29udGVudHM/OiBOb2RlQnVmZmVyKSB7XG4gICAgc3VwZXIoX2ZzLCBfcGF0aCwgX2ZsYWcsIF9zdGF0LCBjb250ZW50cyk7XG4gIH1cblxuICBwdWJsaWMgc3luY1N5bmMoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaXNEaXJ0eSgpKSB7XG4gICAgICB0aGlzLl9mcy5fc3luY1N5bmModGhpcy5nZXRQYXRoKCksIHRoaXMuZ2V0QnVmZmVyKCksIHRoaXMuZ2V0U3RhdHMoKSk7XG4gICAgICB0aGlzLnJlc2V0RGlydHkoKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgY2xvc2VTeW5jKCk6IHZvaWQge1xuICAgIHRoaXMuc3luY1N5bmMoKTtcbiAgfVxufVxuXG4vKipcbiAqIEEgXCJTeW5jaHJvbm91cyBrZXktdmFsdWUgZmlsZSBzeXN0ZW1cIi4gU3RvcmVzIGRhdGEgdG8vcmV0cmlldmVzIGRhdGEgZnJvbSBhblxuICogdW5kZXJseWluZyBrZXktdmFsdWUgc3RvcmUuXG4gKlxuICogV2UgdXNlIGEgdW5pcXVlIElEIGZvciBlYWNoIG5vZGUgaW4gdGhlIGZpbGUgc3lzdGVtLiBUaGUgcm9vdCBub2RlIGhhcyBhXG4gKiBmaXhlZCBJRC5cbiAqIEB0b2RvIEludHJvZHVjZSBOb2RlIElEIGNhY2hpbmcuXG4gKiBAdG9kbyBDaGVjayBtb2Rlcy5cbiAqL1xuZXhwb3J0IGNsYXNzIFN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0gZXh0ZW5kcyBmaWxlX3N5c3RlbS5TeW5jaHJvbm91c0ZpbGVTeXN0ZW0ge1xuICBwcml2YXRlIHN0b3JlOiBTeW5jS2V5VmFsdWVTdG9yZTtcbiAgY29uc3RydWN0b3Iob3B0aW9uczogU3luY0tleVZhbHVlRmlsZVN5c3RlbU9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuc3RvcmUgPSBvcHRpb25zLnN0b3JlO1xuICAgIC8vIElOVkFSSUFOVDogRW5zdXJlIHRoYXQgdGhlIHJvb3QgZXhpc3RzLlxuICAgIHRoaXMubWFrZVJvb3REaXJlY3RvcnkoKTtcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgaXNBdmFpbGFibGUoKTogYm9vbGVhbiB7IHJldHVybiB0cnVlOyB9XG4gIHB1YmxpYyBnZXROYW1lKCk6IHN0cmluZyB7IHJldHVybiB0aGlzLnN0b3JlLm5hbWUoKTsgfVxuICBwdWJsaWMgaXNSZWFkT25seSgpOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlOyB9XG4gIHB1YmxpYyBzdXBwb3J0c1N5bWxpbmtzKCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cbiAgcHVibGljIHN1cHBvcnRzUHJvcHMoKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuICBwdWJsaWMgc3VwcG9ydHNTeW5jaCgpOiBib29sZWFuIHsgcmV0dXJuIHRydWU7IH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIHRoZSByb290IGRpcmVjdG9yeSBleGlzdHMuIENyZWF0ZXMgaXQgaWYgaXQgZG9lc24ndC5cbiAgICovXG4gIHByaXZhdGUgbWFrZVJvb3REaXJlY3RvcnkoKSB7XG4gICAgdmFyIHR4ID0gdGhpcy5zdG9yZS5iZWdpblRyYW5zYWN0aW9uKCdyZWFkd3JpdGUnKTtcbiAgICBpZiAodHguZ2V0KFJPT1RfTk9ERV9JRCkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gQ3JlYXRlIG5ldyBpbm9kZS5cbiAgICAgIHZhciBjdXJyVGltZSA9IChuZXcgRGF0ZSgpKS5nZXRUaW1lKCksXG4gICAgICAgIC8vIE1vZGUgMDY2NlxuICAgICAgICBkaXJJbm9kZSA9IG5ldyBJbm9kZShHZW5lcmF0ZVJhbmRvbUlEKCksIDQwOTYsIDUxMSB8IG5vZGVfZnNfc3RhdHMuRmlsZVR5cGUuRElSRUNUT1JZLCBjdXJyVGltZSwgY3VyclRpbWUsIGN1cnJUaW1lKTtcbiAgICAgIC8vIElmIHRoZSByb290IGRvZXNuJ3QgZXhpc3QsIHRoZSBmaXJzdCByYW5kb20gSUQgc2hvdWxkbid0IGV4aXN0LFxuICAgICAgLy8gZWl0aGVyLlxuICAgICAgdHgucHV0KGRpcklub2RlLmlkLCBuZXcgQnVmZmVyKFwie31cIiksIGZhbHNlKTtcbiAgICAgIHR4LnB1dChST09UX05PREVfSUQsIGRpcklub2RlLnRvQnVmZmVyKCksIGZhbHNlKTtcbiAgICAgIHR4LmNvbW1pdCgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBIZWxwZXIgZnVuY3Rpb24gZm9yIGZpbmRJTm9kZS5cbiAgICogQHBhcmFtIHBhcmVudCBUaGUgcGFyZW50IGRpcmVjdG9yeSBvZiB0aGUgZmlsZSB3ZSBhcmUgYXR0ZW1wdGluZyB0byBmaW5kLlxuICAgKiBAcGFyYW0gZmlsZW5hbWUgVGhlIGZpbGVuYW1lIG9mIHRoZSBpbm9kZSB3ZSBhcmUgYXR0ZW1wdGluZyB0byBmaW5kLCBtaW51c1xuICAgKiAgIHRoZSBwYXJlbnQuXG4gICAqIEByZXR1cm4gc3RyaW5nIFRoZSBJRCBvZiB0aGUgZmlsZSdzIGlub2RlIGluIHRoZSBmaWxlIHN5c3RlbS5cbiAgICovXG4gIHByaXZhdGUgX2ZpbmRJTm9kZSh0eDogU3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbiwgcGFyZW50OiBzdHJpbmcsIGZpbGVuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHZhciByZWFkX2RpcmVjdG9yeSA9IChpbm9kZTogSW5vZGUpOiBzdHJpbmcgPT4ge1xuICAgICAgLy8gR2V0IHRoZSByb290J3MgZGlyZWN0b3J5IGxpc3RpbmcuXG4gICAgICB2YXIgZGlyTGlzdCA9IHRoaXMuZ2V0RGlyTGlzdGluZyh0eCwgcGFyZW50LCBpbm9kZSk7XG4gICAgICAvLyBHZXQgdGhlIGZpbGUncyBJRC5cbiAgICAgIGlmIChkaXJMaXN0W2ZpbGVuYW1lXSkge1xuICAgICAgICByZXR1cm4gZGlyTGlzdFtmaWxlbmFtZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBBcGlFcnJvci5FTk9FTlQocGF0aC5yZXNvbHZlKHBhcmVudCwgZmlsZW5hbWUpKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGlmIChwYXJlbnQgPT09ICcvJykge1xuICAgICAgaWYgKGZpbGVuYW1lID09PSAnJykge1xuICAgICAgICAvLyBCQVNFIENBU0UgIzE6IFJldHVybiB0aGUgcm9vdCdzIElELlxuICAgICAgICByZXR1cm4gUk9PVF9OT0RFX0lEO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQkFTRSBDQVNFICMyOiBGaW5kIHRoZSBpdGVtIGluIHRoZSByb290IG5kb2UuXG4gICAgICAgIHJldHVybiByZWFkX2RpcmVjdG9yeSh0aGlzLmdldElOb2RlKHR4LCBwYXJlbnQsIFJPT1RfTk9ERV9JRCkpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmVhZF9kaXJlY3RvcnkodGhpcy5nZXRJTm9kZSh0eCwgcGFyZW50ICsgcGF0aC5zZXAgKyBmaWxlbmFtZSxcbiAgICAgICAgdGhpcy5fZmluZElOb2RlKHR4LCBwYXRoLmRpcm5hbWUocGFyZW50KSwgcGF0aC5iYXNlbmFtZShwYXJlbnQpKSkpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kcyB0aGUgSW5vZGUgb2YgdGhlIGdpdmVuIHBhdGguXG4gICAqIEBwYXJhbSBwIFRoZSBwYXRoIHRvIGxvb2sgdXAuXG4gICAqIEByZXR1cm4gVGhlIElub2RlIG9mIHRoZSBwYXRoIHAuXG4gICAqIEB0b2RvIG1lbW9pemUvY2FjaGVcbiAgICovXG4gIHByaXZhdGUgZmluZElOb2RlKHR4OiBTeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uLCBwOiBzdHJpbmcpOiBJbm9kZSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0SU5vZGUodHgsIHAsIHRoaXMuX2ZpbmRJTm9kZSh0eCwgcGF0aC5kaXJuYW1lKHApLCBwYXRoLmJhc2VuYW1lKHApKSk7XG4gIH1cblxuICAvKipcbiAgICogR2l2ZW4gdGhlIElEIG9mIGEgbm9kZSwgcmV0cmlldmVzIHRoZSBjb3JyZXNwb25kaW5nIElub2RlLlxuICAgKiBAcGFyYW0gdHggVGhlIHRyYW5zYWN0aW9uIHRvIHVzZS5cbiAgICogQHBhcmFtIHAgVGhlIGNvcnJlc3BvbmRpbmcgcGF0aCB0byB0aGUgZmlsZSAodXNlZCBmb3IgZXJyb3IgbWVzc2FnZXMpLlxuICAgKiBAcGFyYW0gaWQgVGhlIElEIHRvIGxvb2sgdXAuXG4gICAqL1xuICBwcml2YXRlIGdldElOb2RlKHR4OiBTeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uLCBwOiBzdHJpbmcsIGlkOiBzdHJpbmcpOiBJbm9kZSB7XG4gICAgdmFyIGlub2RlID0gdHguZ2V0KGlkKTtcbiAgICBpZiAoaW5vZGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRU5PRU5UKHApO1xuICAgIH1cbiAgICByZXR1cm4gSW5vZGUuZnJvbUJ1ZmZlcihpbm9kZSk7XG4gIH1cblxuICAvKipcbiAgICogR2l2ZW4gdGhlIElub2RlIG9mIGEgZGlyZWN0b3J5LCByZXRyaWV2ZXMgdGhlIGNvcnJlc3BvbmRpbmcgZGlyZWN0b3J5XG4gICAqIGxpc3RpbmcuXG4gICAqL1xuICBwcml2YXRlIGdldERpckxpc3RpbmcodHg6IFN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb24sIHA6IHN0cmluZywgaW5vZGU6IElub2RlKTogeyBbZmlsZU5hbWU6IHN0cmluZ106IHN0cmluZyB9IHtcbiAgICBpZiAoIWlub2RlLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVOT1RESVIocCk7XG4gICAgfVxuICAgIHZhciBkYXRhID0gdHguZ2V0KGlub2RlLmlkKTtcbiAgICBpZiAoZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBBcGlFcnJvci5FTk9FTlQocCk7XG4gICAgfVxuICAgIHJldHVybiBKU09OLnBhcnNlKGRhdGEudG9TdHJpbmcoKSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBub2RlIHVuZGVyIGEgcmFuZG9tIElELiBSZXRyaWVzIDUgdGltZXMgYmVmb3JlIGdpdmluZyB1cCBpblxuICAgKiB0aGUgZXhjZWVkaW5nbHkgdW5saWtlbHkgY2hhbmNlIHRoYXQgd2UgdHJ5IHRvIHJldXNlIGEgcmFuZG9tIEdVSUQuXG4gICAqIEByZXR1cm4gVGhlIEdVSUQgdGhhdCB0aGUgZGF0YSB3YXMgc3RvcmVkIHVuZGVyLlxuICAgKi9cbiAgcHJpdmF0ZSBhZGROZXdOb2RlKHR4OiBTeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uLCBkYXRhOiBOb2RlQnVmZmVyKTogc3RyaW5nIHtcbiAgICB2YXIgcmV0cmllcyA9IDAsIGN1cnJJZDogc3RyaW5nO1xuICAgIHdoaWxlIChyZXRyaWVzIDwgNSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY3VycklkID0gR2VuZXJhdGVSYW5kb21JRCgpO1xuICAgICAgICB0eC5wdXQoY3VycklkLCBkYXRhLCBmYWxzZSk7XG4gICAgICAgIHJldHVybiBjdXJySWQ7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIElnbm9yZSBhbmQgcmVyb2xsLlxuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTywgJ1VuYWJsZSB0byBjb21taXQgZGF0YSB0byBrZXktdmFsdWUgc3RvcmUuJyk7XG4gIH1cblxuICAvKipcbiAgICogQ29tbWl0cyBhIG5ldyBmaWxlICh3ZWxsLCBhIEZJTEUgb3IgYSBESVJFQ1RPUlkpIHRvIHRoZSBmaWxlIHN5c3RlbSB3aXRoXG4gICAqIHRoZSBnaXZlbiBtb2RlLlxuICAgKiBOb3RlOiBUaGlzIHdpbGwgY29tbWl0IHRoZSB0cmFuc2FjdGlvbi5cbiAgICogQHBhcmFtIHAgVGhlIHBhdGggdG8gdGhlIG5ldyBmaWxlLlxuICAgKiBAcGFyYW0gdHlwZSBUaGUgdHlwZSBvZiB0aGUgbmV3IGZpbGUuXG4gICAqIEBwYXJhbSBtb2RlIFRoZSBtb2RlIHRvIGNyZWF0ZSB0aGUgbmV3IGZpbGUgd2l0aC5cbiAgICogQHBhcmFtIGRhdGEgVGhlIGRhdGEgdG8gc3RvcmUgYXQgdGhlIGZpbGUncyBkYXRhIG5vZGUuXG4gICAqIEByZXR1cm4gVGhlIElub2RlIGZvciB0aGUgbmV3IGZpbGUuXG4gICAqL1xuICBwcml2YXRlIGNvbW1pdE5ld0ZpbGUodHg6IFN5bmNLZXlWYWx1ZVJXVHJhbnNhY3Rpb24sIHA6IHN0cmluZywgdHlwZTogbm9kZV9mc19zdGF0cy5GaWxlVHlwZSwgbW9kZTogbnVtYmVyLCBkYXRhOiBOb2RlQnVmZmVyKTogSW5vZGUge1xuICAgIHZhciBwYXJlbnREaXIgPSBwYXRoLmRpcm5hbWUocCksXG4gICAgICBmbmFtZSA9IHBhdGguYmFzZW5hbWUocCksXG4gICAgICBwYXJlbnROb2RlID0gdGhpcy5maW5kSU5vZGUodHgsIHBhcmVudERpciksXG4gICAgICBkaXJMaXN0aW5nID0gdGhpcy5nZXREaXJMaXN0aW5nKHR4LCBwYXJlbnREaXIsIHBhcmVudE5vZGUpLFxuICAgICAgY3VyclRpbWUgPSAobmV3IERhdGUoKSkuZ2V0VGltZSgpO1xuXG4gICAgLy8gSW52YXJpYW50OiBUaGUgcm9vdCBhbHdheXMgZXhpc3RzLlxuICAgIC8vIElmIHdlIGRvbid0IGNoZWNrIHRoaXMgcHJpb3IgdG8gdGFraW5nIHN0ZXBzIGJlbG93LCB3ZSB3aWxsIGNyZWF0ZSBhXG4gICAgLy8gZmlsZSB3aXRoIG5hbWUgJycgaW4gcm9vdCBzaG91bGQgcCA9PSAnLycuXG4gICAgaWYgKHAgPT09ICcvJykge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRUVYSVNUKHApO1xuICAgIH1cblxuICAgIC8vIENoZWNrIGlmIGZpbGUgYWxyZWFkeSBleGlzdHMuXG4gICAgaWYgKGRpckxpc3RpbmdbZm5hbWVdKSB7XG4gICAgICB0aHJvdyBBcGlFcnJvci5FRVhJU1QocCk7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIC8vIENvbW1pdCBkYXRhLlxuICAgICAgdmFyIGRhdGFJZCA9IHRoaXMuYWRkTmV3Tm9kZSh0eCwgZGF0YSksXG4gICAgICAgIGZpbGVOb2RlID0gbmV3IElub2RlKGRhdGFJZCwgZGF0YS5sZW5ndGgsIG1vZGUgfCB0eXBlLCBjdXJyVGltZSwgY3VyclRpbWUsIGN1cnJUaW1lKSxcbiAgICAgICAgLy8gQ29tbWl0IGZpbGUgbm9kZS5cbiAgICAgICAgZmlsZU5vZGVJZCA9IHRoaXMuYWRkTmV3Tm9kZSh0eCwgZmlsZU5vZGUudG9CdWZmZXIoKSk7XG4gICAgICAvLyBVcGRhdGUgYW5kIGNvbW1pdCBwYXJlbnQgZGlyZWN0b3J5IGxpc3RpbmcuXG4gICAgICBkaXJMaXN0aW5nW2ZuYW1lXSA9IGZpbGVOb2RlSWQ7XG4gICAgICB0eC5wdXQocGFyZW50Tm9kZS5pZCwgbmV3IEJ1ZmZlcihKU09OLnN0cmluZ2lmeShkaXJMaXN0aW5nKSksIHRydWUpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHR4LmFib3J0KCk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgICB0eC5jb21taXQoKTtcbiAgICByZXR1cm4gZmlsZU5vZGU7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIGFsbCBjb250ZW50cyBzdG9yZWQgaW4gdGhlIGZpbGUgc3lzdGVtLlxuICAgKi9cbiAgcHVibGljIGVtcHR5KCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuY2xlYXIoKTtcbiAgICAvLyBJTlZBUklBTlQ6IFJvb3QgYWx3YXlzIGV4aXN0cy5cbiAgICB0aGlzLm1ha2VSb290RGlyZWN0b3J5KCk7XG4gIH1cblxuICBwdWJsaWMgcmVuYW1lU3luYyhvbGRQYXRoOiBzdHJpbmcsIG5ld1BhdGg6IHN0cmluZyk6IHZvaWQge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZHdyaXRlJyksXG4gICAgICBvbGRQYXJlbnQgPSBwYXRoLmRpcm5hbWUob2xkUGF0aCksIG9sZE5hbWUgPSBwYXRoLmJhc2VuYW1lKG9sZFBhdGgpLFxuICAgICAgbmV3UGFyZW50ID0gcGF0aC5kaXJuYW1lKG5ld1BhdGgpLCBuZXdOYW1lID0gcGF0aC5iYXNlbmFtZShuZXdQYXRoKSxcbiAgICAgIC8vIFJlbW92ZSBvbGRQYXRoIGZyb20gcGFyZW50J3MgZGlyZWN0b3J5IGxpc3RpbmcuXG4gICAgICBvbGREaXJOb2RlID0gdGhpcy5maW5kSU5vZGUodHgsIG9sZFBhcmVudCksXG4gICAgICBvbGREaXJMaXN0ID0gdGhpcy5nZXREaXJMaXN0aW5nKHR4LCBvbGRQYXJlbnQsIG9sZERpck5vZGUpO1xuICAgIGlmICghb2xkRGlyTGlzdFtvbGROYW1lXSkge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRU5PRU5UKG9sZFBhdGgpO1xuICAgIH1cbiAgICB2YXIgbm9kZUlkOiBzdHJpbmcgPSBvbGREaXJMaXN0W29sZE5hbWVdO1xuICAgIGRlbGV0ZSBvbGREaXJMaXN0W29sZE5hbWVdO1xuXG4gICAgLy8gSW52YXJpYW50OiBDYW4ndCBtb3ZlIGEgZm9sZGVyIGluc2lkZSBpdHNlbGYuXG4gICAgLy8gVGhpcyBmdW5ueSBsaXR0bGUgaGFjayBlbnN1cmVzIHRoYXQgdGhlIGNoZWNrIHBhc3NlcyBvbmx5IGlmIG9sZFBhdGhcbiAgICAvLyBpcyBhIHN1YnBhdGggb2YgbmV3UGFyZW50LiBXZSBhcHBlbmQgJy8nIHRvIGF2b2lkIG1hdGNoaW5nIGZvbGRlcnMgdGhhdFxuICAgIC8vIGFyZSBhIHN1YnN0cmluZyBvZiB0aGUgYm90dG9tLW1vc3QgZm9sZGVyIGluIHRoZSBwYXRoLlxuICAgIGlmICgobmV3UGFyZW50ICsgJy8nKS5pbmRleE9mKG9sZFBhdGggKyAnLycpID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVCVVNZLCBvbGRQYXJlbnQpO1xuICAgIH1cblxuICAgIC8vIEFkZCBuZXdQYXRoIHRvIHBhcmVudCdzIGRpcmVjdG9yeSBsaXN0aW5nLlxuICAgIHZhciBuZXdEaXJOb2RlOiBJbm9kZSwgbmV3RGlyTGlzdDogdHlwZW9mIG9sZERpckxpc3Q7XG4gICAgaWYgKG5ld1BhcmVudCA9PT0gb2xkUGFyZW50KSB7XG4gICAgICAvLyBQcmV2ZW50IHVzIGZyb20gcmUtZ3JhYmJpbmcgdGhlIHNhbWUgZGlyZWN0b3J5IGxpc3RpbmcsIHdoaWNoIHN0aWxsXG4gICAgICAvLyBjb250YWlucyBvbGROYW1lLlxuICAgICAgbmV3RGlyTm9kZSA9IG9sZERpck5vZGU7XG4gICAgICBuZXdEaXJMaXN0ID0gb2xkRGlyTGlzdDtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV3RGlyTm9kZSA9IHRoaXMuZmluZElOb2RlKHR4LCBuZXdQYXJlbnQpO1xuICAgICAgbmV3RGlyTGlzdCA9IHRoaXMuZ2V0RGlyTGlzdGluZyh0eCwgbmV3UGFyZW50LCBuZXdEaXJOb2RlKTtcbiAgICB9XG5cbiAgICBpZiAobmV3RGlyTGlzdFtuZXdOYW1lXSkge1xuICAgICAgLy8gSWYgaXQncyBhIGZpbGUsIGRlbGV0ZSBpdC5cbiAgICAgIHZhciBuZXdOYW1lTm9kZSA9IHRoaXMuZ2V0SU5vZGUodHgsIG5ld1BhdGgsIG5ld0Rpckxpc3RbbmV3TmFtZV0pO1xuICAgICAgaWYgKG5ld05hbWVOb2RlLmlzRmlsZSgpKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdHguZGVsKG5ld05hbWVOb2RlLmlkKTtcbiAgICAgICAgICB0eC5kZWwobmV3RGlyTGlzdFtuZXdOYW1lXSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICB0eC5hYm9ydCgpO1xuICAgICAgICAgIHRocm93IGU7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIElmIGl0J3MgYSBkaXJlY3RvcnksIHRocm93IGEgcGVybWlzc2lvbnMgZXJyb3IuXG4gICAgICAgIHRocm93IEFwaUVycm9yLkVQRVJNKG5ld1BhdGgpO1xuICAgICAgfVxuICAgIH1cbiAgICBuZXdEaXJMaXN0W25ld05hbWVdID0gbm9kZUlkO1xuXG4gICAgLy8gQ29tbWl0IHRoZSB0d28gY2hhbmdlZCBkaXJlY3RvcnkgbGlzdGluZ3MuXG4gICAgdHJ5IHtcbiAgICAgIHR4LnB1dChvbGREaXJOb2RlLmlkLCBuZXcgQnVmZmVyKEpTT04uc3RyaW5naWZ5KG9sZERpckxpc3QpKSwgdHJ1ZSk7XG4gICAgICB0eC5wdXQobmV3RGlyTm9kZS5pZCwgbmV3IEJ1ZmZlcihKU09OLnN0cmluZ2lmeShuZXdEaXJMaXN0KSksIHRydWUpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHR4LmFib3J0KCk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIHR4LmNvbW1pdCgpO1xuICB9XG5cbiAgcHVibGljIHN0YXRTeW5jKHA6IHN0cmluZywgaXNMc3RhdDogYm9vbGVhbik6IG5vZGVfZnNfc3RhdHMuU3RhdHMge1xuICAgIC8vIEdldCB0aGUgaW5vZGUgdG8gdGhlIGl0ZW0sIGNvbnZlcnQgaXQgaW50byBhIFN0YXRzIG9iamVjdC5cbiAgICByZXR1cm4gdGhpcy5maW5kSU5vZGUodGhpcy5zdG9yZS5iZWdpblRyYW5zYWN0aW9uKCdyZWFkb25seScpLCBwKS50b1N0YXRzKCk7XG4gIH1cblxuICBwdWJsaWMgY3JlYXRlRmlsZVN5bmMocDogc3RyaW5nLCBmbGFnOiBmaWxlX2ZsYWcuRmlsZUZsYWcsIG1vZGU6IG51bWJlcik6IGZpbGUuRmlsZSB7XG4gICAgdmFyIHR4ID0gdGhpcy5zdG9yZS5iZWdpblRyYW5zYWN0aW9uKCdyZWFkd3JpdGUnKSxcbiAgICAgIGRhdGEgPSBuZXcgQnVmZmVyKDApLFxuICAgICAgbmV3RmlsZSA9IHRoaXMuY29tbWl0TmV3RmlsZSh0eCwgcCwgbm9kZV9mc19zdGF0cy5GaWxlVHlwZS5GSUxFLCBtb2RlLCBkYXRhKTtcbiAgICAvLyBPcGVuIHRoZSBmaWxlLlxuICAgIHJldHVybiBuZXcgU3luY0tleVZhbHVlRmlsZSh0aGlzLCBwLCBmbGFnLCBuZXdGaWxlLnRvU3RhdHMoKSwgZGF0YSk7XG4gIH1cblxuICBwdWJsaWMgb3BlbkZpbGVTeW5jKHA6IHN0cmluZywgZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnKTogZmlsZS5GaWxlIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWRvbmx5JyksXG4gICAgICBub2RlID0gdGhpcy5maW5kSU5vZGUodHgsIHApLFxuICAgICAgZGF0YSA9IHR4LmdldChub2RlLmlkKTtcbiAgICBpZiAoZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBBcGlFcnJvci5FTk9FTlQocCk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgU3luY0tleVZhbHVlRmlsZSh0aGlzLCBwLCBmbGFnLCBub2RlLnRvU3RhdHMoKSwgZGF0YSk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCB0cmFjZXMgb2YgdGhlIGdpdmVuIHBhdGggZnJvbSB0aGUgZmlsZSBzeXN0ZW0uXG4gICAqIEBwYXJhbSBwIFRoZSBwYXRoIHRvIHJlbW92ZSBmcm9tIHRoZSBmaWxlIHN5c3RlbS5cbiAgICogQHBhcmFtIGlzRGlyIERvZXMgdGhlIHBhdGggYmVsb25nIHRvIGEgZGlyZWN0b3J5LCBvciBhIGZpbGU/XG4gICAqIEB0b2RvIFVwZGF0ZSBtdGltZS5cbiAgICovXG4gIHByaXZhdGUgcmVtb3ZlRW50cnkocDogc3RyaW5nLCBpc0RpcjogYm9vbGVhbik6IHZvaWQge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZHdyaXRlJyksXG4gICAgICBwYXJlbnQ6IHN0cmluZyA9IHBhdGguZGlybmFtZShwKSxcbiAgICAgIHBhcmVudE5vZGUgPSB0aGlzLmZpbmRJTm9kZSh0eCwgcGFyZW50KSxcbiAgICAgIHBhcmVudExpc3RpbmcgPSB0aGlzLmdldERpckxpc3RpbmcodHgsIHBhcmVudCwgcGFyZW50Tm9kZSksXG4gICAgICBmaWxlTmFtZTogc3RyaW5nID0gcGF0aC5iYXNlbmFtZShwKTtcblxuICAgIGlmICghcGFyZW50TGlzdGluZ1tmaWxlTmFtZV0pIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVOT0VOVChwKTtcbiAgICB9XG5cbiAgICAvLyBSZW1vdmUgZnJvbSBkaXJlY3RvcnkgbGlzdGluZyBvZiBwYXJlbnQuXG4gICAgdmFyIGZpbGVOb2RlSWQgPSBwYXJlbnRMaXN0aW5nW2ZpbGVOYW1lXTtcbiAgICBkZWxldGUgcGFyZW50TGlzdGluZ1tmaWxlTmFtZV07XG5cbiAgICAvLyBHZXQgZmlsZSBpbm9kZS5cbiAgICB2YXIgZmlsZU5vZGUgPSB0aGlzLmdldElOb2RlKHR4LCBwLCBmaWxlTm9kZUlkKTtcbiAgICBpZiAoIWlzRGlyICYmIGZpbGVOb2RlLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVJU0RJUihwKTtcbiAgICB9IGVsc2UgaWYgKGlzRGlyICYmICFmaWxlTm9kZS5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICB0aHJvdyBBcGlFcnJvci5FTk9URElSKHApO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAvLyBEZWxldGUgZGF0YS5cbiAgICAgIHR4LmRlbChmaWxlTm9kZS5pZCk7XG4gICAgICAvLyBEZWxldGUgbm9kZS5cbiAgICAgIHR4LmRlbChmaWxlTm9kZUlkKTtcbiAgICAgIC8vIFVwZGF0ZSBkaXJlY3RvcnkgbGlzdGluZy5cbiAgICAgIHR4LnB1dChwYXJlbnROb2RlLmlkLCBuZXcgQnVmZmVyKEpTT04uc3RyaW5naWZ5KHBhcmVudExpc3RpbmcpKSwgdHJ1ZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdHguYWJvcnQoKTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICAgIC8vIFN1Y2Nlc3MuXG4gICAgdHguY29tbWl0KCk7XG4gIH1cblxuICBwdWJsaWMgdW5saW5rU3luYyhwOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLnJlbW92ZUVudHJ5KHAsIGZhbHNlKTtcbiAgfVxuXG4gIHB1YmxpYyBybWRpclN5bmMocDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5yZW1vdmVFbnRyeShwLCB0cnVlKTtcbiAgfVxuXG4gIHB1YmxpYyBta2RpclN5bmMocDogc3RyaW5nLCBtb2RlOiBudW1iZXIpOiB2b2lkIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpLFxuICAgICAgZGF0YSA9IG5ldyBCdWZmZXIoJ3t9Jyk7XG4gICAgdGhpcy5jb21taXROZXdGaWxlKHR4LCBwLCBub2RlX2ZzX3N0YXRzLkZpbGVUeXBlLkRJUkVDVE9SWSwgbW9kZSwgZGF0YSk7XG4gIH1cblxuICBwdWJsaWMgcmVhZGRpclN5bmMocDogc3RyaW5nKTogc3RyaW5nW117XG4gICAgdmFyIHR4ID0gdGhpcy5zdG9yZS5iZWdpblRyYW5zYWN0aW9uKCdyZWFkb25seScpO1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmdldERpckxpc3RpbmcodHgsIHAsIHRoaXMuZmluZElOb2RlKHR4LCBwKSkpO1xuICB9XG5cbiAgcHVibGljIF9zeW5jU3luYyhwOiBzdHJpbmcsIGRhdGE6IE5vZGVCdWZmZXIsIHN0YXRzOiBub2RlX2ZzX3N0YXRzLlN0YXRzKTogdm9pZCB7XG4gICAgLy8gQHRvZG8gRW5zdXJlIG10aW1lIHVwZGF0ZXMgcHJvcGVybHksIGFuZCB1c2UgdGhhdCB0byBkZXRlcm1pbmUgaWYgYSBkYXRhXG4gICAgLy8gICAgICAgdXBkYXRlIGlzIHJlcXVpcmVkLlxuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZHdyaXRlJyksXG4gICAgICAvLyBXZSB1c2UgdGhlIF9maW5kSW5vZGUgaGVscGVyIGJlY2F1c2Ugd2UgYWN0dWFsbHkgbmVlZCB0aGUgSU5vZGUgaWQuXG4gICAgICBmaWxlSW5vZGVJZCA9IHRoaXMuX2ZpbmRJTm9kZSh0eCwgcGF0aC5kaXJuYW1lKHApLCBwYXRoLmJhc2VuYW1lKHApKSxcbiAgICAgIGZpbGVJbm9kZSA9IHRoaXMuZ2V0SU5vZGUodHgsIHAsIGZpbGVJbm9kZUlkKSxcbiAgICAgIGlub2RlQ2hhbmdlZCA9IGZpbGVJbm9kZS51cGRhdGUoc3RhdHMpO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFN5bmMgZGF0YS5cbiAgICAgIHR4LnB1dChmaWxlSW5vZGUuaWQsIGRhdGEsIHRydWUpO1xuICAgICAgLy8gU3luYyBtZXRhZGF0YS5cbiAgICAgIGlmIChpbm9kZUNoYW5nZWQpIHtcbiAgICAgICAgdHgucHV0KGZpbGVJbm9kZUlkLCBmaWxlSW5vZGUudG9CdWZmZXIoKSwgdHJ1ZSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdHguYWJvcnQoKTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICAgIHR4LmNvbW1pdCgpO1xuICB9XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiAqYXN5bmNocm9ub3VzKiBrZXktdmFsdWUgc3RvcmUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQXN5bmNLZXlWYWx1ZVN0b3JlIHtcbiAgLyoqXG4gICAqIFRoZSBuYW1lIG9mIHRoZSBrZXktdmFsdWUgc3RvcmUuXG4gICAqL1xuICBuYW1lKCk6IHN0cmluZztcbiAgLyoqXG4gICAqIEVtcHRpZXMgdGhlIGtleS12YWx1ZSBzdG9yZSBjb21wbGV0ZWx5LlxuICAgKi9cbiAgY2xlYXIoY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICAvKipcbiAgICogQmVnaW5zIGEgcmVhZC13cml0ZSB0cmFuc2FjdGlvbi5cbiAgICovXG4gIGJlZ2luVHJhbnNhY3Rpb24odHlwZTogJ3JlYWR3cml0ZScpOiBBc3luY0tleVZhbHVlUldUcmFuc2FjdGlvbjtcbiAgLyoqXG4gICAqIEJlZ2lucyBhIHJlYWQtb25seSB0cmFuc2FjdGlvbi5cbiAgICovXG4gIGJlZ2luVHJhbnNhY3Rpb24odHlwZTogJ3JlYWRvbmx5Jyk6IEFzeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uO1xuICBiZWdpblRyYW5zYWN0aW9uKHR5cGU6IHN0cmluZyk6IEFzeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYW4gYXN5bmNocm9ub3VzIHJlYWQtb25seSB0cmFuc2FjdGlvbi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBBc3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbiB7XG4gIC8qKlxuICAgKiBSZXRyaWV2ZXMgdGhlIGRhdGEgYXQgdGhlIGdpdmVuIGtleS5cbiAgICogQHBhcmFtIGtleSBUaGUga2V5IHRvIGxvb2sgdW5kZXIgZm9yIGRhdGEuXG4gICAqL1xuICBnZXQoa2V5OiBzdHJpbmcsIGNiOiAoZTogQXBpRXJyb3IsIGRhdGE/OiBOb2RlQnVmZmVyKSA9PiB2b2lkKTogdm9pZDtcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGFuIGFzeW5jaHJvbm91cyByZWFkLXdyaXRlIHRyYW5zYWN0aW9uLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEFzeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uIGV4dGVuZHMgQXN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb24ge1xuICAvKipcbiAgICogQWRkcyB0aGUgZGF0YSB0byB0aGUgc3RvcmUgdW5kZXIgdGhlIGdpdmVuIGtleS4gT3ZlcndyaXRlcyBhbnkgZXhpc3RpbmdcbiAgICogZGF0YS5cbiAgICogQHBhcmFtIGtleSBUaGUga2V5IHRvIGFkZCB0aGUgZGF0YSB1bmRlci5cbiAgICogQHBhcmFtIGRhdGEgVGhlIGRhdGEgdG8gYWRkIHRvIHRoZSBzdG9yZS5cbiAgICogQHBhcmFtIG92ZXJ3cml0ZSBJZiAndHJ1ZScsIG92ZXJ3cml0ZSBhbnkgZXhpc3RpbmcgZGF0YS4gSWYgJ2ZhbHNlJyxcbiAgICogICBhdm9pZHMgd3JpdGluZyB0aGUgZGF0YSBpZiB0aGUga2V5IGV4aXN0cy5cbiAgICogQHBhcmFtIGNiIFRyaWdnZXJlZCB3aXRoIGFuIGVycm9yIGFuZCB3aGV0aGVyIG9yIG5vdCB0aGUgdmFsdWUgd2FzXG4gICAqICAgY29tbWl0dGVkLlxuICAgKi9cbiAgcHV0KGtleTogc3RyaW5nLCBkYXRhOiBOb2RlQnVmZmVyLCBvdmVyd3JpdGU6IGJvb2xlYW4sIGNiOiAoZTogQXBpRXJyb3IsXG4gICAgY29tbWl0dGVkPzogYm9vbGVhbikgPT4gdm9pZCk6IHZvaWQ7XG4gIC8qKlxuICAgKiBEZWxldGVzIHRoZSBkYXRhIGF0IHRoZSBnaXZlbiBrZXkuXG4gICAqIEBwYXJhbSBrZXkgVGhlIGtleSB0byBkZWxldGUgZnJvbSB0aGUgc3RvcmUuXG4gICAqL1xuICBkZWwoa2V5OiBzdHJpbmcsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgLyoqXG4gICAqIENvbW1pdHMgdGhlIHRyYW5zYWN0aW9uLlxuICAgKi9cbiAgY29tbWl0KGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgLyoqXG4gICAqIEFib3J0cyBhbmQgcm9sbHMgYmFjayB0aGUgdHJhbnNhY3Rpb24uXG4gICAqL1xuICBhYm9ydChjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBBc3luY0tleVZhbHVlRmlsZSBleHRlbmRzIHByZWxvYWRfZmlsZS5QcmVsb2FkRmlsZTxBc3luY0tleVZhbHVlRmlsZVN5c3RlbT4gaW1wbGVtZW50cyBmaWxlLkZpbGUge1xuICBjb25zdHJ1Y3RvcihfZnM6IEFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLCBfcGF0aDogc3RyaW5nLCBfZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnLCBfc3RhdDogbm9kZV9mc19zdGF0cy5TdGF0cywgY29udGVudHM/OiBOb2RlQnVmZmVyKSB7XG4gICAgc3VwZXIoX2ZzLCBfcGF0aCwgX2ZsYWcsIF9zdGF0LCBjb250ZW50cyk7XG4gIH1cblxuICBwdWJsaWMgc3luYyhjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmlzRGlydHkoKSkge1xuICAgICAgdGhpcy5fZnMuX3N5bmModGhpcy5nZXRQYXRoKCksIHRoaXMuZ2V0QnVmZmVyKCksIHRoaXMuZ2V0U3RhdHMoKSwgKGU/OiBBcGlFcnJvcikgPT4ge1xuICAgICAgICBpZiAoIWUpIHtcbiAgICAgICAgICB0aGlzLnJlc2V0RGlydHkoKTtcbiAgICAgICAgfVxuICAgICAgICBjYihlKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYigpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBjbG9zZShjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuc3luYyhjYik7XG4gIH1cbn1cblxuLyoqXG4gKiBBbiBcIkFzeW5jaHJvbm91cyBrZXktdmFsdWUgZmlsZSBzeXN0ZW1cIi4gU3RvcmVzIGRhdGEgdG8vcmV0cmlldmVzIGRhdGEgZnJvbVxuICogYW4gdW5kZXJseWluZyBhc3luY2hyb25vdXMga2V5LXZhbHVlIHN0b3JlLlxuICovXG5leHBvcnQgY2xhc3MgQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0gZXh0ZW5kcyBmaWxlX3N5c3RlbS5CYXNlRmlsZVN5c3RlbSB7XG4gIHByaXZhdGUgc3RvcmU6IEFzeW5jS2V5VmFsdWVTdG9yZTtcblxuICAvKipcbiAgICogSW5pdGlhbGl6ZXMgdGhlIGZpbGUgc3lzdGVtLiBUeXBpY2FsbHkgY2FsbGVkIGJ5IHN1YmNsYXNzZXMnIGFzeW5jXG4gICAqIGNvbnN0cnVjdG9ycy5cbiAgICovXG4gIHB1YmxpYyBpbml0KHN0b3JlOiBBc3luY0tleVZhbHVlU3RvcmUsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKSB7XG4gICAgdGhpcy5zdG9yZSA9IHN0b3JlO1xuICAgIC8vIElOVkFSSUFOVDogRW5zdXJlIHRoYXQgdGhlIHJvb3QgZXhpc3RzLlxuICAgIHRoaXMubWFrZVJvb3REaXJlY3RvcnkoY2IpO1xuICB9XG5cbiAgcHVibGljIHN0YXRpYyBpc0F2YWlsYWJsZSgpOiBib29sZWFuIHsgcmV0dXJuIHRydWU7IH1cbiAgcHVibGljIGdldE5hbWUoKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuc3RvcmUubmFtZSgpOyB9XG4gIHB1YmxpYyBpc1JlYWRPbmx5KCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cbiAgcHVibGljIHN1cHBvcnRzU3ltbGlua3MoKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuICBwdWJsaWMgc3VwcG9ydHNQcm9wcygpOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlOyB9XG4gIHB1YmxpYyBzdXBwb3J0c1N5bmNoKCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIHRoZSByb290IGRpcmVjdG9yeSBleGlzdHMuIENyZWF0ZXMgaXQgaWYgaXQgZG9lc24ndC5cbiAgICovXG4gIHByaXZhdGUgbWFrZVJvb3REaXJlY3RvcnkoY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpO1xuICAgIHR4LmdldChST09UX05PREVfSUQsIChlOiBBcGlFcnJvciwgZGF0YT86IE5vZGVCdWZmZXIpID0+IHtcbiAgICAgIGlmIChlIHx8IGRhdGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyBDcmVhdGUgbmV3IGlub2RlLlxuICAgICAgICB2YXIgY3VyclRpbWUgPSAobmV3IERhdGUoKSkuZ2V0VGltZSgpLFxuICAgICAgICAgIC8vIE1vZGUgMDY2NlxuICAgICAgICAgIGRpcklub2RlID0gbmV3IElub2RlKEdlbmVyYXRlUmFuZG9tSUQoKSwgNDA5NiwgNTExIHwgbm9kZV9mc19zdGF0cy5GaWxlVHlwZS5ESVJFQ1RPUlksIGN1cnJUaW1lLCBjdXJyVGltZSwgY3VyclRpbWUpO1xuICAgICAgICAvLyBJZiB0aGUgcm9vdCBkb2Vzbid0IGV4aXN0LCB0aGUgZmlyc3QgcmFuZG9tIElEIHNob3VsZG4ndCBleGlzdCxcbiAgICAgICAgLy8gZWl0aGVyLlxuICAgICAgICB0eC5wdXQoZGlySW5vZGUuaWQsIG5ldyBCdWZmZXIoXCJ7fVwiKSwgZmFsc2UsIChlPzogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgIHR4LnB1dChST09UX05PREVfSUQsIGRpcklub2RlLnRvQnVmZmVyKCksIGZhbHNlLCAoZT86IEFwaUVycm9yKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChlKSB7XG4gICAgICAgICAgICAgICAgdHguYWJvcnQoKCkgPT4geyBjYihlKTsgfSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdHguY29tbWl0KGNiKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFdlJ3JlIGdvb2QuXG4gICAgICAgIHR4LmNvbW1pdChjYik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogSGVscGVyIGZ1bmN0aW9uIGZvciBmaW5kSU5vZGUuXG4gICAqIEBwYXJhbSBwYXJlbnQgVGhlIHBhcmVudCBkaXJlY3Rvcnkgb2YgdGhlIGZpbGUgd2UgYXJlIGF0dGVtcHRpbmcgdG8gZmluZC5cbiAgICogQHBhcmFtIGZpbGVuYW1lIFRoZSBmaWxlbmFtZSBvZiB0aGUgaW5vZGUgd2UgYXJlIGF0dGVtcHRpbmcgdG8gZmluZCwgbWludXNcbiAgICogICB0aGUgcGFyZW50LlxuICAgKiBAcGFyYW0gY2IgUGFzc2VkIGFuIGVycm9yIG9yIHRoZSBJRCBvZiB0aGUgZmlsZSdzIGlub2RlIGluIHRoZSBmaWxlIHN5c3RlbS5cbiAgICovXG4gIHByaXZhdGUgX2ZpbmRJTm9kZSh0eDogQXN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb24sIHBhcmVudDogc3RyaW5nLCBmaWxlbmFtZTogc3RyaW5nLCBjYjogKGU6IEFwaUVycm9yLCBpZD86IHN0cmluZykgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciBoYW5kbGVfZGlyZWN0b3J5X2xpc3RpbmdzID0gKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlLCBkaXJMaXN0Pzoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9KTogdm9pZCA9PiB7XG4gICAgICBpZiAoZSkge1xuICAgICAgICBjYihlKVxuICAgICAgfSBlbHNlIGlmIChkaXJMaXN0W2ZpbGVuYW1lXSkge1xuICAgICAgICBjYihudWxsLCBkaXJMaXN0W2ZpbGVuYW1lXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYihBcGlFcnJvci5FTk9FTlQocGF0aC5yZXNvbHZlKHBhcmVudCwgZmlsZW5hbWUpKSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGlmIChwYXJlbnQgPT09ICcvJykge1xuICAgICAgaWYgKGZpbGVuYW1lID09PSAnJykge1xuICAgICAgICAvLyBCQVNFIENBU0UgIzE6IFJldHVybiB0aGUgcm9vdCdzIElELlxuICAgICAgICBjYihudWxsLCBST09UX05PREVfSUQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQkFTRSBDQVNFICMyOiBGaW5kIHRoZSBpdGVtIGluIHRoZSByb290IG5vZGUuXG4gICAgICAgIHRoaXMuZ2V0SU5vZGUodHgsIHBhcmVudCwgUk9PVF9OT0RFX0lELCAoZTogQXBpRXJyb3IsIGlub2RlPzogSW5vZGUpOiB2b2lkID0+IHtcbiAgICAgICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgICAgIHRoaXMuZ2V0RGlyTGlzdGluZyh0eCwgcGFyZW50LCBpbm9kZSwgKGU6IEFwaUVycm9yLCBkaXJMaXN0Pzoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9KTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgIC8vIGhhbmRsZV9kaXJlY3RvcnlfbGlzdGluZ3Mgd2lsbCBoYW5kbGUgZSBmb3IgdXMuXG4gICAgICAgICAgICAgIGhhbmRsZV9kaXJlY3RvcnlfbGlzdGluZ3MoZSwgaW5vZGUsIGRpckxpc3QpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gR2V0IHRoZSBwYXJlbnQgZGlyZWN0b3J5J3MgSU5vZGUsIGFuZCBmaW5kIHRoZSBmaWxlIGluIGl0cyBkaXJlY3RvcnlcbiAgICAgIC8vIGxpc3RpbmcuXG4gICAgICB0aGlzLmZpbmRJTm9kZUFuZERpckxpc3RpbmcodHgsIHBhcmVudCwgaGFuZGxlX2RpcmVjdG9yeV9saXN0aW5ncyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZpbmRzIHRoZSBJbm9kZSBvZiB0aGUgZ2l2ZW4gcGF0aC5cbiAgICogQHBhcmFtIHAgVGhlIHBhdGggdG8gbG9vayB1cC5cbiAgICogQHBhcmFtIGNiIFBhc3NlZCBhbiBlcnJvciBvciB0aGUgSW5vZGUgb2YgdGhlIHBhdGggcC5cbiAgICogQHRvZG8gbWVtb2l6ZS9jYWNoZVxuICAgKi9cbiAgcHJpdmF0ZSBmaW5kSU5vZGUodHg6IEFzeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uLCBwOiBzdHJpbmcsIGNiOiAoZTogQXBpRXJyb3IsIGlub2RlPzogSW5vZGUpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9maW5kSU5vZGUodHgsIHBhdGguZGlybmFtZShwKSwgcGF0aC5iYXNlbmFtZShwKSwgKGU6IEFwaUVycm9yLCBpZD86IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgaWYgKG5vRXJyb3IoZSwgY2IpKSB7XG4gICAgICAgIHRoaXMuZ2V0SU5vZGUodHgsIHAsIGlkLCBjYik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogR2l2ZW4gdGhlIElEIG9mIGEgbm9kZSwgcmV0cmlldmVzIHRoZSBjb3JyZXNwb25kaW5nIElub2RlLlxuICAgKiBAcGFyYW0gdHggVGhlIHRyYW5zYWN0aW9uIHRvIHVzZS5cbiAgICogQHBhcmFtIHAgVGhlIGNvcnJlc3BvbmRpbmcgcGF0aCB0byB0aGUgZmlsZSAodXNlZCBmb3IgZXJyb3IgbWVzc2FnZXMpLlxuICAgKiBAcGFyYW0gaWQgVGhlIElEIHRvIGxvb2sgdXAuXG4gICAqIEBwYXJhbSBjYiBQYXNzZWQgYW4gZXJyb3Igb3IgdGhlIGlub2RlIHVuZGVyIHRoZSBnaXZlbiBpZC5cbiAgICovXG4gIHByaXZhdGUgZ2V0SU5vZGUodHg6IEFzeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uLCBwOiBzdHJpbmcsIGlkOiBzdHJpbmcsIGNiOiAoZTogQXBpRXJyb3IsIGlub2RlPzogSW5vZGUpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0eC5nZXQoaWQsIChlOiBBcGlFcnJvciwgZGF0YT86IE5vZGVCdWZmZXIpOiB2b2lkID0+IHtcbiAgICAgIGlmIChub0Vycm9yKGUsIGNiKSkge1xuICAgICAgICBpZiAoZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY2IoQXBpRXJyb3IuRU5PRU5UKHApKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjYihudWxsLCBJbm9kZS5mcm9tQnVmZmVyKGRhdGEpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEdpdmVuIHRoZSBJbm9kZSBvZiBhIGRpcmVjdG9yeSwgcmV0cmlldmVzIHRoZSBjb3JyZXNwb25kaW5nIGRpcmVjdG9yeVxuICAgKiBsaXN0aW5nLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXREaXJMaXN0aW5nKHR4OiBBc3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbiwgcDogc3RyaW5nLCBpbm9kZTogSW5vZGUsIGNiOiAoZTogQXBpRXJyb3IsIGxpc3Rpbmc/OiB7IFtmaWxlTmFtZTogc3RyaW5nXTogc3RyaW5nIH0pID0+IHZvaWQpOiB2b2lkIHtcbiAgICBpZiAoIWlub2RlLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgIGNiKEFwaUVycm9yLkVOT1RESVIocCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0eC5nZXQoaW5vZGUuaWQsIChlOiBBcGlFcnJvciwgZGF0YT86IE5vZGVCdWZmZXIpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKG5vRXJyb3IoZSwgY2IpKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNiKG51bGwsIEpTT04ucGFyc2UoZGF0YS50b1N0cmluZygpKSk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gT2NjdXJzIHdoZW4gZGF0YSBpcyB1bmRlZmluZWQsIG9yIGNvcnJlc3BvbmRzIHRvIHNvbWV0aGluZyBvdGhlclxuICAgICAgICAgICAgLy8gdGhhbiBhIGRpcmVjdG9yeSBsaXN0aW5nLiBUaGUgbGF0dGVyIHNob3VsZCBuZXZlciBvY2N1ciB1bmxlc3NcbiAgICAgICAgICAgIC8vIHRoZSBmaWxlIHN5c3RlbSBpcyBjb3JydXB0ZWQuXG4gICAgICAgICAgICBjYihBcGlFcnJvci5FTk9FTlQocCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdpdmVuIGEgcGF0aCB0byBhIGRpcmVjdG9yeSwgcmV0cmlldmVzIHRoZSBjb3JyZXNwb25kaW5nIElOb2RlIGFuZFxuICAgKiBkaXJlY3RvcnkgbGlzdGluZy5cbiAgICovXG4gIHByaXZhdGUgZmluZElOb2RlQW5kRGlyTGlzdGluZyh0eDogQXN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb24sIHA6IHN0cmluZywgY2I6IChlOiBBcGlFcnJvciwgaW5vZGU/OiBJbm9kZSwgbGlzdGluZz86IHsgW2ZpbGVOYW1lOiBzdHJpbmddOiBzdHJpbmcgfSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuZmluZElOb2RlKHR4LCBwLCAoZTogQXBpRXJyb3IsIGlub2RlPzogSW5vZGUpOiB2b2lkID0+IHtcbiAgICAgIGlmIChub0Vycm9yKGUsIGNiKSkge1xuICAgICAgICB0aGlzLmdldERpckxpc3RpbmcodHgsIHAsIGlub2RlLCAoZSwgbGlzdGluZz8pID0+IHtcbiAgICAgICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgICAgIGNiKG51bGwsIGlub2RlLCBsaXN0aW5nKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYSBuZXcgbm9kZSB1bmRlciBhIHJhbmRvbSBJRC4gUmV0cmllcyA1IHRpbWVzIGJlZm9yZSBnaXZpbmcgdXAgaW5cbiAgICogdGhlIGV4Y2VlZGluZ2x5IHVubGlrZWx5IGNoYW5jZSB0aGF0IHdlIHRyeSB0byByZXVzZSBhIHJhbmRvbSBHVUlELlxuICAgKiBAcGFyYW0gY2IgUGFzc2VkIGFuIGVycm9yIG9yIHRoZSBHVUlEIHRoYXQgdGhlIGRhdGEgd2FzIHN0b3JlZCB1bmRlci5cbiAgICovXG4gIHByaXZhdGUgYWRkTmV3Tm9kZSh0eDogQXN5bmNLZXlWYWx1ZVJXVHJhbnNhY3Rpb24sIGRhdGE6IE5vZGVCdWZmZXIsIGNiOiAoZTogQXBpRXJyb3IsIGd1aWQ/OiBzdHJpbmcpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgcmV0cmllcyA9IDAsIGN1cnJJZDogc3RyaW5nLFxuICAgICAgcmVyb2xsID0gKCkgPT4ge1xuICAgICAgICBpZiAoKytyZXRyaWVzID09PSA1KSB7XG4gICAgICAgICAgLy8gTWF4IHJldHJpZXMgaGl0LiBSZXR1cm4gd2l0aCBhbiBlcnJvci5cbiAgICAgICAgICBjYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTywgJ1VuYWJsZSB0byBjb21taXQgZGF0YSB0byBrZXktdmFsdWUgc3RvcmUuJykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFRyeSBhZ2Fpbi5cbiAgICAgICAgICBjdXJySWQgPSBHZW5lcmF0ZVJhbmRvbUlEKCk7XG4gICAgICAgICAgdHgucHV0KGN1cnJJZCwgZGF0YSwgZmFsc2UsIChlOiBBcGlFcnJvciwgY29tbWl0dGVkPzogYm9vbGVhbikgPT4ge1xuICAgICAgICAgICAgaWYgKGUgfHwgIWNvbW1pdHRlZCkge1xuICAgICAgICAgICAgICByZXJvbGwoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIFN1Y2Nlc3NmdWxseSBzdG9yZWQgdW5kZXIgJ2N1cnJJZCcuXG4gICAgICAgICAgICAgIGNiKG51bGwsIGN1cnJJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgcmVyb2xsKCk7XG4gIH1cblxuICAvKipcbiAgICogQ29tbWl0cyBhIG5ldyBmaWxlICh3ZWxsLCBhIEZJTEUgb3IgYSBESVJFQ1RPUlkpIHRvIHRoZSBmaWxlIHN5c3RlbSB3aXRoXG4gICAqIHRoZSBnaXZlbiBtb2RlLlxuICAgKiBOb3RlOiBUaGlzIHdpbGwgY29tbWl0IHRoZSB0cmFuc2FjdGlvbi5cbiAgICogQHBhcmFtIHAgVGhlIHBhdGggdG8gdGhlIG5ldyBmaWxlLlxuICAgKiBAcGFyYW0gdHlwZSBUaGUgdHlwZSBvZiB0aGUgbmV3IGZpbGUuXG4gICAqIEBwYXJhbSBtb2RlIFRoZSBtb2RlIHRvIGNyZWF0ZSB0aGUgbmV3IGZpbGUgd2l0aC5cbiAgICogQHBhcmFtIGRhdGEgVGhlIGRhdGEgdG8gc3RvcmUgYXQgdGhlIGZpbGUncyBkYXRhIG5vZGUuXG4gICAqIEBwYXJhbSBjYiBQYXNzZWQgYW4gZXJyb3Igb3IgdGhlIElub2RlIGZvciB0aGUgbmV3IGZpbGUuXG4gICAqL1xuICBwcml2YXRlIGNvbW1pdE5ld0ZpbGUodHg6IEFzeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uLCBwOiBzdHJpbmcsIHR5cGU6IG5vZGVfZnNfc3RhdHMuRmlsZVR5cGUsIG1vZGU6IG51bWJlciwgZGF0YTogTm9kZUJ1ZmZlciwgY2I6IChlOiBBcGlFcnJvciwgaW5vZGU/OiBJbm9kZSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciBwYXJlbnREaXIgPSBwYXRoLmRpcm5hbWUocCksXG4gICAgICBmbmFtZSA9IHBhdGguYmFzZW5hbWUocCksXG4gICAgICBjdXJyVGltZSA9IChuZXcgRGF0ZSgpKS5nZXRUaW1lKCk7XG5cbiAgICAvLyBJbnZhcmlhbnQ6IFRoZSByb290IGFsd2F5cyBleGlzdHMuXG4gICAgLy8gSWYgd2UgZG9uJ3QgY2hlY2sgdGhpcyBwcmlvciB0byB0YWtpbmcgc3RlcHMgYmVsb3csIHdlIHdpbGwgY3JlYXRlIGFcbiAgICAvLyBmaWxlIHdpdGggbmFtZSAnJyBpbiByb290IHNob3VsZCBwID09ICcvJy5cbiAgICBpZiAocCA9PT0gJy8nKSB7XG4gICAgICByZXR1cm4gY2IoQXBpRXJyb3IuRUVYSVNUKHApKTtcbiAgICB9XG5cbiAgICAvLyBMZXQncyBidWlsZCBhIHB5cmFtaWQgb2YgY29kZSFcblxuICAgIC8vIFN0ZXAgMTogR2V0IHRoZSBwYXJlbnQgZGlyZWN0b3J5J3MgaW5vZGUgYW5kIGRpcmVjdG9yeSBsaXN0aW5nXG4gICAgdGhpcy5maW5kSU5vZGVBbmREaXJMaXN0aW5nKHR4LCBwYXJlbnREaXIsIChlOiBBcGlFcnJvciwgcGFyZW50Tm9kZT86IElub2RlLCBkaXJMaXN0aW5nPzoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9KTogdm9pZCA9PiB7XG4gICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgaWYgKGRpckxpc3RpbmdbZm5hbWVdKSB7XG4gICAgICAgICAgLy8gRmlsZSBhbHJlYWR5IGV4aXN0cy5cbiAgICAgICAgICB0eC5hYm9ydCgoKSA9PiB7XG4gICAgICAgICAgICBjYihBcGlFcnJvci5FRVhJU1QocCkpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFN0ZXAgMjogQ29tbWl0IGRhdGEgdG8gc3RvcmUuXG4gICAgICAgICAgdGhpcy5hZGROZXdOb2RlKHR4LCBkYXRhLCAoZTogQXBpRXJyb3IsIGRhdGFJZD86IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgIC8vIFN0ZXAgMzogQ29tbWl0IHRoZSBmaWxlJ3MgaW5vZGUgdG8gdGhlIHN0b3JlLlxuICAgICAgICAgICAgICB2YXIgZmlsZUlub2RlID0gbmV3IElub2RlKGRhdGFJZCwgZGF0YS5sZW5ndGgsIG1vZGUgfCB0eXBlLCBjdXJyVGltZSwgY3VyclRpbWUsIGN1cnJUaW1lKTtcbiAgICAgICAgICAgICAgdGhpcy5hZGROZXdOb2RlKHR4LCBmaWxlSW5vZGUudG9CdWZmZXIoKSwgKGU6IEFwaUVycm9yLCBmaWxlSW5vZGVJZD86IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICAgICAgLy8gU3RlcCA0OiBVcGRhdGUgcGFyZW50IGRpcmVjdG9yeSdzIGxpc3RpbmcuXG4gICAgICAgICAgICAgICAgICBkaXJMaXN0aW5nW2ZuYW1lXSA9IGZpbGVJbm9kZUlkO1xuICAgICAgICAgICAgICAgICAgdHgucHV0KHBhcmVudE5vZGUuaWQsIG5ldyBCdWZmZXIoSlNPTi5zdHJpbmdpZnkoZGlyTGlzdGluZykpLCB0cnVlLCAoZTogQXBpRXJyb3IpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgLy8gU3RlcCA1OiBDb21taXQgYW5kIHJldHVybiB0aGUgbmV3IGlub2RlLlxuICAgICAgICAgICAgICAgICAgICAgIHR4LmNvbW1pdCgoZT86IEFwaUVycm9yKTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2IobnVsbCwgZmlsZUlub2RlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSBhbGwgY29udGVudHMgc3RvcmVkIGluIHRoZSBmaWxlIHN5c3RlbS5cbiAgICovXG4gIHB1YmxpYyBlbXB0eShjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuY2xlYXIoKGU/KSA9PiB7XG4gICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgLy8gSU5WQVJJQU5UOiBSb290IGFsd2F5cyBleGlzdHMuXG4gICAgICAgIHRoaXMubWFrZVJvb3REaXJlY3RvcnkoY2IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIHJlbmFtZShvbGRQYXRoOiBzdHJpbmcsIG5ld1BhdGg6IHN0cmluZywgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpLFxuICAgICAgb2xkUGFyZW50ID0gcGF0aC5kaXJuYW1lKG9sZFBhdGgpLCBvbGROYW1lID0gcGF0aC5iYXNlbmFtZShvbGRQYXRoKSxcbiAgICAgIG5ld1BhcmVudCA9IHBhdGguZGlybmFtZShuZXdQYXRoKSwgbmV3TmFtZSA9IHBhdGguYmFzZW5hbWUobmV3UGF0aCksXG4gICAgICBpbm9kZXM6IHsgW3BhdGg6IHN0cmluZ106IElub2RlIH0gPSB7fSxcbiAgICAgIGxpc3RzOiB7XG4gICAgICAgIFtwYXRoOiBzdHJpbmddOiB7IFtmaWxlOiBzdHJpbmddOiBzdHJpbmcgfVxuICAgICAgfSA9IHt9LFxuICAgICAgZXJyb3JPY2N1cnJlZDogYm9vbGVhbiA9IGZhbHNlO1xuXG4gICAgLy8gSW52YXJpYW50OiBDYW4ndCBtb3ZlIGEgZm9sZGVyIGluc2lkZSBpdHNlbGYuXG4gICAgLy8gVGhpcyBmdW5ueSBsaXR0bGUgaGFjayBlbnN1cmVzIHRoYXQgdGhlIGNoZWNrIHBhc3NlcyBvbmx5IGlmIG9sZFBhdGhcbiAgICAvLyBpcyBhIHN1YnBhdGggb2YgbmV3UGFyZW50LiBXZSBhcHBlbmQgJy8nIHRvIGF2b2lkIG1hdGNoaW5nIGZvbGRlcnMgdGhhdFxuICAgIC8vIGFyZSBhIHN1YnN0cmluZyBvZiB0aGUgYm90dG9tLW1vc3QgZm9sZGVyIGluIHRoZSBwYXRoLlxuICAgIGlmICgobmV3UGFyZW50ICsgJy8nKS5pbmRleE9mKG9sZFBhdGggKyAnLycpID09PSAwKSB7XG4gICAgICByZXR1cm4gY2IobmV3IEFwaUVycm9yKEVycm9yQ29kZS5FQlVTWSwgb2xkUGFyZW50KSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzcG9uc2libGUgZm9yIFBoYXNlIDIgb2YgdGhlIHJlbmFtZSBvcGVyYXRpb246IE1vZGlmeWluZyBhbmRcbiAgICAgKiBjb21taXR0aW5nIHRoZSBkaXJlY3RvcnkgbGlzdGluZ3MuIENhbGxlZCBvbmNlIHdlIGhhdmUgc3VjY2Vzc2Z1bGx5XG4gICAgICogcmV0cmlldmVkIGJvdGggdGhlIG9sZCBhbmQgbmV3IHBhcmVudCdzIGlub2RlcyBhbmQgbGlzdGluZ3MuXG4gICAgICovXG4gICAgdmFyIHRoZU9sZVN3aXRjaGFyb28gPSAoKTogdm9pZCA9PiB7XG4gICAgICAvLyBTYW5pdHkgY2hlY2s6IEVuc3VyZSBib3RoIHBhdGhzIGFyZSBwcmVzZW50LCBhbmQgbm8gZXJyb3IgaGFzIG9jY3VycmVkLlxuICAgICAgaWYgKGVycm9yT2NjdXJyZWQgfHwgIWxpc3RzLmhhc093blByb3BlcnR5KG9sZFBhcmVudCkgfHwgIWxpc3RzLmhhc093blByb3BlcnR5KG5ld1BhcmVudCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdmFyIG9sZFBhcmVudExpc3QgPSBsaXN0c1tvbGRQYXJlbnRdLCBvbGRQYXJlbnRJTm9kZSA9IGlub2Rlc1tvbGRQYXJlbnRdLFxuICAgICAgICBuZXdQYXJlbnRMaXN0ID0gbGlzdHNbbmV3UGFyZW50XSwgbmV3UGFyZW50SU5vZGUgPSBpbm9kZXNbbmV3UGFyZW50XTtcblxuICAgICAgLy8gRGVsZXRlIGZpbGUgZnJvbSBvbGQgcGFyZW50LlxuICAgICAgaWYgKCFvbGRQYXJlbnRMaXN0W29sZE5hbWVdKSB7XG4gICAgICAgIGNiKEFwaUVycm9yLkVOT0VOVChvbGRQYXRoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgZmlsZUlkID0gb2xkUGFyZW50TGlzdFtvbGROYW1lXTtcbiAgICAgICAgZGVsZXRlIG9sZFBhcmVudExpc3Rbb2xkTmFtZV07XG5cbiAgICAgICAgLy8gRmluaXNoZXMgb2ZmIHRoZSByZW5hbWluZyBwcm9jZXNzIGJ5IGFkZGluZyB0aGUgZmlsZSB0byB0aGUgbmV3XG4gICAgICAgIC8vIHBhcmVudC5cbiAgICAgICAgdmFyIGNvbXBsZXRlUmVuYW1lID0gKCkgPT4ge1xuICAgICAgICAgIG5ld1BhcmVudExpc3RbbmV3TmFtZV0gPSBmaWxlSWQ7XG4gICAgICAgICAgLy8gQ29tbWl0IG9sZCBwYXJlbnQncyBsaXN0LlxuICAgICAgICAgIHR4LnB1dChvbGRQYXJlbnRJTm9kZS5pZCwgbmV3IEJ1ZmZlcihKU09OLnN0cmluZ2lmeShvbGRQYXJlbnRMaXN0KSksIHRydWUsIChlOiBBcGlFcnJvcikgPT4ge1xuICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgIGlmIChvbGRQYXJlbnQgPT09IG5ld1BhcmVudCkge1xuICAgICAgICAgICAgICAgIC8vIERPTkUhXG4gICAgICAgICAgICAgICAgdHguY29tbWl0KGNiKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBDb21taXQgbmV3IHBhcmVudCdzIGxpc3QuXG4gICAgICAgICAgICAgICAgdHgucHV0KG5ld1BhcmVudElOb2RlLmlkLCBuZXcgQnVmZmVyKEpTT04uc3RyaW5naWZ5KG5ld1BhcmVudExpc3QpKSwgdHJ1ZSwgKGU6IEFwaUVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgICAgICAgdHguY29tbWl0KGNiKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChuZXdQYXJlbnRMaXN0W25ld05hbWVdKSB7XG4gICAgICAgICAgLy8gJ25ld1BhdGgnIGFscmVhZHkgZXhpc3RzLiBDaGVjayBpZiBpdCdzIGEgZmlsZSBvciBhIGRpcmVjdG9yeSwgYW5kXG4gICAgICAgICAgLy8gYWN0IGFjY29yZGluZ2x5LlxuICAgICAgICAgIHRoaXMuZ2V0SU5vZGUodHgsIG5ld1BhdGgsIG5ld1BhcmVudExpc3RbbmV3TmFtZV0sIChlOiBBcGlFcnJvciwgaW5vZGU/OiBJbm9kZSkgPT4ge1xuICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgIGlmIChpbm9kZS5pc0ZpbGUoKSkge1xuICAgICAgICAgICAgICAgIC8vIERlbGV0ZSB0aGUgZmlsZSBhbmQgY29udGludWUuXG4gICAgICAgICAgICAgICAgdHguZGVsKGlub2RlLmlkLCAoZT86IEFwaUVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgICAgICAgdHguZGVsKG5ld1BhcmVudExpc3RbbmV3TmFtZV0sIChlPzogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBsZXRlUmVuYW1lKCk7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBDYW4ndCBvdmVyd3JpdGUgYSBkaXJlY3RvcnkgdXNpbmcgcmVuYW1lLlxuICAgICAgICAgICAgICAgIHR4LmFib3J0KChlPykgPT4ge1xuICAgICAgICAgICAgICAgICAgY2IoQXBpRXJyb3IuRVBFUk0obmV3UGF0aCkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29tcGxldGVSZW5hbWUoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBHcmFicyBhIHBhdGgncyBpbm9kZSBhbmQgZGlyZWN0b3J5IGxpc3RpbmcsIGFuZCBzaG92ZXMgaXQgaW50byB0aGVcbiAgICAgKiBpbm9kZXMgYW5kIGxpc3RzIGhhc2hlcy5cbiAgICAgKi9cbiAgICB2YXIgcHJvY2Vzc0lub2RlQW5kTGlzdGluZ3MgPSAocDogc3RyaW5nKTogdm9pZCA9PiB7XG4gICAgICB0aGlzLmZpbmRJTm9kZUFuZERpckxpc3RpbmcodHgsIHAsIChlOiBBcGlFcnJvciwgbm9kZT86IElub2RlLCBkaXJMaXN0Pzoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9KTogdm9pZCA9PiB7XG4gICAgICAgIGlmIChlKSB7XG4gICAgICAgICAgaWYgKCFlcnJvck9jY3VycmVkKSB7XG4gICAgICAgICAgICBlcnJvck9jY3VycmVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHR4LmFib3J0KCgpID0+IHtcbiAgICAgICAgICAgICAgY2IoZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gSWYgZXJyb3IgaGFzIG9jY3VycmVkIGFscmVhZHksIGp1c3Qgc3RvcCBoZXJlLlxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlub2Rlc1twXSA9IG5vZGU7XG4gICAgICAgICAgbGlzdHNbcF0gPSBkaXJMaXN0O1xuICAgICAgICAgIHRoZU9sZVN3aXRjaGFyb28oKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfTtcblxuICAgIHByb2Nlc3NJbm9kZUFuZExpc3RpbmdzKG9sZFBhcmVudCk7XG4gICAgaWYgKG9sZFBhcmVudCAhPT0gbmV3UGFyZW50KSB7XG4gICAgICBwcm9jZXNzSW5vZGVBbmRMaXN0aW5ncyhuZXdQYXJlbnQpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBzdGF0KHA6IHN0cmluZywgaXNMc3RhdDogYm9vbGVhbiwgY2I6IChlcnI6IEFwaUVycm9yLCBzdGF0Pzogbm9kZV9mc19zdGF0cy5TdGF0cykgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZG9ubHknKTtcbiAgICB0aGlzLmZpbmRJTm9kZSh0eCwgcCwgKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKTogdm9pZCA9PiB7XG4gICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgY2IobnVsbCwgaW5vZGUudG9TdGF0cygpKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVGaWxlKHA6IHN0cmluZywgZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnLCBtb2RlOiBudW1iZXIsIGNiOiAoZTogQXBpRXJyb3IsIGZpbGU/OiBmaWxlLkZpbGUpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpLFxuICAgICAgZGF0YSA9IG5ldyBCdWZmZXIoMCk7XG5cbiAgICB0aGlzLmNvbW1pdE5ld0ZpbGUodHgsIHAsIG5vZGVfZnNfc3RhdHMuRmlsZVR5cGUuRklMRSwgbW9kZSwgZGF0YSwgKGU6IEFwaUVycm9yLCBuZXdGaWxlPzogSW5vZGUpOiB2b2lkID0+IHtcbiAgICAgIGlmIChub0Vycm9yKGUsIGNiKSkge1xuICAgICAgICBjYihudWxsLCBuZXcgQXN5bmNLZXlWYWx1ZUZpbGUodGhpcywgcCwgZmxhZywgbmV3RmlsZS50b1N0YXRzKCksIGRhdGEpKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBvcGVuRmlsZShwOiBzdHJpbmcsIGZsYWc6IGZpbGVfZmxhZy5GaWxlRmxhZywgY2I6IChlOiBBcGlFcnJvciwgZmlsZT86IGZpbGUuRmlsZSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZG9ubHknKTtcbiAgICAvLyBTdGVwIDE6IEdyYWIgdGhlIGZpbGUncyBpbm9kZS5cbiAgICB0aGlzLmZpbmRJTm9kZSh0eCwgcCwgKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKSA9PiB7XG4gICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgLy8gU3RlcCAyOiBHcmFiIHRoZSBmaWxlJ3MgZGF0YS5cbiAgICAgICAgdHguZ2V0KGlub2RlLmlkLCAoZTogQXBpRXJyb3IsIGRhdGE/OiBOb2RlQnVmZmVyKTogdm9pZCA9PiB7XG4gICAgICAgICAgaWYgKG5vRXJyb3IoZSwgY2IpKSB7XG4gICAgICAgICAgICBpZiAoZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIGNiKEFwaUVycm9yLkVOT0VOVChwKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjYihudWxsLCBuZXcgQXN5bmNLZXlWYWx1ZUZpbGUodGhpcywgcCwgZmxhZywgaW5vZGUudG9TdGF0cygpLCBkYXRhKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIHRyYWNlcyBvZiB0aGUgZ2l2ZW4gcGF0aCBmcm9tIHRoZSBmaWxlIHN5c3RlbS5cbiAgICogQHBhcmFtIHAgVGhlIHBhdGggdG8gcmVtb3ZlIGZyb20gdGhlIGZpbGUgc3lzdGVtLlxuICAgKiBAcGFyYW0gaXNEaXIgRG9lcyB0aGUgcGF0aCBiZWxvbmcgdG8gYSBkaXJlY3RvcnksIG9yIGEgZmlsZT9cbiAgICogQHRvZG8gVXBkYXRlIG10aW1lLlxuICAgKi9cbiAgcHJpdmF0ZSByZW1vdmVFbnRyeShwOiBzdHJpbmcsIGlzRGlyOiBib29sZWFuLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZHdyaXRlJyksXG4gICAgICBwYXJlbnQ6IHN0cmluZyA9IHBhdGguZGlybmFtZShwKSwgZmlsZU5hbWU6IHN0cmluZyA9IHBhdGguYmFzZW5hbWUocCk7XG4gICAgLy8gU3RlcCAxOiBHZXQgcGFyZW50IGRpcmVjdG9yeSdzIG5vZGUgYW5kIGRpcmVjdG9yeSBsaXN0aW5nLlxuICAgIHRoaXMuZmluZElOb2RlQW5kRGlyTGlzdGluZyh0eCwgcGFyZW50LCAoZTogQXBpRXJyb3IsIHBhcmVudE5vZGU/OiBJbm9kZSwgcGFyZW50TGlzdGluZz86IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSk6IHZvaWQgPT4ge1xuICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgIGlmICghcGFyZW50TGlzdGluZ1tmaWxlTmFtZV0pIHtcbiAgICAgICAgICB0eC5hYm9ydCgoKSA9PiB7XG4gICAgICAgICAgICBjYihBcGlFcnJvci5FTk9FTlQocCkpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFJlbW92ZSBmcm9tIGRpcmVjdG9yeSBsaXN0aW5nIG9mIHBhcmVudC5cbiAgICAgICAgICB2YXIgZmlsZU5vZGVJZCA9IHBhcmVudExpc3RpbmdbZmlsZU5hbWVdO1xuICAgICAgICAgIGRlbGV0ZSBwYXJlbnRMaXN0aW5nW2ZpbGVOYW1lXTtcbiAgICAgICAgICAvLyBTdGVwIDI6IEdldCBmaWxlIGlub2RlLlxuICAgICAgICAgIHRoaXMuZ2V0SU5vZGUodHgsIHAsIGZpbGVOb2RlSWQsIChlOiBBcGlFcnJvciwgZmlsZU5vZGU/OiBJbm9kZSk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgIGlmICghaXNEaXIgJiYgZmlsZU5vZGUuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgICAgICAgIHR4LmFib3J0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgIGNiKEFwaUVycm9yLkVJU0RJUihwKSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNEaXIgJiYgIWZpbGVOb2RlLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICB0eC5hYm9ydCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICBjYihBcGlFcnJvci5FTk9URElSKHApKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBTdGVwIDM6IERlbGV0ZSBkYXRhLlxuICAgICAgICAgICAgICAgIHR4LmRlbChmaWxlTm9kZS5pZCwgKGU/OiBBcGlFcnJvcik6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFN0ZXAgNDogRGVsZXRlIG5vZGUuXG4gICAgICAgICAgICAgICAgICAgIHR4LmRlbChmaWxlTm9kZUlkLCAoZT86IEFwaUVycm9yKTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBTdGVwIDU6IFVwZGF0ZSBkaXJlY3RvcnkgbGlzdGluZy5cbiAgICAgICAgICAgICAgICAgICAgICAgIHR4LnB1dChwYXJlbnROb2RlLmlkLCBuZXcgQnVmZmVyKEpTT04uc3RyaW5naWZ5KHBhcmVudExpc3RpbmcpKSwgdHJ1ZSwgKGU6IEFwaUVycm9yKTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR4LmNvbW1pdChjYik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIHVubGluayhwOiBzdHJpbmcsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5yZW1vdmVFbnRyeShwLCBmYWxzZSwgY2IpO1xuICB9XG5cbiAgcHVibGljIHJtZGlyKHA6IHN0cmluZywgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLnJlbW92ZUVudHJ5KHAsIHRydWUsIGNiKTtcbiAgfVxuXG4gIHB1YmxpYyBta2RpcihwOiBzdHJpbmcsIG1vZGU6IG51bWJlciwgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpLFxuICAgICAgZGF0YSA9IG5ldyBCdWZmZXIoJ3t9Jyk7XG4gICAgdGhpcy5jb21taXROZXdGaWxlKHR4LCBwLCBub2RlX2ZzX3N0YXRzLkZpbGVUeXBlLkRJUkVDVE9SWSwgbW9kZSwgZGF0YSwgY2IpO1xuICB9XG5cbiAgcHVibGljIHJlYWRkaXIocDogc3RyaW5nLCBjYjogKGVycjogQXBpRXJyb3IsIGZpbGVzPzogc3RyaW5nW10pID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWRvbmx5Jyk7XG4gICAgdGhpcy5maW5kSU5vZGUodHgsIHAsIChlOiBBcGlFcnJvciwgaW5vZGU/OiBJbm9kZSkgPT4ge1xuICAgICAgaWYgKG5vRXJyb3IoZSwgY2IpKSB7XG4gICAgICAgIHRoaXMuZ2V0RGlyTGlzdGluZyh0eCwgcCwgaW5vZGUsIChlOiBBcGlFcnJvciwgZGlyTGlzdGluZz86IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSkgPT4ge1xuICAgICAgICAgIGlmIChub0Vycm9yKGUsIGNiKSkge1xuICAgICAgICAgICAgY2IobnVsbCwgT2JqZWN0LmtleXMoZGlyTGlzdGluZykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgX3N5bmMocDogc3RyaW5nLCBkYXRhOiBOb2RlQnVmZmVyLCBzdGF0czogbm9kZV9mc19zdGF0cy5TdGF0cywgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICAvLyBAdG9kbyBFbnN1cmUgbXRpbWUgdXBkYXRlcyBwcm9wZXJseSwgYW5kIHVzZSB0aGF0IHRvIGRldGVybWluZSBpZiBhIGRhdGFcbiAgICAvLyAgICAgICB1cGRhdGUgaXMgcmVxdWlyZWQuXG4gICAgdmFyIHR4ID0gdGhpcy5zdG9yZS5iZWdpblRyYW5zYWN0aW9uKCdyZWFkd3JpdGUnKTtcbiAgICAvLyBTdGVwIDE6IEdldCB0aGUgZmlsZSBub2RlJ3MgSUQuXG4gICAgdGhpcy5fZmluZElOb2RlKHR4LCBwYXRoLmRpcm5hbWUocCksIHBhdGguYmFzZW5hbWUocCksIChlOiBBcGlFcnJvciwgZmlsZUlub2RlSWQ/OiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAvLyBTdGVwIDI6IEdldCB0aGUgZmlsZSBpbm9kZS5cbiAgICAgICAgdGhpcy5nZXRJTm9kZSh0eCwgcCwgZmlsZUlub2RlSWQsIChlOiBBcGlFcnJvciwgZmlsZUlub2RlPzogSW5vZGUpOiB2b2lkID0+IHtcbiAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgIHZhciBpbm9kZUNoYW5nZWQ6IGJvb2xlYW4gPSBmaWxlSW5vZGUudXBkYXRlKHN0YXRzKTtcbiAgICAgICAgICAgIC8vIFN0ZXAgMzogU3luYyB0aGUgZGF0YS5cbiAgICAgICAgICAgIHR4LnB1dChmaWxlSW5vZGUuaWQsIGRhdGEsIHRydWUsIChlOiBBcGlFcnJvcik6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgICAvLyBTdGVwIDQ6IFN5bmMgdGhlIG1ldGFkYXRhIChpZiBpdCBjaGFuZ2VkKSFcbiAgICAgICAgICAgICAgICBpZiAoaW5vZGVDaGFuZ2VkKSB7XG4gICAgICAgICAgICAgICAgICB0eC5wdXQoZmlsZUlub2RlSWQsIGZpbGVJbm9kZS50b0J1ZmZlcigpLCB0cnVlLCAoZTogQXBpRXJyb3IpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgdHguY29tbWl0KGNiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIC8vIE5vIG5lZWQgdG8gc3luYyBtZXRhZGF0YTsgcmV0dXJuLlxuICAgICAgICAgICAgICAgICAgdHguY29tbWl0KGNiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==