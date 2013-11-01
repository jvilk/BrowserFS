BrowserFS
=========

BrowserFS is an in-browser file system that emulates the [Node JS file system API](http://nodejs.org/api/fs.html) and supports storing and retrieving files from various backends.

For more information, see the [wiki](https://github.com/jvilk/BrowserFS/wiki) and [API documentation](http://jvilk.github.io/BrowserFS/).

### Building

Prerequisites:

* Node and NPM
* Grunt and Bower globally installed: `npm install -g grunt bower`

Release:
```
grunt
```

The minified release build can be found in `lib/browserfs.js`.

Development:
```
grunt dev
```

The development build can be found as multiple AMD modules in `tmp`.

Custom builds:

If you want to build BrowserFS with a subset of the available backends,
remove unwanted backends listed in `Gruntfile.js` under the `include`
property of the `compile` task, and remove the `require` statements for
unwanted backends in `build/outro.js`. Then, perform a release build.

### Using
Here's a simple example, using the LocalStorage-backed file system:
```html
<script type="text/javascript" src="browserfs.js"></script>
<script type="text/javascript">
  // Installs globals onto window:
  // * Buffer
  // * require (monkey-patches if already defined)
  // * process
  // You can pass in an arbitrary object if you do not wish to pollute
  // the global namespace.
  BrowserFS.install(window);
  // Grabs the constructor for the LocalStorage-backed file system.
  var lsfsCons = BrowserFS.getFsConstructor('LocalStorage');
  // Constructs an instance of the LocalStorage-backed file system.
  var lsfs = new lsfsCons();
  // Initialize it as the root file system.
  BrowserFS.initialize(lsfs);
</script>
```

Now, you can write code like this:
```javascript
var fs = require('fs');
fs.writeFile('./test.txt', 'Cool, I can do this in the browser!', function(err) {
  fs.readFile('./test.txt', function(err, contents) {
    console.log(contents.toString());
  });
});
```

### Testing

Prerequisites:

* Karma globally installed: `npm install -g karma`

To run unit tests, simply run `grunt test` **(NOTE: This will launch multiple web browsers!)**. You may need to change `build/karma.conf.js` if you do not have Chrome, Safari, Opera, and Firefox installed.

### License

BrowserFS is licensed under the MIT License. See `LICENSE` for details.
