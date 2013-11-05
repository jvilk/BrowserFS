/// <reference path="../../vendor/DefinitelyTyped/node/node.d.ts" />
import string_util = require('./string_util');
import buffer = require('./buffer');

/**
 * Defines all of the common methods for the Buffer interface.
 * Defining this separately from the actual Buffer class allows us to have
 * multiple buffer implementations that share common method implementations.
 */
export class BufferCommon {
  /**
   * Checks if enc is a valid string encoding type.
   * @param {string} enc - Name of a string encoding type.
   * @return {boolean} Whether or not enc is a valid encoding type.
   */
  public static isEncoding(enc: string): boolean {
    try {
      string_util.FindUtil(enc);
    } catch (e) {
      return false;
    }
    return true;
  }

  /**
   * Tests if obj is a Buffer.
   * @param {object} obj - An arbitrary object
   * @return {boolean} True if this object is a Buffer.
   */
  public static isBuffer(obj: any): boolean {
    return obj instanceof Buffer;
  }

  /**
   * Gives the actual byte length of a string. This is not the same as
   * String.prototype.length since that returns the number of characters in a
   * string.
   * @param {string} str - The string to get the byte length of
   * @param {string} [encoding=utf8] - Character encoding of the string
   * @return {number} The number of bytes in the string
   */
  public static byteLength(str: string, encoding: string = 'utf8'): number {
    var strUtil = string_util.FindUtil(encoding);
    return strUtil.byteLength(str);
  }

  /**
   * Returns a buffer which is the result of concatenating all the buffers in the
   * list together.
   * If the list has no items, or if the totalLength is 0, then it returns a
   * zero-length buffer.
   * If the list has exactly one item, then the first item of the list is
   * returned.
   * If the list has more than one item, then a new Buffer is created.
   * If totalLength is not provided, it is read from the buffers in the list.
   * However, this adds an additional loop to the function, so it is faster to
   * provide the length explicitly.
   * @param {Buffer[]} list - List of Buffer objects to concat
   * @param {number} [totalLength] - Total length of the buffers when concatenated
   * @return {Buffer}
   */
  public static concat(list: NodeBuffer[], totalLength?: number): NodeBuffer {
    var item;
    if (list.length === 0 || totalLength === 0) {
      return new Buffer(0);
    } else if (list.length === 1) {
      return list[0];
    } else {
      if (totalLength == null) {
        // Calculate totalLength
        totalLength = 0;
        for (var i = 0; i < list.length; i++) {
          item = list[i];
          totalLength += item.length;
        }
      }
      var buf = new Buffer(totalLength);
      var curPos = 0;
      for (var j = 0; j < list.length; j++) {
        item = list[j];
        curPos += item.copy(buf, curPos);
      }
      return buf;
    }
  }

  /**
   * **NONSTANDARD**: Set the octet at index. The values refer to individual
   * bytes, so the legal range is between 0x00 and 0xFF hex or 0 and 255.
   * @param {number} index - the index to set the value at
   * @param {number} value - the value to set at the given index
   */
  public set(index: number, value: number) {
    return (<NodeBuffer><any> this).writeUInt8(value, index);
  }

  /**
   * **NONSTANDARD**: Get the octet at index.
   * @param {number} index - index to fetch the value at
   * @return {number} the value at the given index
   */
  public get(index: number): number {
    return (<NodeBuffer><any> this).readUInt8(index);
  }

  /**
   * Writes string to the buffer at offset using the given encoding.
   * If buffer did not contain enough space to fit the entire string, it will
   * write a partial amount of the string.
   * @param {string} str - Data to be written to buffer
   * @param {number} [offset=0] - Offset in the buffer to write to
   * @param {number} [length=this.length] - Number of bytes to write
   * @param {string} [encoding=utf8] - Character encoding
   * @return {number} Number of octets written.
   */
  public write(str: string, offset = 0, length = (<NodeBuffer><any> this).length, encoding = 'utf8'): number {
    var _this = <NodeBuffer><any> this;
    // I hate Node's optional arguments.
    if (typeof offset === 'string') {
      // 'str' and 'encoding' specified
      encoding = "" + offset;
      offset = 0;
      length = _this.length;
    } else if (typeof length === 'string') {
      // 'str', 'offset', and 'encoding' specified
      encoding = "" + length;
      length = _this.length;
    }
    // Don't waste our time if the offset is beyond the buffer length
    if (offset >= _this.length) {
      return 0;
    }
    var strUtil = string_util.FindUtil(encoding);
    // Are we trying to write past the buffer?
    length = length + offset > _this.length ? _this.length - offset : length;
    return strUtil.str2byte(_this, str, offset, length);
  }

