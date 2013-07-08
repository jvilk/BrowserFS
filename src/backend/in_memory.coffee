# A simple filesystem that exists only in memory.
#
# Note: This hacks a file_data property into each file inode,
#   which are actually just fs.Stats objects.
class BrowserFS.FileSystem.InMemory extends BrowserFS.IndexedFileSystem
  # Constructs the file system, with no files or directories.
  constructor: -> @empty()

  # Clears all data, resetting to the 'just-initialized' state.
  empty: -> @_index = new BrowserFS.FileIndex

  # Returns the name of the file system.
  # @return [String]
  getName: -> 'In-memory'
  # All browsers support storing data in memory.
  # @return [Boolean]
  @isAvailable: -> true

  # Passes the size and taken space in bytes to the callback.
  #
  # **Note**: We can use all available memory on the system, so we return +Inf.
  # @param [String] path Unused in the implementation.
  # @param [Function(Number, Number)] cb
  diskSpace: (path, cb) ->
    cb Infinity, BrowserFS.util.roughSizeOfObject @_index

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
    inode.mtime = new Date()
    file = inode.file_data
    file._buffer = new BrowserFS.node.Buffer 0
    return file

  _fetch: (path, flags, inode) ->
    file = inode.file_data
    file._mode = flags
    return file

  _create: (path, flags, inode) ->
    file = new BrowserFS.File.NoSyncFile @, path, flags, inode
    inode.file_data = file
    @_index.addPath path, inode
    return file

  # Directory operations
  _rmdirSync: (path, inode) -> return
