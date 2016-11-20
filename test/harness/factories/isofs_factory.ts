import XHRFSFactory from './xhrfs_factory';
import {FileSystem} from '../../../src/core/file_system';
import IsoFS from '../../../src/backend/IsoFS';
import * as BrowserFS from '../../../src/core/browserfs';

const isodir = "/test/fixtures/isofs";
export default function IsoFSFactory(cb: (name: string, objs: FileSystem[]) => void): void {
  if (IsoFS.isAvailable()) {
    XHRFSFactory((_, xhrfs) => {
      if (xhrfs.length === 0) {
        return cb('IsoFS', xhrfs);
      }

      // Leverage the XHRFS to download the fixtures for this FS.
      BrowserFS.initialize(xhrfs[0]);
      let fs = BrowserFS.BFSRequire('fs');

      // Add three Zip FS variants for different zip files.
      let isoFiles = fs.readdirSync(isodir);
      let rv: FileSystem[] = [];
      for (let i = 0; i < isoFiles.length; i++) {
        ((isoFilename: string, isLast: boolean) => {
          fs.readFile(isoFilename, (e, data?) => {
            if (e) throw e;
            rv.push(new IsoFS(data, isoFilename));
            if (isLast) {
              cb('IsoFS', rv);
            }
          });
        })(`${isodir}/${isoFiles[i]}`, i == isoFiles.length - 1);
      }
    });
  } else {
    cb('IsoFS', []);
  }
}
