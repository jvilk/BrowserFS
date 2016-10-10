#! /usr/bin/env node

import * as fs from 'fs';
const dropbox: typeof Dropbox = require('dropbox');

const client = new dropbox.Client({
  key: 'c6oex2qavccb2l3',
  secret: 'cb0sxc9e09itvrn'
});

const root = 'test/fixtures/dropbox/';
const certPath = "#{root}cert.pem";
const tokenPath = "#{root}token.json";

if (!fs.existsSync(root)) {
  fs.mkdir(root);
}

const cert = fs.readFileSync(certPath);
client.authDriver(new dropbox.AuthDriver.NodeServer(<any> { tls: cert }));

// Check if there are some credentials already stored
let token: any = null
if (fs.existsSync(tokenPath)) {
  const tokenData = fs.readFileSync(tokenPath, 'utf8')
  try {
    token = JSON.parse(tokenData)
  } catch (e) {
    // Do nothing.
  }
}

// Use them to authenticate if there are
if (token) {
  client.setCredentials(token)
}

function fail() {
  console.error('Failed to authenticate');
  process.exit(1);
}

// Authenticate the client using the credentials
// If credentials do not exist OR if existing credentials are not valid,
// this method will pop up a browser window with the Dropbox login prompt.
client.authenticate((error: Dropbox.AuthError | Dropbox.ApiError, authed_client: Dropbox.Client) => {
  if (error) {
    fail();
  } else {
    if (client.isAuthenticated()) {
      // Save the credentials for future use
      fs.writeFileSync(tokenPath, JSON.stringify(authed_client.credentials()));
      console.log('Done');
      process.exit(0);
    } else {
      fail();
    }
  }
});
