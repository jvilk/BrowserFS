# Emulation of Node's Buffer class. Normally, this is declared globally, but I
# make that behavior optional.
# Descriptions modified from http://nodejs.org/api/buffer.html
# Note that we do *not* support treating Buffer as an array; that would be
# infeasible (we would have to define a property on the object for each index in
# the buffer...).
# The buffer is backed by jDataView, which takes care of compatibility for us. :)
# Current limitations: We don't perfectly emulate when Node throws exceptions
# or not.
#
# NOTE: Buffer currently only supports encoding to/decoding from UTF-8.

# emulate ES5 getter/setter API using legacy APIs
# http://blogs.msdn.com/b/ie/archive/2010/09/07/transitioning-existing-code-to-the-es5-getter-setter-apis.aspx
if Object.prototype.__defineGetter__ and !Object.defineProperty
  Object.defineProperty = (obj, prop, desc) ->
    if desc.hasOwnProperty 'get' then obj.__defineGetter__ prop, desc.get
    if desc.hasOwnProperty 'set' then obj.__defineSetter__ prop, desc.set

# Converted from TypedArray polyfill:
# https://bitbucket.org/lindenlab/llsd/raw/7d2646cd3f9b4c806e73aebc4b32bd81e4047fdc/js/typedarray.js
# ES5: Make obj[index] an alias for obj.get(index)/obj.set(index, value)
# for index in 0 ... obj.length
makeArrayAccessors = (obj) ->
  unless Object.defineProperty then return

  makeArrayAccessor = (index) ->
    Object.defineProperty obj, index,
      'get': -> return obj.get index
      'set': (v) -> obj.set index, v
      enumerable: true
      configurable: false

  for i in [0...obj.length] by 1
    makeArrayAccessor i
  return

