/**
 * Grab bag of utility functions used across the code.
 */

/**
 * Estimates the size of a JS object.
 * @param {Object} object - the object to measure.
 * @return {Number} estimated object size.
 * @see http://stackoverflow.com/a/11900218/10601
 */
export function roughSizeOfObject(object) {
  var bytes, key, objectList, prop, stack, value;
  objectList = [];
  stack = [object];
  bytes = 0;
  while (stack.length !== 0) {
    value = stack.pop();
    if (typeof value === 'boolean') {
      bytes += 4;
    } else if (typeof value === 'string') {
      bytes += value.length * 2;
    } else if (typeof value === 'number') {
      bytes += 8;
    } else if (typeof value === 'object' && objectList.indexOf(value) < 0) {
      objectList.push(value);
      bytes += 4;
      for (key in value) {
        prop = value[key];
        bytes += key.length * 2;
        stack.push(prop);
      }
    }
  }
  return bytes;
}

/**
 * Checks for any IE version, including IE11 which removed MSIE from the
 * userAgent string.
 */
export var isIE: boolean = (/(msie) ([\w.]+)/.exec(navigator.userAgent.toLowerCase()) != null || navigator.userAgent.indexOf('Trident') !== -1);
