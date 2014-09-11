BrowserFS
=========

BrowserFS is an in-browser file system that emulates the [Node JS file system API](http://nodejs.org/api/fs.html) and supports storing and retrieving files from various backends. BrowserFS also integrates nicely into the Emscripten file system.

Provided backends:
* `XmlHttpRequest` (downloads files on-demand from a webserver)
* `localStorage`
* HTML5 `FileSystem`
* IndexedDB
* Dropbox
* In-memory
* Zip file-backed FS (currently read only)

More backends can be defined by separate libraries, so long as they extend the `BaseFileSystem`. Multiple backends can be active at once at different locations in the directory hierarchy.

For more information, see the [wiki](https://github.com/jvilk/BrowserFS/wiki).

### Building

Prerequisites:

* Node and NPM
* Grunt-CLI and Bower globally installed: `npm install -g grunt-cli bower`
* Run `npm install` to install local dependencies

Release:
```
grunt
```

The minified release build can be found in `build/release/browserfs.js`.

Development:
```
grunt dev
```

The development build can be found as multiple AMD modules in `build/dev`.

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
  // Constructs an instance of the LocalStorage-backed file system.
  var lsfs = new BrowserFS.FileSystem.LocalStorage();
  // Initialize it as the root file system.
  BrowserFS.initialize(lsfs);
</script>
```

Now, you can write code like this:
```javascript
var fs = require('fs');
fs.writeFile('/test.txt', 'Cool, I can do this in the browser!', function(err) {
  fs.readFile('/test.txt', function(err, contents) {
    console.log(contents.toString());
  });
});
```

### Using with Emscripten

You can use any *synchronous* BrowserFS file systems with Emscripten! Persist particular folders in the Emscripten file system to `localStorage`, or enable Emscripten to synchronously download files from another folder as they are requested.

Include `browserfs.js` into the page, and add code similar to the following to your `Module`'s `preRun` array:

```javascript
/**
 * Mounts a localStorage-backed file system into the /home folder of Emscripten's file system.
 */
function setupBFS() {
  // Constructs an instance of the LocalStorage-backed file system.
  var lsfs = new BrowserFS.FileSystem.LocalStorage();
  // Initialize it as the root file system.
  BrowserFS.initialize(lsfs);
  // Grab the BrowserFS Emscripten FS plugin.
  var BFS = new BrowserFS.EmscriptenFS();
  // Create the folder that we'll turn into a mount point.
  FS.createFolder(FS.root, 'home', true, true);
  // Mount BFS's root folder into the '/home' folder.
  FS.mount(BFS, {root: '/'}, '/home');
}
```

Note: Do **NOT** use `BrowserFS.install(window)` on a page with an Emscripten application! Emscripten will be tricked into thinking that it is running in Node JS.

### Testing

Prerequisites:

* Karma globally installed: `npm install -g karma`

To run unit tests, simply run `grunt test` **(NOTE: This will launch multiple web browsers!)**. You may need to change `build/karma.conf.js` if you do not have Chrome, Safari, Opera, and Firefox installed.

### License

BrowserFS is licensed under the MIT License. See `LICENSE` for details.
