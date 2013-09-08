class BrowserFS.File.HTML5FSFile extends BrowserFS.File.PreloadFile
  sync: (cb) ->

  close: (cb) -> @sync(cb)

class BrowserFS.FileSystem.HTML5FS extends BrowserFS.FileSystem
  constructor: (cb) ->
    cb(this) if cb

  getName: -> 'HTML5 FileSystem'

  @isAvailable: -> true

  isReadOnly: -> false

  supportsSymlinks: -> false

  supportsProps: -> false

  supportsSynch: -> false

  empty: (cb) ->

  rename: (oldPath, newPath, cb) ->

  stat: (path, isLstat, cb) ->

  open: (path, flags, mode, cb) ->

  unlink: (path, cb) ->

  rmdir: (path, cb) ->

  mkdir: (path, mode, cb) ->

  readdir: (path, cb) ->
