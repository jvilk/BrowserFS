# Contains string utility functions, mainly for converting between JavaScript
# strings and binary byte arrays of arbitrary encoding types.
# TODO: Put encoding enum here.
BrowserFS.StringUtil = {}
# Find the 'utility' object for the given string encoding. Throws an exception
# if the encoding is invalid.
# @param [String] a string encoding
# @return [Object] the StringUtil object for the given encoding.
BrowserFS.StringUtil.FindUtil = (encoding) ->
  encoding = switch typeof encoding
    when 'object' then "#{encoding}" # Calls toString on any object (Node does this)
    when 'string' then encoding      # No transformation needed.
    else throw new Error 'Invalid encoding argument specified'

  encoding = encoding.toLowerCase()
  # This is the same logic in Node's source code.
  return switch encoding
      when 'utf8', 'utf-8' then BrowserFS.StringUtil.UTF8
      # TODO: How is binary different from ascii?
      when 'ascii', 'binary' then BrowserFS.StringUtil.ASCII
      when 'ucs2', 'ucs-2', 'utf16le', 'utf-16le' then BrowserFS.StringUtil.UCS2
      when 'hex' then BrowserFS.StringUtil.HEX
      when 'base64' then BrowserFS.StringUtil.BASE64
      #when 'binary', 'raw', 'raws' then BINARY
      #when 'buffer' then BUFFER
      #else UTF8
      else throw new Error "Unknown encoding: #{encoding}"
BrowserFS.StringUtil.UTF8 =
  # Converts a JavaScript string into an array of unsigned bytes representing a
  # UTF-8 string.
  # We assume that the offset / length is pre-validated.
  # @param [BrowserFS.node.Buffer] the buffer to write into
  # @param [String] the string that will be converted
  # @param [Number] the offset to start writing into the buffer at
  # @param [Number] an upper bound on the length of the string that we can write
  # @return [Number] number of bytes written into the buffer
  str2byte: (buf, str, offset, length) ->
    i = 0
    j = offset
    maxJ = offset+length
    rv = []
    numChars = 0
    while i < str.length and j < maxJ
      code = str.charCodeAt i++
      next = str.charCodeAt i
      if 0xD800 <= code && code <= 0xDBFF && 0xDC00 <= next && next <= 0xDFFF
        # 4 bytes: Surrogate pairs! UTF-16 fun time.
        if j+3 >= maxJ then break else numChars++
        # First pair: 10 bits of data, with an implicitly set 11th bit
        # Second pair: 10 bits of data
        codePoint = ((((code&0x3FF)|0x400)<<10)|(next&0x3FF))
        # Highest 3 bits in first byte
        buf.writeUInt8 (codePoint>>18)|0xF0, j++
        # Rest are all 6 bits
        buf.writeUInt8 ((codePoint>>12)&0x3F)|0x80, j++
        buf.writeUInt8 ((codePoint>>6)&0x3F)|0x80, j++
        buf.writeUInt8 (codePoint&0x3F)|0x80, j++
        i++
      else if code < 0x80
        # One byte
        buf.writeUInt8 code, j++
        numChars++
      else if code < 0x800
        # Two bytes
        if j+1 >= maxJ then break else numChars++
        # Highest 5 bits in first byte
        buf.writeUInt8 (code >> 6)|0xC0, j++
        # Lower 6 bits in second byte
        buf.writeUInt8 (code & 0x3F)|0x80, j++
      else if code < 0x10000
        # Three bytes
        if j+2 >= maxJ then break else numChars++
        # Highest 4 bits in first byte
        buf.writeUInt8 (code>>12)|0xE0, j++
        # Middle 6 bits in second byte
        buf.writeUInt8 ((code>>6)&0x3F)|0x80, j++
        # Lowest 6 bits in third byte
        buf.writeUInt8 (code&0x3F)|0x80, j++
    buf._charsWritten = numChars
    return j-offset

  # Converts a byte array, in UTF8 format, into a JavaScript string.
  # @param [Array] an array of bytes
  # @return [String] the array interpreted as a UTF8 format string
  byte2str: (byteArray) ->
    chars = []
    i = 0
    while i < byteArray.length
      code = byteArray[i++]
      if code < 0x80
        chars.push String.fromCharCode code
      else if code < 0xC0
        # This is the second byte of a multibyte character. This shouldn't be
        # possible.
        throw new Error 'Found incomplete part of character in string.'
      else if code < 0xE0
        # 2 bytes: 5 and 6 bits
        chars.push String.fromCharCode ((code&0x1F)<<6)|(byteArray[i++]&0x3F)
      else if code < 0xF0
        # 3 bytes: 4, 6, and 6 bits
        chars.push String.fromCharCode ((code&0xF)<<12)|((byteArray[i++]&0x3F)<<6)|(byteArray[i++]&0x3F)
      else if code < 0xF8
        # 4 bytes: 3, 6, 6, 6 bits; surrogate pairs time!
        # First 11 bits; remove 11th bit as per UTF-16 standard
        byte3 = byteArray[i+2]
        chars.push String.fromCharCode ((((code&0x7)<<8)|((byteArray[i++]&0x3F)<<2)|((byteArray[i++]&0x3F)>>4))&0x3FF)|0xD800
        # Final 10 bits
        chars.push String.fromCharCode (((byte3&0xF)<<6)|(byteArray[i++]&0x3F))|0xDC00
      else
        throw new Error 'Unable to represent UTF-8 string as UTF-16 JavaScript string.'
    return chars.join ''

  # Returns the number of bytes that the string will take up using the given
  # encoding.
  # @param [String] the string to get the byte length for
  # @return [Number] the number of bytes that the string will take up using the
  # given encoding.
  byteLength: (str) ->
    # Credit: http://stackoverflow.com/questions/5515869/string-length-in-bytes-in-javascript
    # Matches only the 10.. bytes that are non-initial characters in a
    # multi-byte sequence.
    m = encodeURIComponent(str).match(/%[89ABab]/g)
    return str.length + (if m then m.length else 0)

