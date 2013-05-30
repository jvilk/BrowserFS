# A simple filesystem backed by IndexedDB.
class BrowserFS.FileSystem.IndexedDB extends BrowserFS.FileSystem
  constructor: (cb) ->
    req = window.indexedDB.open 'BrowserFS-database'
    req.onsuccess = =>
      @db = req.result
      console.log 'DB opened.'
      @db.onerror = (evt) -> console.error "DB error: #{evt.target.errorCode}"
      cb()
    req.onerror = (evt) ->
      console.error "DB open failed: #{evt.target.errorCode}"
      cb(evt.target.errorCode)
    req.onupgradeneeded = (evt) ->
      evt.currentTarget.result.createObjectStore 'inodes', { keyPath: '_path' }
      console.log 'DB object store created.'

  # Technically asynchronous, but we usually don't care to give it a callback.
  empty: ->
    @db.transaction('inodes', 'readwrite').objectStore('inodes').clear()

  # Returns the name of the file system.
  # @return [String]
  getName: -> 'indexedDB'

  # Does the browser support indexedDB?
  # @return [Boolean]
  isAvailable: -> window?.indexedDB?

  # Returns false; this filesystem is not read-only.
  # @return [Boolean]
  isReadOnly: -> false

  # Returns false; this filesystem does not support symlinks.
  # @return [Boolean]
  supportsLinks: -> false

  # Returns false; this filesystem does not support properties (yet).
  # @return [Boolean]
  supportsProps: -> false

  # Retrieve the indicated file from `indexedDB`.
  # @param [String] path
  # @param [function] cb
  _getDB: (path, cb) ->
    req = @db.transaction('inodes').objectStore('inodes').get(path)
    req.onerror = (evt) -> cb evt.target.errorCode
    req.onsuccess = (evt) -> cb null, evt.target.result

  _putDB: (file, cb) ->
    console.log 'putting', file
    req = @db.transaction('inodes', 'readwrite').objectStore('inodes').put(file)
    req.onerror = (evt) -> cb evt.target.errorCode
    req.onsuccess = (evt) -> cb null, evt.target.result

  _rmDB: (path, cb) ->
    req = @db.transaction('inodes', 'readwrite').objectStore('inodes').delete(path)
    req.onerror = (evt) -> cb evt.target.errorCode
    req.onsuccess = (evt) -> cb null

  # File or directory operations

  stat: (path, isLstat, cb) ->
    @_getDB path, (file) ->
      if file?
        cb null, file.getStats()
      else
        cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} not found."

  # File operations

  open: (path, flags, mode, cb) ->
    # Check if the path exists, and is a file.
    console.log 'opening: '+path
    @_getDB path, (err, file) =>
      console.log path, err, file
      unless file?
        if file.isDirectory()
          return cb new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, "#{path} is a directory."
        switch flags.pathExistsAction()
          when BrowserFS.FileMode.THROW_EXCEPTION
            cb new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, "#{path} already exists."
          when BrowserFS.FileMode.TRUNCATE_FILE
            file.truncate()  # updates in-place
            @_putDB file, cb
          when BrowserFS.FileMode.NOP
            cb null, file
          else
            cb new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, 'Invalid FileMode object.'
        return
      # file doesn't exist
      switch flags.pathNotExistsAction()
        when BrowserFS.FileMode.CREATE_FILE
          file = new BrowserFS.File.IndexedDBFile path, flags, mode
          @_putDB file, cb
        when BrowserFS.FileMode.THROW_EXCEPTION
          cb new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, "#{path} doesn't exist."
        else
          cb new BrowserFS.ApiError BrowserFS.ApiError.INVALID_PARAM, 'Invalid FileMode object.'

  unlink: (path, cb) ->
    @_rmDB path, (err) ->
      return cb() if err is null
      cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} not found: #{err}"

  # Directory operations

  rmdir: (path, cb) ->
    @_rmDB path, (err) ->
      return cb() if err is null
      cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} not found: #{err}"

  mkdir: (path, mode, cb) ->
    dir = new BrowserFS.File.IndexedDBDirectory path, mode
    @_putDB dir, (err) ->
      return cb() if err is null
      cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} not found: #{err}"

  readdir: (path, cb) ->
    @_getDB path, (err, dir) ->
      if dir.isFile()
        return cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_FOUND, "#{path} is a file, not a directory."
      cb null, dir.getListing()


# A conglomeration of PreloadFile + FileInode
class BrowserFS.File.IndexedDBFile extends BrowserFS.File.NoSyncFile
  constructor: (path, flags, mode) ->
    stats = new BrowserFS.node.fs.Stats(BrowserFS.node.fs.Stats.FILE, 0, mode)
    super(null, path, mode, stats)
  isDirectory: -> false
  isFile: -> true

# File + DirInode
class BrowserFS.File.IndexedDBDirectory extends BrowserFS.File
  constructor: (@_path, @_mode) ->
  isDirectory: -> true
  isFile: -> false