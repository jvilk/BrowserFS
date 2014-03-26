import file_system = require('../../../src/core/file_system');
import xhr_fs = require('../../../src/backend/XmlHttpRequest');
import BackendFactory = require('../BackendFactory');

function XHRFSFactory(cb: (name: string, objs: file_system.FileSystem[]) => void): void {
  if (xhr_fs.XmlHttpRequest.isAvailable()) {
    cb('XmlHttpRequest', [new xhr_fs.XmlHttpRequest('test/fixtures/xhrfs/listings.json', '../')]);
  } else {
    cb('XmlHttpRequest', []);
  }
}

// For typechecking
var _: BackendFactory = XHRFSFactory;

export = XHRFSFactory;
