import {FileSystem} from '../../../src/core/file_system';
import XmlHttpRequestFS from '../../../src/backend/XmlHttpRequest';

export default function XHRFSFactory(cb: (name: string, objs: FileSystem[]) => void): void {
  if (XmlHttpRequestFS.isAvailable()) {
    XmlHttpRequestFS.Create({
      index: 'test/fixtures/xhrfs/listings.json',
      baseUrl: '../'
    }, (e, fs) => {
      if (e) {
        cb('XmlHttpRequest', []);
      } else {
        // Remove when synchronous option is removed.
        cb('XmlHttpRequest', [fs, new XmlHttpRequestFS('test/fixtures/xhrfs/listings.json', '../')]);
      }
    });
  } else {
    cb('XmlHttpRequest', []);
  }
}