BrowserFS.StringUtil.ASCII =
  # Converts a JavaScript string into an array of unsigned bytes representing an
  # ASCII string.
  # We assume that the offset / length is pre-validated.
  # @param [BrowserFS.node.Buffer] the buffer to write into
  # @param [String] the string that will be converted
  # @param [Number] the offset to start writing into the buffer at
  # @param [Number] an upper bound on the length of the string that we can write
  # @return [Number] number of bytes written into the buffer
  str2byte: (buf, str, offset, length) ->
    length = if str.length > length then length else str.length
    for i in [0...length]
      buf.writeUInt8 str.charCodeAt(i) % 256, offset+i
    buf._charsWritten = length
    return length

  # Converts a byte array, in ASCII format, into a JavaScript string.
  # @param [Array] an array of bytes
  # @return [String] the array interpreted as a ASCII format string
  byte2str: (byteArray) ->
    chars = new Array byteArray.length
    for i in [0...byteArray.length]
      chars[i] = String.fromCharCode(byteArray[i]&0x7F)
    return chars.join ''

  # Returns the number of bytes that the string will take up using the given
  # encoding.
  # @param [String] the string to get the byte length for
  # @return [Number] the number of bytes that the string will take up using the
  # given encoding.
  byteLength: (str) -> return str.length

# Adapted from: http://stackoverflow.com/questions/246801/how-can-you-encode-to-base64-using-javascript#246813
# TODO: Bake in support for btoa() and atob() if available.
BrowserFS.StringUtil.BASE64 =
  num2b64: ( ->
      obj = {}
      for i,idx in ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
                    'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
                    '0','1','2','3','4','5','6','7','8','9','+','/','=']
        obj[idx] = i
      return obj
    )()
  b642num: ( ->
      obj = {}
      for i, idx in ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
                    'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
                    '0','1','2','3','4','5','6','7','8','9','+','/','=']
        obj[i] = idx
      # Special: Node supports - and _ values for input
      obj['-'] = 62
      obj['_'] = 63
      return obj
    )()

  # Converts a byte array into a BASE64 JavaScript string.
  # @param [Array] an array of bytes
  # @return [String] the array interpreted as a BASE64 format string
  byte2str: (byteArray) ->
    output = ''
    i = 0
    while i < byteArray.length
      chr1 = byteArray[i++]
      chr2 = byteArray[i++]
      chr3 = byteArray[i++]

      enc1 = chr1 >> 2
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4)
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6)
      enc4 = chr3 & 63

      if isNaN(chr2) then enc3 = enc4 = 64
      else if isNaN(chr3) then enc4 = 64

      output = output +
        BrowserFS.StringUtil.BASE64.num2b64[enc1] +
        BrowserFS.StringUtil.BASE64.num2b64[enc2] +
        BrowserFS.StringUtil.BASE64.num2b64[enc3] +
        BrowserFS.StringUtil.BASE64.num2b64[enc4]
    return output

  # Converts a JavaScript string into an array of unsigned bytes representing a
  # BASE64 string.
  # We assume that the offset / length is pre-validated.
  # @param [BrowserFS.node.Buffer] the buffer to write into
  # @param [String] the string that will be converted
  # @param [Number] the offset to start writing into the buffer at
  # @param [Number] an upper bound on the length of the string that we can write
  # @return [Number] number of bytes written into the buffer
  str2byte: (buf, str, offset, length) ->
    output = ''
    i = 0
    str = str.replace /[^A-Za-z0-9\+\/\=\-\_]/g, ''
    j = 0
    while i < str.length
      enc1 = BrowserFS.StringUtil.BASE64.b642num[str.charAt i++]
      enc2 = BrowserFS.StringUtil.BASE64.b642num[str.charAt i++]
      enc3 = BrowserFS.StringUtil.BASE64.b642num[str.charAt i++]
      enc4 = BrowserFS.StringUtil.BASE64.b642num[str.charAt i++]

      chr1 = (enc1 << 2) | (enc2 >> 4)
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2)
      chr3 = ((enc3 & 3) << 6) | enc4

      buf.writeUInt8 chr1, offset+j++
      if j == length then break

      if enc3 != 64 then output += buf.writeUInt8 chr2, offset+j++
      if j == length then break
      if enc4 != 64 then output += buf.writeUInt8 chr3, offset+j++
      if j == length then break
    # Conditional, since BASE64 can pad the end with extra characters.
    buf._charsWritten = if i > str.length then str.length else i
    return j

  # Returns the number of bytes that the string will take up using the given
  # encoding.
  # @param [String] the string to get the byte length for
  # @return [Number] the number of bytes that the string will take up using the
  # given encoding.
  byteLength: (str) -> Math.floor(((str.replace /[^A-Za-z0-9\+\/\-\_]/g, '').length * 6) / 8)

