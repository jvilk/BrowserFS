import buffer = require('buffer');
import node_fs = require('node_fs');
import node_path = require('node_path');
import node_process = require('node_process');
import file_system = require('file_system');

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
  obj.Buffer = buffer.Buffer;
  obj.process = node_process.process;
  var oldRequire = obj.require != null ? obj.require : null;
  // Monkey-patch require for Node-style code.
  obj.require = function(arg) {
    var rv = require(arg);
    if (rv == null) {
      return oldRequire.call(null, Array.prototype.slice.call(arguments, 0))
    } else {
      return rv;
    }
  };
}

var fsTypes: {[name: string]: any} = {};
export function registerFileSystem(name: string, fs: any) {
  fsTypes[name] = fs;
}

export function getFsConstructor(type: string): any {
  return fsTypes[name];
}

export function require(module: string) {
  switch(module) {
    case 'fs':
      return node_fs.fs;
    case 'path':
      return node_path.path;
    case 'buffer':
      return buffer.Buffer;
    case 'process':
      return node_process.process;
    default:
      return getFsConstructor(module);
  }
}

/**
 * You must call this function with a properly-instantiated root file system
 * before using any file system API method.
 * @param {BrowserFS.FileSystem} rootFS - The root filesystem to use for the
 *   entire BrowserFS file system.
 */
export function initialize(rootfs) {
  return node_fs.fs._initialize(rootfs);
}
