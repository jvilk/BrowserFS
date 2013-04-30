# The node frontend to all filesystems.
# We handle:
#
# * Sanity checking inputs.
# * Resetting stack depth for asynchronous operations which may not go through
#   the browser (wrap cbs properly)
# * Handles translating file movement across filesystems
#   (e.g. rename path1, path2 -> readFile path1, writeFile path2, rm path1)
# @see http://nodejs.org/api/fs.html
class BrowserFS.node.fs
  # FILE OR DIRECTORY METHODS

  # Asynchronous rename. No arguments other than a possible exception are given
  # to the completion callback.
  # @param [String] oldPath
  # @param [String] newPath
  # @param [Function(BrowserFS.ApiError?)] callback
  @rename: (oldPath, newPath, callback) ->
  # Test whether or not the given path exists by checking with the file system.
  # Then call the callback argument with either true or false.
  # @example Sample invocation
  #   fs.exists('/etc/passwd', function (exists) {
  #     util.debug(exists ? "it's there" : "no passwd!");
  #   });
  # @param [String] path
  # @param [Function(Boolean)] callback
  @exists: (path, callback) ->
  # Asynchronous `stat`.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] callback
  @stat: (path, callback) ->
  # Asynchronous `lstat`.
  # `lstat()` is identical to `stat()`, except that if path is a symbolic link,
  # then the link itself is stat-ed, not the file that it refers to.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] callback
  @lstat: (path, callback) ->

  # FILE-ONLY METHODS

  # Asynchronous `truncate`.
  # @param [String] path
  # @param [Number] len
  # @param [Function(BrowserFS.ApiError)] callback
  @truncate: (path, len, callback) ->
  # Asynchronous `unlink`.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError)] callback
  @unlink: (path, callback) ->
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
    # Mode is optional.

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
    # Options is optional.

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
    # Options is optional.

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
    # Options is optional.

  # FILE DESCRIPTOR METHODS

  # Asynchronous `fstat`.
  # `fstat()` is identical to `stat()`, except that the file to be stat-ed is
  # specified by the file descriptor `fd`.
  # @param [BrowserFS.File] fd
  # @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] callback
  @fstat: (fd, callback) ->
  # Asynchronous close.
  # @param [BrowserFS.File] fd
  # @param [Function(BrowserFS.ApiError)] callback
  @close: (fd, callback) ->
  # Asynchronous ftruncate.
  # @param [BrowserFS.File] fd
  # @param [Number] len
  # @param [Function(BrowserFS.ApiError)] callback
  @ftruncate: (fd, len, callback) ->
  # Asynchronous fsync.
  # @param [BrowserFS.File] fd
  # @param [Function(BrowserFS.ApiError)] callback
  @fsync: (fd, callback) ->
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
  # Asynchronous `fchown`.
  # @param [BrowserFS.File] fd
  # @param [Number] uid
  # @param [Number] gid
  # @param [Function(BrowserFS.ApiError)] callback
  @fchown: (fd, uid, gid, callback) ->
  # Asynchronous `fchmod`.
  # @param [BrowserFS.File] fd
  # @param [Number] mode
  # @param [Function(BrowserFS.ApiError)] callback
  @fchmod: (fd, mode, callback) ->
  # Change the file timestamps of a file referenced by the supplied file
  # descriptor.
  # @param [BrowserFS.File] fd
  # @param [Date] atime
  # @param [Date] mtime
  # @param [Function(BrowserFS.ApiError)] callback
  @futimes: (fd, atime, mtime, callback) ->

  # DIRECTORY-ONLY METHODS

  # Asynchronous `rmdir`.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError)] callback
  @rmdir: (path, callback) ->
  # Asynchronous `mkdir`.
  # @param [String] path
  # @param [Number?] mode defaults to `0777`
  # @param [Function(BrowserFS.ApiError)] callback
  @mkdir: (path, mode, callback) ->
    # Mode is optional.

  # Asynchronous `readdir`. Reads the contents of a directory.
  # The callback gets two arguments `(err, files)` where `files` is an array of
  # the names of the files in the directory excluding `'.'` and `'..'`.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError, String[])] callback
  @readdir: (path, callback) ->

  # SYMLINK METHODS

  # Asynchronous `link`.
  # @param [String] srcpath
  # @param [String] dstpath
  # @param [Function(BrowserFS.ApiError?)] callback
  @link: (srcpath, dstpath, callback) ->
  # Asynchronous `symlink`.
  # @param [String] srcpath
  # @param [String] dstpath
  # @param [String?] type can be either `'dir'` or `'file'` (default is `'file'`)
  # @param [Function(BrowserFS.ApiError?)] callback
  @symlink: (srcpath, dstpath, type, callback) ->
    # Type is optional.

  # Asynchronous readlink.
  # @param [String] path
  # @param [Function(BrowserFS.ApiError, String)] callback
  @readlink: (path, callback) ->

  # PROPERTY OPERATIONS

  # Asynchronous `chown`.
  # @param [String] path
  # @param [Number] uid
  # @param [Number] gid
  # @param [Function(BrowserFS.ApiError)] callback
  @chown: (path, uid, gid, callback) ->
  # Asynchronous `lchown`.
  # @param [String] path
  # @param [Number] uid
  # @param [Number] gid
  # @param [Function(BrowserFS.ApiError)] callback
  @lchown: (path, uid, gid, callback) ->
  # Asynchronous `chmod`.
  # @param [String] path
  # @param [Number] mode
  # @param [Function(BrowserFS.ApiError)] callback
  @chmod: (path, mode, callback) ->
  # Asynchronous `lchmod`.
  # @param [String] path
  # @param [Number] mode
  # @param [Function(BrowserFS.ApiError)] callback
  @lchmod: (path, mode, callback) ->
  @utimes: (path, atime, mtime, callback) ->

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
    # Cache is optional.
