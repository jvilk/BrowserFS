# A simple filesystem backed by local storage.
#
# Note that your program should only ever have one instance of this class.
# @todo Pack names efficiently: Convert to UTF-8, then convert to a packed
#   UTF-16 representation (each character is 2 bytes).
# @todo Store directory information explicitly. Could do something cool, like
#   have directory information contain the keys for each subitem, where the
#   key doesn't have to be the full-path. That would conserve space in
#   localStorage.
class BrowserFS.FileSystem.LocalStorage extends BrowserFS.IndexedFileSystem
  # Constructs the file system. Loads up any existing files stored in local
  # storage into a simple file index.
  constructor: ->
    @_index = new BrowserFS.FileIndex
    for i in [0...window.localStorage.length] by 1
      path = window.localStorage.key i
      # Ignore keys that don't look like absolute paths.
      continue unless path[0] is '/'
      data = window.localStorage.getItem path
      # XXX: I don't know *how*, but sometimes these items become null.
      data ?= null
      # data is in packed UTF-16 (2 bytes per character, 1 character header)
      len = if data.length > 0 then data.length * 2 - 1 else 0
      inode = new BrowserFS.FileInode BrowserFS.node.fs.Stats.FILE, len
      @_index.addPath path, inode

  # Retrieve the indicated file from `localStorage`.
  # @param [String] path
  # @param [BrowserFS.FileMode] flags
  # @param [BrowserFS.FileInode] inode
  # @return [BrowserFS.File.PreloadFile] Returns a preload file with the file's
  #   contents, or null if it does not exist.
  _getFile: (path, flags, inode) ->
    data = window.localStorage.getItem path
    # Doesn't exist.
    return null if data is null
    headerBuff = new BrowserFS.node.Buffer(data.substr(0, 2), 'binary_string')
    data = data.substr(2)
    buffer = new BrowserFS.node.Buffer(data, 'binary_string')
    file = new BrowserFS.File.PreloadFile.LocalStorageFile @, path, flags, inode, buffer
    file._stat.mode = headerBuff.readUInt16BE(0)
    return file

  # Handles syncing file data with `localStorage`.
  # @param [String] path
  # @param [String] data
  # @param [BrowserFS.FileInode] inode
  # @return [BrowserFS.node.fs.Stats]
  _syncSync: (path, data, inode) ->
    try
      window.localStorage.setItem path, data
      @_index.addPath path, inode
    catch e
      # Assume we're out of space.
      throw new BrowserFS.ApiError BrowserFS.ApiError.DRIVE_FULL, "Unable to sync #{path}"
    return

  # Removes all data from localStorage.
  empty: ->
    window.localStorage.clear()
    @_index = new BrowserFS.FileIndex
  # Returns the name of the file system.
  # @return [String]
  getName: -> 'localStorage'
  # Does the browser support localStorage?
  # @return [Boolean]
  @isAvailable: -> window?.localStorage?
  # Passes the size and taken space in bytes to the callback.
  #
  # **Note**: We assume that `localStorage` stores 5MB of data, but that is not
  # always true.
  # @param [String] path Unused in the implementation.
  # @param [Function(Number, Number)] cb
  # @see http://dev-test.nemikor.com/web-storage/support-test/
  diskSpace: (path, cb) ->
    # Guesstimate (5MB)
    storageLimit = 5242880

    # Assume everything is stored as UTF-16 (2 bytes per character)
    usedSpace = 0
    for i in [0...length]
      key = window.localStorage.key i
      usedSpace += key.length * 2
      data = window.localStorage.getItem key
      usedSpace += data.length * 2

    # IE has a useful function for this purpose, but it's not available
    # elsewhere. :(
    if window.localStorage.remainingSpace?
      remaining = window.localStorage.remainingSpace()
      # We can extract a more precise upper-limit from this.
      storageLimit = usedSpace + remaining

    cb storageLimit, usedSpace
  # Returns false; this filesystem is not read-only.
  # @return [Boolean]
  isReadOnly: -> false
  # Returns false; this filesystem does not support symlinks.
  # @return [Boolean]
  supportsLinks: -> false
  # Returns false; this filesystem does not support properties (yet).
  # @return [Boolean]
  supportsProps: -> true

  # File operations

  # Handles removing file data from `localStorage`.
  # @param [String] path
  unlinkSync: (path) ->
    super path
    window.localStorage.removeItem path

  _truncate: (path, flags, inode) ->
    inode.size = 0
    new BrowserFS.File.PreloadFile.LocalStorageFile @, path, flags, inode

  _fetch: (path, flags, inode) ->
    @_getFile path, flags, inode

  _create: (path, flags, inode) ->
    new BrowserFS.File.PreloadFile.LocalStorageFile @, path, flags, inode

  # Directory operations

  _rmdirSync: (path, inode) ->
    # Remove all files belonging to the path from `localStorage`.
    files = inode.getListing()
    sep = BrowserFS.node.path.sep
    for file in files
      window.localStorage.removeItem "#{path}#{sep}#{file}"
    return


# File class for the LocalStorage-based file system.
class BrowserFS.File.PreloadFile.LocalStorageFile extends BrowserFS.File.PreloadFile
  # Synchronous sync.
  syncSync: ->
    # Convert to packed UTF-16 (2 bytes per character, 1 character header)
    data = @_buffer.toString('binary_string')
    # Append fixed-size header with mode/uid/gid (16-bits) and mtime/atime (64-bits each).
    # That amounts to 18 bytes/9 characters.
    headerBuff = new BrowserFS.node.Buffer 2
    # TODO: Merge w/ uid/gid
    headerBuff.writeUInt16BE @_stat.mode, 0
    headerDat = headerBuff.toString('binary_string')
    data = headerDat + data
    # writeUInt32BE
    @_fs._syncSync @_path, data, @_stat
    return

  # Synchronous close.
  closeSync: ->
    # Maps to sync.
    @syncSync()
