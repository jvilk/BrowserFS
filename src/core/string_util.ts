import buffer = require("./buffer");
/**
 * Contains string utility functions, mainly for converting between JavaScript
 * strings and binary buffers of arbitrary encoding types.
 */

/**
 * Encapsulates utility functions for a particular string encoding.
 */
export interface StringUtil {
  /**
   * Converts the string into its binary representation, and then writes the
   * binary representation into the buffer at the given offset.
   *
   * We assume that the offset / length is pre-validated.
   * @param [BrowserFS.node.Buffer] buf the buffer to write into
   * @param [String] str the string that will be converted
   * @param [Number] offset the offset to start writing into the buffer at
   * @param [Number] length an upper bound on the length of the string that we
   *   can write
   * @return [Number] number of bytes written into the buffer
   */
  str2byte(buf: buffer.Buffer, str: string, offset: number, length: number): number;
  /**
   * Converts the data in the byte array into a string.
   * @todo Is this the best API? Are we doing needless copying?
   * @param [Array] byteArray an array of bytes
   * @return [String] the array interpreted as a binary string
   */
  byte2str(byteArray: number[]): string;
  /**
   * Returns the number of bytes that the string will take up using the given
   * encoding.
   * @param [String] str the string to get the byte length for
   * @return [Number] the number of bytes that the string will take up using the
   * given encoding.
   */
  byteLength(str: string): number;
}

/**
 * Find the 'utility' object for the given string encoding. Throws an exception
 * if the encoding is invalid.
 * @param [String] encoding a string encoding
 * @return [BrowserFS.StringUtil.*] The StringUtil object for the given encoding
 */
export function FindUtil(encoding: string): StringUtil {
  encoding = (function() {
    switch (typeof encoding) {
      case 'object':
        return "" + encoding; // Implicitly calls toString on any object (Node does this)
      case 'string':
        return encoding; // No transformation needed.
      default:
        throw new Error('Invalid encoding argument specified');
    }
  })();
  encoding = encoding.toLowerCase();
  // This is the same logic as Node's source code.
  switch (encoding) {
    case 'utf8':
    case 'utf-8':
      return UTF8;
    case 'ascii':
    case 'binary':
      // @todo How is binary different from ascii?
      return ASCII;
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return UCS2;
    case 'hex':
      return HEX;
    case 'base64':
      return BASE64;
    // Custom BFS: For efficiently representing data as JavaScript UTF-16
    // strings.
    case 'binary_string':
      return BINSTR;
    case 'binary_string_ie':
      return BINSTRIE;
    /**
    @todo: Support the below encodings.
    case 'binary':
    case 'raw':
    case 'raws':
      return BINARY;
    case 'buffer':
      return BUFFER;
    default:
      return UTF8;
    */
    default:
      // Node defaults to UTF8, but I put this here in case something
      // significant uses an unsupported encoding; I don't want silent
      // failures.
      throw new Error("Unknown encoding: " + encoding);
  }
}

/**
 * String utility functions for UTF-8. Note that some UTF-8 strings *cannot* be
 * expressed in terms of JavaScript UTF-16 strings.
 * @see http://en.wikipedia.org/wiki/UTF-8
 */
export class UTF8 implements StringUtil {
  public static str2byte(buf: buffer.Buffer, str: string, offset: number, length: number): number {
    var i = 0;
    var j = offset;
    var maxJ = offset + length;
    var rv = [];
    var numChars = 0;
    while (i < str.length && j < maxJ) {
      var code = str.charCodeAt(i++);
      var next = str.charCodeAt(i);
      if (0xD800 <= code && code <= 0xDBFF && 0xDC00 <= next && next <= 0xDFFF) {
        // 4 bytes: Surrogate pairs! UTF-16 fun time.
        if (j + 3 >= maxJ) {
          break;
        } else {
          numChars++;
        }
        // First pair: 10 bits of data, with an implicitly set 11th bit
        // Second pair: 10 bits of data
        var codePoint = (((code & 0x3FF) | 0x400) << 10) | (next & 0x3FF);
        // Highest 3 bits in first byte
        buf.writeUInt8((codePoint >> 18) | 0xF0, j++);
        // Rest are all 6 bits
        buf.writeUInt8(((codePoint >> 12) & 0x3F) | 0x80, j++);
        buf.writeUInt8(((codePoint >> 6) & 0x3F) | 0x80, j++);
        buf.writeUInt8((codePoint & 0x3F) | 0x80, j++);
        i++;
      } else if (code < 0x80) {
        // One byte
        buf.writeUInt8(code, j++);
        numChars++;
      } else if (code < 0x800) {
        // Two bytes
        if (j + 1 >= maxJ) {
          break;
        } else {
          numChars++;
        }
        // Highest 5 bits in first byte
        buf.writeUInt8((code >> 6) | 0xC0, j++);
        // Lower 6 bits in second byte
        buf.writeUInt8((code & 0x3F) | 0x80, j++);
      } else if (code < 0x10000) {
        // Three bytes
        if (j + 2 >= maxJ) {
          break;
        } else {
          numChars++;
        }
        // Highest 4 bits in first byte
        buf.writeUInt8((code >> 12) | 0xE0, j++);
        // Middle 6 bits in second byte
        buf.writeUInt8(((code >> 6) & 0x3F) | 0x80, j++);
        // Lowest 6 bits in third byte
        buf.writeUInt8((code & 0x3F) | 0x80, j++);
      }
    }
    buf._charsWritten = numChars;
    return j - offset;
  }

