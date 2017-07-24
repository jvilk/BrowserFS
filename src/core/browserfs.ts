/**
 * BrowserFS's main module. This is exposed in the browser via the BrowserFS global.
 * Due to limitations in typedoc, we document these functions in ./typedoc.ts.
 */

import * as buffer from 'buffer';
import fs from './node_fs';
import * as path from 'path';
import {FileSystemConstructor, FileSystem, BFSOneArgCallback, BFSCallback} from './file_system';
import EmscriptenFS from '../generic/emscripten_fs';
import Backends from './backends';
import * as BFSUtils from './util';
import * as Errors from './api_error';
import setImmediate from '../generic/setImmediate';

if ((<any> process)['initializeTTYs']) {
  (<any> process)['initializeTTYs']();
}

/**
 * @hidden
 */
export function install(obj: any) {
  obj.Buffer = Buffer;
  obj.process = process;
  const oldRequire = obj.require ? obj.require : null;
  // Monkey-patch require for Node-style code.
  obj.require = function(arg: string) {
    const rv = BFSRequire(arg);
    if (!rv) {
      return oldRequire.apply(null, Array.prototype.slice.call(arguments, 0));
    } else {
      return rv;
    }
  };
}

/**
 * @hidden
 */
export function registerFileSystem(name: string, fs: FileSystemConstructor) {
  (<any> Backends)[name] = fs;
}

/**
 * @hidden
 */
export function BFSRequire(module: 'fs'): typeof fs;
export function BFSRequire(module: 'path'): typeof path;
export function BFSRequire(module: 'buffer'): typeof buffer;
export function BFSRequire(module: 'process'): typeof process;
export function BFSRequire(module: 'bfs_utils'): typeof BFSUtils;
export function BFSRequire(module: string): any;
export function BFSRequire(module: string): any {
  switch (module) {
    case 'fs':
      return fs;
    case 'path':
      return path;
    case 'buffer':
      // The 'buffer' module has 'Buffer' as a property.
      return buffer;
    case 'process':
      return process;
    case 'bfs_utils':
      return BFSUtils;
    default:
      return (<any> Backends)[module];
  }
}

/**
 * @hidden
 */
export function initialize(rootfs: FileSystem) {
  return fs.initialize(rootfs);
}

/**
 * Configure BrowserFS with an object containing file system names and configurations.
 * @hidden
 */
export function configure(config: FileSystemConfiguration, cb: BFSOneArgCallback): void {
  getFileSystem(config, (e, fs?) => {
    if (fs) {
      initialize(fs);
      cb();
    } else {
      cb(e);
    }
  });
}

export interface FileSystemConfiguration {
  fs: string;
  options: any;
}

export function getFileSystem(config: FileSystemConfiguration, cb: BFSCallback<FileSystem>): void {
  const fsName = config['fs'];
  if (!fsName) {
    return cb(new Errors.ApiError(Errors.ErrorCode.EPERM, 'Missing "fs" property on configuration object.'));
  }
  const options = config['options'];
  let waitCount = 0;
  let called = false;
  function finish() {
    if (!called) {
      called = true;
      const fsc = <FileSystemConstructor | undefined> (<any> Backends)[fsName];
      if (!fsc) {
        cb(new Errors.ApiError(Errors.ErrorCode.EPERM, `File system ${fsName} is not available in BrowserFS.`));
      } else {
        fsc.Create(options, cb);
      }
    }
  }
  if (options !== null && typeof(options) === "object") {
    const props = Object.keys(options).filter((k) => k !== 'fs');

    // Check recursively if other fields have 'fs' properties.
    props.forEach((p) => {
      const d = options[p];
      if (d['fs']) {
        waitCount++;
        getFileSystem(d, function(e, fs?) {
          waitCount--;
          if (e) {
            if (called) {
              return;
            }
            called = true;
            cb(e);
          } else {
            options[p] = fs;
            if (waitCount === 0) {
              finish();
            }
          }
        });
      }
    });
  }
  if (waitCount === 0) {
    finish();
  }
}

export {EmscriptenFS, Backends as FileSystem, Errors, setImmediate};
