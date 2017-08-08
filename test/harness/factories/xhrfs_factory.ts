import {FileSystem} from '../../../src/core/file_system';
import XmlHttpRequestFS from '../../../src/backend/XmlHttpRequest';

export default function XHRFSFactory(cb: (name: string, objs: FileSystem[]) => void): void {
  if (XmlHttpRequestFS.isAvailable()) {
    XmlHttpRequestFS.Create({
      index: 'test/fixtures/xhrfs/listings.json',
      baseUrl: '../',
      preferXHR: true
    }, (e1, xhrFS) => {
      XmlHttpRequestFS.Create({
        index: 'test/fixtures/xhrfs/listings.json',
        baseUrl: '../',
        preferXHR: false
      }, (e2, fetchFS) => {
        if (e1 || e2) {
          throw e1 || e2;
        } else {
          cb('XmlHttpRequest', [xhrFS, fetchFS]);
        }
      });
    });
  } else {
    cb('XmlHttpRequest', []);
  }
}
