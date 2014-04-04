import file_system = require('../../../src/core/file_system');
import xhr_fs = require('../../../src/backend/XmlHttpRequest');
import BackendFactory = require('../BackendFactory');
import cache = require('../../../src/adaptors/cache');

function XHRFSFactory(cb: (name: string, objs: file_system.FileSystem[]) => void): void {
  if (xhr_fs.XmlHttpRequest.isAvailable()) {
    cb('XmlHttpRequest', [new xhr_fs.XmlHttpRequest('test/fixtures/xhrfs/listings.json', '../'),
      new xhr_fs.XmlHttpRequest('test/fixtures/xhrfs/listings.json', '../', new cache.InMemoryCache(4*1024*1024))]);
  } else {
    cb('XmlHttpRequest', []);
  }
}

// For typechecking
var _: BackendFactory = XHRFSFactory;

export = XHRFSFactory;
