const webdav = require('webdav-server').v2;
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');

const directory = path.join(os.tmpdir(), Math.random().toString(16).substr(2, 8));

fs.mkdir(directory, () => {
  const server = new webdav.WebDAVServer({
    rootFileSystem: new webdav.PhysicalFileSystem(directory)
  });

  const app = express();

  app.use(function (req: any, res: any, next: () => void) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "*");
    res.header("Access-Control-Allow-Headers", "*");
    next();
  });

  app.use(express.static("./"));
  app.listen(1800);
  app.use(webdav.extensions.express('/fs', server));
});
