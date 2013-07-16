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
      # XXX: I don't know *how*, but sometimes these items become null.
      data = window.localStorage.getItem(path) ? ''
      len = @_getFileLength data
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
    return @_convertFromBinaryString path, data, flags, inode

  # Handles syncing file data with `localStorage`.
  # @param [String] path
  # @param [String] data
  # @param [BrowserFS.FileInode] inode
  # @return [BrowserFS.node.fs.Stats]
  _syncSync: (path, data, inode) ->
    data = @_convertToBinaryString data, inode
    try
      window.localStorage.setItem path, data
      @_index.addPath path, inode
    catch e
      # Assume we're out of space.
      throw new BrowserFS.ApiError BrowserFS.ApiError.DRIVE_FULL, "Unable to sync #{path}"
    return

  # Some versions of FF and all versions of IE do not support the full range of
  # 16-bit numbers encoded as characters, as they enforce UTF-16 restrictions.
  # http://stackoverflow.com/questions/11170716/are-there-any-characters-that-are-not-allowed-in-localstorage/11173673#11173673
  try
    window.localStorage.setItem("__test__", String.fromCharCode(0xD800))
    supportsBinaryString = window.localStorage.getItem("__test__") == String.fromCharCode(0xD800)
  catch e
    # IE throws an exception.
    supportsBinaryString = false

  if supportsBinaryString
    LocalStorage.prototype._convertToBinaryString = (data, inode) ->
      data = data.toString('binary_string')
      # Append fixed-size header with mode (16-bits) and mtime/atime (64-bits each).
      # I don't care about uid/gid right now.
      # That amounts to 18 bytes/9 characters + 1 character header
      headerBuff = new BrowserFS.node.Buffer 18
      headerBuff.writeUInt16BE inode.mode, 0
      # Well, they're doubles and are going to be 64-bit regardless...
      headerBuff.writeDoubleBE inode.mtime.getTime(), 2
      headerBuff.writeDoubleBE inode.atime.getTime(), 10
      headerDat = headerBuff.toString('binary_string')
      data = headerDat + data
      return data

    LocalStorage.prototype._convertFromBinaryString = (path, data, flags, inode) ->
      headerBuff = new BrowserFS.node.Buffer(data.substr(0, 10), 'binary_string')
      data = data.substr 10
      buffer = new BrowserFS.node.Buffer(data, 'binary_string')
      file = new BrowserFS.File.PreloadFile.LocalStorageFile @, path, flags, inode, buffer
      file._stat.mode = headerBuff.readUInt16BE 0
      file._stat.mtime = new Date(headerBuff.readDoubleBE 2)
      file._stat.atime = new Date(headerBuff.readDoubleBE 10)
      return file

    LocalStorage.prototype._getFileLength = (data) ->
      return if data.length > 10
        # 10 character header for metadata (9 char data + 1 char header)
        BrowserFS.StringUtil.FindUtil('binary_string').byteLength(data.substr(10))
      else 0
  else
    LocalStorage.prototype._convertToBinaryString = (data, inode) ->
      data = data.toString 'binary_string_ie'
      headerBuff = new BrowserFS.node.Buffer 18
      headerBuff.writeUInt16BE inode.mode, 0
      # Well, they're doubles and are going to be 64-bit regardless...
      headerBuff.writeDoubleBE inode.mtime.getTime(), 2
      headerBuff.writeDoubleBE inode.atime.getTime(), 10
      headerDat = headerBuff.toString('binary_string_ie')
      data = headerDat + data
      return data
    LocalStorage.prototype._convertFromBinaryString = (path, data, flags, inode) ->
      headerBuff = new BrowserFS.node.Buffer(data.substr(0, 18), 'binary_string_ie')
      data = data.substr 18
      buffer = new BrowserFS.node.Buffer(data, 'binary_string_ie')
      file = new BrowserFS.File.PreloadFile.LocalStorageFile @, path, flags, inode, buffer
      file._stat.mode = headerBuff.readUInt16BE 0
      file._stat.mtime = new Date(headerBuff.readDoubleBE 2)
      file._stat.atime = new Date(headerBuff.readDoubleBE 10)
      return file
    LocalStorage.prototype._getFileLength = (data) -> return if data.length > 0 then data.length-18 else 0

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
    @_fs._syncSync @_path, @_buffer, @_stat
    return

  # Synchronous close.
  closeSync: ->
    # Maps to sync.
    @syncSync()