  /**
   * Decodes a portion of the Buffer into a String.
   * @param {string} encoding - Character encoding to decode to
   * @param {number} [start=0] - Start position in the buffer
   * @param {number} [end=this.length] - Ending position in the buffer
   * @return {string} A string from buffer data encoded with encoding, beginning
   *   at start, and ending at end.
   */
  public toString(encoding = 'utf8', start = 0, end = (<NodeBuffer><any> this).length): string {
    var _this = <buffer.BFSBuffer><any> this;
    if (!(start <= end)) {
      throw new Error("Invalid start/end positions: " + start + " - " + end);
    }
    if (start === end) {
      return '';
    }
    if (end > _this.length) {
      end = _this.length;
    }
    var strUtil = string_util.FindUtil(encoding);
    // Create a byte array of the needed characters.
    var byteArr = _this._getByteArray(start, end);
    return strUtil.byte2str(byteArr);
  }

  /**
   * Returns a JSON-representation of the Buffer instance, which is identical to
   * the output for JSON Arrays. JSON.stringify implicitly calls this function
   * when stringifying a Buffer instance.
   * @return {object} An object that can be used for JSON stringification.
   */
  public toJSON(): {type: string; data: number[]} {
    return {
      type: 'Buffer',
      data: (<buffer.BFSBuffer><any> this)._getByteArray(0, (<NodeBuffer><any> this).length)
    };
  }

  /**
   * Does copy between buffers. The source and target regions can be overlapped.
   * All values passed that are undefined/NaN or are out of bounds are set equal
   * to their respective defaults.
   * @param {Buffer} target - Buffer to copy into
   * @param {number} [targetStart=0] - Index to start copying to in the targetBuffer
   * @param {number} [sourceStart=0] - Index in this buffer to start copying from
   * @param {number} [sourceEnd=this.length] - Index in this buffer stop copying at
   * @return {number} The number of bytes copied into the target buffer.
   */
  public copy(target: NodeBuffer, targetStart = 0, sourceStart = 0, sourceEnd = (<NodeBuffer><any> this).length): number {
    var _this = <buffer.BFSBuffer><any> this;
    // The Node code is weird. It sets some out-of-bounds args to their defaults
    // and throws exceptions for others (sourceEnd).
    targetStart = targetStart < 0 ? 0 : targetStart;
    sourceStart = sourceStart < 0 ? 0 : sourceStart;

    // Need to sanity check all of the input. Node has really odd rules regarding
    // when to apply default arguments. I decided to copy Node's logic.
    if (sourceEnd < sourceStart) {
      throw new RangeError('sourceEnd < sourceStart');
    }
    if (sourceEnd === sourceStart) {
      return 0;
    }
    if (targetStart >= target.length) {
      throw new RangeError('targetStart out of bounds');
    }
    if (sourceStart >= _this.length) {
      throw new RangeError('sourceStart out of bounds');
    }
    if (sourceEnd > _this.length) {
      throw new RangeError('sourceEnd out of bounds');
    }
    var bytesCopied = Math.min(sourceEnd - sourceStart, target.length - targetStart, _this.length - sourceStart);
    for (var i = 0; i < bytesCopied; i++) {
      target.writeUInt8(_this.readUInt8(sourceStart + i), targetStart + i);
    }
    return bytesCopied;
  }

  /**
   * Returns a slice of this buffer.
   * @param {number} [start=0] - Index to start slicing from
   * @param {number} [end=this.length] - Index to stop slicing at
   * @return {Buffer} A new buffer which references the same
   *   memory as the old, but offset and cropped by the start (defaults to 0) and
   *   end (defaults to buffer.length) indexes. Negative indexes start from the end
   *   of the buffer.
   */
  public slice(start = 0, end = (<NodeBuffer><any> this).length): NodeBuffer {
    var _this = <buffer.BFSBuffer><any> this;
    // Translate negative indices to positive ones.
    if (start < 0) {
      start += _this.length;
      if (start < 0) {
        start = 0;
      }
    }
    if (end < 0) {
      end += _this.length;
      if (end < 0) {
        end = 0;
      }
    }
    if (end > _this.length) {
      end = _this.length;
    }
    if (start > end) {
      start = end;
    }

    // Sanity check.
    if (start < 0 || end < 0 || start >= _this.length || end > _this.length) {
      throw new Error("Invalid slice indices.");
    }
    return _this._slice(start, end);
  }

  /**
   * Fills the buffer with the specified value. If the offset and end are not
   * given it will fill the entire buffer.
   * @param {(string|number)} value - The value to fill the buffer with
   * @param {number} [offset=0]
   * @param {number} [end=this.length]
   */
  public fill(value: any, offset = 0, end = (<NodeBuffer><any> this).length): void {
    var i;
    var valType = typeof value;
    switch (valType) {
      case "string":
        // Trim to a byte.
        value = value.charCodeAt(0) & 0xFF;
        break;
      case "number":
        break;
      default:
        throw new Error('Invalid argument to fill.');
    }
    (<buffer.BFSBuffer><any> this)._fill(value, offset, end);
  }
}