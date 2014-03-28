var express = require('express'),
  app = express(),
  root = process.cwd(),
  fs = require('fs'),
  fd, id = 0;

while (fs.existsSync('log_' + id + '.txt')) {
  id++;
}
fd = fs.openSync('log_' + id + '.txt', 'ax+');
fs.writeSync(fd, new Buffer('['), 0, 1, null);

app.use(express.static(root))
app.use(express.json());
app.all('/BFSEvent', function (req, res) {
  // Append body to file.
  var data = new Buffer(JSON.stringify(req.body) + ',');
  fs.writeSync(fd, data, 0, data.length, null);
  res.send({status: 'ok'});
});


app.listen(8080);
console.log("Listening on port 8080.");