  public static byte2str(byteArray: number[]): string {
    var chars = [];
    var i = 0;
    while (i < byteArray.length) {
      var code = byteArray[i++];
      if (code < 0x80) {
        chars.push(String.fromCharCode(code));
      } else if (code < 0xC0) {
        // This is the second byte of a multibyte character. This shouldn't be
        // possible.
        throw new Error('Found incomplete part of character in string.');
      } else if (code < 0xE0) {
        // 2 bytes: 5 and 6 bits
        chars.push(String.fromCharCode(((code & 0x1F) << 6) | (byteArray[i++] & 0x3F)));
      } else if (code < 0xF0) {
        // 3 bytes: 4, 6, and 6 bits
        chars.push(String.fromCharCode(((code & 0xF) << 12) | ((byteArray[i++] & 0x3F) << 6) | (byteArray[i++] & 0x3F)));
      } else if (code < 0xF8) {
        // 4 bytes: 3, 6, 6, 6 bits; surrogate pairs time!
        // First 11 bits; remove 11th bit as per UTF-16 standard
        var byte3 = byteArray[i + 2];
        chars.push(String.fromCharCode(((((code & 0x7) << 8) | ((byteArray[i++] & 0x3F) << 2) | ((byteArray[i++] & 0x3F) >> 4)) & 0x3FF) | 0xD800));
        // Final 10 bits
        chars.push(String.fromCharCode((((byte3 & 0xF) << 6) | (byteArray[i++] & 0x3F)) | 0xDC00));
      } else {
        throw new Error('Unable to represent UTF-8 string as UTF-16 JavaScript string.');
      }
    }
    return chars.join('');
  }

  public static byteLength(str: string): number {
    // Matches only the 10.. bytes that are non-initial characters in a
    // multi-byte sequence.
    // @todo This may be slower than iterating through the string in some cases.
    var m = encodeURIComponent(str).match(/%[89ABab]/g);
    return str.length + (m ? m.length : 0);
  }
}

/**
 * String utility functions for 8-bit ASCII. Like Node, we mask the high bits of
 * characters in JavaScript UTF-16 strings.
 * @see http://en.wikipedia.org/wiki/ASCII
 */
export class ASCII implements StringUtil {
  public static str2byte(buf: buffer.Buffer, str: string, offset: number, length: number): number {
    length = str.length > length ? length : str.length;
    for (var i = 0; i < length; i++) {
      buf.writeUInt8(str.charCodeAt(i) % 256, offset + i);
    }
    buf._charsWritten = length;
    return length;
  }

  public static byte2str(byteArray: number[]): string {
    var chars = new Array(byteArray.length);
    for (var i = 0; i < byteArray.length; i++) {
      chars[i] = String.fromCharCode(byteArray[i] & 0x7F);
    }
    return chars.join('');
  }

  public static byteLength(str: string): number {
    return str.length;
  }
}

/**
 * Contains string utility functions for base-64 encoding.
 *
 * Adapted from the StackOverflow comment linked below.
 * @see http://stackoverflow.com/questions/246801/how-can-you-encode-to-base64-using-javascript#246813
 * @see http://en.wikipedia.org/wiki/Base64
 * @todo Bake in support for btoa() and atob() if available.
 */
