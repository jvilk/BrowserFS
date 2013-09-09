_getFS = -> window.webkitRequestFileSystem or window.requestFileSystem or null

class BrowserFS.File.HTML5FSFile extends BrowserFS.File.PreloadFile
  sync: (cb) ->
    opts =
      create: true
      exclusive: false

    success = (file) ->
      cb(null)

    error = (err) ->
      cb(err)

    @_fs.fs.getFile(@_path, opts, success, error)

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
      self.fs = fs
      console.debug("FS created: #{fs.name}")
      cb(null) if cb

    error = (err) ->
      msg = switch err.code
        when FileError.QUOTA_EXCEEDED_ERR
          'QUOTA_EXCEEDED_ERR'
        when FileError.NOT_FOUND_ERR
          'NOT_FOUND_ERR'
        when FileError.SECURITY_ERR
          'SECURITY_ERR'
        when FileError.INVALID_MODIFICATION_ERR
          'INVALID_MODIFICATION_ERR'
        when FileError.INVALID_STATE_ERR
          'INVALID_STATE_ERR'
        else
          'Unknown Error'

      console.error("Failed to create FS")
      console.error(msg)
      cb(err) if cb

    window.webkitStorageInfo.requestQuota(type, size, (granted) ->
      _getFS()(type, granted, success, error)
    )

  empty: (cb) ->

  rename: (oldPath, newPath, cb) ->

  stat: (path, isLstat, cb) ->

  open: (path, flags, mode, cb) ->
    console.log('open')

    self = this

    opts =
      if 'r' in flags.modeStr
        create: false
      else if 'w' in flags.modeStr or 'a' in flags.modeStr
        create: true      # Create the file if it doesn't exist
        exclusive: false  # Don't throw an error if it does exist
      else
        throw new Error("Invalid mode: #{flags.modeStr}")

    success = (file) ->
      reader = new FileReader()

      reader.onloadend = (err) ->
        console.error(err) if err

        bfs_file = self._makeFile(path, flags, file, @result)
        cb(null, bfs_file)

      reader.readAsArrayBuffer(file)


    error = (err) ->
      self._sendError(cb, err)

    @fs.root.getFile(path, opts, success, error)

  # Private
  # Create a BrowserFS error object with message msg and pass it to cb
  _sendError: (cb, msg) ->
    cb(new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, msg))

    # Private
  # Returns a BrowserFS object representing the type of a Dropbox.js stat object
  _statType: (stat) ->
    BrowserFS.node.fs.Stats[if stat.isFile then 'FILE' else 'DIRECTORY']

  # Private
  # Returns a BrowserFS object representing a File, created from the data
  # returned by calls to the Dropbox API.
  _makeFile: (path, mode, stat, data) ->
    type = @_statType(stat)
    stat = new BrowserFS.node.fs.Stats(type, stat.size)
    data or= ''
    buffer = new BrowserFS.node.Buffer(data)

    return new BrowserFS.File.HTML5FSFile(this, path, mode, stat, buffer)

  # Private
  # Delete a file or directory from Dropbox
  # isFile should reflect which call was made to remove the it (`unlink` or
  # `rmdir`). If this doesn't match what's actually at `path`, an error will be
  # returned
  _remove: (path, cb, isFile) ->
    self = this
    method = "get#{if isFile then 'File' else 'Directory'}"

    success = (entry) ->
      entry.remove(
        (-> cb(null)),
        (-> self._sendError(cb, "Failed to remove #{path}"))
      )

    error = (err) ->
      self._sendError(cb, err)

    @fs.root[method](path, {create: false}, success, error)

  unlink: (path, cb) ->
    @_remove(path, cb, true)

  rmdir: (path, cb) ->
    @_remove(path, cb, false)

  mkdir: (path, mode, cb) ->
    success = (dir) -> cb(null)

    error = (err) -> @_sendError(cb, err)

    @fs.root.getDirectory(path, {create: true}, success, error)

  readdir: (path, cb) ->
    self = this
    reader = @fs.root.createReader()
    entries = []

    error = (err) ->
      self._sendError(cb, err)

    # Call the reader.readEntries() until no more results are returned.
    readEntries = ->
      dirReader.readEntries(((results) ->
        if results.length
          entries = entries.concat(toArray(results))
          readEntries()
        else
          cb(null, entries)
      ), error)

    readEntries()
