// Generated by CoffeeScript 1.6.2
(function() {
  BrowserFS.FileIndex = (function() {
    function FileIndex() {
      this._index = {};
    }

    FileIndex.prototype._split_path = function(path) {
      var dirpath, itemname;

      dirpath = BrowserFS.node.path.dirname(path);
      itemname = path.substr(dirpath.length + (dirpath === "/" ? 0 : 1));
      return [dirpath, itemname];
    };

    FileIndex.prototype.addPath = function(path, inode) {
      var dirpath, itemname, parent, _ref;

      if (inode == null) {
        throw new Error('Inode must be specified');
      }
      if (path[0] !== '/') {
        throw new Error('Path must be absolute, got: ' + path);
      }
      if (this._index[path] !== void 0) {
        return this._index[path] === inode;
      }
      _ref = this._split_path(path), dirpath = _ref[0], itemname = _ref[1];
      parent = this._index[dirpath];
      if (parent === void 0 && path !== '/') {
        parent = new BrowserFS.DirInode();
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

    FileIndex.prototype.removePath = function(path) {
      var dirpath, inode, itemname, parent, _ref;

      _ref = this._split_path(path), dirpath = _ref[0], itemname = _ref[1];
      parent = this._index[dirpath];
      if (parent === void 0) {
        return null;
      }
      inode = parent.remItem(itemname);
      if (inode === null) {
        return null;
      }
      if (!inode.isFile()) {
        delete this._index[path];
      }
      return inode;
    };

    FileIndex.prototype.ls = function(path) {
      var item;

      item = this._index[path];
      if (item === void 0) {
        return null;
      }
      return item.getListing();
    };

    FileIndex.prototype.getInode = function(path) {
      var dirpath, itemname, parent, _ref;

      _ref = this._split_path(path), dirpath = _ref[0], itemname = _ref[1];
      parent = this._index[dirpath];
      if (parent === void 0) {
        return null;
      }
      if (dirpath === path) {
        return parent;
      }
      return parent.getItem(itemname);
    };

    return FileIndex;

  })();

  BrowserFS.FileIndex.from_listing = function(listing) {
    var children, idx, inode, name, node, parent, pwd, queue, rootInode, tree, _ref;

    idx = new BrowserFS.FileIndex();
    rootInode = new BrowserFS.DirInode();
    idx._index['/'] = rootInode;
    queue = [['', listing, rootInode]];
    while (queue.length > 0) {
      _ref = queue.pop(), pwd = _ref[0], tree = _ref[1], parent = _ref[2];
      for (node in tree) {
        children = tree[node];
        name = "" + pwd + "/" + node;
        if (children != null) {
          idx._index[name] = inode = new BrowserFS.DirInode();
          queue.push([name, children, inode]);
        } else {
          idx._index[name] = inode = new BrowserFS.FileInode(BrowserFS.node.fs.Stats.FILE, -1);
        }
        if (parent != null) {
          parent._ls[node] = inode;
        }
      }
    }
    return idx;
  };

  BrowserFS.FileInode = BrowserFS.node.fs.Stats;

  BrowserFS.DirInode = (function() {
    function DirInode() {
      this._ls = {};
    }

    DirInode.prototype.isFile = function() {
      return false;
    };

    DirInode.prototype.isDirectory = function() {
      return true;
    };

    DirInode.prototype.getStats = function() {
      return new BrowserFS.node.fs.Stats(BrowserFS.node.fs.Stats.DIRECTORY, 4096);
    };

    DirInode.prototype.getListing = function() {
      return Object.keys(this._ls);
    };

    DirInode.prototype.getItem = function(p) {
      var _ref;

      return (_ref = this._ls[p]) != null ? _ref : null;
    };

    DirInode.prototype.addItem = function(p, inode) {
      if (p in this._ls) {
        return false;
      }
      this._ls[p] = inode;
      return true;
    };

    DirInode.prototype.remItem = function(p) {
      var item;

      item = this._ls[p];
      if (item === void 0) {
        return null;
      }
      delete this._ls[p];
      return item;
    };

    return DirInode;

  })();

}).call(this);