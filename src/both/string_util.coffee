# Contains string utility functions, mainly for converting between JavaScript
# strings and binary byte arrays of arbitrary encoding types.
# TODO: Put encoding enum here.
BrowserFS.StringUtil = {}
BrowserFS.StringUtil.UTF8 =
  # Converts a JavaScript string into an array of unsigned bytes representing a
  # UTF-8 string.
  # @param [String] the string that will be converted
  # @return [Array] string as array of bytes, encoded in UTF-8
  str2byte: (str) ->
    i = 0
    rv = []
    while i < str.length
      code = str.charCodeAt i++
      next = str.charCodeAt i
      if 0xD800 <= code && code <= 0xDBFF && 0xDC00 <= next && next <= 0xDFFF
        # 4 bytes: Surrogate pairs! UTF-16 fun time.
        # First pair: 10 bits of data, with an implicitly set 11th bit
        # Second pair: 10 bits of data
        codePoint = ((((code&0x3FF)|0x400)<<10)|(next&0x3FF))
        # Highest 3 bits in first byte
        rv.push((codePoint>>18)|0xF0)
        # Rest are all 6 bits
        rv.push(((codePoint>>12)&0x3F)|0x80)
        rv.push(((codePoint>>6)&0x3F)|0x80)
        rv.push((codePoint&0x3F)|0x80)
        i++
      else if code < 0x80
        # One byte
        rv.push code
      else if code < 0x800
        # Two bytes
        # Highest 5 bits in first byte
        rv.push((code >> 6)|0xC0)
        # Lower 6 bits in second byte
        rv.push((code & 0x3F)|0x80)
      else if code < 0x10000
        # Three bytes
        # Highest 4 bits in first byte
        rv.push((code>>12)|0xE0)
        # Middle 6 bits in second byte
        rv.push(((code>>6)&0x3F)|0x80)
        # Lowest 6 bits in third byte
        rv.push((code&0x3F)|0x80)
    return rv

  # Converts a byte array, in UTF8 format, into a JavaScript string.
  # @param [Array] an array of bytes
  # @return [String] the array interpreted as a UTF8 format string
  byte2str: (byteArray) ->
    chars = []
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
        chars.push ((code&0x1F)<<6)|(byteArray[i++]&0x3F)
      else if code < 0xF0
        # 3 bytes: 4, 6, and 6 bits
        chars.push ((code&0xF)<<12)|((byteArray[i++]&0x3F)<<6)|(byteArray[i++]&0x3F)
      else if code < 0xF8
        # 4 bytes: 3, 6, 6, 6 bits; surrogate pairs time!
        # First 11 bits; remove 11th bit as per UTF-16 standard
        byte3 = byteArray[i+2]
        chars.push ((((code&0x7)<<8)|((byteArray[i++]&0x3F)<<2)|((byteArray[i++]&0x3F)>>4))&0x3FF)|0xD800
        # Final 10 bits
        chars.push (((byte3&0xF)<<6)|(byteArray[i++]&0x3F))|0xDC00
      else
        throw new Error 'Unable to represent UTF-8 string as UTF-16 JavaScript string.'
    return chars.join ''