export class BASE64 implements StringUtil {
  private static b64chars = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '/', '='];
  private static num2b64: string[] = (function() {
    var obj = new Array(BASE64.b64chars.length);
    for (var idx = 0; idx < BASE64.b64chars.length; idx++) {
      var i = BASE64.b64chars[idx];
      obj[idx] = i;
    }
    return obj;
  })();

  private static b642num: {[chr: string]: number} = (function() {
    var obj = {};
    for (var idx = 0; idx < BASE64.b64chars.length; idx++) {
      var i = BASE64.b64chars[idx];
      obj[i] = idx;
    }
    obj['-'] = 62;
    obj['_'] = 63;
    return obj;
  })();

  public static byte2str(byteArray: number[]): string {
    var output = '';
    var i = 0;
    while (i < byteArray.length) {
      var chr1 = byteArray[i++];
      var chr2 = byteArray[i++];
      var chr3 = byteArray[i++];
      var enc1 = chr1 >> 2;
      var enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      var enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      var enc4 = chr3 & 63;
      if (isNaN(chr2)) {
        enc3 = enc4 = 64;
      } else if (isNaN(chr3)) {
        enc4 = 64;
      }
      output = output + BASE64.num2b64[enc1] + BASE64.num2b64[enc2] + BASE64.num2b64[enc3] + BASE64.num2b64[enc4];
    }
    return output;
  }

  public static str2byte(buf: buffer.Buffer, str: string, offset: number, length: number): number {
    var output = '';
    var i = 0;
    str = str.replace(/[^A-Za-z0-9\+\/\=\-\_]/g, '');
    var j = 0;
    while (i < str.length) {
      var enc1 = BASE64.b642num[str.charAt(i++)];
      var enc2 = BASE64.b642num[str.charAt(i++)];
      var enc3 = BASE64.b642num[str.charAt(i++)];
      var enc4 = BASE64.b642num[str.charAt(i++)];
      var chr1 = (enc1 << 2) | (enc2 >> 4);
      var chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      var chr3 = ((enc3 & 3) << 6) | enc4;
      buf.writeUInt8(chr1, offset + j++);
      if (j === length) {
        break;
      }
      if (enc3 !== 64) {
        output += buf.writeUInt8(chr2, offset + j++);
      }
      if (j === length) {
        break;
      }
      if (enc4 !== 64) {
        output += buf.writeUInt8(chr3, offset + j++);
      }
      if (j === length) {
        break;
      }
    }
    // Conditional, since BASE64 can pad the end with extra characters.
    buf._charsWritten = i > str.length ? str.length : i;
    return j;
  }

  public static byteLength(str: string): number {
    return Math.floor(((str.replace(/[^A-Za-z0-9\+\/\-\_]/g, '')).length * 6) / 8);
  }
}

/**
 * String utility functions for the UCS-2 encoding. Note that our UCS-2 handling
 * is identical to our UTF-16 handling.
 *
 * Note: UCS-2 handling is identical to UTF-16.
 * @see http://en.wikipedia.org/wiki/UCS2
 */
export class UCS2 implements StringUtil {
  public static str2byte(buf: buffer.Buffer, str: string, offset: number, length: number): number {
    var len = str.length;
    // Clip length to longest string of valid characters that can fit in the
    // byte range.
    if (len * 2 > length) {
      len = length % 2 === 1 ? (length - 1) / 2 : length / 2;
    }
    for (var i = 0; i < len; i++) {
      buf.writeUInt16LE(str.charCodeAt(i), offset + i * 2);
    }
    buf._charsWritten = len;
    return len * 2;
  }

  public static byte2str(byteArray: number[]): string {
    if (byteArray.length % 2 !== 0) {
      throw new Error('Invalid UCS2 byte array.');
    }
    var chars = new Array(byteArray.length / 2);
    for (var i = 0; i < byteArray.length; i += 2) {
      chars[i / 2] = String.fromCharCode(byteArray[i] | (byteArray[i + 1] << 8));
    }
    return chars.join('');
  }

  public static byteLength(str: string): number {
    return str.length * 2;
  }
}

/**
 * Contains string utility functions for hex encoding.
 * @see http://en.wikipedia.org/wiki/Hexadecimal
 */
export class HEX implements StringUtil {
  private static HEXCHARS = '0123456789abcdef';

  private static num2hex: string[] = (function() {
    var obj = new Array(HEX.HEXCHARS.length);
    for (var idx = 0; idx < HEX.HEXCHARS.length; idx++) {
      var i = HEX.HEXCHARS[idx];
      obj[idx] = i;
    }
    return obj;
  })();

  private static hex2num: {[chr: string]: number} = (function() {
    var idx, i;
    var obj = {};
    for (idx = 0; idx < HEX.HEXCHARS.length; idx++) {
      i = HEX.HEXCHARS[idx];
      obj[i] = idx;
    }
    var capitals = 'ABCDEF';
    for (idx = 0; idx < capitals.length; idx++) {
      i = capitals[idx];
      obj[i] = idx + 10;
    }
    return obj;
  })();

