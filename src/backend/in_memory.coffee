# A simple filesystem that exists only in memory.
#
# Note: This hacks a file_data property into each file inode,
#   which are actually just fs.Stats objects.
class BrowserFS.FileSystem.InMemory extends BrowserFS.FileSystem
  # Constructs the file system, with no files or directories.
  constructor: -> @empty()

  # Clears all data, resetting to the 'just-initialized' state.
  empty: -> @_index = new BrowserFS.FileIndex

  # Returns the name of the file system.
  # @return [String]
  getName: -> 'In-memory'
  # All browsers support storing data in memory.
  # @return [Boolean]
  isAvailable: -> true

  # Passes the size and taken space in bytes to the callback.
  #
  # **Note**: We can use all available memory on the system, so we return +Inf.
  # @param [String] path Unused in the implementation.
  # @param [Function(Number, Number)] cb
  diskSpace: (path, cb) ->
    cb Infinity, roughSizeOfObject @_index

  # Returns false; this filesystem is not read-only.
  # @return [Boolean]
  isReadOnly: -> false
  # Returns false; this filesystem does not support symlinks.
  # @return [Boolean]
  supportsLinks: -> false
  # Returns false; this filesystem does not support properties (yet).
  # @return [Boolean]
  supportsProps: -> false

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
    cb null, inode

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
            # Truncate to 0.
            inode.size = 0
            inode.mtime = new Date()
            file = inode.file_data
            file._buffer = new BrowserFS.node.Buffer 0
          when BrowserFS.FileMode.NOP
            # Use existing file contents.
            file = inode.file_data
            file._mode = flags
          else
            return cb new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, 'Invalid FileMode object.'
    else
      switch flags.pathNotExistsAction()
        when BrowserFS.FileMode.CREATE_FILE
          inode = new BrowserFS.node.fs.Stats(BrowserFS.node.fs.Stats.FILE, 0, mode)
          file = new BrowserFS.File.PreloadFile.InMemoryFile @, path, flags, inode
          inode.file_data = file
          @_index.addPath path, inode
        when BrowserFS.FileMode.THROW_EXCEPTION
          return cb new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, "#{path} doesn't exist."
        else
          return cb new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, 'Invalid FileMode object.'

    # 'file' should be set by now.
    cb null, file

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
    cb()

  mkdir: (path, mode, cb) ->
    # Check if it exists.
    inode = @_index.getInode path
    if inode isnt null
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


# File class for the InMemory file system.
class BrowserFS.File.PreloadFile.InMemoryFile extends BrowserFS.File.PreloadFile
  # Asynchronous sync. Doesn't do anything, simply calls the cb.
  # @param [Function(BrowserFS.ApiError)] cb
  sync: (cb) -> cb()

  # Asynchronous close. Doesn't do anything, simply calls the cb.
  # @param [Function(BrowserFS.ApiError)] cb
  close: (cb)-> cb()


# Estimates the size of a JS object.
# @param [Object] the object to measure.
# @return [Number] estimated object size.
# @see http://stackoverflow.com/a/11900218/10601
roughSizeOfObject = (object) ->
  objectList = []
  stack = [object]
  bytes = 0
  until stack.length is 0
    value = stack.pop()
    if typeof value is 'boolean'
      bytes += 4
    else if typeof value is 'string'
      bytes += value.length * 2
    else if typeof value is 'number'
      bytes += 8
    else if typeof value is 'object' and value not in objectList
      objectList.push value
      for key, prop of value
        bytes += key.length * 2
        stack.push prop
  return bytes
