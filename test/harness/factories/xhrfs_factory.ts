import {FileSystem} from '../../../src/core/file_system';
import XmlHttpRequestFS from '../../../src/backend/XmlHttpRequest';

export default function XHRFSFactory(cb: (name: string, objs: FileSystem[]) => void): void {
  if (XmlHttpRequestFS.isAvailable()) {
    XmlHttpRequestFS.FromURL('test/fixtures/xhrfs/listings.json', (e, fs) => {
      if (e) {
        cb('XmlHttpRequest', []);
      } else {
        cb('XmlHttpRequest', [fs, new XmlHttpRequestFS('test/fixtures/xhrfs/listings.json', '../')]);
      }
    }, '../');
  } else {
    cb('XmlHttpRequest', []);
  }
}
