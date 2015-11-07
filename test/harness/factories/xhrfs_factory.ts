import file_system = require('../../../src/core/file_system');
import XmlHttpRequestFS from '../../../src/backend/XmlHttpRequest';
import BackendFactory = require('../BackendFactory');

function XHRFSFactory(cb: (name: string, objs: file_system.FileSystem[]) => void): void {
  if (XmlHttpRequestFS.isAvailable()) {
    cb('XmlHttpRequest', [new XmlHttpRequestFS('test/fixtures/xhrfs/listings.json', '../')]);
  } else {
    cb('XmlHttpRequest', []);
  }
}

// For typechecking
var _: BackendFactory = XHRFSFactory;

export = XHRFSFactory;