# Note: UCS2 handling is identical to UTF-16.
BrowserFS.StringUtil.UCS2 =
  # Converts a JavaScript string into an array of unsigned bytes representing a
  # UCS2 string.
  # We assume that the offset / length is pre-validated.
  # @param [BrowserFS.node.Buffer] the buffer to write into
  # @param [String] the string that will be converted
  # @param [Number] the offset to start writing into the buffer at
  # @param [Number] an upper bound on the length of the string that we can write
  # @return [Number] number of bytes written into the buffer
  str2byte: (buf, str, offset, length) ->
    len = str.length
    # Clip length to longest string of valid characters that can fit in the
    # byte range.
    if len*2 > length
      len = if length % 2 is 1 then (length-1)/2 else length/2
    for i in [0...len]
      buf.writeUInt16LE str.charCodeAt(i), offset+i*2
    buf._charsWritten = len
    return len*2

  # Converts a byte array, in UCS2 format, into a JavaScript string.
  # @param [Array] an array of bytes
  # @return [String] the array interpreted as a UCS2 format string
  byte2str: (byteArray) ->
    if byteArray.length % 2 != 0 then throw new Error 'Invalid UCS2 byte array.'
    chars = new Array(byteArray.length/2)
    for i in [0...byteArray.length] by 2
      chars[i/2] = String.fromCharCode(byteArray[i] | (byteArray[i+1]<<8))
    return chars.join ''

  # Returns the number of bytes that the string will take up using the given
  # encoding.
  # @param [String] the string to get the byte length for
  # @return [Number] the number of bytes that the string will take up using the
  # given encoding.
  byteLength: (str) -> return str.length * 2

BrowserFS.StringUtil.HEX =
  # Lookup tables
  num2hex: ( ->
      obj = {}
      for i,idx in ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f']
        obj[idx] = i
      return obj
    )()
  hex2num: ( ->
      obj = {}
      for i, idx in ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f']
        obj[i] = idx
      # Support capital hex input, too.
      for i, idx in ['A','B','C','D','E','F']
        obj[i] = idx+10
      return obj
    )()

  # Converts a JavaScript string into an array of unsigned bytes representing a
  # HEX string. (ASCII string comprised of only 0-9+A-F characters)
  # We assume that the offset / length is pre-validated.
  # @param [BrowserFS.node.Buffer] the buffer to write into
  # @param [String] the string that will be converted
  # @param [Number] the offset to start writing into the buffer at
  # @param [Number] an upper bound on the length of the string that we can write
  # @return [Number] number of bytes written into the buffer
  str2byte: (buf, str, offset, length) ->
    if str.length % 2 is 1 then throw new Error 'Invalid hex string'
    # Each character is 1 byte encoded as two hex characters; so 1 byte becomes
    # 2 bytes.
    numBytes = str.length/2
    if numBytes > length then numBytes = length
    for i in [0...numBytes]
      char1 = BrowserFS.StringUtil.HEX.hex2num[str.charAt(2*i)]
      char2 = BrowserFS.StringUtil.HEX.hex2num[str.charAt(2*i+1)]
      buf.writeUInt8 (char1 << 4) | char2, offset+i
    buf._charsWritten = 2*numBytes
    return numBytes

  # Converts a byte array into a HEX string.
  # @param [Array] an array of bytes
  # @return [String] the array interpreted as a HEX format string
  byte2str: (byteArray) ->
    len = byteArray.length
    chars = new Array len*2
    j = 0
    for i in [0...len]
      hex2 = byteArray[i] & 0xF
      hex1 = byteArray[i] >> 4
      chars[j++] = BrowserFS.StringUtil.HEX.num2hex[hex1]
      chars[j++] = BrowserFS.StringUtil.HEX.num2hex[hex2]
    return chars.join ''

  # Returns the number of bytes that the string will take up using the given
  # encoding.
  # @param [String] the string to get the byte length for
  # @return [Number] the number of bytes that the string will take up using the
  # given encoding.
  byteLength: (str) -> return str.length/2
