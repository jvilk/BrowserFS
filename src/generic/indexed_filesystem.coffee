# A simple filesystem base class that uses an in-memory FileIndex.
class BrowserFS.IndexedFileSystem extends BrowserFS.SynchronousFileSystem
  # Constructs the file system with the given FileIndex.
  # @param [BrowserFS.FileIndex] _index
  constructor: (@_index) ->

  # File or directory operations

  renameSync: (oldPath, newPath) ->
    oldInode = @_index.removePath oldPath
    if oldInode is null
      throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{oldPath} not found."
    # Remove the given path if it exists.
    @_index.removePath newPath
    @_index.addPath newPath, oldInode
    return

  statSync: (path, isLstat) ->
    inode = @_index.getInode path
    if inode is null
      throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} not found."
    stats = inode.getStats?() ? inode
    return stats

  # File operations

  openSync: (path, flags, mode) ->
    # Check if the path exists, and is a file.
    inode = @_index.getInode path
    if inode isnt null
      unless inode.isFile()
        throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} is a directory."
      else
        switch flags.pathExistsAction()
          when BrowserFS.FileMode.THROW_EXCEPTION
            throw new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, "#{path} already exists."
          when BrowserFS.FileMode.TRUNCATE_FILE
            return @_truncate(path, flags, inode)
          when BrowserFS.FileMode.NOP
            return @_fetch(path, flags, inode)
          else
            throw new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, 'Invalid FileMode object.'
    else
      switch flags.pathNotExistsAction()
        when BrowserFS.FileMode.CREATE_FILE
          inode = new BrowserFS.node.fs.Stats(BrowserFS.node.fs.Stats.FILE, 0, mode)
          return @_create(path, flags, inode)
        when BrowserFS.FileMode.THROW_EXCEPTION
          throw new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, "#{path} doesn't exist."
        else
          throw new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, 'Invalid FileMode object.'

  unlinkSync: (path) ->
    # Check if it exists, and is a file.
    inode = @_index.getInode path
    if inode is null
      throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} not found."
    else unless inode.isFile()
      throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} is a directory, not a file."
    @_index.removePath path
    return

  # Directory operations

  rmdirSync: (path) ->
    # Check if it exists, and is a directory.
    inode = @_index.getInode path
    if inode is null
      throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} not found."
    else if inode.isFile()
      throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} is a file, not a directory."
    @_index.removePath path
    @_rmdirSync path, inode

  mkdirSync: (path, mode) ->
    # Check if it exists.
    inode = @_index.getInode path
    unless inode is null
      throw new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, "#{path} already exists."
    # Check if it lives below an existing dir (that is, we can't mkdir -p).
    parent = BrowserFS.node.path.dirname path
    if parent isnt '/' and @_index.getInode(parent) is null
      throw new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, "Can't create #{path} because #{parent} doesn't exist."
    success = @_index.addPath path, new BrowserFS.DirInode()
    if success then return
    throw new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, "Could not add #{path} for some reason."

  readdirSync: (path) ->
    # Check if it exists.
    inode = @_index.getInode path
    if inode is null
      throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} not found."
    else if inode.isFile()
      throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} is a file, not a directory."
    return inode.getListing()

  chmodSync: (path, isLchmod, mode) ->
    fd = @openSync path, BrowserFS.FileMode.getFileMode('r+'), 0o644
    fd._stat.mode = mode
    fd.closeSync()
    return

  chownSync: (path, isLchown, uid, gid) ->
    fd = @openSync path, BrowserFS.FileMode.getFileMode('r+'), 0o644
    fd._stat.uid = uid
    fd._stat.gid = gid
    fd.closeSync()
    return

  utimesSync: (path, atime, mtime) ->
    fd = @openSync path, BrowserFS.FileMode.getFileMode('r+'), 0o644
    fd._stat.atime = atime
    fd._stat.mtime = mtime
    fd.closeSync()
    return
