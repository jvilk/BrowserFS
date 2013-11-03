/// <reference path="../../vendor/DefinitelyTyped/node/node.d.ts" />
import string_util = require('./string_util');

/**
 * Defines all of the static methods for the Buffer interface.
 * Defining this separately from the actual Buffer class allows us to have
 * multiple buffer implementations that share the same static method
 * implementations
 */
export class BufferStatic {
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
}