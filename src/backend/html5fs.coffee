_getFS = -> window.webkitRequestFileSystem or window.requestFileSystem or null

class BrowserFS.File.HTML5FSFile extends BrowserFS.File.PreloadFile
  sync: (cb) ->

  close: (cb) -> @sync(cb)

class BrowserFS.FileSystem.HTML5FS extends BrowserFS.FileSystem
  constructor: ->

  getName: -> 'HTML5 FileSystem'

  @isAvailable: -> _getFS()?

  isReadOnly: -> false

  supportsSymlinks: -> false

  supportsProps: -> false

  supportsSynch: -> false

  allocate: (cb) ->
    self = this

    type = window.PERSISTENT

    kb = 1024
    mb = kb * kb
    size = 5 * mb

    success = (fs) ->
      console.debug("FS created: #{fs.name}")
      cb(null) if cb

    error = (err) ->
      console.error("Failed to create FS")
      console.error(err)
      cb(err) if cb

    _getFS()(type, size, success, error)

  empty: (cb) ->

  rename: (oldPath, newPath, cb) ->

  stat: (path, isLstat, cb) ->

  open: (path, flags, mode, cb) ->

  unlink: (path, cb) ->

  rmdir: (path, cb) ->

  mkdir: (path, mode, cb) ->

  readdir: (path, cb) ->
