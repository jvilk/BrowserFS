# Wraps a callback with a setImmediate call.
# @param [Function] cb The callback to wrap.
# @param [Number] numArgs The number of arguments that the callback takes.
# @return [Function] The wrapped callback.
wrapCb = (cb, numArgs) ->
  # We could use `arguments`, but Function.call/apply is expensive. And we only
  # need to handle 1-3 arguments
  if numArgs is 1
    return cb (arg1) -> setImmediate -> cb arg1
  else if numArgs is 2
    return cb (arg1, arg2) -> setImmediate -> cb arg1, arg2
  else if numArgs is 3
    return cb (arg1, arg2, arg3) -> setImmediate -> cb arg1, arg2, arg3
  else
    throw new Error 'Invalid invocation of wrapCb.'

# Checks if the fd is valid.
# @param [BrowserFS.File] fd A file descriptor (in BrowserFS, it's a File object)
# @return [Boolean, BrowserFS.ApiError] Returns `true` if the FD is OK,
#   otherwise returns an ApiError.
checkFd = (fd) ->
  if fd instanceof BrowserFS.File
    return new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, 'Invalid file descriptor.'
  return true

# The node frontend to all filesystems.
# This layer handles:
#
# * Sanity checking inputs.
# * Normalizing paths.
# * Resetting stack depth for asynchronous operations which may not go through
#   the browser by wrapping all input callbacks using `setImmediate`.
# * Performing the requested operation through the filesystem or the file
#   descriptor, as appropriate.
# * Handling optional arguments and setting default arguments.
# @see http://nodejs.org/api/fs.html
class BrowserFS.node.fs
  # **NONSTANDARD**: You must call this function with a properly-instantiated
  # root filesystem before using any other API method.
  # @param [BrowserFS.FileSystem] rootFS The root filesystem to use for the
  #   entire BrowserFS file system.
  @initiate: (rootFS) -> BrowserFS.node.fs.root = rootFS

  # FILE OR DIRECTORY METHODS

  # Asynchronous rename. No arguments other than a possible exception are given
  # to the completion callback.
  # @param [String] oldPath
  # @param [String] newPath
  # @param [Function(BrowserFS.ApiError?)] callback
  @rename: (oldPath, newPath, callback) ->
    oldPath = BrowserFS.node.path.normalize oldPath
    newPath = BrowserFS.node.path.normalize newPath
    newCb = wrapCb callback, 1
    BrowserFS.node.fs.root.rename oldPath, newPath, newCb
  # Test whether or not the given path exists by checking with the file system.
  # Then call the callback argument with either true or false.
  # @example Sample invocation
  #   fs.exists('/etc/passwd', function (exists) {
  #     util.debug(exists ? "it's there" : "no passwd!");
  #   });
  # @param [String] path
  # @param [Function(Boolean)] callback
  @exists: (path, callback) ->
    path = BrowserFS.node.path.normalize path
    newCb = wrapCb callback, 1
    BrowserFS.node.fs.root.exists path, newCb
  # Asynchronous `stat`.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] callback
  @stat: (path, callback) ->
    path = BrowserFS.node.path.normalize path
    newCb = wrapCb callback, 2
    BrowserFS.node.fs.root.stat path, false, newCb
  # Asynchronous `lstat`.
  # `lstat()` is identical to `stat()`, except that if path is a symbolic link,
  # then the link itself is stat-ed, not the file that it refers to.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] callback
  @lstat: (path, callback) ->
    path = BrowserFS.node.path.normalize path
    newCb = wrapCb callback, 2
    BrowserFS.node.fs.root.stat path, true, newCb

  # FILE-ONLY METHODS

  # Asynchronous `truncate`.
  # @param [String] path
  # @param [Number] len
  # @param [Function(BrowserFS.ApiError)] callback
  @truncate: (path, len, callback) ->
    path = BrowserFS.node.path.normalize path
    newCb = wrapCb callback, 1
    BrowserFS.node.fs.root.truncate path, len, newCb
  # Asynchronous `unlink`.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError)] callback
  @unlink: (path, callback) ->
    path = BrowserFS.node.path.normalize path
    newCb = wrapCb callback, 1
    BrowserFS.node.fs.root.unlink path, len, newCb
  # Asynchronous file open.
  # Exclusive mode (O_EXCL) ensures that path is newly created.
  # `fs.open()` fails if a file by that name already exists.
  # `flags` can be:
  #
  # * `'r'` - Open file for reading. An exception occurs if the file does not exist.
  # * `'r+'` - Open file for reading and writing. An exception occurs if the file does not exist.
  # * `'rs'` - Open file for reading in synchronous mode. Instructs the filesystem to not cache writes.
  # * `'rs+'` - Open file for reading and writing, and opens the file in synchronous mode.
  # * `'w'` - Open file for writing. The file is created (if it does not exist) or truncated (if it exists).
  # * `'wx'` - Like 'w' but opens the file in exclusive mode.
  # * `'w+'` - Open file for reading and writing. The file is created (if it does not exist) or truncated (if it exists).
  # * `'wx+'` - Like 'w+' but opens the file in exclusive mode.
  # * `'a'` - Open file for appending. The file is created if it does not exist.
  # * `'ax'` - Like 'a' but opens the file in exclusive mode.
  # * `'a+'` - Open file for reading and appending. The file is created if it does not exist.
  # * `'ax+'` - Like 'a+' but opens the file in exclusive mode.
  #
  # @see http://www.manpagez.com/man/2/open/
  # @param [String] path
  # @param [String] flags
  # @param [Number?] mode defaults to `0666`
  # @param [Function(BrowserFS.ApiError, BrowserFS.File)] callback
  @open: (path, flags, mode, callback) ->
    path = BrowserFS.node.path.normalize path
    newCb = wrapCb callback, 2
    if typeof mode is 'function'
      callback = mode
      mode = 0o666
    # Try/catch is for FileMode failure.
    try
      flags = BrowserFS.FileMode.getFileMode flags
      BrowserFS.node.fs.root.open path, flags, mode, newCb
    catch e
      newCb e

  # Asynchronously reads the entire contents of a file.
  # @example Usage example
  #   fs.readFile('/etc/passwd', function (err, data) {
  #     if (err) throw err;
  #     console.log(data);
  #   });
  # @param [String] filename
  # @param [Object?] options
  # @option options [String] encoding The string encoding for the file contents. Defaults to `null`.
  # @option options [String] flag Defaults to `'r'`.
  # @param [Function(BrowserFS.ApiError, String or BrowserFS.node.Buffer)] callback If no encoding is specified, then the raw buffer is returned.
  @readFile: (filename, options, callback) ->
    filename = BrowserFS.node.path.normalize filename
    if typeof options is 'function'
      callback = options
      options = {}
    unless options.encoding? then options.encoding = 'utf8'
    unless options.flag? then options.flag = 'r'
    newCb = wrapCb callback, 2
    # Try/catch is for FileMode failure.
    try
      flags = BrowserFS.FileMode.getFileMode options.flag
      unless flags.isReadable()
        return newCb new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, 'Flag passed to readFile must allow for reading.'
      BrowserFS.node.fs.root.readFile filename, options.encoding, flags, newCb
    catch e
      newCb e

  # Asynchronously writes data to a file, replacing the file if it already
  # exists.
  #
  # The encoding option is ignored if data is a buffer.
  #
  # @example Usage example
  #   fs.writeFile('message.txt', 'Hello Node', function (err) {
  #     if (err) throw err;
  #     console.log('It\'s saved!');
  #   });
  # @param [String] filename
  # @param [String | BrowserFS.node.Buffer] data
  # @param [Object?] options
  # @option options [String] encoding Defaults to `'utf8'`.
  # @option options [Number] mode Defaults to `0666`.
  # @option options [String] flag Defaults to `'w'`.
  # @param [Function(BrowserFS.ApiError)] callback
  @writeFile: (filename, data, options, callback) ->
    filename = BrowserFS.node.path.normalize filename
    if typeof options is 'function'
      callback = options
      options = {}
    unless options.encoding? then options.encoding = 'utf8'
    unless options.flag? then options.flag = 'w'
    unless options.mode? then options.mode = 0o666
    newCb = wrapCb callback, 1
    # Try/catch is for FileMode failure.
    try
      flags = BrowserFS.FileMode.getFileMode options.flag
      unless flags.isWriteable()
        return newCb new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, 'Flag passed to writeFile must allow for writing.'
      BrowserFS.node.fs.root.writeFile filename, options.encoding, flags, options.mode, newCb
    catch e
      newCb e

  # Asynchronously append data to a file, creating the file if it not yet
  # exists.
  #
  # @example Usage example
  #   fs.appendFile('message.txt', 'data to append', function (err) {
  #     if (err) throw err;
  #     console.log('The "data to append" was appended to file!');
  #   });
  # @param [String] filename
  # @param [String | BrowserFS.node.Buffer] data
  # @param [Object?] options
  # @option options [String] encoding Defaults to `'utf8'`.
  # @option options [Number] mode Defaults to `0666`.
  # @option options [String] flag Defaults to `'a'`.
  # @param [Function(BrowserFS.ApiError)] callback
  @appendFile: (filename, data, options, callback) ->
    filename = BrowserFS.node.path.normalize filename
    if typeof options is 'function'
      callback = options
      options = {}
    unless options.encoding? then options.encoding = 'utf8'
    unless options.flag? then options.flag = 'a'
    unless options.mode? then options.mode = 0o666
    newCb = wrapCb callback, 1
    # Try/catch is for FileMode failure.
    try
      flags = BrowserFS.FileMode.getFileMode options.flag
      unless flags.isAppendable()
        return newCb new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, 'Flag passed to appendFile must allow for appending.'
      BrowserFS.node.fs.root.appendFile filename, options.encoding, flags, options.mode, newCb
    catch e
      newCb e

  # FILE DESCRIPTOR METHODS

  # Asynchronous `fstat`.
  # `fstat()` is identical to `stat()`, except that the file to be stat-ed is
  # specified by the file descriptor `fd`.
  # @param [BrowserFS.File] fd
  # @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] callback
  @fstat: (fd, callback) ->
    newCb = wrapCb callback, 2
    fdChk = checkFd fd
    unless fdChk then return newCb fdChk
    fd.stat newCb
  # Asynchronous close.
  # @param [BrowserFS.File] fd
  # @param [Function(BrowserFS.ApiError)] callback
  @close: (fd, callback) ->
    newCb = wrapCb callback, 1
    fdChk = checkFd fd
    unless fdChk then return newCb fdChk
    fd.close newCb
  # Asynchronous ftruncate.
  # @param [BrowserFS.File] fd
  # @param [Number] len
  # @param [Function(BrowserFS.ApiError)] callback
  @ftruncate: (fd, len, callback) ->
    newCb = wrapCb callback, 1
    fdChk = checkFd fd
    unless fdChk then return newCb fdChk
    fd.truncate len, newCb
  # Asynchronous fsync.
  # @param [BrowserFS.File] fd
  # @param [Function(BrowserFS.ApiError)] callback
  @fsync: (fd, callback) ->
    newCb = wrapCb callback, 1
    fdChk = checkFd fd
    unless fdChk then return newCb fdChk
    fd.sync newCb
  # Write buffer to the file specified by `fd`.
  # Note that it is unsafe to use fs.write multiple times on the same file
  # without waiting for the callback. For this scenario,
  # BrowserFS.node.fs.createWriteStream is strongly recommended.
  # @param [BrowserFS.File] fd
  # @param [BrowserFS.node.Buffer] buffer Buffer containing the data to write to
  #  the file.
  # @param [Number] offset Offset in the buffer to start reading data from.
  # @param [Number] length The amount of bytes to write to the file.
  # @param [Number] position Offset from the beginning of the file where this
  #   data should be written. If position is null, the data will be written at the current position.
  # @param [Function(BrowserFS.ApiError, Number, BrowserFS.node.Buffer)]
  #   callback The number specifies the number of bytes written into the file.
  @write: (fd, buffer, offset, length, position, callback) ->
    newCb = wrapCb callback, 3
    fdChk = checkFd fd
    unless fdChk then return newCb fdChk
    fd.write buffer, offset, length, position, newCb
  # Read data from the file specified by `fd`.
  # @param [BrowserFS.File] fd
  # @param [BrowserFS.node.Buffer] buffer The buffer that the data will be
  #   written to.
  # @param [Number] offset The offset within the buffer where reading will
  #   start.
  # @param [Number] length An integer specifying the number of bytes to read.
  # @param [Number] position An integer specifying where to begin reading from
  #   in the file. If position is null, data will be read from the current file
  #   position.
  # @param [Function(BrowserFS.ApiError, Number, BrowserFS.node.Buffer)] The
  #   number is the number of bytes read
  @read: (fd, buffer, offset, length, position, callback) ->
    newCb = wrapCb callback, 3
    fdChk = checkFd fd
    unless fdChk then return newCb fdChk
    fd.read buffer, offset, length, position, newCb
  # Asynchronous `fchown`.
  # @param [BrowserFS.File] fd
  # @param [Number] uid
  # @param [Number] gid
  # @param [Function(BrowserFS.ApiError)] callback
  @fchown: (fd, uid, gid, callback) ->
    newCb = wrapCb callback, 1
    fdChk = checkFd fd
    unless fdChk then return newCb fdChk
    fd.chown uid, gid, newCb
  # Asynchronous `fchmod`.
  # @param [BrowserFS.File] fd
  # @param [Number] mode
  # @param [Function(BrowserFS.ApiError)] callback
  @fchmod: (fd, mode, callback) ->
    newCb = wrapCb callback, 1
    fdChk = checkFd fd
    unless fdChk then return newCb fdChk
    fd.chmod mode, newCb
  # Change the file timestamps of a file referenced by the supplied file
  # descriptor.
  # @param [BrowserFS.File] fd
  # @param [Date] atime
  # @param [Date] mtime
  # @param [Function(BrowserFS.ApiError)] callback
  @futimes: (fd, atime, mtime, callback) ->
    newCb = wrapCb callback, 1
    fdChk = checkFd fd
    unless fdChk then return newCb fdChk
    fd.utimes atime, mtime, newCb

  # DIRECTORY-ONLY METHODS

  # Asynchronous `rmdir`.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError)] callback
  @rmdir: (path, callback) ->
    path = BrowserFS.node.path.normalize path
    newCb = wrapCb callback, 1
    BrowserFS.node.fs.root.rmdir path, newCb
  # Asynchronous `mkdir`.
  # @param [String] path
  # @param [Number?] mode defaults to `0777`
  # @param [Function(BrowserFS.ApiError)] callback
  @mkdir: (path, mode, callback) ->
    path = BrowserFS.node.path.normalize path
    if typeof mode is 'function'
      callback = mode
      mode = 0o777
    newCb = wrapCb callback, 1
    BrowserFS.node.fs.root.mkdir path, mode, newCb

  # Asynchronous `readdir`. Reads the contents of a directory.
  # The callback gets two arguments `(err, files)` where `files` is an array of
  # the names of the files in the directory excluding `'.'` and `'..'`.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError, String[])] callback
  @readdir: (path, callback) ->
    path = BrowserFS.node.path.normalize path
    newCb = wrapCb callback, 2
    BrowserFS.node.fs.root.readdir path, newCb

  # SYMLINK METHODS

  # Asynchronous `link`.
  # @param [String] srcpath
  # @param [String] dstpath
  # @param [Function(BrowserFS.ApiError?)] callback
  @link: (srcpath, dstpath, callback) ->
    srcpath = BrowserFS.node.path.normalize srcpath
    dstpath = BrowserFS.node.path.normalize dstpath
    newCb = wrapCb callback, 1
    BrowserFS.node.fs.root.link srcpath, dstpath, newCb
  # Asynchronous `symlink`.
  # @param [String] srcpath
  # @param [String] dstpath
  # @param [String?] type can be either `'dir'` or `'file'` (default is `'file'`)
  # @param [Function(BrowserFS.ApiError?)] callback
  @symlink: (srcpath, dstpath, type, callback) ->
    newCb = wrapCb callback, 1
    if typeof type is 'function'
      callback = type
      type = 'file'
    if type isnt 'file' and type isnt 'dir'
      return newCb new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, "Invalid type: #{type}"
    srcpath = BrowserFS.node.path.normalize srcpath
    dstpath = BrowserFS.node.path.normalize dstpath
    BrowserFS.node.fs.root.symlink srcpath, dstpath, type, newCb

  # Asynchronous readlink.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError, String)] callback
  @readlink: (path, callback) ->
    path = BrowserFS.node.path.normalize path
    newCb = wrapCb callback, 2
    BrowserFS.node.fs.root.readlink path, newCb

  # PROPERTY OPERATIONS

  # Asynchronous `chown`.
  # @param [String] path
  # @param [Number] uid
  # @param [Number] gid
  # @param [Function(BrowserFS.ApiError)] callback
  @chown: (path, uid, gid, callback) ->
    path = BrowserFS.node.path.normalize path
    newCb = wrapCb callback, 1
    BrowserFS.node.fs.root.chown path, false, uid, gid, newCb
  # Asynchronous `lchown`.
  # @param [String] path
  # @param [Number] uid
  # @param [Number] gid
  # @param [Function(BrowserFS.ApiError)] callback
  @lchown: (path, uid, gid, callback) ->
    path = BrowserFS.node.path.normalize path
    newCb = wrapCb callback, 1
    BrowserFS.node.fs.root.chown path, true, uid, gid, newCb
  # Asynchronous `chmod`.
  # @param [String] path
  # @param [Number] mode
  # @param [Function(BrowserFS.ApiError)] callback
  @chmod: (path, mode, callback) ->
    path = BrowserFS.node.path.normalize path
    newCb = wrapCb callback, 1
    BrowserFS.node.fs.root.chmod path, false, mode, newCb
  # Asynchronous `lchmod`.
  # @param [String] path
  # @param [Number] mode
  # @param [Function(BrowserFS.ApiError)] callback
  @lchmod: (path, mode, callback) ->
    path = BrowserFS.node.path.normalize path
    newCb = wrapCb callback, 1
    BrowserFS.node.fs.root.chmod path, true, mode, newCb
  # Change file timestamps of the file referenced by the supplied path.
  # @param [String] path
  # @param [Date] atime
  # @param [Date] mtime
  # @param [Function(BrowserFS.ApiError)] callback
  @utimes: (path, atime, mtime, callback) ->
    path = BrowserFS.node.path.normalize path
    newCb = wrapCb callback, 1
    BrowserFS.node.fs.root.utimes path, atime, mtime, newCb

  # Asynchronous `realpath`. The callback gets two arguments
  # `(err, resolvedPath)`. May use `process.cwd` to resolve relative paths.
  #
  # @example Usage example
  #   var cache = {'/etc':'/private/etc'};
  #   fs.realpath('/etc/passwd', cache, function (err, resolvedPath) {
  #     if (err) throw err;
  #     console.log(resolvedPath);
  #   });
  #
  # @param [String] path
  # @param [Object?] cache An object literal of mapped paths that can be used to
  #   force a specific path resolution or avoid additional `fs.stat` calls for
  #   known real paths.
  # @param [Function(BrowserFS.ApiError, String)] callback
  @realpath: (path, cache, callback) ->
    if typeof cache is 'function'
      callback = cache
      cache = {}
    path = BrowserFS.node.path.normalize path
    newCb = wrapCb callback, 2
    BrowserFS.node.fs.root.realpath path, cache, newCb

