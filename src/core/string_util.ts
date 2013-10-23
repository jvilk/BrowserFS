import buffer = require("./buffer");

export interface StringUtil {
  str2byte(buf: buffer.Buffer, str: string, offset: number, length: number): number;
  byte2str(byteArray: number[]): string;
  byteLength(str: string): number;
}

export function FindUtil(encoding: string): StringUtil {
  encoding = (function() {
    switch (typeof encoding) {
      case 'object':
        return "" + encoding;
      case 'string':
        return encoding;
      default:
        throw new Error('Invalid encoding argument specified');
    }
  })();
  encoding = encoding.toLowerCase();
  switch (encoding) {
    case 'utf8':
    case 'utf-8':
      return UTF8;
    case 'ascii':
    case 'binary':
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
    case 'binary_string':
      return BINSTR;
    case 'binary_string_ie':
      return BINSTRIE;
    default:
      throw new Error("Unknown encoding: " + encoding);
  }
}

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
        if (j + 3 >= maxJ) {
          break;
        } else {
          numChars++;
        }
        var codePoint = (((code & 0x3FF) | 0x400) << 10) | (next & 0x3FF);
        buf.writeUInt8((codePoint >> 18) | 0xF0, j++);
        buf.writeUInt8(((codePoint >> 12) & 0x3F) | 0x80, j++);
        buf.writeUInt8(((codePoint >> 6) & 0x3F) | 0x80, j++);
        buf.writeUInt8((codePoint & 0x3F) | 0x80, j++);
        i++;
      } else if (code < 0x80) {
        buf.writeUInt8(code, j++);
        numChars++;
      } else if (code < 0x800) {
        if (j + 1 >= maxJ) {
          break;
        } else {
          numChars++;
        }
        buf.writeUInt8((code >> 6) | 0xC0, j++);
        buf.writeUInt8((code & 0x3F) | 0x80, j++);
      } else if (code < 0x10000) {
        if (j + 2 >= maxJ) {
          break;
        } else {
          numChars++;
        }
        buf.writeUInt8((code >> 12) | 0xE0, j++);
        buf.writeUInt8(((code >> 6) & 0x3F) | 0x80, j++);
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
        throw new Error('Found incomplete part of character in string.');
      } else if (code < 0xE0) {
        chars.push(String.fromCharCode(((code & 0x1F) << 6) | (byteArray[i++] & 0x3F)));
      } else if (code < 0xF0) {
        chars.push(String.fromCharCode(((code & 0xF) << 12) | ((byteArray[i++] & 0x3F) << 6) | (byteArray[i++] & 0x3F)));
      } else if (code < 0xF8) {
        var byte3 = byteArray[i + 2];
        chars.push(String.fromCharCode(((((code & 0x7) << 8) | ((byteArray[i++] & 0x3F) << 2) | ((byteArray[i++] & 0x3F) >> 4)) & 0x3FF) | 0xD800));
        chars.push(String.fromCharCode((((byte3 & 0xF) << 6) | (byteArray[i++] & 0x3F)) | 0xDC00));
      } else {
        throw new Error('Unable to represent UTF-8 string as UTF-16 JavaScript string.');
      }
    }
    return chars.join('');
  }

  public static byteLength(str: string): number {
    var m = encodeURIComponent(str).match(/%[89ABab]/g);
    return str.length + (m ? m.length : 0);
  }
}

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
    buf._charsWritten = i > str.length ? str.length : i;
    return j;
  }

  public static byteLength(str: string): number {
    return Math.floor(((str.replace(/[^A-Za-z0-9\+\/\-\_]/g, '')).length * 6) / 8);
  }
}

export class UCS2 implements StringUtil {
  public static str2byte(buf: buffer.Buffer, str: string, offset: number, length: number): number {
    var len = str.length;
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

export class BINSTR implements StringUtil {
  public static str2byte(buf: buffer.Buffer, str: string, offset: number, length: number): number {
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
    var firstChar = str.charCodeAt(j++);
    if (firstChar !== 0) {
      buf.writeUInt8(firstChar & 0xFF, offset);
      startByte = offset + 1;
    }
    for (var i = startByte; i < endByte; i += 2) {
      var chr = str.charCodeAt(j++);
      if (endByte - i === 1) {
        buf.writeUInt8(chr >> 8, i);
      }
      if (endByte - i >= 2) {
        buf.writeUInt16BE(chr, i);
      }
    }
    buf._charsWritten = Math.floor(numBytes / 2) + 1;
    return numBytes;
  }

  public static byte2str(byteArray: number[]): string {
    var len = byteArray.length;
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
