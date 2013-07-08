# Base class that contains the interface for a file object. BrowserFS uses these
# as a replacement for numeric file descriptors.
class BrowserFS.File
  constructor: ->
  # **Core**: Get the current file position.
  # @return [Number]
  getPos: -> throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Asynchronous `stat`.
  # @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] cb
  stat: (cb) -> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Synchronous `stat`.
  # @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] cb
  statSync: -> throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Asynchronous close.
  # @param [Function(BrowserFS.ApiError)] cb
  close: (cb)-> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Synchronous close.
  closeSync: -> throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Asynchronous truncate.
  # @param [Number] len
  # @param [Function(BrowserFS.ApiError)] cb
  truncate: (len, cb)-> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Synchronous truncate.
  # @param [Number] len
  truncateSync: (len)-> throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Asynchronous sync.
  # @param [Function(BrowserFS.ApiError)] cb
  sync: (cb)-> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Synchronous sync.
  syncSync: -> throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Write buffer to the file.
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
  write: (buffer, offset, length, position, cb)->
    cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Write buffer to the file.
  # Note that it is unsafe to use fs.writeSync multiple times on the same file
  # without waiting for it to return.
  # @param [BrowserFS.node.Buffer] buffer Buffer containing the data to write to
  #  the file.
  # @param [Number] offset Offset in the buffer to start reading data from.
  # @param [Number] length The amount of bytes to write to the file.
  # @param [Number] position Offset from the beginning of the file where this
  #   data should be written. If position is null, the data will be written at
  #   the current position.
  # @return [Number]
  writeSync: (buffer, offset, length, position)->
    throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Read data from the file.
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
    cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Core**: Read data from the file.
  # @param [BrowserFS.node.Buffer] buffer The buffer that the data will be
  #   written to.
  # @param [Number] offset The offset within the buffer where writing will
  #   start.
  # @param [Number] length An integer specifying the number of bytes to read.
  # @param [Number] position An integer specifying where to begin reading from
  #   in the file. If position is null, data will be read from the current file
  #   position.
  # @return [[Buffer,Number]]
  readSync: (buffer, offset, length, position)->
    throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Supplementary**: Asynchronous `datasync`.
  #
  # Default implementation maps to `sync`.
  # @param [Function(BrowserFS.ApiError)] cb
  datasync: (cb) -> @sync(cb)
  # **Supplementary**: Synchronous `datasync`.
  #
  # Default implementation maps to `syncSync`.
  datasyncSync: -> @syncSync()
  # **Optional**: Asynchronous `chown`.
  # @param [Number] uid
  # @param [Number] gid
  # @param [Function(BrowserFS.ApiError)] cb
  chown: (uid, gid, cb) -> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Optional**: Synchronous `chown`.
  # @param [Number] uid
  # @param [Number] gid
  chownSync: (uid, gid) -> throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Optional**: Asynchronous `fchmod`.
  # @param [Number] mode
  # @param [Function(BrowserFS.ApiError)] cb
  chmod: (mode, cb) -> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Optional**: Synchronous `fchmod`.
  # @param [Number] mode
  chmodSync: (mode) -> throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Optional**: Change the file timestamps of the file.
  # @param [Date] atime
  # @param [Date] mtime
  # @param [Function(BrowserFS.ApiError)] cb
  utimes: (atime, mtime, cb) -> cb new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
  # **Optional**: Change the file timestamps of the file.
  # @param [Date] atime
  # @param [Date] mtime
  utimesSync: (atime, mtime) -> throw new BrowserFS.ApiError BrowserFS.ApiError.NOT_SUPPORTED
