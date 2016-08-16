import {FileSystem} from '../../../src/core/file_system';
import XmlHttpRequestFS from '../../../src/backend/XmlHttpRequest';
import BackendFactory from '../BackendFactory';

export default function XHRFSFactory(cb: (name: string, objs: FileSystem[]) => void): void {
  if (XmlHttpRequestFS.isAvailable()) {
    cb('XmlHttpRequest', [new XmlHttpRequestFS('test/fixtures/xhrfs/listings.json', '../')]);
  } else {
    cb('XmlHttpRequest', []);
  }
}

// For typechecking
var _: BackendFactory = XHRFSFactory;
