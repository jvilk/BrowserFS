import XHRFSFactory from './xhrfs_factory';
import {FileSystem} from '../../../src/core/file_system';
import ZipFS from '../../../src/backend/ZipFS';
import * as BrowserFS from '../../../src/core/browserfs';
import _fs from '../../../src/core/node_fs';

export default function ZipFSFactory(cb: (name: string, objs: FileSystem[]) => void): void {
  if (ZipFS.isAvailable()) {
    XHRFSFactory((_, xhrfs) => {
      if (xhrfs.length === 0) {
        return cb('ZipFS', xhrfs);
      }

      // Add three Zip FS variants for different zip files.
      var zipFiles = ['0', '4', '9'], i: number,
        rv: FileSystem[] = [], fs: typeof _fs = BrowserFS.BFSRequire('fs');
      // Leverage the XHRFS to download the fixtures for this FS.
      BrowserFS.initialize(xhrfs[0]);
      let countdown = zipFiles.length;
      function fetchZip(zipFilename: string): void {
        fs.readFile(zipFilename, (e, data?) => {
          if (e) throw e;
          if (countdown === 1) {
            ZipFS.Create({
              zipData: data,
              name: zipFilename
            }, (e, fs?) => {
              if (e) {
                throw e;
              }
              countdown--;
              rv.push(fs);
              cb('ZipFS', rv);
            });
          } else {
            countdown--;
            // Remove when constructor is deprecated.
            rv.push(new ZipFS(data, zipFilename));
          }
        });
      }
      for (i = 0; i < zipFiles.length; i++) {
        fetchZip(`/test/fixtures/zipfs/zipfs_fixtures_l${zipFiles[i]}.zip`);
      }
    });
  } else {
    cb('ZipFS', []);
  }
}
