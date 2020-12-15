const webdav = require('webdav-server').v2;
const express = require('express');
const server = new webdav.WebDAVServer({
  rootFileSystem: new webdav.PhysicalFileSystem('C:\\Users\\nexus\\WebDav')
});
const app = express();


app.use(function (req: any, res: any, next: () => void) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.use(express.static("./"));
app.listen(180);
app.use(webdav.extensions.express('/fs', server));
