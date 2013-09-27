
export FindUtil(encoding) {
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
      return BrowserFS.StringUtil.UTF8;
    case 'ascii':
    case 'binary':
      return BrowserFS.StringUtil.ASCII;
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return BrowserFS.StringUtil.UCS2;
    case 'hex':
      return BrowserFS.StringUtil.HEX;
    case 'base64':
      return BrowserFS.StringUtil.BASE64;
    case 'binary_string':
      return BrowserFS.StringUtil.BINSTR;
    case 'binary_string_ie':
      return BrowserFS.StringUtil.BINSTRIE;
    default:
      throw new Error("Unknown encoding: " + encoding);
  }
}

BrowserFS.StringUtil.UTF8 = (function() {
  function UTF8() {}

  UTF8.str2byte = function(buf, str, offset, length) {
    var code, codePoint, i, j, maxJ, next, numChars, rv;

    i = 0;
    j = offset;
    maxJ = offset + length;
    rv = [];
    numChars = 0;
    while (i < str.length && j < maxJ) {
      code = str.charCodeAt(i++);
      next = str.charCodeAt(i);
      if (0xD800 <= code && code <= 0xDBFF && 0xDC00 <= next && next <= 0xDFFF) {
        if (j + 3 >= maxJ) {
          break;
        } else {
          numChars++;
        }
        codePoint = (((code & 0x3FF) | 0x400) << 10) | (next & 0x3FF);
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
  };

  UTF8.byte2str = function(byteArray) {
    var byte3, chars, code, i;

    chars = [];
    i = 0;
    while (i < byteArray.length) {
      code = byteArray[i++];
      if (code < 0x80) {
        chars.push(String.fromCharCode(code));
      } else if (code < 0xC0) {
        throw new Error('Found incomplete part of character in string.');
      } else if (code < 0xE0) {
        chars.push(String.fromCharCode(((code & 0x1F) << 6) | (byteArray[i++] & 0x3F)));
      } else if (code < 0xF0) {
        chars.push(String.fromCharCode(((code & 0xF) << 12) | ((byteArray[i++] & 0x3F) << 6) | (byteArray[i++] & 0x3F)));
      } else if (code < 0xF8) {
        byte3 = byteArray[i + 2];
        chars.push(String.fromCharCode(((((code & 0x7) << 8) | ((byteArray[i++] & 0x3F) << 2) | ((byteArray[i++] & 0x3F) >> 4)) & 0x3FF) | 0xD800));
        chars.push(String.fromCharCode((((byte3 & 0xF) << 6) | (byteArray[i++] & 0x3F)) | 0xDC00));
      } else {
        throw new Error('Unable to represent UTF-8 string as UTF-16 JavaScript string.');
      }
    }
    return chars.join('');
  };

  UTF8.byteLength = function(str) {
    var m;

    m = encodeURIComponent(str).match(/%[89ABab]/g);
    return str.length + (m ? m.length : 0);
  };

  return UTF8;

})();

BrowserFS.StringUtil.ASCII = (function() {
  function ASCII() {}

  ASCII.str2byte = function(buf, str, offset, length) {
    var i, _i;

    length = str.length > length ? length : str.length;
    for (i = _i = 0; 0 <= length ? _i < length : _i > length; i = 0 <= length ? ++_i : --_i) {
      buf.writeUInt8(str.charCodeAt(i) % 256, offset + i);
    }
    buf._charsWritten = length;
    return length;
  };

  ASCII.byte2str = function(byteArray) {
    var chars, i, _i, _ref;

    chars = new Array(byteArray.length);
    for (i = _i = 0, _ref = byteArray.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
      chars[i] = String.fromCharCode(byteArray[i] & 0x7F);
    }
    return chars.join('');
  };

  ASCII.byteLength = function(str) {
    return str.length;
  };

  return ASCII;

})();

BrowserFS.StringUtil.BASE64 = (function() {
  function BASE64() {}

  BASE64.num2b64 = (function() {
    var i, idx, obj, _i, _len, _ref;

    obj = {};
    _ref = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '/', '='];
    for (idx = _i = 0, _len = _ref.length; _i < _len; idx = ++_i) {
      i = _ref[idx];
      obj[idx] = i;
    }
    return obj;
  })();

  BASE64.b642num = (function() {
    var i, idx, obj, _i, _len, _ref;

    obj = {};
    _ref = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '/', '='];
    for (idx = _i = 0, _len = _ref.length; _i < _len; idx = ++_i) {
      i = _ref[idx];
      obj[i] = idx;
    }
    obj['-'] = 62;
    obj['_'] = 63;
    return obj;
  })();

  BASE64.byte2str = function(byteArray) {
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4, i, output;

    output = '';
    i = 0;
    while (i < byteArray.length) {
      chr1 = byteArray[i++];
      chr2 = byteArray[i++];
      chr3 = byteArray[i++];
      enc1 = chr1 >> 2;
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      enc4 = chr3 & 63;
      if (isNaN(chr2)) {
        enc3 = enc4 = 64;
      } else if (isNaN(chr3)) {
        enc4 = 64;
      }
      output = output + BrowserFS.StringUtil.BASE64.num2b64[enc1] + BrowserFS.StringUtil.BASE64.num2b64[enc2] + BrowserFS.StringUtil.BASE64.num2b64[enc3] + BrowserFS.StringUtil.BASE64.num2b64[enc4];
    }
    return output;
  };

  BASE64.str2byte = function(buf, str, offset, length) {
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4, i, j, output;

    output = '';
    i = 0;
    str = str.replace(/[^A-Za-z0-9\+\/\=\-\_]/g, '');
    j = 0;
    while (i < str.length) {
      enc1 = BrowserFS.StringUtil.BASE64.b642num[str.charAt(i++)];
      enc2 = BrowserFS.StringUtil.BASE64.b642num[str.charAt(i++)];
      enc3 = BrowserFS.StringUtil.BASE64.b642num[str.charAt(i++)];
      enc4 = BrowserFS.StringUtil.BASE64.b642num[str.charAt(i++)];
      chr1 = (enc1 << 2) | (enc2 >> 4);
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      chr3 = ((enc3 & 3) << 6) | enc4;
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
  };

  BASE64.byteLength = function(str) {
    return Math.floor(((str.replace(/[^A-Za-z0-9\+\/\-\_]/g, '')).length * 6) / 8);
  };

  return BASE64;

})();

BrowserFS.StringUtil.UCS2 = (function() {
  function UCS2() {}

  UCS2.str2byte = function(buf, str, offset, length) {
    var i, len, _i;

    len = str.length;
    if (len * 2 > length) {
      len = length % 2 === 1 ? (length - 1) / 2 : length / 2;
    }
    for (i = _i = 0; 0 <= len ? _i < len : _i > len; i = 0 <= len ? ++_i : --_i) {
      buf.writeUInt16LE(str.charCodeAt(i), offset + i * 2);
    }
    buf._charsWritten = len;
    return len * 2;
  };

  UCS2.byte2str = function(byteArray) {
    var chars, i, _i, _ref;

    if (byteArray.length % 2 !== 0) {
      throw new Error('Invalid UCS2 byte array.');
    }
    chars = new Array(byteArray.length / 2);
    for (i = _i = 0, _ref = byteArray.length; _i < _ref; i = _i += 2) {
      chars[i / 2] = String.fromCharCode(byteArray[i] | (byteArray[i + 1] << 8));
    }
    return chars.join('');
  };

  UCS2.byteLength = function(str) {
    return str.length * 2;
  };

  return UCS2;

})();

BrowserFS.StringUtil.HEX = (function() {
  var HEXCHARS;

  function HEX() {}

  HEXCHARS = '0123456789abcdef';

  HEX.num2hex = (function() {
    var i, idx, obj, _i, _len;

    obj = {};
    for (idx = _i = 0, _len = HEXCHARS.length; _i < _len; idx = ++_i) {
      i = HEXCHARS[idx];
      obj[idx] = i;
    }
    return obj;
  })();

  HEX.hex2num = (function() {
    var i, idx, obj, _i, _j, _len, _len1, _ref;

    obj = {};
    for (idx = _i = 0, _len = HEXCHARS.length; _i < _len; idx = ++_i) {
      i = HEXCHARS[idx];
      obj[i] = idx;
    }
    _ref = 'ABCDEF';
    for (idx = _j = 0, _len1 = _ref.length; _j < _len1; idx = ++_j) {
      i = _ref[idx];
      obj[i] = idx + 10;
    }
    return obj;
  })();

  HEX.str2byte = function(buf, str, offset, length) {
    var char1, char2, i, numBytes, _i;

    if (str.length % 2 === 1) {
      throw new Error('Invalid hex string');
    }
    numBytes = str.length / 2;
    if (numBytes > length) {
      numBytes = length;
    }
    for (i = _i = 0; 0 <= numBytes ? _i < numBytes : _i > numBytes; i = 0 <= numBytes ? ++_i : --_i) {
      char1 = BrowserFS.StringUtil.HEX.hex2num[str.charAt(2 * i)];
      char2 = BrowserFS.StringUtil.HEX.hex2num[str.charAt(2 * i + 1)];
      buf.writeUInt8((char1 << 4) | char2, offset + i);
    }
    buf._charsWritten = 2 * numBytes;
    return numBytes;
  };

  HEX.byte2str = function(byteArray) {
    var chars, hex1, hex2, i, j, len, _i;

    len = byteArray.length;
    chars = new Array(len * 2);
    j = 0;
    for (i = _i = 0; 0 <= len ? _i < len : _i > len; i = 0 <= len ? ++_i : --_i) {
      hex2 = byteArray[i] & 0xF;
      hex1 = byteArray[i] >> 4;
      chars[j++] = BrowserFS.StringUtil.HEX.num2hex[hex1];
      chars[j++] = BrowserFS.StringUtil.HEX.num2hex[hex2];
    }
    return chars.join('');
  };

  HEX.byteLength = function(str) {
    return str.length / 2;
  };

  return HEX;

})();

BrowserFS.StringUtil.BINSTR = (function() {
  function BINSTR() {}

  BINSTR.str2byte = function(buf, str, offset, length) {
    var chr, endByte, firstChar, i, j, numBytes, startByte, _i;

    if (str.length === 0) {
      buf._charsWritten = 0;
      return 0;
    }
    numBytes = BINSTR.byteLength(str);
    if (numBytes > length) {
      numBytes = length;
    }
    j = 0;
    startByte = offset;
    endByte = startByte + numBytes;
    firstChar = str.charCodeAt(j++);
    if (firstChar !== 0) {
      buf.writeUInt8(firstChar & 0xFF, offset);
      startByte = offset + 1;
    }
    for (i = _i = startByte; _i < endByte; i = _i += 2) {
      chr = str.charCodeAt(j++);
      if (endByte - i === 1) {
        buf.writeUInt8(chr >> 8, i);
      }
      if (endByte - i >= 2) {
        buf.writeUInt16BE(chr, i);
      }
    }
    buf._charsWritten = Math.floor(numBytes / 2) + 1;
    return numBytes;
  };

  BINSTR.byte2str = function(byteArray) {
    var chars, i, j, len, _i, _ref;

    len = byteArray.length;
    if (len === 0) {
      return '';
    }
    chars = new Array(Math.floor(len / 2) + 1);
    j = 0;
    for (i = _i = 0, _ref = chars.length; _i < _ref; i = _i += 1) {
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
  };

  BINSTR.byteLength = function(str) {
    var bytelen, firstChar;

    if (str.length === 0) {
      return 0;
    }
    firstChar = str.charCodeAt(0);
    bytelen = (str.length - 1) * 2;
    if (firstChar !== 0) {
      bytelen++;
    }
    return bytelen;
  };

  return BINSTR;

}).call(this);

BrowserFS.StringUtil.BINSTRIE = (function() {
  function BINSTRIE() {}

  BINSTRIE.str2byte = function(buf, str, offset, length) {
    var i, _i;

    length = str.length > length ? length : str.length;
    for (i = _i = 0; 0 <= length ? _i < length : _i > length; i = 0 <= length ? ++_i : --_i) {
      buf.writeUInt8(str.charCodeAt(i) - 0x20, offset + i);
    }
    buf._charsWritten = length;
    return length;
  };

  BINSTRIE.byte2str = function(byteArray) {
    var chars, i, _i, _ref;

    chars = new Array(byteArray.length);
    for (i = _i = 0, _ref = byteArray.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
      chars[i] = String.fromCharCode(byteArray[i] + 0x20);
    }
    return chars.join('');
  };

  BINSTRIE.byteLength = function(str) {
    return str.length;
  };

  return BINSTRIE;

})();