class BrowserFS.node.Buffer
  # Checks if enc is a valid string encoding type.
  # @param [String] Name of a string encoding type.
  # @return [Boolean] Whether or not enc is a valid encoding type.
  @isEncoding: (enc) ->
    try
      BrowserFS.StringUtil.FindUtil enc
    catch e
      return false
    return true
  # Tests if obj is a Buffer.
  # @param [Object] An arbitrary object
  # @return [Boolean] True if this object is a Buffer.
  @isBuffer: (obj) -> obj instanceof BrowserFS.node.Buffer
  # Gives the actual byte length of a string. This is not the same as
  # String.prototype.length since that returns the number of characters in a
  # string.
  # @param [String] The string to get the byte length of
  # @param [?String] Character encoding of the string
  # @return [Number] The number of bytes in the string
  @byteLength: (str, encoding='utf8') ->
    strUtil = BrowserFS.StringUtil.FindUtil encoding
    return strUtil.byteLength(str)
  # Returns a buffer which is the result of concatenating all the buffers in the
  # list together.
  # If the list has no items, or if the totalLength is 0, then it returns a
  # zero-length buffer.
  # If the list has exactly one item, then the first item of the list is
  # returned.
  # If the list has more than one item, then a new Buffer is created.
  # If totalLength is not provided, it is read from the buffers in the list.
  # However, this adds an additional loop to the function, so it is faster to
  # provide the length explicitly.
  # @param [Array] List of Buffer objects to concat
  # @param [?Number] Total length of the buffers when concatenated
  # @return [BrowserFS.node.Buffer]
  @concat: (list, totalLength) ->
    if list.length == 0 or totalLength == 0
      return new BrowserFS.node.Buffer 0
    else if list.length == 1
      return list[0]
    else
      unless totalLength?
        # Calculate totalLength
        totalLength = 0
        for item in list
          totalLength += item.length
      buf = new BrowserFS.node.Buffer totalLength
      curPos = 0
      for item in list
        curPos += item.copy buf, curPos
      return buf

  # Constructs a buffer.
  # @param [Number,Array,String] Instantiate a buffer of the indicated size, or
  #                              from the indicated Array or String.
  # @param [?String] Encoding to use if arg1 is a string
  constructor: (arg1, arg2='utf8') ->
    # Node apparently allows you to construct buffers w/o 'new'.
    if @ is undefined then return new BrowserFS.node.Buffer arg1, arg2
    @_charsWritten = 0
    if typeof arg1 is 'number'
      if arg1 != (arg1>>>0) then throw new TypeError 'Buffer size must be a uint32.'
      @length = arg1
      @buff = new DataView new ArrayBuffer(@length)
    else if arg1 instanceof DataView
      @buff = arg1
      @length = arg1.byteLength
    else if Array.isArray(arg1) or arg1 instanceof BrowserFS.node.Buffer or (arg1[0]? and typeof arg1[0] is 'number')
      @buff = new DataView new ArrayBuffer(arg1.length)
      for datum, i in arg1 by 1
        @buff.setUint8 i, datum
      @length = arg1.length
    else if typeof arg1 is 'string'
      @length = BrowserFS.node.Buffer.byteLength arg1, arg2
      @buff = new DataView new ArrayBuffer(@length)
      rv = @write arg1, 0, @length, arg2
    else
      throw new Error "Invalid argument to Buffer constructor: #{arg1}"
    # XXX: If this is a performance drain, make it optional.
    # Defines properties [0...obj.length] on the buffer so it can be used as an
    # array. Inspired by the TypedArray polyfill.
    makeArrayAccessors @

  # NONSTANDARD
  # Set the octet at index. The values refer to individual bytes, so the
  # legal range is between 0x00 and 0xFF hex or 0 and 255.
  # @param [Number] the index to set the value at
  # @param [Number] the value to set at the given index
  set: (index, value) -> @buff.setUint8 index, value
  # NONSTANDARD
  # Get the octet at index.
  # @param [Number] index to fetch the value at
  # @return [Number] the value at the given index
  get: (index) -> @buff.getUint8 index

  # Writes string to the buffer at offset using the given encoding.
  # If buffer did not contain enough space to fit the entire string, it will
  # write a partial amount of the string.
  # @param [String] Data to be written to buffer
  # @param [?Number] Offset in the buffer to write to
  # @param [?Number] Number of bytes to write
  # @param [?String] Character encoding
  # @return [Number] Number of octets written.
  write: (str, offset=0, length=@length, encoding='utf8') ->
    # I hate Node's optional arguments.
    # 'str' and 'encoding' specified
    if typeof offset is 'string'
      encoding = offset
      offset = 0
      length = @length
    # 'str', 'offset', and 'encoding' specified
    else if typeof length is 'string'
      # Ensure length isn't a number in string form.
      encoding = length
      length = @length

    # Don't waste our time if the offset is beyond the buffer length
    if offset >= @length then return 0
    strUtil = BrowserFS.StringUtil.FindUtil encoding
    # Are we trying to write past the buffer?
    length = if length+offset > @length then @length - offset else length
    # str2byte will update @_charsWritten.
    return strUtil.str2byte(@, str, offset, length)

  # Decodes a portion of the Buffer into a String.
  # @param [?String] Character encoding to decode to
  # @param [?Number] Start position in the buffer
  # @param [?Number] Ending position in the buffer
  # @return [String] A string from buffer data encoded with encoding, beginning
  # at start, and ending at end.
  toString: (encoding='utf8', start=0, end=@length) ->
    # Create a byte array of the needed characters.
    throw new Error "Invalid start/end positions: #{start} - #{end}" unless start <= end
    if start is end then return ''
    if end > @length then end = @length
    strUtil = BrowserFS.StringUtil.FindUtil encoding
    len = end-start
    byteArr = new Array(len)
    for i in [0...len] by 1
      byteArr[i] = @readUInt8 start+i
    return strUtil.byte2str(byteArr)

  # Returns a JSON-representation of the Buffer instance, which is identical to
  # the output for JSON Arrays. JSON.stringify implicitly calls this function
  # when stringifying a Buffer instance.
  toJSON: () ->
    # Welp, this will be unexpectedly expensive.
    arr = new Array @length
    for i in [0...@length] by 1
      arr[i] = @buff.getUint8 i
    return {type:'Buffer',data:arr}

  # Does copy between buffers. The source and target regions can be overlapped.
  # All values passed that are undefined/NaN or are out of bounds are set equal
  # to their respective defaults.
  # @param [BrowserFS.node.Buffer] Buffer to copy into
  # @param [?Number] Index to start copying to in the targetBuffer
  # @param [?Number] Index in this buffer to start copying from
  # @param [?Number] Index in this buffer stop copying at
  copy: (target, targetStart=0, sourceStart=0, sourceEnd=@length) ->
    # The Node code is weird. It sets some out-of-bounds args to their defaults
    # and throws exceptions for others (sourceEnd).
    targetStart = if targetStart < 0 then 0 else targetStart
    sourceStart = if sourceStart < 0 then 0 else sourceStart

    # Need to sanity check all of the input. Node has really odd rules regarding
    # when to apply default arguments. I decided to copy Node's logic.
    if sourceEnd < sourceStart then throw new RangeError 'sourceEnd < sourceStart'
    if sourceEnd == sourceStart then return 0
    if targetStart >= target.length then throw new RangeError 'targetStart out of bounds'
    if sourceStart >= @length then throw new RangeError 'sourceStart out of bounds'
    if sourceEnd > @length then throw new RangeError 'sourceEnd out of bounds'

    bytesCopied = Math.min(sourceEnd - sourceStart, target.length - targetStart, @length - sourceStart)
    for i in [0...bytesCopied]
      target.writeUInt8 @readUInt8(sourceStart+i), targetStart+i
    return bytesCopied

  # Returns a slice of this buffer.
  # @param [?Number] Index to start slicing from
  # @param [?Number] Index to stop slicing at
  # @return [BrowserFS.node.Buffer] A new buffer which references the same
  # memory as the old, but offset and cropped by the start (defaults to 0) and
  # end (defaults to buffer.length) indexes. Negative indexes start from the end
  # of the buffer.
  slice: (start=0, end=@length) ->
    # Translate negative indices to positive ones.
    if start < 0
      start += @length
      start = 0 if start < 0
    if end < 0
      end += @length
      end = 0 if end < 0

    if end > @length then end = @length
    if start > end then start = end
    # Sanity check.
    if start < 0 or end < 0 or start >= @length or end > @length
      throw new Error "Invalid slice indices."
    new BrowserFS.node.Buffer new DataView(@buff.buffer, @buff.byteOffset+start, end-start)

  # Fills the buffer with the specified value. If the offset and end are not
  # given it will fill the entire buffer.
  # @param [?] The value to fill the buffer with
  # @param [Number] Optional
  # @param [Number] Optional
  fill: (value, offset=0, end=@length) ->
    valType = typeof value
    switch valType
      when "string"
        value = value.charCodeAt(0)
      when "number"
      else throw new Error 'Invalid argument to fill.'
    for i in [offset...end]
      @writeUInt8 value, i
    return

  # Numerical read/write methods
  # TODO: Actually care about noAssert.
  readUInt8: (offset, noAssert=false) -> @buff.getUint8 offset
  readUInt16LE: (offset, noAssert=false) -> @buff.getUint16 offset, true
  readUInt16BE: (offset, noAssert=false) -> @buff.getUint16 offset, false
  readUInt32LE: (offset, noAssert=false) -> @buff.getUint32 offset, true
  readUInt32BE: (offset, noAssert=false) -> @buff.getUint32 offset, false
  readInt8: (offset, noAssert=false) -> @buff.getInt8 offset
  readInt16LE: (offset, noAssert=false) -> @buff.getInt16 offset, true
  readInt16BE: (offset, noAssert=false) -> @buff.getInt16 offset, false
  readInt32LE: (offset, noAssert=false) -> @buff.getInt32 offset, true
  readInt32BE: (offset, noAssert=false) -> @buff.getInt32 offset, false
  readFloatLE: (offset, noAssert=false) -> @buff.getFloat32 offset, true
  readFloatBE: (offset, noAssert=false) -> @buff.getFloat32 offset, false
  readDoubleLE: (offset, noAssert=false) -> @buff.getFloat64 offset, true
  readDoubleBE: (offset, noAssert=false) -> @buff.getFloat64 offset, false
  writeUInt8: (value, offset, noAssert=false) -> @buff.setUint8 offset, value
  writeUInt16LE: (value, offset, noAssert=false) -> @buff.setUint16 offset, value, true
  writeUInt16BE: (value, offset, noAssert=false) -> @buff.setUint16 offset, value, false
  writeUInt32LE: (value, offset, noAssert=false) -> @buff.setUint32 offset, value, true
  writeUInt32BE: (value, offset, noAssert=false) -> @buff.setUint32 offset, value, false
  writeInt8: (value, offset, noAssert=false) -> @buff.setInt8 offset, value
  writeInt16LE: (value, offset, noAssert=false) -> @buff.setInt16 offset, value, true
  writeInt16BE: (value, offset, noAssert=false) -> @buff.setInt16 offset, value, false
  writeInt32LE: (value, offset, noAssert=false) -> @buff.setInt32 offset, value, true
  writeInt32BE: (value, offset, noAssert=false) -> @buff.setInt32 offset, value, false
  writeFloatLE: (value, offset, noAssert=false) -> @buff.setFloat32 offset, value, true
  writeFloatBE: (value, offset, noAssert=false) -> @buff.setFloat32 offset, value, false
  writeDoubleLE: (value, offset, noAssert=false) -> @buff.setFloat64 offset, value, true
  writeDoubleBE: (value, offset, noAssert=false) -> @buff.setFloat64 offset, value, false
