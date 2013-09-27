// The main BrowserFS namespace. Defines global setup functions.

// Defined here so the other files can fill it up with attributes for the node
// API.
// @todo Don't do this anymore; define appropriate RequireJS modules.
export node = {};

/**
 * Installs BrowserFS onto the given object.
 * We recommend that you run install with the 'window' object to make things
 * global, as in Node.
 *
 * Properties installed:
 *
 * * Buffer
 * * process
 * * require (we monkey-patch it)
 *
 * This allows you to write code as if you were running inside Node.
 * @param {Object} obj - The object to install things onto (e.g. window)
 */
export function install(obj) {
  obj.Buffer = BrowserFS.node.Buffer;
  obj.process = BrowserFS.node.process;
  var oldRequire = obj.require != null ? obj.require : null;
  // Monkey-patch require for Node-style code.
  return obj.require = function(arg, herp) {
    // XXX: Hackfix for Ace Editor. The Ace Editor clobbers require definitions,
    //      but recalls it with an empty first argument.
    if ((herp != null) && (arg == null)) {
      arg = herp;
    }
    switch (arg) {
      case 'fs':
        return BrowserFS.node.fs;
      case 'path':
        return BrowserFS.node.path;
      case 'process':
        return BrowserFS.node.process;
      case 'buffer':
        return BrowserFS.node;
      default:
        if (oldRequire != null) {
          return oldRequire.apply(this, arguments);
        } else {
          throw new Error("Module not found: " + arg);
        }
    }
  };
}

/**
 * You must call this function with a properly-instantiated root file system
 * before using any file system API method.
 * @param {BrowserFS.FileSystem} rootFS - The root filesystem to use for the
 *   entire BrowserFS file system.
 */
export function initialize(rootfs) {
  return BrowserFS.node.fs._initialize(rootfs);
}

// Utility functions.
export util = {
  /**
   * Estimates the size of a JS object.
   * @param {Object} object - the object to measure.
   * @return {Number} estimated object size.
   * @see http://stackoverflow.com/a/11900218/10601
   */
  roughSizeOfObject: function(object) {
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
      } else if (typeof value === 'object' && __indexOf.call(objectList, value) < 0) {
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
}

export isIE = /(msie) ([\w.]+)/.exec(navigator.userAgent.toLowerCase());
