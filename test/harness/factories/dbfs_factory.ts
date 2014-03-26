import dbfs = require('../../../src/backend/dropbox');
import BackendFactory = require('../BackendFactory');
import file_system = require('../../../src/core/file_system');

declare var Dropbox;

function DBFSFactory(cb: (name: string, obj: file_system.FileSystem[]) => void): void {
  if (dbfs.DropboxFileSystem.isAvailable()) {
    var init_client = new Dropbox.Client({
      key: 'c6oex2qavccb2l3',
      sandbox: true
    }),
    auth = () => {
      init_client.authenticate((error, authed_client) => {
        if (error) {
          console.error('Error: could not connect to Dropbox');
          console.error(error);
          return cb('Dropbox', []);
        }

        authed_client.getUserInfo((error, info) => {
          console.debug("Successfully connected to " + info.name + "'s Dropbox");
        });

        var fs = new dbfs.DropboxFileSystem(authed_client);
        fs.empty(() => {
          cb('Dropbox', [fs]);
        });
      });
    };

    // Authenticate with pregenerated unit testing credentials.
    var req = new XMLHttpRequest(), data = null;
    req.open('GET', '/test/fixtures/dropbox/token.json');
    req.onerror = (e) => { console.error(req.statusText); };
    req.onload = (e) => {
      if (!(req.readyState === 4 && req.status === 200)) {
        console.error(req.statusText);
      }
      var creds = JSON.parse(req.response);
      init_client.setCredentials(creds);
      auth();
    };
    req.send();
  } else {
    cb('Dropbox', []);
  }
}

var _: BackendFactory = DBFSFactory;

export = DBFSFactory;
