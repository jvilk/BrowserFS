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
# The code for some supplemental methods was adapted directly from NodeJS's
# fs.js source code.
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
#   are resolved into an absolute form.
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
  # **Core**: Is this filesystem read-only?
  # @return [Boolean] True if this FileSystem is inherently read-only.
  isReadOnly: -> true
  # **Core**: Does the filesystem support optional symlink/hardlink-related
  #   commands?
  # @return [Boolean] True if the FileSystem supports the optional
  #   symlink/hardlink-related commands.
  supportsLinks: -> false
  # **Core**: Does the filesystem support optional property-related commands?
  # @return [Boolean] True if the FileSystem supports the optional
  #   property-related commands (permissions, utimes, etc).
  supportsProps: -> false
  # **Core**: Does the filesystem support the optional synchronous interface?
  # @return [Boolean] True if the FileSystem supports synchronous operations.
  supportsSynch: -> false

  # **CORE API METHODS**

  # File or directory operations

  # **Core**: Asynchronous rename. No arguments other than a possible exception
  # are given to the completion callback.
  # @param [String] oldPath
  # @param [String] newPath
  # @param [Function(BrowserFS.ApiError)] cb
  rename: (oldPath, newPath, cb) -> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Asynchronous `stat` or `lstat`.
  # @param [String] path
  # @param [Boolean] isLstat True if this is `lstat`, false if this is regular
  #   `stat`.
  # @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] cb
  stat: (path, isLstat, cb) -> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED

  # File operations

  # **Core**: Asynchronous file open.
  # @see http://www.manpagez.com/man/2/open/
  # @param [String] path
  # @param [BrowserFS.FileMode] flags Handles the complexity of the various file
  #   modes. See its API for more details.
  # @param [Number] mode Mode to use to open the file. Can be ignored if the
  #   filesystem doesn't support permissions.
  # @param [Function(BrowserFS.ApiError, BrowserFS.File)] cb
  open: (path, flags, mode, cb) -> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Asynchronous `unlink`.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError)] cb
  unlink: (path, cb) -> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED

  # Directory operations

  # **Core**: Asynchronous `rmdir`.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError)] cb
  rmdir: (path, cb) -> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Asynchronous `mkdir`.
  # @param [String] path
  # @param [Number?] mode Mode to make the directory using. Can be ignored if
  #   the filesystem doesn't support permissions.
  # @param [Function(BrowserFS.ApiError)] cb
  mkdir: (path, mode, cb) -> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Asynchronous `readdir`. Reads the contents of a directory.
  #
  # The callback gets two arguments `(err, files)` where `files` is an array of
  # the names of the files in the directory excluding `'.'` and `'..'`.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError, String[])] cb
  readdir: (path, cb) -> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED

  # **SUPPLEMENTAL INTERFACE METHODS**

  # File or directory operations

  # **Supplemental**: Test whether or not the given path exists by checking with
  # the file system. Then call the callback argument with either true or false.
  # @param [String] path
  # @param [Function(Boolean)] cb
  exists: (path, cb) ->
    @stat(path, null, (err) -> cb(not err?))
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
    if @supportsLinks()
      # The path could contain symlinks. Split up the path,
      # resolve any symlinks, return the resolved string.
      splitPath = path.split BrowserFS.node.path.sep
      # TODO: Simpler to just pass through file, find sep and such.
      for i in [0...splitPath.length]
        addPaths = splitPath.slice 0, i+1
        splitPath[i] = BrowserFS.node.path.join.apply null, addPaths
    else
      # No symlinks. We just need to verify that it exists.
      @exists path, (doesExist) ->
        if doesExist
          cb null, path
        else
          cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "File #{path} not found."

  # File operations

  # **Supplemental**: Asynchronous `truncate`.
  # @param [String] path
  # @param [Number] len
  # @param [Function(BrowserFS.ApiError)] cb
  truncate: (path, len, cb) ->
    BrowserFS.node.fs.open path, 'w', ((er, fd) ->
      if er then return cb er
      BrowserFS.node.fs.ftruncate fd, len, ((er) ->
        BrowserFS.node.fs.close fd, ((er2) ->
          cb(er || er2)
        )
      )
    )
  # **Supplemental**: Asynchronously reads the entire contents of a file.
  # @param [String] filename
  # @param [String] encoding If non-null, the file's contents should be decoded
  #   into a string using that encoding. Otherwise, if encoding is null, fetch
  #   the file's contents as a Buffer.
  # @param [BrowserFS.FileMode] flag
  # @param [Function(BrowserFS.ApiError, String | BrowserFS.node.Buffer)]
  #   cb If no encoding is specified, then the raw buffer is returned.
  readFile: (fname, encoding, flag, cb) ->
    # Wrap cb in file closing code.
    oldCb = cb
    # Get file.
    @open fname, flag, 0o666, (err, fd) ->
      if err? then return cb err
      cb = (err, arg) -> fd.close (err2) ->
        err ?= err2
        oldCb err, arg
      BrowserFS.node.fs.fstat fd, (err, stat) ->
        if err? then return cb err
        # Allocate buffer.
        buf = new BrowserFS.node.Buffer stat.size
        BrowserFS.node.fs.read fd, buf, 0, stat.size, 0, (err) ->
          if err? then return cb err
          if encoding is null then return cb err, buf
          try
            cb null, buf.toString encoding
          catch e
            cb e
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
  writeFile: (fname, data, encoding, flag, mode, cb) ->
    # Wrap cb in file closing code.
    oldCb = cb
    # Get file.
    @open fname, flag, 0o666, (err, fd) ->
      if err? then return cb err
      cb = (err) -> fd.close (err2) -> oldCb(if err? then err else err2)
      if typeof data is 'string'
        data = new BrowserFS.node.Buffer data, encoding
      # Write into file.
      fd.write data, 0, data.length, 0, (err) ->
        cb err
  # **Supplemental**: Asynchronously append data to a file, creating the file if
  # it not yet exists.
  # @param [String] filename
  # @param [String | BrowserFS.node.Buffer] data
  # @param [String] encoding
  # @param [BrowserFS.FileMode] flag
  # @param [Number] mode
  # @param [Function(BrowserFS.ApiError)] cb
  appendFile: (fname, data, encoding, flag, mode, cb) ->
    # Wrap cb in file closing code.
    oldCb = cb
    @open fname, flag, mode, (err, fd) ->
      if err? then cb err
      cb = (err) -> fd.close (err2) -> oldCb(if err? then err else err2)
      if typeof data is 'string'
        data = new BrowserFS.node.Buffer data, encoding
      fd.write data, 0, data.length, null, (err) -> cb err

  # **OPTIONAL INTERFACE METHODS**

  # Property operations
  # This isn't always possible on some filesystem types (e.g. Dropbox).

  # **Optional**: Asynchronous `chmod` or `lchmod`.
  # @param [String] path
  # @param [Boolean] isLchmod `True` if `lchmod`, false if `chmod`. Has no
  #   bearing on result if links aren't supported.
  # @param [Number] mode
  # @param [Function(BrowserFS.ApiError)] cb
  chmod: (path, isLchmod, mode, cb) -> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Optional**: Asynchronous `chown` or `lchown`.
  # @param [String] path
  # @param [Boolean] isLchown `True` if `lchown`, false if `chown`. Has no
  #   bearing on result if links aren't supported.
  # @param [Number] uid
  # @param [Number] gid
  # @param [Function(BrowserFS.ApiError)] cb
  chown: (path, isLchown, uid, gid, cb) -> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Optional**: Change file timestamps of the file referenced by the supplied
  # path.
  # @param [String] path
  # @param [Date] atime
  # @param [Date] mtime
  # @param [Function(BrowserFS.ApiError)] cb
  utimes: (path, atime, mtime, cb) -> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED

  # Symlink operations
  # Symlinks aren't always supported.

  # **Optional**: Asynchronous `link`.
  # @param [String] srcpath
  # @param [String] dstpath
  # @param [Function(BrowserFS.ApiError)] cb
  link: (srcpath, dstpath, cb) -> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Optional**: Asynchronous `symlink`.
  # @param [String] srcpath
  # @param [String] dstpath
  # @param [String] type can be either `'dir'` or `'file'`
  # @param [Function(BrowserFS.ApiError)] cb
  symlink: (srcpath, dstpath, type, cb) -> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Optional**: Asynchronous readlink.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError, String)] callback
  readlink: (path, cb) -> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