  public static str2byte(buf: buffer.Buffer, str: string, offset: number, length: number): number {
    if (str.length % 2 === 1) {
      throw new Error('Invalid hex string');
    }
    // Each character is 1 byte encoded as two hex characters; so 1 byte becomes
    // 2 bytes.
    var numBytes = str.length / 2;
    if (numBytes > length) {
      numBytes = length;
    }
    for (var i = 0; i < numBytes; i++) {
      var char1 = this.hex2num[str.charAt(2 * i)];
      var char2 = this.hex2num[str.charAt(2 * i + 1)];
      buf.writeUInt8((char1 << 4) | char2, offset + i);
    }
    buf._charsWritten = 2 * numBytes;
    return numBytes;
  }

  public static byte2str(byteArray: number[]): string {
    var len = byteArray.length;
    var chars = new Array(len * 2);
    var j = 0;
    for (var i = 0; i < len; i++) {
      var hex2 = byteArray[i] & 0xF;
      var hex1 = byteArray[i] >> 4;
      chars[j++] = this.num2hex[hex1];
      chars[j++] = this.num2hex[hex2];
    }
    return chars.join('');
  }

  public static byteLength(str: string): number {
    return str.length / 2;
  }
}

/**
 * Contains string utility functions for binary string encoding. This is where we
 * pack arbitrary binary data as a UTF-16 string.
 *
 * Each character in the string is two bytes. The first character in the string
 * is special: The first byte specifies if the binary data is of odd byte length.
 * If it is, then it is a 1 and the second byte is the first byte of data; if
 * not, it is a 0 and the second byte is 0.
 *
 * Everything is little endian.
 */
export class BINSTR implements StringUtil {
  public static str2byte(buf: buffer.Buffer, str: string, offset: number, length: number): number {
    // Special case: Empty string
    if (str.length === 0) {
      buf._charsWritten = 0;
      return 0;
    }
    var numBytes = BINSTR.byteLength(str);
    if (numBytes > length) {
      numBytes = length;
    }
    var j = 0;
    var startByte = offset;
    var endByte = startByte + numBytes;
    // Handle first character separately
    var firstChar = str.charCodeAt(j++);
    if (firstChar !== 0) {
      buf.writeUInt8(firstChar & 0xFF, offset);
      startByte = offset + 1;
    }
    for (var i = startByte; i < endByte; i += 2) {
      var chr = str.charCodeAt(j++);
      if (endByte - i === 1) {
        // Write first byte of character
        buf.writeUInt8(chr >> 8, i);
      }
      if (endByte - i >= 2) {
        // Write both bytes in character
        buf.writeUInt16BE(chr, i);
      }
    }
    buf._charsWritten = Math.floor(numBytes / 2) + 1;
    return numBytes;
  }

  public static byte2str(byteArray: number[]): string {
    var len = byteArray.length;
    // Special case: Empty string
    if (len === 0) {
      return '';
    }
    var chars = new Array(Math.floor(len / 2) + 1);
    var j = 0;
    for (var i = 0; i < chars.length; i++) {
      if (i === 0) {
        if (len % 2 === 1) {
          chars[i] = String.fromCharCode((1 << 8) | byteArray[j++]);
        } else {
          chars[i] = String.fromCharCode(0);
        }
      } else {
        chars[i] = String.fromCharCode((byteArray[j++] << 8) | byteArray[j++]);
      }
    }
    return chars.join('');
  }

  public static byteLength(str: string): number {
    if (str.length === 0) {
      // Special case: Empty string.
      return 0;
    }
    var firstChar = str.charCodeAt(0);
    var bytelen = (str.length - 1) * 2;
    if (firstChar !== 0) {
      bytelen++;
    }
    return bytelen;
  }
}

/**
 * IE/older FF version of binary string. One byte per character, offset by 0x20.
 */
export class BINSTRIE implements StringUtil {
  public static str2byte(buf: buffer.Buffer, str: string, offset: number, length: number): number {
    length = str.length > length ? length : str.length;
    for (var i = 0; i < length; i++) {
      buf.writeUInt8(str.charCodeAt(i) - 0x20, offset + i);
    }
    buf._charsWritten = length;
    return length;
  }

  public static byte2str(byteArray: number[]): string {
    var chars = new Array(byteArray.length);
    for (var i = 0; i < byteArray.length; i++) {
      chars[i] = String.fromCharCode(byteArray[i] + 0x20);
    }
    return chars.join('');
  }

  public static byteLength(str: string): number {
    return str.length;
  }
}
