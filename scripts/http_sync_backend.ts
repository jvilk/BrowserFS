import ErrnoException = NodeJS.ErrnoException;

import express = require("express");
import * as bodyParser from "body-parser";

const os = require("os");
const fs = require("fs");
const path = require("path");
const app = express();
const port = 8888;

app.use(bodyParser.text())

fs.mkdtemp(os.tmpdir() + path.sep + "httpSync-", (err: ErrnoException, folder: string) => {
  if (!err) {
    let basePath = folder + path.sep;
    console.log(basePath);

    app.post("/fs/*", async (req, res) => {
      let fPath = path.normalize(req.url.replace("fs/", ""));
      console.log(req.body)
      try {
        await fs.promises.writeFile(path.join(basePath, fPath), req.body);
        res.send("ok")
      } catch (e) {
        res.status(400).send(e.code)
      }
    });

    app.get("/fs/*", async (req, res) => {
      let fPath = path.normalize(req.url.replace("fs/", ""));
      console.log(fPath)
      try {
        res.sendFile(path.join(basePath, fPath));
      } catch (e) {
        console.log(e);
        res.status(400).send(e.code);
      }
    });

    app.delete("/fs/*", async (req, res) => {
      let fPath = path.normalize(req.url.replace("fs/", ""));
      console.log(req.body)
      try {
        await fs.promises.unlink(path.join(basePath, fPath));
        res.send("ok")
      } catch (e) {
        res.status(400).send(e.code)
      }
    });

    app.get("/fsStat/*", async (req, res) => {
      let fPath = path.normalize(req.url.replace("fsStat/", ""));
      let stat;
      try {
        let fstat = await fs.promises.stat(path.join(basePath, fPath));
        stat = {
          size: fstat.sizem,
          mode: fstat.mode,
          atime: fstat.atime,
          mtime: fstat.mtime,
          ctime: fstat.ctime,
        };
      } catch (e) {
        console.log(e)
        res.status(400).send(e.code);
        return;
      }

      res.status(200).send(JSON.stringify(stat));
    });

    app.get("/fsReaddir/*", async (req, res) => {
      let fPath = path.normalize(req.url.replace("fsReaddir/", ""));
      let contents;
      try {
        contents = await fs.promises.readdir(path.join(basePath, fPath));

      } catch (e) {
        res.status(400).send(e.code);
        return;
      }

      res.status(200).send(JSON.stringify(contents));
    });

    app.get("/fsMkdir/*", async (req, res) => {
      let fPath = path.normalize(req.url.replace("fsMkdir/", ""));
      console.log(fPath)
      try {
        await fs.promises.mkdir(path.join(basePath, fPath))
      } catch (e) {
        res.status(400).send(e.code);
        return;
      }

      res.status(200).send();
    });

    app.get("/fsRmdir/*", async (req, res) => {
      let fPath = path.normalize(req.url.replace("fsRmdir/", ""));
      if(fPath == path.sep){
        res.status(403).send();
        return;
      }
      try {
        await fs.promises.rmdir(path.join(basePath, fPath))
      } catch (e) {
        res.status(400).send(e.code);
        return;
      }

      res.status(200).send();
    });

    app.listen(port, function () {
      console.log('WebServer listening on port ' + port + '.');
    });
  }

});


