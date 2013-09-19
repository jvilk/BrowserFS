_getFS = -> window.webkitRequestFileSystem or window.requestFileSystem or null

_toArray = (list) -> Array.prototype.slice.call(list or [], 0)

# A note about getFile and getDirectory options:
# These methods are called at numerous places in this file, and are passed
# some combination of these two options:
#   - create: If true, the entry will be created if it doesn't exist.
#             If false, an error will be thrown if it doesn't exist.
#   - exclusive: If true, only create the entry if it doesn't already exist,
#                and throw an error if it does.

class BrowserFS.File.HTML5FSFile extends BrowserFS.File.PreloadFile
  sync: (cb) ->
    self = this
    # Don't create the file (it should already have been created by `open`)
    opts =
      create: false

    success = (entry) ->
      entry.createWriter (writer) ->
        blob = new Blob([self._buffer.buff])
        length = blob.size

        writer.onwriteend = (event) ->
          writer.onwriteend = null
          writer.truncate(length)
          cb?()

        writer.onerror = (err) ->
          self._fs._sendError(cb, 'Write failed')

        writer.write(blob)

    error = (err) ->
      self._fs._sendError(cb, err)

    @_fs.fs.root.getFile(@_path, opts, success, error)

  close: (cb) -> @sync(cb)

