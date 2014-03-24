import file_system = require('../../src/core/file_system');

interface BackendFactory {
  (cb: (objs: file_system.FileSystem[]) => void): void;
}

export = BackendFactory;
