import XHRFSFactory = require('./xhrfs_factory');
import file_system = require('../../../src/core/file_system');
import ZipFS from '../../../src/backend/ZipFS';
import BackendFactory = require('../BackendFactory');
import BrowserFS = require('../../../src/core/browserfs');
import _fs = require('../../../src/core/node_fs');

function ZipFSFactory(cb: (name: string, objs: file_system.FileSystem[]) => void): void {
  if (ZipFS.isAvailable()) {
    XHRFSFactory((_, xhrfs) => {
      if (xhrfs.length === 0) {
        return cb('ZipFS', xhrfs);
      }

      // Add three Zip FS variants for different zip files.
      var zipFiles = ['0', '4', '9'], i: number,
        rv: file_system.FileSystem[] = [], fs: typeof _fs = BrowserFS.BFSRequire('fs');
      // Leverage the XHRFS to download the fixtures for this FS.
      BrowserFS.initialize(xhrfs[0]);
      for (i = 0; i < zipFiles.length; i++) {
        ((zipFilename: string) => {
          fs.readFile(zipFilename, (e, data?) => {
            if (e) throw e;
            if (rv.push(new ZipFS(data, zipFilename)) === zipFiles.length) {
              cb('zipfs', rv);
            }
          });
        })('/test/fixtures/zipfs/zipfs_fixtures_l' + zipFiles[i] + '.zip');
      }
    });
  } else {
    cb('ZipFS', []);
  }
}

// Typechecking.
var _: BackendFactory = ZipFSFactory;

export = ZipFSFactory;
