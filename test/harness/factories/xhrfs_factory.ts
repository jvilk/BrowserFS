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
        cb('XmlHttpRequest', [fs]);
      }
    });
  } else {
    cb('XmlHttpRequest', []);
  }
}
