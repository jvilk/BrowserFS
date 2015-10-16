var node_fs_stats = require('../core/node_fs_stats');
var path = require('../core/node_path');
var Stats = node_fs_stats.Stats;
var FileIndex = (function () {
    function FileIndex() {
        this._index = {};
        this.addPath('/', new DirInode());
    }
    FileIndex.prototype._split_path = function (p) {
        var dirpath = path.dirname(p);
        var itemname = p.substr(dirpath.length + (dirpath === "/" ? 0 : 1));
        return [dirpath, itemname];
    };
    FileIndex.prototype.fileIterator = function (cb) {
        for (var path in this._index) {
            var dir = this._index[path];
            var files = dir.getListing();
            for (var i = 0; i < files.length; i++) {
                var item = dir.getItem(files[i]);
                if (item.isFile()) {
                    cb(item.getData());
                }
            }
        }
    };
    FileIndex.prototype.addPath = function (path, inode) {
        if (inode == null) {
            throw new Error('Inode must be specified');
        }
        if (path[0] !== '/') {
            throw new Error('Path must be absolute, got: ' + path);
        }
        if (this._index.hasOwnProperty(path)) {
            return this._index[path] === inode;
        }
        var splitPath = this._split_path(path);
        var dirpath = splitPath[0];
        var itemname = splitPath[1];
        var parent = this._index[dirpath];
        if (parent === undefined && path !== '/') {
            parent = new DirInode();
            if (!this.addPath(dirpath, parent)) {
                return false;
            }
        }
        if (path !== '/') {
            if (!parent.addItem(itemname, inode)) {
                return false;
            }
        }
        if (!inode.isFile()) {
            this._index[path] = inode;
        }
        return true;
    };
    FileIndex.prototype.removePath = function (path) {
        var splitPath = this._split_path(path);
        var dirpath = splitPath[0];
        var itemname = splitPath[1];
        var parent = this._index[dirpath];
        if (parent === undefined) {
            return null;
        }
        var inode = parent.remItem(itemname);
        if (inode === null) {
            return null;
        }
        if (!inode.isFile()) {
            var dirInode = inode;
            var children = dirInode.getListing();
            for (var i = 0; i < children.length; i++) {
                this.removePath(path + '/' + children[i]);
            }
            if (path !== '/') {
                delete this._index[path];
            }
        }
        return inode;
    };
    FileIndex.prototype.ls = function (path) {
        var item = this._index[path];
        if (item === undefined) {
            return null;
        }
        return item.getListing();
    };
    FileIndex.prototype.getInode = function (path) {
        var splitPath = this._split_path(path);
        var dirpath = splitPath[0];
        var itemname = splitPath[1];
        var parent = this._index[dirpath];
        if (parent === undefined) {
            return null;
        }
        if (dirpath === path) {
            return parent;
        }
        return parent.getItem(itemname);
    };
    FileIndex.from_listing = function (listing) {
        var idx = new FileIndex();
        var rootInode = new DirInode();
        idx._index['/'] = rootInode;
        var queue = [['', listing, rootInode]];
        while (queue.length > 0) {
            var inode;
            var next = queue.pop();
            var pwd = next[0];
            var tree = next[1];
            var parent = next[2];
            for (var node in tree) {
                var children = tree[node];
                var name = "" + pwd + "/" + node;
                if (children != null) {
                    idx._index[name] = inode = new DirInode();
                    queue.push([name, children, inode]);
                }
                else {
                    inode = new FileInode(new Stats(node_fs_stats.FileType.FILE, -1, 0x16D));
                }
                if (parent != null) {
                    parent._ls[node] = inode;
                }
            }
        }
        return idx;
    };
    return FileIndex;
})();
exports.FileIndex = FileIndex;
var FileInode = (function () {
    function FileInode(data) {
        this.data = data;
    }
    FileInode.prototype.isFile = function () { return true; };
    FileInode.prototype.isDir = function () { return false; };
    FileInode.prototype.getData = function () { return this.data; };
    FileInode.prototype.setData = function (data) { this.data = data; };
    return FileInode;
})();
exports.FileInode = FileInode;
var DirInode = (function () {
    function DirInode() {
        this._ls = {};
    }
    DirInode.prototype.isFile = function () {
        return false;
    };
    DirInode.prototype.isDir = function () {
        return true;
    };
    DirInode.prototype.getStats = function () {
        return new Stats(node_fs_stats.FileType.DIRECTORY, 4096, 0x16D);
    };
    DirInode.prototype.getListing = function () {
        return Object.keys(this._ls);
    };
    DirInode.prototype.getItem = function (p) {
        var _ref;
        return (_ref = this._ls[p]) != null ? _ref : null;
    };
    DirInode.prototype.addItem = function (p, inode) {
        if (p in this._ls) {
            return false;
        }
        this._ls[p] = inode;
        return true;
    };
    DirInode.prototype.remItem = function (p) {
        var item = this._ls[p];
        if (item === undefined) {
            return null;
        }
        delete this._ls[p];
        return item;
    };
    return DirInode;
})();
exports.DirInode = DirInode;
//# sourceMappingURL=file_index.js.map