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
    for i in [0...length]
      path = window.localStorage.key i
      data = window.localStorage.getItem path
      inode = new BrowserFS.FileInode BrowserFS.node.fs.Stats.FILE, data.length
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
    buffer = new BrowserFS.node.Buffer(data, 'binary_string')
    return new BrowserFS.File.PreloadFile.LocalStorageFile @, path, flags, inode.getStats(), buffer

  # Handles syncing file data with `localStorage`.
  # @param [String] path
  # @param [String] data
  # @param [BrowserFS.FileInode] inode
  # @param [Function(BrowserFS.ApiError)] cb
  _sync: (path, data, inode, cb) ->
    try
      window.localStorage.setItem path, data
      @_index.addPath path, inode
    catch e
      # Assume we're out of space.
      cb new BrowserFS.ApiError BrowserFS.ApiError.DRIVE_FULL, "Unable to sync #{path}"
    cb()

  # Removes all data from localStorage.
  empty: -> window.localStorage.clear()
  # Returns the name of the file system.
  # @return [String]
  getName: -> 'localStorage'
  # Does the browser support localStorage?
  # @return [Boolean]
  isAvailable: -> window?.localStorage?
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
  supportsProps: -> false

  # File operations

  _truncate: (path, flags, inode) ->
    inode.size = 0
    new BrowserFS.File.PreloadFile.LocalStorageFile @, path, flags, inode

  _fetch: (path, flags, inode) ->
    @_getFile path, flags, inode

  _create: (path, flags, inode) ->
    new BrowserFS.File.PreloadFile.LocalStorageFile @, path, flags, inode

  # Directory operations

  _rmdir: (path, inode, cb) ->
    # Remove all files belonging to the path from `localStorage`.
    files = inode.getListing()
    sep = BrowserFS.node.path.sep
    for file in files
      window.localStorage.removeItem "#{path}#{sep}#{file}"
    cb()


# File class for the LocalStorage-based file system.
class BrowserFS.File.PreloadFile.LocalStorageFile extends BrowserFS.File.PreloadFile
  # Asynchronous sync.
  # @param [Function(BrowserFS.ApiError)] cb
  sync: (cb)->
    # Convert to packed UTF-16 (2 bytes per character, 1 character header)
    data = @_buffer.toString('binary_string')
    inode = BrowserFS.FileInode.from_stats @_stat
    @_fs._sync @_path, data, inode, cb

  # Asynchronous close.
  # @param [Function(BrowserFS.ApiError)] cb
  close: (cb)->
    # Maps to sync.
    @sync cb
