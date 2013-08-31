# The name `Dropbox` gets clobbered by the filesystem, so save a reference
# to the Dropbox.js client library
window.db = window.Dropbox

class BrowserFS.File.DropboxFile extends BrowserFS.File.PreloadFile
  sync: (cb) ->
    if @_path is '/tmp/append2.txt'
      console.debug(@_stat)
      console.debug(@_pos)
      console.debug("Writing to #{@_path}:\n#{@_buffer.toString()}")

    @_fs.client.writeFile(@_path, @_buffer.buff.buffer, (error, stat) ->
      if error
        cb(error)
      else
        cb()
    )

  close: (cb) -> @sync(cb)

class BrowserFS.FileSystem.Dropbox extends BrowserFS.FileSystem
  # Pass a callback to be executed once the authentication process has finished
  # DBFS cannot be used before this point. The callback recieves one argument,
  # the newly constructed FS object, that you can then make calls to.
  #
  # Pass a null callback and testing=true to authenticate with pregenerated
  # credentials for testing.
  constructor: (cb, testing=false) ->
    @init_client = new db.Client({
      key: 'u8sx6mjp5bxvbg4'
      sandbox: true
    })

    # Authenticate with pregenerated credentials for unit testing so that it
    # can be automatic
    if testing
      @init_client.setCredentials({
        key: "u8sx6mjp5bxvbg4",
        token: "mhkmZQTE4PUAAAAAAAAAAYyMdcdkqvPudyYwmuIZp3REM1YvV9skdtstDBYUxuFg",
        uid: "4326179"
      })
    # Prompt the user to authenticate under normal use
    else
      @init_client.authDriver(new db.AuthDriver.Redirect({ rememberUser: true }))

    @init_client.authenticate((error, authed_client) =>
      if error
        console.error 'Error: could not connect to Dropbox'
        console.error error
        return

      authed_client.getUserInfo((error, info) ->
        console.debug "Successfully connected to #{info.name}'s Dropbox"
      )

      @client = authed_client
      cb(this) if cb
    )

  getName: -> 'Dropbox'

  # Dropbox.js works on all supported browsers and Node.js
  @isAvailable: -> true

  # Files can be written to Dropbox
  isReadOnly: -> false

  # Dropbox doesn't support symlinks, properties, or synchronous calls
  supportsSymlinks: -> false

  supportsProps: -> false

  supportsSynch: -> false

  empty: (main_cb) ->
    self = this
    self.client.readdir('/', (error, paths, dir, files) ->
      if error
        main_cb(error)
      else
        deleteFile = (file, cb) ->
          self.client.remove(file.path, (err, stat) ->
            if err
              cb(err)
            else
              cb(null)
          )
        finished = (err) ->
          if err
            console.error("Failed to empty Dropbox")
            console.error(err)
          else
            console.debug('Emptied sucessfully')
            main_cb()

        async.each(files, deleteFile, finished)
    )

  rename: (oldPath, newPath, cb) ->
    self = this
    self.client.move(oldPath, newPath, (error, stat) ->
      if error
        self._sendError(cb, "#{oldPath} doesn't exist")
      else
        stat = new BrowserFS.node.fs.Stats(self._statType(stat), stat.size)
        cb(null, stat)
    )

  stat: (path, isLstat, cb) ->
    self = this

    # Handle empty string case -- doesn't return a Dropbox error, but isn't
    # valid in the node API
    if path is ''
      self._sendError(cb, "Empty string is not a valid path")
      return

    # Ignore lstat case -- Dropbox doesn't support symlinks

    # Stat the file
    self.client.stat(path, (error, stat) ->
      # Dropbox keeps track of deleted files, so if a file has existed in the
      # past but doesn't any longer, you wont get an error
      if error or (stat? and stat.isRemoved)
        self._sendError(cb, "#{path} doesn't exist")
      else
        stat = new BrowserFS.node.fs.Stats(self._statType(stat), stat.size)
        cb(null, stat)
    )

  open: (path, flags, mode, cb) ->
    self = this

    # XXX remove this
    if path is '/tmp/append2.txt'
      debugger

    # Try and get the file's contents
    self.client.readFile(path, {arrayBuffer: true}, (error, content, db_stat, range) =>
      if error
        # If the file's being opened for reading and doesn't exist, return an
        # error
        if 'r' in flags.modeStr
          self._sendError(cb, "#{path} doesn't exist")
        else
          switch error.status
            when 0
              console.error('No connection')
            # If it's being opened for writing or appending, create it so that
            # it can be written to
            when 404
              # console.debug("#{path} doesn't exist, creating...")
              self.client.writeFile(path, '', (error, stat) ->
                buf = new BrowserFS.node.Buffer(0)
                file = self._makeFile(path, flags, stat, buf)
                cb(null, file)
              )
            else
              console.log("Unhandled error: #{error}")
      # No error
      else
        # console.debug("size of #{path}: #{db_stat.size}")

        # Dropbox.js seems to set `content` to `null` rather than to an empty
        # buffer when reading an empty file. Not sure why this is.
        if content is null
          buffer = new BrowserFS.node.Buffer(0)
        else
          buffer = new BrowserFS.node.Buffer(content)

        file = self._makeFile(path, flags, db_stat, content)
        cb(null, file)
    )

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

    return new BrowserFS.File.DropboxFile(this, path, mode, stat, buffer)

  # Private
  # Delete a file or directory from Dropbox
  # isFile should reflect which call was made to remove the it (`unlink` or
  # `rmdir`). If this doesn't match what's actually at `path`, an error will be
  # returned
  _remove: (path, cb, isFile) ->
    self = this
    self.client.stat(path, (error, stat) ->
      message = null
      if error
        self._sendError(cb, "#{path} doesn't exist")
      else
        if stat.isFile and not isFile
          self._sendError(cb, "Can't remove #{path} with rmdir -- it's a file, not a directory. Use `unlink` instead.")
        else if not stat.isFile and isFile
          self._sendError(cb, "Can't remove #{path} with unlink -- it's a directory, not a file. Use `rmdir` instead.")
        else
          self.client.remove(path, (error, stat) ->
            if error
              self._sendError(cb, "Failed to remove #{path}")
            else
              cb(null)
          )
    )

  # Private
  # Create a BrowserFS error object with message msg and pass it to cb
  _sendError: (cb, msg) ->
    cb(new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, msg))

  # Delete a file
  unlink: (path, cb) -> @_remove(path, cb, true)

  # Delete a directory
  rmdir: (path, cb) -> @_remove(path, cb, false)

  # Create a directory
  mkdir: (path, mode, cb) ->
    # Dropbox.js' client.mkdir() behaves like `mkdir -p`, i.e. it creates a
    # directory and all its ancestors if they don't exist.
    # Node's fs.mkdir() behaves like `mkdir`, i.e. it throws an error if an attempt
    # is made to create a directory without a parent.
    # To handle this inconsistency, a check for the existence of `path`'s parent
    # must be performed before it is created, and an error thrown if it does
    # not exist

    self = this
    parent = BrowserFS.node.path.dirname(path)

    self.client.stat(parent, (error, stat) ->
      if error
        self._sendError(cb, "Can't create #{path} because #{parent} doesn't exist")
      else
        self.client.mkdir(path, (error, stat) ->
          if error
            self._sendError(cb, "#{path} already exists")
          else
            cb(null)
        )
    )

  # Get the names of the files in a directory
  readdir: (path, cb) ->
    @client.readdir(path, (error, files, dir_stat, content_stats) ->
      if error
        cb(error)
      else
        cb(null, files)
    )
