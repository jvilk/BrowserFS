# An implementation of the File interface that operates on a file that is
# completely in-memory. PreloadFiles are backed by a Buffer.
#
# This is also an abstract class, as it lacks an implementation of 'sync' and
# 'close'. Each filesystem that wishes to use this file representation must
# extend this class and implement those two methods.
# @todo 'close' lever that disables functionality once closed.
class BrowserFS.File.PreloadFile extends BrowserFS.File
  # Creates a file with the given path and, optionally, the given contents. Note
  # that, if contents is specified, it will be mutated by the file!
  # @param [BrowserFS.FileSystem] _fs The file system that created the file.
  # @param [String] _path
  # @param [BrowserFS.FileMode] _mode The mode that the file was opened using.
  #   Dictates permissions and where the file pointer starts.
  # @param [BrowserFS.node.fs.Stats] _stat The stats object for the given file.
  #   PreloadFile will mutate this object. Note that this object must contain
  #   the appropriate mode that the file was opened as.
  # @param [BrowserFS.node.Buffer?] contents A buffer containing the entire
  #   contents of the file. PreloadFile will mutate this buffer. If not
  #   specified, we assume it is a new file.
  constructor: (@_fs, @_path, @_mode, @_stat, contents) ->
    @_pos = 0
    if contents? and contents instanceof BrowserFS.node.Buffer
      @_buffer = contents
    else
      # Empty buffer. It'll expand once we write stuff to it.
      @_buffer = new BrowserFS.node.Buffer 0
    # Note: This invariant is *not* maintained once the file starts getting
    # modified.
    if @_stat.size != @_buffer.length
      throw new Error "Invalid buffer: Buffer is #{@_buffer.length} long, yet Stats object specifies that file is #{@_stat.size} long."

  # Get the path to this file.
  # @return [String] The path to the file.
  getPath: -> return @_path
  # Get the current file position.
  #
  # We emulate the following bug mentioned in the Node documentation:
  # > On Linux, positional writes don't work when the file is opened in append
  #   mode. The kernel ignores the position argument and always appends the data
  #   to the end of the file.
  # @return [Number] The current file position.
  getPos: ->
    if @_mode.isAppendable() then return @_stat.size
    return @_pos
  # Advance the current file position by the indicated number of positions.
  # @param [Number] delta
  advancePos: (delta) -> @_pos += delta
  # Set the file position.
  # @param [Number] newPos
  setPos: (newPos) -> @_pos = newPos

  # **Core**: Asynchronous sync. Must be implemented by subclasses of this
  # class.
  # @param [Function(BrowserFS.ApiError)] cb
  sync: (cb)->
    try
      @syncSync()
      cb()
    catch e
      cb(e)
  # **Core**: Synchronous sync.
  syncSync: -> throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Asynchronous close. Must be implemented by subclasses of this
  # class.
  # @param [Function(BrowserFS.ApiError)] cb
  close: (cb)->
    try
      @closeSync()
      cb()
    catch e
      cb(e)
  # **Core**: Synchronous close.
  closeSync: -> throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED


  # Asynchronous `stat`.
  # @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] cb
  stat: (cb) ->
    try
      cb(null, @_stat.clone())
    catch e
      cb(e)
  # Synchronous `stat`.
  statSync: -> return @_stat.clone()
  # Asynchronous truncate.
  # @param [Number] len
  # @param [Function(BrowserFS.ApiError)] cb
  truncate: (len, cb)->
    try
      @truncateSync(len)
      cb()
    catch e
      cb(e)
  # Synchronous truncate.
  # @param [Number] len
  truncateSync: (len, cb)->
    unless @_mode.isWriteable()
      throw new BrowserFS.ApiError BrowserFS.ApiError.PERMISSIONS_ERROR, 'File not opened with a writeable mode.'
    @_stat.mtime = new Date()
    if len > @_buffer.length
      buf = new Buffer(len-@_buffer.length)
      buf.fill 0
      # Write will set @_stat.size for us.
      @writeSync buf, 0, buf.length, @_buffer.length
      if @_mode.isSynchronous() then @syncSync()
      return
    @_stat.size = len
    if @_mode.isSynchronous() then @syncSync()
    return
  # Write buffer to the file.
  # Note that it is unsafe to use fs.write multiple times on the same file
  # without waiting for the callback.
  # @param [BrowserFS.node.Buffer] buffer Buffer containing the data to write to
  #  the file.
  # @param [Number] offset Offset in the buffer to start reading data from.
  # @param [Number] length The amount of bytes to write to the file.
  # @param [Number] position Offset from the beginning of the file where this
  #   data should be written. If position is null, the data will be written at
  #   the current position.
  # @param [Function(BrowserFS.ApiError, Number, BrowserFS.node.Buffer)]
  #   cb The number specifies the number of bytes written into the file.
  write: (buffer, offset, length, position, cb) ->
    try
      cb(null, @writeSync(buffer, offset, length, position), buffer)
    catch e
      cb(e)
  # Write buffer to the file.
  # Note that it is unsafe to use fs.writeSync multiple times on the same file
  # without waiting for the callback.
  # @param [BrowserFS.node.Buffer] buffer Buffer containing the data to write to
  #  the file.
  # @param [Number] offset Offset in the buffer to start reading data from.
  # @param [Number] length The amount of bytes to write to the file.
  # @param [Number] position Offset from the beginning of the file where this
  #   data should be written. If position is null, the data will be written at
  #   the current position.
  # @return [Number]
  writeSync: (buffer, offset, length, position) ->
    position ?= @getPos()
    unless @_mode.isWriteable()
      throw new BrowserFS.ApiError BrowserFS.ApiError.PERMISSIONS_ERROR, 'File not opened with a writeable mode.'
    endFp = position+length
    if endFp > @_stat.size
      @_stat.size = endFp
      if endFp > @_buffer.length
        # Extend the buffer!
        newBuff = new Buffer(endFp)
        @_buffer.copy newBuff
        @_buffer = newBuff

    len = buffer.copy @_buffer, position, offset, offset+length
    @_stat.mtime = new Date()

    if @_mode.isSynchronous()
      @syncSync()
      return len
    @setPos position+len
    return len
  # Read data from the file.
  # @param [BrowserFS.node.Buffer] buffer The buffer that the data will be
  #   written to.
  # @param [Number] offset The offset within the buffer where writing will
  #   start.
  # @param [Number] length An integer specifying the number of bytes to read.
  # @param [Number] position An integer specifying where to begin reading from
  #   in the file. If position is null, data will be read from the current file
  #   position.
  # @param [Function(BrowserFS.ApiError, Number, BrowserFS.node.Buffer)] cb The
  #   number is the number of bytes read
  read: (buffer, offset, length, position, cb)->
    try
      cb(null, @readSync(buffer, offset, length, position), buffer)
    catch e
      cb(e)
  # Read data from the file.
  # @param [BrowserFS.node.Buffer] buffer The buffer that the data will be
  #   written to.
  # @param [Number] offset The offset within the buffer where writing will
  #   start.
  # @param [Number] length An integer specifying the number of bytes to read.
  # @param [Number] position An integer specifying where to begin reading from
  #   in the file. If position is null, data will be read from the current file
  #   position.
  # @return [Number]
  readSync: (buffer, offset, length, position)->
    unless @_mode.isReadable()
      throw new BrowserFS.ApiError BrowserFS.ApiError.PERMISSIONS_ERROR, 'File not opened with a readable mode.'
    unless position? then position = @getPos()
    endRead = position+length
    if endRead > @_stat.size
      length = @_stat.size - position
    rv = @_buffer.copy buffer, offset, position, position+length
    @_stat.atime = new Date()
    @_pos = position+length
    return rv

  # Asynchronous `fchmod`.
  # @param [Number|String] mode
  # @param [Function(BrowserFS.ApiError)] cb
  chmod: (mode, cb) ->
    try
      @chmodSync mode
      cb()
    catch e
      cb(e)
  # Asynchronous `fchmod`.
  # @param [Number] mode
  chmodSync: (mode) ->
    unless @_fs.supportsProps()
      throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
    @_stat.mode = mode
    @syncSync()
    return


# File class for the InMemory and XHR file systems.
# Doesn't sync to anything, so it works nicely for memory-only files.
class BrowserFS.File.NoSyncFile extends BrowserFS.File.PreloadFile
  # Asynchronous sync. Doesn't do anything, simply calls the cb.
  # @param [Function(BrowserFS.ApiError)] cb
  sync: (cb) -> cb()
  # Synchronous sync. Doesn't do anything.
  syncSync: -> return

  # Asynchronous close. Doesn't do anything, simply calls the cb.
  # @param [Function(BrowserFS.ApiError)] cb
  close: (cb)-> cb()
  # Synchronous close. Doesn't do anything.
  closeSync: -> return
