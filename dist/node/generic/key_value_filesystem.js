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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2V5X3ZhbHVlX2ZpbGVzeXN0ZW0uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvZ2VuZXJpYy9rZXlfdmFsdWVfZmlsZXN5c3RlbS50cyJdLCJuYW1lcyI6WyJHZW5lcmF0ZVJhbmRvbUlEIiwibm9FcnJvciIsIm5vRXJyb3JUeCIsIlNpbXBsZVN5bmNSV1RyYW5zYWN0aW9uIiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24uY29uc3RydWN0b3IiLCJTaW1wbGVTeW5jUldUcmFuc2FjdGlvbi5zdGFzaE9sZFZhbHVlIiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24ubWFya01vZGlmaWVkIiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24uZ2V0IiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24ucHV0IiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24uZGVsIiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24uY29tbWl0IiwiU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24uYWJvcnQiLCJTeW5jS2V5VmFsdWVGaWxlIiwiU3luY0tleVZhbHVlRmlsZS5jb25zdHJ1Y3RvciIsIlN5bmNLZXlWYWx1ZUZpbGUuc3luY1N5bmMiLCJTeW5jS2V5VmFsdWVGaWxlLmNsb3NlU3luYyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0iLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmNvbnN0cnVjdG9yIiwiU3luY0tleVZhbHVlRmlsZVN5c3RlbS5pc0F2YWlsYWJsZSIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uZ2V0TmFtZSIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uaXNSZWFkT25seSIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uc3VwcG9ydHNTeW1saW5rcyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uc3VwcG9ydHNQcm9wcyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uc3VwcG9ydHNTeW5jaCIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0ubWFrZVJvb3REaXJlY3RvcnkiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLl9maW5kSU5vZGUiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmZpbmRJTm9kZSIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uZ2V0SU5vZGUiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmdldERpckxpc3RpbmciLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmFkZE5ld05vZGUiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmNvbW1pdE5ld0ZpbGUiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmVtcHR5IiwiU3luY0tleVZhbHVlRmlsZVN5c3RlbS5yZW5hbWVTeW5jIiwiU3luY0tleVZhbHVlRmlsZVN5c3RlbS5zdGF0U3luYyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uY3JlYXRlRmlsZVN5bmMiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLm9wZW5GaWxlU3luYyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0ucmVtb3ZlRW50cnkiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLnVubGlua1N5bmMiLCJTeW5jS2V5VmFsdWVGaWxlU3lzdGVtLnJtZGlyU3luYyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0ubWtkaXJTeW5jIiwiU3luY0tleVZhbHVlRmlsZVN5c3RlbS5yZWFkZGlyU3luYyIsIlN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uX3N5bmNTeW5jIiwiQXN5bmNLZXlWYWx1ZUZpbGUiLCJBc3luY0tleVZhbHVlRmlsZS5jb25zdHJ1Y3RvciIsIkFzeW5jS2V5VmFsdWVGaWxlLnN5bmMiLCJBc3luY0tleVZhbHVlRmlsZS5jbG9zZSIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uY29uc3RydWN0b3IiLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5pbml0IiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uaXNBdmFpbGFibGUiLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5nZXROYW1lIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uaXNSZWFkT25seSIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLnN1cHBvcnRzU3ltbGlua3MiLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5zdXBwb3J0c1Byb3BzIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uc3VwcG9ydHNTeW5jaCIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLm1ha2VSb290RGlyZWN0b3J5IiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uX2ZpbmRJTm9kZSIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmZpbmRJTm9kZSIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmdldElOb2RlIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uZ2V0RGlyTGlzdGluZyIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmZpbmRJTm9kZUFuZERpckxpc3RpbmciLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5hZGROZXdOb2RlIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uY29tbWl0TmV3RmlsZSIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmVtcHR5IiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0ucmVuYW1lIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0uc3RhdCIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLmNyZWF0ZUZpbGUiLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5vcGVuRmlsZSIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLnJlbW92ZUVudHJ5IiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0udW5saW5rIiwiQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0ucm1kaXIiLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5ta2RpciIsIkFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtLnJlYWRkaXIiLCJBc3luY0tleVZhbHVlRmlsZVN5c3RlbS5fc3luYyJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxJQUFPLFdBQVcsV0FBVyxxQkFBcUIsQ0FBQyxDQUFDO0FBQ3BELDBC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Q0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDM0JBLENBQUNBO1FBR0RBLEVBQUVBLENBQUNBLENBQUNBLFVBQVVBLENBQUNBLEtBQUtBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1lBQ3RCQSxNQUFNQSxvQkFBUUEsQ0FBQ0EsTUFBTUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7UUFDM0JBLENBQUNBO1FBRURBLElBQUlBLENBQUNBO1lBRUhBLElBQUlBLE1BQU1BLEdBQUdBLElBQUlBLENBQUNBLFVBQVVBLENBQUNBLEVBQUVBLEVBQUVBLElBQUlBLENBQUNBLEVBQ3BDQSxRQUFRQSxHQUFHQSxJQUFJQSxLQUFLQSxDQUFDQSxNQUFNQSxFQUFFQSxJQUFJQSxDQUFDQSxNQUFNQSxFQUFFQSxJQUFJQSxHQUFHQSxJQUFJQSxFQUFFQSxRQUFRQSxFQUFFQSxRQUFRQSxFQUFFQSxRQUFRQSxDQUFDQSxFQUVwRkEsVUFBVUEsR0FBR0EsSUFBSUEsQ0FBQ0EsVUFBVUEsQ0FBQ0EsRUFBRUEsRUFBRUEsUUFBUUEsQ0FBQ0EsUUFBUUEsRUFBRUEsQ0FBQ0EsQ0FBQ0E7WUFFeERBLFVBQVVBLENBQUNBLEtBQUtBLENBQUNBLEdBQUdBLFVBQVVBLENBQUNBO1lBQy9CQSxFQUFFQSxDQUFDQSxHQUFHQSxDQUFDQSxVQUFVQSxDQUFDQSxFQUFFQSxFQUFFQSxJQUFJQSxNQUFNQSxDQUFDQSxJQUFJQSxDQUFDQSxTQUFTQSxDQUFDQSxVQUFVQSxDQUFDQSxDQUFDQSxFQUFFQSxJQUFJQSxDQUFDQSxDQUFDQTtRQUN0RUEsQ0FBRUE7UUFBQUEsS0FBS0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFDWEEsRUFBRUEsQ0FBQ0EsS0FBS0EsRUFBRUEsQ0FBQ0E7WUFDWEEsTUFBTUEsQ0FBQ0EsQ0FBQ0E7UUFDVkEsQ0FBQ0E7UUFDREEsRUFBRUEsQ0FBQ0EsTUFBTUEsRUFBRUEsQ0FBQ0E7UUFDWkEsTUFBTUEsQ0FBQ0EsUUFBUUEsQ0FBQ0E7SUFDbEJBLENBQUNBO0lBS01kLHNDQUFLQSxHQUFaQTtR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QUNBLE1BQU1BLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1FBQ2hDQSxDQUFDQTtRQUtEQSxJQUFJQSxDQUFDQSxzQkFBc0JBLENBQUNBLEVBQUVBLEVBQUVBLFNBQVNBLEVBQUVBLFVBQUNBLENBQVdBLEVBQUVBLFVBQWtCQSxFQUFFQSxVQUFxQ0E7WUFDaEhBLEVBQUVBLENBQUNBLENBQUNBLFNBQVNBLENBQUNBLENBQUNBLEVBQUVBLEVBQUVBLEVBQUVBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO2dCQUN6QkEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsVUFBVUEsQ0FBQ0EsS0FBS0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7b0JBRXRCQSxFQUFFQSxDQUFDQSxLQUFLQSxDQUFDQTt3QkFDUEEsRUFBRUEsQ0FBQ0Esb0JBQVFBLENBQUNBLE1BQU1BLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO29CQUN6QkEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7Z0JBQ0xBLENBQUNBO2dCQUFDQSxJQUFJQSxDQUFDQSxDQUFDQTtvQkFFTkEsS0FBSUEsQ0FBQ0EsVUFBVUEsQ0FBQ0EsRUFBRUEsRUFBRUEsSUFBSUEsRUFBRUEsVUFBQ0EsQ0FBV0EsRUFBRUEsTUFBZUE7d0JBQ3JEQSxFQUFFQSxDQUFDQSxDQUFDQSxTQUFTQSxDQUFDQSxDQUFDQSxFQUFFQSxFQUFFQSxFQUFFQSxFQUFFQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQTs0QkFFekJBLElBQUlBLFNBQVNBLEdBQUdBLElBQUlBLEtBQUtBLENBQUNBLE1BQU1BLEVBQUVBLElBQUlBLENBQUNBLE1BQU1BLEVBQUVBLElBQUlBLEdBQUdBLElBQUlBLEVBQUVBLFFBQVFBLEVBQUVBLFFBQVFBLEVBQUVBLFFBQVFBLENBQUNBLENBQUNBOzRCQUMxRkEsS0FBSUEsQ0FBQ0EsVUFBVUEsQ0FBQ0EsRUFBRUEsRUFBRUEsU0FBU0EsQ0FBQ0EsUUFBUUEsRUFBRUEsRUFBRUEsVUFBQ0EsQ0FBV0EsRUFBRUEsV0FBb0JBO2dDQUMxRUEsRUFBRUEs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LENBQUNBLENBQUNBO2dDQUNMQSxDQUFDQTtnQ0FBQ0EsSUFBSUEsQ0FBQ0EsQ0FBQ0E7b0NBRU5BLEVBQUVBLENBQUNBLE1BQU1BLENBQUNBLEVBQUVBLENBQUNBLENBQUNBO2dDQUNoQkEsQ0FBQ0E7NEJBQ0hBLENBQUNBO3dCQUNIQSxDQUFDQSxDQUFDQSxDQUFDQTtvQkFDTEEsQ0FBQ0E7Z0JBQ0hBLENBQUNBLENBQUNBLENBQUNBO1lBQ0xBLENBQUNBO1FBQ0hBLENBQUNBLENBQUNBLENBQUNBO0lBQ0xBLENBQUNBO0lBQ0gzQiw4QkFBQ0E7QUFBREEsQ0FBQ0EsQUF2aEJELEVBQTZDLFdBQVcsQ0FBQyxjQUFjLEVBdWhCdEU7QUF2aEJZLCtCQUF1QiwwQkF1aEJuQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGZpbGVfc3lzdGVtID0gcmVxdWlyZSgnLi4vY29yZS9maWxlX3N5c3RlbScpO1xuaW1wb3J0IHtBcGlFcnJvciwgRXJyb3JDb2RlfSBmcm9tICcuLi9jb3JlL2FwaV9lcnJvcic7XG5pbXBvcnQge2RlZmF1bHQgYXMgU3RhdHMsIEZpbGVUeXBlfSBmcm9tICcuLi9jb3JlL25vZGVfZnNfc3RhdHMnO1xuaW1wb3J0IGZpbGUgPSByZXF1aXJlKCcuLi9jb3JlL2ZpbGUnKTtcbmltcG9ydCBmaWxlX2ZsYWcgPSByZXF1aXJlKCcuLi9jb3JlL2ZpbGVfZmxhZycpO1xuaW1wb3J0IHBhdGggPSByZXF1aXJlKCdwYXRoJyk7XG5pbXBvcnQgSW5vZGUgPSByZXF1aXJlKCcuLi9nZW5lcmljL2lub2RlJyk7XG5pbXBvcnQgcHJlbG9hZF9maWxlID0gcmVxdWlyZSgnLi4vZ2VuZXJpYy9wcmVsb2FkX2ZpbGUnKTtcbnZhciBST09UX05PREVfSUQ6IHN0cmluZyA9IFwiL1wiO1xuXG4vKipcbiAqIEdlbmVyYXRlcyBhIHJhbmRvbSBJRC5cbiAqL1xuZnVuY3Rpb24gR2VuZXJhdGVSYW5kb21JRCgpOiBzdHJpbmcge1xuICAvLyBGcm9tIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTA1MDM0L2hvdy10by1jcmVhdGUtYS1ndWlkLXV1aWQtaW4tamF2YXNjcmlwdFxuICByZXR1cm4gJ3h4eHh4eHh4LXh4eHgtNHh4eC15eHh4LXh4eHh4eHh4eHh4eCcucmVwbGFjZSgvW3h5XS9nLCBmdW5jdGlvbiAoYykge1xuICAgIHZhciByID0gTWF0aC5yYW5kb20oKSAqIDE2IHwgMCwgdiA9IGMgPT0gJ3gnID8gciA6IChyICYgMHgzIHwgMHg4KTtcbiAgICByZXR1cm4gdi50b1N0cmluZygxNik7XG4gIH0pO1xufVxuXG4vKipcbiAqIEhlbHBlciBmdW5jdGlvbi4gQ2hlY2tzIGlmICdlJyBpcyBkZWZpbmVkLiBJZiBzbywgaXQgdHJpZ2dlcnMgdGhlIGNhbGxiYWNrXG4gKiB3aXRoICdlJyBhbmQgcmV0dXJucyBmYWxzZS4gT3RoZXJ3aXNlLCByZXR1cm5zIHRydWUuXG4gKi9cbmZ1bmN0aW9uIG5vRXJyb3IoZTogQXBpRXJyb3IsIGNiOiAoZTogQXBpRXJyb3IpID0+IHZvaWQpOiBib29sZWFuIHtcbiAgaWYgKGUpIHtcbiAgICBjYihlKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uLiBDaGVja3MgaWYgJ2UnIGlzIGRlZmluZWQuIElmIHNvLCBpdCBhYm9ydHMgdGhlIHRyYW5zYWN0aW9uLFxuICogdHJpZ2dlcnMgdGhlIGNhbGxiYWNrIHdpdGggJ2UnLCBhbmQgcmV0dXJucyBmYWxzZS4gT3RoZXJ3aXNlLCByZXR1cm5zIHRydWUuXG4gKi9cbmZ1bmN0aW9uIG5vRXJyb3JUeChlOiBBcGlFcnJvciwgdHg6IEFzeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uLCBjYjogKGU6IEFwaUVycm9yKSA9PiB2b2lkKTogYm9vbGVhbiB7XG4gIGlmIChlKSB7XG4gICAgdHguYWJvcnQoKCkgPT4ge1xuICAgICAgY2IoZSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYSAqc3luY2hyb25vdXMqIGtleS12YWx1ZSBzdG9yZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTeW5jS2V5VmFsdWVTdG9yZSB7XG4gIC8qKlxuICAgKiBUaGUgbmFtZSBvZiB0aGUga2V5LXZhbHVlIHN0b3JlLlxuICAgKi9cbiAgbmFtZSgpOiBzdHJpbmc7XG4gIC8qKlxuICAgKiBFbXB0aWVzIHRoZSBrZXktdmFsdWUgc3RvcmUgY29tcGxldGVseS5cbiAgICovXG4gIGNsZWFyKCk6IHZvaWQ7XG4gIC8qKlxuICAgKiBCZWdpbnMgYSBuZXcgcmVhZC1vbmx5IHRyYW5zYWN0aW9uLlxuICAgKi9cbiAgYmVnaW5UcmFuc2FjdGlvbih0eXBlOiBcInJlYWRvbmx5XCIpOiBTeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uO1xuICAvKipcbiAgICogQmVnaW5zIGEgbmV3IHJlYWQtd3JpdGUgdHJhbnNhY3Rpb24uXG4gICAqL1xuICBiZWdpblRyYW5zYWN0aW9uKHR5cGU6IFwicmVhZHdyaXRlXCIpOiBTeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uO1xuICBiZWdpblRyYW5zYWN0aW9uKHR5cGU6IHN0cmluZyk6IFN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb247XG59XG5cbi8qKlxuICogQSByZWFkLW9ubHkgdHJhbnNhY3Rpb24gZm9yIGEgc3luY2hyb25vdXMga2V5IHZhbHVlIHN0b3JlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb24ge1xuICAvKipcbiAgICogUmV0cmlldmVzIHRoZSBkYXRhIGF0IHRoZSBnaXZlbiBrZXkuIFRocm93cyBhbiBBcGlFcnJvciBpZiBhbiBlcnJvciBvY2N1cnNcbiAgICogb3IgaWYgdGhlIGtleSBkb2VzIG5vdCBleGlzdC5cbiAgICogQHBhcmFtIGtleSBUaGUga2V5IHRvIGxvb2sgdW5kZXIgZm9yIGRhdGEuXG4gICAqIEByZXR1cm4gVGhlIGRhdGEgc3RvcmVkIHVuZGVyIHRoZSBrZXksIG9yIHVuZGVmaW5lZCBpZiBub3QgcHJlc2VudC5cbiAgICovXG4gIGdldChrZXk6IHN0cmluZyk6IE5vZGVCdWZmZXI7XG59XG5cbi8qKlxuICogQSByZWFkLXdyaXRlIHRyYW5zYWN0aW9uIGZvciBhIHN5bmNocm9ub3VzIGtleSB2YWx1ZSBzdG9yZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uIGV4dGVuZHMgU3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbiB7XG4gIC8qKlxuICAgKiBBZGRzIHRoZSBkYXRhIHRvIHRoZSBzdG9yZSB1bmRlciB0aGUgZ2l2ZW4ga2V5LlxuICAgKiBAcGFyYW0ga2V5IFRoZSBrZXkgdG8gYWRkIHRoZSBkYXRhIHVuZGVyLlxuICAgKiBAcGFyYW0gZGF0YSBUaGUgZGF0YSB0byBhZGQgdG8gdGhlIHN0b3JlLlxuICAgKiBAcGFyYW0gb3ZlcndyaXRlIElmICd0cnVlJywgb3ZlcndyaXRlIGFueSBleGlzdGluZyBkYXRhLiBJZiAnZmFsc2UnLFxuICAgKiAgIGF2b2lkcyBzdG9yaW5nIHRoZSBkYXRhIGlmIHRoZSBrZXkgZXhpc3RzLlxuICAgKiBAcmV0dXJuIFRydWUgaWYgc3RvcmFnZSBzdWNjZWVkZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAgICovXG4gIHB1dChrZXk6IHN0cmluZywgZGF0YTogTm9kZUJ1ZmZlciwgb3ZlcndyaXRlOiBib29sZWFuKTogYm9vbGVhbjtcbiAgLyoqXG4gICAqIERlbGV0ZXMgdGhlIGRhdGEgYXQgdGhlIGdpdmVuIGtleS5cbiAgICogQHBhcmFtIGtleSBUaGUga2V5IHRvIGRlbGV0ZSBmcm9tIHRoZSBzdG9yZS5cbiAgICovXG4gIGRlbChrZXk6IHN0cmluZyk6IHZvaWQ7XG4gIC8qKlxuICAgKiBDb21taXRzIHRoZSB0cmFuc2FjdGlvbi5cbiAgICovXG4gIGNvbW1pdCgpOiB2b2lkO1xuICAvKipcbiAgICogQWJvcnRzIGFuZCByb2xscyBiYWNrIHRoZSB0cmFuc2FjdGlvbi5cbiAgICovXG4gIGFib3J0KCk6IHZvaWQ7XG59XG5cbi8qKlxuICogQW4gaW50ZXJmYWNlIGZvciBzaW1wbGUgc3luY2hyb25vdXMga2V5LXZhbHVlIHN0b3JlcyB0aGF0IGRvbid0IGhhdmUgc3BlY2lhbFxuICogc3VwcG9ydCBmb3IgdHJhbnNhY3Rpb25zIGFuZCBzdWNoLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFNpbXBsZVN5bmNTdG9yZSB7XG4gIGdldChrZXk6IHN0cmluZyk6IE5vZGVCdWZmZXI7XG4gIHB1dChrZXk6IHN0cmluZywgZGF0YTogTm9kZUJ1ZmZlciwgb3ZlcndyaXRlOiBib29sZWFuKTogYm9vbGVhbjtcbiAgZGVsKGtleTogc3RyaW5nKTogdm9pZDtcbn1cblxuLyoqXG4gKiBBIHNpbXBsZSBSVyB0cmFuc2FjdGlvbiBmb3Igc2ltcGxlIHN5bmNocm9ub3VzIGtleS12YWx1ZSBzdG9yZXMuXG4gKi9cbmV4cG9ydCBjbGFzcyBTaW1wbGVTeW5jUldUcmFuc2FjdGlvbiBpbXBsZW1lbnRzIFN5bmNLZXlWYWx1ZVJXVHJhbnNhY3Rpb24ge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHN0b3JlOiBTaW1wbGVTeW5jU3RvcmUpIHsgfVxuICAvKipcbiAgICogU3RvcmVzIGRhdGEgaW4gdGhlIGtleXMgd2UgbW9kaWZ5IHByaW9yIHRvIG1vZGlmeWluZyB0aGVtLlxuICAgKiBBbGxvd3MgdXMgdG8gcm9sbCBiYWNrIGNvbW1pdHMuXG4gICAqL1xuICBwcml2YXRlIG9yaWdpbmFsRGF0YTogeyBba2V5OiBzdHJpbmddOiBOb2RlQnVmZmVyIH0gPSB7fTtcbiAgLyoqXG4gICAqIExpc3Qgb2Yga2V5cyBtb2RpZmllZCBpbiB0aGlzIHRyYW5zYWN0aW9uLCBpZiBhbnkuXG4gICAqL1xuICBwcml2YXRlIG1vZGlmaWVkS2V5czogc3RyaW5nW10gPSBbXTtcbiAgLyoqXG4gICAqIFN0YXNoZXMgZ2l2ZW4ga2V5IHZhbHVlIHBhaXIgaW50byBgb3JpZ2luYWxEYXRhYCBpZiBpdCBkb2Vzbid0IGFscmVhZHlcbiAgICogZXhpc3QuIEFsbG93cyB1cyB0byBzdGFzaCB2YWx1ZXMgdGhlIHByb2dyYW0gaXMgcmVxdWVzdGluZyBhbnl3YXkgdG9cbiAgICogcHJldmVudCBuZWVkbGVzcyBgZ2V0YCByZXF1ZXN0cyBpZiB0aGUgcHJvZ3JhbSBtb2RpZmllcyB0aGUgZGF0YSBsYXRlclxuICAgKiBvbiBkdXJpbmcgdGhlIHRyYW5zYWN0aW9uLlxuICAgKi9cbiAgcHJpdmF0ZSBzdGFzaE9sZFZhbHVlKGtleTogc3RyaW5nLCB2YWx1ZTogTm9kZUJ1ZmZlcikge1xuICAgIC8vIEtlZXAgb25seSB0aGUgZWFybGllc3QgdmFsdWUgaW4gdGhlIHRyYW5zYWN0aW9uLlxuICAgIGlmICghdGhpcy5vcmlnaW5hbERhdGEuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgdGhpcy5vcmlnaW5hbERhdGFba2V5XSA9IHZhbHVlXG4gICAgfVxuICB9XG4gIC8qKlxuICAgKiBNYXJrcyB0aGUgZ2l2ZW4ga2V5IGFzIG1vZGlmaWVkLCBhbmQgc3Rhc2hlcyBpdHMgdmFsdWUgaWYgaXQgaGFzIG5vdCBiZWVuXG4gICAqIHN0YXNoZWQgYWxyZWFkeS5cbiAgICovXG4gIHByaXZhdGUgbWFya01vZGlmaWVkKGtleTogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMubW9kaWZpZWRLZXlzLmluZGV4T2Yoa2V5KSA9PT0gLTEpIHtcbiAgICAgIHRoaXMubW9kaWZpZWRLZXlzLnB1c2goa2V5KTtcbiAgICAgIGlmICghdGhpcy5vcmlnaW5hbERhdGEuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICB0aGlzLm9yaWdpbmFsRGF0YVtrZXldID0gdGhpcy5zdG9yZS5nZXQoa2V5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwdWJsaWMgZ2V0KGtleTogc3RyaW5nKTogTm9kZUJ1ZmZlciB7XG4gICAgdmFyIHZhbCA9IHRoaXMuc3RvcmUuZ2V0KGtleSk7XG4gICAgdGhpcy5zdGFzaE9sZFZhbHVlKGtleSwgdmFsKTtcbiAgICByZXR1cm4gdmFsO1xuICB9XG5cbiAgcHVibGljIHB1dChrZXk6IHN0cmluZywgZGF0YTogTm9kZUJ1ZmZlciwgb3ZlcndyaXRlOiBib29sZWFuKTogYm9vbGVhbiB7XG4gICAgdGhpcy5tYXJrTW9kaWZpZWQoa2V5KTtcbiAgICByZXR1cm4gdGhpcy5zdG9yZS5wdXQoa2V5LCBkYXRhLCBvdmVyd3JpdGUpO1xuICB9XG5cbiAgcHVibGljIGRlbChrZXk6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMubWFya01vZGlmaWVkKGtleSk7XG4gICAgdGhpcy5zdG9yZS5kZWwoa2V5KTtcbiAgfVxuXG4gIHB1YmxpYyBjb21taXQoKTogdm9pZCB7LyogTk9QICovfVxuICBwdWJsaWMgYWJvcnQoKTogdm9pZCB7XG4gICAgLy8gUm9sbGJhY2sgb2xkIHZhbHVlcy5cbiAgICB2YXIgaTogbnVtYmVyLCBrZXk6IHN0cmluZywgdmFsdWU6IE5vZGVCdWZmZXI7XG4gICAgZm9yIChpID0gMDsgaSA8IHRoaXMubW9kaWZpZWRLZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBrZXkgPSB0aGlzLm1vZGlmaWVkS2V5c1tpXTtcbiAgICAgIHZhbHVlID0gdGhpcy5vcmlnaW5hbERhdGFba2V5XTtcbiAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICAvLyBLZXkgZGlkbid0IGV4aXN0LlxuICAgICAgICB0aGlzLnN0b3JlLmRlbChrZXkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gS2V5IGV4aXN0ZWQuIFN0b3JlIG9sZCB2YWx1ZS5cbiAgICAgICAgdGhpcy5zdG9yZS5wdXQoa2V5LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3luY0tleVZhbHVlRmlsZVN5c3RlbU9wdGlvbnMge1xuICAvKipcbiAgICogVGhlIGFjdHVhbCBrZXktdmFsdWUgc3RvcmUgdG8gcmVhZCBmcm9tL3dyaXRlIHRvLlxuICAgKi9cbiAgc3RvcmU6IFN5bmNLZXlWYWx1ZVN0b3JlO1xuICAvKipcbiAgICogU2hvdWxkIHRoZSBmaWxlIHN5c3RlbSBzdXBwb3J0IHByb3BlcnRpZXMgKG10aW1lL2F0aW1lL2N0aW1lL2NobW9kL2V0Yyk/XG4gICAqIEVuYWJsaW5nIHRoaXMgc2xpZ2h0bHkgaW5jcmVhc2VzIHRoZSBzdG9yYWdlIHNwYWNlIHBlciBmaWxlLCBhbmQgYWRkc1xuICAgKiBhdGltZSB1cGRhdGVzIGV2ZXJ5IHRpbWUgYSBmaWxlIGlzIGFjY2Vzc2VkLCBtdGltZSB1cGRhdGVzIGV2ZXJ5IHRpbWVcbiAgICogYSBmaWxlIGlzIG1vZGlmaWVkLCBhbmQgcGVybWlzc2lvbiBjaGVja3Mgb24gZXZlcnkgb3BlcmF0aW9uLlxuICAgKlxuICAgKiBEZWZhdWx0cyB0byAqZmFsc2UqLlxuICAgKi9cbiAgLy9zdXBwb3J0UHJvcHM/OiBib29sZWFuO1xuICAvKipcbiAgICogU2hvdWxkIHRoZSBmaWxlIHN5c3RlbSBzdXBwb3J0IGxpbmtzP1xuICAgKi9cbiAgLy9zdXBwb3J0TGlua3M/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgU3luY0tleVZhbHVlRmlsZSBleHRlbmRzIHByZWxvYWRfZmlsZS5QcmVsb2FkRmlsZTxTeW5jS2V5VmFsdWVGaWxlU3lzdGVtPiBpbXBsZW1lbnRzIGZpbGUuRmlsZSB7XG4gIGNvbnN0cnVjdG9yKF9mczogU3luY0tleVZhbHVlRmlsZVN5c3RlbSwgX3BhdGg6IHN0cmluZywgX2ZsYWc6IGZpbGVfZmxhZy5GaWxlRmxhZywgX3N0YXQ6IFN0YXRzLCBjb250ZW50cz86IE5vZGVCdWZmZXIpIHtcbiAgICBzdXBlcihfZnMsIF9wYXRoLCBfZmxhZywgX3N0YXQsIGNvbnRlbnRzKTtcbiAgfVxuXG4gIHB1YmxpYyBzeW5jU3luYygpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5pc0RpcnR5KCkpIHtcbiAgICAgIHRoaXMuX2ZzLl9zeW5jU3luYyh0aGlzLmdldFBhdGgoKSwgdGhpcy5nZXRCdWZmZXIoKSwgdGhpcy5nZXRTdGF0cygpKTtcbiAgICAgIHRoaXMucmVzZXREaXJ0eSgpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBjbG9zZVN5bmMoKTogdm9pZCB7XG4gICAgdGhpcy5zeW5jU3luYygpO1xuICB9XG59XG5cbi8qKlxuICogQSBcIlN5bmNocm9ub3VzIGtleS12YWx1ZSBmaWxlIHN5c3RlbVwiLiBTdG9yZXMgZGF0YSB0by9yZXRyaWV2ZXMgZGF0YSBmcm9tIGFuXG4gKiB1bmRlcmx5aW5nIGtleS12YWx1ZSBzdG9yZS5cbiAqXG4gKiBXZSB1c2UgYSB1bmlxdWUgSUQgZm9yIGVhY2ggbm9kZSBpbiB0aGUgZmlsZSBzeXN0ZW0uIFRoZSByb290IG5vZGUgaGFzIGFcbiAqIGZpeGVkIElELlxuICogQHRvZG8gSW50cm9kdWNlIE5vZGUgSUQgY2FjaGluZy5cbiAqIEB0b2RvIENoZWNrIG1vZGVzLlxuICovXG5leHBvcnQgY2xhc3MgU3luY0tleVZhbHVlRmlsZVN5c3RlbSBleHRlbmRzIGZpbGVfc3lzdGVtLlN5bmNocm9ub3VzRmlsZVN5c3RlbSB7XG4gIHByaXZhdGUgc3RvcmU6IFN5bmNLZXlWYWx1ZVN0b3JlO1xuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBTeW5jS2V5VmFsdWVGaWxlU3lzdGVtT3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5zdG9yZSA9IG9wdGlvbnMuc3RvcmU7XG4gICAgLy8gSU5WQVJJQU5UOiBFbnN1cmUgdGhhdCB0aGUgcm9vdCBleGlzdHMuXG4gICAgdGhpcy5tYWtlUm9vdERpcmVjdG9yeSgpO1xuICB9XG5cbiAgcHVibGljIHN0YXRpYyBpc0F2YWlsYWJsZSgpOiBib29sZWFuIHsgcmV0dXJuIHRydWU7IH1cbiAgcHVibGljIGdldE5hbWUoKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuc3RvcmUubmFtZSgpOyB9XG4gIHB1YmxpYyBpc1JlYWRPbmx5KCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cbiAgcHVibGljIHN1cHBvcnRzU3ltbGlua3MoKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuICBwdWJsaWMgc3VwcG9ydHNQcm9wcygpOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlOyB9XG4gIHB1YmxpYyBzdXBwb3J0c1N5bmNoKCk6IGJvb2xlYW4geyByZXR1cm4gdHJ1ZTsgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgdGhlIHJvb3QgZGlyZWN0b3J5IGV4aXN0cy4gQ3JlYXRlcyBpdCBpZiBpdCBkb2Vzbid0LlxuICAgKi9cbiAgcHJpdmF0ZSBtYWtlUm9vdERpcmVjdG9yeSgpIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpO1xuICAgIGlmICh0eC5nZXQoUk9PVF9OT0RFX0lEKSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBDcmVhdGUgbmV3IGlub2RlLlxuICAgICAgdmFyIGN1cnJUaW1lID0gKG5ldyBEYXRlKCkpLmdldFRpbWUoKSxcbiAgICAgICAgLy8gTW9kZSAwNjY2XG4gICAgICAgIGRpcklub2RlID0gbmV3IElub2RlKEdlbmVyYXRlUmFuZG9tSUQoKSwgNDA5NiwgNTExIHwgRmlsZVR5cGUuRElSRUNUT1JZLCBjdXJyVGltZSwgY3VyclRpbWUsIGN1cnJUaW1lKTtcbiAgICAgIC8vIElmIHRoZSByb290IGRvZXNuJ3QgZXhpc3QsIHRoZSBmaXJzdCByYW5kb20gSUQgc2hvdWxkbid0IGV4aXN0LFxuICAgICAgLy8gZWl0aGVyLlxuICAgICAgdHgucHV0KGRpcklub2RlLmlkLCBuZXcgQnVmZmVyKFwie31cIiksIGZhbHNlKTtcbiAgICAgIHR4LnB1dChST09UX05PREVfSUQsIGRpcklub2RlLnRvQnVmZmVyKCksIGZhbHNlKTtcbiAgICAgIHR4LmNvbW1pdCgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBIZWxwZXIgZnVuY3Rpb24gZm9yIGZpbmRJTm9kZS5cbiAgICogQHBhcmFtIHBhcmVudCBUaGUgcGFyZW50IGRpcmVjdG9yeSBvZiB0aGUgZmlsZSB3ZSBhcmUgYXR0ZW1wdGluZyB0byBmaW5kLlxuICAgKiBAcGFyYW0gZmlsZW5hbWUgVGhlIGZpbGVuYW1lIG9mIHRoZSBpbm9kZSB3ZSBhcmUgYXR0ZW1wdGluZyB0byBmaW5kLCBtaW51c1xuICAgKiAgIHRoZSBwYXJlbnQuXG4gICAqIEByZXR1cm4gc3RyaW5nIFRoZSBJRCBvZiB0aGUgZmlsZSdzIGlub2RlIGluIHRoZSBmaWxlIHN5c3RlbS5cbiAgICovXG4gIHByaXZhdGUgX2ZpbmRJTm9kZSh0eDogU3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbiwgcGFyZW50OiBzdHJpbmcsIGZpbGVuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHZhciByZWFkX2RpcmVjdG9yeSA9IChpbm9kZTogSW5vZGUpOiBzdHJpbmcgPT4ge1xuICAgICAgLy8gR2V0IHRoZSByb290J3MgZGlyZWN0b3J5IGxpc3RpbmcuXG4gICAgICB2YXIgZGlyTGlzdCA9IHRoaXMuZ2V0RGlyTGlzdGluZyh0eCwgcGFyZW50LCBpbm9kZSk7XG4gICAgICAvLyBHZXQgdGhlIGZpbGUncyBJRC5cbiAgICAgIGlmIChkaXJMaXN0W2ZpbGVuYW1lXSkge1xuICAgICAgICByZXR1cm4gZGlyTGlzdFtmaWxlbmFtZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBBcGlFcnJvci5FTk9FTlQocGF0aC5yZXNvbHZlKHBhcmVudCwgZmlsZW5hbWUpKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGlmIChwYXJlbnQgPT09ICcvJykge1xuICAgICAgaWYgKGZpbGVuYW1lID09PSAnJykge1xuICAgICAgICAvLyBCQVNFIENBU0UgIzE6IFJldHVybiB0aGUgcm9vdCdzIElELlxuICAgICAgICByZXR1cm4gUk9PVF9OT0RFX0lEO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQkFTRSBDQVNFICMyOiBGaW5kIHRoZSBpdGVtIGluIHRoZSByb290IG5kb2UuXG4gICAgICAgIHJldHVybiByZWFkX2RpcmVjdG9yeSh0aGlzLmdldElOb2RlKHR4LCBwYXJlbnQsIFJPT1RfTk9ERV9JRCkpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmVhZF9kaXJlY3RvcnkodGhpcy5nZXRJTm9kZSh0eCwgcGFyZW50ICsgcGF0aC5zZXAgKyBmaWxlbmFtZSxcbiAgICAgICAgdGhpcy5fZmluZElOb2RlKHR4LCBwYXRoLmRpcm5hbWUocGFyZW50KSwgcGF0aC5iYXNlbmFtZShwYXJlbnQpKSkpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kcyB0aGUgSW5vZGUgb2YgdGhlIGdpdmVuIHBhdGguXG4gICAqIEBwYXJhbSBwIFRoZSBwYXRoIHRvIGxvb2sgdXAuXG4gICAqIEByZXR1cm4gVGhlIElub2RlIG9mIHRoZSBwYXRoIHAuXG4gICAqIEB0b2RvIG1lbW9pemUvY2FjaGVcbiAgICovXG4gIHByaXZhdGUgZmluZElOb2RlKHR4OiBTeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uLCBwOiBzdHJpbmcpOiBJbm9kZSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0SU5vZGUodHgsIHAsIHRoaXMuX2ZpbmRJTm9kZSh0eCwgcGF0aC5kaXJuYW1lKHApLCBwYXRoLmJhc2VuYW1lKHApKSk7XG4gIH1cblxuICAvKipcbiAgICogR2l2ZW4gdGhlIElEIG9mIGEgbm9kZSwgcmV0cmlldmVzIHRoZSBjb3JyZXNwb25kaW5nIElub2RlLlxuICAgKiBAcGFyYW0gdHggVGhlIHRyYW5zYWN0aW9uIHRvIHVzZS5cbiAgICogQHBhcmFtIHAgVGhlIGNvcnJlc3BvbmRpbmcgcGF0aCB0byB0aGUgZmlsZSAodXNlZCBmb3IgZXJyb3IgbWVzc2FnZXMpLlxuICAgKiBAcGFyYW0gaWQgVGhlIElEIHRvIGxvb2sgdXAuXG4gICAqL1xuICBwcml2YXRlIGdldElOb2RlKHR4OiBTeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uLCBwOiBzdHJpbmcsIGlkOiBzdHJpbmcpOiBJbm9kZSB7XG4gICAgdmFyIGlub2RlID0gdHguZ2V0KGlkKTtcbiAgICBpZiAoaW5vZGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRU5PRU5UKHApO1xuICAgIH1cbiAgICByZXR1cm4gSW5vZGUuZnJvbUJ1ZmZlcihpbm9kZSk7XG4gIH1cblxuICAvKipcbiAgICogR2l2ZW4gdGhlIElub2RlIG9mIGEgZGlyZWN0b3J5LCByZXRyaWV2ZXMgdGhlIGNvcnJlc3BvbmRpbmcgZGlyZWN0b3J5XG4gICAqIGxpc3RpbmcuXG4gICAqL1xuICBwcml2YXRlIGdldERpckxpc3RpbmcodHg6IFN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb24sIHA6IHN0cmluZywgaW5vZGU6IElub2RlKTogeyBbZmlsZU5hbWU6IHN0cmluZ106IHN0cmluZyB9IHtcbiAgICBpZiAoIWlub2RlLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVOT1RESVIocCk7XG4gICAgfVxuICAgIHZhciBkYXRhID0gdHguZ2V0KGlub2RlLmlkKTtcbiAgICBpZiAoZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBBcGlFcnJvci5FTk9FTlQocCk7XG4gICAgfVxuICAgIHJldHVybiBKU09OLnBhcnNlKGRhdGEudG9TdHJpbmcoKSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBub2RlIHVuZGVyIGEgcmFuZG9tIElELiBSZXRyaWVzIDUgdGltZXMgYmVmb3JlIGdpdmluZyB1cCBpblxuICAgKiB0aGUgZXhjZWVkaW5nbHkgdW5saWtlbHkgY2hhbmNlIHRoYXQgd2UgdHJ5IHRvIHJldXNlIGEgcmFuZG9tIEdVSUQuXG4gICAqIEByZXR1cm4gVGhlIEdVSUQgdGhhdCB0aGUgZGF0YSB3YXMgc3RvcmVkIHVuZGVyLlxuICAgKi9cbiAgcHJpdmF0ZSBhZGROZXdOb2RlKHR4OiBTeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uLCBkYXRhOiBOb2RlQnVmZmVyKTogc3RyaW5nIHtcbiAgICB2YXIgcmV0cmllcyA9IDAsIGN1cnJJZDogc3RyaW5nO1xuICAgIHdoaWxlIChyZXRyaWVzIDwgNSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY3VycklkID0gR2VuZXJhdGVSYW5kb21JRCgpO1xuICAgICAgICB0eC5wdXQoY3VycklkLCBkYXRhLCBmYWxzZSk7XG4gICAgICAgIHJldHVybiBjdXJySWQ7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIElnbm9yZSBhbmQgcmVyb2xsLlxuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVJTywgJ1VuYWJsZSB0byBjb21taXQgZGF0YSB0byBrZXktdmFsdWUgc3RvcmUuJyk7XG4gIH1cblxuICAvKipcbiAgICogQ29tbWl0cyBhIG5ldyBmaWxlICh3ZWxsLCBhIEZJTEUgb3IgYSBESVJFQ1RPUlkpIHRvIHRoZSBmaWxlIHN5c3RlbSB3aXRoXG4gICAqIHRoZSBnaXZlbiBtb2RlLlxuICAgKiBOb3RlOiBUaGlzIHdpbGwgY29tbWl0IHRoZSB0cmFuc2FjdGlvbi5cbiAgICogQHBhcmFtIHAgVGhlIHBhdGggdG8gdGhlIG5ldyBmaWxlLlxuICAgKiBAcGFyYW0gdHlwZSBUaGUgdHlwZSBvZiB0aGUgbmV3IGZpbGUuXG4gICAqIEBwYXJhbSBtb2RlIFRoZSBtb2RlIHRvIGNyZWF0ZSB0aGUgbmV3IGZpbGUgd2l0aC5cbiAgICogQHBhcmFtIGRhdGEgVGhlIGRhdGEgdG8gc3RvcmUgYXQgdGhlIGZpbGUncyBkYXRhIG5vZGUuXG4gICAqIEByZXR1cm4gVGhlIElub2RlIGZvciB0aGUgbmV3IGZpbGUuXG4gICAqL1xuICBwcml2YXRlIGNvbW1pdE5ld0ZpbGUodHg6IFN5bmNLZXlWYWx1ZVJXVHJhbnNhY3Rpb24sIHA6IHN0cmluZywgdHlwZTogRmlsZVR5cGUsIG1vZGU6IG51bWJlciwgZGF0YTogTm9kZUJ1ZmZlcik6IElub2RlIHtcbiAgICB2YXIgcGFyZW50RGlyID0gcGF0aC5kaXJuYW1lKHApLFxuICAgICAgZm5hbWUgPSBwYXRoLmJhc2VuYW1lKHApLFxuICAgICAgcGFyZW50Tm9kZSA9IHRoaXMuZmluZElOb2RlKHR4LCBwYXJlbnREaXIpLFxuICAgICAgZGlyTGlzdGluZyA9IHRoaXMuZ2V0RGlyTGlzdGluZyh0eCwgcGFyZW50RGlyLCBwYXJlbnROb2RlKSxcbiAgICAgIGN1cnJUaW1lID0gKG5ldyBEYXRlKCkpLmdldFRpbWUoKTtcblxuICAgIC8vIEludmFyaWFudDogVGhlIHJvb3QgYWx3YXlzIGV4aXN0cy5cbiAgICAvLyBJZiB3ZSBkb24ndCBjaGVjayB0aGlzIHByaW9yIHRvIHRha2luZyBzdGVwcyBiZWxvdywgd2Ugd2lsbCBjcmVhdGUgYVxuICAgIC8vIGZpbGUgd2l0aCBuYW1lICcnIGluIHJvb3Qgc2hvdWxkIHAgPT0gJy8nLlxuICAgIGlmIChwID09PSAnLycpIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVFWElTVChwKTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBpZiBmaWxlIGFscmVhZHkgZXhpc3RzLlxuICAgIGlmIChkaXJMaXN0aW5nW2ZuYW1lXSkge1xuICAgICAgdGhyb3cgQXBpRXJyb3IuRUVYSVNUKHApO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAvLyBDb21taXQgZGF0YS5cbiAgICAgIHZhciBkYXRhSWQgPSB0aGlzLmFkZE5ld05vZGUodHgsIGRhdGEpLFxuICAgICAgICBmaWxlTm9kZSA9IG5ldyBJbm9kZShkYXRhSWQsIGRhdGEubGVuZ3RoLCBtb2RlIHwgdHlwZSwgY3VyclRpbWUsIGN1cnJUaW1lLCBjdXJyVGltZSksXG4gICAgICAgIC8vIENvbW1pdCBmaWxlIG5vZGUuXG4gICAgICAgIGZpbGVOb2RlSWQgPSB0aGlzLmFkZE5ld05vZGUodHgsIGZpbGVOb2RlLnRvQnVmZmVyKCkpO1xuICAgICAgLy8gVXBkYXRlIGFuZCBjb21taXQgcGFyZW50IGRpcmVjdG9yeSBsaXN0aW5nLlxuICAgICAgZGlyTGlzdGluZ1tmbmFtZV0gPSBmaWxlTm9kZUlkO1xuICAgICAgdHgucHV0KHBhcmVudE5vZGUuaWQsIG5ldyBCdWZmZXIoSlNPTi5zdHJpbmdpZnkoZGlyTGlzdGluZykpLCB0cnVlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0eC5hYm9ydCgpO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gICAgdHguY29tbWl0KCk7XG4gICAgcmV0dXJuIGZpbGVOb2RlO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSBhbGwgY29udGVudHMgc3RvcmVkIGluIHRoZSBmaWxlIHN5c3RlbS5cbiAgICovXG4gIHB1YmxpYyBlbXB0eSgpOiB2b2lkIHtcbiAgICB0aGlzLnN0b3JlLmNsZWFyKCk7XG4gICAgLy8gSU5WQVJJQU5UOiBSb290IGFsd2F5cyBleGlzdHMuXG4gICAgdGhpcy5tYWtlUm9vdERpcmVjdG9yeSgpO1xuICB9XG5cbiAgcHVibGljIHJlbmFtZVN5bmMob2xkUGF0aDogc3RyaW5nLCBuZXdQYXRoOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpLFxuICAgICAgb2xkUGFyZW50ID0gcGF0aC5kaXJuYW1lKG9sZFBhdGgpLCBvbGROYW1lID0gcGF0aC5iYXNlbmFtZShvbGRQYXRoKSxcbiAgICAgIG5ld1BhcmVudCA9IHBhdGguZGlybmFtZShuZXdQYXRoKSwgbmV3TmFtZSA9IHBhdGguYmFzZW5hbWUobmV3UGF0aCksXG4gICAgICAvLyBSZW1vdmUgb2xkUGF0aCBmcm9tIHBhcmVudCdzIGRpcmVjdG9yeSBsaXN0aW5nLlxuICAgICAgb2xkRGlyTm9kZSA9IHRoaXMuZmluZElOb2RlKHR4LCBvbGRQYXJlbnQpLFxuICAgICAgb2xkRGlyTGlzdCA9IHRoaXMuZ2V0RGlyTGlzdGluZyh0eCwgb2xkUGFyZW50LCBvbGREaXJOb2RlKTtcbiAgICBpZiAoIW9sZERpckxpc3Rbb2xkTmFtZV0pIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVOT0VOVChvbGRQYXRoKTtcbiAgICB9XG4gICAgdmFyIG5vZGVJZDogc3RyaW5nID0gb2xkRGlyTGlzdFtvbGROYW1lXTtcbiAgICBkZWxldGUgb2xkRGlyTGlzdFtvbGROYW1lXTtcblxuICAgIC8vIEludmFyaWFudDogQ2FuJ3QgbW92ZSBhIGZvbGRlciBpbnNpZGUgaXRzZWxmLlxuICAgIC8vIFRoaXMgZnVubnkgbGl0dGxlIGhhY2sgZW5zdXJlcyB0aGF0IHRoZSBjaGVjayBwYXNzZXMgb25seSBpZiBvbGRQYXRoXG4gICAgLy8gaXMgYSBzdWJwYXRoIG9mIG5ld1BhcmVudC4gV2UgYXBwZW5kICcvJyB0byBhdm9pZCBtYXRjaGluZyBmb2xkZXJzIHRoYXRcbiAgICAvLyBhcmUgYSBzdWJzdHJpbmcgb2YgdGhlIGJvdHRvbS1tb3N0IGZvbGRlciBpbiB0aGUgcGF0aC5cbiAgICBpZiAoKG5ld1BhcmVudCArICcvJykuaW5kZXhPZihvbGRQYXRoICsgJy8nKSA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FQlVTWSwgb2xkUGFyZW50KTtcbiAgICB9XG5cbiAgICAvLyBBZGQgbmV3UGF0aCB0byBwYXJlbnQncyBkaXJlY3RvcnkgbGlzdGluZy5cbiAgICB2YXIgbmV3RGlyTm9kZTogSW5vZGUsIG5ld0Rpckxpc3Q6IHR5cGVvZiBvbGREaXJMaXN0O1xuICAgIGlmIChuZXdQYXJlbnQgPT09IG9sZFBhcmVudCkge1xuICAgICAgLy8gUHJldmVudCB1cyBmcm9tIHJlLWdyYWJiaW5nIHRoZSBzYW1lIGRpcmVjdG9yeSBsaXN0aW5nLCB3aGljaCBzdGlsbFxuICAgICAgLy8gY29udGFpbnMgb2xkTmFtZS5cbiAgICAgIG5ld0Rpck5vZGUgPSBvbGREaXJOb2RlO1xuICAgICAgbmV3RGlyTGlzdCA9IG9sZERpckxpc3Q7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5ld0Rpck5vZGUgPSB0aGlzLmZpbmRJTm9kZSh0eCwgbmV3UGFyZW50KTtcbiAgICAgIG5ld0Rpckxpc3QgPSB0aGlzLmdldERpckxpc3RpbmcodHgsIG5ld1BhcmVudCwgbmV3RGlyTm9kZSk7XG4gICAgfVxuXG4gICAgaWYgKG5ld0Rpckxpc3RbbmV3TmFtZV0pIHtcbiAgICAgIC8vIElmIGl0J3MgYSBmaWxlLCBkZWxldGUgaXQuXG4gICAgICB2YXIgbmV3TmFtZU5vZGUgPSB0aGlzLmdldElOb2RlKHR4LCBuZXdQYXRoLCBuZXdEaXJMaXN0W25ld05hbWVdKTtcbiAgICAgIGlmIChuZXdOYW1lTm9kZS5pc0ZpbGUoKSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHR4LmRlbChuZXdOYW1lTm9kZS5pZCk7XG4gICAgICAgICAgdHguZGVsKG5ld0Rpckxpc3RbbmV3TmFtZV0pO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgdHguYWJvcnQoKTtcbiAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBJZiBpdCdzIGEgZGlyZWN0b3J5LCB0aHJvdyBhIHBlcm1pc3Npb25zIGVycm9yLlxuICAgICAgICB0aHJvdyBBcGlFcnJvci5FUEVSTShuZXdQYXRoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgbmV3RGlyTGlzdFtuZXdOYW1lXSA9IG5vZGVJZDtcblxuICAgIC8vIENvbW1pdCB0aGUgdHdvIGNoYW5nZWQgZGlyZWN0b3J5IGxpc3RpbmdzLlxuICAgIHRyeSB7XG4gICAgICB0eC5wdXQob2xkRGlyTm9kZS5pZCwgbmV3IEJ1ZmZlcihKU09OLnN0cmluZ2lmeShvbGREaXJMaXN0KSksIHRydWUpO1xuICAgICAgdHgucHV0KG5ld0Rpck5vZGUuaWQsIG5ldyBCdWZmZXIoSlNPTi5zdHJpbmdpZnkobmV3RGlyTGlzdCkpLCB0cnVlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0eC5hYm9ydCgpO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG5cbiAgICB0eC5jb21taXQoKTtcbiAgfVxuXG4gIHB1YmxpYyBzdGF0U3luYyhwOiBzdHJpbmcsIGlzTHN0YXQ6IGJvb2xlYW4pOiBTdGF0cyB7XG4gICAgLy8gR2V0IHRoZSBpbm9kZSB0byB0aGUgaXRlbSwgY29udmVydCBpdCBpbnRvIGEgU3RhdHMgb2JqZWN0LlxuICAgIHJldHVybiB0aGlzLmZpbmRJTm9kZSh0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWRvbmx5JyksIHApLnRvU3RhdHMoKTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVGaWxlU3luYyhwOiBzdHJpbmcsIGZsYWc6IGZpbGVfZmxhZy5GaWxlRmxhZywgbW9kZTogbnVtYmVyKTogZmlsZS5GaWxlIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpLFxuICAgICAgZGF0YSA9IG5ldyBCdWZmZXIoMCksXG4gICAgICBuZXdGaWxlID0gdGhpcy5jb21taXROZXdGaWxlKHR4LCBwLCBGaWxlVHlwZS5GSUxFLCBtb2RlLCBkYXRhKTtcbiAgICAvLyBPcGVuIHRoZSBmaWxlLlxuICAgIHJldHVybiBuZXcgU3luY0tleVZhbHVlRmlsZSh0aGlzLCBwLCBmbGFnLCBuZXdGaWxlLnRvU3RhdHMoKSwgZGF0YSk7XG4gIH1cblxuICBwdWJsaWMgb3BlbkZpbGVTeW5jKHA6IHN0cmluZywgZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnKTogZmlsZS5GaWxlIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWRvbmx5JyksXG4gICAgICBub2RlID0gdGhpcy5maW5kSU5vZGUodHgsIHApLFxuICAgICAgZGF0YSA9IHR4LmdldChub2RlLmlkKTtcbiAgICBpZiAoZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBBcGlFcnJvci5FTk9FTlQocCk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgU3luY0tleVZhbHVlRmlsZSh0aGlzLCBwLCBmbGFnLCBub2RlLnRvU3RhdHMoKSwgZGF0YSk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCB0cmFjZXMgb2YgdGhlIGdpdmVuIHBhdGggZnJvbSB0aGUgZmlsZSBzeXN0ZW0uXG4gICAqIEBwYXJhbSBwIFRoZSBwYXRoIHRvIHJlbW92ZSBmcm9tIHRoZSBmaWxlIHN5c3RlbS5cbiAgICogQHBhcmFtIGlzRGlyIERvZXMgdGhlIHBhdGggYmVsb25nIHRvIGEgZGlyZWN0b3J5LCBvciBhIGZpbGU/XG4gICAqIEB0b2RvIFVwZGF0ZSBtdGltZS5cbiAgICovXG4gIHByaXZhdGUgcmVtb3ZlRW50cnkocDogc3RyaW5nLCBpc0RpcjogYm9vbGVhbik6IHZvaWQge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZHdyaXRlJyksXG4gICAgICBwYXJlbnQ6IHN0cmluZyA9IHBhdGguZGlybmFtZShwKSxcbiAgICAgIHBhcmVudE5vZGUgPSB0aGlzLmZpbmRJTm9kZSh0eCwgcGFyZW50KSxcbiAgICAgIHBhcmVudExpc3RpbmcgPSB0aGlzLmdldERpckxpc3RpbmcodHgsIHBhcmVudCwgcGFyZW50Tm9kZSksXG4gICAgICBmaWxlTmFtZTogc3RyaW5nID0gcGF0aC5iYXNlbmFtZShwKTtcblxuICAgIGlmICghcGFyZW50TGlzdGluZ1tmaWxlTmFtZV0pIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVOT0VOVChwKTtcbiAgICB9XG5cbiAgICAvLyBSZW1vdmUgZnJvbSBkaXJlY3RvcnkgbGlzdGluZyBvZiBwYXJlbnQuXG4gICAgdmFyIGZpbGVOb2RlSWQgPSBwYXJlbnRMaXN0aW5nW2ZpbGVOYW1lXTtcbiAgICBkZWxldGUgcGFyZW50TGlzdGluZ1tmaWxlTmFtZV07XG5cbiAgICAvLyBHZXQgZmlsZSBpbm9kZS5cbiAgICB2YXIgZmlsZU5vZGUgPSB0aGlzLmdldElOb2RlKHR4LCBwLCBmaWxlTm9kZUlkKTtcbiAgICBpZiAoIWlzRGlyICYmIGZpbGVOb2RlLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgIHRocm93IEFwaUVycm9yLkVJU0RJUihwKTtcbiAgICB9IGVsc2UgaWYgKGlzRGlyICYmICFmaWxlTm9kZS5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICB0aHJvdyBBcGlFcnJvci5FTk9URElSKHApO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAvLyBEZWxldGUgZGF0YS5cbiAgICAgIHR4LmRlbChmaWxlTm9kZS5pZCk7XG4gICAgICAvLyBEZWxldGUgbm9kZS5cbiAgICAgIHR4LmRlbChmaWxlTm9kZUlkKTtcbiAgICAgIC8vIFVwZGF0ZSBkaXJlY3RvcnkgbGlzdGluZy5cbiAgICAgIHR4LnB1dChwYXJlbnROb2RlLmlkLCBuZXcgQnVmZmVyKEpTT04uc3RyaW5naWZ5KHBhcmVudExpc3RpbmcpKSwgdHJ1ZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdHguYWJvcnQoKTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICAgIC8vIFN1Y2Nlc3MuXG4gICAgdHguY29tbWl0KCk7XG4gIH1cblxuICBwdWJsaWMgdW5saW5rU3luYyhwOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLnJlbW92ZUVudHJ5KHAsIGZhbHNlKTtcbiAgfVxuXG4gIHB1YmxpYyBybWRpclN5bmMocDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5yZW1vdmVFbnRyeShwLCB0cnVlKTtcbiAgfVxuXG4gIHB1YmxpYyBta2RpclN5bmMocDogc3RyaW5nLCBtb2RlOiBudW1iZXIpOiB2b2lkIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpLFxuICAgICAgZGF0YSA9IG5ldyBCdWZmZXIoJ3t9Jyk7XG4gICAgdGhpcy5jb21taXROZXdGaWxlKHR4LCBwLCBGaWxlVHlwZS5ESVJFQ1RPUlksIG1vZGUsIGRhdGEpO1xuICB9XG5cbiAgcHVibGljIHJlYWRkaXJTeW5jKHA6IHN0cmluZyk6IHN0cmluZ1tde1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZG9ubHknKTtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5nZXREaXJMaXN0aW5nKHR4LCBwLCB0aGlzLmZpbmRJTm9kZSh0eCwgcCkpKTtcbiAgfVxuXG4gIHB1YmxpYyBfc3luY1N5bmMocDogc3RyaW5nLCBkYXRhOiBOb2RlQnVmZmVyLCBzdGF0czogU3RhdHMpOiB2b2lkIHtcbiAgICAvLyBAdG9kbyBFbnN1cmUgbXRpbWUgdXBkYXRlcyBwcm9wZXJseSwgYW5kIHVzZSB0aGF0IHRvIGRldGVybWluZSBpZiBhIGRhdGFcbiAgICAvLyAgICAgICB1cGRhdGUgaXMgcmVxdWlyZWQuXG4gICAgdmFyIHR4ID0gdGhpcy5zdG9yZS5iZWdpblRyYW5zYWN0aW9uKCdyZWFkd3JpdGUnKSxcbiAgICAgIC8vIFdlIHVzZSB0aGUgX2ZpbmRJbm9kZSBoZWxwZXIgYmVjYXVzZSB3ZSBhY3R1YWxseSBuZWVkIHRoZSBJTm9kZSBpZC5cbiAgICAgIGZpbGVJbm9kZUlkID0gdGhpcy5fZmluZElOb2RlKHR4LCBwYXRoLmRpcm5hbWUocCksIHBhdGguYmFzZW5hbWUocCkpLFxuICAgICAgZmlsZUlub2RlID0gdGhpcy5nZXRJTm9kZSh0eCwgcCwgZmlsZUlub2RlSWQpLFxuICAgICAgaW5vZGVDaGFuZ2VkID0gZmlsZUlub2RlLnVwZGF0ZShzdGF0cyk7XG5cbiAgICB0cnkge1xuICAgICAgLy8gU3luYyBkYXRhLlxuICAgICAgdHgucHV0KGZpbGVJbm9kZS5pZCwgZGF0YSwgdHJ1ZSk7XG4gICAgICAvLyBTeW5jIG1ldGFkYXRhLlxuICAgICAgaWYgKGlub2RlQ2hhbmdlZCkge1xuICAgICAgICB0eC5wdXQoZmlsZUlub2RlSWQsIGZpbGVJbm9kZS50b0J1ZmZlcigpLCB0cnVlKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0eC5hYm9ydCgpO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gICAgdHguY29tbWl0KCk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGFuICphc3luY2hyb25vdXMqIGtleS12YWx1ZSBzdG9yZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBBc3luY0tleVZhbHVlU3RvcmUge1xuICAvKipcbiAgICogVGhlIG5hbWUgb2YgdGhlIGtleS12YWx1ZSBzdG9yZS5cbiAgICovXG4gIG5hbWUoKTogc3RyaW5nO1xuICAvKipcbiAgICogRW1wdGllcyB0aGUga2V5LXZhbHVlIHN0b3JlIGNvbXBsZXRlbHkuXG4gICAqL1xuICBjbGVhcihjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG4gIC8qKlxuICAgKiBCZWdpbnMgYSByZWFkLXdyaXRlIHRyYW5zYWN0aW9uLlxuICAgKi9cbiAgYmVnaW5UcmFuc2FjdGlvbih0eXBlOiAncmVhZHdyaXRlJyk6IEFzeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uO1xuICAvKipcbiAgICogQmVnaW5zIGEgcmVhZC1vbmx5IHRyYW5zYWN0aW9uLlxuICAgKi9cbiAgYmVnaW5UcmFuc2FjdGlvbih0eXBlOiAncmVhZG9ubHknKTogQXN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb247XG4gIGJlZ2luVHJhbnNhY3Rpb24odHlwZTogc3RyaW5nKTogQXN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb247XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBhc3luY2hyb25vdXMgcmVhZC1vbmx5IHRyYW5zYWN0aW9uLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEFzeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uIHtcbiAgLyoqXG4gICAqIFJldHJpZXZlcyB0aGUgZGF0YSBhdCB0aGUgZ2l2ZW4ga2V5LlxuICAgKiBAcGFyYW0ga2V5IFRoZSBrZXkgdG8gbG9vayB1bmRlciBmb3IgZGF0YS5cbiAgICovXG4gIGdldChrZXk6IHN0cmluZywgY2I6IChlOiBBcGlFcnJvciwgZGF0YT86IE5vZGVCdWZmZXIpID0+IHZvaWQpOiB2b2lkO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYW4gYXN5bmNocm9ub3VzIHJlYWQtd3JpdGUgdHJhbnNhY3Rpb24uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQXN5bmNLZXlWYWx1ZVJXVHJhbnNhY3Rpb24gZXh0ZW5kcyBBc3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbiB7XG4gIC8qKlxuICAgKiBBZGRzIHRoZSBkYXRhIHRvIHRoZSBzdG9yZSB1bmRlciB0aGUgZ2l2ZW4ga2V5LiBPdmVyd3JpdGVzIGFueSBleGlzdGluZ1xuICAgKiBkYXRhLlxuICAgKiBAcGFyYW0ga2V5IFRoZSBrZXkgdG8gYWRkIHRoZSBkYXRhIHVuZGVyLlxuICAgKiBAcGFyYW0gZGF0YSBUaGUgZGF0YSB0byBhZGQgdG8gdGhlIHN0b3JlLlxuICAgKiBAcGFyYW0gb3ZlcndyaXRlIElmICd0cnVlJywgb3ZlcndyaXRlIGFueSBleGlzdGluZyBkYXRhLiBJZiAnZmFsc2UnLFxuICAgKiAgIGF2b2lkcyB3cml0aW5nIHRoZSBkYXRhIGlmIHRoZSBrZXkgZXhpc3RzLlxuICAgKiBAcGFyYW0gY2IgVHJpZ2dlcmVkIHdpdGggYW4gZXJyb3IgYW5kIHdoZXRoZXIgb3Igbm90IHRoZSB2YWx1ZSB3YXNcbiAgICogICBjb21taXR0ZWQuXG4gICAqL1xuICBwdXQoa2V5OiBzdHJpbmcsIGRhdGE6IE5vZGVCdWZmZXIsIG92ZXJ3cml0ZTogYm9vbGVhbiwgY2I6IChlOiBBcGlFcnJvcixcbiAgICBjb21taXR0ZWQ/OiBib29sZWFuKSA9PiB2b2lkKTogdm9pZDtcbiAgLyoqXG4gICAqIERlbGV0ZXMgdGhlIGRhdGEgYXQgdGhlIGdpdmVuIGtleS5cbiAgICogQHBhcmFtIGtleSBUaGUga2V5IHRvIGRlbGV0ZSBmcm9tIHRoZSBzdG9yZS5cbiAgICovXG4gIGRlbChrZXk6IHN0cmluZywgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICAvKipcbiAgICogQ29tbWl0cyB0aGUgdHJhbnNhY3Rpb24uXG4gICAqL1xuICBjb21taXQoY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuICAvKipcbiAgICogQWJvcnRzIGFuZCByb2xscyBiYWNrIHRoZSB0cmFuc2FjdGlvbi5cbiAgICovXG4gIGFib3J0KGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIEFzeW5jS2V5VmFsdWVGaWxlIGV4dGVuZHMgcHJlbG9hZF9maWxlLlByZWxvYWRGaWxlPEFzeW5jS2V5VmFsdWVGaWxlU3lzdGVtPiBpbXBsZW1lbnRzIGZpbGUuRmlsZSB7XG4gIGNvbnN0cnVjdG9yKF9mczogQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0sIF9wYXRoOiBzdHJpbmcsIF9mbGFnOiBmaWxlX2ZsYWcuRmlsZUZsYWcsIF9zdGF0OiBTdGF0cywgY29udGVudHM/OiBOb2RlQnVmZmVyKSB7XG4gICAgc3VwZXIoX2ZzLCBfcGF0aCwgX2ZsYWcsIF9zdGF0LCBjb250ZW50cyk7XG4gIH1cblxuICBwdWJsaWMgc3luYyhjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmlzRGlydHkoKSkge1xuICAgICAgdGhpcy5fZnMuX3N5bmModGhpcy5nZXRQYXRoKCksIHRoaXMuZ2V0QnVmZmVyKCksIHRoaXMuZ2V0U3RhdHMoKSwgKGU/OiBBcGlFcnJvcikgPT4ge1xuICAgICAgICBpZiAoIWUpIHtcbiAgICAgICAgICB0aGlzLnJlc2V0RGlydHkoKTtcbiAgICAgICAgfVxuICAgICAgICBjYihlKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYigpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBjbG9zZShjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuc3luYyhjYik7XG4gIH1cbn1cblxuLyoqXG4gKiBBbiBcIkFzeW5jaHJvbm91cyBrZXktdmFsdWUgZmlsZSBzeXN0ZW1cIi4gU3RvcmVzIGRhdGEgdG8vcmV0cmlldmVzIGRhdGEgZnJvbVxuICogYW4gdW5kZXJseWluZyBhc3luY2hyb25vdXMga2V5LXZhbHVlIHN0b3JlLlxuICovXG5leHBvcnQgY2xhc3MgQXN5bmNLZXlWYWx1ZUZpbGVTeXN0ZW0gZXh0ZW5kcyBmaWxlX3N5c3RlbS5CYXNlRmlsZVN5c3RlbSB7XG4gIHByaXZhdGUgc3RvcmU6IEFzeW5jS2V5VmFsdWVTdG9yZTtcblxuICAvKipcbiAgICogSW5pdGlhbGl6ZXMgdGhlIGZpbGUgc3lzdGVtLiBUeXBpY2FsbHkgY2FsbGVkIGJ5IHN1YmNsYXNzZXMnIGFzeW5jXG4gICAqIGNvbnN0cnVjdG9ycy5cbiAgICovXG4gIHB1YmxpYyBpbml0KHN0b3JlOiBBc3luY0tleVZhbHVlU3RvcmUsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKSB7XG4gICAgdGhpcy5zdG9yZSA9IHN0b3JlO1xuICAgIC8vIElOVkFSSUFOVDogRW5zdXJlIHRoYXQgdGhlIHJvb3QgZXhpc3RzLlxuICAgIHRoaXMubWFrZVJvb3REaXJlY3RvcnkoY2IpO1xuICB9XG5cbiAgcHVibGljIHN0YXRpYyBpc0F2YWlsYWJsZSgpOiBib29sZWFuIHsgcmV0dXJuIHRydWU7IH1cbiAgcHVibGljIGdldE5hbWUoKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuc3RvcmUubmFtZSgpOyB9XG4gIHB1YmxpYyBpc1JlYWRPbmx5KCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cbiAgcHVibGljIHN1cHBvcnRzU3ltbGlua3MoKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuICBwdWJsaWMgc3VwcG9ydHNQcm9wcygpOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlOyB9XG4gIHB1YmxpYyBzdXBwb3J0c1N5bmNoKCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIHRoZSByb290IGRpcmVjdG9yeSBleGlzdHMuIENyZWF0ZXMgaXQgaWYgaXQgZG9lc24ndC5cbiAgICovXG4gIHByaXZhdGUgbWFrZVJvb3REaXJlY3RvcnkoY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpO1xuICAgIHR4LmdldChST09UX05PREVfSUQsIChlOiBBcGlFcnJvciwgZGF0YT86IE5vZGVCdWZmZXIpID0+IHtcbiAgICAgIGlmIChlIHx8IGRhdGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyBDcmVhdGUgbmV3IGlub2RlLlxuICAgICAgICB2YXIgY3VyclRpbWUgPSAobmV3IERhdGUoKSkuZ2V0VGltZSgpLFxuICAgICAgICAgIC8vIE1vZGUgMDY2NlxuICAgICAgICAgIGRpcklub2RlID0gbmV3IElub2RlKEdlbmVyYXRlUmFuZG9tSUQoKSwgNDA5NiwgNTExIHwgRmlsZVR5cGUuRElSRUNUT1JZLCBjdXJyVGltZSwgY3VyclRpbWUsIGN1cnJUaW1lKTtcbiAgICAgICAgLy8gSWYgdGhlIHJvb3QgZG9lc24ndCBleGlzdCwgdGhlIGZpcnN0IHJhbmRvbSBJRCBzaG91bGRuJ3QgZXhpc3QsXG4gICAgICAgIC8vIGVpdGhlci5cbiAgICAgICAgdHgucHV0KGRpcklub2RlLmlkLCBuZXcgQnVmZmVyKFwie31cIiksIGZhbHNlLCAoZT86IEFwaUVycm9yKSA9PiB7XG4gICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICB0eC5wdXQoUk9PVF9OT0RFX0lELCBkaXJJbm9kZS50b0J1ZmZlcigpLCBmYWxzZSwgKGU/OiBBcGlFcnJvcikgPT4ge1xuICAgICAgICAgICAgICBpZiAoZSkge1xuICAgICAgICAgICAgICAgIHR4LmFib3J0KCgpID0+IHsgY2IoZSk7IH0pO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHR4LmNvbW1pdChjYik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBXZSdyZSBnb29kLlxuICAgICAgICB0eC5jb21taXQoY2IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEhlbHBlciBmdW5jdGlvbiBmb3IgZmluZElOb2RlLlxuICAgKiBAcGFyYW0gcGFyZW50IFRoZSBwYXJlbnQgZGlyZWN0b3J5IG9mIHRoZSBmaWxlIHdlIGFyZSBhdHRlbXB0aW5nIHRvIGZpbmQuXG4gICAqIEBwYXJhbSBmaWxlbmFtZSBUaGUgZmlsZW5hbWUgb2YgdGhlIGlub2RlIHdlIGFyZSBhdHRlbXB0aW5nIHRvIGZpbmQsIG1pbnVzXG4gICAqICAgdGhlIHBhcmVudC5cbiAgICogQHBhcmFtIGNiIFBhc3NlZCBhbiBlcnJvciBvciB0aGUgSUQgb2YgdGhlIGZpbGUncyBpbm9kZSBpbiB0aGUgZmlsZSBzeXN0ZW0uXG4gICAqL1xuICBwcml2YXRlIF9maW5kSU5vZGUodHg6IEFzeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uLCBwYXJlbnQ6IHN0cmluZywgZmlsZW5hbWU6IHN0cmluZywgY2I6IChlOiBBcGlFcnJvciwgaWQ/OiBzdHJpbmcpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgaGFuZGxlX2RpcmVjdG9yeV9saXN0aW5ncyA9IChlOiBBcGlFcnJvciwgaW5vZGU/OiBJbm9kZSwgZGlyTGlzdD86IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSk6IHZvaWQgPT4ge1xuICAgICAgaWYgKGUpIHtcbiAgICAgICAgY2IoZSlcbiAgICAgIH0gZWxzZSBpZiAoZGlyTGlzdFtmaWxlbmFtZV0pIHtcbiAgICAgICAgY2IobnVsbCwgZGlyTGlzdFtmaWxlbmFtZV0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2IoQXBpRXJyb3IuRU5PRU5UKHBhdGgucmVzb2x2ZShwYXJlbnQsIGZpbGVuYW1lKSkpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBpZiAocGFyZW50ID09PSAnLycpIHtcbiAgICAgIGlmIChmaWxlbmFtZSA9PT0gJycpIHtcbiAgICAgICAgLy8gQkFTRSBDQVNFICMxOiBSZXR1cm4gdGhlIHJvb3QncyBJRC5cbiAgICAgICAgY2IobnVsbCwgUk9PVF9OT0RFX0lEKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEJBU0UgQ0FTRSAjMjogRmluZCB0aGUgaXRlbSBpbiB0aGUgcm9vdCBub2RlLlxuICAgICAgICB0aGlzLmdldElOb2RlKHR4LCBwYXJlbnQsIFJPT1RfTk9ERV9JRCwgKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKTogdm9pZCA9PiB7XG4gICAgICAgICAgaWYgKG5vRXJyb3IoZSwgY2IpKSB7XG4gICAgICAgICAgICB0aGlzLmdldERpckxpc3RpbmcodHgsIHBhcmVudCwgaW5vZGUsIChlOiBBcGlFcnJvciwgZGlyTGlzdD86IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAvLyBoYW5kbGVfZGlyZWN0b3J5X2xpc3RpbmdzIHdpbGwgaGFuZGxlIGUgZm9yIHVzLlxuICAgICAgICAgICAgICBoYW5kbGVfZGlyZWN0b3J5X2xpc3RpbmdzKGUsIGlub2RlLCBkaXJMaXN0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEdldCB0aGUgcGFyZW50IGRpcmVjdG9yeSdzIElOb2RlLCBhbmQgZmluZCB0aGUgZmlsZSBpbiBpdHMgZGlyZWN0b3J5XG4gICAgICAvLyBsaXN0aW5nLlxuICAgICAgdGhpcy5maW5kSU5vZGVBbmREaXJMaXN0aW5nKHR4LCBwYXJlbnQsIGhhbmRsZV9kaXJlY3RvcnlfbGlzdGluZ3MpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kcyB0aGUgSW5vZGUgb2YgdGhlIGdpdmVuIHBhdGguXG4gICAqIEBwYXJhbSBwIFRoZSBwYXRoIHRvIGxvb2sgdXAuXG4gICAqIEBwYXJhbSBjYiBQYXNzZWQgYW4gZXJyb3Igb3IgdGhlIElub2RlIG9mIHRoZSBwYXRoIHAuXG4gICAqIEB0b2RvIG1lbW9pemUvY2FjaGVcbiAgICovXG4gIHByaXZhdGUgZmluZElOb2RlKHR4OiBBc3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbiwgcDogc3RyaW5nLCBjYjogKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fZmluZElOb2RlKHR4LCBwYXRoLmRpcm5hbWUocCksIHBhdGguYmFzZW5hbWUocCksIChlOiBBcGlFcnJvciwgaWQ/OiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgIGlmIChub0Vycm9yKGUsIGNiKSkge1xuICAgICAgICB0aGlzLmdldElOb2RlKHR4LCBwLCBpZCwgY2IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEdpdmVuIHRoZSBJRCBvZiBhIG5vZGUsIHJldHJpZXZlcyB0aGUgY29ycmVzcG9uZGluZyBJbm9kZS5cbiAgICogQHBhcmFtIHR4IFRoZSB0cmFuc2FjdGlvbiB0byB1c2UuXG4gICAqIEBwYXJhbSBwIFRoZSBjb3JyZXNwb25kaW5nIHBhdGggdG8gdGhlIGZpbGUgKHVzZWQgZm9yIGVycm9yIG1lc3NhZ2VzKS5cbiAgICogQHBhcmFtIGlkIFRoZSBJRCB0byBsb29rIHVwLlxuICAgKiBAcGFyYW0gY2IgUGFzc2VkIGFuIGVycm9yIG9yIHRoZSBpbm9kZSB1bmRlciB0aGUgZ2l2ZW4gaWQuXG4gICAqL1xuICBwcml2YXRlIGdldElOb2RlKHR4OiBBc3luY0tleVZhbHVlUk9UcmFuc2FjdGlvbiwgcDogc3RyaW5nLCBpZDogc3RyaW5nLCBjYjogKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdHguZ2V0KGlkLCAoZTogQXBpRXJyb3IsIGRhdGE/OiBOb2RlQnVmZmVyKTogdm9pZCA9PiB7XG4gICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgaWYgKGRhdGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNiKEFwaUVycm9yLkVOT0VOVChwKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2IobnVsbCwgSW5vZGUuZnJvbUJ1ZmZlcihkYXRhKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHaXZlbiB0aGUgSW5vZGUgb2YgYSBkaXJlY3RvcnksIHJldHJpZXZlcyB0aGUgY29ycmVzcG9uZGluZyBkaXJlY3RvcnlcbiAgICogbGlzdGluZy5cbiAgICovXG4gIHByaXZhdGUgZ2V0RGlyTGlzdGluZyh0eDogQXN5bmNLZXlWYWx1ZVJPVHJhbnNhY3Rpb24sIHA6IHN0cmluZywgaW5vZGU6IElub2RlLCBjYjogKGU6IEFwaUVycm9yLCBsaXN0aW5nPzogeyBbZmlsZU5hbWU6IHN0cmluZ106IHN0cmluZyB9KSA9PiB2b2lkKTogdm9pZCB7XG4gICAgaWYgKCFpbm9kZS5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICBjYihBcGlFcnJvci5FTk9URElSKHApKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdHguZ2V0KGlub2RlLmlkLCAoZTogQXBpRXJyb3IsIGRhdGE/OiBOb2RlQnVmZmVyKTogdm9pZCA9PiB7XG4gICAgICAgIGlmIChub0Vycm9yKGUsIGNiKSkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjYihudWxsLCBKU09OLnBhcnNlKGRhdGEudG9TdHJpbmcoKSkpO1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIC8vIE9jY3VycyB3aGVuIGRhdGEgaXMgdW5kZWZpbmVkLCBvciBjb3JyZXNwb25kcyB0byBzb21ldGhpbmcgb3RoZXJcbiAgICAgICAgICAgIC8vIHRoYW4gYSBkaXJlY3RvcnkgbGlzdGluZy4gVGhlIGxhdHRlciBzaG91bGQgbmV2ZXIgb2NjdXIgdW5sZXNzXG4gICAgICAgICAgICAvLyB0aGUgZmlsZSBzeXN0ZW0gaXMgY29ycnVwdGVkLlxuICAgICAgICAgICAgY2IoQXBpRXJyb3IuRU5PRU5UKHApKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHaXZlbiBhIHBhdGggdG8gYSBkaXJlY3RvcnksIHJldHJpZXZlcyB0aGUgY29ycmVzcG9uZGluZyBJTm9kZSBhbmRcbiAgICogZGlyZWN0b3J5IGxpc3RpbmcuXG4gICAqL1xuICBwcml2YXRlIGZpbmRJTm9kZUFuZERpckxpc3RpbmcodHg6IEFzeW5jS2V5VmFsdWVST1RyYW5zYWN0aW9uLCBwOiBzdHJpbmcsIGNiOiAoZTogQXBpRXJyb3IsIGlub2RlPzogSW5vZGUsIGxpc3Rpbmc/OiB7IFtmaWxlTmFtZTogc3RyaW5nXTogc3RyaW5nIH0pID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLmZpbmRJTm9kZSh0eCwgcCwgKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKTogdm9pZCA9PiB7XG4gICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgdGhpcy5nZXREaXJMaXN0aW5nKHR4LCBwLCBpbm9kZSwgKGUsIGxpc3Rpbmc/KSA9PiB7XG4gICAgICAgICAgaWYgKG5vRXJyb3IoZSwgY2IpKSB7XG4gICAgICAgICAgICBjYihudWxsLCBpbm9kZSwgbGlzdGluZyk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgbmV3IG5vZGUgdW5kZXIgYSByYW5kb20gSUQuIFJldHJpZXMgNSB0aW1lcyBiZWZvcmUgZ2l2aW5nIHVwIGluXG4gICAqIHRoZSBleGNlZWRpbmdseSB1bmxpa2VseSBjaGFuY2UgdGhhdCB3ZSB0cnkgdG8gcmV1c2UgYSByYW5kb20gR1VJRC5cbiAgICogQHBhcmFtIGNiIFBhc3NlZCBhbiBlcnJvciBvciB0aGUgR1VJRCB0aGF0IHRoZSBkYXRhIHdhcyBzdG9yZWQgdW5kZXIuXG4gICAqL1xuICBwcml2YXRlIGFkZE5ld05vZGUodHg6IEFzeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uLCBkYXRhOiBOb2RlQnVmZmVyLCBjYjogKGU6IEFwaUVycm9yLCBndWlkPzogc3RyaW5nKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIHJldHJpZXMgPSAwLCBjdXJySWQ6IHN0cmluZyxcbiAgICAgIHJlcm9sbCA9ICgpID0+IHtcbiAgICAgICAgaWYgKCsrcmV0cmllcyA9PT0gNSkge1xuICAgICAgICAgIC8vIE1heCByZXRyaWVzIGhpdC4gUmV0dXJuIHdpdGggYW4gZXJyb3IuXG4gICAgICAgICAgY2IobmV3IEFwaUVycm9yKEVycm9yQ29kZS5FSU8sICdVbmFibGUgdG8gY29tbWl0IGRhdGEgdG8ga2V5LXZhbHVlIHN0b3JlLicpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBUcnkgYWdhaW4uXG4gICAgICAgICAgY3VycklkID0gR2VuZXJhdGVSYW5kb21JRCgpO1xuICAgICAgICAgIHR4LnB1dChjdXJySWQsIGRhdGEsIGZhbHNlLCAoZTogQXBpRXJyb3IsIGNvbW1pdHRlZD86IGJvb2xlYW4pID0+IHtcbiAgICAgICAgICAgIGlmIChlIHx8ICFjb21taXR0ZWQpIHtcbiAgICAgICAgICAgICAgcmVyb2xsKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBTdWNjZXNzZnVsbHkgc3RvcmVkIHVuZGVyICdjdXJySWQnLlxuICAgICAgICAgICAgICBjYihudWxsLCBjdXJySWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIHJlcm9sbCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbW1pdHMgYSBuZXcgZmlsZSAod2VsbCwgYSBGSUxFIG9yIGEgRElSRUNUT1JZKSB0byB0aGUgZmlsZSBzeXN0ZW0gd2l0aFxuICAgKiB0aGUgZ2l2ZW4gbW9kZS5cbiAgICogTm90ZTogVGhpcyB3aWxsIGNvbW1pdCB0aGUgdHJhbnNhY3Rpb24uXG4gICAqIEBwYXJhbSBwIFRoZSBwYXRoIHRvIHRoZSBuZXcgZmlsZS5cbiAgICogQHBhcmFtIHR5cGUgVGhlIHR5cGUgb2YgdGhlIG5ldyBmaWxlLlxuICAgKiBAcGFyYW0gbW9kZSBUaGUgbW9kZSB0byBjcmVhdGUgdGhlIG5ldyBmaWxlIHdpdGguXG4gICAqIEBwYXJhbSBkYXRhIFRoZSBkYXRhIHRvIHN0b3JlIGF0IHRoZSBmaWxlJ3MgZGF0YSBub2RlLlxuICAgKiBAcGFyYW0gY2IgUGFzc2VkIGFuIGVycm9yIG9yIHRoZSBJbm9kZSBmb3IgdGhlIG5ldyBmaWxlLlxuICAgKi9cbiAgcHJpdmF0ZSBjb21taXROZXdGaWxlKHR4OiBBc3luY0tleVZhbHVlUldUcmFuc2FjdGlvbiwgcDogc3RyaW5nLCB0eXBlOiBGaWxlVHlwZSwgbW9kZTogbnVtYmVyLCBkYXRhOiBOb2RlQnVmZmVyLCBjYjogKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIHBhcmVudERpciA9IHBhdGguZGlybmFtZShwKSxcbiAgICAgIGZuYW1lID0gcGF0aC5iYXNlbmFtZShwKSxcbiAgICAgIGN1cnJUaW1lID0gKG5ldyBEYXRlKCkpLmdldFRpbWUoKTtcblxuICAgIC8vIEludmFyaWFudDogVGhlIHJvb3QgYWx3YXlzIGV4aXN0cy5cbiAgICAvLyBJZiB3ZSBkb24ndCBjaGVjayB0aGlzIHByaW9yIHRvIHRha2luZyBzdGVwcyBiZWxvdywgd2Ugd2lsbCBjcmVhdGUgYVxuICAgIC8vIGZpbGUgd2l0aCBuYW1lICcnIGluIHJvb3Qgc2hvdWxkIHAgPT0gJy8nLlxuICAgIGlmIChwID09PSAnLycpIHtcbiAgICAgIHJldHVybiBjYihBcGlFcnJvci5FRVhJU1QocCkpO1xuICAgIH1cblxuICAgIC8vIExldCdzIGJ1aWxkIGEgcHlyYW1pZCBvZiBjb2RlIVxuXG4gICAgLy8gU3RlcCAxOiBHZXQgdGhlIHBhcmVudCBkaXJlY3RvcnkncyBpbm9kZSBhbmQgZGlyZWN0b3J5IGxpc3RpbmdcbiAgICB0aGlzLmZpbmRJTm9kZUFuZERpckxpc3RpbmcodHgsIHBhcmVudERpciwgKGU6IEFwaUVycm9yLCBwYXJlbnROb2RlPzogSW5vZGUsIGRpckxpc3Rpbmc/OiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30pOiB2b2lkID0+IHtcbiAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICBpZiAoZGlyTGlzdGluZ1tmbmFtZV0pIHtcbiAgICAgICAgICAvLyBGaWxlIGFscmVhZHkgZXhpc3RzLlxuICAgICAgICAgIHR4LmFib3J0KCgpID0+IHtcbiAgICAgICAgICAgIGNiKEFwaUVycm9yLkVFWElTVChwKSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gU3RlcCAyOiBDb21taXQgZGF0YSB0byBzdG9yZS5cbiAgICAgICAgICB0aGlzLmFkZE5ld05vZGUodHgsIGRhdGEsIChlOiBBcGlFcnJvciwgZGF0YUlkPzogc3RyaW5nKTogdm9pZCA9PiB7XG4gICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgLy8gU3RlcCAzOiBDb21taXQgdGhlIGZpbGUncyBpbm9kZSB0byB0aGUgc3RvcmUuXG4gICAgICAgICAgICAgIHZhciBmaWxlSW5vZGUgPSBuZXcgSW5vZGUoZGF0YUlkLCBkYXRhLmxlbmd0aCwgbW9kZSB8IHR5cGUsIGN1cnJUaW1lLCBjdXJyVGltZSwgY3VyclRpbWUpO1xuICAgICAgICAgICAgICB0aGlzLmFkZE5ld05vZGUodHgsIGZpbGVJbm9kZS50b0J1ZmZlcigpLCAoZTogQXBpRXJyb3IsIGZpbGVJbm9kZUlkPzogc3RyaW5nKTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgICAgICAvLyBTdGVwIDQ6IFVwZGF0ZSBwYXJlbnQgZGlyZWN0b3J5J3MgbGlzdGluZy5cbiAgICAgICAgICAgICAgICAgIGRpckxpc3RpbmdbZm5hbWVdID0gZmlsZUlub2RlSWQ7XG4gICAgICAgICAgICAgICAgICB0eC5wdXQocGFyZW50Tm9kZS5pZCwgbmV3IEJ1ZmZlcihKU09OLnN0cmluZ2lmeShkaXJMaXN0aW5nKSksIHRydWUsIChlOiBBcGlFcnJvcik6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAvLyBTdGVwIDU6IENvbW1pdCBhbmQgcmV0dXJuIHRoZSBuZXcgaW5vZGUuXG4gICAgICAgICAgICAgICAgICAgICAgdHguY29tbWl0KChlPzogQXBpRXJyb3IpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjYihudWxsLCBmaWxlSW5vZGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIGFsbCBjb250ZW50cyBzdG9yZWQgaW4gdGhlIGZpbGUgc3lzdGVtLlxuICAgKi9cbiAgcHVibGljIGVtcHR5KGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS5jbGVhcigoZT8pID0+IHtcbiAgICAgIGlmIChub0Vycm9yKGUsIGNiKSkge1xuICAgICAgICAvLyBJTlZBUklBTlQ6IFJvb3QgYWx3YXlzIGV4aXN0cy5cbiAgICAgICAgdGhpcy5tYWtlUm9vdERpcmVjdG9yeShjYik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgcmVuYW1lKG9sZFBhdGg6IHN0cmluZywgbmV3UGF0aDogc3RyaW5nLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZHdyaXRlJyksXG4gICAgICBvbGRQYXJlbnQgPSBwYXRoLmRpcm5hbWUob2xkUGF0aCksIG9sZE5hbWUgPSBwYXRoLmJhc2VuYW1lKG9sZFBhdGgpLFxuICAgICAgbmV3UGFyZW50ID0gcGF0aC5kaXJuYW1lKG5ld1BhdGgpLCBuZXdOYW1lID0gcGF0aC5iYXNlbmFtZShuZXdQYXRoKSxcbiAgICAgIGlub2RlczogeyBbcGF0aDogc3RyaW5nXTogSW5vZGUgfSA9IHt9LFxuICAgICAgbGlzdHM6IHtcbiAgICAgICAgW3BhdGg6IHN0cmluZ106IHsgW2ZpbGU6IHN0cmluZ106IHN0cmluZyB9XG4gICAgICB9ID0ge30sXG4gICAgICBlcnJvck9jY3VycmVkOiBib29sZWFuID0gZmFsc2U7XG5cbiAgICAvLyBJbnZhcmlhbnQ6IENhbid0IG1vdmUgYSBmb2xkZXIgaW5zaWRlIGl0c2VsZi5cbiAgICAvLyBUaGlzIGZ1bm55IGxpdHRsZSBoYWNrIGVuc3VyZXMgdGhhdCB0aGUgY2hlY2sgcGFzc2VzIG9ubHkgaWYgb2xkUGF0aFxuICAgIC8vIGlzIGEgc3VicGF0aCBvZiBuZXdQYXJlbnQuIFdlIGFwcGVuZCAnLycgdG8gYXZvaWQgbWF0Y2hpbmcgZm9sZGVycyB0aGF0XG4gICAgLy8gYXJlIGEgc3Vic3RyaW5nIG9mIHRoZSBib3R0b20tbW9zdCBmb2xkZXIgaW4gdGhlIHBhdGguXG4gICAgaWYgKChuZXdQYXJlbnQgKyAnLycpLmluZGV4T2Yob2xkUGF0aCArICcvJykgPT09IDApIHtcbiAgICAgIHJldHVybiBjYihuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVCVVNZLCBvbGRQYXJlbnQpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNwb25zaWJsZSBmb3IgUGhhc2UgMiBvZiB0aGUgcmVuYW1lIG9wZXJhdGlvbjogTW9kaWZ5aW5nIGFuZFxuICAgICAqIGNvbW1pdHRpbmcgdGhlIGRpcmVjdG9yeSBsaXN0aW5ncy4gQ2FsbGVkIG9uY2Ugd2UgaGF2ZSBzdWNjZXNzZnVsbHlcbiAgICAgKiByZXRyaWV2ZWQgYm90aCB0aGUgb2xkIGFuZCBuZXcgcGFyZW50J3MgaW5vZGVzIGFuZCBsaXN0aW5ncy5cbiAgICAgKi9cbiAgICB2YXIgdGhlT2xlU3dpdGNoYXJvbyA9ICgpOiB2b2lkID0+IHtcbiAgICAgIC8vIFNhbml0eSBjaGVjazogRW5zdXJlIGJvdGggcGF0aHMgYXJlIHByZXNlbnQsIGFuZCBubyBlcnJvciBoYXMgb2NjdXJyZWQuXG4gICAgICBpZiAoZXJyb3JPY2N1cnJlZCB8fCAhbGlzdHMuaGFzT3duUHJvcGVydHkob2xkUGFyZW50KSB8fCAhbGlzdHMuaGFzT3duUHJvcGVydHkobmV3UGFyZW50KSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB2YXIgb2xkUGFyZW50TGlzdCA9IGxpc3RzW29sZFBhcmVudF0sIG9sZFBhcmVudElOb2RlID0gaW5vZGVzW29sZFBhcmVudF0sXG4gICAgICAgIG5ld1BhcmVudExpc3QgPSBsaXN0c1tuZXdQYXJlbnRdLCBuZXdQYXJlbnRJTm9kZSA9IGlub2Rlc1tuZXdQYXJlbnRdO1xuXG4gICAgICAvLyBEZWxldGUgZmlsZSBmcm9tIG9sZCBwYXJlbnQuXG4gICAgICBpZiAoIW9sZFBhcmVudExpc3Rbb2xkTmFtZV0pIHtcbiAgICAgICAgY2IoQXBpRXJyb3IuRU5PRU5UKG9sZFBhdGgpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBmaWxlSWQgPSBvbGRQYXJlbnRMaXN0W29sZE5hbWVdO1xuICAgICAgICBkZWxldGUgb2xkUGFyZW50TGlzdFtvbGROYW1lXTtcblxuICAgICAgICAvLyBGaW5pc2hlcyBvZmYgdGhlIHJlbmFtaW5nIHByb2Nlc3MgYnkgYWRkaW5nIHRoZSBmaWxlIHRvIHRoZSBuZXdcbiAgICAgICAgLy8gcGFyZW50LlxuICAgICAgICB2YXIgY29tcGxldGVSZW5hbWUgPSAoKSA9PiB7XG4gICAgICAgICAgbmV3UGFyZW50TGlzdFtuZXdOYW1lXSA9IGZpbGVJZDtcbiAgICAgICAgICAvLyBDb21taXQgb2xkIHBhcmVudCdzIGxpc3QuXG4gICAgICAgICAgdHgucHV0KG9sZFBhcmVudElOb2RlLmlkLCBuZXcgQnVmZmVyKEpTT04uc3RyaW5naWZ5KG9sZFBhcmVudExpc3QpKSwgdHJ1ZSwgKGU6IEFwaUVycm9yKSA9PiB7XG4gICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgaWYgKG9sZFBhcmVudCA9PT0gbmV3UGFyZW50KSB7XG4gICAgICAgICAgICAgICAgLy8gRE9ORSFcbiAgICAgICAgICAgICAgICB0eC5jb21taXQoY2IpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIENvbW1pdCBuZXcgcGFyZW50J3MgbGlzdC5cbiAgICAgICAgICAgICAgICB0eC5wdXQobmV3UGFyZW50SU5vZGUuaWQsIG5ldyBCdWZmZXIoSlNPTi5zdHJpbmdpZnkobmV3UGFyZW50TGlzdCkpLCB0cnVlLCAoZTogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICAgICAgICB0eC5jb21taXQoY2IpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKG5ld1BhcmVudExpc3RbbmV3TmFtZV0pIHtcbiAgICAgICAgICAvLyAnbmV3UGF0aCcgYWxyZWFkeSBleGlzdHMuIENoZWNrIGlmIGl0J3MgYSBmaWxlIG9yIGEgZGlyZWN0b3J5LCBhbmRcbiAgICAgICAgICAvLyBhY3QgYWNjb3JkaW5nbHkuXG4gICAgICAgICAgdGhpcy5nZXRJTm9kZSh0eCwgbmV3UGF0aCwgbmV3UGFyZW50TGlzdFtuZXdOYW1lXSwgKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKSA9PiB7XG4gICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgaWYgKGlub2RlLmlzRmlsZSgpKSB7XG4gICAgICAgICAgICAgICAgLy8gRGVsZXRlIHRoZSBmaWxlIGFuZCBjb250aW51ZS5cbiAgICAgICAgICAgICAgICB0eC5kZWwoaW5vZGUuaWQsIChlPzogQXBpRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICAgICAgICB0eC5kZWwobmV3UGFyZW50TGlzdFtuZXdOYW1lXSwgKGU/OiBBcGlFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29tcGxldGVSZW5hbWUoKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIENhbid0IG92ZXJ3cml0ZSBhIGRpcmVjdG9yeSB1c2luZyByZW5hbWUuXG4gICAgICAgICAgICAgICAgdHguYWJvcnQoKGU/KSA9PiB7XG4gICAgICAgICAgICAgICAgICBjYihBcGlFcnJvci5FUEVSTShuZXdQYXRoKSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb21wbGV0ZVJlbmFtZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEdyYWJzIGEgcGF0aCdzIGlub2RlIGFuZCBkaXJlY3RvcnkgbGlzdGluZywgYW5kIHNob3ZlcyBpdCBpbnRvIHRoZVxuICAgICAqIGlub2RlcyBhbmQgbGlzdHMgaGFzaGVzLlxuICAgICAqL1xuICAgIHZhciBwcm9jZXNzSW5vZGVBbmRMaXN0aW5ncyA9IChwOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgIHRoaXMuZmluZElOb2RlQW5kRGlyTGlzdGluZyh0eCwgcCwgKGU6IEFwaUVycm9yLCBub2RlPzogSW5vZGUsIGRpckxpc3Q/OiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30pOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKGUpIHtcbiAgICAgICAgICBpZiAoIWVycm9yT2NjdXJyZWQpIHtcbiAgICAgICAgICAgIGVycm9yT2NjdXJyZWQgPSB0cnVlO1xuICAgICAgICAgICAgdHguYWJvcnQoKCkgPT4ge1xuICAgICAgICAgICAgICBjYihlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBJZiBlcnJvciBoYXMgb2NjdXJyZWQgYWxyZWFkeSwganVzdCBzdG9wIGhlcmUuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaW5vZGVzW3BdID0gbm9kZTtcbiAgICAgICAgICBsaXN0c1twXSA9IGRpckxpc3Q7XG4gICAgICAgICAgdGhlT2xlU3dpdGNoYXJvbygpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgcHJvY2Vzc0lub2RlQW5kTGlzdGluZ3Mob2xkUGFyZW50KTtcbiAgICBpZiAob2xkUGFyZW50ICE9PSBuZXdQYXJlbnQpIHtcbiAgICAgIHByb2Nlc3NJbm9kZUFuZExpc3RpbmdzKG5ld1BhcmVudCk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHN0YXQocDogc3RyaW5nLCBpc0xzdGF0OiBib29sZWFuLCBjYjogKGVycjogQXBpRXJyb3IsIHN0YXQ/OiBTdGF0cykgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZG9ubHknKTtcbiAgICB0aGlzLmZpbmRJTm9kZSh0eCwgcCwgKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKTogdm9pZCA9PiB7XG4gICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgY2IobnVsbCwgaW5vZGUudG9TdGF0cygpKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVGaWxlKHA6IHN0cmluZywgZmxhZzogZmlsZV9mbGFnLkZpbGVGbGFnLCBtb2RlOiBudW1iZXIsIGNiOiAoZTogQXBpRXJyb3IsIGZpbGU/OiBmaWxlLkZpbGUpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpLFxuICAgICAgZGF0YSA9IG5ldyBCdWZmZXIoMCk7XG5cbiAgICB0aGlzLmNvbW1pdE5ld0ZpbGUodHgsIHAsIEZpbGVUeXBlLkZJTEUsIG1vZGUsIGRhdGEsIChlOiBBcGlFcnJvciwgbmV3RmlsZT86IElub2RlKTogdm9pZCA9PiB7XG4gICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgY2IobnVsbCwgbmV3IEFzeW5jS2V5VmFsdWVGaWxlKHRoaXMsIHAsIGZsYWcsIG5ld0ZpbGUudG9TdGF0cygpLCBkYXRhKSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgb3BlbkZpbGUocDogc3RyaW5nLCBmbGFnOiBmaWxlX2ZsYWcuRmlsZUZsYWcsIGNiOiAoZTogQXBpRXJyb3IsIGZpbGU/OiBmaWxlLkZpbGUpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWRvbmx5Jyk7XG4gICAgLy8gU3RlcCAxOiBHcmFiIHRoZSBmaWxlJ3MgaW5vZGUuXG4gICAgdGhpcy5maW5kSU5vZGUodHgsIHAsIChlOiBBcGlFcnJvciwgaW5vZGU/OiBJbm9kZSkgPT4ge1xuICAgICAgaWYgKG5vRXJyb3IoZSwgY2IpKSB7XG4gICAgICAgIC8vIFN0ZXAgMjogR3JhYiB0aGUgZmlsZSdzIGRhdGEuXG4gICAgICAgIHR4LmdldChpbm9kZS5pZCwgKGU6IEFwaUVycm9yLCBkYXRhPzogTm9kZUJ1ZmZlcik6IHZvaWQgPT4ge1xuICAgICAgICAgIGlmIChub0Vycm9yKGUsIGNiKSkge1xuICAgICAgICAgICAgaWYgKGRhdGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBjYihBcGlFcnJvci5FTk9FTlQocCkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY2IobnVsbCwgbmV3IEFzeW5jS2V5VmFsdWVGaWxlKHRoaXMsIHAsIGZsYWcsIGlub2RlLnRvU3RhdHMoKSwgZGF0YSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCB0cmFjZXMgb2YgdGhlIGdpdmVuIHBhdGggZnJvbSB0aGUgZmlsZSBzeXN0ZW0uXG4gICAqIEBwYXJhbSBwIFRoZSBwYXRoIHRvIHJlbW92ZSBmcm9tIHRoZSBmaWxlIHN5c3RlbS5cbiAgICogQHBhcmFtIGlzRGlyIERvZXMgdGhlIHBhdGggYmVsb25nIHRvIGEgZGlyZWN0b3J5LCBvciBhIGZpbGU/XG4gICAqIEB0b2RvIFVwZGF0ZSBtdGltZS5cbiAgICovXG4gIHByaXZhdGUgcmVtb3ZlRW50cnkocDogc3RyaW5nLCBpc0RpcjogYm9vbGVhbiwgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB2YXIgdHggPSB0aGlzLnN0b3JlLmJlZ2luVHJhbnNhY3Rpb24oJ3JlYWR3cml0ZScpLFxuICAgICAgcGFyZW50OiBzdHJpbmcgPSBwYXRoLmRpcm5hbWUocCksIGZpbGVOYW1lOiBzdHJpbmcgPSBwYXRoLmJhc2VuYW1lKHApO1xuICAgIC8vIFN0ZXAgMTogR2V0IHBhcmVudCBkaXJlY3RvcnkncyBub2RlIGFuZCBkaXJlY3RvcnkgbGlzdGluZy5cbiAgICB0aGlzLmZpbmRJTm9kZUFuZERpckxpc3RpbmcodHgsIHBhcmVudCwgKGU6IEFwaUVycm9yLCBwYXJlbnROb2RlPzogSW5vZGUsIHBhcmVudExpc3Rpbmc/OiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30pOiB2b2lkID0+IHtcbiAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICBpZiAoIXBhcmVudExpc3RpbmdbZmlsZU5hbWVdKSB7XG4gICAgICAgICAgdHguYWJvcnQoKCkgPT4ge1xuICAgICAgICAgICAgY2IoQXBpRXJyb3IuRU5PRU5UKHApKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBSZW1vdmUgZnJvbSBkaXJlY3RvcnkgbGlzdGluZyBvZiBwYXJlbnQuXG4gICAgICAgICAgdmFyIGZpbGVOb2RlSWQgPSBwYXJlbnRMaXN0aW5nW2ZpbGVOYW1lXTtcbiAgICAgICAgICBkZWxldGUgcGFyZW50TGlzdGluZ1tmaWxlTmFtZV07XG4gICAgICAgICAgLy8gU3RlcCAyOiBHZXQgZmlsZSBpbm9kZS5cbiAgICAgICAgICB0aGlzLmdldElOb2RlKHR4LCBwLCBmaWxlTm9kZUlkLCAoZTogQXBpRXJyb3IsIGZpbGVOb2RlPzogSW5vZGUpOiB2b2lkID0+IHtcbiAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICBpZiAoIWlzRGlyICYmIGZpbGVOb2RlLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICB0eC5hYm9ydCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICBjYihBcGlFcnJvci5FSVNESVIocCkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGlzRGlyICYmICFmaWxlTm9kZS5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgICAgICAgICAgdHguYWJvcnQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgY2IoQXBpRXJyb3IuRU5PVERJUihwKSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gU3RlcCAzOiBEZWxldGUgZGF0YS5cbiAgICAgICAgICAgICAgICB0eC5kZWwoZmlsZU5vZGUuaWQsIChlPzogQXBpRXJyb3IpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBTdGVwIDQ6IERlbGV0ZSBub2RlLlxuICAgICAgICAgICAgICAgICAgICB0eC5kZWwoZmlsZU5vZGVJZCwgKGU/OiBBcGlFcnJvcik6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU3RlcCA1OiBVcGRhdGUgZGlyZWN0b3J5IGxpc3RpbmcuXG4gICAgICAgICAgICAgICAgICAgICAgICB0eC5wdXQocGFyZW50Tm9kZS5pZCwgbmV3IEJ1ZmZlcihKU09OLnN0cmluZ2lmeShwYXJlbnRMaXN0aW5nKSksIHRydWUsIChlOiBBcGlFcnJvcik6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eC5jb21taXQoY2IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyB1bmxpbmsocDogc3RyaW5nLCBjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMucmVtb3ZlRW50cnkocCwgZmFsc2UsIGNiKTtcbiAgfVxuXG4gIHB1YmxpYyBybWRpcihwOiBzdHJpbmcsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5yZW1vdmVFbnRyeShwLCB0cnVlLCBjYik7XG4gIH1cblxuICBwdWJsaWMgbWtkaXIocDogc3RyaW5nLCBtb2RlOiBudW1iZXIsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdmFyIHR4ID0gdGhpcy5zdG9yZS5iZWdpblRyYW5zYWN0aW9uKCdyZWFkd3JpdGUnKSxcbiAgICAgIGRhdGEgPSBuZXcgQnVmZmVyKCd7fScpO1xuICAgIHRoaXMuY29tbWl0TmV3RmlsZSh0eCwgcCwgRmlsZVR5cGUuRElSRUNUT1JZLCBtb2RlLCBkYXRhLCBjYik7XG4gIH1cblxuICBwdWJsaWMgcmVhZGRpcihwOiBzdHJpbmcsIGNiOiAoZXJyOiBBcGlFcnJvciwgZmlsZXM/OiBzdHJpbmdbXSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHZhciB0eCA9IHRoaXMuc3RvcmUuYmVnaW5UcmFuc2FjdGlvbigncmVhZG9ubHknKTtcbiAgICB0aGlzLmZpbmRJTm9kZSh0eCwgcCwgKGU6IEFwaUVycm9yLCBpbm9kZT86IElub2RlKSA9PiB7XG4gICAgICBpZiAobm9FcnJvcihlLCBjYikpIHtcbiAgICAgICAgdGhpcy5nZXREaXJMaXN0aW5nKHR4LCBwLCBpbm9kZSwgKGU6IEFwaUVycm9yLCBkaXJMaXN0aW5nPzoge1tuYW1lOiBzdHJpbmddOiBzdHJpbmd9KSA9PiB7XG4gICAgICAgICAgaWYgKG5vRXJyb3IoZSwgY2IpKSB7XG4gICAgICAgICAgICBjYihudWxsLCBPYmplY3Qua2V5cyhkaXJMaXN0aW5nKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBfc3luYyhwOiBzdHJpbmcsIGRhdGE6IE5vZGVCdWZmZXIsIHN0YXRzOiBTdGF0cywgY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICAvLyBAdG9kbyBFbnN1cmUgbXRpbWUgdXBkYXRlcyBwcm9wZXJseSwgYW5kIHVzZSB0aGF0IHRvIGRldGVybWluZSBpZiBhIGRhdGFcbiAgICAvLyAgICAgICB1cGRhdGUgaXMgcmVxdWlyZWQuXG4gICAgdmFyIHR4ID0gdGhpcy5zdG9yZS5iZWdpblRyYW5zYWN0aW9uKCdyZWFkd3JpdGUnKTtcbiAgICAvLyBTdGVwIDE6IEdldCB0aGUgZmlsZSBub2RlJ3MgSUQuXG4gICAgdGhpcy5fZmluZElOb2RlKHR4LCBwYXRoLmRpcm5hbWUocCksIHBhdGguYmFzZW5hbWUocCksIChlOiBBcGlFcnJvciwgZmlsZUlub2RlSWQ/OiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgIGlmIChub0Vycm9yVHgoZSwgdHgsIGNiKSkge1xuICAgICAgICAvLyBTdGVwIDI6IEdldCB0aGUgZmlsZSBpbm9kZS5cbiAgICAgICAgdGhpcy5nZXRJTm9kZSh0eCwgcCwgZmlsZUlub2RlSWQsIChlOiBBcGlFcnJvciwgZmlsZUlub2RlPzogSW5vZGUpOiB2b2lkID0+IHtcbiAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgIHZhciBpbm9kZUNoYW5nZWQ6IGJvb2xlYW4gPSBmaWxlSW5vZGUudXBkYXRlKHN0YXRzKTtcbiAgICAgICAgICAgIC8vIFN0ZXAgMzogU3luYyB0aGUgZGF0YS5cbiAgICAgICAgICAgIHR4LnB1dChmaWxlSW5vZGUuaWQsIGRhdGEsIHRydWUsIChlOiBBcGlFcnJvcik6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICBpZiAobm9FcnJvclR4KGUsIHR4LCBjYikpIHtcbiAgICAgICAgICAgICAgICAvLyBTdGVwIDQ6IFN5bmMgdGhlIG1ldGFkYXRhIChpZiBpdCBjaGFuZ2VkKSFcbiAgICAgICAgICAgICAgICBpZiAoaW5vZGVDaGFuZ2VkKSB7XG4gICAgICAgICAgICAgICAgICB0eC5wdXQoZmlsZUlub2RlSWQsIGZpbGVJbm9kZS50b0J1ZmZlcigpLCB0cnVlLCAoZTogQXBpRXJyb3IpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5vRXJyb3JUeChlLCB0eCwgY2IpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgdHguY29tbWl0KGNiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIC8vIE5vIG5lZWQgdG8gc3luYyBtZXRhZGF0YTsgcmV0dXJuLlxuICAgICAgICAgICAgICAgICAgdHguY29tbWl0KGNiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==