class BrowserFS.FileSystem.HTML5FS extends BrowserFS.FileSystem
  # Arguments:
  #   - type: PERSISTENT or TEMPORARY
  #   - size: storage quota to request, in megabytes. Allocated value may be less.
  constructor: (@size=5, @type=window.PERSISTENT) ->
    kb = 1024
    mb = kb * kb
    @size *= mb

  getName: -> 'HTML5 FileSystem'

  @isAvailable: -> _getFS()?

  isReadOnly: -> false

  supportsSymlinks: -> false

  supportsProps: -> false

  supportsSynch: -> false

  # Private
  # Returns a human-readable error message for the given DOMError
  # Full list of values here:
  # https://developer.mozilla.org/en-US/docs/Web/API/DOMError
  # I've only implemented the most obvious ones, but more can be added to
  # make errors more descriptive in the future.
  _humanise: (err) ->
    switch err.code
      when DOMError.QUOTA_EXCEEDED_ERR
        'Filesystem full. Please delete some files to free up space.'
      when DOMError.NOT_FOUND_ERR
        'File does not exist.'
      when DOMError.SECURITY_ERR
        'Insecure file access.'
      else
        "Unknown Error: #{err.name}"

  # Nonstandard
  # Requests a storage quota from the browser to back this FS.
  allocate: (cb) ->
    self = this

    success = (fs) ->
      self.fs = fs
      cb?()

    error = (err) ->
      msg = self._humanise(err)

      console.error("Failed to create FS")
      console.error(msg)
      cb?(err)

    getter = _getFS()

    if @type is window.PERSISTENT
      window.webkitStorageInfo.requestQuota(@type, @size, (granted) ->
        getter(@type, granted, success, error)
      )
    else
      getter(@type, @size, success, error)

  # Nonstandard
  # Deletes everything in the FS. Used for testing.
  # Karma clears the storage after you quit it but not between runs of the test
  # suite, and the tests expect an empty FS every time.
  empty: (main_cb) ->
    self = this

    # Get a list of all entries in the root directory to delete them
    self._readdir('/', (err, entries) ->
      if err
        console.error('Failed to empty FS')
        main_cb(err)
      else

        # Called when every entry has been operated on
        finished = (err) ->
          if err
            console.error("Failed to empty FS")
            main_cb(err)
          else
            main_cb()

        # Removes files and recursively removes directories
        deleteEntry = (entry, cb) ->
          succ = ->
            cb()

          err = ->
            cb("Failed to remove #{entry.fullPath}")

          if entry.isFile
            entry.remove(succ, err)
          else
            entry.removeRecursively(succ, err)

        # Loop through the entries and remove them, then call the callback
        # when they're all finished.
        async.each(entries, deleteEntry, finished)
    )

  rename: (oldPath, newPath, cb) ->
    self = this

    success = (file) ->
      file.moveTo(oldPath, newPath)
      cb()

    error = (err) ->
      self._sendError(cb, "Could not rename #{oldPath} to #{newPath}")

    @fs.root.getFile(oldPath, {}, success, error)

  stat: (path, isLstat, cb) ->
    self = this

    # Handle empty string case -- valid in the HTML5 FS API, but not valid in
    # the Node API.
    # XXX: shouldn't be necessary, see issue 55.
    if path is ''
      self._sendError(cb, "Empty string is not a valid path")
      return

    # Throw an error if the entry doesn't exist, because then there's nothing
    # to stat.
    opts =
      create: false

    # Called when the path has been successfully loaded as a file.
    loadAsFile = (entry) ->
      fileFromEntry = (file) ->
        stat = new BrowserFS.node.fs.Stats(BrowserFS.node.fs.Stats.FILE, file.size)
        cb(null, stat)

      entry.file(fileFromEntry, failedToLoad)

    # Called when the path has been successfully loaded as a directory.
    loadAsDir = (dir) ->
      # Directory entry size can't be determined from the HTML5 FS API, and is
      # implementation-dependant anyway, so a dummy value is used.
      size = 4096
      stat = new BrowserFS.node.fs.Stats(BrowserFS.node.fs.Stats.DIRECTORY, size)
      cb(null, stat)

    # Called when the path couldn't be opened as a directory or a file.
    failedToLoad = (err) ->
      self._sendError(cb, "Could not stat #{path}")

    # Called when the path couldn't be opened as a file, but might still be a
    # directory.
    failedToLoadAsFile = ->
      self.fs.root.getDirectory(path, opts, loadAsDir, failedToLoad)

    # No method currently exists to determine whether a path refers to a
    # directory or a file, so this implementation tries both and uses the first
    # one that succeeds.
    @fs.root.getFile(path, opts, loadAsFile, failedToLoadAsFile)

  open: (path, flags, mode, cb) ->
    self = this

    opts =
      create: flags.isWriteable()
      exclusive: flags.isExclusive()

    error = (err) ->
      self._sendError(cb, "Could not open #{path}")

    success = (entry) ->
      success2 = (file) ->
        reader = new FileReader()

        reader.onloadend = (event) ->
          bfs_file = self._makeFile(path, flags, file, event.target.result)
          cb(null, bfs_file)

        reader.onerror = error

        reader.readAsArrayBuffer(file)

      entry.file(success2, error)

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
    type = @_statType(stat)
    stat = new BrowserFS.node.fs.Stats(type, stat.size)
    data or= ''
    buffer = new BrowserFS.node.Buffer(data)

    return new BrowserFS.File.HTML5FSFile(this, path, mode, stat, buffer)

  # Private
  # Delete a file or directory from the file system
  # isFile should reflect which call was made to remove the it (`unlink` or
  # `rmdir`). If this doesn't match what's actually at `path`, an error will be
  # returned
  _remove: (path, cb, isFile) ->
    self = this
    # Stringly typed
    method = "get#{if isFile then 'File' else 'Directory'}"

    success = (entry) ->
      succ = -> cb()
      err = -> self._sendError(cb, "Failed to remove #{path}")
      entry.remove(succ, err)

    error = (err) ->
      self._sendError(cb, "Failed to remove #{path}")

    # Deleting the entry, so don't create it
    opts =
      create: false

    @fs.root[method](path, opts, success, error)

  unlink: (path, cb) ->
    @_remove(path, cb, true)

  rmdir: (path, cb) ->
    @_remove(path, cb, false)

  mkdir: (path, mode, cb) ->
    self = this

    # Create the directory, but throw an error if it already exists, as per
    # mkdir(1)
    opts =
      create: true
      exclusive: true

    success = (dir) -> cb()

    error = (err) -> self._sendError(cb, "Could not create directory: #{path}")

    @fs.root.getDirectory(path, opts, success, error)

  # Private
  # Returns an array of `FileEntry`s. Used internally by empty and readdir.
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

  # Map _readdir's list of `FileEntry`s to their names and return that.
  readdir: (path, cb) ->
    @_readdir(path, (entries) ->
      cb((entry.name for entry in entries))
    )
