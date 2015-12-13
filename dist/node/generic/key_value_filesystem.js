var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var file_system = require('../core/file_system');
var api_error_1 = require('../core/api_error');
var node_fs_stats_1 = require('../core/node_fs_stats');
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
            var currTime = (new Date()).getTime(), dirInode = new Inode(GenerateRandomID(), 4096, 511 | node_fs_stats_1.FileType.DIRECTORY, currTime, currTime, currTime);
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
        var tx = this.store.beginTransaction('readwrite'), data = new Buffer(0), newFile = this.commitNewFile(tx, p, node_fs_stats_1.FileType.FILE, mode, data);
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
        this.commitNewFile(tx, p, node_fs_stats_1.FileType.DIRECTORY, mode, data);
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
                var currTime = (new Date()).getTime(), dirInode = new Inode(GenerateRandomID(), 4096, 511 | node_fs_stats_1.FileType.DIRECTORY, currTime, currTime, currTime);
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
        this.commitNewFile(tx, p, node_fs_stats_1.FileType.FILE, mode, data, function (e, newFile) {
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
        this.commitNewFile(tx, p, node_fs_stats_1.FileType.DIRECTORY, mode, data, cb);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2V5X3ZhbHVlX2ZpbGVzeXN0ZW0uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvZ2VuZXJpYy9rZXlfdmFsdWVfZmlsZXN5c3RlbS50cyJdLCJuYW1lcyI6WyJHZW5lcmF0ZVJhbmRvbUlEIiwibm9FcnJvciIsIm5vRXJyb3JUeCIsIlNpbXBsZVN5bmNSV1RyYW5zYWN0aW9uIiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24uY29uc3RydWN0b3IiLCJTaW1wbGVTeW5jUldUcmFuc2FjdGlvbi5zdGFzaE9sZFZhbHVlIiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24ubWFya01vZGlmaWVkIiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24uZ2V0IiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24ucHV0IiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24uZGVsIiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24uY29tbWl0IiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24uYWJvcnQiLCJTeW5jS2V5VmFsdWVGaWxlIiwiU3luY0tleVZhbHVlRmlsZS5jb25zdHJ1Y3RvciIsIlN5bmNLZXlWYWx1ZUZpbGUuc3luY1N5bmMiLCJTeW5jS2V5VmFsdWVGaWxlLmNsb3NlU3luYyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0iLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmNvbnN0cnVjdG9yIiwiU3luY0tleVZhbHVlRmlsZVN5c3RlbS5pc0F2YWlsYWJsZSIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uZ2V0TmFtZSIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uaXNSZWFkT25seSIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uc3VwcG9ydHNTeW1saW5rcyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uc3VwcG9ydHNQcm9wcyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uc3VwcG9ydHNTeW5jaCIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0ubWFrZVJvb3REaXJlY3RvcnkiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLl9maW5kSU5vZGUiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmZpbmRJTm9kZSIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uZ2V0SU5vZGUiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmdldERpckxpc3RpbmciLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmFkZE5ld05vZGUiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmNvbW1pdE5ld0ZpbGUiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmVtcHR5IiwiU3luY0tleVZhbHVlRmlsZVN5c3RlbS5yZW5hbWVTeW5jIiwiU3luY0tleVZhbHVlRmlsZVN5c3RlbS5zdGF0U3luYyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uY3JlYXRlRmlsZVN5bmMiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLm9wZW5GaWxlU3luYyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0ucmVtb3ZlRW50cnkiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLnVubGlua1N5bmMiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLnJtZGlyU3luYyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0ubWtkaXJTeW5jIiwiU3luY0tleVZhbHVlRmlsZVN5c3RlbS5yZWFkZGlyU3luYyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uX3N5bmNTeW5jIiwiQXN5bmNLZXlWYWx1ZUZpbGUiLCJBc3luY0tleVZhbHVlRmlsZS5jb25zdHJ1Y3RvciIsIkFzeW5jS2V5VmFsdWVGaWxlLnN5bmMiLCJBc3luY0tleVZhbHVlRmlsZS5jbG9zZSIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uY29uc3RydWN0b3IiLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5pbml0IiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uaXNBdmFpbGFibGUiLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5nZXROYW1lIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uaXNSZWFkT25seSIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLnN1cHBvcnRzU3ltbGlua3MiLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5zdXBwb3J0c1Byb3BzIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uc3VwcG9ydHNTeW5jaCIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLm1ha2VSb290RGlyZWN0b3J5IiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uX2ZpbmRJTm9kZSIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmZpbmRJTm9kZSIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmdldElOb2RlIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uZ2V0RGlyTGlzdGluZyIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmZpbmRJTm9kZUFuZERpckxpc3RpbmciLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5hZGROZXdOb2RlIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uY29tbWl0TmV3RmlsZSIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmVtcHR5IiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0ucmVuYW1lIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uc3RhdCIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmNyZWF0ZUZpbGUiLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5vcGVuRmlsZSIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLnJlbW92ZUVudHJ5IiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0udW5saW5rIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0ucm1kaXIiLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5ta2RpciIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLnJlYWRkaXIiLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5fc3luYyJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxJQUFPLFdBQVcsV0FBVyxxQkFBcUIsQ0FBQyxDQUFDO0FBQ3BELDBC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Q0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDM0JBLENBQUNBO1FBR0RBLEVBQUVBLENBQUNBLENBQUNBLFVBQVVBLENBQUNBLEtBQUtBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1lBQ3RCQSxNQUFNQSxvQkFBUUEsQ0FBQ0EsTUFBTUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDM0JBLENBQUNBO1FBRURBLElBQUlBLENBQUNBO1lBRUhBLElBQUlBLE1BQU1BLEdBQUdBLElBQUlBLENBQUNBLFVBQVVBLENBQUNBLEVBQUVBLEVBQUVBLElBQUlBLENBQUNBLEVBQ3BDQSxRQUFRQSxHQUFHQSxJQUFJQSxLQUFLQSxDQUFDQSxNQUFNQSxFQUFFQSxJQUFJQSxDQUFDQSxNQUFNQSxFQUFFQSxJQUFJQSxHQUFHQSxJQUFJQSxFQUFFQSxRQUFRQSxFQUFFQSxRQUFRQSxFQUFFQSxRQUFRQSxDQUFDQSxFQUVwRkEsVUFBVUEsR0FBR0EsSUFBSUEsQ0FBQ0EsVUFBVUEsQ0FBQ0EsRUFBRUEsRUFBRUEsUUFBUUEsQ0FBQ0EsUUFBUUEsRUFBRUEsQ0FBQ0EsQ0FBQ0E7WUFFeERBLFVBQVVBLENBQUNBLEtBQUtBLENBQUNBLEdBQUdBLFVBQVVBLENBQUNBO1lBQy9CQSxFQUFFQSxDQUFDQSxHQUFHQSxDQUFDQSxVQUFVQSxDQUFDQSxFQUFFQSxFQUFFQSxJQUFJQSxNQUFNQSxDQUFDQSxJQUFJQSxDQUFDQSxTQUFTQSxDQUFDQSxVQUFVQSxDQUFDQSxDQUFDQSxFQUFFQSxJQUFJQSxDQUFDQSxDQUFDQTtRQUN0RUEsQ0FBRUE7UUFBQUEsS0FBS0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFDWEEsRUFBRUEsQ0FBQ0EsS0FBS0EsRUFBRUEsQ0FBQ0E7WUFDWEEsTUFBTUEsQ0FBQ0EsQ0FBQ0E7UUFDVkEsQ0FBQ0E7UUFDREEsRUFBRUEsQ0FBQ0EsTUFBTUEsRUFBRUEsQ0FBQ0E7UUFDWkEsTUFBTUEsQ0FBQ0EsUUFBUUEsQ0FBQ0E7SUFDbEJBLENBQUNBO0lBS01kLHNDQUFLQSxHQUFaQTtR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QUNBLE1BQU1BLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1FBQ2hDQSxDQUFDQTtRQUtEQSxJQUFJQSxDQUFDQSxzQkFBc0JBLENBQUNBLEVBQUVBLEVBQUVBLFNBQVNBLEVBQUVBLFVBQUNBLENBQVdBLEVBQUVBLFVBQWtCQSxFQUFFQSxVQUFxQ0E7WUFDaEhBLEVBQUVBLENBQUNBLENBQUNBLFNBQVNBLENBQUNBLENBQUNBLEVBQUVBLEVBQUVBLEVBQUVBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO2dCQUN6QkEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsVUFBVUEsQ0FBQ0EsS0FBS0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7b0JBRXRCQSxFQUFFQSxDQUFDQSxLQUFLQSxDQUFDQTt3QkFDUEEsRUFBRUEsQ0FBQ0Esb0JBQVFBLENBQUNBLE1BQU1BLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO29CQUN6QkEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7Z0JBQ0xBLENBQUNBO2dCQUFDQSxJQUFJQSxDQUFDQSxDQUFDQTtvQkFFTkEsS0FBSUEsQ0FBQ0EsVUFBVUEsQ0FBQ0EsRUFBRUEsRUFBRUEsSUFBSUEsRUFBRUEsVUFBQ0EsQ0FBV0EsRUFBRUEsTUFBZUE7d0JBQ3JEQSxFQUFFQSxDQUFDQSxDQUFDQSxTQUFTQSxDQUFDQSxDQUFDQSxFQUFFQSxFQUFFQSxFQUFFQSxFQUFFQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQTs0QkFFekJBLElBQUlBLFNBQVNBLEdBQUdBLElBQUlBLEtBQUtBLENBQUNBLE1BQU1BLEVBQUVBLElBQUlBLENBQUNBLE1BQU1BLEVBQUVBLElBQUlBLEdBQUdBLElBQUlBLEVBQUVBLFFBQVFBLEVBQUVBLFFBQVFBLEVBQUVBLFFBQVFBLENBQUNBLENBQUNBOzRCQUMxRkEsS0FBSUEsQ0FBQ0EsVUFBVUEsQ0FBQ0EsRUFBRUEsRUFBRUEsU0FBU0EsQ0FBQ0EsUUFBUUEsRUFBRUEsRUFBRUEsVUFBQ0EsQ0FBV0EsRUFBRUEsV0FBb0JBO2dDQUMxRUEsRUFBRUEs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LENBQUNBLENBQUNBO2dDQUNMQSxDQUFDQTtnQ0FBQ0EsSUFBSUEsQ0FBQ0EsQ0FBQ0E7b0NBRU5BLEVBQUVBLENBQUNBLE1BQU1BLENBQUNBLEVBQUVBLENBQUNBLENBQUNBO2dDQUNoQkEsQ0FBQ0E7NEJBQ0hBLENBQUNBO3dCQUNIQSxDQUFDQSxDQUFDQSxDQUFDQTtvQkFDTEEsQ0FBQ0E7Z0JBQ0hBLENBQUNBLENBQUNBLENBQUNBO1lBQ0xBLENBQUNBO1FBQ0hBLENBQUNBLENBQUNBLENBQUNBO0lBQ0xBLENBQUNBO0lBQ0gzQiw4QkFBQ0E7QUFBREEsQ0FBQ0EsQUF2aEJELEVBQTZDLFdBQVcsQ0FBQyxjQUFjLEVBdWhCdEU7QUF2aEJZLCtCQUF1QiwwQkF1aEJuQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGZpbGVfc3lzdGVtID0gcmVxdWlyZSgnLi4vY29yZS9maWxlX3N5c3RlbScpO1xuaW1wb3J0IHtBcGlFcnJvciwgRXJyb3JDb2RlfSBmcm9tICcuLi9jb3JlL2FwaV9lcnJvcic7XG5pbXBvcnQge2RlZmF1bHQgYXMgU3RhdHMsIEZpbGVUeXBlfSBmcm9tICcuLi9jb3JlL25vZGVfZnNfc3RhdHMnO1xuaW1wb3J0IGZpbGUgPSByZXF1aXJlKCcuLi9jb3JlL2ZpbGUnKTtcbmltcG9ydCBmaWxlX2ZsYWcgPSByZXF1aXJlKCcuLi9jb3JlL2ZpbGVfZmxhZycpO1xuaW1wb3J0IHBhdGggPSByZXF1aXJlKCdwYXRoJyk7XG5pbXBvcnQgSW5vZGUgPSByZXF1aXJlKCcuLi9nZW5lcmljL2lub2RlJyk7XG5pbXBvcnQgcHJlbG9hZF9maWxlID0gcmVxdWlyZSgnLi4vZ2VuZXJpYy9wcmVsb2FkX2ZpbGUnKTtcbnZhciBST09UX05PREVfSUQ6IHN0cmluZyA9IFwiL1wiO1xuXG4vKipcbiAqIEdlbmVyYXRlcyBhIHJhbmRvbSBJRC5cbiAqL1xuZnVuY3Rpb24gR2VuZXJhdGVSYW5kb21JRCgpOiBzdHJpbmcge1xuICAvLyBGcm9tIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTA1MDM0L2hvdy10by1jcmVhdGUtYS1ndWlkLXV1aWQtaW4tamF2YXNjcmlwdFxuICByZXR1cm4gJ3h4eHh4eHh4LXh4eHgtNHh4eC15eHh4LXh4eHh4eHh4eHh4eCcucmVwbGFjZSgvW3h5XS9nLCBmdW5jdGlvbiAoYykge1xuICAgIHZhciByID0gTWF0aC5yYW5kb20oKSAqIDE2IHwgMCwgdiA9IGMgPT0gJ3gnID8gciA6IChyICYgMHgzIHwgMHg4KTtcbiAgICByZXR1cm4gdi50b1N0cmluZygxNik7XG4gIH0pO1xufVxuXG4vKipcbiAqIEhlbHBlciBmdW5jdGlvbi4gQ2hlY2tzIGlmICdlJyBpcyBkZWZpbmVkLiBJZiBzbywgaXQgdHJpZ2dlcnMgdGhlIGNhbGxiYWNrXG4gKiB3aXRoICdlJyBhbmQgcmV0dXJucyBmYWxzZS4gT3RoZXJ3aXNlLCByZXR1cm5zIHRydWUuXG4gKi9cbmZ1bmN0aW9uIG5vRXJyb3IoZTogQXBpRXJyb3IsIGNiOiAoZTogQXBpRXJyb3IpID0+IHZvaWQpOiBib29sZWFuIHtcbiAgaWYgKGUpIHtcbiAgICBjYihlKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uLiBDaGVja3MgaWYgJ2UnIGlzIGRlZmluZWQuIElmIHNvLCBpdCBhYm9ydHMgdGhlIHRyYW5zYWN0aW9uLFxuICogdHJpZ2dlcnMgdGhlIGNhbGxiYWNrIHdpdGggJ2UnLCBhbmQgcmV0dXJucyBmYWxzZS4gT3RoZXJ3aXNlLCByZXR1cm5zIHRydWUuXG4gKi9cbmZ1bmN0aW9uIG5vRXJyb3JUeChlOiBBcGlFcnJvciwgdHg6IEFzeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uLCBjYjogKGU6IEFwaUVycm9yKSA9PiB2b2lkKTogYm9vbGVhbiB7XG4gIGlmIChlKSB7XG4gICAgdHguYWJvcnQoKCkgPT4ge1xuICAgICAgY2IoZSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYSAqc3luY2hyb25vdXMqIGtleS12YWx1ZSBzdG9yZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTeW5jS2V5VmFsdWVTdG9yZSB7XG4gIC8qKlxuICAgKiBUaGUgbmFtZSBvZiB0aGUga2V5LXZhbHVlIHN0b3JlLlxuICAgKi9cbiAgbmFtZSgpOiBzdHJpbmc7XG4gIC8qKlxuICAgKiBFbXB0aWVzIHRoZSBrZXktdmFsdWUgc3RvcmUgY29tcGxldGVseS5cbiAgICovXG4gIGNsZWFyKCk6IHZvaWQ7XG4gIC8qKlxuICAgKiBCZWdpbnMgYSBuZXcgcmVhZC1vbmx5IHRyYW5zYWN0aW9uLlxuICAgKi9cbiAgYmVnaW5UcmFuc2FjdGlvbih0eXBlOiBcInJlYWRvbmx5XCIpOiBTeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uO1xuICAvKipcbiAgICogQmVnaW5zIGEgbmV3IHJlYWQtd3JpdGUgdHJhbnNhY3Rpb24uXG4gICAqL1xuICBiZWdpblRyYW5zYWN0aW9uKHR5cGU6IFwicmVhZHdyaXRlXCIpOiBTeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uO1xuICBiZWdpblRyYW5zYWN0aW9uKHR5cGU6IHN0cmluZyk6IFN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb247XG59XG5cbi8qKlxuICogQSByZWFkLW9ubHkgdHJhbnNhY3Rpb24gZm9yIGEgc3luY2hyb25vdXMga2V5IHZhbHVlIHN0b3JlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb24ge1xuICAvKipcbiAgICogUmV0cmlldmVzIHRoZSBkYXRhIGF0IHRoZSBnaXZlbiBrZXkuIFRocm93cyBhbiBBcGlFcnJvciBpZiBhbiBlcnJvciBvY2N1cnNcbiAgICogb3IgaWYgdGhlIGtleSBkb2VzIG5vdCBleGlzdC5cbiAgICogQHBhcmFtIGtleSBUaGUga2V5IHRvIGxvb2sgdW5kZXIgZm9yIGRhdGEuXG4gICAqIEByZXR1cm4gVGhlIGRhdGEgc3RvcmVkIHVuZGVyIHRoZSBrZXksIG9yIHVuZGVmaW5lZCBpZiBub3QgcHJlc2VudC5cbiAgICovXG4gIGdldChrZXk6IHN0cmluZyk6IE5vZGVCdWZmZXI7XG59XG5cbi8qKlxuICogQSByZWFkLXdyaXRlIHRyYW5zYWN0aW9uIGZvciBhIHN5bmNocm9ub3VzIGtleSB2YWx1ZSBzdG9yZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uIGV4dGVuZHMgU3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbiB7XG4gIC8qKlxuICAgKiBBZGRzIHRoZSBkYXRhIHRvIHRoZSBzdG9yZSB1bmRlciB0aGUgZ2l2ZW4ga2V5LlxuICAgKiBAcGFyYW0ga2V5IFRoZSBrZXkgdG8gYWRkIHRoZSBkYXRhIHVuZGVyLlxuICAgKiBAcGFyYW0gZGF0YSBUaGUgZGF0YSB0byBhZGQgdG8gdGhlIHN0b3JlLlxuICAgKiBAcGFyYW0gb3ZlcndyaXRlIElmICd0cnVlJywgb3ZlcndyaXRlIGFueSBleGlzdGluZyBkYXRhLiBJZiAnZmFsc2UnLFxuICAgKiAgIGF2b2lkcyBzdG9yaW5nIHRoZSBkYXRhIGlmIHRoZSBrZXkgZXhpc3RzLlxuICAgKiBAcmV0dXJuIFRydWUgaWYgc3RvcmFnZSBzdWNjZWVkZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAgICovXG4gIHB1dChrZXk6IHN0cmluZywgZGF0YTogTm9kZUJ1ZmZlciwgb3ZlcndyaXRlOiBib29sZWFuKTogYm9vbGVhbjtcbiAgLyoqXG4gICAqIERlbGV0ZXMgdGhlIGRhdGEgYXQgdGhlIGdpdmVuIGtleS5cbiAgICogQHBhcmFtIGtleSBUaGUga2V5IHRvIGRlbGV0ZSBmcm9tIHRoZSBzdG9yZS5cbiAgICovXG4gIGRlbChrZXk6IHN0cmluZyk6IHZvaWQ7XG4gIC8qKlxuICAgKiBDb21taXRzIHRoZSB0cmFuc2FjdGlvbi5cbiAgICovXG4gIGNvbW1pdCgpOiB2b2lkO1xuICAvKipcbiAgICogQWJvcnRzIGFuZCByb2xscyBiYWNrIHRoZSB0cmFuc2FjdGlvbi5cbiAgICovXG4gIGFib3J0KCk6IHZvaWQ7XG59XG5cbi8qKlxuICogQW4gaW50ZXJmYWNlIGZvciBzaW1wbGUgc3luY2hyb25vdXMga2V5LXZhbHVlIHN0b3JlcyB0aGF0IGRvbid0IGhhdmUgc3BlY2lhbFxuICogc3VwcG9ydCBmb3IgdHJhbnNhY3Rpb25zIGFuZCBzdWNoLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFNpbXBsZVN5bmNTdG9yZSB7XG4gIGdldChrZXk6IHN0cmluZyk6IE5vZGVCdWZmZXI7XG4gIHB1dChrZXk6IHN0cmluZywgZGF0YTogTm9kZUJ1ZmZlciwgb3ZlcndyaXRlOiBib29sZWFuKTogYm9vbGVhbjtcbiAgZGVsKGtleTogc3RyaW5nKTogdm9pZDtcbn1cblxuLyoqXG4gKiBBIHNpbXBsZSBSVyB0cmFuc2FjdGlvbiBmb3Igc2ltcGxlIHN5bmNocm9ub3VzIGtleS12YWx1ZSBzdG9yZXMuXG4gKi9cbmV4cG9ydCBjbGFzcyBTaW1wbGVTeW5jUldUcmFuc2FjdGlvbiBpbXBsZW1lbnRzIFN5bmNLZXlWYWx1ZVJXVHJhbnNhY3Rpb24ge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHN0b3JlOiBTaW1wbGVTeW5jU3RvcmUpIHsgfVxuICAvKipcbiAgICogU3RvcmVzIGRhdGEgaW4gdGhlIGtleXMgd2UgbW9kaWZ5IHByaW9yIHRvIG1vZGlmeWluZyB0aGVtLlxuICAgKiBBbGxvd3MgdXMgdG8gcm9sbCBiYWNrIGNvbW1pdHMuXG4gICAqL1xuICBwcml2YXRlIG9yaWdpbmFsRGF0YTogeyBba2V5OiBzdHJpbmddOiBOb2RlQnVmZmVyIH0gPSB7fTtcbiAgLyoqXG4gICAqIExpc3Qgb2Yga2V5cyBtb2RpZmllZCBpbiB0aGlzIHRyYW5zYWN0aW9uLCBpZiBhbnkuXG4gICAqL1xuICBwcml2YXRlIG1vZGlmaWVkS2V5czogc3RyaW5nW10gPSBbXTtcbiAgLyoqXG4gICAqIFN0YXNoZXMgZ2l2ZW4ga2V5IHZhbHVlIHBhaXIgaW50byBgb3JpZ2luYWxEYXRhYCBpZiBpdCBkb2Vzbid0IGFscmVhZHlcbiAgICogZXhpc3QuIEFsbG93cyB1cyB0byBzdGFzaCB2YWx1ZXMgdGhlIHByb2dyYW0gaXMgcmVxdWVzdGluZyBhbnl3YXkgdG9cbiAgICogcHJldmVudCBuZWVkbGVzcyBgZ2V0YCByZXF1ZXN0cyBpZiB0aGUgcHJvZ3JhbSBtb2RpZmllcyB0aGUgZGF0YSBsYXRlclxuICAgKiBvbiBkdXJpbmcgdGhlIHRyYW5zYWN0aW9uLlxuICAgKi9cbiAgcHJpdmF0ZSBzdGFzaE9sZFZhbHVlKGtleTogc3RyaW5nLCB2YWx1ZTogTm9kZUJ1ZmZlcikge1xuICAgIC8vIEtlZXAgb25seSB0aGUgZWFybGllc3QgdmFsdWUgaW4gdGhlIHRyYW5zYWN0aW9uLlxuICAgIGlmICghdGhpcy5vcmlnaW5hbERhdGEuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgdGhpcy5vcmlnaW5hbERhdGFba2V5XSA9IHZhbHVlXG4gICAgfVxuICB9XG4gIC8qKlxuICAgKiBNYXJrcyB0aGUgZ2l2ZW4ga2V5IGFzIG1vZGlmaWVkLCBhbmQgc3Rhc2hlcyBpdHMgdmFsdWUgaWYgaXQgaGFzIG5vdCBiZWVuXG4gICAqIHN0YXNoZWQgYWxyZWFkeS5cbiAgICovXG4gIHByaXZhdGUgbWFya01vZGlmaWVkKGtleTogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMubW9kaWZpZWRLZXlzLmluZGV4T2Yoa2V5KSA9PT0gLTEpIHtcbiAgICAgIHRoaXMubW9kaWZpZWRLZXlzLnB1c2goa2V5KTtcbiAgICAgIGlmICghdGhpcy5vcmlnaW5hbERhdGEuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICB0aGlzLm9yaWdpbmFsRGF0YVtrZXldID0gdGhpcy5zdG9yZS5nZXQoa2V5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwdWJsaWMgZ2V0KGtleTogc3RyaW5nKTogTm9kZUJ1ZmZlciB7XG4gICAgdmFyIHZhbCA9IHRoaXMuc3RvcmUuZ2V0KGtleSk7XG4gICAgdGhpcy5zdGFzaE9sZFZhbHVlKGtleSwgdmFsKTtcbiAgICByZXR1cm4gdmFsO1xuICB9XG5cbiAgcHVibGljIHB1dChrZXk6IHN0cmluZywgZGF0YTogTm9kZUJ1ZmZlciwgb3ZlcndyaXRlOiBib29sZWFuKTogYm9vbGVhbiB7XG4gICAgdGhpcy5tYXJrTW9kaWZpZWQoa2V5KTtcbiAgICByZXR1cm4gdGhpcy5zdG9yZS5wdXQoa2V5LCBkYXRhLCBvdmVyd3JpdGUpO1xuICB9XG5cbiAgcHVibGljIGRlbChrZXk6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMubWFya01vZGlmaWVkKGtleSk7XG4gICAgdGhpcy5zdG9yZS5kZWwoa2V5KTtcbiAgfVxuXG4gIHB1YmxpYyBjb21taXQoKTogdm9pZCB7LyogTk9QICovfVxuICBwdWJsaWMgYWJvcnQoKTogdm9pZCB7XG4gICAgLy8gUm9sbGJhY2sgb2xkIHZhbHVlcy5cbiAgICB2YXIgaTogbnVtYmVyLCBrZXk6IHN0cmluZywgdmFsdWU6IE5vZGVCdWZmZXI7XG4gICAgZm9yIChpID0gMDsgaSA8IHRoaXMubW9kaWZpZWRLZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBrZXkgPSB0aGlzLm1vZGlmaWVkS2V5c1tpXTtcbiAgICAgIHZhbHVlID0gdGhpcy5vcmlnaW5hbERhdGFba2V5XTtcbiAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICAvLyBLZXkgZGlkbid0IGV4aXN0LlxuICAgICAgICB0aGlzLnN0b3JlLmRlbChrZXkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gS2V5IGV4aXN0ZWQuIFN0b3JlIG9sZCB2YWx1ZS5cbiAgICAgICAgdGhpcy5zdG9yZS5wdXQoa2V5LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3luY0tleVZhbHVlRmlsZVN5c3RlbU9wdGlvbnMge1xuICAvKipcbiAgICogVGhlIGFjdHVhbCBrZXktdmFsdWUgc3RvcmUgdG8gcmVhZCBmcm9tL3dyaXRlIHRvLlxuICAgKi9cbiAgc3RvcmU6IFN5bmNLZXlWYWx1ZVN0b3JlO1xuICAvKipcbiAgICogU2hvdWxkIHRoZSBmaWxlIHN5c3RlbSBzdXBwb3J0IHByb3BlcnRpZXMgKG10aW1lL2F0aW1lL2N0aW1lL2NobW9kL2V0Yyk/XG4gICAqIEVuYWJsaW5nIHRoaXMgc2xpZ2h0bHkgaW5jcmVhc2VzIHRoZSBzdG9yYWdlIHNwYWNlIHBlciBmaWxlLCBhbmQgYWRkc1xuICAgKiBhdGltZSB1cGRhdGVzIGV2ZXJ5IHRpbWUgYSBmaWxlIGlzIGFjY2Vzc2VkLCBtdGltZSB1cGRhdGVzIGV2ZXJ5IHRpbWVcbiAgICogYSBmaWxlIGlzIG1vZGlmaWVkLCBhbmQgcGVybWlzc2lvbiBjaGVja3Mgb24gZXZlcnkgb3BlcmF0aW9uLlxuICAgKlxuICAgKiBEZWZhdWx0cyB0byAqZmFsc2UqLlxuICAgKi9cbiAgLy9zdXBwb3J0UHJvcHM/OiBib29sZWFuO1xuICAvKipcbiAgICogU2hvdWxkIHRoZSBmaWxlIHN5c3RlbSBzdXBwb3J0IGxpbmtzP1xuICAgKi9cbiAgLy9zdXBwb3J0TGlua3M/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgU3luY0tleVZhbHVlRmlsZSBleHRlbmRzIHByZWxvYWRfZmlsZS5QcmVsb2FkRmlsZTxTeW5jS2V5VmFsdWVGaWxlU3lzdGVtPiBpbXBsZW1lbnRzIGZpbGUuRmlsZSB7XG4gIGNvbnN0cnVjdG9yKF9mczogU3luY0tleVZhbHVlRmlsZVN5c3RlbSwgX3BhdGg6IHN0cmluZywgX2ZsYWc6IGZpbGVfZmxhZy5GaWxlRmxhZywgX3N0YXQ6IFN0YXRzLCBjb250ZW50cz86IE5vZGVCdWZmZXIpIHtcbiAgICBzdXBlcihfZnMsIF9wYXRoLCBfZmxhZywgX3N0YXQsIGNvbnRlbnRzKTtcbiAgfVxuXG4gIHB1YmxpYyBzeW5jU3luYygpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5pc0RpcnR5KCkpIHtcbiAgICAgIHRoaXMuX2ZzLl9zeW5jU3luYyh0aGlzLmdldFBhdGgoKSwgdGhpcy5nZXRCdWZmZXIoKSwgdGhpcy5nZXRTdGF0cygpKTtcbiAgICAgIHRoaXMucmVzZXREaXJ0eSgpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBjbG9zZVN5bmMoKTogdm9pZCB7XG4gICAgdGhpcy5zeW5jU3luYygpO1xuICB9XG59XG5cbi8qKlxuICogQSBcIlN5bmNocm9ub3VzIGtleS12YWx1ZSBmaWxlIHN5c3RlbVwiLiBTdG9yZXMgZGF0YSB0by9yZXRyaWV2ZXMgZGF0YSBmcm9tIGFuXG4gKiB1bmRlcmx5aW5nIGtleS12YWx1ZSBzdG9yZS5cbiAqXG4gKiBXZSB1c2UgYSB1bmlxdWUgSUQgZm9yIGVhY2ggbm9kZSBpbiB0aGUgZmlsZSBzeXN0ZW0uIFRoZSByb290IG5vZGUgaGFzIGFcbiAqIGZpeGVkIElELlxuICogQHRvZG8gSW50cm9kdWNlIE5vZGUgSUQgY2FjaGluZy5cbiAqIEB0b2RvIENoZWNrIG1vZGVzLlxuICovXG5leHBvcnQgY2xhc3MgU3luY0tleVZhbHVlRmlsZVN5c3RlbSBleHRlbmRzIGZpbGVfc3lzdGVtLlN5bmNocm9ub3VzRmlsZVN5c3RlbSB7XG4gIHByaXZhdGUgc3RvcmU6IFN5bmNLZXlWYWx1ZVN0b3JlO1xuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBTeW5jS2V5VmFsdWVGaWxlU3lzdGVtT3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5zdG9yZSA9IG9wdGlvbnMuc3RvcmU7XG4gICAgLy8gSU5WQVJJQU5UOiBFbnN1cmUgdGhhdCB0aGUgcm9vdCBleGlzdHMuXG4gICAgdGhpcy5tYWtlUm9vdERpcmVjdG9yeSgpO1xuICB9XG5cbiAgcHVibGljIHN0YXRpYyBpc0F2YWlsYWJsZSgpOiBib29sZWFuIHsgcmV0dXJuIHRydWU7IH1cbiAgcHVibGljIGdldE5hbWUoKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuc3RvcmUubmFtZSgpOyB9XG4gIHB1YmxpYyBpc1JlYWRPbmx5KCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cbiAgcHVibGljIHN1cHBvcnRzU3ltbGlua3MoKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuICBwdWJsaWMgc3VwcG9ydHNQcm9wcygpOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlOyB9XG4gIHB1YmxpYyBzdXBwb3J0c1N5bmNoKCk6IGJvb2xlYW4geyByZXR1cm4gdHJ1ZTsgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgdGhlIHJvb3QgZGlyZWN0b3J5IGV4aXN0cy4gQ3JlYXRlcyBpdCBpZiBpdCBkb2Vzbid0LlxuICAgKi9cbiAgcHJpdmF0ZSBtYWtlUm9vdERpcmVjdG9yeSgpIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpO1xuICAgIGlmICh0eC5nZXQoUk9PVF9OT0RFX0lEKSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBDcmVhdGUgbmV3IGlub2RlLlxuICAgICAgdmFyIGN1cnJUaW1lID0gKG5ldyBEYXRlKCkpLmdldFRpbWUoKSxcbiAgICAgICAgLy8gTW9kZSAwNjY2XG4gICAgICAgIGRpcklub2RlID0gbmV3IElub2RlKEdlbmVyYXRlUmFuZG9tSUQoKSwgNDA5NiwgNTExIHwgRmlsZVR5cGUuRElSRUNUT1JZLCBjdXJyVGltZSwgY3VyclRpbWUsIGN1cnJUaW1lKTtcbiAgICAgIC8vIElmIHRoZSByb290IGRvZXNuJ3QgZXhpc3QsIHRoZSBmaXJzdCByYW5kb20gSUQgc2hvdWxkbid0IGV4aXN0LFxuICAgICAgLy8gZWl0aGVyLlxuICAgICAgdHgucHV0KGRpcklub2RlLmlkLCBuZXcgQnVmZmVyKFwie31cIiksIGZhbHNlKTtcbiAgICAgIHR4LnB1dChST09UX05PREVfSUQsIGRpcklub2RlLnRvQnVmZmVyKCksIGZhbHNlKTtcbiAgICAgIHR4LmNvbW1pdCgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBIZWxwZXIgZnVuY3Rpb24gZm9yIGZpbmRJTm9kZS5cbiAgICogQHBhcmFtIHBhcmVudCBUaGUgcGFyZW50IGRpcmVjdG9yeSBvZiB0aGUgZmlsZSB3ZSBhcmUgYXR0ZW1wdGluZyB0byBmaW5kLlxuICAgKiBAcGFyYW0gZmlsZW5hbWUgVGhlIGZpbGVuYW1lIG9mIHRoZSBpbm9kZSB3ZSBhcmUgYXR0ZW1wdGluZyB0byBmaW5kLCBtaW51c1xuICAgKiAgIHRoZSBwYXJlbnQuXG4gICAqIEByZXR1cm4gc3RyaW5nIFRoZSBJRCBvZiB0aGUgZmlsZSdzIGlub2RlIGluIHRoZSBmaWxlIHN5c3RlbS5cbiAgICovXG4gIHByaXZhdGUgX2ZpbmRJTm9kZSh0eDogU3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbiwgcGFyZW50OiBzdHJpbmcsIGZpbGVuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHZhciByZWFkX2RpcmVjdG9yeSA9IChpbm9kZTogSW5vZGUpOiBzdHJpbmcgPT4ge1xuICAgICAgLy8gR2V0IHRoZSByb290J3MgZGlyZWN0b3J5IGxpc3RpbmcuXG4gICAgICB2YXIgZGlyTGlzdCA9IHRoaXMuZ2V0RGlyTGlzdGluZyh0eCwgcGFyZW50LCBpbm9kZSk7XG4gICAgICAvLyBHZXQgdGhlIGZpbGUncyBJRC5cbiAgICAgIGlmIChkaXJMaXN0W2ZpbGVuYW1lXSkge1xuICAgICAgICByZXR1cm4gZGlyTGlzdFtmaWxlbmFtZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBBcGlFcnJvci5FTk9FTlQocGF0aC5yZXNvbHZlKHBhcmVudCwgZmlsZW5hbWUpKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGlmIChwYXJlbnQgPT09ICcvJykge1xuICAgICAgaWYgKGZpbGVuYW1lID09PSAnJykge1xuICAgICAgICAvLyBCQVNFIENBU0UgIzE6IFJldHVybiB0aGUgcm9vdCdzIElELlxuICAgICAgICByZXR1cm4gUk9PVF9OT0RFX0lEO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQkFTRSBDQVNFICMyOiBGaW5kIHRoZSBpdGVtIGluIHRoZSByb290IG5kb2UuXG4gICAgICAgIHJldHVybiByZWFkX2RpcmVjdG9yeSh0aGlzLmdldElOb2RlKHR4LCBwYXJlbnQsIFJPT1RfTk9ERV9JRCkpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmVhZF9kaXJlY3RvcnkodGhpcy5nZXRJTm9kZSh0eCwgcGFyZW50ICsgcGF0aC5zZXAgKyBmaWxlbmFtZSxcbiAgICAgICAgdGhpcy5fZmluZElOb2RlKHR4LCBwYXRoLmRpcm5hbWUocGFyZW50KSwgcGF0aC5iYXNlbmFtZShwYXJlbnQpKSkpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kcyB0aGUgSW5vZGUgb2YgdGhlIGdpdmVuIHBhdGguXG4gICAqIEBwYXJhbSBwIFRoZSBwYXRoIHRvIGxvb2sgdXAuXG4gICAqIEByZXR1cm4gVGhlIElub2RlIG9mIHRoZSBwYXRoIHAuXG4gICAqIEB0b2RvIG1lbW9pemUvY2FjaGVcbiAgICovXG4gIHByaXZhdGUgZmluZElOb2RlKHR4OiBTeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uLCBwOiBzdHJpbmcpOiBJbm9kZSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0SU5vZGUodHgsIHAsIHRoaXMuX2ZpbmRJTm9kZSh0eCwgcGF0aC5kaXJuYW1lKHApLCBwYXRoLmJhc2VuYW1lKHApKSk7XG4gIH1cblxuICAvKipcbiAgICogR2l2ZW4gdGhlIElEIG9mIGEgbm9kZSwgcmV0cmlldmVzIHRoZSBjb3JyZXNwb25kaW5nIElub2RlLlxuICAgKiBAcGFyYW0gdHggVGhlIHRyYW5zYWN0aW9uIHRvIHVzZS5cbiAgICogQHBhcmFtIHAgVGhlIGNvcnJlc3BvbmRpbmcgcGF0aCB0byB0aGUgZmlsZSAodXNlZCBmb3IgZXJyb3IgbWVzc2FnZXMpLlxuICAgKiBAcGFyYW0gaWQgVGhlIElEIHRvIGxvb2sgdXAuXG4gICAqL1xuICBwcml2YXRlIGdldElOb2RlKHR4OiBTeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uLCBwOiBzdHJpbmcsIGlkOiBzdHJpbmcpOiBJbm9kZSB7XG4gICAgdmFyIGlub2RlID0gdHguZ2V0KGlkKTtcbiAgICBpZiAoaW5vZGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRU5PRU5UKHApO1xuICAgIH1cbiAgICByZXR1cm4gSW5vZGUuZnJvbUJ1ZmZlcihpbm9kZSk7XG4gIH1cblxuICAvKipcbiAgICogR2l2ZW4gdGhlIElub2RlIG9mIGEgZGlyZWN0b3J5LCByZXRyaWV2ZXMgdGhlIGNvcnJlc3BvbmRpbmcgZGlyZWN0b3J5XG4gICAqIGxpc3RpbmcuXG4gICAqL1xuICBwcml2YXRlIGdldERpckxpc3RpbmcodHg6IFN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb24sIHA6IHN0cmluZywgaW5vZGU6IElub2RlKTogeyBbZmlsZU5hbWU6IHN0cmluZ106IHN0cmluZyB9IHtcbiAgICBpZiAoIWlub2RlLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVOT1RESVIocCk7XG4gICAgfVxuICAgIHZhciBkYXRhID0gdHguZ2V0KGlub2RlLmlkKTtcbiAgICBpZiAoZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBBcGlFcnJvci5FTk9FTlQocCk7XG4gICAgfVxuICAgIHJldHVybiBKU09OLnBhcnNlKGRhdGEudG9TdHJpbmcoKSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBub2RlIHVuZGVyIGEgcmFuZG9tIElELiBSZXRyaWVzIDUgdGltZXMgYmVmb3JlIGdpdmluZyB1cCBpblxuICAgKiB0aGUgZXhjZWVkaW5nbHkgdW5saWtlbHkgY2hhbmNlIHRoYXQgd2UgdHJ5IHRvIHJldXNlIGEgcmFuZG9tIEdVSUQuXG4gICAqIEByZXR1cm4gVGhlIEdVSUQgdGhhdCB0aGUgZGF0YSB3YXMgc3RvcmVkIHVuZGVyLlxuICAgKi9cbiAgcHJpdmF0ZSBhZGROZXdOb2RlKHR4OiBTeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uLCBkYXRhOiBOb2RlQnVmZmVyKTogc3RyaW5nIHtcbiAgICB2YXIgcmV0cmllcyA9IDAsIGN1cnJJZDogc3RyaW5nO1xuICAgIHdoaWxlIChyZXRyaWVzIDwgNSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY3VycklkID0gR2VuZXJhdGVSYW5kb21JRCgpO1xuICAgICAgICB0eC5wdXQoY3VycklkLCBkYXRhLCBmYWxzZSk7XG4gICAgICAgIHJldHVybiBjdXJySWQ7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIElnbm9yZSBhbmQgcmVyb2xsLlxuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTywgJ1VuYWJsZSB0byBjb21taXQgZGF0YSB0byBrZXktdmFsdWUgc3RvcmUuJyk7XG4gIH1cblxuICAvKipcbiAgICogQ29tbWl0cyBhIG5ldyBmaWxlICh3ZWxsLCBhIEZJTEUgb3IgYSBESVJFQ1RPUlkpIHRvIHRoZSBmaWxlIHN5c3RlbSB3aXRoXG4gICAqIHRoZSBnaXZlbiBtb2RlLlxuICAgKiBOb3RlOiBUaGlzIHdpbGwgY29tbWl0IHRoZSB0cmFuc2FjdGlvbi5cbiAgICogQHBhcmFtIHAgVGhlIHBhdGggdG8gdGhlIG5ldyBmaWxlLlxuICAgKiBAcGFyYW0gdHlwZSBUaGUgdHlwZSBvZiB0aGUgbmV3IGZpbGUuXG4gICAqIEBwYXJhbSBtb2RlIFRoZSBtb2RlIHRvIGNyZWF0ZSB0aGUgbmV3IGZpbGUgd2l0aC5cbiAgICogQHBhcmFtIGRhdGEgVGhlIGRhdGEgdG8gc3RvcmUgYXQgdGhlIGZpbGUncyBkYXRhIG5vZGUuXG4gICAqIEByZXR1cm4gVGhlIElub2RlIGZvciB0aGUgbmV3IGZpbGUuXG4gICAqL1xuICBwcml2YXRlIGNvbW1pdE5ld0ZpbGUodHg6IFN5bmNLZXlWYWx1ZVJXVHJhbnNhY3Rpb24sIHA6IHN0cmluZywgdHlwZTogRmlsZVR5cGUsIG1vZGU6IG51bWJlciwgZGF0YTogTm9kZUJ1ZmZlcik6IElub2RlIHtcbiAgICB2YXIgcGFyZW50RGlyID0gcGF0aC5kaXJuYW1lKHApLFxuICAgICAgZm5hbWUgPSBwYXRoLmJhc2VuYW1lKHApLFxuICAgICAgcGFyZW50Tm9kZSA9IHRoaXMuZmluZElOb2RlKHR4LCBwYXJlbnREaXIpLFxuICAgICAgZGlyTGlzdGluZyA9IHRoaXMuZ2V0RGlyTGlzdGluZyh0eCwgcGFyZW50RGlyLCBwYXJlbnROb2RlKSxcbiAgICAgIGN1cnJUaW1lID0gKG5ldyBEYXRlKCkpLmdldFRpbWUoKTtcblxuICAgIC8vIEludmFyaWFudDogVGhlIHJvb3QgYWx3YXlzIGV4aXN0cy5cbiAgICAvLyBJZiB3ZSBkb24ndCBjaGVjayB0aGlzIHByaW9yIHRvIHRha2luZyBzdGVwcyBiZWxvdywgd2Ugd2lsbCBjcmVhdGUgYVxuICAgIC8vIGZpbGUgd2l0aCBuYW1lICcnIGluIHJvb3Qgc2hvdWxkIHAgPT0gJy8nLlxuICAgIGlmIChwID09PSAnLycpIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVFWElTVChwKTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBpZiBmaWxlIGFscmVhZHkgZXhpc3RzLlxuICAgIGlmIChkaXJMaXN0aW5nW2ZuYW1lXSkge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRUVYSVNUKHApO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAvLyBDb21taXQgZGF0YS5cbiAgICAgIHZhciBkYXRhSWQgPSB0aGlzLmFkZE5ld05vZGUodHgsIGRhdGEpLFxuICAgICAgICBmaWxlTm9kZSA9IG5ldyBJbm9kZShkYXRhSWQsIGRhdGEubGVuZ3RoLCBtb2RlIHwgdHlwZSwgY3VyclRpbWUsIGN1cnJUaW1lLCBjdXJyVGltZSksXG4gICAgICAgIC8vIENvbW1pdCBmaWxlIG5vZGUuXG4gICAgICAgIGZpbGVOb2RlSWQgPSB0aGlzLmFkZE5ld05vZGUodHgsIGZpbGVOb2RlLnRvQnVmZmVyKCkpO1xuICAgICAgLy8gVXBkYXRlIGFuZCBjb21taXQgcGFyZW50IGRpcmVjdG9yeSBsaXN0aW5nLlxuICAgICAgZGlyTGlzdGluZ1tmbmFtZV0gPSBmaWxlTm9kZUlkO1xuICAgICAgdHgucHV0KHBhcmVudE5vZGUuaWQsIG5ldyBCdWZmZXIoSlNPTi5zdHJpbmdpZnkoZGlyTGlzdGluZykpLCB0cnVlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0eC5hYm9ydCgpO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gICAgdHguY29tbWl0KCk7XG4gICAgcmV0dXJuIGZpbGVOb2RlO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSBhbGwgY29udGVudHMgc3RvcmVkIGluIHRoZSBmaWxlIHN5c3RlbS5cbiAgICovXG4gIHB1YmxpYyBlbXB0eSgpOiB2b2lkIHtcbiAgICB0aGlzLnN0b3JlLmNsZWFyKCk7XG4gICAgLy8gSU5WQVJJQU5UOiBSb290IGFsd2F5cyBleGlzdHMuXG4gICAgdGhpcy5tYWtlUm9vdERpcmVjdG9yeSgpO1xuICB9XG5cbiAgcHVibGljIHJlbmFtZVN5bmMob2xkUGF0aDogc3RyaW5nLCBuZXdQYXRoOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpLFxuICAgICAgb2xkUGFyZW50ID0gcGF0aC5kaXJuYW1lKG9sZFBhdGgpLCBvbGROYW1lID0gcGF0aC5iYXNlbmFtZShvbGRQYXRoKSxcbiAgICAgIG5ld1BhcmVudCA9IHBhdGguZGlybmFtZShuZXdQYXRoKSwgbmV3TmFtZSA9IHBhdGguYmFzZW5hbWUobmV3UGF0aCksXG4gICAgICAvLyBSZW1vdmUgb2xkUGF0aCBmcm9tIHBhcmVudCdzIGRpcmVjdG9yeSBsaXN0aW5nLlxuICAgICAgb2xkRGlyTm9kZSA9IHRoaXMuZmluZElOb2RlKHR4LCBvbGRQYXJlbnQpLFxuICAgICAgb2xkRGlyTGlzdCA9IHRoaXMuZ2V0RGlyTGlzdGluZyh0eCwgb2xkUGFyZW50LCBvbGREaXJOb2RlKTtcblxuICAgIGlmICghb2xkRGlyTGlzdFtvbGROYW1lXSkge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRU5PRU5UKG9sZFBhdGgpO1xuICAgIH1cbiAgICB2YXIgbm9kZUlkOiBzdHJpbmcgPSBvbGREaXJMaXN0W29sZE5hbWVdO1xuICAgIGRlbGV0ZSBvbGREaXJMaXN0W29sZE5hbWVdO1xuXG4gICAgLy8gSW52YXJpYW50OiBDYW4ndCBtb3ZlIGEgZm9sZGVyIGluc2lkZSBpdHNlbGYuXG4gICAgLy8gVGhpcyBmdW5ueSBsaXR0bGUgaGFjayBlbnN1cmVzIHRoYXQgdGhlIGNoZWNrIHBhc3NlcyBvbmx5IGlmIG9sZFBhdGhcbiAgICAvLyBpcyBhIHN1YnBhdGggb2YgbmV3UGFyZW50LiBXZSBhcHBlbmQgJy8nIHRvIGF2b2lkIG1hdGNoaW5nIGZvbGRlcnMgdGhhdFxuICAgIC8vIGFyZSBhIHN1YnN0cmluZyBvZiB0aGUgYm90dG9tLW1vc3QgZm9sZGVyIGluIHRoZSBwYXRoLlxuICAgIGlmICgobmV3UGFyZW50ICsgJy8nKS5pbmRleE9mKG9sZFBhdGggKyAnLycpID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVCVVNZLCBvbGRQYXJlbnQpO1xuICAgIH1cblxuICAgIC8vIEFkZCBuZXdQYXRoIHRvIHBhcmVudCdzIGRpcmVjdG9yeSBsaXN0aW5nLlxuICAgIHZhciBuZXdEaXJOb2RlOiBJbm9kZSwgbmV3RGlyTGlzdDogdHlwZW9mIG9sZERpckxpc3Q7XG4gICAgaWYgKG5ld1BhcmVudCA9PT0gb2xkUGFyZW50KSB7XG4gICAgICAvLyBQcmV2ZW50IHVzIGZyb20gcmUtZ3JhYmJpbmcgdGhlIHNhbWUgZGlyZWN0b3J5IGxpc3RpbmcsIHdoaWNoIHN0aWxsXG4gICAgICAvLyBjb250YWlucyBvbGROYW1lLlxuICAgICAgbmV3RGlyTm9kZSA9IG9sZERpck5vZGU7XG4gICAgICBuZXdEaXJMaXN0ID0gb2xkRGlyTGlzdDtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV3RGlyTm9kZSA9IHRoaXMuZmluZElOb2RlKHR4LCBuZXdQYXJlbnQpO1xuICAgICAgbmV3RGlyTGlzdCA9IHRoaXMuZ2V0RGlyTGlzdGluZyh0eCwgbmV3UGFyZW50LCBuZXdEaXJOb2RlKTtcbiAgICB9XG5cbiAgICBpZiAobmV3RGlyTGlzdFtuZXdOYW1lXSkge1xuICAgICAgLy8gSWYgaXQncyBhIGZpbGUsIGRlbGV0ZSBpdC5cbiAgICAgIHZhciBuZXdOYW1lTm9kZSA9IHRoaXMuZ2V0SU5vZGUodHgsIG5ld1BhdGgsIG5ld0Rpckxpc3RbbmV3TmFtZV0pO1xuICAgICAgaWYgKG5ld05hbWVOb2RlLmlzRmlsZSgpKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdHguZGVsKG5ld05hbWVOb2RlLmlkKTtcbiAgICAgICAgICB0eC5kZWwobmV3RGlyTGlzdFtuZXdOYW1lXSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICB0eC5hYm9ydCgpO1xuICAgICAgICAgIHRocm93IGU7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIElmIGl0J3MgYSBkaXJlY3RvcnksIHRocm93IGEgcGVybWlzc2lvbnMgZXJyb3IuXG4gICAgICAgIHRocm93IEFwaUVycm9yLkVQRVJNKG5ld1BhdGgpO1xuICAgICAgfVxuICAgIH1cbiAgICBuZXdEaXJMaXN0W25ld05hbWVdID0gbm9kZUlkO1xuXG4gICAgLy8gQ29tbWl0IHRoZSB0d28gY2hhbmdlZCBkaXJlY3RvcnkgbGlzdGluZ3MuXG4gICAgdHJ5IHtcbiAgICAgIHR4LnB1dChvbGREaXJOb2RlLmlkLCBuZXcgQnVmZmVyKEpTT04uc3RyaW5naWZ5KG9sZERpckxpc3QpKSwgdHJ1ZSk7XG4gICAgICB0eC5wdXQobmV3RGlyTm9kZS5pZCwgbmV3IEJ1ZmZlcihKU09OLnN0cmluZ2lmeShuZXdEaXJMaXN0KSksIHRydWUpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHR4LmFib3J0KCk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIHR4LmNvbW1pdCgpO1xuICB9XG5cbiAgcHVibGljIHN0YXRTeW5jKHA6IHN0cmluZywgaXNMc3RhdDogYm9vbGVhbik6IFN0YXRzIHtcbiAgICAvLyBHZXQgdGhlIGlub2RlIHRvIHRoZSBpdGVtLCBjb252ZXJ0IGl0IGludG8gYSBTdGF0cyBvYmplY3QuXG4gICAgcmV0dXJuIHRoaXMuZmluZElOb2RlKHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZG9ubHknKSwgcCkudG9TdGF0cygpO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZUZpbGVTeW5jKHA6IHN0cmluZywgZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnLCBtb2RlOiBudW1iZXIpOiBmaWxlLkZpbGUge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZHdyaXRlJyksXG4gICAgICBkYXRhID0gbmV3IEJ1ZmZlcigwKSxcbiAgICAgIG5ld0ZpbGUgPSB0aGlzLmNvbW1pdE5ld0ZpbGUodHgsIHAsIEZpbGVUeXBlLkZJTEUsIG1vZGUsIGRhdGEpO1xuICAgIC8vIE9wZW4gdGhlIGZpbGUuXG4gICAgcmV0dXJuIG5ldyBTeW5jS2V5VmFsdWVGaWxlKHRoaXMsIHAsIGZsYWcsIG5ld0ZpbGUudG9TdGF0cygpLCBkYXRhKTtcbiAgfVxuXG4gIHB1YmxpYyBvcGVuRmlsZVN5bmMocDogc3RyaW5nLCBmbGFnOiBmaWxlX2ZsYWcuRmlsZUZsYWcpOiBmaWxlLkZpbGUge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZG9ubHknKSxcbiAgICAgIG5vZGUgPSB0aGlzLmZpbmRJTm9kZSh0eCwgcCksXG4gICAgICBkYXRhID0gdHguZ2V0KG5vZGUuaWQpO1xuICAgIGlmIChkYXRhID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVOT0VOVChwKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBTeW5jS2V5VmFsdWVGaWxlKHRoaXMsIHAsIGZsYWcsIG5vZGUudG9TdGF0cygpLCBkYXRhKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIHRyYWNlcyBvZiB0aGUgZ2l2ZW4gcGF0aCBmcm9tIHRoZSBmaWxlIHN5c3RlbS5cbiAgICogQHBhcmFtIHAgVGhlIHBhdGggdG8gcmVtb3ZlIGZyb20gdGhlIGZpbGUgc3lzdGVtLlxuICAgKiBAcGFyYW0gaXNEaXIgRG9lcyB0aGUgcGF0aCBiZWxvbmcgdG8gYSBkaXJlY3RvcnksIG9yIGEgZmlsZT9cbiAgICogQHRvZG8gVXBkYXRlIG10aW1lLlxuICAgKi9cbiAgcHJpdmF0ZSByZW1vdmVFbnRyeShwOiBzdHJpbmcsIGlzRGlyOiBib29sZWFuKTogdm9pZCB7XG4gICAgdmFyIHR4ID0gdGhpcy5zdG9yZS5iZWdpblRyYW5zYWN0aW9uKCdyZWFkd3JpdGUnKSxcbiAgICAgIHBhcmVudDogc3RyaW5nID0gcGF0aC5kaXJuYW1lKHApLFxuICAgICAgcGFyZW50Tm9kZSA9IHRoaXMuZmluZElOb2RlKHR4LCBwYXJlbnQpLFxuICAgICAgcGFyZW50TGlzdGluZyA9IHRoaXMuZ2V0RGlyTGlzdGluZyh0eCwgcGFyZW50LCBwYXJlbnROb2RlKSxcbiAgICAgIGZpbGVOYW1lOiBzdHJpbmcgPSBwYXRoLmJhc2VuYW1lKHApO1xuXG4gICAgaWYgKCFwYXJlbnRMaXN0aW5nW2ZpbGVOYW1lXSkge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRU5PRU5UKHApO1xuICAgIH1cblxuICAgIC8vIFJlbW92ZSBmcm9tIGRpcmVjdG9yeSBsaXN0aW5nIG9mIHBhcmVudC5cbiAgICB2YXIgZmlsZU5vZGVJZCA9IHBhcmVudExpc3RpbmdbZmlsZU5hbWVdO1xuICAgIGRlbGV0ZSBwYXJlbnRMaXN0aW5nW2ZpbGVOYW1lXTtcblxuICAgIC8vIEdldCBmaWxlIGlub2RlLlxuICAgIHZhciBmaWxlTm9kZSA9IHRoaXMuZ2V0SU5vZGUodHgsIHAsIGZpbGVOb2RlSWQpO1xuICAgIGlmICghaXNEaXIgJiYgZmlsZU5vZGUuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRUlTRElSKHApO1xuICAgIH0gZWxzZSBpZiAoaXNEaXIgJiYgIWZpbGVOb2RlLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVOT1RESVIocCk7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIC8vIERlbGV0ZSBkYXRhLlxuICAgICAgdHguZGVsKGZpbGVOb2RlLmlkKTtcbiAgICAgIC8vIERlbGV0ZSBub2RlLlxuICAgICAgdHguZGVsKGZpbGVOb2RlSWQpO1xuICAgICAgLy8gVXBkYXRlIGRpcmVjdG9yeSBsaXN0aW5nLlxuICAgICAgdHgucHV0KHBhcmVudE5vZGUuaWQsIG5ldyBCdWZmZXIoSlNPTi5zdHJpbmdpZnkocGFyZW50TGlzdGluZykpLCB0cnVlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0eC5hYm9ydCgpO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gICAgLy8gU3VjY2Vzcy5cbiAgICB0eC5jb21taXQoKTtcbiAgfVxuXG4gIHB1YmxpYyB1bmxpbmtTeW5jKHA6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMucmVtb3ZlRW50cnkocCwgZmFsc2UpO1xuICB9XG5cbiAgcHVibGljIHJtZGlyU3luYyhwOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLnJlbW92ZUVudHJ5KHAsIHRydWUpO1xuICB9XG5cbiAgcHVibGljIG1rZGlyU3luYyhwOiBzdHJpbmcsIG1vZGU6IG51bWJlcik6IHZvaWQge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZHdyaXRlJyksXG4gICAgICBkYXRhID0gbmV3IEJ1ZmZlcigne30nKTtcbiAgICB0aGlzLmNvbW1pdE5ld0ZpbGUodHgsIHAsIEZpbGVUeXBlLkRJUkVDVE9SWSwgbW9kZSwgZGF0YSk7XG4gIH1cblxuICBwdWJsaWMgcmVhZGRpclN5bmMocDogc3RyaW5nKTogc3RyaW5nW117XG4gICAgdmFyIHR4ID0gdGhpcy5zdG9yZS5iZWdpblRyYW5zYWN0aW9uKCdyZWFkb25seScpO1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmdldERpckxpc3RpbmcodHgsIHAsIHRoaXMuZmluZElOb2RlKHR4LCBwKSkpO1xuICB9XG5cbiAgcHVibGljIF9zeW5jU3luYyhwOiBzdHJpbmcsIGRhdGE6IE5vZGVCdWZmZXIsIHN0YXRzOiBTdGF0cyk6IHZvaWQge1xuICAgIC8vIEB0b2RvIEVuc3VyZSBtdGltZSB1cGRhdGVzIHByb3Blcmx5LCBhbmQgdXNlIHRoYXQgdG8gZGV0ZXJtaW5lIGlmIGEgZGF0YVxuICAgIC8vICAgICAgIHVwZGF0ZSBpcyByZXF1aXJlZC5cbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpLFxuICAgICAgLy8gV2UgdXNlIHRoZSBfZmluZElub2RlIGhlbHBlciBiZWNhdXNlIHdlIGFjdHVhbGx5IG5lZWQgdGhlIElOb2RlIGlkLlxuICAgICAgZmlsZUlub2RlSWQgPSB0aGlzLl9maW5kSU5vZGUodHgsIHBhdGguZGlybmFtZShwKSwgcGF0aC5iYXNlbmFtZShwKSksXG4gICAgICBmaWxlSW5vZGUgPSB0aGlzLmdldElOb2RlKHR4LCBwLCBmaWxlSW5vZGVJZCksXG4gICAgICBpbm9kZUNoYW5nZWQgPSBmaWxlSW5vZGUudXBkYXRlKHN0YXRzKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyBTeW5jIGRhdGEuXG4gICAgICB0eC5wdXQoZmlsZUlub2RlLmlkLCBkYXRhLCB0cnVlKTtcbiAgICAgIC8vIFN5bmMgbWV0YWRhdGEuXG4gICAgICBpZiAoaW5vZGVDaGFuZ2VkKSB7XG4gICAgICAgIHR4LnB1dChmaWxlSW5vZGVJZCwgZmlsZUlub2RlLnRvQnVmZmVyKCksIHRydWUpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHR4LmFib3J0KCk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgICB0eC5jb21taXQoKTtcbiAgfVxufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYW4gKmFzeW5jaHJvbm91cyoga2V5LXZhbHVlIHN0b3JlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEFzeW5jS2V5VmFsdWVTdG9yZSB7XG4gIC8qKlxuICAgKiBUaGUgbmFtZSBvZiB0aGUga2V5LXZhbHVlIHN0b3JlLlxuICAgKi9cbiAgbmFtZSgpOiBzdHJpbmc7XG4gIC8qKlxuICAgKiBFbXB0aWVzIHRoZSBrZXktdmFsdWUgc3RvcmUgY29tcGxldGVseS5cbiAgICovXG4gIGNsZWFyKGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbiAgLyoqXG4gICAqIEJlZ2lucyBhIHJlYWQtd3JpdGUgdHJhbnNhY3Rpb24uXG4gICAqL1xuICBiZWdpblRyYW5zYWN0aW9uKHR5cGU6ICdyZWFkd3JpdGUnKTogQXN5bmNLZXlWYWx1ZVJXVHJhbnNhY3Rpb247XG4gIC8qKlxuICAgKiBCZWdpbnMgYSByZWFkLW9ubHkgdHJhbnNhY3Rpb24uXG4gICAqL1xuICBiZWdpblRyYW5zYWN0aW9uKHR5cGU6ICdyZWFkb25seScpOiBBc3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbjtcbiAgYmVnaW5UcmFuc2FjdGlvbih0eXBlOiBzdHJpbmcpOiBBc3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbjtcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGFuIGFzeW5jaHJvbm91cyByZWFkLW9ubHkgdHJhbnNhY3Rpb24uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQXN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb24ge1xuICAvKipcbiAgICogUmV0cmlldmVzIHRoZSBkYXRhIGF0IHRoZSBnaXZlbiBrZXkuXG4gICAqIEBwYXJhbSBrZXkgVGhlIGtleSB0byBsb29rIHVuZGVyIGZvciBkYXRhLlxuICAgKi9cbiAgZ2V0KGtleTogc3RyaW5nLCBjYjogKGU6IEFwaUVycm9yLCBkYXRhPzogTm9kZUJ1ZmZlcikgPT4gdm9pZCk6IHZvaWQ7XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBhc3luY2hyb25vdXMgcmVhZC13cml0ZSB0cmFuc2FjdGlvbi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBBc3luY0tleVZhbHVlUldUcmFuc2FjdGlvbiBleHRlbmRzIEFzeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uIHtcbiAgLyoqXG4gICAqIEFkZHMgdGhlIGRhdGEgdG8gdGhlIHN0b3JlIHVuZGVyIHRoZSBnaXZlbiBrZXkuIE92ZXJ3cml0ZXMgYW55IGV4aXN0aW5nXG4gICAqIGRhdGEuXG4gICAqIEBwYXJhbSBrZXkgVGhlIGtleSB0byBhZGQgdGhlIGRhdGEgdW5kZXIuXG4gICAqIEBwYXJhbSBkYXRhIFRoZSBkYXRhIHRvIGFkZCB0byB0aGUgc3RvcmUuXG4gICAqIEBwYXJhbSBvdmVyd3JpdGUgSWYgJ3RydWUnLCBvdmVyd3JpdGUgYW55IGV4aXN0aW5nIGRhdGEuIElmICdmYWxzZScsXG4gICAqICAgYXZvaWRzIHdyaXRpbmcgdGhlIGRhdGEgaWYgdGhlIGtleSBleGlzdHMuXG4gICAqIEBwYXJhbSBjYiBUcmlnZ2VyZWQgd2l0aCBhbiBlcnJvciBhbmQgd2hldGhlciBvciBub3QgdGhlIHZhbHVlIHdhc1xuICAgKiAgIGNvbW1pdHRlZC5cbiAgICovXG4gIHB1dChrZXk6IHN0cmluZywgZGF0YTogTm9kZUJ1ZmZlciwgb3ZlcndyaXRlOiBib29sZWFuLCBjYjogKGU6IEFwaUVycm9yLFxuICAgIGNvbW1pdHRlZD86IGJvb2xlYW4pID0+IHZvaWQpOiB2b2lkO1xuICAvKipcbiAgICogRGVsZXRlcyB0aGUgZGF0YSBhdCB0aGUgZ2l2ZW4ga2V5LlxuICAgKiBAcGFyYW0ga2V5IFRoZSBrZXkgdG8gZGVsZXRlIGZyb20gdGhlIHN0b3JlLlxuICAgKi9cbiAgZGVsKGtleTogc3RyaW5nLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIC8qKlxuICAgKiBDb21taXRzIHRoZSB0cmFuc2FjdGlvbi5cbiAgICovXG4gIGNvbW1pdChjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIC8qKlxuICAgKiBBYm9ydHMgYW5kIHJvbGxzIGJhY2sgdGhlIHRyYW5zYWN0aW9uLlxuICAgKi9cbiAgYWJvcnQoY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgQXN5bmNLZXlWYWx1ZUZpbGUgZXh0ZW5kcyBwcmVsb2FkX2ZpbGUuUHJlbG9hZEZpbGU8QXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0+IGltcGxlbWVudHMgZmlsZS5GaWxlIHtcbiAgY29uc3RydWN0b3IoX2ZzOiBBc3luY0tleVZhbHVlRmlsZVN5c3RlbSwgX3BhdGg6IHN0cmluZywgX2ZsYWc6IGZpbGVfZmxhZy5GaWxlRmxhZywgX3N0YXQ6IFN0YXRzLCBjb250ZW50cz86IE5vZGVCdWZmZXIpIHtcbiAgICBzdXBlcihfZnMsIF9wYXRoLCBfZmxhZywgX3N0YXQsIGNvbnRlbnRzKTtcbiAgfVxuXG4gIHB1YmxpYyBzeW5jKGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaXNEaXJ0eSgpKSB7XG4gICAgICB0aGlzLl9mcy5fc3luYyh0aGlzLmdldFBhdGgoKSwgdGhpcy5nZXRCdWZmZXIoKSwgdGhpcy5nZXRTdGF0cygpLCAoZT86IEFwaUVycm9yKSA9PiB7XG4gICAgICAgIGlmICghZSkge1xuICAgICAgICAgIHRoaXMucmVzZXREaXJ0eSgpO1xuICAgICAgICB9XG4gICAgICAgIGNiKGUpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNiKCk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGNsb3NlKGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5zeW5jKGNiKTtcbiAgfVxufVxuXG4vKipcbiAqIEFuIFwiQXN5bmNocm9ub3VzIGtleS12YWx1ZSBmaWxlIHN5c3RlbVwiLiBTdG9yZXMgZGF0YSB0by9yZXRyaWV2ZXMgZGF0YSBmcm9tXG4gKiBhbiB1bmRlcmx5aW5nIGFzeW5jaHJvbm91cyBrZXktdmFsdWUgc3RvcmUuXG4gKi9cbmV4cG9ydCBjbGFzcyBBc3luY0tleVZhbHVlRmlsZVN5c3RlbSBleHRlbmRzIGZpbGVfc3lzdGVtLkJhc2VGaWxlU3lzdGVtIHtcbiAgcHJpdmF0ZSBzdG9yZTogQXN5bmNLZXlWYWx1ZVN0b3JlO1xuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplcyB0aGUgZmlsZSBzeXN0ZW0uIFR5cGljYWxseSBjYWxsZWQgYnkgc3ViY2xhc3NlcycgYXN5bmNcbiAgICogY29uc3RydWN0b3JzLlxuICAgKi9cbiAgcHVibGljIGluaXQoc3RvcmU6IEFzeW5jS2V5VmFsdWVTdG9yZSwgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpIHtcbiAgICB0aGlzLnN0b3JlID0gc3RvcmU7XG4gICAgLy8gSU5WQVJJQU5UOiBFbnN1cmUgdGhhdCB0aGUgcm9vdCBleGlzdHMuXG4gICAgdGhpcy5tYWtlUm9vdERpcmVjdG9yeShjYik7XG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGlzQXZhaWxhYmxlKCk6IGJvb2xlYW4geyByZXR1cm4gdHJ1ZTsgfVxuICBwdWJsaWMgZ2V0TmFtZSgpOiBzdHJpbmcgeyByZXR1cm4gdGhpcy5zdG9yZS5uYW1lKCk7IH1cbiAgcHVibGljIGlzUmVhZE9ubHkoKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuICBwdWJsaWMgc3VwcG9ydHNTeW1saW5rcygpOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlOyB9XG4gIHB1YmxpYyBzdXBwb3J0c1Byb3BzKCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cbiAgcHVibGljIHN1cHBvcnRzU3luY2goKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgdGhlIHJvb3QgZGlyZWN0b3J5IGV4aXN0cy4gQ3JlYXRlcyBpdCBpZiBpdCBkb2Vzbid0LlxuICAgKi9cbiAgcHJpdmF0ZSBtYWtlUm9vdERpcmVjdG9yeShjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCkge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZHdyaXRlJyk7XG4gICAgdHguZ2V0KFJPT1RfTk9ERV9JRCwgKGU6IEFwaUVycm9yLCBkYXRhPzogTm9kZUJ1ZmZlcikgPT4ge1xuICAgICAgaWYgKGUgfHwgZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIENyZWF0ZSBuZXcgaW5vZGUuXG4gICAgICAgIHZhciBjdXJyVGltZSA9IChuZXcgRGF0ZSgpKS5nZXRUaW1lKCksXG4gICAgICAgICAgLy8gTW9kZSAwNjY2XG4gICAgICAgICAgZGlySW5vZGUgPSBuZXcgSW5vZGUoR2VuZXJhdGVSYW5kb21JRCgpLCA0MDk2LCA1MTEgfCBGaWxlVHlwZS5ESVJFQ1RPUlksIGN1cnJUaW1lLCBjdXJyVGltZSwgY3VyclRpbWUpO1xuICAgICAgICAvLyBJZiB0aGUgcm9vdCBkb2Vzbid0IGV4aXN0LCB0aGUgZmlyc3QgcmFuZG9tIElEIHNob3VsZG4ndCBleGlzdCxcbiAgICAgICAgLy8gZWl0aGVyLlxuICAgICAgICB0eC5wdXQoZGlySW5vZGUuaWQsIG5ldyBCdWZmZXIoXCJ7fVwiKSwgZmFsc2UsIChlPzogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgIHR4LnB1dChST09UX05PREVfSUQsIGRpcklub2RlLnRvQnVmZmVyKCksIGZhbHNlLCAoZT86IEFwaUVycm9yKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChlKSB7XG4gICAgICAgICAgICAgICAgdHguYWJvcnQoKCkgPT4geyBjYihlKTsgfSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdHguY29tbWl0KGNiKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFdlJ3JlIGdvb2QuXG4gICAgICAgIHR4LmNvbW1pdChjYik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogSGVscGVyIGZ1bmN0aW9uIGZvciBmaW5kSU5vZGUuXG4gICAqIEBwYXJhbSBwYXJlbnQgVGhlIHBhcmVudCBkaXJlY3Rvcnkgb2YgdGhlIGZpbGUgd2UgYXJlIGF0dGVtcHRpbmcgdG8gZmluZC5cbiAgICogQHBhcmFtIGZpbGVuYW1lIFRoZSBmaWxlbmFtZSBvZiB0aGUgaW5vZGUgd2UgYXJlIGF0dGVtcHRpbmcgdG8gZmluZCwgbWludXNcbiAgICogICB0aGUgcGFyZW50LlxuICAgKiBAcGFyYW0gY2IgUGFzc2VkIGFuIGVycm9yIG9yIHRoZSBJRCBvZiB0aGUgZmlsZSdzIGlub2RlIGluIHRoZSBmaWxlIHN5c3RlbS5cbiAgICovXG4gIHByaXZhdGUgX2ZpbmRJTm9kZSh0eDogQXN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb24sIHBhcmVudDogc3RyaW5nLCBmaWxlbmFtZTogc3RyaW5nLCBjYjogKGU6IEFwaUVycm9yLCBpZD86IHN0cmluZykgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciBoYW5kbGVfZGlyZWN0b3J5X2xpc3RpbmdzID0gKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlLCBkaXJMaXN0Pzoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9KTogdm9pZCA9PiB7XG4gICAgICBpZiAoZSkge1xuICAgICAgICBjYihlKVxuICAgICAgfSBlbHNlIGlmIChkaXJMaXN0W2ZpbGVuYW1lXSkge1xuICAgICAgICBjYihudWxsLCBkaXJMaXN0W2ZpbGVuYW1lXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYihBcGlFcnJvci5FTk9FTlQocGF0aC5yZXNvbHZlKHBhcmVudCwgZmlsZW5hbWUpKSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGlmIChwYXJlbnQgPT09ICcvJykge1xuICAgICAgaWYgKGZpbGVuYW1lID09PSAnJykge1xuICAgICAgICAvLyBCQVNFIENBU0UgIzE6IFJldHVybiB0aGUgcm9vdCdzIElELlxuICAgICAgICBjYihudWxsLCBST09UX05PREVfSUQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQkFTRSBDQVNFICMyOiBGaW5kIHRoZSBpdGVtIGluIHRoZSByb290IG5vZGUuXG4gICAgICAgIHRoaXMuZ2V0SU5vZGUodHgsIHBhcmVudCwgUk9PVF9OT0RFX0lELCAoZTogQXBpRXJyb3IsIGlub2RlPzogSW5vZGUpOiB2b2lkID0+IHtcbiAgICAgICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgICAgIHRoaXMuZ2V0RGlyTGlzdGluZyh0eCwgcGFyZW50LCBpbm9kZSwgKGU6IEFwaUVycm9yLCBkaXJMaXN0Pzoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9KTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgIC8vIGhhbmRsZV9kaXJlY3RvcnlfbGlzdGluZ3Mgd2lsbCBoYW5kbGUgZSBmb3IgdXMuXG4gICAgICAgICAgICAgIGhhbmRsZV9kaXJlY3RvcnlfbGlzdGluZ3MoZSwgaW5vZGUsIGRpckxpc3QpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gR2V0IHRoZSBwYXJlbnQgZGlyZWN0b3J5J3MgSU5vZGUsIGFuZCBmaW5kIHRoZSBmaWxlIGluIGl0cyBkaXJlY3RvcnlcbiAgICAgIC8vIGxpc3RpbmcuXG4gICAgICB0aGlzLmZpbmRJTm9kZUFuZERpckxpc3RpbmcodHgsIHBhcmVudCwgaGFuZGxlX2RpcmVjdG9yeV9saXN0aW5ncyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZpbmRzIHRoZSBJbm9kZSBvZiB0aGUgZ2l2ZW4gcGF0aC5cbiAgICogQHBhcmFtIHAgVGhlIHBhdGggdG8gbG9vayB1cC5cbiAgICogQHBhcmFtIGNiIFBhc3NlZCBhbiBlcnJvciBvciB0aGUgSW5vZGUgb2YgdGhlIHBhdGggcC5cbiAgICogQHRvZG8gbWVtb2l6ZS9jYWNoZVxuICAgKi9cbiAgcHJpdmF0ZSBmaW5kSU5vZGUodHg6IEFzeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uLCBwOiBzdHJpbmcsIGNiOiAoZTogQXBpRXJyb3IsIGlub2RlPzogSW5vZGUpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9maW5kSU5vZGUodHgsIHBhdGguZGlybmFtZShwKSwgcGF0aC5iYXNlbmFtZShwKSwgKGU6IEFwaUVycm9yLCBpZD86IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgaWYgKG5vRXJyb3IoZSwgY2IpKSB7XG4gICAgICAgIHRoaXMuZ2V0SU5vZGUodHgsIHAsIGlkLCBjYik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogR2l2ZW4gdGhlIElEIG9mIGEgbm9kZSwgcmV0cmlldmVzIHRoZSBjb3JyZXNwb25kaW5nIElub2RlLlxuICAgKiBAcGFyYW0gdHggVGhlIHRyYW5zYWN0aW9uIHRvIHVzZS5cbiAgICogQHBhcmFtIHAgVGhlIGNvcnJlc3BvbmRpbmcgcGF0aCB0byB0aGUgZmlsZSAodXNlZCBmb3IgZXJyb3IgbWVzc2FnZXMpLlxuICAgKiBAcGFyYW0gaWQgVGhlIElEIHRvIGxvb2sgdXAuXG4gICAqIEBwYXJhbSBjYiBQYXNzZWQgYW4gZXJyb3Igb3IgdGhlIGlub2RlIHVuZGVyIHRoZSBnaXZlbiBpZC5cbiAgICovXG4gIHByaXZhdGUgZ2V0SU5vZGUodHg6IEFzeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uLCBwOiBzdHJpbmcsIGlkOiBzdHJpbmcsIGNiOiAoZTogQXBpRXJyb3IsIGlub2RlPzogSW5vZGUpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0eC5nZXQoaWQsIChlOiBBcGlFcnJvciwgZGF0YT86IE5vZGVCdWZmZXIpOiB2b2lkID0+IHtcbiAgICAgIGlmIChub0Vycm9yKGUsIGNiKSkge1xuICAgICAgICBpZiAoZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY2IoQXBpRXJyb3IuRU5PRU5UKHApKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjYihudWxsLCBJbm9kZS5mcm9tQnVmZmVyKGRhdGEpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEdpdmVuIHRoZSBJbm9kZSBvZiBhIGRpcmVjdG9yeSwgcmV0cmlldmVzIHRoZSBjb3JyZXNwb25kaW5nIGRpcmVjdG9yeVxuICAgKiBsaXN0aW5nLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXREaXJMaXN0aW5nKHR4OiBBc3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbiwgcDogc3RyaW5nLCBpbm9kZTogSW5vZGUsIGNiOiAoZTogQXBpRXJyb3IsIGxpc3Rpbmc/OiB7IFtmaWxlTmFtZTogc3RyaW5nXTogc3RyaW5nIH0pID0+IHZvaWQpOiB2b2lkIHtcbiAgICBpZiAoIWlub2RlLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgIGNiKEFwaUVycm9yLkVOT1RESVIocCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0eC5nZXQoaW5vZGUuaWQsIChlOiBBcGlFcnJvciwgZGF0YT86IE5vZGVCdWZmZXIpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKG5vRXJyb3IoZSwgY2IpKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNiKG51bGwsIEpTT04ucGFyc2UoZGF0YS50b1N0cmluZygpKSk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gT2NjdXJzIHdoZW4gZGF0YSBpcyB1bmRlZmluZWQsIG9yIGNvcnJlc3BvbmRzIHRvIHNvbWV0aGluZyBvdGhlclxuICAgICAgICAgICAgLy8gdGhhbiBhIGRpcmVjdG9yeSBsaXN0aW5nLiBUaGUgbGF0dGVyIHNob3VsZCBuZXZlciBvY2N1ciB1bmxlc3NcbiAgICAgICAgICAgIC8vIHRoZSBmaWxlIHN5c3RlbSBpcyBjb3JydXB0ZWQuXG4gICAgICAgICAgICBjYihBcGlFcnJvci5FTk9FTlQocCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdpdmVuIGEgcGF0aCB0byBhIGRpcmVjdG9yeSwgcmV0cmlldmVzIHRoZSBjb3JyZXNwb25kaW5nIElOb2RlIGFuZFxuICAgKiBkaXJlY3RvcnkgbGlzdGluZy5cbiAgICovXG4gIHByaXZhdGUgZmluZElOb2RlQW5kRGlyTGlzdGluZyh0eDogQXN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb24sIHA6IHN0cmluZywgY2I6IChlOiBBcGlFcnJvciwgaW5vZGU/OiBJbm9kZSwgbGlzdGluZz86IHsgW2ZpbGVOYW1lOiBzdHJpbmddOiBzdHJpbmcgfSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuZmluZElOb2RlKHR4LCBwLCAoZTogQXBpRXJyb3IsIGlub2RlPzogSW5vZGUpOiB2b2lkID0+IHtcbiAgICAgIGlmIChub0Vycm9yKGUsIGNiKSkge1xuICAgICAgICB0aGlzLmdldERpckxpc3RpbmcodHgsIHAsIGlub2RlLCAoZSwgbGlzdGluZz8pID0+IHtcbiAgICAgICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgICAgIGNiKG51bGwsIGlub2RlLCBsaXN0aW5nKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYSBuZXcgbm9kZSB1bmRlciBhIHJhbmRvbSBJRC4gUmV0cmllcyA1IHRpbWVzIGJlZm9yZSBnaXZpbmcgdXAgaW5cbiAgICogdGhlIGV4Y2VlZGluZ2x5IHVubGlrZWx5IGNoYW5jZSB0aGF0IHdlIHRyeSB0byByZXVzZSBhIHJhbmRvbSBHVUlELlxuICAgKiBAcGFyYW0gY2IgUGFzc2VkIGFuIGVycm9yIG9yIHRoZSBHVUlEIHRoYXQgdGhlIGRhdGEgd2FzIHN0b3JlZCB1bmRlci5cbiAgICovXG4gIHByaXZhdGUgYWRkTmV3Tm9kZSh0eDogQXN5bmNLZXlWYWx1ZVJXVHJhbnNhY3Rpb24sIGRhdGE6IE5vZGVCdWZmZXIsIGNiOiAoZTogQXBpRXJyb3IsIGd1aWQ/OiBzdHJpbmcpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgcmV0cmllcyA9IDAsIGN1cnJJZDogc3RyaW5nLFxuICAgICAgcmVyb2xsID0gKCkgPT4ge1xuICAgICAgICBpZiAoKytyZXRyaWVzID09PSA1KSB7XG4gICAgICAgICAgLy8gTWF4IHJldHJpZXMgaGl0LiBSZXR1cm4gd2l0aCBhbiBlcnJvci5cbiAgICAgICAgICBjYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTywgJ1VuYWJsZSB0byBjb21taXQgZGF0YSB0byBrZXktdmFsdWUgc3RvcmUuJykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFRyeSBhZ2Fpbi5cbiAgICAgICAgICBjdXJySWQgPSBHZW5lcmF0ZVJhbmRvbUlEKCk7XG4gICAgICAgICAgdHgucHV0KGN1cnJJZCwgZGF0YSwgZmFsc2UsIChlOiBBcGlFcnJvciwgY29tbWl0dGVkPzogYm9vbGVhbikgPT4ge1xuICAgICAgICAgICAgaWYgKGUgfHwgIWNvbW1pdHRlZCkge1xuICAgICAgICAgICAgICByZXJvbGwoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIFN1Y2Nlc3NmdWxseSBzdG9yZWQgdW5kZXIgJ2N1cnJJZCcuXG4gICAgICAgICAgICAgIGNiKG51bGwsIGN1cnJJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgcmVyb2xsKCk7XG4gIH1cblxuICAvKipcbiAgICogQ29tbWl0cyBhIG5ldyBmaWxlICh3ZWxsLCBhIEZJTEUgb3IgYSBESVJFQ1RPUlkpIHRvIHRoZSBmaWxlIHN5c3RlbSB3aXRoXG4gICAqIHRoZSBnaXZlbiBtb2RlLlxuICAgKiBOb3RlOiBUaGlzIHdpbGwgY29tbWl0IHRoZSB0cmFuc2FjdGlvbi5cbiAgICogQHBhcmFtIHAgVGhlIHBhdGggdG8gdGhlIG5ldyBmaWxlLlxuICAgKiBAcGFyYW0gdHlwZSBUaGUgdHlwZSBvZiB0aGUgbmV3IGZpbGUuXG4gICAqIEBwYXJhbSBtb2RlIFRoZSBtb2RlIHRvIGNyZWF0ZSB0aGUgbmV3IGZpbGUgd2l0aC5cbiAgICogQHBhcmFtIGRhdGEgVGhlIGRhdGEgdG8gc3RvcmUgYXQgdGhlIGZpbGUncyBkYXRhIG5vZGUuXG4gICAqIEBwYXJhbSBjYiBQYXNzZWQgYW4gZXJyb3Igb3IgdGhlIElub2RlIGZvciB0aGUgbmV3IGZpbGUuXG4gICAqL1xuICBwcml2YXRlIGNvbW1pdE5ld0ZpbGUodHg6IEFzeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uLCBwOiBzdHJpbmcsIHR5cGU6IEZpbGVUeXBlLCBtb2RlOiBudW1iZXIsIGRhdGE6IE5vZGVCdWZmZXIsIGNiOiAoZTogQXBpRXJyb3IsIGlub2RlPzogSW5vZGUpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgcGFyZW50RGlyID0gcGF0aC5kaXJuYW1lKHApLFxuICAgICAgZm5hbWUgPSBwYXRoLmJhc2VuYW1lKHApLFxuICAgICAgY3VyclRpbWUgPSAobmV3IERhdGUoKSkuZ2V0VGltZSgpO1xuXG4gICAgLy8gSW52YXJpYW50OiBUaGUgcm9vdCBhbHdheXMgZXhpc3RzLlxuICAgIC8vIElmIHdlIGRvbid0IGNoZWNrIHRoaXMgcHJpb3IgdG8gdGFraW5nIHN0ZXBzIGJlbG93LCB3ZSB3aWxsIGNyZWF0ZSBhXG4gICAgLy8gZmlsZSB3aXRoIG5hbWUgJycgaW4gcm9vdCBzaG91bGQgcCA9PSAnLycuXG4gICAgaWYgKHAgPT09ICcvJykge1xuICAgICAgcmV0dXJuIGNiKEFwaUVycm9yLkVFWElTVChwKSk7XG4gICAgfVxuXG4gICAgLy8gTGV0J3MgYnVpbGQgYSBweXJhbWlkIG9mIGNvZGUhXG5cbiAgICAvLyBTdGVwIDE6IEdldCB0aGUgcGFyZW50IGRpcmVjdG9yeSdzIGlub2RlIGFuZCBkaXJlY3RvcnkgbGlzdGluZ1xuICAgIHRoaXMuZmluZElOb2RlQW5kRGlyTGlzdGluZyh0eCwgcGFyZW50RGlyLCAoZTogQXBpRXJyb3IsIHBhcmVudE5vZGU/OiBJbm9kZSwgZGlyTGlzdGluZz86IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSk6IHZvaWQgPT4ge1xuICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgIGlmIChkaXJMaXN0aW5nW2ZuYW1lXSkge1xuICAgICAgICAgIC8vIEZpbGUgYWxyZWFkeSBleGlzdHMuXG4gICAgICAgICAgdHguYWJvcnQoKCkgPT4ge1xuICAgICAgICAgICAgY2IoQXBpRXJyb3IuRUVYSVNUKHApKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBTdGVwIDI6IENvbW1pdCBkYXRhIHRvIHN0b3JlLlxuICAgICAgICAgIHRoaXMuYWRkTmV3Tm9kZSh0eCwgZGF0YSwgKGU6IEFwaUVycm9yLCBkYXRhSWQ/OiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICAvLyBTdGVwIDM6IENvbW1pdCB0aGUgZmlsZSdzIGlub2RlIHRvIHRoZSBzdG9yZS5cbiAgICAgICAgICAgICAgdmFyIGZpbGVJbm9kZSA9IG5ldyBJbm9kZShkYXRhSWQsIGRhdGEubGVuZ3RoLCBtb2RlIHwgdHlwZSwgY3VyclRpbWUsIGN1cnJUaW1lLCBjdXJyVGltZSk7XG4gICAgICAgICAgICAgIHRoaXMuYWRkTmV3Tm9kZSh0eCwgZmlsZUlub2RlLnRvQnVmZmVyKCksIChlOiBBcGlFcnJvciwgZmlsZUlub2RlSWQ/OiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgICAgIC8vIFN0ZXAgNDogVXBkYXRlIHBhcmVudCBkaXJlY3RvcnkncyBsaXN0aW5nLlxuICAgICAgICAgICAgICAgICAgZGlyTGlzdGluZ1tmbmFtZV0gPSBmaWxlSW5vZGVJZDtcbiAgICAgICAgICAgICAgICAgIHR4LnB1dChwYXJlbnROb2RlLmlkLCBuZXcgQnVmZmVyKEpTT04uc3RyaW5naWZ5KGRpckxpc3RpbmcpKSwgdHJ1ZSwgKGU6IEFwaUVycm9yKTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICAgICAgICAgIC8vIFN0ZXAgNTogQ29tbWl0IGFuZCByZXR1cm4gdGhlIG5ldyBpbm9kZS5cbiAgICAgICAgICAgICAgICAgICAgICB0eC5jb21taXQoKGU/OiBBcGlFcnJvcik6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNiKG51bGwsIGZpbGVJbm9kZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGUgYWxsIGNvbnRlbnRzIHN0b3JlZCBpbiB0aGUgZmlsZSBzeXN0ZW0uXG4gICAqL1xuICBwdWJsaWMgZW1wdHkoY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLnN0b3JlLmNsZWFyKChlPykgPT4ge1xuICAgICAgaWYgKG5vRXJyb3IoZSwgY2IpKSB7XG4gICAgICAgIC8vIElOVkFSSUFOVDogUm9vdCBhbHdheXMgZXhpc3RzLlxuICAgICAgICB0aGlzLm1ha2VSb290RGlyZWN0b3J5KGNiKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyByZW5hbWUob2xkUGF0aDogc3RyaW5nLCBuZXdQYXRoOiBzdHJpbmcsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIHR4ID0gdGhpcy5zdG9yZS5iZWdpblRyYW5zYWN0aW9uKCdyZWFkd3JpdGUnKSxcbiAgICAgIG9sZFBhcmVudCA9IHBhdGguZGlybmFtZShvbGRQYXRoKSwgb2xkTmFtZSA9IHBhdGguYmFzZW5hbWUob2xkUGF0aCksXG4gICAgICBuZXdQYXJlbnQgPSBwYXRoLmRpcm5hbWUobmV3UGF0aCksIG5ld05hbWUgPSBwYXRoLmJhc2VuYW1lKG5ld1BhdGgpLFxuICAgICAgaW5vZGVzOiB7IFtwYXRoOiBzdHJpbmddOiBJbm9kZSB9ID0ge30sXG4gICAgICBsaXN0czoge1xuICAgICAgICBbcGF0aDogc3RyaW5nXTogeyBbZmlsZTogc3RyaW5nXTogc3RyaW5nIH1cbiAgICAgIH0gPSB7fSxcbiAgICAgIGVycm9yT2NjdXJyZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuICAgIC8vIEludmFyaWFudDogQ2FuJ3QgbW92ZSBhIGZvbGRlciBpbnNpZGUgaXRzZWxmLlxuICAgIC8vIFRoaXMgZnVubnkgbGl0dGxlIGhhY2sgZW5zdXJlcyB0aGF0IHRoZSBjaGVjayBwYXNzZXMgb25seSBpZiBvbGRQYXRoXG4gICAgLy8gaXMgYSBzdWJwYXRoIG9mIG5ld1BhcmVudC4gV2UgYXBwZW5kICcvJyB0byBhdm9pZCBtYXRjaGluZyBmb2xkZXJzIHRoYXRcbiAgICAvLyBhcmUgYSBzdWJzdHJpbmcgb2YgdGhlIGJvdHRvbS1tb3N0IGZvbGRlciBpbiB0aGUgcGF0aC5cbiAgICBpZiAoKG5ld1BhcmVudCArICcvJykuaW5kZXhPZihvbGRQYXRoICsgJy8nKSA9PT0gMCkge1xuICAgICAgcmV0dXJuIGNiKG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRUJVU1ksIG9sZFBhcmVudCkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc3BvbnNpYmxlIGZvciBQaGFzZSAyIG9mIHRoZSByZW5hbWUgb3BlcmF0aW9uOiBNb2RpZnlpbmcgYW5kXG4gICAgICogY29tbWl0dGluZyB0aGUgZGlyZWN0b3J5IGxpc3RpbmdzLiBDYWxsZWQgb25jZSB3ZSBoYXZlIHN1Y2Nlc3NmdWxseVxuICAgICAqIHJldHJpZXZlZCBib3RoIHRoZSBvbGQgYW5kIG5ldyBwYXJlbnQncyBpbm9kZXMgYW5kIGxpc3RpbmdzLlxuICAgICAqL1xuICAgIHZhciB0aGVPbGVTd2l0Y2hhcm9vID0gKCk6IHZvaWQgPT4ge1xuICAgICAgLy8gU2FuaXR5IGNoZWNrOiBFbnN1cmUgYm90aCBwYXRocyBhcmUgcHJlc2VudCwgYW5kIG5vIGVycm9yIGhhcyBvY2N1cnJlZC5cbiAgICAgIGlmIChlcnJvck9jY3VycmVkIHx8ICFsaXN0cy5oYXNPd25Qcm9wZXJ0eShvbGRQYXJlbnQpIHx8ICFsaXN0cy5oYXNPd25Qcm9wZXJ0eShuZXdQYXJlbnQpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHZhciBvbGRQYXJlbnRMaXN0ID0gbGlzdHNbb2xkUGFyZW50XSwgb2xkUGFyZW50SU5vZGUgPSBpbm9kZXNbb2xkUGFyZW50XSxcbiAgICAgICAgbmV3UGFyZW50TGlzdCA9IGxpc3RzW25ld1BhcmVudF0sIG5ld1BhcmVudElOb2RlID0gaW5vZGVzW25ld1BhcmVudF07XG5cbiAgICAgIC8vIERlbGV0ZSBmaWxlIGZyb20gb2xkIHBhcmVudC5cbiAgICAgIGlmICghb2xkUGFyZW50TGlzdFtvbGROYW1lXSkge1xuICAgICAgICBjYihBcGlFcnJvci5FTk9FTlQob2xkUGF0aCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGZpbGVJZCA9IG9sZFBhcmVudExpc3Rbb2xkTmFtZV07XG4gICAgICAgIGRlbGV0ZSBvbGRQYXJlbnRMaXN0W29sZE5hbWVdO1xuXG4gICAgICAgIC8vIEZpbmlzaGVzIG9mZiB0aGUgcmVuYW1pbmcgcHJvY2VzcyBieSBhZGRpbmcgdGhlIGZpbGUgdG8gdGhlIG5ld1xuICAgICAgICAvLyBwYXJlbnQuXG4gICAgICAgIHZhciBjb21wbGV0ZVJlbmFtZSA9ICgpID0+IHtcbiAgICAgICAgICBuZXdQYXJlbnRMaXN0W25ld05hbWVdID0gZmlsZUlkO1xuICAgICAgICAgIC8vIENvbW1pdCBvbGQgcGFyZW50J3MgbGlzdC5cbiAgICAgICAgICB0eC5wdXQob2xkUGFyZW50SU5vZGUuaWQsIG5ldyBCdWZmZXIoSlNPTi5zdHJpbmdpZnkob2xkUGFyZW50TGlzdCkpLCB0cnVlLCAoZTogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICBpZiAob2xkUGFyZW50ID09PSBuZXdQYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAvLyBET05FIVxuICAgICAgICAgICAgICAgIHR4LmNvbW1pdChjYik7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gQ29tbWl0IG5ldyBwYXJlbnQncyBsaXN0LlxuICAgICAgICAgICAgICAgIHR4LnB1dChuZXdQYXJlbnRJTm9kZS5pZCwgbmV3IEJ1ZmZlcihKU09OLnN0cmluZ2lmeShuZXdQYXJlbnRMaXN0KSksIHRydWUsIChlOiBBcGlFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgICAgICAgIHR4LmNvbW1pdChjYik7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAobmV3UGFyZW50TGlzdFtuZXdOYW1lXSkge1xuICAgICAgICAgIC8vICduZXdQYXRoJyBhbHJlYWR5IGV4aXN0cy4gQ2hlY2sgaWYgaXQncyBhIGZpbGUgb3IgYSBkaXJlY3RvcnksIGFuZFxuICAgICAgICAgIC8vIGFjdCBhY2NvcmRpbmdseS5cbiAgICAgICAgICB0aGlzLmdldElOb2RlKHR4LCBuZXdQYXRoLCBuZXdQYXJlbnRMaXN0W25ld05hbWVdLCAoZTogQXBpRXJyb3IsIGlub2RlPzogSW5vZGUpID0+IHtcbiAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICBpZiAoaW5vZGUuaXNGaWxlKCkpIHtcbiAgICAgICAgICAgICAgICAvLyBEZWxldGUgdGhlIGZpbGUgYW5kIGNvbnRpbnVlLlxuICAgICAgICAgICAgICAgIHR4LmRlbChpbm9kZS5pZCwgKGU/OiBBcGlFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgICAgICAgIHR4LmRlbChuZXdQYXJlbnRMaXN0W25ld05hbWVdLCAoZT86IEFwaUVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0ZVJlbmFtZSgpO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gQ2FuJ3Qgb3ZlcndyaXRlIGEgZGlyZWN0b3J5IHVzaW5nIHJlbmFtZS5cbiAgICAgICAgICAgICAgICB0eC5hYm9ydCgoZT8pID0+IHtcbiAgICAgICAgICAgICAgICAgIGNiKEFwaUVycm9yLkVQRVJNKG5ld1BhdGgpKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbXBsZXRlUmVuYW1lKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogR3JhYnMgYSBwYXRoJ3MgaW5vZGUgYW5kIGRpcmVjdG9yeSBsaXN0aW5nLCBhbmQgc2hvdmVzIGl0IGludG8gdGhlXG4gICAgICogaW5vZGVzIGFuZCBsaXN0cyBoYXNoZXMuXG4gICAgICovXG4gICAgdmFyIHByb2Nlc3NJbm9kZUFuZExpc3RpbmdzID0gKHA6IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgdGhpcy5maW5kSU5vZGVBbmREaXJMaXN0aW5nKHR4LCBwLCAoZTogQXBpRXJyb3IsIG5vZGU/OiBJbm9kZSwgZGlyTGlzdD86IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSk6IHZvaWQgPT4ge1xuICAgICAgICBpZiAoZSkge1xuICAgICAgICAgIGlmICghZXJyb3JPY2N1cnJlZCkge1xuICAgICAgICAgICAgZXJyb3JPY2N1cnJlZCA9IHRydWU7XG4gICAgICAgICAgICB0eC5hYm9ydCgoKSA9PiB7XG4gICAgICAgICAgICAgIGNiKGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIElmIGVycm9yIGhhcyBvY2N1cnJlZCBhbHJlYWR5LCBqdXN0IHN0b3AgaGVyZS5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpbm9kZXNbcF0gPSBub2RlO1xuICAgICAgICAgIGxpc3RzW3BdID0gZGlyTGlzdDtcbiAgICAgICAgICB0aGVPbGVTd2l0Y2hhcm9vKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBwcm9jZXNzSW5vZGVBbmRMaXN0aW5ncyhvbGRQYXJlbnQpO1xuICAgIGlmIChvbGRQYXJlbnQgIT09IG5ld1BhcmVudCkge1xuICAgICAgcHJvY2Vzc0lub2RlQW5kTGlzdGluZ3MobmV3UGFyZW50KTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgc3RhdChwOiBzdHJpbmcsIGlzTHN0YXQ6IGJvb2xlYW4sIGNiOiAoZXJyOiBBcGlFcnJvciwgc3RhdD86IFN0YXRzKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIHR4ID0gdGhpcy5zdG9yZS5iZWdpblRyYW5zYWN0aW9uKCdyZWFkb25seScpO1xuICAgIHRoaXMuZmluZElOb2RlKHR4LCBwLCAoZTogQXBpRXJyb3IsIGlub2RlPzogSW5vZGUpOiB2b2lkID0+IHtcbiAgICAgIGlmIChub0Vycm9yKGUsIGNiKSkge1xuICAgICAgICBjYihudWxsLCBpbm9kZS50b1N0YXRzKCkpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZUZpbGUocDogc3RyaW5nLCBmbGFnOiBmaWxlX2ZsYWcuRmlsZUZsYWcsIG1vZGU6IG51bWJlciwgY2I6IChlOiBBcGlFcnJvciwgZmlsZT86IGZpbGUuRmlsZSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZHdyaXRlJyksXG4gICAgICBkYXRhID0gbmV3IEJ1ZmZlcigwKTtcblxuICAgIHRoaXMuY29tbWl0TmV3RmlsZSh0eCwgcCwgRmlsZVR5cGUuRklMRSwgbW9kZSwgZGF0YSwgKGU6IEFwaUVycm9yLCBuZXdGaWxlPzogSW5vZGUpOiB2b2lkID0+IHtcbiAgICAgIGlmIChub0Vycm9yKGUsIGNiKSkge1xuICAgICAgICBjYihudWxsLCBuZXcgQXN5bmNLZXlWYWx1ZUZpbGUodGhpcywgcCwgZmxhZywgbmV3RmlsZS50b1N0YXRzKCksIGRhdGEpKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBvcGVuRmlsZShwOiBzdHJpbmcsIGZsYWc6IGZpbGVfZmxhZy5GaWxlRmxhZywgY2I6IChlOiBBcGlFcnJvciwgZmlsZT86IGZpbGUuRmlsZSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZG9ubHknKTtcbiAgICAvLyBTdGVwIDE6IEdyYWIgdGhlIGZpbGUncyBpbm9kZS5cbiAgICB0aGlzLmZpbmRJTm9kZSh0eCwgcCwgKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKSA9PiB7XG4gICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgLy8gU3RlcCAyOiBHcmFiIHRoZSBmaWxlJ3MgZGF0YS5cbiAgICAgICAgdHguZ2V0KGlub2RlLmlkLCAoZTogQXBpRXJyb3IsIGRhdGE/OiBOb2RlQnVmZmVyKTogdm9pZCA9PiB7XG4gICAgICAgICAgaWYgKG5vRXJyb3IoZSwgY2IpKSB7XG4gICAgICAgICAgICBpZiAoZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIGNiKEFwaUVycm9yLkVOT0VOVChwKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjYihudWxsLCBuZXcgQXN5bmNLZXlWYWx1ZUZpbGUodGhpcywgcCwgZmxhZywgaW5vZGUudG9TdGF0cygpLCBkYXRhKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIHRyYWNlcyBvZiB0aGUgZ2l2ZW4gcGF0aCBmcm9tIHRoZSBmaWxlIHN5c3RlbS5cbiAgICogQHBhcmFtIHAgVGhlIHBhdGggdG8gcmVtb3ZlIGZyb20gdGhlIGZpbGUgc3lzdGVtLlxuICAgKiBAcGFyYW0gaXNEaXIgRG9lcyB0aGUgcGF0aCBiZWxvbmcgdG8gYSBkaXJlY3RvcnksIG9yIGEgZmlsZT9cbiAgICogQHRvZG8gVXBkYXRlIG10aW1lLlxuICAgKi9cbiAgcHJpdmF0ZSByZW1vdmVFbnRyeShwOiBzdHJpbmcsIGlzRGlyOiBib29sZWFuLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZHdyaXRlJyksXG4gICAgICBwYXJlbnQ6IHN0cmluZyA9IHBhdGguZGlybmFtZShwKSwgZmlsZU5hbWU6IHN0cmluZyA9IHBhdGguYmFzZW5hbWUocCk7XG4gICAgLy8gU3RlcCAxOiBHZXQgcGFyZW50IGRpcmVjdG9yeSdzIG5vZGUgYW5kIGRpcmVjdG9yeSBsaXN0aW5nLlxuICAgIHRoaXMuZmluZElOb2RlQW5kRGlyTGlzdGluZyh0eCwgcGFyZW50LCAoZTogQXBpRXJyb3IsIHBhcmVudE5vZGU/OiBJbm9kZSwgcGFyZW50TGlzdGluZz86IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSk6IHZvaWQgPT4ge1xuICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgIGlmICghcGFyZW50TGlzdGluZ1tmaWxlTmFtZV0pIHtcbiAgICAgICAgICB0eC5hYm9ydCgoKSA9PiB7XG4gICAgICAgICAgICBjYihBcGlFcnJvci5FTk9FTlQocCkpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFJlbW92ZSBmcm9tIGRpcmVjdG9yeSBsaXN0aW5nIG9mIHBhcmVudC5cbiAgICAgICAgICB2YXIgZmlsZU5vZGVJZCA9IHBhcmVudExpc3RpbmdbZmlsZU5hbWVdO1xuICAgICAgICAgIGRlbGV0ZSBwYXJlbnRMaXN0aW5nW2ZpbGVOYW1lXTtcbiAgICAgICAgICAvLyBTdGVwIDI6IEdldCBmaWxlIGlub2RlLlxuICAgICAgICAgIHRoaXMuZ2V0SU5vZGUodHgsIHAsIGZpbGVOb2RlSWQsIChlOiBBcGlFcnJvciwgZmlsZU5vZGU/OiBJbm9kZSk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgIGlmICghaXNEaXIgJiYgZmlsZU5vZGUuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgICAgICAgIHR4LmFib3J0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgIGNiKEFwaUVycm9yLkVJU0RJUihwKSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNEaXIgJiYgIWZpbGVOb2RlLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICB0eC5hYm9ydCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICBjYihBcGlFcnJvci5FTk9URElSKHApKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBTdGVwIDM6IERlbGV0ZSBkYXRhLlxuICAgICAgICAgICAgICAgIHR4LmRlbChmaWxlTm9kZS5pZCwgKGU/OiBBcGlFcnJvcik6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFN0ZXAgNDogRGVsZXRlIG5vZGUuXG4gICAgICAgICAgICAgICAgICAgIHR4LmRlbChmaWxlTm9kZUlkLCAoZT86IEFwaUVycm9yKTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBTdGVwIDU6IFVwZGF0ZSBkaXJlY3RvcnkgbGlzdGluZy5cbiAgICAgICAgICAgICAgICAgICAgICAgIHR4LnB1dChwYXJlbnROb2RlLmlkLCBuZXcgQnVmZmVyKEpTT04uc3RyaW5naWZ5KHBhcmVudExpc3RpbmcpKSwgdHJ1ZSwgKGU6IEFwaUVycm9yKTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR4LmNvbW1pdChjYik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIHVubGluayhwOiBzdHJpbmcsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5yZW1vdmVFbnRyeShwLCBmYWxzZSwgY2IpO1xuICB9XG5cbiAgcHVibGljIHJtZGlyKHA6IHN0cmluZywgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLnJlbW92ZUVudHJ5KHAsIHRydWUsIGNiKTtcbiAgfVxuXG4gIHB1YmxpYyBta2RpcihwOiBzdHJpbmcsIG1vZGU6IG51bWJlciwgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpLFxuICAgICAgZGF0YSA9IG5ldyBCdWZmZXIoJ3t9Jyk7XG4gICAgdGhpcy5jb21taXROZXdGaWxlKHR4LCBwLCBGaWxlVHlwZS5ESVJFQ1RPUlksIG1vZGUsIGRhdGEsIGNiKTtcbiAgfVxuXG4gIHB1YmxpYyByZWFkZGlyKHA6IHN0cmluZywgY2I6IChlcnI6IEFwaUVycm9yLCBmaWxlcz86IHN0cmluZ1tdKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIHR4ID0gdGhpcy5zdG9yZS5iZWdpblRyYW5zYWN0aW9uKCdyZWFkb25seScpO1xuICAgIHRoaXMuZmluZElOb2RlKHR4LCBwLCAoZTogQXBpRXJyb3IsIGlub2RlPzogSW5vZGUpID0+IHtcbiAgICAgIGlmIChub0Vycm9yKGUsIGNiKSkge1xuICAgICAgICB0aGlzLmdldERpckxpc3RpbmcodHgsIHAsIGlub2RlLCAoZTogQXBpRXJyb3IsIGRpckxpc3Rpbmc/OiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30pID0+IHtcbiAgICAgICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgICAgIGNiKG51bGwsIE9iamVjdC5rZXlzKGRpckxpc3RpbmcpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIF9zeW5jKHA6IHN0cmluZywgZGF0YTogTm9kZUJ1ZmZlciwgc3RhdHM6IFN0YXRzLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIC8vIEB0b2RvIEVuc3VyZSBtdGltZSB1cGRhdGVzIHByb3Blcmx5LCBhbmQgdXNlIHRoYXQgdG8gZGV0ZXJtaW5lIGlmIGEgZGF0YVxuICAgIC8vICAgICAgIHVwZGF0ZSBpcyByZXF1aXJlZC5cbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpO1xuICAgIC8vIFN0ZXAgMTogR2V0IHRoZSBmaWxlIG5vZGUncyBJRC5cbiAgICB0aGlzLl9maW5kSU5vZGUodHgsIHBhdGguZGlybmFtZShwKSwgcGF0aC5iYXNlbmFtZShwKSwgKGU6IEFwaUVycm9yLCBmaWxlSW5vZGVJZD86IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgIC8vIFN0ZXAgMjogR2V0IHRoZSBmaWxlIGlub2RlLlxuICAgICAgICB0aGlzLmdldElOb2RlKHR4LCBwLCBmaWxlSW5vZGVJZCwgKGU6IEFwaUVycm9yLCBmaWxlSW5vZGU/OiBJbm9kZSk6IHZvaWQgPT4ge1xuICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgdmFyIGlub2RlQ2hhbmdlZDogYm9vbGVhbiA9IGZpbGVJbm9kZS51cGRhdGUoc3RhdHMpO1xuICAgICAgICAgICAgLy8gU3RlcCAzOiBTeW5jIHRoZSBkYXRhLlxuICAgICAgICAgICAgdHgucHV0KGZpbGVJbm9kZS5pZCwgZGF0YSwgdHJ1ZSwgKGU6IEFwaUVycm9yKTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICAgIC8vIFN0ZXAgNDogU3luYyB0aGUgbWV0YWRhdGEgKGlmIGl0IGNoYW5nZWQpIVxuICAgICAgICAgICAgICAgIGlmIChpbm9kZUNoYW5nZWQpIHtcbiAgICAgICAgICAgICAgICAgIHR4LnB1dChmaWxlSW5vZGVJZCwgZmlsZUlub2RlLnRvQnVmZmVyKCksIHRydWUsIChlOiBBcGlFcnJvcik6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgICAgICAgICB0eC5jb21taXQoY2IpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgLy8gTm8gbmVlZCB0byBzeW5jIG1ldGFkYXRhOyByZXR1cm4uXG4gICAgICAgICAgICAgICAgICB0eC5jb21taXQoY2IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuIl19