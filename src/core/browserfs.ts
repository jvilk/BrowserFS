/**
 * BrowserFS's main module. This is exposed in the browser via the BrowserFS global.
 */

import buffer = require('buffer');
import fs = require('./node_fs');
import path = require('path');
import file_system = require('./file_system');
import EmscriptenFS from '../generic/emscripten_fs';
import * as FileSystem from './backends';

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
 * @param {object} obj - The object to install things onto (e.g. window)
 */
export function install(obj: any) {
  obj.Buffer = Buffer;
  obj.process = process;
  var oldRequire = obj.require != null ? obj.require : null;
  // Monkey-patch require for Node-style code.
  obj.require = function(arg: string) {
    var rv = BFSRequire(arg);
    if (rv == null) {
      return oldRequire.apply(null, Array.prototype.slice.call(arguments, 0))
    } else {
      return rv;
    }
  };
}

export function registerFileSystem(name: string, fs: file_system.FileSystemConstructor) {
  (<any> FileSystem)[name] = fs;
}

export function BFSRequire(module: string) {
  switch(module) {
    case 'fs':
      return fs;
    case 'path':
      return path;
    case 'buffer':
      // The 'buffer' module has 'Buffer' as a property.
      return buffer;
    case 'process':
      return process;
    default:
      return FileSystem[module];
  }
}

/**
 * You must call this function with a properly-instantiated root file system
 * before using any file system API method.
 * @param {BrowserFS.FileSystem} rootFS - The root filesystem to use for the
 *   entire BrowserFS file system.
 */
export function initialize(rootfs: file_system.FileSystem) {
  return fs._initialize(rootfs);
}

export {EmscriptenFS, FileSystem};
