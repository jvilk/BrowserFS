# Class for a filesystem. Provides some default functionality.
class BrowserFS.FileSystem
  # A handy method for sources that store/retrieve data using a relative file
  # name.
  _trim_mnt_pt: (path) -> path.slice @mnt_pt.length

  constructor: (@mnt_pt) ->

  # REQUIRED INTERFACE METHODS
  # Global information
  # Is this filesystem available in the current browser? e.g. does it depend
  # on special browser features?
  isAvailable: () -> true
  # How much space is remaining on this filesystem?
  spaceRemaining: (cb) -> cb 0

  # File or directory operations
  rename: (path1, path2, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  stat: (path, isLstat, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED

  # File operations
  open: (path, mode, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  unlink: (path, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED

  # Directory operations
  rmdir: (path, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  mkdir: (path, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  readdir: (path, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED

  # OPTIONAL INTERFACE METHODS
  # These are implemented in terms of the required interface methods or throw
  # an error if that is not possible.
  # Feel free to override them in a filesystem if there's a more efficient way
  # to execute them.

  # File or directory operations
  # If stat doesn't return an error, it exists.
  exists: (path, cb) -> @stat(path, (err) -> if err? then cb(false) else cb(true))

  # File operations
  # Mapped to open file, do operation, close file.
  readFile: (path, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  writeFile: (path, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  truncate: (path, len, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED

  # Property operations
  # This isn't always possible on some filesystem types (e.g. Dropbox).
  chmod: (path, type, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  chown: (path, type, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  utimes: (path, cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED

  # Open the file for appending, write to it, close it.
  appendFile: (path, data, cb) ->
    # TODO: Deal with once I figure out buffers.
    #@openpath, 'a' 0666, (err, fd) ->
    #  fd.write(buffer, offset, length, position, callback)

  # Symlink operations
  # Symlinks aren't always supported.
  link: (cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  symlink: (cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED
  readlink: (cb) -> cb BrowserFS.ApiError.NOT_SUPPORTED

  # Does this verify that the path exists? If not, we can do it using
  # 'resolve':
  # realpath
