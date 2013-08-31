// Authorizes BrowserFS to be used with the user's Dropbox account
// for testing purposes. Prints out the OAuth token to standard
// output in JSON format.
"use strict";
var db = require('../vendor/dropbox-build/dropbox');

var client = new db.Client({
  key: 'c6oex2qavccb2l3',
  secret: 'cb0sxc9e09itvrn',
  sandbox: true,
});

client.authDriver(new db.AuthDriver.NodeServer());

client.authenticate(function() {
  console.log(JSON.stringify(client.credentials()));
  // Node doesn't exit otherwise. I'm not sure why.
  process.exit(0);
});

