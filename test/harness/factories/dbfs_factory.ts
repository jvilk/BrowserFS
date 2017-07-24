import DropboxFileSystem from '../../../src/backend/Dropbox';
import {FileSystem} from '../../../src/core/file_system';

export default function DBFSFactory(cb: (name: string, obj: FileSystem[]) => void): void {
  if (DropboxFileSystem.isAvailable()) {
    var init_client = new Dropbox.Client({
      key: 'c6oex2qavccb2l3'
    }),
    auth = () => {
      init_client.authenticate((error: Dropbox.AuthError | Dropbox.ApiError, authed_client: Dropbox.Client) => {
        if (error) {
          console.error('Error: could not connect to Dropbox');
          console.error(error);
          return cb('Dropbox', []);
        }

        authed_client.getAccountInfo((error, info) => {
          console.debug("Successfully connected to " + info.name + "'s Dropbox");
        });

        DropboxFileSystem.Create({
          client: authed_client
        }, (e, fs) => {
          if (e) {
            throw e;
          } else {
            fs.empty((e) => {
              if (e) {
                throw e;
              } else {
                cb('Dropbox', [fs]);
              }
            });
          }
        });
      });
    };

    // Authenticate with pregenerated unit testing credentials.
    var req = new XMLHttpRequest();
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
