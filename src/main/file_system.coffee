# Class for a filesystem. Provides some default functionality.

# The base FileSystem class. **All** BrowserFS FileSystems should extend this
# class.
#
# Below, we denote each API method as **Core**, **Supplemental**, or
# **Optional**.
#
# ### Core Methods
#
# **Core** API methods *need* to be implemented for basic read/write
# functionality.
#
# Note that read-only FileSystems can choose to not implement core methods
# that mutate files or metadata. The default implementation will pass a
# NOT_SUPPORTED error to the callback.
#
# ### Supplemental Methods
#
# **Supplemental** API methods do not need to be implemented by a filesystem.
# The default implementation implements all of the supplemental API methods in
# terms of the **core** API methods.
#
# Note that a file system may choose to implement supplemental methods for
# efficiency reasons.
#
# ### Optional Methods
#
# **Optional** API methods provide functionality that may not be available in
# all filesystems. For example, all symlink/hardlink-related API methods fall
# under this category.
#
# The default implementation will pass a NOT_SUPPORTED error to the callback.
#
# ### Argument Assumptions
#
# You can assume the following about arguments passed to each API method:
#
# * **Every path is an absolute path.** Meaning, `.`, `..`, and other items
#   are normalized into an absolute form.
# * **All arguments are present.** Any optional arguments at the Node API level
#   have been passed in with their default values.
# * **The callback will reset the stack depth.** When your filesystem calls the
#   callback with the requested information, it will use `setImmediate` to
#   reset the JavaScript stack depth before calling the user-supplied callback.
#
class BrowserFS.FileSystem
  # Constructs the file system. Doesn't do anything particularly special.
  constructor: ->

  # Global information methods

  # **Core**: Returns 'true' if this filesystem is available in the current
  # environment. For example, a `localStorage`-backed filesystem will return
  # 'false' if the browser does not support that API.
  #
  # Defaults to 'false', as the FileSystem base class isn't usable alone.
  # @return [Boolean]
  isAvailable: -> false
  # **Optional**: Passes the following information to the callback:
  #
  # * Total number of bytes available on this file system.
  # * Number of free bytes available on this file system.
  #
  # @todo This info is not available through the Node API. Perhaps we could do a
  #   polyfill of diskspace.js, or add a new Node API function.
  # @param [String] path The path to the location that is being queried. Only
  #   useful for filesystems that support mount points.
  # @param [Function(Number, Number)] cb
  diskSpace: (path, cb) -> cb 0, 0
  # **Core**
  # @return [Boolean] True if this FileSystem is inherently read-only.
  isReadOnly: -> true
  # **Core**
  # @return [Boolean] True if the FileSystem supports the optional
  #   symlink/hardlink-related commands.
  supportsLinks: -> false
  # **Core**
  # @return [Boolean] True if the FileSystem supports the optional
  #   permission-related commands.
  supportsPerms: -> false

  # **CORE API METHODS**

  # File or directory operations

  # **Core**: Asynchronous rename. No arguments other than a possible exception
  # are given to the completion callback.
  # @param [String] oldPath
  # @param [String] newPath
  # @param [Function(BrowserFS.ApiError)] cb
  rename: (oldPath, newPath, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Asynchronous `stat` or `lstat`.
  # @param [String] path
  # @param [Boolean] isLstat True if this is `lstat`, false if this is regular
  #   `stat`.
  # @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] cb
  stat: (path, isLstat, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED

  # File operations

  # **Core**: Asynchronous file open.
  # @see http://www.manpagez.com/man/2/open/
  # @param [String] path
  # @param [BrowserFS.FileMode] flags Handles the complexity of the various file
  #   modes. See its API for more details.
  # @param [Number] mode Mode to use to open the file. Can be ignored if the
  #   filesystem doesn't support permissions.
  # @param [Function(BrowserFS.ApiError, BrowserFS.File)] cb
  open: (path, flags, mode, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Asynchronous `unlink`.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError)] cb
  unlink: (path, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED

  # Directory operations

  # **Core**: Asynchronous `rmdir`.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError)] cb
  rmdir: (path, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Asynchronous `mkdir`.
  # @param [String] path
  # @param [Number?] mode Mode to make the directory using. Can be ignored if
  #   the filesystem doesn't support permissions.
  # @param [Function(BrowserFS.ApiError)] cb
  mkdir: (path, mode, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Asynchronous `readdir`. Reads the contents of a directory.
  #
  # The callback gets two arguments `(err, files)` where `files` is an array of
  # the names of the files in the directory excluding `'.'` and `'..'`.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError, String[])] cb
  readdir: (path, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED

  # **SUPPLEMENTAL INTERFACE METHODS**

  # File or directory operations

  # **Supplemental**: Test whether or not the given path exists by checking with
  # the file system. Then call the callback argument with either true or false.
  # @param [String] path
  # @param [Function(Boolean)] cb
  exists: (path, cb) -> @stat(path, (err) -> if err? then cb(false) else cb(true))
  # **Supplemental**: Asynchronous `realpath`. The callback gets two arguments
  # `(err, resolvedPath)`.
  #
  # Note that the Node API will resolve `path` to an absolute path.
  # @param [String] path
  # @param [Object] cache An object literal of mapped paths that can be used to
  #   force a specific path resolution or avoid additional `fs.stat` calls for
  #   known real paths. If not supplied by the user, it'll be an empty object.
  # @param [Function(BrowserFS.ApiError, String)] cb
  realpath: (path, cache, cb) ->

  # File operations

  # **Supplemental**: Asynchronous `truncate`.
  # @param [String] path
  # @param [Number] len
  # @param [Function(BrowserFS.ApiError)] cb
  truncate: (path, len, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  # **Supplemental**: Asynchronously reads the entire contents of a file.
  # @param [String] filename
  # @param [String] encoding If non-null, the file's contents should be decoded
  #   into a string using that encoding. Otherwise, if encoding is null, fetch
  #   the file's contents as a Buffer.
  # @param [BrowserFS.FileMode] flag
  # @param [Function(BrowserFS.ApiError, String | BrowserFS.node.Buffer)]
  #   cb If no encoding is specified, then the raw buffer is returned.
  readFile: (fname, encoding, flag, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  # **Supplemental**: Asynchronously writes data to a file, replacing the file
  # if it already exists.
  #
  # The encoding option is ignored if data is a buffer.
  # @param [String] filename
  # @param [String | BrowserFS.node.Buffer] data
  # @param [String] encoding
  # @param [BrowserFS.FileMode] flag
  # @param [Number] mode
  # @param [Function(BrowserFS.ApiError)] cb
  writeFile: (fname, data, encoding, flag, mode, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  # **Supplemental**: Asynchronously append data to a file, creating the file if
  # it not yet exists.
  # @param [String] filename
  # @param [String | BrowserFS.node.Buffer] data
  # @param [String] encoding
  # @param [BrowserFS.FileMode] flag
  # @param [Number] mode
  # @param [Function(BrowserFS.ApiError)] cb
  appendFile: (fname, data, encoding, flag, mode, cb) ->
    # TODO: Deal with once I figure out buffers.
    #@openpath, 'a' 0666, (err, fd) ->
    #  fd.write(buffer, offset, length, position, callback)

  # **OPTIONAL INTERFACE METHODS**

  # Property operations
  # This isn't always possible on some filesystem types (e.g. Dropbox).

  # **Optional**: Asynchronous `chmod` or `lchmod`.
  # @param [String] path
  # @param [Boolean] isLchmod `True` if `lchmod`, false if `chmod`.
  # @param [Number] mode
  # @param [Function(BrowserFS.ApiError)] cb
  chmod: (path, isLchmod, mode, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  # **Optional**: Asynchronous `chown` or `lchown`.
  # @param [String] path
  # @param [Boolean] isLchown `True` if `lchown`, false if `chown`.
  # @param [Number] uid
  # @param [Number] gid
  # @param [Function(BrowserFS.ApiError)] cb
  chown: (path, isLchown, uid, gid, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  # **Optional**: Change file timestamps of the file referenced by the supplied path.
  # @param [String] path
  # @param [Date] atime
  # @param [Date] mtime
  # @param [Function(BrowserFS.ApiError)] cb
  utimes: (path, atime, mtime, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED

  # Symlink operations
  # Symlinks aren't always supported.

  # **Optional**: Asynchronous `link`.
  # @param [String] srcpath
  # @param [String] dstpath
  # @param [Function(BrowserFS.ApiError)] cb
  link: (srcpath, dstpath, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  # **Optional**: Asynchronous `symlink`.
  # @param [String] srcpath
  # @param [String] dstpath
  # @param [String] type can be either `'dir'` or `'file'`
  # @param [Function(BrowserFS.ApiError)] cb
  symlink: (srcpath, dstpath, type, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  # **Optional**: Asynchronous readlink.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError, String)] callback
  readlink: (path, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
