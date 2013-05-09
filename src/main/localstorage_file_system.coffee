# A simple filesystem backed by local storage.
# Note that your program should only ever have one instance of this class.
class BrowserFS.FileSystem.LocalStorage extends BrowserFS.FileSystem
  # Constructs the file system. Loads up any existing files stored in local
  # storage into a simple file index.
  constructor: ->
  # Removes all data from localStorage.
  emptyLocalStorage: ->


  # Does the browser support localStorage?
  # @return [Boolean]
  isAvailable: -> false
  # Passes the size and taken space in bytes to the callback.
  # @param [String] path Unused in the implementation.
  # @param [Function(Number, Number)] cb
  diskSpace: (path, cb) -> cb 0, 0
  # Returns false; this filesystem is not read-only.
  # @return [Boolean]
  isReadOnly: -> false
  # Returns false; this filesystem does not support symlinks.
  # @return [Boolean]
  supportsLinks: -> false
  # Returns false; this filesystem does not support properties.
  # @return [Boolean]
  supportsProps: -> false

  # File or directory operations

  rename: (oldPath, newPath, cb) ->
    cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED

  stat: (path, isLstat, cb) ->
    cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED

  # File operations

  open: (path, flags, mode, cb) ->
    cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED

  unlink: (path, cb) ->
    cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED

  # Directory operations

  rmdir: (path, cb) ->
    cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED

  mkdir: (path, mode, cb) ->
    cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED

  readdir: (path, cb) ->
    cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
