import EmscriptenFS from '../../../src/backend/Emscripten';
import FolderAdapter from '../../../src/backend/FolderAdapter';
import BackendFactory from '../BackendFactory';
import {FileSystem} from '../../../src/core/file_system';

function emptyDir(FS: any, dir: string): void {
  const files = FS.readdir(dir).filter((file) => file !== '.' && file !== '..').map((file) => `${dir}/${file}`);
  files.forEach((file) => {
    const mode = FS.stat(file).mode;
    if (FS.isFile(mode)) {
      FS.unlink(file);
    } else {
      emptyDir(FS, file);
      FS.rmdir(file);
    }
  });
}

function createEmscriptenFS(idbfs: boolean, cb: (obj: FileSystem) => void): void {
  const emscriptenNop: (Module: any) => void = require('../../tests/emscripten/nop.js');
  const Module = {
    // Block standard input.
    print: function(text: string) {},
    printErr: function(text: string) {},
    stdin: function() {
      return null;
    },
    preRun: function() {
      const FS = Module.FS;
      const IDBFS = Module.IDBFS;
      FS.mkdir('/files');
      if (idbfs) {
        FS.mount(IDBFS, {}, '/files');
        FS.syncfs(true, function (err) {
          emptyDir(FS, '/files');
          FS.syncfs(false, function(err) {
            cb(new FolderAdapter('/files', new EmscriptenFS(Module.FS)));
          });
        });
      } else {
        cb(new FolderAdapter('/files', new EmscriptenFS(Module.FS)));
      }
    },
    locateFile: function(fname: string): string {
      return `/test/tests/emscripten/${fname}`;
    },
    // Keep FS active after NOP finishes running.
    noExitRuntime: true,
    ENVIRONMENT: "WEB",
    FS: <any> undefined,
    PATH: <any> undefined,
    ERRNO_CODES: <any> undefined,
    IDBFS: <any> undefined
  };
  emscriptenNop(Module);
}

export default function EmscriptenFactory(cb: (name: string, obj: FileSystem[]) => void): void {
  if (typeof(Uint8Array) !== 'undefined') {
    createEmscriptenFS(false, (inmemory) => {
      createEmscriptenFS(true, (idbfs) => {
        cb('Emscripten', [inmemory, idbfs]);
      });
    });
  } else {
    cb('Emscripten', []);
  }
}

// Typecheck;
const _: BackendFactory = EmscriptenFactory;
