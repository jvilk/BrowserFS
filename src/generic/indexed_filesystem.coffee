# A simple filesystem base class that uses an in-memory FileIndex.
class BrowserFS.IndexedFileSystem extends BrowserFS.FileSystem
  # Constructs the file system with the given FileIndex.
  # @param [BrowserFS.FileIndex] _index
  constructor: (@_index) ->

  # File or directory operations

  rename: (oldPath, newPath, cb) ->
    oldInode = @_index.removePath oldPath
    if oldInode is null
      return cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{oldPath} not found."
    # Remove the given path if it exists.
    @_index.removePath newPath
    @_index.addPath newPath, oldInode
    cb()

  stat: (path, isLstat, cb) ->
    inode = @_index.getInode path
    if inode is null
      return cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} not found."
    cb null, inode.getStats()

  # File operations

  open: (path, flags, mode, cb) ->
    # Check if the path exists, and is a file.
    inode = @_index.getInode path
    if inode isnt null
      unless inode.isFile()
        return cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} is a directory."
      else
        switch flags.pathExistsAction()
          when BrowserFS.FileMode.THROW_EXCEPTION
            return cb new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, "#{path} already exists."
          when BrowserFS.FileMode.TRUNCATE_FILE
            return cb null, @_truncate(path, flags, inode)
          when BrowserFS.FileMode.NOP
            return cb null, @_fetch(path, flags, inode)
          else
            return cb new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, 'Invalid FileMode object.'
    else
      switch flags.pathNotExistsAction()
        when BrowserFS.FileMode.CREATE_FILE
          inode = new BrowserFS.node.fs.Stats(BrowserFS.node.fs.Stats.FILE, 0, mode)
          return cb null, @_create(path, flags, inode)
        when BrowserFS.FileMode.THROW_EXCEPTION
          return cb new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, "#{path} doesn't exist."
        else
          return cb new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, 'Invalid FileMode object.'

  unlink: (path, cb) ->
    # Check if it exists, and is a file.
    inode = @_index.getInode path
    if inode is null
      return cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} not found."
    else unless inode.isFile()
      return cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} is a directory, not a file."
    @_index.removePath path
    cb()

  # Directory operations

  rmdir: (path, cb) ->
    # Check if it exists, and is a directory.
    inode = @_index.getInode path
    if inode is null
      return cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} not found."
    else if inode.isFile()
      return cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} is a file, not a directory."
    @_index.removePath path
    @_rmdir path, inode, cb

  mkdir: (path, mode, cb) ->
    # Check if it exists.
    inode = @_index.getInode path
    unless inode is null
      return cb new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, "#{path} already exists."
    success = @_index.addPath path, new BrowserFS.DirInode()
    if success then return cb null
    cb new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, "Could not add #{path} for some reason."

  readdir: (path, cb) ->
    # Check if it exists.
    inode = @_index.getInode path
    if inode is null
      return cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} not found."
    else if inode.isFile()
      return cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} is a file, not a directory."
    cb null, inode.getListing()
