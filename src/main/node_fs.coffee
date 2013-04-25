# The node frontend to all filesystems.
# We handle:
# * Sanity checking inputs.
# * Resetting stack depth for asynchronous operations which may not go through
#   the browser (wrap cbs properly)
# * Handles translating file movement across filesystems
#   (e.g. rename path1, path2 -> readFile path1, writeFile path2, rm path1)
BrowserFS.node.fs =
  # File or directory methods.
  rename: (oldPath, newPath, callback) ->
  exists: (path, callback) ->
  stat: (path, callback) ->
  lstat: (path, callback) ->
  fstat: (fd, callback) ->

  # File methods.
  truncate: (path, len, callback) ->
  unlink: (path, callback) ->
  open: (path, flags, mode, callback) ->
    # Mode is optional.
  readFile: (filename, options, callback) ->
    # Options is optional.
  writeFile: (filename, data, options, callback) ->
    # Options is optional.
  appendFile: (filename, data, options, callback) ->
    # Options is optional.

  # File descriptor methods.
  close: (fd, callback) ->
  ftruncate: (fd, len, callback) ->
  fsync: (fd, callback) ->
  write: (fd, buffer, offset, length, position, callback) ->
  read: (fd, buffer, offset, length, position, callback) ->

  # Directory methods.
  rmdir: (path, callback) ->
  mkdir: (path, mode, callback) ->
    # Mode is optional.
  readdir: (path, callback) ->

  # Symlink methods.
  link: (srcpath, dstpath, callback) ->
  symlink: (srcpath, dstpath, type, callback) ->
    # Type is optional.
  readlink: (path, callback) ->

  # Property operations.
  chown: (path, uid, gid, callback) ->
  fchown: (fd, uid, gid, callback) ->
  lchown: (path, uid, gid, callback) ->
  chmod: (path, mode, callback) ->
  fchmod: (fd, mode, callback) ->
  lchmod: (path, mode, callback) ->
  utimes: (path, atime, mtime, callback) ->
  futimes: (fd, atime, mtime, callback) ->

  # TODO: Figure out. What is this cache thing? Seems like this should trigger
  # fs.stat operations.
  realpath: (path, [cache], callback) ->
    # Cache is optional.
