_getFS = -> window.webkitRequestFileSystem or window.requestFileSystem or null

_toArray = (list) -> Array.prototype.slice.call(list or [], 0)

class BrowserFS.File.HTML5FSFile extends BrowserFS.File.PreloadFile
  sync: (cb) ->
    self = this
    opts =
      create: false
      exclusive: false

    success = (entry) ->
      entry.createWriter (writer) ->
        writer.onwriteend = (event) ->
          cb(null)

        writer.onerror = (err) ->
          console.error("Write failed: #{err}")
          self._fs._sendError(cb, 'Write failed')

        # XXX: Not sure how to get the MIME type
        blob = new Blob([self._buffer.buff], { type: 'application/octet' })
        writer.write(blob)

    error = (err) ->
      self._fs._sendError(cb, err)

    @_fs.fs.root.getFile(@_path, opts, success, error)

  close: (cb) -> @sync(cb)

class BrowserFS.FileSystem.HTML5FS extends BrowserFS.FileSystem
  # Arguments:
  #   - type: PERSISTENT or TEMPORARY
  #   - size: storage quota to request, in megabytes. Allocated value may be less.
  constructor: (@type=window.PERSISTENT, @size=5) ->
    kb = 1024
    mb = kb * kb
    @size *= mb

  getName: -> 'HTML5 FileSystem'

  @isAvailable: -> _getFS()?

  isReadOnly: -> false

  supportsSymlinks: -> false

  supportsProps: -> false

  supportsSynch: -> false

  # Returns a human-readable error message for the given FileError
  _humanise: (err) ->
    switch err.code
      when FileError.QUOTA_EXCEEDED_ERR
        'Filesystem full. Please delete some files to free up space.'
      when FileError.NOT_FOUND_ERR
        'File does not exist.'
      when FileError.SECURITY_ERR
        'Insecure file access.'
      # XXX: not sure what to return for these
      when FileError.INVALID_MODIFICATION_ERR
        ''
      when FileError.INVALID_STATE_ERR
        ''
      else
        'Unknown Error'

  allocate: (cb) ->
    self = this

    success = (fs) ->
      self.fs = fs
      console.debug("FS created: #{fs.name}")
      cb(null) if cb

    error = (err) ->
      msg = @_humanise(err)

      console.error("Failed to create FS")
      console.error(msg)
      cb(err) if cb

    getter = _getFS()

    if @type is window.PERSISTENT
      window.webkitStorageInfo.requestQuota(@type, @size, (granted) ->
        getter(@type, granted, success, error)
      )
    else
      getter(@type, @size, success, error)

  empty: (main_cb) ->
    self = this

    # main_cb()
    # return

    # Get a list of all entries in the root directory to delete them
    self._readdir('/', (err, entries) ->
      if err
        console.error('Failed to empty FS')
        main_cb(err)
      else
        succ = -> 'Deleted file'
        err = -> self._sendError(cb, "Failed to remove #{path}")

        # Called when every entry has been operated on
        finished = (err) ->
          if err
            console.error("Failed to empty FS")
            console.error(err)
            main_cb(err)
          else
            console.debug('Emptied sucessfully')
            main_cb(null)

        # Removes files and recursively removes directories
        deleteEntry = (entry, cb) ->
          if entry.isFile
            entry.remove(succ, err)
          else
            entry.removeRecursively(succ, err)

        # Loop through the entries and remove them, then call the callback
        # when they're all finished
        async.each(entries, deleteEntry, finished)
    )

  rename: (oldPath, newPath, cb) ->
    self = this

    success = (file) ->
      file.moveTo(oldPath, newPath)
      cb(null)

    error = (err) ->
      self._sendError(cb, "Could not rename #{oldPath} to #{newPath}")

    @fs.root.getFile(oldPath, {}, success, error)

  stat: (path, isLstat, cb) ->
    self = this

    # if path is ''
    #   self._sendError(cb, "Empty string is not a valid path")
    #   return

    # isLstat can be ignored, because the HTML5 FileSystem API doesn't support
    # symlinks

    opts =
      create: false

    success = (entry) ->
      entry.file (file) ->
        stat = new BrowserFS.node.fs.Stats(self._statType(entry), file.size)
        cb(null, stat)

    error = (err) ->
      self._sendError(cb, "Could not stat #{path}")

    @fs.root.getFile(path, opts, success, error)

  open: (path, flags, mode, cb) ->
    self = this

    opts =
      if 'r' in flags.modeStr
        create: false
      else if 'w' in flags.modeStr or 'a' in flags.modeStr
        create: true      # Create the file if it doesn't exist
        exclusive: false  # Don't throw an error if it does exist
      else
        throw new Error("Invalid mode: #{flags.modeStr}")

    success = (entry) ->
      entry.file (file) ->
        reader = new FileReader()

        reader.onloadend = (event) ->
          bfs_file = self._makeFile(path, flags, file, event.target.result)
          cb(null, bfs_file)

        reader.onerror = (err) ->
          console.error(err)
          self._sendError(cb, "Could not open #{path}")

        reader.readAsArrayBuffer(file)


    error = (err) ->
      self._sendError(cb, "Could not open #{path}")

    @fs.root.getFile(path, opts, success, error)

  # Private
  # Create a BrowserFS error object with message msg and pass it to cb
  _sendError: (cb, err) ->
    msg =
      if typeof err is 'string' then err
      else @_humanise(err)

    cb(new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, msg))

  # Private
  # Returns a BrowserFS object representing the type of a Dropbox.js stat object
  _statType: (stat) ->
    BrowserFS.node.fs.Stats[if stat.isFile then 'FILE' else 'DIRECTORY']

  # Private
  # Returns a BrowserFS object representing a File, created from the data
  # returned by calls to the Dropbox API.
  _makeFile: (path, mode, stat, data) ->
    # debugger
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
      succ = -> cb(null)
      err = -> self._sendError(cb, "Failed to remove #{path}")
      entry.remove(succ, err)

    error = (err) ->
      self._sendError(cb, "Failed to remove #{path}")

    @fs.root[method](path, {create: false}, success, error)

  unlink: (path, cb) ->
    @_remove(path, cb, true)

  rmdir: (path, cb) ->
    @_remove(path, cb, false)

  mkdir: (path, mode, cb) ->
    self = this
    success = (dir) -> cb(null)

    error = (err) -> self._sendError(cb, "Could not create directory #{path}")

    @fs.root.getDirectory(path, {create: true, exclusive: true}, success, error)

  _readdir: (path, cb) ->
    self = this
    reader = @fs.root.createReader()
    entries = []

    error = (err) ->
      self._sendError(cb, err)

    # Call the reader.readEntries() until no more results are returned.
    readEntries = ->
      reader.readEntries(((results) ->
        if results.length
          entries = entries.concat(_toArray(results))
          readEntries()
        else
          cb(null, entries)
      ), error)

    readEntries()

  readdir: (path, cb) ->
    @_readdir(path, (entries) ->
      cb((entry.name for entry in entries))
    )

  # appendFile: (fname, data, encoding, flag, mode, cb) ->
  #   debugger
  #   self = this
  #   if typeof data is 'string'
  #     data = new BrowserFS.node.Buffer data, encoding

  #   error = (err) ->
  #     console.error(err)
  #     self._sendError(cb, err)

  #   @fs.root.getFile(fname, {create: true, exclusive: false}, ((fileEntry) ->
  #     success = (fileWriter) ->
  #       fileWriter.seek(fileWriter.length)
  #       blob = new Blob(data.buff, {type: 'text/plain'})
  #       fileWriter.write(blob)

  #     fileEntry.createWriter(success, error)

  #   ), error)