# Represents one of the following file modes. A convenience object.
#
# * `'r'` - Open file for reading. An exception occurs if the file does not exist.
# * `'r+'` - Open file for reading and writing. An exception occurs if the file does not exist.
# * `'rs'` - Open file for reading in synchronous mode. Instructs the filesystem to not cache writes.
# * `'rs+'` - Open file for reading and writing, and opens the file in synchronous mode.
# * `'w'` - Open file for writing. The file is created (if it does not exist) or truncated (if it exists).
# * `'wx'` - Like 'w' but opens the file in exclusive mode.
# * `'w+'` - Open file for reading and writing. The file is created (if it does not exist) or truncated (if it exists).
# * `'wx+'` - Like 'w+' but opens the file in exclusive mode.
# * `'a'` - Open file for appending. The file is created if it does not exist.
# * `'ax'` - Like 'a' but opens the file in exclusive mode.
# * `'a+'` - Open file for reading and appending. The file is created if it does not exist.
# * `'ax+'` - Like 'a+' but opens the file in exclusive mode.
#
# Exclusive mode ensures that the file path is newly created.
class BrowserFS.FileMode
  @modeCache = {}
  @validModeStrs = ['r','r+','rs','rs+','w','wx','w+','wx+','a','ax','a+','ax+']

  # Get an object representing the given file mode.
  # @param [String] modeStr The string representing the mode
  # @return [BrowserFS.FileMode] The FileMode object representing the mode
  # @throw [BrowserFS.ApiError] when the mode string is invalid
  @getFileMode: (modeStr) ->
    # Check cache first.
    if modeStr in modeCache
      return modeCache[modeStr]
    fm = new BrowserFS.FileMode modeStr
    modeCache[modeStr] = fm
    return fm

  # Indicates that the code should not do anything.
  @NOP
  # Indicates that the code should throw an exception.
  @THROW_EXCEPTION: 1
  # Indicates that the code should truncate the file, but only if it is a file.
  @TRUNCATE_FILE: 2
  # Indicates that the code should create the file.
  @CREATE_FILE: 3

  # This should never be called directly.
  # @param [String] modeStr The string representing the mode
  # @throw [BrowserFS.ApiError] when the mode string is invalid
  constructor: (@modeStr) ->
    unless modeStr in @validModeStrs
      throw new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, "Invalid mode string: #{modeStr}"

  # @return [Boolean] Returns true if the file is readable.
  isReadable: -> return @modeStr.indexOf 'r' != -1 or @modeStr.indexOf '+' != -1
  # @return [Boolean] Returns true if the file is writeable.
  isWriteable: -> return @modeStr.indexOf 'w' != -1 or (@modeStr.indexOf 'a' == -1 and @modeStr.indexOf '+' != -1)
  # @return [Boolean] Returns true if the file is appendable.
  isAppendable: -> return @modeStr.indexOf 'a' != -1
  # @return [Boolean] Returns true if the file is open in synchronous mode.
  isSynchronous: -> return @modeStr.indexOf 's' != -1
  # @return [Boolean] Returns true if the file is open in exclusive mode.
  isExclusive: -> return @modeStr.indexOf 'x' != -1
  # @return [Number] Returns one of the static fields on this object that
  #   indicates the appropriate response to the path existing.
  pathExistsAction: ->
    if @isExclusive() then return @THROW_EXCEPTION
    else if @isWriteable() then return @TRUNCATE_FILE
    else return @NOP
  # @return [Number] Returns one of the static fields on this object that
  #   indicates the appropriate response to the path not existing.
  pathNotExistsAction: ->
    if (@isWriteable() or @isAppendable()) and modeStr isnt 'r+' then return @CREATE_FILE
    else return @THROW_EXCEPTION
